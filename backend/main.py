import asyncio
import csv
from email.message import EmailMessage
import os
import random
import smtplib
import importlib
import threading
import time
from datetime import datetime, timedelta
from io import StringIO
import json
from pathlib import Path
from typing import List, Optional

import psycopg2
import requests
import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field

try:
    import numpy as np
except ImportError:
    np = None

BASE_DIR = Path(__file__).resolve().parent
# Load environment variables from the backend directory so imports work regardless of cwd.
load_dotenv(BASE_DIR / ".env")


def env_flag(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_cors_settings():
    raw_origin_regex = os.environ.get("CORS_ALLOW_ORIGIN_REGEX", "").strip() or None
    raw_origins = os.environ.get(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).strip()

    if raw_origins == "*":
        return ["*"], False, None

    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["http://localhost:3000", "http://127.0.0.1:3000"], True, raw_origin_regex


app = FastAPI()

DEFAULT_MODEL_CLASSES = [
    "no_activity",
    "shower",
    "faucet",
    "toilet",
    "dishwasher",
]
MODEL_VERSION = os.environ.get("MODEL_VERSION", "1.0")
MODEL_ACCURACY = float(os.environ.get("MODEL_ACCURACY", "0.85"))
AUTH_SECRET_KEY = os.environ.get("AUTH_SECRET_KEY", "change-this-secret-in-production")
AUTH_ALGORITHM = "HS256"
AUTH_TOKEN_EXPIRE_MINUTES = int(os.environ.get("AUTH_TOKEN_EXPIRE_MINUTES", "720"))
ALERT_EMAIL_ENABLED = env_flag("ALERT_EMAIL_ENABLED", False)
ALERT_EMAIL_FROM = os.environ.get("ALERT_EMAIL_FROM", "")
ALERT_EMAIL_TO = os.environ.get("ALERT_EMAIL_TO", "")
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_USE_TLS = env_flag("SMTP_USE_TLS", True)
ALERT_COOLDOWN_MINUTES = int(os.environ.get("ALERT_COOLDOWN_MINUTES", "30"))
CRITICAL_WATER_LEVEL_PERCENT = float(os.environ.get("CRITICAL_WATER_LEVEL_PERCENT", "15"))
HIGH_TEMPERATURE_C = float(os.environ.get("HIGH_TEMPERATURE_C", "35"))
MAX_DISTANCE_CM = float(os.environ.get("MAX_DISTANCE_CM", "220"))
ALERT_PREDICTION_LABELS = {
    item.strip()
    for item in os.environ.get("ALERT_PREDICTION_LABELS", "flush,geyser,washing_machine").split(",")
    if item.strip()
}
MODEL_PATH_CANDIDATES = [
    BASE_DIR / "saved_models" / "best_model.h5",
    BASE_DIR / "saved_models" / "LSTM_model.h5",
    BASE_DIR.parent / "ml_model" / "saved_models" / "best_model.h5",
    BASE_DIR.parent / "ml_model" / "saved_models" / "LSTM_model.h5",
]
MODEL_METADATA_CANDIDATES = [
    BASE_DIR / "saved_models" / "best_model_metadata.json",
    BASE_DIR.parent / "ml_model" / "saved_models" / "best_model_metadata.json",
]

ml_model = None
model_path = None
model_classes = DEFAULT_MODEL_CLASSES
model_metadata = {}
model_load_attempted = False
model_load_error = None
model_load_lock = threading.Lock()
TEST_MODE = env_flag("TEST_MODE", True)
ENABLE_SENSOR_COLLECTOR = env_flag("ENABLE_SENSOR_COLLECTOR", True)
SENSOR_POLL_SECONDS = int(os.environ.get("SENSOR_POLL_SECONDS", "20"))
MODEL_PRELOAD_ON_STARTUP = env_flag("MODEL_PRELOAD_ON_STARTUP", False)
ALLOWED_ORIGINS, ALLOW_CREDENTIALS, ALLOWED_ORIGIN_REGEX = get_cors_settings()
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class RealtimeConnectionManager:

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        stale_connections = []

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except RuntimeError:
                stale_connections.append(connection)
            except Exception:
                stale_connections.append(connection)

        for connection in stale_connections:
            self.disconnect(connection)

    def publish(self, message: dict):
        loop = getattr(app.state, "websocket_loop", None)
        if loop is None or loop.is_closed() or not self.active_connections:
            return

        asyncio.run_coroutine_threadsafe(self.broadcast(message), loop)


realtime_manager = RealtimeConnectionManager()

# Added CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=ALLOW_CREDENTIALS,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# ==============================
# DATABASE CONNECTION
# ==============================


def get_connection():
    """
    Get database connection using environment variables.
    Falls back to local development settings if env vars not set.
    """
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=os.environ.get("DB_PORT", "5432"),
        database=os.environ.get("DB_NAME", "iot-test"),
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASSWORD", "postgres"),
        sslmode=os.environ.get("DB_SSLMODE", "prefer")  # Use "require" for Aiven
    )


# ==============================
# CREATE TABLES
# ==============================
def create_tables():

    conn = get_connection()
    cur = conn.cursor()

    # Sensor data table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS sensor_data (
        id SERIAL PRIMARY KEY,
        node_id VARCHAR(50),
        field1 FLOAT,
        field2 FLOAT,
        created_at TIMESTAMP
    )
    """)

    # Tank parameters table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS tank_sensorparameters (
        id SERIAL PRIMARY KEY,
        node_id VARCHAR(50),
        tank_height_cm FLOAT,
        tank_length_cm FLOAT,
        tank_width_cm FLOAT,
        lat FLOAT,
        long FLOAT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(80) UNIQUE NOT NULL,
        full_name VARCHAR(120),
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS predictions (
        id SERIAL PRIMARY KEY,
        node_id VARCHAR(50),
        distance FLOAT,
        temperature FLOAT,
        prediction VARCHAR(50),
        confidence FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        node_id VARCHAR(50) NOT NULL,
        alert_type VARCHAR(80) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        prediction VARCHAR(80),
        confidence FLOAT,
        distance FLOAT,
        temperature FLOAT,
        email_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    cur.close()
    conn.close()


# ==============================
# THINGSPEAK CONFIG
# ==============================
REAL_DATA_WITH_CURRENT_TIME = False

# Node id of sensor
NODE_ID = "NODE_001"

# ThingSpeak API
url = "https://api.thingspeak.com/channels/3290444/feeds.json?api_key=AWP8F08WA7SLO5EQ&results=-1"

last_created_at = None


# ==============================
# GENERATE TEST DATA
# ==============================
def generate_test_data():

    base_values = {
        "distance": 94.0,
        "temperature": 20.8
    }

    return {
        "distance": round(base_values["distance"] + random.uniform(-10, 10), 1),
        "temperature": round(base_values["temperature"] + random.uniform(-2, 2), 1),
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


# ==============================
# SENSOR DATA COLLECTOR
# ==============================
def sensor_collector():

    global last_created_at

    print("Distance & Temperature Data Collector Started")

    while True:

        try:

            if TEST_MODE:

                test_data = generate_test_data()

                distance = test_data["distance"]
                temperature = test_data["temperature"]
                created_at = test_data["created_at"]

            else:

                response = requests.get(url)
                data = response.json()

                feed = data["feeds"][0]

                distance = float(feed["field1"])
                temperature = float(feed["field2"])
                created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            print("NEW DATA:", distance, temperature, created_at)

            conn = get_connection()
            cur = conn.cursor()

            cur.execute("""
            INSERT INTO sensor_data
            (node_id, field1, field2, created_at)
            VALUES (%s,%s,%s,%s)
            """,
                        (NODE_ID, distance, temperature, created_at))

            conn.commit()

            cur.close()
            conn.close()

            realtime_manager.publish(
                build_realtime_prediction_event(
                    NODE_ID,
                    distance,
                    temperature,
                    created_at,
                )
            )

            sensor_payload = PredictionRequest(node_id=NODE_ID, distance=distance, temperature=temperature)
            sensor_label, sensor_confidence, _ = run_prediction(sensor_payload)
            process_anomaly_alerts(
                node_id=NODE_ID,
                distance=distance,
                temperature=temperature,
                prediction=sensor_label,
                confidence=sensor_confidence,
            )

            print("Sensor data inserted")

        except Exception as e:

            print("Error:", e)

        time.sleep(SENSOR_POLL_SECONDS)


# ==============================
# REQUEST MODEL
# ==============================
class TankParameters(BaseModel):

    node_id: str
    tank_height_cm: float
    tank_length_cm: float
    tank_width_cm: float
    lat: float
    long: float


class PredictionRequest(BaseModel):

    node_id: str = Field(default=NODE_ID)
    distance: float
    temperature: float
    time_features: List[float] = Field(default_factory=list)


class UserRegisterRequest(BaseModel):

    username: str = Field(min_length=3, max_length=80)
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class UserLoginRequest(BaseModel):

    username: str
    password: str


class UserProfile(BaseModel):

    id: int
    username: str
    full_name: Optional[str] = None
    created_at: datetime


class AuthResponse(BaseModel):

    access_token: str
    token_type: str = "bearer"
    user: UserProfile


class BatchPredictionItem(BaseModel):

    row_number: int
    node_id: str
    distance: float
    temperature: float
    time_features: List[float] = Field(default_factory=list)
    prediction: str
    confidence: float
    created_at: datetime
    model_source: str


class BatchPredictionError(BaseModel):

    row_number: int
    error: str


class BatchPredictionResponse(BaseModel):

    total_rows: int
    processed_rows: int
    failed_rows: int
    predictions: List[BatchPredictionItem]
    errors: List[BatchPredictionError]


class AlertRecord(BaseModel):

    id: int
    node_id: str
    alert_type: str
    severity: str
    message: str
    prediction: Optional[str] = None
    confidence: Optional[float] = None
    distance: Optional[float] = None
    temperature: Optional[float] = None
    email_sent: bool
    created_at: datetime


def hash_password(password: str) -> str:

    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:

    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(username: str) -> str:

    expires_delta = timedelta(minutes=AUTH_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": username,
        "exp": datetime.utcnow() + expires_delta,
    }
    return jwt.encode(payload, AUTH_SECRET_KEY, algorithm=AUTH_ALGORITHM)


def get_user_by_username(username: str):

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, username, full_name, password_hash, created_at
        FROM users
        WHERE username = %s
        """,
        (username,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if row is None:
        return None

    return {
        "id": row[0],
        "username": row[1],
        "full_name": row[2],
        "password_hash": row[3],
        "created_at": row[4],
    }


def build_user_profile(user_record) -> UserProfile:

    return UserProfile(
        id=user_record["id"],
        username=user_record["username"],
        full_name=user_record.get("full_name"),
        created_at=user_record["created_at"],
    )


def authenticate_user(username: str, password: str):

    user = get_user_by_username(username)

    if user is None or not verify_password(password, user["password_hash"]):
        return None

    return user


def get_current_user(token: str = Depends(oauth2_scheme)) -> UserProfile:

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, AUTH_SECRET_KEY, algorithms=[AUTH_ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = get_user_by_username(username)

    if user is None:
        raise credentials_exception

    return build_user_profile(user)


def get_user_from_token(token: str):

    try:
        payload = jwt.decode(token, AUTH_SECRET_KEY, algorithms=[AUTH_ALGORITHM])
        username = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None

    return get_user_by_username(username)


def resolve_model_classes(output_dim: Optional[int]) -> List[str]:

    configured = [
        label.strip() for label in os.environ.get("MODEL_CLASSES", "").split(",") if label.strip()
    ]
    labels = configured or DEFAULT_MODEL_CLASSES

    if not output_dim:
        return labels

    if len(labels) >= output_dim:
        return labels[:output_dim]

    generated = labels[:]
    while len(generated) < output_dim:
        generated.append(f"class_{len(generated)}")
    return generated


def load_model_metadata():

    global model_metadata, model_classes

    for candidate in MODEL_METADATA_CANDIDATES:
        if candidate.exists():
            model_metadata = json.loads(candidate.read_text(encoding="utf-8"))
            metadata_classes = model_metadata.get("classes") or []
            model_classes = metadata_classes or resolve_model_classes(None)
            return

    model_metadata = {}
    model_classes = resolve_model_classes(None)


def get_model_input_spec():

    if ml_model is None:
        return 1, 2

    input_shape = getattr(ml_model, "input_shape", None)

    if not input_shape:
        return 1, 2

    if isinstance(input_shape, list):
        input_shape = input_shape[0]

    if len(input_shape) == 3:
        timesteps = input_shape[1] or 1
        features = input_shape[2] or 2
        return timesteps, features

    if len(input_shape) == 2:
        features = input_shape[1] or 2
        return 1, features

    return 1, 2


def prepare_model_input(payload: PredictionRequest):

    if np is None:
        raise HTTPException(status_code=500, detail="numpy is required for predictions")

    timesteps, feature_count = get_model_input_spec()
    base_features = [payload.distance, payload.temperature, *payload.time_features]

    if len(base_features) < feature_count:
        base_features.extend([0.0] * (feature_count - len(base_features)))
    else:
        base_features = base_features[:feature_count]

    feature_vector = np.array(base_features, dtype="float32")

    if timesteps > 1:
        sequence = np.tile(feature_vector, (timesteps, 1))
        return np.expand_dims(sequence, axis=0)

    return np.expand_dims(feature_vector, axis=0)


def fallback_predict(payload: PredictionRequest):

    if payload.distance < 35:
        label = "shower"
        confidence = 0.82
    elif payload.temperature > 27:
        label = "dishwasher"
        confidence = 0.73
    elif payload.distance < 60:
        label = "toilet"
        confidence = 0.68
    elif payload.distance < 85:
        label = "faucet"
        confidence = 0.64
    else:
        label = "no_activity"
        confidence = 0.9

    return label, confidence, "fallback"


def load_prediction_model():

    global ml_model, model_path, model_classes, model_load_attempted, model_load_error

    load_model_metadata()

    with model_load_lock:
        if model_load_attempted:
            return ml_model

        model_load_attempted = True
        model_load_error = None

        try:
            keras_models = importlib.import_module("tensorflow.keras.models")
        except ImportError as error:
            ml_model = None
            model_path = None
            model_classes = resolve_model_classes(None)
            model_load_error = str(error)
            return None

        for candidate in MODEL_PATH_CANDIDATES:
            if candidate.exists():
                try:
                    ml_model = keras_models.load_model(candidate, compile=False)
                    model_path = candidate
                    output_shape = getattr(ml_model, "output_shape", None)

                    if isinstance(output_shape, list):
                        output_shape = output_shape[0]

                    output_dim = None
                    if output_shape and len(output_shape) >= 2:
                        output_dim = output_shape[-1]

                    metadata_classes = model_metadata.get("classes") or []
                    if metadata_classes:
                        model_classes = metadata_classes
                    else:
                        model_classes = resolve_model_classes(output_dim)
                    return ml_model
                except Exception as error:
                    ml_model = None
                    model_path = None
                    model_classes = resolve_model_classes(None)
                    model_load_error = str(error)
                    return None

        ml_model = None
        model_path = None
        model_classes = resolve_model_classes(None)
        return None


def ensure_prediction_model_loaded():

    if ml_model is not None:
        return ml_model

    return load_prediction_model()


def save_prediction_record(payload: PredictionRequest, label: str, confidence: float):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO predictions
        (node_id, distance, temperature, prediction, confidence)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, created_at
        """,
        (payload.node_id, payload.distance, payload.temperature, label, confidence),
    )

    record_id, created_at = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return record_id, created_at


def get_tank_height_for_node(node_id: str) -> Optional[float]:

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT tank_height_cm
        FROM tank_sensorparameters
        WHERE node_id = %s
        ORDER BY id DESC
        LIMIT 1
        """,
        (node_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return float(row[0]) if row and row[0] is not None else None


def compute_water_level_percentage(node_id: str, distance: float) -> Optional[float]:

    tank_height = get_tank_height_for_node(node_id)
    if tank_height is None or tank_height <= 0:
        return None

    return max(0.0, min(100.0, ((tank_height - distance) / tank_height) * 100.0))


def should_send_alert(node_id: str, alert_type: str) -> bool:

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT created_at
        FROM alerts
        WHERE node_id = %s AND alert_type = %s
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (node_id, alert_type),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if row is None:
        return True

    return (datetime.utcnow() - row[0]).total_seconds() >= ALERT_COOLDOWN_MINUTES * 60


def send_alert_email(subject: str, body: str) -> bool:

    if not ALERT_EMAIL_ENABLED:
        return False

    required = [ALERT_EMAIL_FROM, ALERT_EMAIL_TO, SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD]
    if not all(required):
        print("Alert email skipped: SMTP settings are incomplete")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = ALERT_EMAIL_FROM
    message["To"] = ALERT_EMAIL_TO
    message.set_content(body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            if SMTP_USE_TLS:
                server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(message)
        return True
    except Exception as error:
        print(f"Alert email failed: {error}")
        return False


def save_alert_record(
    node_id: str,
    alert_type: str,
    severity: str,
    message: str,
    prediction: Optional[str],
    confidence: Optional[float],
    distance: float,
    temperature: float,
    email_sent: bool,
):

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO alerts
        (node_id, alert_type, severity, message, prediction, confidence, distance, temperature, email_sent)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, created_at
        """,
        (node_id, alert_type, severity, message, prediction, confidence, distance, temperature, email_sent),
    )
    record_id, created_at = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return record_id, created_at


def create_alert_message(
    node_id: str,
    alert_type: str,
    distance: float,
    temperature: float,
    prediction: Optional[str],
    confidence: Optional[float],
    water_level_percentage: Optional[float],
) -> tuple[str, str]:

    if alert_type == "critical_low_water_level":
        subject = f"Critical water level alert for {node_id}"
        body = (
            f"Node {node_id} has critical low water level.\n"
            f"Water level: {water_level_percentage:.1f}%\n"
            f"Distance: {distance} cm\n"
            f"Temperature: {temperature} C\n"
        )
        return subject, body

    if alert_type == "high_temperature":
        subject = f"High temperature alert for {node_id}"
        body = (
            f"Node {node_id} exceeded the temperature threshold.\n"
            f"Temperature: {temperature} C\n"
            f"Distance: {distance} cm\n"
        )
        return subject, body

    if alert_type == "sensor_out_of_range":
        subject = f"Sensor anomaly detected for {node_id}"
        body = (
            f"Node {node_id} produced a distance reading outside the expected range.\n"
            f"Distance: {distance} cm\n"
            f"Temperature: {temperature} C\n"
        )
        return subject, body

    subject = f"Prediction anomaly detected for {node_id}"
    body = (
        f"Node {node_id} triggered a prediction-based anomaly alert.\n"
        f"Prediction: {prediction}\n"
        f"Confidence: {confidence:.2f}\n"
        f"Distance: {distance} cm\n"
        f"Temperature: {temperature} C\n"
    )
    return subject, body


def detect_alert_candidates(
    node_id: str,
    distance: float,
    temperature: float,
    prediction: Optional[str],
    confidence: Optional[float],
):

    alerts = []
    water_level_percentage = compute_water_level_percentage(node_id, distance)

    if water_level_percentage is not None and water_level_percentage <= CRITICAL_WATER_LEVEL_PERCENT:
        alerts.append(("critical_low_water_level", "high", water_level_percentage))

    if temperature >= HIGH_TEMPERATURE_C:
        alerts.append(("high_temperature", "medium", water_level_percentage))

    if distance < 0 or distance > MAX_DISTANCE_CM:
        alerts.append(("sensor_out_of_range", "high", water_level_percentage))

    if prediction and prediction in ALERT_PREDICTION_LABELS and confidence is not None and confidence >= 0.7:
        alerts.append(("prediction_anomaly", "medium", water_level_percentage))

    return alerts


def process_anomaly_alerts(
    node_id: str,
    distance: float,
    temperature: float,
    prediction: Optional[str] = None,
    confidence: Optional[float] = None,
):

    created_alerts = []

    for alert_type, severity, water_level_percentage in detect_alert_candidates(
        node_id,
        distance,
        temperature,
        prediction,
        confidence,
    ):
        if not should_send_alert(node_id, alert_type):
            continue

        subject, body = create_alert_message(
            node_id,
            alert_type,
            distance,
            temperature,
            prediction,
            confidence,
            water_level_percentage,
        )
        email_sent = send_alert_email(subject, body)
        message = body.splitlines()[0]
        alert_id, created_at = save_alert_record(
            node_id=node_id,
            alert_type=alert_type,
            severity=severity,
            message=message,
            prediction=prediction,
            confidence=confidence,
            distance=distance,
            temperature=temperature,
            email_sent=email_sent,
        )
        alert_event = {
            "type": "alert",
            "id": alert_id,
            "node_id": node_id,
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "prediction": prediction,
            "confidence": round(confidence, 4) if confidence is not None else None,
            "distance": distance,
            "temperature": temperature,
            "email_sent": email_sent,
            "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
        }
        realtime_manager.publish(alert_event)
        created_alerts.append(alert_event)

    return created_alerts


def parse_time_features(value: str) -> List[float]:

    if value is None:
        return []

    stripped = str(value).strip()
    if not stripped:
        return []

    features = []

    for item in stripped.split(","):
        token = item.strip()
        if not token:
            continue
        try:
            features.append(float(token))
        except ValueError as error:
            raise ValueError(f"invalid time_features value '{token}'") from error

    return features


def build_prediction_response_item(
    row_number: int,
    payload: PredictionRequest,
    label: str,
    confidence: float,
    created_at: datetime,
    source: str,
) -> BatchPredictionItem:

    return BatchPredictionItem(
        row_number=row_number,
        node_id=payload.node_id,
        distance=payload.distance,
        temperature=payload.temperature,
        time_features=payload.time_features,
        prediction=label,
        confidence=round(confidence, 4),
        created_at=created_at,
        model_source=source,
    )


def process_batch_prediction_rows(rows: List[dict]) -> BatchPredictionResponse:

    predictions: List[BatchPredictionItem] = []
    errors: List[BatchPredictionError] = []

    for row_number, row in enumerate(rows, start=2):
        try:
            node_id = str(row.get("node_id") or NODE_ID).strip() or NODE_ID
            distance_raw = row.get("distance")
            temperature_raw = row.get("temperature")

            if distance_raw in (None, ""):
                raise ValueError("distance is required")
            if temperature_raw in (None, ""):
                raise ValueError("temperature is required")

            payload = PredictionRequest(
                node_id=node_id,
                distance=float(distance_raw),
                temperature=float(temperature_raw),
                time_features=parse_time_features(row.get("time_features", "")),
            )

            label, confidence, source = run_prediction(payload)
            _, created_at = save_prediction_record(payload, label, confidence)

            predictions.append(
                build_prediction_response_item(row_number, payload, label, confidence, created_at, source)
            )
            process_anomaly_alerts(
                node_id=payload.node_id,
                distance=payload.distance,
                temperature=payload.temperature,
                prediction=label,
                confidence=confidence,
            )
        except Exception as error:
            errors.append(BatchPredictionError(row_number=row_number, error=str(error)))

    return BatchPredictionResponse(
        total_rows=len(rows),
        processed_rows=len(predictions),
        failed_rows=len(errors),
        predictions=predictions,
        errors=errors,
    )


def run_prediction(payload: PredictionRequest):

    source = "ml_model"

    if ensure_prediction_model_loaded() is None:
        return fallback_predict(payload)

    prepared_input = prepare_model_input(payload)
    prediction_scores = ml_model.predict(prepared_input, verbose=0)[0]

    if np is None:
        raise HTTPException(status_code=500, detail="numpy is required for predictions")

    predicted_index = int(np.argmax(prediction_scores))
    label = model_classes[predicted_index]
    confidence = float(prediction_scores[predicted_index])
    return label, confidence, source


def build_realtime_prediction_event(node_id: str, distance: float, temperature: float, created_at: str):

    payload = PredictionRequest(node_id=node_id, distance=distance, temperature=temperature)
    label, confidence, source = run_prediction(payload)

    return {
        "type": "sensor_prediction",
        "node_id": node_id,
        "distance": distance,
        "temperature": temperature,
        "prediction": label,
        "confidence": round(confidence, 4),
        "created_at": created_at,
        "model_source": source,
    }


@app.post("/api/v1/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegisterRequest):

    existing_user = get_user_by_username(payload.username)
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="Username already exists")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO users (username, full_name, password_hash)
        VALUES (%s, %s, %s)
        RETURNING id, username, full_name, created_at
        """,
        (payload.username, payload.full_name, hash_password(payload.password)),
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    user_profile = UserProfile(
        id=row[0],
        username=row[1],
        full_name=row[2],
        created_at=row[3],
    )
    access_token = create_access_token(user_profile.username)
    return AuthResponse(access_token=access_token, user=user_profile)


@app.post("/api/v1/auth/login", response_model=AuthResponse)
def login_user(payload: UserLoginRequest):

    user = authenticate_user(payload.username, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = create_access_token(user["username"])
    return AuthResponse(access_token=access_token, user=build_user_profile(user))


@app.get("/api/v1/auth/me", response_model=UserProfile)
def read_current_user(current_user: UserProfile = Depends(get_current_user)):

    return current_user


@app.websocket("/api/v1/ws/realtime")
async def realtime_predictions_socket(websocket: WebSocket, token: str = Query(default="")):

    user = get_user_from_token(token)

    if user is None:
        await websocket.close(code=1008)
        return

    await realtime_manager.connect(websocket)
    await websocket.send_json({
        "type": "connection_ack",
        "message": "Realtime prediction stream connected",
        "username": user["username"],
    })

    try:
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        realtime_manager.disconnect(websocket)


# ==============================
# POST API
# ==============================
@app.post("/tank-parameters")
@app.post("/api/v1/tank-sensorparameters")
def create_tank_parameters(data: TankParameters, current_user: UserProfile = Depends(get_current_user)):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO tank_sensorparameters
    (node_id, tank_height_cm, tank_length_cm, tank_width_cm, lat, long)
    VALUES (%s,%s,%s,%s,%s,%s)
    RETURNING id
    """,
                (
                    data.node_id,
                    data.tank_height_cm,
                    data.tank_length_cm,
                    data.tank_width_cm,
                    data.lat,
                    data.long
                ))

    new_id = cur.fetchone()[0]

    conn.commit()
    cur.close()
    conn.close()

    return {
        "message": "Tank parameters inserted successfully",
        "id": new_id
    }


# ==============================
# GET API
# ==============================
@app.get("/tank-parameters")
@app.get("/api/v1/tank-sensorparameters")
def get_tank_parameters(current_user: UserProfile = Depends(get_current_user)):

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM tank_sensorparameters")

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []

    for row in rows:
        result.append({
            "id": row[0],
            "node_id": row[1],
            "tank_height_cm": row[2],
            "tank_length_cm": row[3],
            "tank_width_cm": row[4],
            "lat": row[5],
            "long": row[6]
        })

    return result


# ==============================
# GET SENSOR DATA API
# ==============================
@app.get("/sensor-data")
@app.get("/api/v1/sensor-data")
def get_sensor_data(
    node_id: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    current_user: UserProfile = Depends(get_current_user),
):

    conn = get_connection()
    cur = conn.cursor()

    if node_id:
        cur.execute("""
        SELECT id,node_id,field1,field2,created_at
        FROM sensor_data
        WHERE node_id = %s
        ORDER BY created_at DESC
        LIMIT %s
        """, (node_id, limit))
    else:
        cur.execute("""
        SELECT id,node_id,field1,field2,created_at
        FROM sensor_data
        ORDER BY created_at DESC
        LIMIT %s
        """, (limit,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []

    for row in rows:
        result.append({
            "id": row[0],
            "node_id": row[1],
            "distance": row[2],
            "temperature": row[3],
            "created_at": row[4]
        })

    return result


@app.get("/")
def read_root():

    return {
        "service": "water-level-monitoring-api",
        "status": "ok",
        "docs": "/docs",
        "model_loaded": ml_model is not None,
    }


@app.get("/health")
def get_health():

    return {
        "status": "healthy",
        "database": "configured",
        "model_loaded": ml_model is not None,
        "collector_enabled": ENABLE_SENSOR_COLLECTOR,
    }


@app.post("/api/v1/predict")
def predict_water_activity(payload: PredictionRequest, current_user: UserProfile = Depends(get_current_user)):

    label, confidence, source = run_prediction(payload)

    record_id, created_at = save_prediction_record(payload, label, confidence)
    process_anomaly_alerts(
        node_id=payload.node_id,
        distance=payload.distance,
        temperature=payload.temperature,
        prediction=label,
        confidence=confidence,
    )

    realtime_manager.publish({
        "type": "manual_prediction",
        "id": record_id,
        "node_id": payload.node_id,
        "distance": payload.distance,
        "temperature": payload.temperature,
        "prediction": label,
        "confidence": round(confidence, 4),
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
        "model_source": source,
    })

    return {
        "id": record_id,
        "node_id": payload.node_id,
        "prediction": label,
        "confidence": round(confidence, 4),
        "created_at": created_at,
        "model_source": source,
    }


@app.post("/api/v1/predict/batch", response_model=BatchPredictionResponse)
async def predict_water_activity_batch(
    file: UploadFile = File(...),
    current_user: UserProfile = Depends(get_current_user),
):

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded CSV file is empty")

    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise HTTPException(status_code=400, detail="CSV file must be UTF-8 encoded") from error

    reader = csv.DictReader(StringIO(decoded))
    columns = set(reader.fieldnames or [])

    if not {"distance", "temperature"}.issubset(columns):
        raise HTTPException(
            status_code=400,
            detail="CSV must include distance and temperature columns; optional columns are node_id and time_features",
        )

    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file must contain at least one data row")

    return process_batch_prediction_rows(rows)


@app.get("/api/v1/model-info")
def get_model_info(current_user: UserProfile = Depends(get_current_user)):

    load_model_metadata()

    last_trained = None
    model_name = None

    if model_path is not None:
        last_trained = datetime.fromtimestamp(model_path.stat().st_mtime).strftime("%Y-%m-%d")
        model_name = model_path.name

    return {
        "model_type": model_metadata.get("model_type", "LSTM"),
        "model_name": model_name or model_metadata.get("model_name", "fallback-rules"),
        "version": model_metadata.get("version", MODEL_VERSION),
        "accuracy": model_metadata.get("accuracy", MODEL_ACCURACY),
        "macro_f1": model_metadata.get("macro_f1"),
        "last_trained": model_metadata.get("last_trained", last_trained),
        "classes": model_classes,
        "loaded": ml_model is not None,
        "load_error": model_load_error,
    }


@app.get("/api/v1/predictions-history")
def get_predictions_history(
    limit: int = Query(default=100, ge=1, le=500),
    current_user: UserProfile = Depends(get_current_user),
):

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, node_id, distance, temperature, prediction, confidence, created_at
        FROM predictions
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (limit,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [
        {
            "id": row[0],
            "node_id": row[1],
            "distance": row[2],
            "temperature": row[3],
            "prediction": row[4],
            "confidence": row[5],
            "created_at": row[6],
        }
        for row in rows
    ]


@app.get("/api/v1/alerts", response_model=List[AlertRecord])
def get_alerts(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: UserProfile = Depends(get_current_user),
):

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, node_id, alert_type, severity, message, prediction, confidence, distance, temperature, email_sent, created_at
        FROM alerts
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (limit,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [
        AlertRecord(
            id=row[0],
            node_id=row[1],
            alert_type=row[2],
            severity=row[3],
            message=row[4],
            prediction=row[5],
            confidence=row[6],
            distance=row[7],
            temperature=row[8],
            email_sent=row[9],
            created_at=row[10],
        )
        for row in rows
    ]

# ==============================
# START BACKGROUND COLLECTOR
# ==============================
@app.on_event("startup")
async def start_background_tasks():

    app.state.websocket_loop = asyncio.get_running_loop()

    create_tables()
    load_model_metadata()

    if MODEL_PRELOAD_ON_STARTUP:
        thread = threading.Thread(target=load_prediction_model)
        thread.daemon = True
        thread.start()

    if ENABLE_SENSOR_COLLECTOR:
        thread = threading.Thread(target=sensor_collector)
        thread.daemon = True
        thread.start()


# ==============================
# MAIN
# ==============================
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))

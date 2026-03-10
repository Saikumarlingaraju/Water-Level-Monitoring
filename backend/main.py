import os
import random
import threading
import time
from datetime import datetime
import json
from pathlib import Path
from typing import List, Optional

import psycopg2
import requests
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import numpy as np
except ImportError:
    np = None

try:
    from tensorflow.keras.models import load_model
except ImportError:
    load_model = None

# Load environment variables from .env file
load_dotenv()


def env_flag(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_cors_settings():
    raw_origins = os.environ.get(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).strip()

    if raw_origins == "*":
        return ["*"], False

    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["http://localhost:3000", "http://127.0.0.1:3000"], True


app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_CLASSES = [
    "no_activity",
    "shower",
    "faucet",
    "toilet",
    "dishwasher",
]
MODEL_VERSION = os.environ.get("MODEL_VERSION", "1.0")
MODEL_ACCURACY = float(os.environ.get("MODEL_ACCURACY", "0.85"))
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
TEST_MODE = env_flag("TEST_MODE", True)
ENABLE_SENSOR_COLLECTOR = env_flag("ENABLE_SENSOR_COLLECTOR", True)
SENSOR_POLL_SECONDS = int(os.environ.get("SENSOR_POLL_SECONDS", "20"))
ALLOWED_ORIGINS, ALLOW_CREDENTIALS = get_cors_settings()

# Added CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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

    global model_metadata

    for candidate in MODEL_METADATA_CANDIDATES:
        if candidate.exists():
            model_metadata = json.loads(candidate.read_text(encoding="utf-8"))
            return

    model_metadata = {}


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

    global ml_model, model_path, model_classes

    load_model_metadata()

    if load_model is None:
        ml_model = None
        model_path = None
        model_classes = DEFAULT_MODEL_CLASSES
        return

    for candidate in MODEL_PATH_CANDIDATES:
        if candidate.exists():
            ml_model = load_model(candidate, compile=False)
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
            return

    ml_model = None
    model_path = None
    model_classes = DEFAULT_MODEL_CLASSES


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


# ==============================
# POST API
# ==============================
@app.post("/tank-parameters")
@app.post("/api/v1/tank-sensorparameters")
def create_tank_parameters(data: TankParameters):

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
def get_tank_parameters():

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
def get_sensor_data(node_id: Optional[str] = None, limit: int = Query(default=100, ge=1, le=500)):

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
def predict_water_activity(payload: PredictionRequest):

    source = "ml_model"

    if ml_model is None:
        label, confidence, source = fallback_predict(payload)
    else:
        prepared_input = prepare_model_input(payload)
        prediction_scores = ml_model.predict(prepared_input, verbose=0)[0]

        if np is None:
            raise HTTPException(status_code=500, detail="numpy is required for predictions")

        predicted_index = int(np.argmax(prediction_scores))
        label = model_classes[predicted_index]
        confidence = float(prediction_scores[predicted_index])

    record_id, created_at = save_prediction_record(payload, label, confidence)

    return {
        "id": record_id,
        "node_id": payload.node_id,
        "prediction": label,
        "confidence": round(confidence, 4),
        "created_at": created_at,
        "model_source": source,
    }


@app.get("/api/v1/model-info")
def get_model_info():

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
    }


@app.get("/api/v1/predictions-history")
def get_predictions_history(limit: int = Query(default=100, ge=1, le=500)):

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

# ==============================
# START BACKGROUND COLLECTOR
# ==============================
@app.on_event("startup")
def start_background_tasks():

    create_tables()
    load_prediction_model()

    if ENABLE_SENSOR_COLLECTOR:
        thread = threading.Thread(target=sensor_collector)
        thread.daemon = True
        thread.start()


# ==============================
# MAIN
# ==============================
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))

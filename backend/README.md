# IoT Water Tank Monitoring - Backend API

A FastAPI-based backend service for collecting, storing, and serving IoT sensor data for water tank monitoring systems.

## Features

- **Real-time Sensor Data Collection**: Automatically collects distance and temperature readings from ThingSpeak or generates test data
- **Tank Parameter Management**: CRUD operations for tank sensor configurations
- **RESTful API**: Clean API endpoints for frontend integration
- **PostgreSQL Database**: Persistent storage for sensor readings and tank parameters
- **Background Data Collection**: Daemon thread continuously fetches sensor data
- **CORS Support**: Configured for cross-origin requests from frontend applications

## Tech Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL with psycopg2
- **Server**: Uvicorn ASGI server
- **Data Validation**: Pydantic models

## Prerequisites

- Python 3.8+
- PostgreSQL database server or a managed PostgreSQL instance such as Aiven
- pip package manager

## Installation

1. **Clone the repository** and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. **Create a virtual environment** (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure database environment variables**:
  - Copy `.env.example` to `.env`
  - Fill in your PostgreSQL credentials
  - For Aiven PostgreSQL, keep `DB_SSLMODE=require`

  Example:
  ```bash
  cp .env.example .env
  ```

## Configuration

Create a `.env` file in the `backend/` directory. The application already reads these values automatically:

```env
DB_HOST=your-host.aivencloud.com
DB_PORT=12345
DB_NAME=defaultdb
DB_USER=avnadmin
DB_PASSWORD=your-password
DB_SSLMODE=require
MODEL_VERSION=1.0
MODEL_ACCURACY=0.85
MODEL_CLASSES=no_activity,shower,faucet,toilet,dishwasher
CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
TEST_MODE=true
ENABLE_SENSOR_COLLECTOR=true
SENSOR_POLL_SECONDS=20
```

You can still customize runtime behavior with these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `TEST_MODE` | Use generated test data instead of ThingSpeak | `True` |
| `ENABLE_SENSOR_COLLECTOR` | Start the background data collector on app startup | `True` |
| `SENSOR_POLL_SECONDS` | Poll interval for the collector | `20` |
| `CORS_ALLOW_ORIGINS` | Comma-separated allowed frontend origins | `localhost` dev origins |
| `NODE_ID` | Default sensor node identifier | `"NODE_001"` |
| `url` | ThingSpeak API endpoint | ThingSpeak channel URL |

## Running the Server

Start the FastAPI server:

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`

## Test Database Connection

After creating `.env`, verify the backend can connect to PostgreSQL:

```bash
python3 -c "from main import get_connection; conn = get_connection(); print('Connected!'); conn.close()"
```

If you are using Aiven, this command should succeed without changing application code.

## API Endpoints

### Sensor Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sensor-data` | Get all sensor readings (latest 100) |
| `GET` | `/sensor-data?node_id={id}` | Get sensor readings for specific node |

**Response Example:**
```json
[
  {
    "id": 1,
    "node_id": "NODE_001",
    "distance": 94.5,
    "temperature": 20.8,
    "created_at": "2024-01-15T10:30:00"
  }
]
```

### Tank Parameters

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tank-parameters` | Get all tank configurations |
| `POST` | `/tank-parameters` | Create new tank configuration |
| `GET` | `/api/v1/tank-sensorparameters` | Get all tank configurations |
| `POST` | `/api/v1/tank-sensorparameters` | Create new tank configuration |

**POST Request Body:**
```json
{
  "node_id": "NODE_001",
  "tank_height_cm": 200,
  "tank_length_cm": 100,
  "tank_width_cm": 100,
  "lat": 17.4474,
  "long": 78.3491
}
```

**Response:**
```json
{
  "message": "Tank parameters inserted successfully",
  "id": 1
}
```

### Model Predictions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/predict` | Run a water activity prediction and store it in PostgreSQL |
| `GET` | `/api/v1/model-info` | Get deployed model metadata |
| `GET` | `/api/v1/predictions-history` | Get recent stored predictions |

**Prediction Request Body:**
```json
{
  "node_id": "NODE_001",
  "distance": 52.4,
  "temperature": 24.1,
  "time_features": [10, 30, 2]
}
```

**Prediction Response:**
```json
{
  "id": 1,
  "node_id": "NODE_001",
  "prediction": "dishwasher",
  "confidence": 0.5725,
  "created_at": "2026-03-10T08:51:26.457345",
  "model_source": "ml_model"
}
```

## Database Schema

### sensor_data
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| node_id | VARCHAR(50) | Sensor node identifier |
| field1 | FLOAT | Distance reading (cm) |
| field2 | FLOAT | Temperature reading (°C) |
| created_at | TIMESTAMP | Reading timestamp |

### tank_sensorparameters
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| node_id | VARCHAR(50) | Tank node identifier |
| tank_height_cm | FLOAT | Tank height in cm |
| tank_length_cm | FLOAT | Tank length in cm |
| tank_width_cm | FLOAT | Tank width in cm |
| lat | FLOAT | GPS latitude |
| long | FLOAT | GPS longitude |

### predictions
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| node_id | VARCHAR(50) | Sensor node identifier |
| distance | FLOAT | Distance reading used for inference |
| temperature | FLOAT | Temperature reading used for inference |
| prediction | VARCHAR(50) | Predicted class label |
| confidence | FLOAT | Model confidence for the predicted label |
| created_at | TIMESTAMP | Prediction timestamp |

## API Documentation

FastAPI provides automatic interactive documentation:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Deployment

### Deploy to Render

The repository includes [`render.yaml`](render.yaml) for the backend service.

Recommended Render settings:

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

Add these environment variables in Render:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSLMODE=require`
- `MODEL_VERSION`
- `MODEL_ACCURACY`
- `MODEL_CLASSES`
- `CORS_ALLOW_ORIGINS=https://your-frontend-domain.vercel.app`
- `TEST_MODE=true`
- `ENABLE_SENSOR_COLLECTOR=true`

Useful smoke-test endpoints after deploy:

- `/health`
- `/docs`
- `/api/v1/model-info`

## Project Structure

```
backend/
├── main.py           # Main application file with all endpoints
├── requirements.txt  # Python dependencies
├── README.md         # This file
└── api/              # Additional API modules (if any)
```

## Development

### Test Mode

When `TEST_MODE = True`, the sensor collector generates random data around base values:
- Distance: 94.0 cm ± 10 cm
- Temperature: 20.8°C ± 2°C

Data is collected every 20 seconds.

### Switching to Real Data

1. Set `TEST_MODE = False` in [`main.py`](main.py)
2. Configure your ThingSpeak channel URL
3. Ensure ThingSpeak API key is correct

## Integration with Frontend

This backend is designed to work with the React frontend in the `../frontend` directory. The frontend expects:

- API running on `http://127.0.0.1:8000`
- CORS configured with the deployed frontend origin in `CORS_ALLOW_ORIGINS`
- Endpoints as documented above
- Model artifacts in `backend/saved_models/` or `ml_model/saved_models/`

## License

This project is part of the College Research Affiliate Program.
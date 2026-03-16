# Water Level Monitoring

A full-stack IoT water tank monitoring platform with live telemetry, ML-assisted activity prediction, alerts, and a branded dashboard.

## What This Project Is

This project monitors water tanks using sensor data (distance and temperature), stores readings in PostgreSQL, and exposes analytics/prediction APIs through FastAPI. A React frontend provides dashboards, node management, prediction workflows, model comparison, and realtime updates.

## Core Capabilities

- Live dashboard for water level and temperature
- Node creation and tank parameter management
- Authentication (register, login, protected routes)
- Activity prediction API with prediction history
- Batch CSV prediction upload
- Realtime updates through WebSocket stream
- Anomaly alerts with optional email notifications
- Model comparison page (CNN vs LSTM vs GRU)
- Mobile responsive UI + dark mode

## Tech Stack

- Backend: FastAPI, PostgreSQL (psycopg2), JWT auth
- Frontend: React, React Router, Axios, Recharts
- ML: TensorFlow/Keras experiment pipeline (best model + metadata export)
- Deployment: Render (backend), Vercel/Netlify (frontend)

## Repository Structure

- backend: API service, auth, prediction logic, websocket, alerts, tests
- frontend: Dashboard UI, auth flow, prediction and model comparison pages
- ml_model: Experiment runner, outputs, and trained models
- scripts: Deployment verification helpers

## API Highlights

- POST /api/v1/auth/register
- POST /api/v1/auth/login
- GET /api/v1/auth/me
- POST /api/v1/predict
- POST /api/v1/predict/batch
- GET /api/v1/model-info
- GET /api/v1/predictions-history
- GET /api/v1/alerts
- WS /api/v1/ws/realtime
- GET /health

## Deployment Links

- Backend: https://water-level-monitoring-backend.onrender.com
- Frontend: https://waterlevelmonitoring-six.vercel.app
- Source: https://github.com/Saikumarlingaraju/Water-Level-Monitoring

## Why model_loaded Can Be False

The backend root response includes a model_loaded flag. If it is false, it means the TensorFlow model is not loaded in memory at that moment.

This can happen when:

- TensorFlow is not installed in the running environment
- Model preload is disabled
- Model loading failed and fallback prediction logic is being used

Important: model_loaded false does not mean the API is down. The service can still run and return predictions using fallback logic.

To run with TensorFlow model loading enabled in production:

1. Use a TensorFlow-compatible Python runtime (for example Python 3.11).
2. Install ML dependencies from backend/requirements-ml.txt.
3. Ensure model files exist in backend/saved_models.
4. Optionally enable preload with MODEL_PRELOAD_ON_STARTUP=true.

## Quality Checks

- Backend smoke tests: backend/tests/test_api_smoke.py
- Frontend smoke tests: frontend/src/__tests__

## Notes

This README is intentionally concise and project-oriented for reviewer evaluation.

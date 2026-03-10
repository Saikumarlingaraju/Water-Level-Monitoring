# IoT Water Tank Monitoring System

A full-stack IoT application for monitoring water tank levels and temperature in real-time. The system includes a FastAPI backend, React frontend dashboard, and machine learning models for water disaggregation analysis.

## Project Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    IoT Water Tank Monitoring Architecture                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────────────────┐ │
│   │   IoT        │      │   FastAPI    │      │      PostgreSQL          │ │
│   │   Sensors    │─────▶│   Backend    │◀────▶│      (Aiven Cloud)       │ │
│   │ (ThingSpeak) │      │   (Render)   │      │                          │ │
│   └──────────────┘      └──────────────┘      └──────────────────────────┘ │
│                                │                                            │
│                                │ REST API                                   │
│                                ▼                                            │
│                         ┌──────────────┐                                    │
│                         │    React     │                                    │
│                         │   Frontend   │                                    │
│                         │  Dashboard   │                                    │
│                         └──────────────┘                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

- **Real-time Monitoring**: Live water level and temperature readings
- **Interactive Dashboard**: React-based UI with graphs and analytics
- **Node Management**: Create and configure multiple sensor nodes
- **ML Models**: CNN, LSTM, and GRU models for water disaggregation
- **Cloud Deployment**: Scalable architecture with Aiven PostgreSQL and Render

## Project Structure

```
├── backend/           # FastAPI backend service
├── frontend/          # React dashboard application
└── ml_model/          # Machine learning notebooks and models
```

---

## Deployment Guide

Follow these steps in order to deploy the complete application.

---

## Step 1: Create PostgreSQL Instance on Aiven (Free Tier)

### 1.1 Create Aiven Account

1. Go to [https://aiven.io/](https://aiven.io/)
2. Click **"Start Free"** or **"Sign Up"**
3. Sign up using:
   - Google account
   - GitHub account
   - Email and password
4. Verify your email if required

### 1.2 Create a Free PostgreSQL Service

1. After logging in, you'll be on the Aiven Console dashboard
2. Click **"Create Service"** button
3. Select **"PostgreSQL"** from the service list
4. Configure the service:

   | Setting | Value |
   |---------|-------|
   | **Cloud Provider** | Choose any (AWS, Google Cloud, Azure, DigitalOcean) |
   | **Region** | Select the closest region to your users |
   | **Plan** | Select **"Free"** (Hobbyist plan - $0/month) |
   | **Service Name** | `iot-water-tank-db` (or any name you prefer) |

5. Click **"Create Service"**
6. Wait 2-3 minutes for the service to be provisioned (status will change to "Running")

### 1.3 Get Database Connection Details

1. Once the service is running, click on your PostgreSQL service
2. Go to the **"Overview"** tab
3. Find the **"Connection Information"** section
4. Note down these values:

   ```
   Host:     <your-service-name>-<project-name>.aivencloud.com
   Port:     <port-number> (usually 12345 or similar)
   Database: defaultdb
   User:     avnadmin
   Password: <your-password> (click "Show" to reveal)
   ```

5. You can also copy the **Service URI** which contains all connection details:
   ```
   postgres://avnadmin:<password>@<host>:<port>/defaultdb?sslmode=require
   ```

### 1.4 Download SSL Certificate (Required for Aiven)

1. In your service's **Overview** tab
2. Scroll to **"CA Certificate"** section
3. Click **"Download"** to get the `ca.pem` file
4. Save this file - you'll need it for secure connections

---

## Step 2: Update Backend Database Configuration

### 2.1 Modify Database Connection in Backend

Edit the `backend/main.py` file and update the `get_connection()` function with your Aiven credentials:

```python
def get_connection():
    return psycopg2.connect(
        host="<your-host>.aivencloud.com",      # Aiven host
        port="<port>",                           # Aiven port (e.g., 12345)
        database="defaultdb",                    # Aiven default database
        user="avnadmin",                         # Aiven username
        password="<your-aiven-password>",        # Aiven password
        sslmode="require"                        # Required for Aiven
    )
```

**Example with actual values:**

```python
def get_connection():
    return psycopg2.connect(
        host="XXXXXXXXX.aivencloud.com",
        port="XXXXXXX",
        database="XXXXXXXX",
        user="XXXXXXX",
        password="XXXXXXXXXX",
        sslmode="require"
    )
```

### 2.2 Using Environment Variables (Recommended for Production)

For better security, use environment variables instead of hardcoding credentials:

**Update `main.py`:**

```python
import os

def get_connection():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST"),
        port=os.environ.get("DB_PORT", "5432"),
        database=os.environ.get("DB_NAME", "defaultdb"),
        user=os.environ.get("DB_USER"),
        password=os.environ.get("DB_PASSWORD"),
        sslmode="require"
    )
```

### 2.3 Test the Connection Locally

```bash
cd backend
python -c "from main import get_connection; conn = get_connection(); print('Connection successful!'); conn.close()"
```

---

## Step 3: Deploy Backend on Render

### 3.1 Prepare for Deployment

1. **Create a `render.yaml`** file in the `backend/` directory (optional, for Blueprint):

   ```yaml
   services:
     - type: web
       name: iot-water-tank-api
       env: python
       buildCommand: pip install -r requirements.txt
       startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

2. **Ensure `requirements.txt`** has all dependencies:
   ```
   requests
   psycopg2-binary
   fastapi
   uvicorn
   pydantic
   ```

3. **Push code to GitHub**:
   ```bash
   git add .
   git commit -m "Configure backend for cloud deployment"
   git push origin main
   ```

### 3.2 Create Render Account and Deploy

1. Go to [https://render.com/](https://render.com/)
2. Click **"Get Started for Free"** and sign up (GitHub recommended)
3. Click **"New +"** → **"Web Service"**

### 3.3 Configure Web Service

1. **Connect Repository**:
   - Select **"Build and deploy from a Git repository"**
   - Connect your GitHub account if not already connected
   - Select the repository: `College-Research-Affiliate-Program-26`

2. **Configure Service Settings**:

   | Setting | Value |
   |---------|-------|
   | **Name** | `iot-water-tank-api` |
   | **Region** | Choose closest to your users |
   | **Branch** | `main` |
   | **Root Directory** | `backend` |
   | **Runtime** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
   | **Instance Type** | `Free` |

3. **Add Environment Variables**:
   
   Scroll to **"Environment Variables"** section and add:

   | Key | Value |
   |-----|-------|
   | `DB_HOST` | `<your-aiven-host>.aivencloud.com` |
   | `DB_PORT` | `<your-aiven-port>` |
   | `DB_NAME` | `defaultdb` |
   | `DB_USER` | `avnadmin` |
   | `DB_PASSWORD` | `<your-aiven-password>` |

4. Click **"Create Web Service"**

### 3.4 Wait for Deployment

1. Render will build and deploy your backend (takes 2-5 minutes)
2. Watch the build logs for any errors
3. Once deployed, you'll get a URL like:
   ```
   https://iot-water-tank-api.onrender.com
   ```

### 3.5 Verify Backend Deployment

Test your deployed API:

```bash
# Test root endpoint
curl https://iot-water-tank-api.onrender.com/

# Test sensor data endpoint
curl https://iot-water-tank-api.onrender.com/sensor-data

# Test API docs (Swagger UI)
# Open in browser: https://iot-water-tank-api.onrender.com/docs
```

---

## Step 4: Update Frontend with Deployed Backend URL

### 4.1 Update Config File

Edit `frontend/src/config.js` and replace the localhost URL with your Render URL:

```javascript
// src/config.js
// Central config for API URLs and other constants

const API_BASE_URL = "https://iot-water-tank-api.onrender.com";  // Your Render URL

export default {
  API_BASE_URL,
  SENSOR_DATA_URL: `${API_BASE_URL}/sensor-data`,
  TANK_PARAMETERS_URL: `${API_BASE_URL}/tank-parameters`,
};
```

### 4.2 Using Environment Variables (Recommended)

For flexibility between development and production:

**Create `.env` file in `frontend/`:**

```env
REACT_APP_API_BASE_URL=https://iot-water-tank-api.onrender.com
```

**Update `config.js`:**

```javascript
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

export default {
  API_BASE_URL,
  SENSOR_DATA_URL: `${API_BASE_URL}/sensor-data`,
  TANK_PARAMETERS_URL: `${API_BASE_URL}/tank-parameters`,
};
```

### 4.3 Test Frontend Locally

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) and verify data loads from the deployed backend.

---

## Step 5: Deploy Frontend (Optional)

### Deploy to Vercel, Netlify, or Render Static Site

**Vercel:**
```bash
npm install -g vercel
cd frontend
vercel
```

**Netlify:**
1. Go to [netlify.com](https://netlify.com)
2. Drag and drop the `frontend/build` folder after running `npm run build`

**Render Static Site:**
1. Create new "Static Site" on Render
2. Set root directory to `frontend`
3. Build command: `npm install && npm run build`
4. Publish directory: `build`

---

## Local Development Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Frontend

```bash
cd frontend
npm install
npm start
```

---

## Environment Variables Reference

### Backend (Render)

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | Aiven PostgreSQL host | `xxx.aivencloud.com` |
| `DB_PORT` | Database port | `12345` |
| `DB_NAME` | Database name | `defaultdb` |
| `DB_USER` | Database username | `avnadmin` |
| `DB_PASSWORD` | Database password | `AVNS_xxx...` |

### Frontend

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_API_BASE_URL` | Backend API URL | `https://xxx.onrender.com` |

---

## Troubleshooting

### Backend Issues

1. **Database connection failed**
   - Verify Aiven credentials are correct
   - Ensure `sslmode=require` is set
   - Check if Aiven service is running

2. **Render deployment failed**
   - Check build logs for errors
   - Verify `requirements.txt` is in the `backend/` directory
   - Ensure Python version compatibility

### Frontend Issues

1. **CORS errors**
   - Verify backend has CORS middleware configured
   - Check API URL is correct in config

2. **Data not loading**
   - Open browser DevTools → Network tab
   - Verify API requests are going to correct URL
   - Check for JavaScript console errors

---

## ML Models

The `ml_model/` directory contains Jupyter notebooks for water disaggregation analysis:

- **Model_Learning_Animations.ipynb** - Animated visualizations of model training
- **Model_Learning_Visualizations.ipynb** - Static training visualizations
- **Water_Disaggregation_Final.ipynb** - Main analysis notebook

Saved models available:
- CNN, GRU, LSTM models (trained and visualization versions)

---

## API Documentation

Once the backend is running, access interactive API documentation:

- **Swagger UI**: `http://<backend-url>/docs`
- **ReDoc**: `http://<backend-url>/redoc`

---

## License

This project is part of the College Research Affiliate Program.

---

## Support

For issues or questions, please open a GitHub issue in this repository.

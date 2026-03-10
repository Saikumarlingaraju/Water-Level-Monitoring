# 🎯 Student Assignment: IoT Water Monitoring System Enhancement

## Overview

In this hands-on assignment, you will enhance an IoT Water Tank Monitoring System by working across the **full stack** - from machine learning models to backend APIs to frontend dashboards. By the end, you will have a fully deployed, customized application showcasing your college branding and improved ML predictions.

---

## 📋 Assignment Objectives

| Area | Tasks |
|------|-------|
| **Database** | Set up cloud PostgreSQL on Aiven |
| **Backend** | Modify APIs, integrate ML model for predictions |
| **ML Model** | Hyperparameter tuning, improve accuracy, export model |
| **Frontend** | Add prediction page, custom charts, college branding |
| **Deployment** | Deploy full stack to cloud (Render) |

---

## ⏱️ Estimated Time: 4-6 Hours

---

## 🚀 Task 1: Database Setup (Aiven PostgreSQL)

### 1.1 Create Free PostgreSQL Instance

1. Go to [https://aiven.io/](https://aiven.io/) and create a free account
2. Create a new PostgreSQL service (Free/Hobbyist plan)
3. Note down your connection details:
   - Host
   - Port
   - Database name
   - Username
   - Password

### 1.2 Configure Backend Environment

Create a `.env` file in the `backend/` directory:

```env
DB_HOST=your-host.aivencloud.com
DB_PORT=your-port
DB_NAME=defaultdb
DB_USER=avnadmin
DB_PASSWORD=your-password
DB_SSLMODE=require
```

### 1.3 Test Connection

```bash
cd backend
python3 -c "from main import get_connection; conn = get_connection(); print('Connected!'); conn.close()"
```

### ✅ Deliverable: Screenshot of successful database connection

---

## 🔧 Task 2: Backend API Modifications

### 2.1 Understand Existing APIs

Review the existing API endpoints in `backend/main.py`:
- `GET /sensor-data` - Fetch sensor readings
- `POST /api/v1/tank-sensorparameters` - Create tank configurations

### 2.2 Add New API Endpoints

Create the following new endpoints in `backend/main.py`:

#### a) Add Prediction Endpoint

```python
# TODO: Add this endpoint to main.py
from tensorflow.keras.models import load_model
import numpy as np

# Load ML model at startup
ml_model = load_model("saved_models/LSTM_model.h5")

@app.post("/api/v1/predict")
async def predict_water_activity(data: dict):
    """
    Predict water activity based on sensor data
    Input: {"distance": float, "temperature": float, "time_features": list}
    Output: {"prediction": string, "confidence": float}
    """
    # TODO: Implement prediction logic
    # 1. Preprocess input data
    # 2. Run model prediction
    # 3. Return prediction label and confidence
    pass
```

#### b) Add Model Info Endpoint

```python
@app.get("/api/v1/model-info")
async def get_model_info():
    """
    Return information about the deployed ML model
    """
    return {
        "model_type": "LSTM",
        "version": "1.0",
        "accuracy": 0.85,  # TODO: Update with your model's accuracy
        "last_trained": "2026-03-10",
        "classes": ["no_activity", "shower", "faucet", "toilet", "dishwasher"]
    }
```

#### c) Add Historical Predictions Endpoint

```python
@app.get("/api/v1/predictions-history")
async def get_predictions_history(limit: int = 100):
    """
    Get historical predictions with timestamps
    """
    # TODO: Create predictions table and implement this endpoint
    pass
```

### 2.3 Create Predictions Table

Add to the `create_tables()` function:

```python
# Predictions history table
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
```

### 2.4 Integrate ML Model into Backend

1. Copy your trained model to `backend/saved_models/`
2. Install TensorFlow: Add `tensorflow` to `requirements.txt`
3. Load and use the model for predictions

### ✅ Deliverables:
- [ ] Screenshot of `/api/v1/predict` endpoint working
- [ ] Screenshot of `/api/v1/model-info` endpoint response
- [ ] Code snippet of your prediction implementation

---

## 🤖 Task 3: ML Model Enhancement

### 3.1 Explore Existing Models

Navigate to `ml_model/` and open the Jupyter notebooks:
- `Water_Disaggregation_Final.ipynb` - Main training notebook
- `Model_Learning_Visualizations.ipynb` - Training visualizations

### 3.2 Hyperparameter Tuning

Modify the model architecture and training parameters to improve accuracy:

#### a) LSTM Model Modifications

```python
# Original configuration
model = Sequential([
    LSTM(64, return_sequences=True, input_shape=(timesteps, features)),
    LSTM(32),
    Dense(num_classes, activation='softmax')
])

# TODO: Try these modifications
# 1. Increase LSTM units
# 2. Add more layers
# 3. Add dropout for regularization
# 4. Try different optimizers and learning rates

# Example improved configuration:
model = Sequential([
    LSTM(128, return_sequences=True, input_shape=(timesteps, features)),
    Dropout(0.3),
    LSTM(64, return_sequences=True),
    Dropout(0.2),
    LSTM(32),
    Dense(64, activation='relu'),
    Dense(num_classes, activation='softmax')
])

model.compile(
    optimizer=Adam(learning_rate=0.001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)
```

#### b) CNN Model Modifications

```python
# TODO: Experiment with:
# 1. Different filter sizes (32, 64, 128)
# 2. Kernel sizes (3, 5, 7)
# 3. Add batch normalization
# 4. Try different pooling strategies
```

#### c) GRU Model Modifications

```python
# TODO: GRU often performs similarly to LSTM with less computation
# Try different configurations and compare
```

### 3.3 Training Experiments

Create a training log table:

| Experiment | Model | Layers | Units | Dropout | Learning Rate | Epochs | Accuracy | Notes |
|------------|-------|--------|-------|---------|---------------|--------|----------|-------|
| 1 | LSTM | 2 | 64,32 | 0.0 | 0.001 | 50 | 85% | Baseline |
| 2 | LSTM | 3 | 128,64,32 | 0.3 | 0.001 | 100 | ? | Your experiment |
| 3 | CNN | ? | ? | ? | ? | ? | ? | Your experiment |
| 4 | GRU | ? | ? | ? | ? | ? | ? | Your experiment |

### 3.4 Export Best Model

```python
# Save the best performing model
model.save('saved_models/best_model.h5')

# Also save for TensorFlow Serving (optional)
model.save('saved_models/best_model_serving')
```

### ✅ Deliverables:
- [ ] Completed training log table with at least 4 experiments
- [ ] Screenshot of training accuracy/loss curves
- [ ] Final model accuracy (must be higher than baseline)
- [ ] Saved model file (`best_model.h5`)

---

## 🎨 Task 4: Frontend Enhancements

### 4.1 Add College Branding

#### a) Update Logo

1. Add your college logo to `frontend/public/`
2. Update the Navbar component:

```javascript
// frontend/src/components/Navbar.js
// TODO: Replace the existing logo with your college logo

import collegeLogo from '../assets/college-logo.png';

// In the component:
<img src={collegeLogo} alt="College Logo" className="logo" />
```

#### b) Update Colors and Theme

Modify `frontend/src/App.css`:

```css
/* TODO: Update with your college colors */
:root {
  --primary-color: #YOUR_PRIMARY_COLOR;
  --secondary-color: #YOUR_SECONDARY_COLOR;
  --accent-color: #YOUR_ACCENT_COLOR;
}

.navbar {
  background-color: var(--primary-color);
}

.sidebar {
  background-color: var(--secondary-color);
}
```

### 4.2 Create Prediction Page

Create a new file `frontend/src/pages/Prediction.js`:

```javascript
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import config from '../config';

const Prediction = () => {
  const [modelInfo, setModelInfo] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [inputData, setInputData] = useState({
    distance: '',
    temperature: ''
  });

  // TODO: Implement the following:
  // 1. Fetch model info on component mount
  // 2. Create form to input sensor data
  // 3. Call prediction API on form submit
  // 4. Display prediction results with confidence chart

  useEffect(() => {
    // Fetch model info
    axios.get(`${config.API_BASE_URL}/api/v1/model-info`)
      .then(response => setModelInfo(response.data))
      .catch(error => console.error('Error fetching model info:', error));
  }, []);

  const handlePredict = async () => {
    // TODO: Implement prediction API call
  };

  return (
    <div className="prediction-page">
      <h1>Water Activity Prediction</h1>
      
      {/* Model Info Card */}
      <div className="model-info-card">
        <h2>Model Information</h2>
        {modelInfo && (
          <>
            <p>Model Type: {modelInfo.model_type}</p>
            <p>Accuracy: {modelInfo.accuracy * 100}%</p>
            <p>Version: {modelInfo.version}</p>
          </>
        )}
      </div>

      {/* Input Form */}
      <div className="prediction-form">
        <h2>Enter Sensor Data</h2>
        {/* TODO: Add input fields for distance and temperature */}
        {/* TODO: Add predict button */}
      </div>

      {/* Prediction Results */}
      <div className="prediction-results">
        <h2>Prediction Results</h2>
        {/* TODO: Display prediction label */}
        {/* TODO: Add confidence chart */}
      </div>
    </div>
  );
};

export default Prediction;
```

### 4.3 Add Route for Prediction Page

Update `frontend/src/App.js`:

```javascript
import Prediction from './pages/Prediction';

// Add route
<Route path="/prediction" element={<Prediction />} />
```

Update `frontend/src/components/Sidebar.js`:

```javascript
// Add navigation link
<NavLink to="/prediction">
  <span className="icon">🤖</span>
  Prediction
</NavLink>
```

### 4.4 Modify Existing Charts

Enhance the Home page charts in `frontend/src/pages/Home.js`:

```javascript
// TODO: Add the following chart enhancements:

// 1. Add a prediction distribution chart
const PredictionDistributionChart = () => {
  // Show distribution of predicted activities over time
};

// 2. Add a real-time prediction indicator
const RealTimePrediction = () => {
  // Show current activity prediction based on latest sensor data
};

// 3. Customize chart colors to match college theme
const CHART_COLORS = [
  'var(--primary-color)',
  'var(--secondary-color)',
  'var(--accent-color)',
  '#8884d8',
  '#82ca9d'
];

// 4. Add chart animations
<LineChart>
  <Line 
    type="monotone" 
    dataKey="value" 
    animationDuration={500}
    animationBegin={0}
  />
</LineChart>
```

### 4.5 Add Custom Charts

Add at least TWO new chart types:

```javascript
// Example: Activity Timeline Chart
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const ActivityTimeline = ({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="time" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="duration" fill="var(--primary-color)" />
    </BarChart>
  </ResponsiveContainer>
);

// Example: Confidence Gauge
const ConfidenceGauge = ({ confidence }) => (
  // TODO: Implement a radial gauge showing prediction confidence
);
```

### ✅ Deliverables:
- [ ] Screenshot of dashboard with college logo and colors
- [ ] Screenshot of Prediction page with working predictions
- [ ] Screenshot of new custom charts
- [ ] Code snippets of key modifications

---

## ☁️ Task 5: Cloud Deployment

### 5.1 Prepare for Deployment

#### a) Update Backend for Production

Ensure `backend/requirements.txt` includes all dependencies:

```
fastapi
uvicorn
psycopg2-binary
pydantic
python-dotenv
requests
tensorflow
numpy
```

#### b) Update Frontend for Production

Update `frontend/src/config.js`:

```javascript
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";
```

### 5.2 Deploy Backend to Render

1. Push code to GitHub
2. Go to [render.com](https://render.com) and create account
3. Create new **Web Service**
4. Configure:

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

5. Add Environment Variables (same as your `.env` file)
6. Deploy and note the URL (e.g., `https://your-app.onrender.com`)

### 5.3 Deploy Frontend

Create `frontend/.env.production`:

```env
REACT_APP_API_BASE_URL=https://your-backend-url.onrender.com
```

Deploy to Vercel/Netlify:

```bash
cd frontend
npm run build
# Deploy build/ folder
```

### 5.4 Test Deployed Application

1. Open your deployed frontend URL
2. Verify all pages load correctly
3. Test prediction functionality
4. Verify data is being fetched from cloud database

### ✅ Deliverables:
- [ ] Deployed backend URL
- [ ] Deployed frontend URL
- [ ] Screenshot of working deployed application
- [ ] Screenshot of prediction working on deployed app

---

## 📝 Final Submission Checklist

### Required Deliverables

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Database connection screenshot | ⬜ |
| 2 | Working prediction API screenshot | ⬜ |
| 3 | ML training log with 4+ experiments | ⬜ |
| 4 | Training curves screenshot | ⬜ |
| 5 | Improved model accuracy (higher than baseline) | ⬜ |
| 6 | Dashboard with college branding screenshot | ⬜ |
| 7 | Prediction page screenshot | ⬜ |
| 8 | Custom charts screenshot (2 new charts) | ⬜ |
| 9 | Deployed backend URL | ⬜ |
| 10 | Deployed frontend URL | ⬜ |
| 11 | Working deployed app screenshot | ⬜ |
| 12 | Updated GitHub repository link | ⬜ |

### Submission Format

Create a document containing:
1. All screenshots listed above
2. Your deployed URLs
3. Brief explanation of:
   - ML improvements made and accuracy achieved
   - API endpoints added
   - Frontend features added
4. Challenges faced and how you solved them

---

## 🏆 Bonus Tasks (Optional)

| Bonus Task | Points |
|------------|--------|
| Add user authentication | +10 |
| Implement real-time predictions using WebSockets | +15 |
| Add model comparison page (compare CNN vs LSTM vs GRU) | +10 |
| Create mobile-responsive design | +5 |
| Add dark mode toggle | +5 |
| Implement batch prediction upload (CSV) | +10 |
| Add email alerts for anomaly detection | +15 |

---

## 📚 Resources

### Documentation
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Recharts Documentation](https://recharts.org/)
- [TensorFlow/Keras Documentation](https://www.tensorflow.org/api_docs)
- [Aiven Documentation](https://docs.aiven.io/)
- [Render Documentation](https://render.com/docs)

### Tutorials
- [FastAPI + ML Model Deployment](https://fastapi.tiangolo.com/deployment/)
- [React Charts with Recharts](https://recharts.org/en-US/guide)
- [LSTM for Time Series](https://www.tensorflow.org/tutorials/structured_data/time_series)

---

## ❓ FAQ

**Q: My model accuracy is not improving. What should I do?**
A: Try:
- More training epochs
- Different learning rates (0.001, 0.0001, 0.01)
- Add more layers or units
- Use data augmentation
- Try different model architectures

**Q: Backend deployment fails on Render. What's wrong?**
A: Check:
- All dependencies in requirements.txt
- Environment variables are set correctly
- TensorFlow version compatibility (try `tensorflow-cpu` for smaller memory)

**Q: Frontend can't connect to backend after deployment.**
A: Verify:
- Backend CORS allows your frontend domain
- API URL is correct in config.js
- No mixed content (HTTPS frontend calling HTTP backend)

---

## 📞 Support

For questions or issues:
1. Check the FAQ section above
2. Review the main README.md for setup instructions
3. Contact TA's in the group

---

**Good luck! 🚀**

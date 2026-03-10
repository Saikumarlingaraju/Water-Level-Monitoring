const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';

const config = {
  API_BASE_URL,
  BRAND_NAME: 'HITAM Water Intelligence Hub',
  BRAND_SHORT_NAME: 'HITAM',
  BRAND_TAGLINE: 'Find Your Path Through Smarter Water Monitoring',
  SENSOR_DATA_URL: `${API_BASE_URL}/sensor-data`,
  TANK_PARAMETERS_URL: `${API_BASE_URL}/tank-parameters`,
  PREDICT_URL: `${API_BASE_URL}/api/v1/predict`,
  MODEL_INFO_URL: `${API_BASE_URL}/api/v1/model-info`,
  PREDICTIONS_HISTORY_URL: `${API_BASE_URL}/api/v1/predictions-history`,
};

export default config;

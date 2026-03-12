const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';
const REALTIME_BASE_URL = API_BASE_URL.replace(/^http/i, 'ws');

const config = {
  API_BASE_URL,
  COLLEGE_NAME: 'Hyderabad Institute of Technology and Management',
  BRAND_NAME: 'HITAM Water Intelligence Hub',
  BRAND_SHORT_NAME: 'HITAM',
  BRAND_TAGLINE: 'Find Your Path Through Smarter Water Monitoring',
  SENSOR_DATA_URL: `${API_BASE_URL}/sensor-data`,
  TANK_PARAMETERS_URL: `${API_BASE_URL}/tank-parameters`,
  PREDICT_URL: `${API_BASE_URL}/api/v1/predict`,
  MODEL_INFO_URL: `${API_BASE_URL}/api/v1/model-info`,
  PREDICTIONS_HISTORY_URL: `${API_BASE_URL}/api/v1/predictions-history`,
  AUTH_LOGIN_URL: `${API_BASE_URL}/api/v1/auth/login`,
  AUTH_REGISTER_URL: `${API_BASE_URL}/api/v1/auth/register`,
  AUTH_ME_URL: `${API_BASE_URL}/api/v1/auth/me`,
  REALTIME_WS_URL: `${REALTIME_BASE_URL}/api/v1/ws/realtime`,
};

export default config;

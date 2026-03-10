import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import config from '../config';

const CONFIDENCE_COLORS = ['#0f6d63', '#f08b46'];

const parseTimeFeatures = (value) => {
  if (!value.trim()) {
    return [];
  }

  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => !Number.isNaN(item));
};

const Prediction = () => {
  const [modelInfo, setModelInfo] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [inputData, setInputData] = useState({
    node_id: 'NODE_001',
    distance: '52.4',
    temperature: '24.1',
    timeFeatures: '10,30,2',
  });

  const fetchModelInfo = async () => {
    const response = await axios.get(config.MODEL_INFO_URL);
    setModelInfo(response.data);
  };

  const fetchPredictionHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${config.PREDICTIONS_HISTORY_URL}?limit=12`);
      setPredictionHistory(response.data || []);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchModelInfo().catch((requestError) => {
      setError(`Unable to load model details: ${requestError.message}`);
    });

    fetchPredictionHistory().catch((requestError) => {
      setError(`Unable to load prediction history: ${requestError.message}`);
    });
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setInputData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleUseLatestPrediction = () => {
    if (!predictionHistory.length) {
      return;
    }

    const latest = predictionHistory[0];
    setInputData((current) => ({
      ...current,
      node_id: latest.node_id,
      distance: String(latest.distance),
      temperature: String(latest.temperature),
    }));
  };

  const handlePredict = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        node_id: inputData.node_id || 'NODE_001',
        distance: Number(inputData.distance),
        temperature: Number(inputData.temperature),
        time_features: parseTimeFeatures(inputData.timeFeatures),
      };

      const response = await axios.post(config.PREDICT_URL, payload, {
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
      });

      setPrediction(response.data);
      await fetchPredictionHistory();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const confidenceGaugeData = useMemo(() => {
    const confidence = prediction ? Number((prediction.confidence * 100).toFixed(1)) : 0;
    return [
      { name: 'Confidence', value: confidence },
      { name: 'Remaining', value: Math.max(0, 100 - confidence) },
    ];
  }, [prediction]);

  const historyChartData = useMemo(() => {
    return [...predictionHistory].reverse().map((item) => ({
      time: new Date(item.created_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      confidence: Number((item.confidence * 100).toFixed(1)),
      prediction: item.prediction,
    }));
  }, [predictionHistory]);

  return (
    <div className="prediction-page">
      <div className="page-header prediction-header">
        <div>
          <h2 className="page-title">Prediction Lab</h2>
          <p className="page-description">Run water activity inference, inspect the deployed model, and review recent predictions.</p>
        </div>
        <button className="secondary-btn" type="button" onClick={handleUseLatestPrediction}>
          Use Latest History Row
        </button>
      </div>

      {error && <div className="message error">{error}</div>}

      <div className="prediction-layout">
        <div className="prediction-column prediction-column-main">
          <div className="panel-card model-info-card">
            <div className="panel-heading">
              <h3>Model Information</h3>
              {modelInfo?.loaded && <span className="metric-chip">Loaded</span>}
            </div>
            {modelInfo ? (
              <>
                <div className="model-stat-grid">
                  <div className="model-stat">
                    <span className="model-stat-label">Model Type</span>
                    <strong>{modelInfo.model_type}</strong>
                  </div>
                  <div className="model-stat">
                    <span className="model-stat-label">Version</span>
                    <strong>{modelInfo.version}</strong>
                  </div>
                  <div className="model-stat">
                    <span className="model-stat-label">Accuracy</span>
                    <strong>{(modelInfo.accuracy * 100).toFixed(2)}%</strong>
                  </div>
                  <div className="model-stat">
                    <span className="model-stat-label">Macro F1</span>
                    <strong>{modelInfo.macro_f1 ? modelInfo.macro_f1.toFixed(4) : 'N/A'}</strong>
                  </div>
                </div>
                <div className="class-chip-row">
                  {(modelInfo.classes || []).map((label) => (
                    <span className="class-chip" key={label}>{label.replace('_', ' ')}</span>
                  ))}
                </div>
              </>
            ) : (
              <div className="graph-loading">Loading model details...</div>
            )}
          </div>

          <div className="panel-card prediction-form-card">
            <div className="panel-heading">
              <h3>Predict Water Activity</h3>
              <span className="graph-subtitle">Enter current sensor values and optional time features</span>
            </div>
            <form className="prediction-form-grid" onSubmit={handlePredict}>
              <div className="form-group">
                <label htmlFor="prediction-node">Node ID</label>
                <input id="prediction-node" name="node_id" value={inputData.node_id} onChange={handleChange} placeholder="NODE_001" />
              </div>
              <div className="form-group">
                <label htmlFor="prediction-distance">Distance</label>
                <input id="prediction-distance" name="distance" type="number" step="0.1" value={inputData.distance} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="prediction-temperature">Temperature</label>
                <input id="prediction-temperature" name="temperature" type="number" step="0.1" value={inputData.temperature} onChange={handleChange} />
              </div>
              <div className="form-group prediction-form-span">
                <label htmlFor="prediction-time-features">Time Features</label>
                <input
                  id="prediction-time-features"
                  name="timeFeatures"
                  value={inputData.timeFeatures}
                  onChange={handleChange}
                  placeholder="hour,minute,weekday"
                />
              </div>
              <div className="form-actions prediction-form-span">
                <button className="submit-btn" type="submit" disabled={loading}>
                  {loading ? 'Running prediction...' : 'Run Prediction'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="prediction-column prediction-column-side">
          <div className="panel-card prediction-results-card">
            <div className="panel-heading">
              <h3>Prediction Result</h3>
              {prediction && <span className="metric-chip">{prediction.model_source}</span>}
            </div>
            {prediction ? (
              <>
                <div className="prediction-highlight">
                  <span className="prediction-kicker">Detected activity</span>
                  <strong>{prediction.prediction.replace('_', ' ')}</strong>
                </div>
                <div className="confidence-gauge-wrap">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={confidenceGaugeData} dataKey="value" innerRadius={70} outerRadius={95} startAngle={90} endAngle={-270}>
                        {confidenceGaugeData.map((entry, index) => (
                          <Cell key={entry.name} fill={CONFIDENCE_COLORS[index % CONFIDENCE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}%`, 'Confidence']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="confidence-value-overlay">{(prediction.confidence * 100).toFixed(1)}%</div>
                </div>
                <div className="prediction-detail-list">
                  <span>Node: {prediction.node_id}</span>
                  <span>Recorded: {new Date(prediction.created_at).toLocaleString()}</span>
                </div>
              </>
            ) : (
              <div className="graph-loading">Submit the form to see the confidence gauge and result details.</div>
            )}
          </div>

          <div className="panel-card history-chart-card">
            <div className="panel-heading">
              <h3>Recent Confidence Snapshots</h3>
            </div>
            {historyLoading ? (
              <div className="graph-loading">Loading recent predictions...</div>
            ) : historyChartData.length === 0 ? (
              <div className="graph-loading">No predictions in history yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={historyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value, name, context) => [`${value}%`, context.payload.prediction.replace('_', ' ')]} />
                  <Legend />
                  <Bar dataKey="confidence" radius={[10, 10, 0, 0]}>
                    {historyChartData.map((entry, index) => (
                      <Cell key={`${entry.time}-${index}`} fill={index % 2 === 0 ? '#0f6d63' : '#f08b46'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="panel-card prediction-history-card">
        <div className="panel-heading">
          <h3>Prediction History</h3>
          <span className="graph-subtitle">Latest stored predictions from PostgreSQL</span>
        </div>
        {historyLoading ? (
          <div className="graph-loading">Loading prediction history...</div>
        ) : predictionHistory.length === 0 ? (
          <div className="graph-loading">No prediction records available.</div>
        ) : (
          <div className="history-table-wrap">
            <table className="nodes-table prediction-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Node</th>
                  <th>Prediction</th>
                  <th>Confidence</th>
                  <th>Distance</th>
                  <th>Temperature</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {predictionHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.node_id}</td>
                    <td className="node-id">{item.prediction}</td>
                    <td>{(item.confidence * 100).toFixed(1)}%</td>
                    <td>{item.distance}</td>
                    <td>{item.temperature}</td>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Prediction;
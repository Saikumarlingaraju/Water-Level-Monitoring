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
import { getStoredAuthToken } from '../auth';

const CONFIDENCE_COLORS = ['#0f6d63', '#f08b46'];
const SAMPLE_BATCH_CSV = [
  'node_id,distance,temperature,time_features',
  'NODE_001,52.4,24.1,"10,30,2"',
  'NODE_002,81.9,22.7,"14,15,4"',
].join('\n');

const parseTimeFeatures = (value) => {
  if (!value.trim()) {
    return [];
  }

  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => !Number.isNaN(item));
};

const matchesPrediction = (left, right) => (
  left?.node_id === right?.node_id
  && left?.prediction === right?.prediction
  && Number(left?.confidence) === Number(right?.confidence)
  && left?.created_at === right?.created_at
);

const mergePredictionItems = (currentItems, incomingItem, limit) => {
  const nextItems = [incomingItem, ...(currentItems || []).filter((item) => !matchesPrediction(item, incomingItem))];
  return nextItems.slice(0, limit);
};

const Prediction = () => {
  const [modelInfo, setModelInfo] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [batchFile, setBatchFile] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [batchError, setBatchError] = useState('');
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

  useEffect(() => {
    const authToken = getStoredAuthToken();

    if (!authToken) {
      setRealtimeStatus('offline');
      return undefined;
    }

    let socket;
    let reconnectTimer;
    let disposed = false;

    const connect = () => {
      setRealtimeStatus('connecting');
      socket = new WebSocket(`${config.REALTIME_WS_URL}?token=${encodeURIComponent(authToken)}`);

      socket.onopen = () => {
        if (!disposed) {
          setRealtimeStatus('live');
        }
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (!['sensor_prediction', 'manual_prediction'].includes(payload.type)) {
            return;
          }

          const nextPrediction = {
            id: `realtime-${payload.node_id}-${payload.created_at}`,
            node_id: payload.node_id,
            prediction: payload.prediction,
            confidence: payload.confidence,
            distance: payload.distance,
            temperature: payload.temperature,
            created_at: payload.created_at,
            model_source: payload.model_source,
          };

          setPrediction(nextPrediction);
          setPredictionHistory((current) => mergePredictionItems(current, nextPrediction, 12));
          setHistoryLoading(false);
        } catch (messageError) {
          console.error('Error processing realtime prediction:', messageError);
        }
      };

      socket.onerror = () => {
        if (!disposed) {
          setRealtimeStatus('offline');
        }
      };

      socket.onclose = () => {
        if (disposed) {
          return;
        }

        setRealtimeStatus('offline');
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close();
      }
    };
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

  const handleBatchFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setBatchFile(selectedFile);
    setBatchError('');
  };

  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_BATCH_CSV], { type: 'text/csv;charset=utf-8;' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'prediction-batch-template.csv';
    link.click();
    URL.revokeObjectURL(href);
  };

  const handleBatchUpload = async () => {
    if (!batchFile) {
      setBatchError('Choose a CSV file first.');
      return;
    }

    setBatchLoading(true);
    setBatchError('');

    try {
      const formData = new FormData();
      formData.append('file', batchFile);

      const response = await axios.post(config.BATCH_PREDICT_URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setBatchResult(response.data);
      await fetchPredictionHistory();
    } catch (requestError) {
      setBatchError(requestError.response?.data?.detail || requestError.message);
    } finally {
      setBatchLoading(false);
    }
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
        <div className="prediction-header-actions">
          <span className={`realtime-badge ${realtimeStatus}`}>{realtimeStatus === 'live' ? 'Live stream connected' : realtimeStatus === 'connecting' ? 'Connecting stream...' : 'Realtime offline'}</span>
          <button className="secondary-btn" type="button" onClick={handleUseLatestPrediction}>
            Use Latest History Row
          </button>
        </div>
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

          <div className="panel-card batch-upload-card">
            <div className="panel-heading">
              <div>
                <h3>Batch Prediction Upload</h3>
                <span className="graph-subtitle">Upload a CSV with `distance` and `temperature`; `node_id` and `time_features` are optional.</span>
              </div>
              <button className="secondary-btn" type="button" onClick={handleDownloadSampleCsv}>
                Download CSV Template
              </button>
            </div>

            <div className="batch-upload-grid">
              <div className="form-group prediction-form-span">
                <label htmlFor="prediction-batch-file">CSV File</label>
                <input id="prediction-batch-file" type="file" accept=".csv" onChange={handleBatchFileChange} />
              </div>
              <div className="batch-upload-actions">
                <span className="graph-subtitle">Expected columns: `distance`, `temperature`, optional `node_id`, `time_features`.</span>
                <button className="submit-btn batch-submit-btn" type="button" onClick={handleBatchUpload} disabled={batchLoading}>
                  {batchLoading ? 'Uploading CSV...' : 'Run Batch Predictions'}
                </button>
              </div>
            </div>

            {batchError && <div className="message error">{batchError}</div>}

            {batchResult && (
              <div className="batch-results-wrap">
                <div className="batch-summary-grid">
                  <div className="model-stat">
                    <span className="model-stat-label">Rows in CSV</span>
                    <strong>{batchResult.total_rows}</strong>
                  </div>
                  <div className="model-stat">
                    <span className="model-stat-label">Processed</span>
                    <strong>{batchResult.processed_rows}</strong>
                  </div>
                  <div className="model-stat">
                    <span className="model-stat-label">Failed</span>
                    <strong>{batchResult.failed_rows}</strong>
                  </div>
                </div>

                {batchResult.predictions?.length > 0 && (
                  <div className="history-table-wrap">
                    <table className="nodes-table prediction-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Node</th>
                          <th>Prediction</th>
                          <th>Confidence</th>
                          <th>Distance</th>
                          <th>Temperature</th>
                          <th>Time Features</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchResult.predictions.map((item) => (
                          <tr key={`${item.row_number}-${item.created_at}`}>
                            <td>{item.row_number}</td>
                            <td>{item.node_id}</td>
                            <td className="node-id">{item.prediction}</td>
                            <td>{(item.confidence * 100).toFixed(1)}%</td>
                            <td>{item.distance}</td>
                            <td>{item.temperature}</td>
                            <td>{item.time_features?.join(', ') || 'None'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {batchResult.errors?.length > 0 && (
                  <div className="batch-errors-wrap">
                    <div className="panel-heading">
                      <h3>Rows With Errors</h3>
                    </div>
                    <div className="history-table-wrap">
                      <table className="nodes-table prediction-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchResult.errors.map((item) => (
                            <tr key={`error-${item.row_number}`}>
                              <td>{item.row_number}</td>
                              <td>{item.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
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
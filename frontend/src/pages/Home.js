import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import axios from 'axios';

import config from '../config';

const CHART_COLORS = ['#0f6d63', '#f08b46', '#f6c453', '#1d8f7b', '#2d4356'];

const formatChartTime = (value) => new Date(value).toLocaleTimeString('en-US', {
  hour: '2-digit',
  minute: '2-digit',
});

const filterByTimeRange = (items, selectedTimeRange, customFromDate, customToDate, key = 'created_at') => {
  if (!Array.isArray(items) || selectedTimeRange === 'all') {
    return items || [];
  }

  const now = new Date();
  let fromDate = null;
  let toDate = now;

  if (selectedTimeRange === 'custom') {
    if (!customFromDate || !customToDate) {
      return items || [];
    }

    fromDate = new Date(customFromDate);
    toDate = new Date(customToDate);
  }

  if (selectedTimeRange === '1h') {
    fromDate = new Date(now.getTime() - (1 * 60 * 60 * 1000));
  }

  if (selectedTimeRange === '6h') {
    fromDate = new Date(now.getTime() - (6 * 60 * 60 * 1000));
  }

  if (selectedTimeRange === '24h') {
    fromDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  }

  if (selectedTimeRange === '7d') {
    fromDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  }

  return (items || []).filter((item) => {
    const itemDate = new Date(item[key]);
    return itemDate >= fromDate && itemDate <= toDate;
  });
};

const Home = () => {
  const [waterLevel, setWaterLevel] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [waterLevelData, setWaterLevelData] = useState([]);
  const [temperatureData, setTemperatureData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState('');
  const [hasDataForNode, setHasDataForNode] = useState(true);
  const [nodeDataMessage, setNodeDataMessage] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);

  // Mapping between node IDs and tank IDs for sensor data
  const getActualTankId = (nodeId) => {
    const mapping = {
      'Node 1': 'NODE_001',
      'Node 2': 'NODE_002', 
      'NODE_001': 'NODE_001' // Direct mapping
    };
    return mapping[nodeId] || nodeId;
  };

  // Fetch real sensor data from API
  const fetchSensorData = useCallback(async () => {
    try {
      setLoading(true);
      const actualNodeId = getActualTankId(selectedNode);
      const [sensorResponse, predictionsResponse, modelInfoResponse] = await Promise.all([
        axios.get(config.SENSOR_DATA_URL, {
          headers: { accept: 'application/json' },
        }),
        axios.get(`${config.PREDICTIONS_HISTORY_URL}?limit=150`, {
          headers: { accept: 'application/json' },
        }),
        axios.get(config.MODEL_INFO_URL, {
          headers: { accept: 'application/json' },
        }),
      ]);

      const allSensorData = filterByTimeRange(
        sensorResponse.data || [],
        selectedTimeRange,
        customFromDate,
        customToDate,
        'created_at'
      );

      const historyItems = filterByTimeRange(
        predictionsResponse.data || [],
        selectedTimeRange,
        customFromDate,
        customToDate,
        'created_at'
      );

      const sensorData = allSensorData.filter((item) => item.node_id === actualNodeId);
      const scopedHistory = historyItems.filter((item) => item.node_id === actualNodeId);
      setPredictionHistory(scopedHistory);
      setModelInfo(modelInfoResponse.data);

      // Check if data exists for the selected node
      if (sensorData.length > 0) {
        setHasDataForNode(true);
        setNodeDataMessage('');
        // Get the latest reading for current values
        const latest = sensorData[0];

        // Get tank height for the selected node (default to 200cm if not found)
        const selectedNodeData = nodes.find(n => n.id === selectedNode);
        const tankHeight = selectedNodeData?.tank_height || 200;

        // Convert water level cm to percentage using actual tank height
        const waterLevelPercentage = Math.min(
          100,
          Math.round(((tankHeight - latest.distance) / tankHeight) * 100)
        );

        setWaterLevel(waterLevelPercentage);
        setTemperature(Math.round(latest.temperature * 10) / 10);
        setLastUpdated(new Date(latest.created_at));

        // Process data for charts (reverse to show chronological order)
        const reversedData = [...sensorData].reverse();

        const waterData = reversedData.map(item => {
          const time = new Date(item.created_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });
          // const percentage = Math.min(100, Math.round((item.water_level_cm / tankHeight) * 100 * 10) / 10);
          const percentage = Math.min(
            100,
            Math.round(((tankHeight - item.distance) / tankHeight) * 100)
          );
          return {
            time: time,
            value: percentage,
            raw_cm: item.distance
          };
        });

        const tempData = reversedData.map(item => {
          const time = new Date(item.created_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });

          return {
            time: time,
            value: Math.round(item.temperature * 10) / 10
          };
        });

        setWaterLevelData(waterData);
        setTemperatureData(tempData);
      } else {
        // No data found for selected node
        setHasDataForNode(false);
        if (selectedNode) {
          const actualTankId = getActualTankId(selectedNode);
          setNodeDataMessage(`No sensor data found for ${selectedNode} (checking tank_id: ${actualTankId})`);
        } else {
          setNodeDataMessage('No sensor data available');
        }
        // Reset values when no data
        setWaterLevel(0);
        setTemperature(0);
        setWaterLevelData([]);
        setTemperatureData([]);
        setLastUpdated(null);
        setPredictionHistory(scopedHistory);
      }
    } catch (error) {
      console.error('Error fetching sensor data:', error);
      setHasDataForNode(false);
      setNodeDataMessage('Error fetching sensor data. Please try again.');
      // Keep existing data or show error state
    } finally {
      setLoading(false);
    }
  }, [customFromDate, customToDate, nodes, selectedNode, selectedTimeRange]);

  // Fetch available nodes from tank_sensorparameters table
  const fetchNodes = useCallback(async () => {
    try {
      const response = await axios.get(
        config.TANK_PARAMETERS_URL,
        {
          headers: {
            'accept': 'application/json'
          }
        }
      );

      const nodesData = response.data || [];
      // Transform the data to match our node structure
      const transformedNodes = nodesData.map(node => ({
        id: node.node_id,
        name: node.node_id,
        tank_height: node.tank_height_cm,
        tank_length: node.tank_length_cm,
        tank_width: node.tank_width_cm,
        latitude: node.lat,
        longitude: node.long
      }));

      setNodes(transformedNodes);

      // Set first node as default if no node is selected
      if (transformedNodes.length > 0 && !selectedNode) {
        setSelectedNode(transformedNodes[0].id);
      }
    } catch (error) {
      console.error('Error fetching nodes:', error);
      // If API fails, create some sample nodes based on your data
      const sampleNodes = [
        { id: '', name: 'Tank 001' }
      ];
      setNodes(sampleNodes);
      if (!selectedNode) {
        setSelectedNode(sampleNodes[0].id);
      }
    }
  }, [selectedNode]);

  // Handle node selection change
  const handleNodeChange = (event) => {
    const nodeId = event.target.value;
    setSelectedNode(nodeId);
    setNodeDataMessage(''); // Clear previous messages

    // Reset data state while loading
    if (nodeId) {
      setLoading(true);
      const actualTankId = getActualTankId(nodeId);
      setNodeDataMessage(`Checking data for ${nodeId} (tank_id: ${actualTankId})...`);
    }
  };

  // Handle time range selection change
  const handleTimeRangeChange = (event) => {
    const timeRange = event.target.value;
    setSelectedTimeRange(timeRange);

    // Clear custom dates if not selecting custom
    if (timeRange !== 'custom') {
      setCustomFromDate('');
      setCustomToDate('');
    }
  };

  // Handle custom date changes
  const handleCustomFromDateChange = (event) => {
    setCustomFromDate(event.target.value);
  };

  const handleCustomToDateChange = (event) => {
    setCustomToDate(event.target.value);
  };

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  useEffect(() => {
    if (selectedNode) {
      fetchSensorData();

      const interval = setInterval(() => {
        fetchSensorData();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [selectedNode, selectedTimeRange, customFromDate, customToDate, fetchSensorData]);

  const latestPrediction = predictionHistory[0] || null;

  const predictionDistribution = useMemo(() => {
    const counts = predictionHistory.reduce((accumulator, item) => {
      accumulator[item.prediction] = (accumulator[item.prediction] || 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(counts).map(([name, value], index) => ({
      name,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [predictionHistory]);

  const confidenceTrend = useMemo(() => {
    return [...predictionHistory].slice(0, 8).reverse().map((item) => ({
      time: formatChartTime(item.created_at),
      confidence: Number((item.confidence * 100).toFixed(1)),
      prediction: item.prediction,
    }));
  }, [predictionHistory]);

  const activityTimeline = useMemo(() => {
    return [...predictionHistory].slice(0, 8).reverse().map((item) => ({
      time: formatChartTime(item.created_at),
      duration: Number((item.confidence * 10).toFixed(1)),
      prediction: item.prediction,
    }));
  }, [predictionHistory]);

  const predictionStatus = latestPrediction ? latestPrediction.prediction.replace('_', ' ') : 'Awaiting predictions';

  return (
    <div className="home-page">
      <div className="page-header">
        <div className="header-left">
          <h2 className="page-title">Dashboard Overview</h2>
          <div className="node-selector">
            <label htmlFor="node-select" className="node-label">Tank:</label>
            <select
              id="node-select"
              value={selectedNode}
              onChange={handleNodeChange}
              className="node-dropdown"
            >
              <option value="">Select Tank/Node</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.id}
                  {node.tank_height > 0 && ` (${node.tank_height}cm tank)`}
                </option>
              ))}
            </select>
          </div>

          <div className="time-range-selector">
            <label htmlFor="time-range-select" className="time-range-label">Time Range:</label>
            <select
              id="time-range-select"
              value={selectedTimeRange}
              onChange={handleTimeRangeChange}
              className="time-range-dropdown"
            >
              <option value="all">All Time</option>
              <option value="1h">Last 1 Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {selectedTimeRange === 'custom' && (
            <div className="custom-date-range">
              <div className="date-input-group">
                <label htmlFor="from-date" className="date-label">From:</label>
                <input
                  id="from-date"
                  type="datetime-local"
                  value={customFromDate}
                  onChange={handleCustomFromDateChange}
                  className="date-input"
                />
              </div>
              <div className="date-input-group">
                <label htmlFor="to-date" className="date-label">To:</label>
                <input
                  id="to-date"
                  type="datetime-local"
                  value={customToDate}
                  onChange={handleCustomToDateChange}
                  className="date-input"
                />
              </div>
            </div>
          )}
        </div>
        {lastUpdated && (
          <div className="last-updated">
            Last updated: {lastUpdated.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
            {loading && <span className="update-indicator"> • Updating...</span>}
          </div>
        )}
      </div>

      {/* Data Status Message */}
      {nodeDataMessage && (
        <div className={`data-status-message ${hasDataForNode ? 'success' : 'warning'}`}>
          <div className="status-icon">
            {hasDataForNode ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20,6 9,17 4,12"></polyline>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            )}
          </div>
          <span>{nodeDataMessage}</span>
        </div>
      )}

      {selectedNode && hasDataForNode && (
        <div className="selected-node-info">
          <strong>Showing data for node:</strong> {selectedNode}
          {getActualTankId(selectedNode) !== selectedNode && (
            <span className="tank-mapping"> → tank_id: {getActualTankId(selectedNode)}</span>
          )}
          <span className="time-range-info">
            {' '}• Time Range: {
              selectedTimeRange === '1h' ? 'Last 1 Hour' :
                selectedTimeRange === '6h' ? 'Last 6 Hours' :
                  selectedTimeRange === '24h' ? 'Last 24 Hours' :
                    selectedTimeRange === '7d' ? 'Last 7 Days' :
                      selectedTimeRange === 'all' ? 'All Time' :
                        selectedTimeRange === 'custom' ? 'Custom Range' : 'Last 24 Hours'
            }
          </span>
          {nodes.find(n => n.id === selectedNode)?.tank_height && (
            <span className="tank-specs">
              {' '}• Tank: {nodes.find(n => n.id === selectedNode)?.tank_height}cm (H) × {nodes.find(n => n.id === selectedNode)?.tank_length}cm (L) × {nodes.find(n => n.id === selectedNode)?.tank_width}cm (W)
            </span>
          )}
        </div>
      )}

      {/* Cards Section */}
      <div className="cards-container">
        <div className="card water-level-card">
          <div className="card-header">
            <div className="card-icon water-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
              </svg>
            </div>
            <h3>Water Level</h3>
          </div>
          <div className="card-value">
            <span className="value">
              {loading ? '--' : (!hasDataForNode ? 'N/A' : waterLevel)}
            </span>
            <span className="unit">%</span>
          </div>
          <div className="card-status">
            <span className={`status ${!hasDataForNode ? 'no-data' : waterLevel > 50 ? 'good' : 'warning'}`}>
              {!hasDataForNode ? 'No Data' :
                waterLevel > 80 ? 'High' : waterLevel > 50 ? 'Normal' : waterLevel > 20 ? 'Low' : 'Critical'}
            </span>
          </div>
        </div>

        <div className="card temperature-card">
          <div className="card-header">
            <div className="card-icon temp-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 4v10.54a4 4 0 11-4 0V4a2 2 0 114 0z" />
              </svg>
            </div>
            <h3>Temperature</h3>
          </div>
          <div className="card-value">
            <span className="value">
              {loading ? '--' : (!hasDataForNode ? 'N/A' : temperature)}
            </span>
            <span className="unit">°C</span>
          </div>
          <div className="card-status">
            <span className={`status ${!hasDataForNode ? 'no-data' : temperature < 30 ? 'good' : 'warning'}`}>
              {!hasDataForNode ? 'No Data' :
                temperature < 25 ? 'Normal' : temperature < 30 ? 'Warm' : 'Hot'}
            </span>
          </div>
        </div>

        <div className="card prediction-card">
          <div className="card-header">
            <div className="card-icon prediction-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19h16" />
                <path d="M7 15l3-3 3 2 4-6" />
              </svg>
            </div>
            <h3>Real-Time Prediction</h3>
          </div>
          <div className="card-value prediction-value-block">
            <span className="prediction-label-large">{latestPrediction ? predictionStatus : 'No prediction yet'}</span>
          </div>
          <div className="prediction-meta-row">
            <span className="status good">{latestPrediction ? `${(latestPrediction.confidence * 100).toFixed(1)}% confidence` : 'Use Prediction Lab'}</span>
            {modelInfo && <span className="metric-chip">Model accuracy {(modelInfo.accuracy * 100).toFixed(1)}%</span>}
          </div>
        </div>
      </div>

      {/* Graphs Section */}
      <div className="graphs-container">
        <div className="graph-card">
          <h3>Water Level </h3>
          {loading && waterLevelData.length === 0 ? (
            <div className="graph-loading">Loading sensor data...</div>
          ) : !hasDataForNode ? (
            <div className="no-data-graph">
              <div className="no-data-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <p>No data available for the selected node</p>
              <small>Please select a node with available sensor data</small>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={waterLevelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  labelFormatter={(value) => `Time: ${value}`}
                  formatter={(value, name, props) => [
                    `${value}% (${props.payload.raw_cm}cm)`,
                    'Water Level'
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2196F3"
                  strokeWidth="3"
                  dot={{ fill: '#2196F3', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="graph-card">
          <h3>Temperature </h3>
          {loading && temperatureData.length === 0 ? (
            <div className="graph-loading">Loading sensor data...</div>
          ) : !hasDataForNode ? (
            <div className="no-data-graph">
              <div className="no-data-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <p>No data available for the selected node</p>
              <small>Please select a node with available sensor data</small>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={temperatureData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip
                  labelFormatter={(value) => `Time: ${value}`}
                  formatter={(value) => [`${value}°C`, 'Temperature']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#FF9800"
                  strokeWidth="3"
                  dot={{ fill: '#FF9800', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="graph-card accent-surface">
          <div className="graph-card-header">
            <h3>Prediction Distribution</h3>
            <span className="graph-subtitle">Recent activity labels for the selected tank</span>
          </div>
          {predictionDistribution.length === 0 ? (
            <div className="graph-loading">No predictions recorded yet. Open Prediction Lab and run a prediction.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={predictionDistribution} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={4}>
                  {predictionDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name.replace('_', ' ')]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="graph-card">
          <div className="graph-card-header">
            <h3>Activity Timeline</h3>
            <span className="graph-subtitle">Confidence-weighted prediction snapshots</span>
          </div>
          {activityTimeline.length === 0 ? (
            <div className="graph-loading">No recent prediction events available.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activityTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip formatter={(value, name, context) => [`${value}`, context.payload.prediction.replace('_', ' ')]} />
                <Bar dataKey="duration" radius={[10, 10, 0, 0]}>
                  {activityTimeline.map((entry, index) => (
                    <Cell key={`${entry.time}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="graph-card">
          <div className="graph-card-header">
            <h3>Confidence Trend</h3>
            <span className="graph-subtitle">How sure the model has been across recent predictions</span>
          </div>
          {confidenceTrend.length === 0 ? (
            <div className="graph-loading">Confidence data will appear after predictions are stored.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={confidenceTrend}>
                <defs>
                  <linearGradient id="confidenceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f08b46" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f08b46" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, 'Confidence']} />
                <Area type="monotone" dataKey="confidence" stroke="#f08b46" fill="url(#confidenceFill)" strokeWidth={3} animationDuration={650} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;

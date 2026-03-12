import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const MODEL_RESULTS = [
  {
    experiment: 2,
    modelFamily: 'LSTM',
    modelName: 'LSTM Tuned',
    accuracy: 93.87,
    macroF1: 0.8386,
    layers: 3,
    units: '128,64,32',
    dropout: 0.3,
    learningRate: 0.001,
    epochs: 18,
    notes: 'Higher-capacity LSTM with class weights and scaled windows',
    color: '#1e5128',
  },
  {
    experiment: 4,
    modelFamily: 'GRU',
    modelName: 'GRU Tuned',
    accuracy: 88.71,
    macroF1: 0.7990,
    layers: 2,
    units: '128,64',
    dropout: 0.3,
    learningRate: 0.001,
    epochs: 18,
    notes: 'GRU with class weights and wider recurrent layers',
    color: '#569d40',
  },
  {
    experiment: 3,
    modelFamily: 'CNN',
    modelName: 'CNN Tuned',
    accuracy: 83.67,
    macroF1: 0.7251,
    layers: 3,
    units: '64,128,128',
    dropout: 0.3,
    learningRate: 0.0008,
    epochs: 11,
    notes: 'Deeper 1D CNN with batch normalization and global pooling',
    color: '#f08b46',
  },
];

const LSTM_BASELINE = {
  accuracy: 86.36,
  macroF1: 0.7492,
};

const ModelComparison = () => {
  const rankedModels = useMemo(() => {
    return [...MODEL_RESULTS].sort((left, right) => right.accuracy - left.accuracy);
  }, []);

  const bestModel = rankedModels[0];

  const accuracyChartData = useMemo(() => {
    return rankedModels.map((model) => ({
      name: model.modelFamily,
      accuracy: model.accuracy,
      fill: model.color,
    }));
  }, [rankedModels]);

  const macroF1ChartData = useMemo(() => {
    return rankedModels.map((model) => ({
      name: model.modelFamily,
      macroF1: Number((model.macroF1 * 100).toFixed(2)),
      fill: model.color,
    }));
  }, [rankedModels]);

  const improvementVsBaseline = useMemo(() => {
    return Number((bestModel.accuracy - LSTM_BASELINE.accuracy).toFixed(2));
  }, [bestModel]);

  return (
    <div className="comparison-page">
      <div className="page-header comparison-header">
        <div>
          <h2 className="page-title">Model Comparison Lab</h2>
          <p className="page-description">
            Compare the best CNN, LSTM, and GRU experiments used for the deployed water activity model.
          </p>
        </div>
        <div className="comparison-badge-row">
          <span className="metric-chip">3 model families</span>
          <span className="metric-chip">Best accuracy {bestModel.accuracy.toFixed(2)}%</span>
        </div>
      </div>

      <div className="comparison-hero-grid">
        <div className="panel-card comparison-winner-card">
          <span className="comparison-kicker">Deployed winner</span>
          <h3>{bestModel.modelName}</h3>
          <p className="comparison-copy">
            This model is currently deployed because it produced the highest validation accuracy and macro-F1 across the tuned runs.
          </p>
          <div className="model-stat-grid">
            <div className="model-stat">
              <span className="model-stat-label">Accuracy</span>
              <strong>{bestModel.accuracy.toFixed(2)}%</strong>
            </div>
            <div className="model-stat">
              <span className="model-stat-label">Macro F1</span>
              <strong>{bestModel.macroF1.toFixed(4)}</strong>
            </div>
            <div className="model-stat">
              <span className="model-stat-label">Layers</span>
              <strong>{bestModel.layers}</strong>
            </div>
            <div className="model-stat">
              <span className="model-stat-label">Epochs</span>
              <strong>{bestModel.epochs}</strong>
            </div>
          </div>
        </div>

        <div className="panel-card comparison-summary-card">
          <div className="comparison-summary-row">
            <span className="comparison-summary-label">Improvement over baseline LSTM</span>
            <strong>+{improvementVsBaseline}%</strong>
          </div>
          <div className="comparison-summary-row">
            <span className="comparison-summary-label">Fastest tuned competitor</span>
            <strong>GRU</strong>
          </div>
          <div className="comparison-summary-row">
            <span className="comparison-summary-label">Most expressive architecture</span>
            <strong>CNN / LSTM at 3 layers</strong>
          </div>
          <div className="comparison-summary-row">
            <span className="comparison-summary-label">Common regularization</span>
            <strong>0.3 dropout</strong>
          </div>
          <p className="comparison-copy comparison-copy-compact">
            The comparison uses the final experiment log: LSTM stayed strongest overall, GRU offered a good trade-off, and CNN underperformed on this sequence-learning task.
          </p>
        </div>
      </div>

      <div className="comparison-chart-grid">
        <div className="panel-card">
          <div className="panel-heading">
            <h3>Accuracy Comparison</h3>
            <span className="graph-subtitle">Higher is better</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={accuracyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[75, 100]} />
              <Tooltip formatter={(value) => [`${value}%`, 'Accuracy']} />
              <Legend />
              <Bar dataKey="accuracy" name="Accuracy" radius={[12, 12, 0, 0]}>
                {accuracyChartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel-card">
          <div className="panel-heading">
            <h3>Macro-F1 Comparison</h3>
            <span className="graph-subtitle">Class-balanced quality score</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={macroF1ChartData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[65, 90]} />
              <YAxis type="category" dataKey="name" width={60} />
              <Tooltip formatter={(value) => [`${value}%`, 'Macro F1']} />
              <Bar dataKey="macroF1" name="Macro F1" radius={[0, 12, 12, 0]}>
                {macroF1ChartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel-card comparison-table-card">
        <div className="panel-heading">
          <h3>Experiment Breakdown</h3>
          <span className="graph-subtitle">Best run from each architecture family</span>
        </div>
        <div className="history-table-wrap">
          <table className="nodes-table comparison-table">
            <thead>
              <tr>
                <th>Experiment</th>
                <th>Model</th>
                <th>Layers</th>
                <th>Units</th>
                <th>Dropout</th>
                <th>Learning Rate</th>
                <th>Epochs</th>
                <th>Accuracy</th>
                <th>Macro F1</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rankedModels.map((model) => (
                <tr key={model.modelName}>
                  <td>{model.experiment}</td>
                  <td className="node-id">{model.modelName}</td>
                  <td>{model.layers}</td>
                  <td>{model.units}</td>
                  <td>{model.dropout}</td>
                  <td>{model.learningRate}</td>
                  <td>{model.epochs}</td>
                  <td>{model.accuracy.toFixed(2)}%</td>
                  <td>{model.macroF1.toFixed(4)}</td>
                  <td>{model.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ModelComparison;
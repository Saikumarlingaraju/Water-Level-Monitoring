import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config';

const NodeCreation = () => {
  const [formData, setFormData] = useState({
    node_id: '',
    tank_height_cm: 0,
    tank_length_cm: 0,
    tank_width_cm: 0,
    lat: 0,
    long: 0
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });
  const [existingNodes, setExistingNodes] = useState([]);
  const [fetchingData, setFetchingData] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    size: 10
  });

  // Fetch existing nodes data
  const fetchExistingNodes = async (page = 1, size = 10) => {
    try {
      setFetchingData(true);
      const response = await axios.get(
        `${config.TANK_PARAMETERS_URL}?page=${page}&size=${size}&sort_by=id&sort_order=asc`,
        {
          headers: {
            'accept': 'application/json'
          }
        }
      );
      const nodes = Array.isArray(response.data) ? response.data : (response.data.items || []);
      setExistingNodes(nodes);
      setPagination({
        total: Array.isArray(response.data) ? nodes.length : (response.data.total || 0),
        page: Array.isArray(response.data) ? page : (response.data.page || 1),
        size: Array.isArray(response.data) ? size : (response.data.size || 10)
      });
    } catch (error) {
      console.error('Error fetching existing nodes:', error);
      setExistingNodes([]);
    } finally {
      setFetchingData(false);
    }
  };

  useEffect(() => {
    fetchExistingNodes();
  }, []);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', content: '' });

    try {
      const response = await axios.post(
        config.TANK_PARAMETERS_URL,
        formData,
        {
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      setMessage({
        type: 'success',
        content: 'Node created successfully!',
        details: response.data
      });

      // Reset form
      setFormData({
        node_id: '',
        tank_height_cm: 0,
        tank_length_cm: 0,
        tank_width_cm: 0,
        lat: 0,
        long: 0
      });

      // Refresh the existing nodes data
      fetchExistingNodes();

    } catch (error) {
      setMessage({
        type: 'error',
        content: `Error: ${error.response?.data?.detail || error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="node-creation-page">
      <h2 className="page-title">Node Creation & Management</h2>
      
      <div className="main-container">
        <div className="form-container">
          <form onSubmit={handleSubmit} className="node-form">
            <div className="form-group">
              <label htmlFor="node_id">Node ID *</label>
              <input
                type="text"
                id="node_id"
                name="node_id"
                value={formData.node_id}
                onChange={handleChange}
                required
                placeholder="Enter unique node identifier (e.g., Node 1)"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="tank_height_cm">Tank Height (cm) *</label>
                <input
                  type="number"
                  id="tank_height_cm"
                  name="tank_height_cm"
                  value={formData.tank_height_cm}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.1"
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="tank_length_cm">Tank Length (cm) *</label>
                <input
                  type="number"
                  id="tank_length_cm"
                  name="tank_length_cm"
                  value={formData.tank_length_cm}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.1"
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="tank_width_cm">Tank Width (cm) *</label>
                <input
                  type="number"
                  id="tank_width_cm"
                  name="tank_width_cm"
                  value={formData.tank_width_cm}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.1"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="lat">Latitude *</label>
                <input
                  type="number"
                  id="lat"
                  name="lat"
                  value={formData.lat}
                  onChange={handleChange}
                  required
                  min="-90"
                  max="90"
                  step="0.000001"
                  placeholder="0.000000"
                />
                <span className="input-hint">Range: -90 to 90</span>
              </div>

              <div className="form-group">
                <label htmlFor="long">Longitude *</label>
                <input
                  type="number"
                  id="long"
                  name="long"
                  value={formData.long}
                  onChange={handleChange}
                  required
                  min="-180"
                  max="180"
                  step="0.000001"
                  placeholder="0.000000"
                />
                <span className="input-hint">Range: -180 to 180</span>
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading}
              >
                {loading ? 'Creating Node...' : 'Create Node'}
              </button>
            </div>

            {message.content && (
              <div className={`message ${message.type}`}>
                {message.content}
              </div>
            )}
          </form>

          <div className="form-info">
            <h3>Tank Volume Calculator</h3>
            <div className="volume-display">
              <span>Estimated Volume: </span>
              <strong>
                {((formData.tank_height_cm * formData.tank_length_cm * formData.tank_width_cm) / 1000).toFixed(2)} L
              </strong>
            </div>
          </div>
        </div>

        {/* Existing Nodes Display */}
        <div className="existing-nodes-section">
          <h2 className="section-title">Existing Tank Sensor Nodes</h2>
          
          {fetchingData ? (
            <div className="loading-text">Loading existing nodes...</div>
          ) : existingNodes.length > 0 ? (
            <>
              <div className="nodes-stats">
                <span className="total-nodes">Total Nodes: {pagination.total}</span>
                <span className="page-info">
                  Page {pagination.page} (Showing {existingNodes.length} of {pagination.total})
                </span>
              </div>
              
              <div className="nodes-table-container">
                <table className="nodes-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Node ID</th>
                      <th>Height (cm)</th>
                      <th>Length (cm)</th>
                      <th>Width (cm)</th>
                      <th>Volume (L)</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingNodes.map((node) => (
                      <tr key={node.id}>
                        <td>{node.id}</td>
                        <td className="node-id">{node.node_id}</td>
                        <td>{node.tank_height_cm}</td>
                        <td>{node.tank_length_cm}</td>
                        <td>{node.tank_width_cm}</td>
                        <td className="volume">
                          {((node.tank_height_cm * node.tank_length_cm * node.tank_width_cm) / 1000).toFixed(2)}
                        </td>
                        <td className="coordinate">{node.lat}</td>
                        <td className="coordinate">{node.long}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination-info">
                <button 
                  onClick={() => fetchExistingNodes(pagination.page - 1)} 
                  disabled={pagination.page <= 1}
                  className="pagination-btn"
                >
                  Previous
                </button>
                <span className="page-numbers">
                  Page {pagination.page}
                </span>
                <button 
                  onClick={() => fetchExistingNodes(pagination.page + 1)} 
                  disabled={pagination.page * pagination.size >= pagination.total}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className="no-data">
              <p>No nodes found. Create your first tank sensor node using the form above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NodeCreation;

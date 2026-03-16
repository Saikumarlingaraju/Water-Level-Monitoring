import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth';
import config from '../config';

const getAuthErrorMessage = (requestError) => {
  if (requestError.code === 'ECONNABORTED') {
    return 'Server is taking too long to respond (possibly waking up). Please retry in a few seconds.';
  }

  if (requestError.response?.data?.detail) {
    return requestError.response.data.detail;
  }

  if (requestError.request) {
    return `Cannot reach the backend at ${config.API_BASE_URL} right now. It may be temporarily unavailable or waking up.`;
  }

  return 'Unable to sign in';
};

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(formData);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="auth-kicker">Secure Access</span>
        <h1>Sign in to HITAM Water Intelligence Hub</h1>
        <p className="auth-copy">Authenticate to view sensor dashboards, run predictions, and manage tank nodes.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-username">Username</label>
          <input id="login-username" name="username" value={formData.username} onChange={handleChange} required />

          <label htmlFor="login-password">Password</label>
          <input id="login-password" name="password" type="password" value={formData.password} onChange={handleChange} required />

          {error && <div className="message error">{error}</div>}

          <button className="submit-btn auth-submit-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer-text">
          Need an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
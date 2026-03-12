import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth';
import config from '../config';

const getRegisterErrorMessage = (requestError) => {
  if (requestError.response?.data?.detail) {
    return requestError.response.data.detail;
  }

  if (requestError.request) {
    return `Cannot reach the backend at ${config.API_BASE_URL}. Start the API server or set REACT_APP_API_BASE_URL.`;
  }

  return 'Unable to create account';
};

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ full_name: '', username: '', password: '' });
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
      await register(formData);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(getRegisterErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="auth-kicker">Create Account</span>
        <h1>Register your user account</h1>
        <p className="auth-copy">Create a secure account to access the IoT dashboard and protected prediction tools.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="register-full-name">Full Name</label>
          <input id="register-full-name" name="full_name" value={formData.full_name} onChange={handleChange} required />

          <label htmlFor="register-username">Username</label>
          <input id="register-username" name="username" value={formData.username} onChange={handleChange} required />

          <label htmlFor="register-password">Password</label>
          <input id="register-password" name="password" type="password" minLength="8" value={formData.password} onChange={handleChange} required />

          {error && <div className="message error">{error}</div>}

          <button className="submit-btn auth-submit-btn" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer-text">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
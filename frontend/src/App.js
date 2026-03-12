import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, ProtectedRoute, PublicOnlyRoute } from './auth';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Login from './pages/Login';
import ModelComparison from './pages/ModelComparison';
import NodeCreation from './pages/NodeCreation';
import Prediction from './pages/Prediction';
import Register from './pages/Register';
import './App.css';

const THEME_STORAGE_KEY = 'wlm-theme';

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function ProtectedLayout({ sidebarOpen, toggleSidebar, closeSidebar, theme, toggleTheme }) {
  return (
    <div className="App">
      <Navbar onToggleSidebar={toggleSidebar} theme={theme} onToggleTheme={toggleTheme} />
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/node-creation" element={<NodeCreation />} />
          <Route path="/prediction" element={<Prediction />} />
          <Route path="/model-comparison" element={<ModelComparison />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route
            path="/*"
            element={(
              <ProtectedRoute>
                <ProtectedLayout
                  sidebarOpen={sidebarOpen}
                  toggleSidebar={toggleSidebar}
                  theme={theme}
                  toggleTheme={toggleTheme}
                  closeSidebar={() => setSidebarOpen(false)}
                />
              </ProtectedRoute>
            )}
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
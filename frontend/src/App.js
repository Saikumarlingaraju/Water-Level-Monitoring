import React, { useState } from 'react';
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

function ProtectedLayout({ sidebarOpen, toggleSidebar, closeSidebar }) {
  return (
    <div className="App">
      <Navbar onToggleSidebar={toggleSidebar} />
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

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
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
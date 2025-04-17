import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import AdminDashboard from './pages/AdminDashboard';
import CompleteDashboard from './pages/ED';
import { authService } from './services/authService';

const PrivateRoute = ({ children }) => {
  return authService.isAuthenticated() ? children : <Navigate to="/" />;
};

const AdminRoute = ({ children }) => {
  return authService.isAdmin() ? children : <Navigate to="/dashboard" />;
};

const UserRoute = ({ children }) => {
  const user = authService.getCurrentUser();
  return user && !user.role.includes('admin') ? children : <Navigate to="/admin" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route
          path="/admin/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <UserRoute>
                <CompleteDashboard />
              </UserRoute>
            </PrivateRoute>
          }
        />
        <Route
          path="/emergency"
          element={
            <PrivateRoute>
              <CompleteDashboard />
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import AdminDashboard from './pages/AdminDashboard';
import ED from './pages/ED';
import LAB from './pages/LAB';
import BB from './pages/BB'; // استيراد صفحة بنك الدم
import OR from './pages/OR'; // استيراد صفحة قسم العمليات
import RAD from './pages/RAD'; // استيراد صفحة قسم الأشعة
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarProvider } from './context/SidebarContext';

// مكون لحماية المسارات الخاصة
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-lg text-gray-600 mr-4">جاري التحميل...</p>
      </div>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/" />;
};

// مكون لحماية مسارات المسؤول
const AdminRoute = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-lg text-gray-600 mr-4">جاري التحميل...</p>
      </div>
    );
  }
  
  return isAdmin ? children : <Navigate to="/dashboard" />;
};

// مكون لحماية مسارات المستخدم العادي
const UserRoute = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-lg text-gray-600 mr-4">جاري التحميل...</p>
      </div>
    );
  }
  
  return user && !isAdmin ? children : <Navigate to="/admin" />;
};

function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
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
                    <ED />
                  </UserRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/emergency"
              element={
                <PrivateRoute>
                  <ED />
                </PrivateRoute>
              }
            />
            <Route
              path="/lab"
              element={
                <PrivateRoute>
                  <LAB />
                </PrivateRoute>
              }
            />
            <Route
              path="/bloodbank"
              element={
                <PrivateRoute>
                  <BB />
                </PrivateRoute>
              }
            />
            <Route
              path="/operations"
              element={
                <PrivateRoute>
                  <OR />
                </PrivateRoute>
              }
            />
            <Route
              path="/rad"
              element={
                <PrivateRoute>
                  <RAD />
                </PrivateRoute>
              }
            />
          </Routes>
        </Router>
      </SidebarProvider>
    </AuthProvider>
  );
}

export default App;

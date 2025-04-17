import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/authService';

// إنشاء سياق المصادقة
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // التحقق من حالة المصادقة عند تحميل التطبيق
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  // تسجيل الدخول
  const login = async (employeeId, password) => {
    try {
      setLoading(true);
      setError(null);
      const loggedInUser = authService.login(employeeId, password);
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // تسجيل الخروج
  const logout = () => {
    authService.logout();
    setUser(null);
  };

  // توفير القيم والوظائف لجميع المكونات الفرعية
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook لتسهيل استخدام السياق
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth يجب استخدامه داخل AuthProvider');
  }
  return context;
};
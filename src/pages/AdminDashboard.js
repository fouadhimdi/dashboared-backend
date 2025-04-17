import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    employeeId: '',
    name: '',
    password: '',
    role: 'user'
  });

  useEffect(() => {
    // التحقق من صلاحيات المستخدم
    if (!authService.isAdmin()) {
      navigate('/');
    }
    loadUsers();
    setLoading(false);
  }, [navigate]);

  const loadUsers = () => {
    // تحميل المستخدمين من localStorage
    const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');
    setUsers(storedUsers);
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

  const handleMenuClick = (itemId) => {
    if (itemId === 'emergency') {
      navigate('/emergency');
    } else {
      setCurrentPage(itemId);
    }
  };

  const handleAddUser = () => {
    // التحقق من صحة البيانات
    if (!newUser.employeeId || !newUser.name || !newUser.password) {
      alert('جميع الحقول مطلوبة');
      return;
    }

    // التحقق من عدم تكرار الرقم الوظيفي
    if (users.some(user => user.employeeId === newUser.employeeId)) {
      alert('الرقم الوظيفي موجود مسبقاً');
      return;
    }

    // إضافة المستخدم الجديد
    const updatedUsers = [...users, { ...newUser, id: Date.now() }];
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
    setShowAddUserModal(false);
    setNewUser({
      employeeId: '',
      name: '',
      password: '',
      role: 'user'
    });
  };

  const handleDeleteUser = (userId) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      const updatedUsers = users.filter(user => user.id !== userId);
      localStorage.setItem('users', JSON.stringify(updatedUsers));
      setUsers(updatedUsers);
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
    { id: 'users', label: 'إدارة المستخدمين', icon: '👥' },
    { id: 'emergency', label: 'قسم الطوارئ', icon: '🏥' },
  ];

  const renderContent = () => {
    switch (currentPage) {
      case 'users':
        return (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">إدارة المستخدمين</h2>
            <div className="space-y-4">
              <button 
                onClick={() => setShowAddUserModal(true)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                إضافة مستخدم جديد
              </button>
              <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الرقم الوظيفي
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الاسم
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الدور
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.employeeId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.role === 'admin' ? 'مدير' : 'مستخدم'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">لوحة التحكم</h2>
            <p>مرحباً بك في لوحة تحكم المشرف</p>
          </div>
        );
    }
  };

  if (loading) {
    return <div>جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex h-screen">
        {/* الشريط الجانبي */}
        <div className="w-64 bg-white shadow-lg">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800">لوحة التحكم</h1>
            <p className="text-sm text-gray-500 mt-1">مرحباً بك، المشرف</p>
          </div>
          <nav className="mt-6">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                className={`w-full flex items-center p-4 text-right transition-colors ${
                  currentPage === item.id 
                    ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl ml-2">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="absolute bottom-0 w-full p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-end p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <span className="ml-2">تسجيل الخروج</span>
              <span>🚪</span>
            </button>
          </div>
        </div>

        {/* المحتوى الرئيسي */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            <div className="bg-white rounded-xl shadow-sm p-6">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* نافذة إضافة مستخدم جديد */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">إضافة مستخدم جديد</h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الرقم الوظيفي
                </label>
                <input
                  type="text"
                  value={newUser.employeeId}
                  onChange={(e) => setNewUser({ ...newUser, employeeId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أدخل الرقم الوظيفي"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الاسم
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أدخل الاسم"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أدخل كلمة المرور"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الدور
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">مستخدم</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleAddUser}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  إضافة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 
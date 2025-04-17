import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ menuItems }) => {
  const { isAdmin } = useAuth();
  const location = useLocation();
  
  // إذا لم يتم تمرير عناصر القائمة، استخدم القائمة الافتراضية
  const defaultMenuItems = [
    { id: 'admin', label: 'لوحة التحكم', icon: '👨‍💼', path: '/admin' },
    { id: 'emergency', label: 'قسم الطوارئ', icon: '🏥', path: '/emergency', showForRegularUser: true },
    { id: 'operations', label: 'قسم العمليات', icon: '🔪', path: '/operations', showForRegularUser: true },
    { id: 'lab', label: 'قسم المختبر', icon: '🧪', path: '/lab', showForRegularUser: true },
    { id: 'bloodbank', label: 'بنك الدم', icon: '🩸', path: '/bloodbank', showForRegularUser: true },
    { id: 'rad', label: 'قسم الأشعة', icon: '📡', path: '/rad', showForRegularUser: true },
  ];

  const items = menuItems || defaultMenuItems;
  
  // تصفية العناصر بناءً على صلاحيات المستخدم
  const filteredItems = isAdmin 
    ? items 
    : items.filter(item => item.showForRegularUser);

  return (
    <div className="w-72 fixed top-0 right-0 bottom-0 bg-indigo-900 text-white py-6 shadow-lg overflow-y-auto z-50" dir="rtl">
      <div className="px-6 mb-8">
        <h1 className="text-2xl font-bold text-center">لوحة التحكم</h1>
        <div className="text-xs text-blue-300 text-center mt-2">مرحباً بك، 123</div>
        <div className="mt-2 bg-blue-600 text-center py-1 px-3 text-xs rounded-full">
          مشرف
        </div>
      </div>
      
      <div className="space-y-1">
        {filteredItems.map((item) => (
          <Link
            key={item.id}
            to={item.path}
            className={`flex items-center px-6 py-4 text-lg transition-colors duration-200 ${
              location.pathname === item.path
                ? 'bg-blue-800 text-white'
                : 'text-blue-100 hover:bg-blue-800/50'
            }`}
          >
            <span className="mr-4">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
      
      <div className="absolute bottom-0 right-0 left-0 px-6 py-4 bg-indigo-950">
        <button
          onClick={() => window.location.href = '/'}
          className="flex items-center text-blue-300 hover:text-white transition-colors duration-200"
        >
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          تسجيل خروج
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
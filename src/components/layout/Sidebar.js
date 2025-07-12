import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ menuItems }) => {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
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
    <>
      {/* زر القائمة للجوال */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-50 lg:hidden bg-indigo-600 text-white p-2 rounded-lg shadow-lg"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* الخلفية المظلمة للجوال */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* الشريط الجانبي */}
      <div className={`
        fixed top-0 right-0 bottom-0 z-50 bg-indigo-900 text-white py-6 shadow-lg overflow-y-auto
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:translate-x-0 lg:w-72
        w-80 sm:w-72
      `} dir="rtl">
        {/* رأس الشريط الجانبي */}
        <div className="px-4 sm:px-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-center">لوحة التحكم</h1>
              <div className="text-xs text-blue-300 text-center mt-2">مرحباً بك، 123</div>
              <div className="mt-2 bg-blue-600 text-center py-1 px-3 text-xs rounded-full">
                مشرف
              </div>
            </div>
            
            {/* زر الإغلاق للجوال */}
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden ml-2 text-blue-300 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* عناصر القائمة */}
        <div className="space-y-1 px-2 sm:px-0">
          {filteredItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setIsOpen(false)} // إغلاق القائمة عند النقر على رابط
              className={`flex items-center px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg transition-colors duration-200 rounded-lg mx-2 sm:mx-0 ${
                location.pathname === item.path
                  ? 'bg-blue-800 text-white shadow-md'
                  : 'text-blue-100 hover:bg-blue-800/50 hover:text-white'
              }`}
            >
              <span className="mr-3 sm:mr-4 text-lg sm:text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      
        {/* زر تسجيل الخروج */}
        <div className="absolute bottom-0 right-0 left-0 px-4 sm:px-6 py-4 bg-indigo-950">
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center w-full text-blue-300 hover:text-white transition-colors duration-200 p-2 rounded-lg hover:bg-indigo-800/50"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            تسجيل خروج
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
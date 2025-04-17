import React, { createContext, useContext } from 'react';

// إنشاء سياق للقائمة الجانبية
const SidebarContext = createContext();

// مزود السياق للقائمة الجانبية
export const SidebarProvider = ({ children }) => {
  // تعريف عناصر القائمة هنا بشكل مركزي لجميع الصفحات
  const menuItems = [
    { id: 'bloodbank', label: 'بنك الدم', icon: '🩸', path: '/bloodbank', showForRegularUser: true },
    { id: 'emergency', label: 'قسم الطوارئ', icon: '🏥', path: '/emergency', showForRegularUser: true },
    { id: 'lab', label: 'قسم المختبر', icon: '🧪', path: '/lab', showForRegularUser: true },
    { id: 'rad', label: 'قسم الأشعة', icon: '📡', path: '/rad', showForRegularUser: true },
    { id: 'operations', label: 'قسم العمليات', icon: '🔪', path: '/operations', showForRegularUser: true },
    { id: 'admin', label: 'لوحة المشرف', icon: '👨‍💼', path: '/admin' },
  ];

  return (
    <SidebarContext.Provider value={{ menuItems }}>
      {children}
    </SidebarContext.Provider>
  );
};

// هوك مخصص لاستخدام سياق القائمة الجانبية
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar يجب استخدامه داخل SidebarProvider');
  }
  return context;
};
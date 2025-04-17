import usersData from '../data/users.json';

class AuthService {
  constructor() {
    // التحقق من وجود المستخدم المسؤول وإنشاءه إذا لم يكن موجوداً
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.length === 0) {
      // تحميل المستخدمين الافتراضيين من ملف البيانات
      localStorage.setItem('users', JSON.stringify(usersData.users));
    }
  }

  login(employeeId, password) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // في الإصدار المحسن، سنستخدم bcrypt للتحقق من كلمة المرور
    // لكن الآن نقوم بالبحث عن تطابق مباشر
    const user = users.find(
      (u) => u.employeeId === employeeId && u.password === password
    );

    if (user) {
      // لا نقوم بتخزين كلمة المرور في الجلسة
      const { password, ...userWithoutPassword } = user;
      localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
      return userWithoutPassword;
    }

    throw new Error('الرقم الوظيفي أو كلمة المرور غير صحيحة');
  }

  logout() {
    localStorage.removeItem('currentUser');
  }

  getCurrentUser() {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated() {
    return !!this.getCurrentUser();
  }

  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === 'admin';
  }
  
  // إضافة مستخدم جديد
  addUser(userData) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // التحقق من عدم تكرار معرف الموظف
    if (users.some(user => user.employeeId === userData.employeeId)) {
      throw new Error('الرقم الوظيفي موجود مسبقاً');
    }
    
    // إنشاء مستخدم جديد
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      employeeId: userData.employeeId,
      name: userData.name,
      password: userData.password, // في الإصدار المحسن سنقوم بتشفير كلمة المرور
      role: userData.role || 'user',
      createdAt: new Date().toISOString()
    };
    
    // تحديث قائمة المستخدمين
    const updatedUsers = [...users, newUser];
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    
    // إرجاع المستخدم بدون كلمة المرور
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }
  
  // حذف مستخدم
  deleteUser(userId) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // البحث عن المستخدم المسؤول
    const adminUsers = users.filter(user => user.role === 'admin');
    
    // إذا كان المستخدم المراد حذفه هو المسؤول الوحيد، نمنع الحذف
    if (adminUsers.length === 1 && adminUsers[0].id === userId) {
      throw new Error('لا يمكن حذف المستخدم المسؤول الوحيد');
    }
    
    // حذف المستخدم
    const updatedUsers = users.filter(user => user.id !== userId);
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    
    return true;
  }
  
  // الحصول على قائمة المستخدمين
  getUsers() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    // إرجاع المستخدمين بدون كلمات المرور
    return users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
  }
}

export const authService = new AuthService();
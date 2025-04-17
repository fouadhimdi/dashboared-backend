import usersData from '../data/users.json';

class AuthService {
  constructor() {
    // التحقق من وجود المستخدم المسؤول
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.length === 0) {
      // إنشاء حساب المدير الافتراضي
      const adminUser = {
        id: 1,
        employeeId: 'admin',
        name: 'مدير النظام',
        password: 'Admin1234567890',
        role: 'admin',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('users', JSON.stringify([adminUser]));
    }
  }

  login(employeeId, password) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(
      (u) => u.employeeId === employeeId && u.password === password
    );

    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      return user;
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
}

export const authService = new AuthService(); 
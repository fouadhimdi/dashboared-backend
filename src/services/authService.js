// البيانات الافتراضية للمستخدمين
const defaultUsers = [
  {
    id: 1,
    employeeId: "admin",
    name: "مدير النظام",
    password: "admin123",
    role: "admin",
    createdAt: "2024-03-20T12:00:00Z"
  },
  {
    id: 2,
    employeeId: "user",
    name: "مستخدم عادي",
    password: "user123",
    role: "user",
    createdAt: "2024-03-20T12:00:00Z"
  }
];

class AuthService {
  constructor() {
    // إعادة تعيين البيانات الافتراضية في كل مرة
    this.initializeUsers();
  }

  initializeUsers() {
    // مسح البيانات القديمة وإنشاء بيانات جديدة
    localStorage.setItem('users', JSON.stringify(defaultUsers));
    console.log('تم إنشاء المستخدمين الافتراضيين:', defaultUsers);
  }

  login(employeeId, password) {
    // التأكد من وجود البيانات الصحيحة
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // إذا لم توجد بيانات أو كانت ناقصة، إعادة تهيئة
    if (users.length === 0) {
      this.initializeUsers();
      users = JSON.parse(localStorage.getItem('users') || '[]');
    }
    
    console.log('محاولة تسجيل دخول:', { employeeId, password });
    console.log('المستخدمون المتاحون:', users);
    
    // البحث عن المستخدم مع تفاصيل أكثر
    const user = users.find((u) => {
      const employeeIdMatch = u.employeeId === employeeId;
      const passwordMatch = u.password === password;
      console.log(`مقارنة مع المستخدم ${u.employeeId}:`, {
        employeeIdMatch,
        passwordMatch,
        storedEmployeeId: u.employeeId,
        storedPassword: u.password,
        inputEmployeeId: employeeId,
        inputPassword: password
      });
      return employeeIdMatch && passwordMatch;
    });

    if (user) {
      // إزالة كلمة المرور من بيانات الجلسة
      const { password, ...userWithoutPassword } = user;
      localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
      console.log('تم تسجيل الدخول بنجاح:', userWithoutPassword);
      return userWithoutPassword;
    }

    console.log('فشل تسجيل الدخول - بيانات غير صحيحة');
    throw new Error('الرقم الوظيفي أو كلمة المرور غير صحيحة');
  }

  // إضافة دالة لإعادة تعيين البيانات يدوياً
  resetUsers() {
    this.initializeUsers();
    return JSON.parse(localStorage.getItem('users') || '[]');
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
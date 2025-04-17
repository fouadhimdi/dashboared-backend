import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Auth = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();
  const { login, error } = useAuth();

  useEffect(() => {
    // تحديث الوقت كل دقيقة
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => {
      clearInterval(timer);
    };
  }, []);

  const formatTime = (date) => {
    const options = { 
      hour: 'numeric', 
      minute: 'numeric',
      hour12: true 
    };
    return date.toLocaleTimeString('ar-SA', options);
  };

  const formatDate = (date) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long' 
    };
    return date.toLocaleDateString('ar-SA', options);
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!employeeId || !password) {
      return;
    }
    
    setLoading(true);
    try {
      const user = await login(employeeId, password);
      
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('خطأ في تسجيل الدخول:', err);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hours = currentTime.getHours();
    if (hours >= 5 && hours < 12) {
      return 'صباح الخير';
    } else if (hours >= 12 && hours < 17) {
      return 'مساء الخير';
    } else {
      return 'مساء الخير';
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 to-sky-50" dir="rtl">
      {/* الجانب الأيمن: خلفية وشعار المستشفى */}
      <div className="hidden lg:block lg:w-1/2 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 relative overflow-hidden">
        <div className="relative flex flex-col h-full z-20 justify-between p-12">
          <div className="flex justify-center">
            <div className="text-center">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-5 inline-block mb-6 border border-white/20 shadow-xl">
                <div className="w-36 h-36 bg-gradient-to-br from-white to-blue-50 rounded-full flex items-center justify-center overflow-hidden shadow-inner relative">
                  <div className="text-blue-800 font-bold text-center z-10">
                    <div className="text-2xl mb-1">شعار</div>
                    <div className="text-sm">التجمع الصحي الأول</div>
                    <div className="text-sm mt-1">بجدة</div>
                    <div className="w-20 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent mx-auto my-2"></div>
                    <div className="text-xs text-blue-700">الجودة والتميز</div>
                  </div>
                </div>
              </div>
              
              <h2 className="text-4xl font-bold text-white mb-3 tracking-wider text-shadow-lg relative">
                مستشفى شرق جدة
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
              </h2>
              
              <p className="text-blue-100 text-lg mt-4 font-light tracking-wide">
                التميز في تقديم الرعاية الصحية 
                <span className="inline-block mx-2 w-2 h-2 bg-cyan-400 rounded-full"></span> 
                بمعايير عالمية
              </p>
            </div>
          </div>
          
          <div className="space-y-6 mt-12">
            <div className="relative p-7 backdrop-blur-lg bg-white/10 rounded-2xl border border-white/20 shadow-xl">
              <div className="absolute -top-3 right-4 bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-1 rounded-full text-xs text-white font-medium shadow-lg">
                نظام إدارة المؤشرات
              </div>
              
              <p className="text-white text-sm leading-relaxed mt-3">
                نظام إدارة المؤشرات يتيح للطاقم الطبي والإداري متابعة مؤشرات الأداء الرئيسية والإحصائيات الحيوية للمستشفى بطريقة تفاعلية وسهلة، مما يساهم في:
              </p>
              
              <ul className="text-blue-100 text-sm mt-4 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="inline-flex w-5 h-5 bg-blue-500/20 rounded-full items-center justify-center">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                  </span>
                  تحسين جودة الخدمات المقدمة للمرضى
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex w-5 h-5 bg-blue-500/20 rounded-full items-center justify-center">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                  </span>
                  تطوير الأداء المؤسسي وكفاءة العمليات
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex w-5 h-5 bg-blue-500/20 rounded-full items-center justify-center">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                  </span>
                  دعم اتخاذ القرارات بناءً على البيانات الدقيقة
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-auto">
            <div className="text-white/80 text-center p-5 bg-gradient-to-r from-black/10 via-black/20 to-black/10 backdrop-blur-md rounded-xl border border-white/5 shadow-2xl">
              <p className="text-sm">© {new Date().getFullYear()} التجمع الصحي الأول بجدة - مستشفى شرق جدة</p>
              <p className="text-xs mt-2 text-blue-100/60">رؤية المملكة ٢٠٣٠ - برنامج التحول الصحي</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* الجانب الأيسر: نموذج تسجيل الدخول */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* شعار للشاشات الصغيرة */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-24 h-24 bg-gradient-to-r from-blue-600 to-indigo-800 rounded-full flex items-center justify-center shadow-xl p-1">
              <div className="rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center z-10">
                <div className="text-white font-bold text-center">
                  <div className="text-xs">مستشفى</div>
                  <div className="text-sm mt-0.5">شرق جدة</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* التاريخ والوقت والتحية */}
          <div className="text-center mb-8">
            <div className="relative inline-block p-2 px-4 mb-2 rounded-full bg-white shadow-md text-slate-500 text-sm border border-slate-100">
              <span className="inline-block mx-1 w-2 h-2 bg-green-400 rounded-full"></span>
              {formatDate(currentTime)} | {formatTime(currentTime)}
            </div>
            
            <h2 className="text-4xl font-extrabold tracking-tight relative inline-block bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 drop-shadow-sm greeting-text mb-2">
              {getGreeting()}
            </h2>
            
            <p className="text-slate-500 text-lg font-light mt-3">
              مرحبًا بك في نظام إدارة المؤشرات
            </p>
          </div>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* نموذج تسجيل الدخول */}
          <div className="relative bg-white py-8 px-8 shadow-2xl rounded-3xl border border-slate-100">
            {/* زخرفة متموجة علوية */}
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600"></div>
            
            <div className="relative z-10">
              <div className="flex items-start mb-6">
                <div className="w-1.5 h-7 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full mr-3 mt-1"></div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">تسجيل الدخول</h3>
                  <p className="text-sm text-gray-600">يرجى إدخال بيانات الدخول الخاصة بك للوصول إلى النظام</p>
                </div>
              </div>
              
              {error && (
                <div className="relative mb-6 overflow-hidden">
                  <div className="relative bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="mr-3">
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <label htmlFor="employeeId" className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                    </svg>
                    الرقم الوظيفي
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      id="employeeId"
                      name="employeeId"
                      type="text"
                      required
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="appearance-none block w-full pr-10 py-3.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      placeholder="أدخل الرقم الوظيفي"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="password" className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
                    </svg>
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
                      </svg>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={isPasswordVisible ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full pr-10 py-3.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      placeholder="أدخل كلمة المرور"
                    />
                    <div 
                      className="absolute inset-y-0 left-0 pl-3 flex items-center cursor-pointer" 
                      onClick={togglePasswordVisibility}
                    >
                      {isPasswordVisible ? (
                        <svg className="h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="relative">
                      <input
                        id="remember_me"
                        name="remember_me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      />
                    </div>
                    <label htmlFor="remember_me" className="mr-2 text-sm text-gray-700 cursor-pointer">
                      تذكرني
                    </label>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="relative w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-xl text-base font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 transition-all duration-300"
                  >
                    <span className="relative z-10">
                      {loading ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -mr-1 ml-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>جارِ تسجيل الدخول</span>
                        </div>
                      ) : (
                        <span>تسجيل الدخول</span>
                      )}
                    </span>
                  </button>
                </div>
              </form>
              
              <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-500">
                  © {new Date().getFullYear()} مستشفى شرق جدة - جميع الحقوق محفوظة
                </p>
                <p className="text-xs mt-2 text-gray-400">
                  الإصدار 2.0.3
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
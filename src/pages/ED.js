import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

const ED = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableData, setTableData] = useState([]);
  const [excelFiles, setExcelFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [currentPage, setCurrentPage] = useState('dashboard');
  
  // البنش مارك لكل مؤشر
  const benchmarks = {
    // KPI 1: Door to Doctor (بالدقائق)
    "KPI 1: Door to Doctor": {
      worldClass: { max: 10, color: "#0072C6" }, // أقل من 10 دقائق
      acceptable: { min: 10, max: 20, color: "#00B050" }, // 10-20 دقيقة
      needsImprovement: { min: 20, max: 40, color: "#FFC000" }, // 20-40 دقيقة
      unacceptable: { min: 40, color: "#C00000" } // أكثر من 40 دقيقة
    },
    
    // KPI 2: Doc to Decision (بالدقائق)
    "KPI 2: Doc to Decision": {
      worldClass: { max: 30, color: "#0072C6" }, // أقل من 30 دقيقة
      acceptable: { min: 30, max: 60, color: "#00B050" }, // 30-60 دقيقة
      needsImprovement: { min: 60, max: 90, color: "#FFC000" }, // 60-90 دقيقة
      unacceptable: { min: 90, color: "#C00000" } // أكثر من 90 دقيقة
    },
    
    // KPI 3: Decision to Ward/ICU/Home/etc. (بالدقائق)
    "KPI 3: Decision to": {
      worldClass: { max: 30, color: "#0072C6" }, // أقل من 30 دقيقة
      acceptable: { min: 30, max: 90, color: "#00B050" }, // 30-90 دقيقة
      needsImprovement: { min: 90, max: 130, color: "#FFC000" }, // 90-130 دقيقة
      unacceptable: { min: 130, color: "#C00000" } // أكثر من 130 دقيقة
    },
    
    // KPI 4: Non Urgent (نسبة مئوية)
    "KPI 4: Non Urgent": {
      worldClass: { max: 33, color: "#0072C6" }, // أقل من 33%
      acceptable: { min: 33, max: 50, color: "#00B050" }, // 33-50%
      needsImprovement: { min: 50, max: 75, color: "#FFC000" }, // 50-75%
      unacceptable: { min: 75, color: "#C00000" } // أكثر من 75%
    },
    
    // KPI 5: % Door to Disposition (نسبة مئوية)
    "KPI 5: % Door to Disposition": {
      worldClass: { min: 95, color: "#0072C6" }, // أكثر من 95%
      acceptable: { min: 75, max: 95, color: "#00B050" }, // 75-95%
      needsImprovement: { min: 60, max: 75, color: "#FFC000" }, // 60-75%
      unacceptable: { max: 60, color: "#C00000" } // أقل من 60%
    },
    
    // KPI 6: % LAMA & DAMA (نسبة مئوية)
    "KPI6: % LAMA & DAMA": {
      worldClass: { max: 1, color: "#0072C6" }, // أقل من 1%
      acceptable: { min: 1, max: 3, color: "#00B050" }, // 1-3%
      needsImprovement: { min: 3, max: 5, color: "#FFC000" }, // 3-5%
      unacceptable: { min: 5, color: "#C00000" } // أكثر من 5%
    },
    
    // KPI 7: Mortality Rate (نسبة مئوية)
    "KPI 7: Mortality Rate": {
      worldClass: { max: 1, color: "#0072C6" }, // أقل من 1%
      acceptable: { min: 1, max: 2, color: "#00B050" }, // 1-2%
      needsImprovement: { min: 2, max: 3, color: "#FFC000" }, // 2-3%
      unacceptable: { min: 3, color: "#C00000" } // أكثر من 3%
    },
    
    // KPI 8: Door to Pain Killer Time (بالساعات)
    "KPI 8: Door to Pain Killer Time": {
      worldClass: { max: 1, color: "#0072C6" }, // أقل من ساعة واحدة
      acceptable: { min: 1, max: 3, color: "#00B050" }, // 1-3 ساعات
      needsImprovement: { min: 3, max: 5, color: "#FFC000" }, // 3-5 ساعات
      unacceptable: { min: 5, color: "#C00000" } // أكثر من 5 ساعات
    }
  };

  // وظيفة لتحديد اللون المناسب لقيمة معينة بناءً على البنش مارك
  const getColorForValue = (kpiName, value) => {
    // التعامل مع القيم النصية أو الفارغة
    if (value === '' || value === 'NA' || value === null || value === undefined) {
      return ''; // لا لون
    }
    
    // البحث عن البنش مارك المناسب
    let benchmark;
    
    // للمؤشرات التي تبدأ بـ KPI 3
    if (kpiName.startsWith("KPI 3: Decision to")) {
      benchmark = benchmarks["KPI 3: Decision to"];
    } else {
      // للمؤشرات الأخرى
      benchmark = benchmarks[kpiName];
    }
    
    // إذا لم يتم العثور على بنش مارك لهذا المؤشر
    if (!benchmark) {
      return '';
    }
    
    // استخراج القيمة الرقمية
    let numericValue;
    
    // إذا كانت القيمة تحتوي على ساعات:دقائق
    if (typeof value === 'string' && value.includes(':')) {
      const [hours, minutes] = value.split(':').map(Number);
      numericValue = hours * 60 + minutes; // تحويل إلى دقائق
    } 
    // إذا كانت القيمة تحتوي على % (نسبة مئوية)
    else if (typeof value === 'string' && value.includes('%')) {
      numericValue = parseFloat(value);
    } 
    // القيم الرقمية
    else {
      numericValue = parseFloat(value);
    }
    
    // إذا لم يتم استخراج قيمة رقمية صالحة
    if (isNaN(numericValue)) {
      return '';
    }
    
    // تحديد اللون بناءً على النطاقات
    if (benchmark.worldClass.max !== undefined && numericValue <= benchmark.worldClass.max) {
      return benchmark.worldClass.color;
    } else if (benchmark.worldClass.min !== undefined && numericValue >= benchmark.worldClass.min) {
      return benchmark.worldClass.color;
    } else if (benchmark.acceptable.min !== undefined && benchmark.acceptable.max !== undefined && 
               numericValue >= benchmark.acceptable.min && numericValue <= benchmark.acceptable.max) {
      return benchmark.acceptable.color;
    } else if (benchmark.needsImprovement.min !== undefined && benchmark.needsImprovement.max !== undefined && 
               numericValue >= benchmark.needsImprovement.min && numericValue <= benchmark.needsImprovement.max) {
      return benchmark.needsImprovement.color;
    } else if (benchmark.unacceptable.min !== undefined && numericValue >= benchmark.unacceptable.min) {
      return benchmark.unacceptable.color;
    } else if (benchmark.unacceptable.max !== undefined && numericValue <= benchmark.unacceptable.max) {
      return benchmark.unacceptable.color;
    }
    
    return ''; // لون افتراضي إذا لم تتطابق أي حالة
  };
  
  // وظيفة لقراءة قائمة الملفات من المجلد
  useEffect(() => {
    const fetchExcelFiles = async () => {
      try {
        const response = await fetch('http://localhost:3001/data/ED');
        const files = await response.json();
        const excelFiles = files.filter(file => file.endsWith('.xlsx'));
        setExcelFiles(excelFiles);
        if (excelFiles.length > 0) {
          setSelectedFile(excelFiles[0]);
        }
      } catch (err) {
        setError('حدث خطأ في قراءة قائمة الملفات');
        console.error(err);
      }
    };

    fetchExcelFiles();
  }, []);

  // وظيفة لقراءة بيانات الملف المحدد
  useEffect(() => {
    const loadExcelData = async () => {
      if (!selectedFile) {
        setTableData({ headers: [], rows: [] });
        return;
      }

      try {
        setLoading(true);
        setError('');
        
        const response = await fetch(`http://localhost:3001/data/ED/${selectedFile}`);
        const fileContent = await response.arrayBuffer();
        const workbook = XLSX.read(fileContent, { type: 'array' });
        
        // الحصول على قائمة أوراق العمل
        const sheetNames = workbook.SheetNames;
        
        // البحث عن الورقة المطلوبة
        const sheetName = sheetNames.find(name => 
          name.toLowerCase().includes('ed kpis') || 
          name.toLowerCase().includes('kpis')
        );
        
        if (!sheetName) {
          throw new Error('لم يتم العثور على ورقة العمل المطلوبة في الملف');
        }
        
        const sheet = workbook.Sheets[sheetName];
        
        // تحديد الأعمدة التي سنعرضها
        const columnIds = [
          { id: 'AB', label: 'CTAS' },
          { id: 'AC', label: 'KPI 1: Door to Doctor' },
          { id: 'AD', label: 'KPI 2: Doc to Decision' },
          { id: 'AE', label: 'KPI 3: Decision to Ward' },
          { id: 'AF', label: 'KPI 3: Decision to ICU' },
          { id: 'AG', label: 'KPI 3: Decision to Home' },
          { id: 'AH', label: 'KPI 3: Decision to PICU' },
          { id: 'AI', label: 'KPI 3: Decision to NICU' },
          { id: 'AJ', label: 'KPI 3: Decision to another Health Facility' },
          { id: 'AK', label: 'KPI 4: Non Urgent' },
          { id: 'AL', label: 'Patients by urgency %' },
          { id: 'AM', label: 'Total patients within 4 hours' },
          { id: 'AN', label: 'Total patients' },
          { id: 'AO', label: 'KPI 5: % Door to Disposition' },
          { id: 'AP', label: 'KPI6: % LAMA & DAMA' },
          { id: 'AQ', label: 'KPI 6: % LAMA' },
          { id: 'AR', label: 'KPI6: % DAMA' },
          { id: 'AS', label: 'KPI 7: Mortality Rate' },
          { id: 'AT', label: 'KPI 8: Door to Pain Killer Time' },
          { id: 'AU', label: 'Volume of Patients discharged Ward' },
          { id: 'AV', label: 'Volume of Patients discharged ICU' },
          { id: 'AW', label: 'Volume of Patients discharged Home' },
          { id: 'AX', label: 'Volume of Patients discharged Another Facility' }
        ];
        
        // استخراج العناوين
        const headers = [];
        for (const column of columnIds) {
          const cellAddress = `${column.id}1`;
          const cell = sheet[cellAddress];
          
          if (cell && cell.v) {
            headers.push(cell.v);
          } else {
            headers.push(column.label);
          }
        }
        
        // استخراج البيانات
        const rows = [];
        for (let rowIndex = 2; rowIndex <= 7; rowIndex++) {
          const rowData = [];
          
          for (const column of columnIds) {
            const cellAddress = `${column.id}${rowIndex}`;
            const cell = sheet[cellAddress];
            
            let formattedValue = '';
            
            if (cell) {
              const columnLabel = column.label.toLowerCase();
              
              if (columnLabel.includes('non urgent') || columnLabel.includes('patients by urgency')) {
                formattedValue = cell.t === 'n' ? `${Math.round(cell.v * 100)}%` : cell.v === 0 ? '0%' : `${cell.v}`;
              } else if (columnLabel.includes('%') || columnLabel.includes('rate')) {
                if (cell.t === 'n') {
                  formattedValue = cell.v < 1 ? `${Math.round(cell.v * 100)}%` : `${Math.round(cell.v)}%`;
                } else {
                  formattedValue = cell.v === 0 ? '0%' : `${cell.v}`;
                }
              } else if (columnLabel.includes('time') || columnLabel.includes('door to') || 
                         columnLabel.includes('decision to') || columnLabel.includes('doc to')) {
                if (cell.t === 'n') {
                  const totalMinutes = Math.round(cell.v * 24 * 60);
                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = totalMinutes % 60;
                  formattedValue = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                } else if (cell.v) {
                  formattedValue = cell.v;
                }
              } else if (columnLabel.includes('total') || columnLabel.includes('volume') || 
                         columnLabel.includes('patients') || columnLabel === 'ctas') {
                formattedValue = cell.t === 'n' ? Math.round(cell.v).toString() : cell.v ? cell.v.toString() : '';
              } else if (cell.v !== undefined && cell.v !== null) {
                formattedValue = cell.v.toString();
              }
            }
            
            rowData.push(formattedValue);
          }
          
          rows.push(rowData);
        }
        
        setTableData({ headers, rows });
      } catch (err) {
        console.error("خطأ في قراءة البيانات:", err);
        setError("حدث خطأ أثناء قراءة البيانات: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadExcelData();
  }, [selectedFile]);
  
  const menuItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: '📊' },
    { id: 'admin', label: 'لوحة المشرف', icon: '👨‍💼' },
  ];

  const handleMenuClick = (itemId) => {
    if (itemId === 'admin') {
      navigate('/admin');
    } else {
      setCurrentPage(itemId);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex h-screen">
        {/* الشريط الجانبي */}
        <div className="w-64 bg-white shadow-lg">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800">قسم الطوارئ</h1>
            <p className="text-sm text-gray-500 mt-1">مرحباً بك، {authService.getCurrentUser()?.name}</p>
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
            <div className="max-w-[95%] mx-auto">
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">لوحة تحكم بيانات أقسام الطوارئ (ED)</h1>
                
                <div className="relative">
                  <select
                    value={selectedFile}
                    onChange={(e) => setSelectedFile(e.target.value)}
                    className="block w-64 bg-white border border-gray-300 rounded-lg py-2 px-4 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">اختر ملف Excel</option>
                    {excelFiles.map((file, index) => (
                      <option key={index} value={file}>
                        {file}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                  <p className="text-lg text-gray-600 mr-4">جاري تحميل البيانات...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
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
              ) : (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-xl font-semibold text-gray-800 text-center">مؤشرات الأداء الرئيسية (KPIs)</h2>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          {tableData.headers && tableData.headers.map((header, index) => (
                            <th 
                              key={index} 
                              className="sticky top-0 px-3 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-200"
                              style={{
                                minWidth: '100px',
                                maxWidth: '150px',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                lineHeight: '1.2'
                              }}
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {tableData.rows && tableData.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-gray-50 transition-colors duration-150">
                            {row.map((cell, cellIndex) => {
                              const columnHeader = tableData.headers[cellIndex];
                              const backgroundColor = getColorForValue(columnHeader, cell);
                              const textColor = backgroundColor ? 'white' : 'text-gray-900';
                              
                              return (
                                <td 
                                  key={cellIndex} 
                                  className={`px-3 py-3.5 text-center text-sm font-medium ${textColor}`}
                                  style={{ 
                                    backgroundColor: backgroundColor || '',
                                    position: 'relative'
                                  }}
                                >
                                  <div className="relative">
                                    {cell}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ED; 
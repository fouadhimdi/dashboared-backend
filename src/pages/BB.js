import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/layout/Sidebar';

// تحسين الأداء بإضافة تحميل تدريجي
const BATCH_SIZE = 50;

// قاعدة URL للـ API
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api');

// وظيفة لاستخراج التاريخ من اسم الملف
const extractDateFromFileName = (fileName) => {
  const dateMatch = fileName.match(/(\d{4})-([A-Z]{3})-(\d{1,2})/);
  if (!dateMatch) return null;
  
  const year = parseInt(dateMatch[1]);
  const monthStr = dateMatch[2];
  const day = parseInt(dateMatch[3]);
  
  const months = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3,
    'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7,
    'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
  };
  
  const month = months[monthStr];
  if (month === undefined) return null;
  
  return new Date(year, month, day);
};

// وظيفة لمقارنة التواريخ للترتيب
const compareDates = (fileA, fileB) => {
  const dateA = extractDateFromFileName(fileA);
  const dateB = extractDateFromFileName(fileB);
  
  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  
  return dateA - dateB; // ترتيب تصاعدي (من الأقدم للأحدث)
};

const BB = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [excelFiles, setExcelFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [kpis, setKpis] = useState({});
  const [processingProgress, setProcessingProgress] = useState(0);
  
  // تخزين مؤقت للتحسين الأداء
  const kpiCacheRef = useRef({});
  const excelDataRef = useRef({});
  const dataCache = useRef(new Map());

  const menuItems = [
    { id: 'admin', label: 'لوحة التحكم', icon: '👨‍💼', path: '/admin' },
    { id: 'emergency', label: 'قسم الطوارئ', icon: '🏥', path: '/emergency', showForRegularUser: true },
    { id: 'operations', label: 'قسم العمليات', icon: '🔪', path: '/operations', showForRegularUser: true },
    { id: 'lab', label: 'قسم المختبر', icon: '🧪', path: '/lab', showForRegularUser: true },
    { id: 'bloodbank', label: 'بنك الدم', icon: '🩸', path: '/bloodbank', showForRegularUser: true },
    { id: 'rad', label: 'قسم الأشعة', icon: '📡', path: '/rad', showForRegularUser: true },
  ];

  const [kpiDefinitions, setKpiDefinitions] = useState([
    {
      id: 'crossmatchRatio',
      title: 'نسبة التطابق / النقل',
      englishTitle: 'Crossmatch / Transfusion Ratio',
      targetText: 'أقل من 1.5',
      icon: (
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      borderColor: 'red',
      exactCell: { rowIndex: 4, columnName: 'B' }
    },
    {
      id: 'expiredUnits',
      title: 'نسبة خلايا الدم المنتهية الصلاحية',
      englishTitle: 'Percentage of expired PRBCs units in blood banks',
      targetText: 'أقل من 3.5%',
      icon: (
        <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      borderColor: 'yellow',
      exactCell: { rowIndex: 4, columnName: 'D' }
    },
    {
      id: 'femaleDonors',
      title: 'نسبة متبرعات الدم الإناث',
      englishTitle: 'Percentage of Female Blood Donor',
      targetText: 'أكثر من 15%',
      icon: (
        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      borderColor: 'green',
      exactCell: { rowIndex: 4, columnName: 'F' }
    },
    {
      id: 'adverseEvents',
      title: 'نسبة الأحداث السلبية للمتبرعين',
      englishTitle: 'Percentage of Adverse Donor events',
      targetText: 'أقل من 2.5%',
      icon: (
        <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      borderColor: 'purple',
      exactCell: { rowIndex: 4, columnName: 'H' }
    },
    {
      id: 'volunteerDonors',
      title: 'نسبة متبرعي الدم المتطوعين',
      englishTitle: 'Percentage of Volunteer Blood Donors',
      targetText: 'أكثر من 80%',
      icon: (
        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      borderColor: 'blue',
      exactCell: { rowIndex: 4, columnName: 'J' }
    },
    {
      id: 'discardedUnits',
      title: 'نسبة وحدات الدم المستبعدة',
      englishTitle: 'Discarded Blood Units',
      targetText: 'أقل من 5%',
      icon: (
        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      borderColor: 'red',
      exactCell: { rowIndex: 19, columnName: 'O' }
    }
  ]);
  
  const defaultValues = useMemo(() => ({
    'crossmatchRatio': '-',
    'expiredUnits': '-',
    'femaleDonors': '-',
    'adverseEvents': '-',
    'volunteerDonors': '-',
    'discardedUnits': '-'
  }), []);
  
  const getKpiEvaluation = useCallback((kpiId, value) => {
    if (!value || value === 'NA') return { color: '', label: '' };
    
    let numericValue;
    if (typeof value === 'string') {
      numericValue = parseFloat(value.replace('%', ''));
    } else {
      numericValue = value;
    }
    
    if (isNaN(numericValue)) return { color: '', label: '' };
    
    const evaluations = {
      crossmatchRatio: () => {
        if (numericValue <= 1.5) return { color: '#0072C6', label: 'ممتاز' };
        if (numericValue <= 2) return { color: '#00B050', label: 'جيد' };
        if (numericValue <= 2.5) return { color: '#FFC000', label: 'يحتاج تحسين' };
        return { color: '#C00000', label: 'غير مقبول' };
      },
      expiredUnits: () => {
        if (numericValue <= 3.5) return { color: '#0072C6', label: 'ممتاز' };
        if (numericValue <= 5) return { color: '#00B050', label: 'جيد' };
        if (numericValue <= 6) return { color: '#FFC000', label: 'يحتاج تحسين' };
        return { color: '#C00000', label: 'غير مقبول' };
      },
      femaleDonors: () => {
        if (numericValue >= 15) return { color: '#0072C6', label: 'ممتاز' };
        if (numericValue >= 10) return { color: '#00B050', label: 'جيد' };
        if (numericValue >= 2.5) return { color: '#FFC000', label: 'يحتاج تحسين' };
        return { color: '#C00000', label: 'غير مقبول' };
      },
      adverseEvents: () => {
        if (numericValue <= 2.5) return { color: '#0072C6', label: 'ممتاز' };
        if (numericValue <= 3.5) return { color: '#00B050', label: 'جيد' };
        if (numericValue <= 4.5) return { color: '#FFC000', label: 'يحتاج تحسين' };
        return { color: '#C00000', label: 'غير مقبول' };
      },
      volunteerDonors: () => {
        if (numericValue >= 80) return { color: '#0072C6', label: 'ممتاز' };
        if (numericValue >= 70) return { color: '#00B050', label: 'جيد' };
        if (numericValue >= 65) return { color: '#FFC000', label: 'يحتاج تحسين' };
        return { color: '#C00000', label: 'غير مقبول' };
      },
      discardedUnits: () => {
        if (numericValue < 5) return { color: '#0072C6', label: 'ممتاز' };
        if (numericValue < 7) return { color: '#00B050', label: 'جيد' };
        if (numericValue < 9) return { color: '#FFC000', label: 'يحتاج تحسين' };
        return { color: '#C00000', label: 'غير مقبول' };
      }
    };
    
    return evaluations[kpiId] ? evaluations[kpiId]() : { color: '', label: '' };
  }, []);
  
  // دالة لاستخراج القيمة من الخلية بناءً على اسم العمود
  const getValueByColumnName = (sheet, rowIndex, columnName) => {
    const cellAddress = columnName + (rowIndex + 1);
    const cell = sheet[cellAddress];
    return cell ? cell.v : null;
  };

  const formatKpiValue = (value, kpiId) => {
    if (value === null || value === undefined) {
      return '-';
    }
    
    let numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      return value.toString();
    }
    
    // تنسيق خاص لكل مؤشر
    switch(kpiId) {
      case 'crossmatchRatio':
        return numValue.toFixed(2);
        
      case 'expiredUnits':
      case 'discardedUnits':
        if (numValue < 1 && numValue !== 0) {
          return `${(numValue * 100).toFixed(1)}%`;
        } else {
          return `${numValue.toFixed(1)}%`;
        }
        
      case 'femaleDonors':
      case 'adverseEvents':
      case 'volunteerDonors':
        if (numValue < 1 && numValue > 0) {
          return `${(numValue * 100).toFixed(2)}%`;
        } else {
          return `${numValue.toFixed(2)}%`;
        }
        
      default:
        if (numValue < 1 && numValue !== 0) {
          return `${(numValue * 100).toFixed(1)}%`;
        }
        
        if (numValue % 1 !== 0) {
          return `${numValue.toFixed(1)}%`;
        }
        
        return `${numValue}%`;
    }
  };
  
  // تم تعديل الدالة لتستخدم getValueByColumnName لقراءة القيم من الخلايا المحددة
  const findKpisInExcel = (sheet) => {
    let extractedKpis = {};
    kpiDefinitions.forEach(kpi => {
      extractedKpis[kpi.id] = '-';
    });
    
    for (const kpiDef of kpiDefinitions) {
      if (kpiDef.exactCell && kpiDef.exactCell.rowIndex !== null && kpiDef.exactCell.columnName) {
        const value = getValueByColumnName(
          sheet, 
          kpiDef.exactCell.rowIndex, 
          kpiDef.exactCell.columnName
        );
        
        if (value !== null) {
          console.log(`تم استخراج قيمة ${kpiDef.id} (${kpiDef.title}) من الخلية ${kpiDef.exactCell.columnName}${kpiDef.exactCell.rowIndex + 1}: ${value}`);
          extractedKpis[kpiDef.id] = formatKpiValue(value, kpiDef.id);
        } else {
          console.log(`لم يتم العثور على قيمة للمؤشر ${kpiDef.id} (${kpiDef.title}) في الخلية ${kpiDef.exactCell.columnName}${kpiDef.exactCell.rowIndex + 1}`);
          extractedKpis[kpiDef.id] = '-';
        }
      }
    }
    
    return extractedKpis;
  };
  
  useEffect(() => {
    let isMounted = true;
    const fetchExcelFiles = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/data/BB`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const files = await response.json();
        const excelFiles = files.filter(file => file.endsWith('.xlsx')).sort(compareDates);
        setExcelFiles(excelFiles);
        if (excelFiles.length > 0) {
          setSelectedFile(excelFiles[0]);
        }
      } catch (err) {
        if (!isMounted) return;
        setError('حدث خطأ في قراءة قائمة الملفات');
        console.error(err);
      }
    };

    fetchExcelFiles();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setKpis(defaultValues);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();
    
    // تحسين تحميل البيانات
    const loadExcelData = useCallback(async (fileName) => {
      if (!fileName) return;
      
      // فحص التخزين المؤقت
      if (dataCache.current.has(fileName)) {
        const cachedData = dataCache.current.get(fileName);
        setKpis(cachedData);
        return;
      }
      
      setLoading(true);
      setError('');
      setProcessingProgress(0);
      
      try {
        const response = await fetch(`/data/BB/${fileName}`);
        if (!response.ok) throw new Error('فشل في تحميل الملف');
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // معالجة تدريجية
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        const totalBatches = Math.ceil(jsonData.length / BATCH_SIZE);
        
        let processedKpis = {};
        
        for (let i = 0; i < totalBatches; i++) {
          await processExcelDataBatch(jsonData, i, totalBatches);
          
          if (i === 0) {
            processedKpis = extractKpisFromData(worksheet);
          }
        }
        
        dataCache.current.set(fileName, processedKpis);
        setKpis(processedKpis);
        setProcessingProgress(100);
        
      } catch (err) {
        console.error('خطأ في تحميل البيانات:', err);
        setError('حدث خطأ في تحميل البيانات. يرجى المحاولة مرة أخرى.');
      } finally {
        setLoading(false);
        setTimeout(() => setProcessingProgress(0), 1000);
      }
    }, []);

    // استخراج KPIs من البيانات
    const extractKpisFromData = useCallback((worksheet) => {
      const extractedKpis = {};
      
      kpiDefinitions.forEach((kpi) => {
        try {
          const { rowIndex, columnName } = kpi.exactCell;
          const cellAddress = columnName + (rowIndex + 1);
          const cell = worksheet[cellAddress];
          
          if (cell && cell.v !== undefined) {
            extractedKpis[kpi.id] = formatKpiValue(cell.v);
          } else {
            extractedKpis[kpi.id] = '-';
          }
        } catch (err) {
          console.error(`خطأ في استخراج ${kpi.id}:`, err);
          extractedKpis[kpi.id] = '-';
        }
      });
      
      return extractedKpis;
    }, []);

    loadExcelData(selectedFile);
    
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [selectedFile, kpiDefinitions, defaultValues]);
  
  const getSelectedFileDate = useCallback(() => {
    if (!selectedFile) return '';
    
    const dateMatch = selectedFile.match(/(\d{4})-([A-Z]{3})-(\d{1,2})/);
    if (!dateMatch) return '';
    
    const months = {
      'JAN': 'يناير', 'FEB': 'فبراير', 'MAR': 'مارس', 'APR': 'أبريل',
      'MAY': 'مايو', 'JUN': 'يونيو', 'JUL': 'يوليو', 'AUG': 'أغسطس',
      'SEP': 'سبتمبر', 'OCT': 'أكتوبر', 'NOV': 'نوفمبر', 'DEC': 'ديسمبر'
    };
    
    return `${dateMatch[3]} ${months[dateMatch[2]]} ${dateMatch[1]}`;
  }, [selectedFile]);

  // تحسين معالجة البيانات
  const processExcelDataBatch = useCallback(async (data, batchIndex, totalBatches) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const progress = ((batchIndex + 1) / totalBatches) * 100;
        setProcessingProgress(progress);
        resolve();
      }, 10);
    });
  }, []);

  // تحسين مكون KpiCard
  const KpiCard = React.memo(({ kpi }) => {
    const { color, label } = getKpiEvaluation(kpi.id, kpis[kpi.id]);
    const isLoading = loading && !kpis[kpi.id];
    
    if (isLoading) {
      return (
        <div className="bg-white rounded-lg shadow-sm p-3 border-r-4 border-gray-300 animate-pulse">
          <div className="flex justify-between">
            <div className="flex-1">
              <div className="h-3 bg-gray-200 rounded mb-2"></div>
              <div className="h-6 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
            <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      );
    }
    
    return (
      <div className={`bg-white rounded-lg shadow-sm p-3 border-r-4 border-${kpi.borderColor}-500 transform transition-transform hover:scale-105 hover:shadow-md`}>
        <div className="flex justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">{kpi.title}</p>
            <p className="text-lg font-bold text-gray-800 mt-0.5">{kpis[kpi.id] || '-'}</p>
            {label && (
              <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: color, color: 'white' }}>
                {label}
              </span>
            )}
          </div>
          <div className={`p-2 bg-${kpi.borderColor}-100 rounded-lg`}>
            {kpi.icon}
          </div>
        </div>
        <div className="mt-2 text-[10px] text-gray-500">
          الهدف الأمثل
          <span className="text-blue-600 font-medium mr-1">{kpi.targetText}</span>
        </div>
      </div>
    );
  });
  
  KpiCard.displayName = 'KpiCard';

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex h-screen">
        <Sidebar menuItems={menuItems} />

        <div className="flex-1 overflow-auto bg-gray-50 mr-72">
          {/* شريط التقدم */}
          {processingProgress > 0 && processingProgress < 100 && (
            <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 h-1">
              <div 
                className="h-full bg-red-600 transition-all duration-300"
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>
          )}
          
          {/* رأس الصفحة */}
          <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
            <div className="px-4 py-2 flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-gray-800">لوحة تحكم بيانات بنك الدم</h1>
                {selectedFile && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {getSelectedFileDate() ? `بيانات ${getSelectedFileDate()}` : selectedFile}
                  </div>
                )}
              </div>
              
              <div className="flex items-center">
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <select
                    value={selectedFile}
                    onChange={(e) => {
                      setSelectedFile(e.target.value);
                      loadExcelData(e.target.value);
                    }}
                    className="block w-56 bg-white border border-gray-300 rounded-lg py-1.5 pr-10 pl-3 text-sm text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                  >
                    <option value="">اختر ملف Excel</option>
                    {excelFiles.map((file, index) => (
                      <option key={index} value={file}>{file}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            <div className="w-full mx-auto">
              {loading ? (
                <div className="flex flex-col justify-center items-center h-40 bg-white rounded-lg shadow-sm">
                  <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-600 mt-2">جاري تحميل البيانات...</p>
                  {processingProgress > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{Math.round(processingProgress)}%</p>
                  )}
                </div>
              ) : error ? (
                <div className="bg-red-50 border-r-4 border-red-500 p-3 rounded-lg">
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-lg shadow-sm p-3 mb-6">
                    <h2 className="text-base font-bold text-gray-700 mb-3 border-r-4 border-red-500 pr-2">ملخص مؤشرات الأداء الرئيسية لبنك الدم</h2>
                    
                    {/* شبكة responsive محسنة للجوال */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {kpiDefinitions.slice(0, 3).map((kpi) => (
                        <KpiCard key={kpi.id} kpi={kpi} />
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                      {kpiDefinitions.slice(3, 6).map((kpi) => (
                        <KpiCard key={kpi.id} kpi={kpi} />
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
                    <div className="flex justify-center items-center flex-wrap gap-4">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-[#0072C6] ml-1"></div>
                        <span className="text-xs text-gray-600">ممتاز</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-[#00B050] ml-1"></div>
                        <span className="text-xs text-gray-600">جيد</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-[#FFC000] ml-1"></div>
                        <span className="text-xs text-gray-600">يحتاج تحسين</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-[#C00000] ml-1"></div>
                        <span className="text-xs text-gray-600">غير مقبول</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              <div className="mt-2 text-center text-xs text-gray-500">
                <p>© {new Date().getFullYear()} بنك الدم - جميع الحقوق محفوظة</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BB;
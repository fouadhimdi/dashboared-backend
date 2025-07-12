import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/layout/Sidebar';

// تحسين الأداء بإضافة تحميل تدريجي
const BATCH_SIZE = 50; // حجم الدفعة لمعالجة البيانات

// قاعدة URL للـ API
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api');

// دوال بديلة لتوليد بيانات مؤقتة للرسوم البيانية
const generatePlaceholderData = (count, min, max, customLabels = null) => {
  const data = Array.from({ length: count }, () => Math.floor(Math.random() * (max - min + 1) + min));
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const labels = customLabels || months.slice(0, count);
  
  return {
    labels,
    data,
    metadata: {
      min: Math.min(...data),
      max: Math.max(...data),
      avg: data.reduce((a, b) => a + b, 0) / data.length,
      isPlaceholder: true
    }
  };
};

// دالة بديلة لتنسيق التاريخ بالعربية
const formatDateArabic = (date) => {
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return months[date.getMonth()];
};

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

const LAB = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [excelFiles, setExcelFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [kpis, setKpis] = useState({});
  const [processingProgress, setProcessingProgress] = useState(0);
  
  // تخزين مؤقت محسن
  const dataCache = useRef(new Map());
  const processingQueue = useRef([]);
  
  // إضافة مراجع للتخزين المؤقت
  const kpiCacheRef = useRef({});
  const evaluationCacheRef = useRef({});
  const excelDataRef = useRef({});
  
  const getSavedKpiDefinitions = useCallback(() => {
    try {
      const saved = localStorage.getItem('labKpiDefinitions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 5) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('خطأ في قراءة الإعدادات المحفوظة:', err);
    }
    return null;
  }, []);

  const menuItems = useMemo(() => [
    { id: 'admin', label: 'لوحة التحكم', icon: '👨‍💼', path: '/admin' },
    { id: 'emergency', label: 'قسم الطوارئ', icon: '🏥', path: '/emergency', showForRegularUser: true },
    { id: 'operations', label: 'قسم العمليات', icon: '🔪', path: '/operations', showForRegularUser: true },
    { id: 'lab', label: 'قسم المختبر', icon: '🧪', path: '/lab', showForRegularUser: true },
    { id: 'bloodbank', label: 'بنك الدم', icon: '🩸', path: '/bloodbank', showForRegularUser: true },
    { id: 'rad', label: 'قسم الأشعة', icon: '📡', path: '/rad', showForRegularUser: true },
  ], []);

  const [kpiDefinitions, setKpiDefinitions] = useState(() => {
    const savedDefinitions = getSavedKpiDefinitions();
    
    const defaultDefinitions = [
      {
        id: 'kpi1',
        title: 'نسبة تقارير المختبر المصححة',
        englishTitle: 'Percentage of Corrected Laboratory Reports',
        targetText: 'أقل من 0.5%',
        icon: (
          <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        borderColor: 'blue',
        exactCell: { rowIndex: 3, columnName: 'W' }
      },
      {
        id: 'kpi2',
        title: 'نسبة النتائج الحرجة المبلغ عنها بعد 45 دقيقة',
        englishTitle: 'Percentage of Critical Results Reported After 45 Minutes',
        targetText: 'أقل من 0.5%',
        icon: (
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        borderColor: 'red',
        exactCell: { rowIndex: 3, columnName: 'Y' }
      },
      {
        id: 'kpi3',
        title: 'نسبة عينات المختبر المرفوضة',
        englishTitle: 'Percentage of Rejected Laboratory Samples',
        targetText: 'أقل من 2%',
        icon: (
          <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        ),
        borderColor: 'orange',
        exactCell: { rowIndex: 3, columnName: 'AA' }
      },
      {
        id: 'kpi4',
        title: 'نسبة عينات قسم الطوارئ المعالجة في غضون 60 دقيقة',
        englishTitle: 'Percentage of ED Samples Processed Within 60 Minutes',
        targetText: 'أكثر من 90%',
        icon: (
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
        borderColor: 'green',
        exactCell: { rowIndex: 3, columnName: 'AC' }
      },
      {
        id: 'kpi5',
        title: 'نسبة نتائج الفحوصات الروتينية المبلغ عنها خلال 4 ساعات',
        englishTitle: 'Percentage of Routines Results Reported within 4 hours',
        targetText: 'أكثر من 95%',
        icon: (
          <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        borderColor: 'indigo',
        exactCell: { rowIndex: 3, columnName: 'AE' }
      }
    ];
    
    if (savedDefinitions) {
      return defaultDefinitions.map((def, index) => ({
        ...def,
        exactCell: savedDefinitions[index].exactCell || def.exactCell
      }));
    }
    
    return defaultDefinitions;
  });
  
  const defaultValues = useMemo(() => ({
    'kpi1': '-',
    'kpi2': '-',
    'kpi3': '-',
    'kpi4': '-',
    'kpi5': '-'
  }), []);
  
  // تحسين أداء دالة getKpiEvaluation باستخدام التخزين المؤقت
  const getKpiEvaluation = useCallback((kpiId, value) => {
    if (!value || value === 'NA' || value === '-') return { color: '', label: '' };
    
    // استخدام التخزين المؤقت للعمليات المتكررة
    const cacheKey = `${kpiId}-${value}`;
    if (evaluationCacheRef.current[cacheKey]) {
      return evaluationCacheRef.current[cacheKey];
    }
    
    let numericValue;
    if (typeof value === 'string') {
      numericValue = parseFloat(value.replace('%', ''));
    } else {
      numericValue = value;
    }
    
    if (isNaN(numericValue)) return { color: '', label: '' };
    
    let result;
    
    switch(kpiId) {
      case 'kpi1':
      case 'kpi2':
      case 'kpi3':
        if (numericValue <= 0.5) result = { color: '#0072C6', label: 'ممتاز' };
        else if (numericValue <= 1) result = { color: '#00B050', label: 'جيد' };
        else if (numericValue <= 2) result = { color: '#FFC000', label: 'يحتاج تحسين' };
        else result = { color: '#C00000', label: 'غير مقبول' };
        break;
        
      case 'kpi4':
        if (numericValue >= 95) result = { color: '#0072C6', label: 'ممتاز' };
        else if (numericValue >= 90) result = { color: '#00B050', label: 'جيد' };
        else if (numericValue >= 85) result = { color: '#FFC000', label: 'يحتاج تحسين' };
        else result = { color: '#C00000', label: 'غير مقبول' };
        break;
        
      case 'kpi5':
        if (numericValue >= 98) result = { color: '#0072C6', label: 'ممتاز' };
        else if (numericValue >= 95) result = { color: '#00B050', label: 'جيد' };
        else if (numericValue >= 90) result = { color: '#FFC000', label: 'يحتاج تحسين' };
        else result = { color: '#C00000', label: 'غير مقبول' };
        break;
        
      default:
        result = { color: '', label: '' };
    }
    
    // تخزين النتيجة للاستخدام لاحقاً
    evaluationCacheRef.current[cacheKey] = result;
    return result;
  }, []);
  
  // تحسين دالة استخراج القيم من الخلايا
  const getValueByColumnName = useCallback((sheet, rowIndex, columnName) => {
    // تحويل العمود إلى رقم للاستخدام في XLSX
    const cellAddress = columnName + (rowIndex + 1);
    const cell = sheet[cellAddress];
    return cell ? cell.v : null;
  }, []);

  const formatKpiValue = useCallback((value) => {
    if (value === null || value === undefined) {
      return '-';
    }
    
    let numValue = parseFloat(value);
    
    if (!isNaN(numValue)) {
      if (numValue < 1 && numValue !== 0) {
        return `${(numValue * 100).toFixed(1)}%`;
      }
      
      if (numValue % 1 !== 0) {
        return `${numValue.toFixed(1)}%`;
      }
      
      return `${numValue}%`;
    }
    
    if (typeof value === 'string') {
      if (!value.includes('%')) {
        return `${value}%`;
      }
      return value;
    }
    
    return value.toString();
  }, []);
  
  // تحسين دالة استخراج المؤشرات من ملف Excel
  const findKpisInExcel = useCallback((sheet) => {
    let extractedKpis = {};
    
    kpiDefinitions.forEach(kpi => {
      extractedKpis[kpi.id] = '-';
      
      if (kpi.exactCell && kpi.exactCell.rowIndex !== null && kpi.exactCell.columnName) {
        const value = getValueByColumnName(
          sheet, 
          kpi.exactCell.rowIndex, 
          kpi.exactCell.columnName
        );
        
        if (value !== null) {
          extractedKpis[kpi.id] = formatKpiValue(value);
        }
      }
    });
    
    return extractedKpis;
  }, [kpiDefinitions, getValueByColumnName, formatKpiValue]);
  
  // تحميل قائمة الملفات
  useEffect(() => {
    let isMounted = true;
    const fetchExcelFiles = async () => {
      try {
        // تحقق من وجود بيانات في التخزين المؤقت
        if (excelDataRef.current.filesList) {
          setExcelFiles(excelDataRef.current.filesList);
          if (excelDataRef.current.filesList.length > 0 && !selectedFile) {
            setSelectedFile(excelDataRef.current.filesList[0]);
          }
          return;
        }
        
        const response = await fetch(`${API_BASE_URL}/data/LAB`);
        if (!isMounted) return;
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const files = await response.json();
        const filteredFiles = files.filter(file => file.endsWith('.xlsx')).sort(compareDates);
        
        // تخزين القائمة للاستخدام لاحقاً
        excelDataRef.current.filesList = filteredFiles;
        
        setExcelFiles(filteredFiles);
        if (filteredFiles.length > 0 && !selectedFile) {
          setSelectedFile(filteredFiles[0]);
        }
      } catch (err) {
        if (!isMounted) return;
        setError('حدث خطأ في قراءة قائمة الملفات');
        console.error(err);
      }
    };

    fetchExcelFiles();
    return () => { isMounted = false; };
  }, [selectedFile]);

  // تحسين تحميل ملفات Excel
  const loadExcelFiles = useCallback(async () => {
    try {
      const response = await fetch('/api/lab-files');
      if (!response.ok) throw new Error('فشل في تحميل قائمة الملفات');
      
      const files = await response.json();
      setExcelFiles(files.filter(file => file.endsWith('.xlsx')));
    } catch (err) {
      console.error('خطأ في تحميل الملفات:', err);
      // استخدام ملفات افتراضية في حالة الخطأ
      setExcelFiles([
        'LAB-JD-GEN-4-2025-JAN-19.xlsx',
        'LAB-JD-GEN-4-2025-JAN-20.xlsx',
        'LAB-JD-GEN-4-2025-JAN-22.xlsx'
      ]);
    }
  }, []);

  // تحسين معالجة البيانات مع التحميل التدريجي
  const processExcelDataBatch = useCallback(async (data, batchIndex, totalBatches) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const progress = ((batchIndex + 1) / totalBatches) * 100;
        setProcessingProgress(progress);
        
        // معالجة دفعة البيانات
        const processedData = data.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
        resolve(processedData);
      }, 10); // تأخير صغير لتجنب حظر الواجهة
    });
  }, []);

  // تحسين تحميل بيانات Excel
  const loadExcelData = useCallback(async (fileName) => {
    if (!fileName) return;
    
    // فحص التخزين المؤقت أولاً
    if (dataCache.current.has(fileName)) {
      const cachedData = dataCache.current.get(fileName);
      setKpis(cachedData);
      return;
    }
    
    setLoading(true);
    setError('');
    setProcessingProgress(0);
    
    try {
      const response = await fetch(`/data/LAB/${fileName}`);
      if (!response.ok) throw new Error('فشل في تحميل الملف');
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // معالجة البيانات بشكل تدريجي
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
      const totalBatches = Math.ceil(jsonData.length / BATCH_SIZE);
      
      let processedKpis = {};
      
      for (let i = 0; i < totalBatches; i++) {
        await processExcelDataBatch(jsonData, i, totalBatches);
        
        // معالجة KPIs للدفعة الحالية
        if (i === 0) { // معالجة KPIs في الدفعة الأولى فقط
          processedKpis = extractKpisFromData(jsonData);
        }
      }
      
      // حفظ في التخزين المؤقت
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
  const extractKpisFromData = useCallback((data) => {
    const kpiValues = {};
    
    kpiDefinitions.forEach((kpi) => {
      try {
        const { rowIndex, columnName } = kpi.exactCell;
        const columnIndex = XLSX.utils.decode_col(columnName);
        
        if (data[rowIndex] && data[rowIndex][columnIndex]) {
          kpiValues[kpi.id] = data[rowIndex][columnIndex];
        }
      } catch (err) {
        console.error(`خطأ في استخراج ${kpi.id}:`, err);
      }
    });
    
    return kpiValues;
  }, []);

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

  // تحسين أداء مكون KpiCard
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
      <div className={`bg-white rounded-lg shadow-sm p-2 border-r-4 border-${kpi.borderColor}-500 hover:shadow-md mb-3 transition-all duration-200`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 truncate">{kpi.title}</p>
            <div className="flex items-center mt-0.5">
              <p className="text-base font-bold text-gray-800">{kpis[kpi.id] || '-'}</p>
              {label && (
                <span className="mr-1 text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: color, color: 'white' }}>
                  {label}
                </span>
              )}
            </div>
          </div>
          <div className={`p-1.5 bg-${kpi.borderColor}-100 rounded-lg ml-1`}>
            {kpi.icon}
          </div>
        </div>
      </div>
    );
  });
  
  KpiCard.displayName = 'KpiCard';

  // تحسين أداء صفوف الجدول باستخدام useMemo
  const tableRows = useMemo(() => {
    return kpiDefinitions.map((kpi) => {
      const { color, label } = getKpiEvaluation(kpi.id, kpis[kpi.id]);
      return (
        <tr key={kpi.id}>
          <td className="px-6 py-4 whitespace-normal text-sm text-gray-900">
            <div className="font-medium">{kpi.title}</div>
            <div className="text-xs text-gray-500">{kpi.englishTitle}</div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-bold">
            {kpis[kpi.id] || '-'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
            {kpi.targetText}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-center">
            <span 
              className="px-2 py-1 text-xs font-medium rounded-full" 
              style={{ backgroundColor: color, color: 'white' }}
            >
              {label}
            </span>
          </td>
        </tr>
      );
    });
  }, [kpiDefinitions, kpis, getKpiEvaluation]);

  // تحسين أداء بطاقات KPI باستخدام useMemo
  const kpiCardsGroupOne = useMemo(() => {
    return kpiDefinitions.slice(0, 2).map((kpi) => (
      <KpiCard key={kpi.id} kpi={kpi} />
    ));
  }, [kpiDefinitions, kpis]);

  const kpiCardsGroupTwo = useMemo(() => {
    return kpiDefinitions.slice(2, 4).map((kpi) => (
      <KpiCard key={kpi.id} kpi={kpi} />
    ));
  }, [kpiDefinitions, kpis]);

  const kpiCardGroupThree = useMemo(() => {
    return kpiDefinitions[4] ? <KpiCard key={kpiDefinitions[4].id} kpi={kpiDefinitions[4]} /> : null;
  }, [kpiDefinitions, kpis]);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex h-screen">
        <Sidebar />

        <div className="flex-1 overflow-auto bg-gray-50 mr-72">
          {/* شريط التقدم */}
          {processingProgress > 0 && processingProgress < 100 && (
            <div className="fixed top-0 left-0 right-0 z-50 bg-blue-500 h-1">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>
          )}
          
          {/* رأس الصفحة */}
          <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
            <div className="px-4 py-2 flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-gray-800">لوحة تحكم بيانات المختبر</h1>
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
                    <h2 className="text-base font-bold text-gray-700 mb-3 border-r-4 border-indigo-500 pr-2">ملخص مؤشرات الأداء الرئيسية للمختبر</h2>
                    
                    {/* شبكة responsive محسنة للجوال */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="space-y-3">
                        {kpiCardsGroupOne}
                      </div>
                      <div className="space-y-3">
                        {kpiCardsGroupTwo}
                      </div>
                      <div className="space-y-3 flex items-center">
                        {kpiCardGroupThree}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LAB;
import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Sidebar from '../components/layout/Sidebar';
import TimeComparisonChart from '../components/charts/TimeComparisonChart';
import ComparativeBarChart from '../components/charts/ComparativeBarChart';

// تحسين الأداء بإضافة تحميل تدريجي
const BATCH_SIZE = 50;

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
  // التعامل مع نسق التاريخ الشهري (مثال: 2025-FEB.xlsx)
  const monthlyDateMatch = fileName.match(/(\d{4})-([A-Z]{3})/);
  if (monthlyDateMatch) {
    const year = parseInt(monthlyDateMatch[1]);
    const monthStr = monthlyDateMatch[2];
    
    const months = {
      'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3,
      'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7,
      'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
    };
    
    const month = months[monthStr];
    if (month !== undefined) {
      return new Date(year, month, 1);
    }
  }
  
  // التعامل مع نسق التاريخ اليومي (مثال: 2025-FEB-15.xlsx)
  const dailyDateMatch = fileName.match(/(\d{4})-([A-Z]{3})-(\d{1,2})/);
  if (dailyDateMatch) {
    const year = parseInt(dailyDateMatch[1]);
    const monthStr = dailyDateMatch[2];
    const day = parseInt(dailyDateMatch[3]);
    
    const months = {
      'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3,
      'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7,
      'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
    };
    
    const month = months[monthStr];
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }
  
  return null;
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

const RAD = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [excelFiles, setExcelFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [kpiValues, setKpiValues] = useState({});
  const [processingProgress, setProcessingProgress] = useState(0);
  
  // تخزين مؤقت محسن
  const dataCache = React.useRef(new Map());

  // بيانات مؤشرات الأداء الرئيسية عبر الزمن - بيانات افتراضية بدلاً من استخدام excelAnalyticsService
  const [timeSeriesData, setTimeSeriesData] = useState({
    inpatientWaitTime: { 
      labels: [], 
      data: [], 
      metadata: { avg: null, min: null, max: null } 
    },
    opdWaitTime: { 
      labels: [], 
      data: [], 
      metadata: { avg: null, min: null, max: null } 
    },
    machineUtilization: { 
      labels: [], 
      data: [], 
      metadata: { avg: null, min: null, max: null } 
    }
  });
  
  // بيانات المقارنة بين الفئات - بيانات افتراضية بدلاً من استخدام excelAnalyticsService
  const [comparativeData, setComparativeData] = useState({
    machineUtilization: { 
      labels: [], 
      data: [], 
      metadata: {} 
    },
    scansByType: { 
      labels: [], 
      data: [], 
      metadata: {} 
    }
  });
  
  // حالة تحميل الرسوم البيانية
  const [chartsLoading, setChartsLoading] = useState(false);

  // تحميل ملفات Excel المتاحة عند تحميل الصفحة
  useEffect(() => {
    loadExcelFiles();
  }, []);
  
  // وظيفة لقراءة ملفات Excel المتاحة
  const loadExcelFiles = async () => {
    try {
      // محاولة جلب قائمة الملفات من نقطة النهاية API
      const response = await fetch(`${API_BASE_URL}/data/RAD`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const files = await response.json();
      
      // ترتيب الملفات حسب التاريخ من الأقدم إلى الأحدث
      const excelFiles = files.filter(file => file.endsWith('.xlsx')).sort(compareDates);
      
      setExcelFiles(excelFiles);
      
      if (excelFiles.length > 0 && !selectedFile) {
        setSelectedFile(excelFiles[0]);
      }
    } catch (error) {
      console.error('خطأ في تحميل قائمة الملفات:', error);
      setError('حدث خطأ أثناء تحميل قائمة الملفات');
      setLoading(false);
      
      // في حالة فشل تحميل الملفات، استخدم قائمة ثابتة كبديل
      const mockFiles = ["RAD-JD-GEN-4-2025-JAN.xlsx", "RAD-JD-GEN-4-2025-FEB.xlsx", "RAD-JD-GEN-4-2025-MAR.xlsx"].sort(compareDates);
      setExcelFiles(mockFiles);
      setSelectedFile(mockFiles[0]);
      loadExcelData(mockFiles[0]);
    }
  };
  
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

  // تحسين تحميل البيانات
  const loadExcelData = useCallback(async (fileName) => {
    if (!fileName) return;
    
    // فحص التخزين المؤقت
    if (dataCache.current.has(fileName)) {
      const cachedData = dataCache.current.get(fileName);
      setKpiValues(cachedData);
      return;
    }
    
    setLoading(true);
    setError('');
    setProcessingProgress(0);
    
    try {
      const response = await fetch(`/data/RAD/${fileName}`);
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
          processedKpis = extractKpisFromData(jsonData);
        }
      }
      
      dataCache.current.set(fileName, processedKpis);
      setKpiValues(processedKpis);
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
    
    try {
      // استخراج القيم من الصفوف المحددة
      const ctInpatientOrderToScan = data[5] && data[5][1] ? data[5][1] : '-';
      const ctInpatientScanToRelease = data[6] && data[6][1] ? data[6][1] : '-';
      
      // باقي الاستخراجات...
      kpiValues.reportTurnaroundTime_CT = formatTimeCell(ctInpatientOrderToScan);
      kpiValues.radRetakeRate_CT = formatTimeCell(ctInpatientScanToRelease);
      
    } catch (err) {
      console.error('خطأ في استخراج البيانات:', err);
    }
    
    return kpiValues;
  }, []);

  // دالة مساعدة للحصول على قيمة خلية من ورقة العمل
  const getCellValue = (worksheet, cellAddress) => {
    const cell = worksheet[cellAddress];
    if (!cell) return null;
    
    return cell.v;
  };
  
  // دالة مساعدة لتنسيق خلايا الوقت
  const formatTimeCell = (value) => {
    if (!value) return '-';
    
    if (typeof value === 'number') {
      // إذا كانت القيمة عددية (وقت Excel)، تحويلها إلى تنسيق ساعات:دقائق
      const totalMinutes = Math.round(value * 24 * 60); // تحويل إلى دقائق
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    } else if (typeof value === 'string') {
      if (value.includes(':')) {
        return value; // إذا كان بالفعل في تنسيق ساعات:دقائق
      }
      
      // محاولة تحويل النص إلى رقم
      const num = parseFloat(value);
      if (!isNaN(num)) {
        const totalMinutes = Math.round(num * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}:${minutes.toString().padStart(2, '0')}`;
      }
    }
    
    return value.toString(); // إرجاع القيمة كما هي إذا لم تكن في تنسيق معروف
  };
  
  // دالة مساعدة لتنسيق خلايا النسبة المئوية
  const formatPercentCell = (value) => {
    if (!value) return '-';
    
    if (typeof value === 'number') {
      // إذا كانت القيمة عددية، تحويلها إلى تنسيق نسبة مئوية
      return `${Math.round(value * 100)}%`;
    } else if (typeof value === 'string') {
      if (value.includes('%')) {
        return value; // إذا كان بالفعل في تنسيق نسبة مئوية
      }
      
      // محاولة تحويل النص إلى رقم
      const num = parseFloat(value);
      if (!isNaN(num)) {
        if (num > 1) {
          return `${Math.round(num)}%`; // إذا كان الرقم أكبر من 1، افترض أنه نسبة مئوية
        } else {
          return `${Math.round(num * 100)}%`; // إذا كان الرقم أقل من 1، افترض أنه نسبة عشرية
        }
      }
    }
    
    return value.toString(); // إرجاع القيمة كما هي إذا لم تكن في تنسيق معروف
  };
  
  // معالج تغيير الملف المحدد
  const handleFileChange = async (e) => {
    const filePath = e.target.value;
    setSelectedFile(filePath);
    
    if (filePath) {
      loadExcelData(filePath);
    }
  };

  // البنش مارك لكل مؤشر (مؤشرات قسم الأشعة)
  const benchmarks = {
    "KPI 1: Order to Scan Time": {
      worldClass: { max: 24, color: "#0072C6" },
      acceptable: { min: 24, max: 36, color: "#00B050" },
      needsImprovement: { min: 36, max: 48, color: "#FFC000" },
      unacceptable: { min: 48, color: "#C00000" }
    },
    "KPI 2: Scan to Release Time": {
      worldClass: { max: 5, color: "#0072C6" },
      acceptable: { min: 5, max: 7, color: "#00B050" },
      needsImprovement: { min: 7, max: 10, color: "#FFC000" },
      unacceptable: { min: 10, color: "#C00000" }
    },
    "KPI 3: Machine Utilization by modality": {
      worldClass: { min: 80, color: "#0072C6" },
      acceptable: { min: 70, max: 80, color: "#00B050" },
      needsImprovement: { min: 60, max: 70, color: "#FFC000" },
      unacceptable: { max: 60, color: "#C00000" }
    }
  };

  // وظائف إضافية للمساعدة في الجمال
  const getBenchmarkLabel = (kpiName, value) => {
    if (value === '' || value === 'NA' || value === null || value === undefined || value === '-') {
      return ''; 
    }
    
    const benchmark = benchmarks[kpiName];
    if (!benchmark) return '';
    
    let numericValue;
    
    if (typeof value === 'string') {
      if (value.includes('%')) {
        numericValue = parseFloat(value);
      } else if (value.includes(':')) {
        // تحويل وقت بصيغة "ساعة:دقيقة" إلى ساعات عشرية
        const [hours, minutes] = value.split(':').map(Number);
        numericValue = hours + (minutes / 60);
      } else {
        numericValue = parseFloat(value);
      }
    } else {
      numericValue = value;
    }
    
    if (isNaN(numericValue)) {
      return '';
    }
    
    if (benchmark.worldClass) {
      if ((benchmark.worldClass.min !== undefined && numericValue >= benchmark.worldClass.min) ||
          (benchmark.worldClass.max !== undefined && numericValue <= benchmark.worldClass.max)) {
        return 'ممتاز';
      }
    }
    
    if (benchmark.acceptable) {
      if ((benchmark.acceptable.min !== undefined && numericValue >= benchmark.acceptable.min) &&
          (benchmark.acceptable.max !== undefined && numericValue <= benchmark.acceptable.max)) {
        return 'جيد';
      }
    }
    
    if (benchmark.needsImprovement) {
      if ((benchmark.needsImprovement.min !== undefined && numericValue >= benchmark.needsImprovement.min) &&
          (benchmark.needsImprovement.max !== undefined && numericValue <= benchmark.needsImprovement.max)) {
        return 'يحتاج تحسين';
      }
    }
    
    if (benchmark.unacceptable) {
      if ((benchmark.unacceptable.min !== undefined && numericValue >= benchmark.unacceptable.min) ||
          (benchmark.unacceptable.max !== undefined && numericValue <= benchmark.unacceptable.max)) {
        return 'غير مقبول';
      }
    }
    
    return '';
  };

  // دالة لتحديد اللون المناسب للقيمة بناءً على البنش مارك
  const getColorForValue = (kpiName, value) => {
    if (value === '' || value === 'NA' || value === null || value === undefined || value === '-') {
      return ''; // لا لون
    }
    
    // البحث عن البنش مارك المناسب
    const benchmark = benchmarks[kpiName];
    
    // إذا لم يتم العثور على بنش مارك لهذا المؤشر
    if (!benchmark) {
      return '';
    }
    
    // استخراج القيمة الرقمية
    let numericValue;
    
    if (typeof value === 'string') {
      if (value.includes('%')) {
        numericValue = parseFloat(value);
      } else if (value.includes(':')) {
        // تحويل وقت بصيغة "ساعة:دقيقة" إلى ساعات عشرية
        const [hours, minutes] = value.split(':').map(Number);
        numericValue = hours + (minutes / 60);
      } else {
        numericValue = parseFloat(value);
      }
    } else {
      numericValue = value;
    }
    
    if (isNaN(numericValue)) {
      return '';
    }
    
    // التحقق من نطاق القيم
    if (benchmark.worldClass) {
      if ((benchmark.worldClass.min !== undefined && numericValue >= benchmark.worldClass.min) ||
          (benchmark.worldClass.max !== undefined && numericValue <= benchmark.worldClass.max)) {
        return benchmark.worldClass.color;
      }
    }
    
    if (benchmark.acceptable) {
      if ((benchmark.acceptable.min !== undefined && numericValue >= benchmark.acceptable.min) &&
          (benchmark.acceptable.max !== undefined && numericValue <= benchmark.acceptable.max)) {
        return benchmark.acceptable.color;
      }
    }
    
    if (benchmark.needsImprovement) {
      if ((benchmark.needsImprovement.min !== undefined && numericValue >= benchmark.needsImprovement.min) &&
          (benchmark.needsImprovement.max !== undefined && numericValue <= benchmark.needsImprovement.max)) {
        return benchmark.needsImprovement.color;
      }
    }
    
    if (benchmark.unacceptable) {
      if ((benchmark.unacceptable.min !== undefined && numericValue >= benchmark.unacceptable.min) ||
          (benchmark.unacceptable.max !== undefined && numericValue <= benchmark.unacceptable.max)) {
        return benchmark.unacceptable.color;
      }
    }
    
    return ''; // لون افتراضي إذا لم تتطابق أي حالة
  };

  // استخراج تاريخ الملف المحدد
  const getSelectedFileDate = useCallback(() => {
    if (!selectedFile) return '';
    
    const dateMatch = selectedFile.match(/(\d{4})-([A-Z]{3})/);
    if (dateMatch) {
      const months = {
        'JAN': 'يناير', 'FEB': 'فبراير', 'MAR': 'مارس', 'APR': 'أبريل',
        'MAY': 'مايو', 'JUN': 'يونيو', 'JUL': 'يوليو', 'AUG': 'أغسطس',
        'SEP': 'سبتمبر', 'OCT': 'أكتوبر', 'NOV': 'نوفمبر', 'DEC': 'ديسمبر'
      };
      return `${months[dateMatch[2]]} ${dateMatch[1]}`;
    }
    return '';
  }, [selectedFile]);

  // تعريف عناصر القائمة الجانبية
  const menuItems = [
    { id: 'admin', label: 'لوحة التحكم', icon: '👨‍💼', path: '/admin' },
    { id: 'emergency', label: 'قسم الطوارئ', icon: '🏥', path: '/emergency', showForRegularUser: true },
    { id: 'operations', label: 'قسم العمليات', icon: '🔪', path: '/operations', showForRegularUser: true },
    { id: 'lab', label: 'قسم المختبر', icon: '🧪', path: '/lab', showForRegularUser: true },
    { id: 'bloodbank', label: 'بنك الدم', icon: '🩸', path: '/bloodbank', showForRegularUser: true },
    { id: 'rad', label: 'قسم الأشعة', icon: '📡', path: '/rad', showForRegularUser: true },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex h-screen">
        {/* استخدام مكون الشريط الجانبي الموحد */}
        <Sidebar menuItems={menuItems} />

        {/* المحتوى الرئيسي */}
        <div className="flex-1 overflow-auto bg-gray-50 mr-0 lg:mr-72">
          {/* شريط التقدم */}
          {processingProgress > 0 && processingProgress < 100 && (
            <div className="fixed top-0 left-0 right-0 z-50 bg-indigo-500 h-1">
              <div 
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>
          )}
          
          {/* رأس الصفحة - محسن للجوال */}
          <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
            <div className="px-2 sm:px-4 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-800">لوحة تحكم بيانات قسم الأشعة</h1>
                {selectedFile && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {getSelectedFileDate() ? `بيانات ${getSelectedFileDate()}` : selectedFile}
                  </div>
                )}
              </div>
              
              <div className="flex items-center w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <select
                    value={selectedFile}
                    onChange={handleFileChange}
                    className="block w-full sm:w-56 bg-white border border-gray-300 rounded-lg py-1.5 pr-10 pl-3 text-sm text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
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
            </div>
          </div>
          
          <div className="p-2 sm:p-4">
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
                <div className="bg-red-50 border-r-4 border-red-500 p-3 rounded-lg shadow-sm">
                  <div className="flex">
                    <div className="flex-shrink-0 mr-3">
                      <svg className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {/* القسم الرئيسي لبطاقات المؤشرات - محسن للجوال */}
                  <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-6">
                    <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-r-4 border-indigo-500 pr-2">ملخص مؤشرات الأداء الرئيسية لقسم الأشعة</h2>
                    
                    {/* شبكة responsive محسنة للجوال */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {/* العمود الأول - جهاز CT */}
                      <div>
                        <div className="mb-3 bg-gradient-to-r from-blue-50 to-blue-100 p-2 rounded-lg border-r-4 border-blue-500">
                          <h3 className="text-sm sm:text-base font-semibold text-blue-800 text-center">أجهزة CT</h3>
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          {/* معدل استخدام CT */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-green-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">معدل استخدام CT</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radUtilization || '-'}</p>
                                {getBenchmarkLabel("KPI 3: Machine Utilization by modality", kpiValues.radUtilization) && (
                                  <span className="text-[7px] sm:text-[8px] px-1 py-0.5 rounded" 
                                        style={{ backgroundColor: getColorForValue("KPI 3: Machine Utilization by modality", kpiValues.radUtilization), color: 'white' }}>
                                    {getBenchmarkLabel("KPI 3: Machine Utilization by modality", kpiValues.radUtilization)}
                                  </span>
                                )}
                              </div>
                              <div className="p-1 sm:p-1.5 bg-green-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 01-2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أكثر من 80%</span>
                            </div>
                          </div>
                          
                          {/* زمن انتظار المنومين (CT) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-indigo-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار المنومين (CT)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.reportTurnaroundTime_CT || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-indigo-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* وقت الفحص إلى التقرير (CT منومين) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (CT منومين)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radRetakeRate_CT || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                          
                          {/* زمن انتظار العيادات (CT) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار العيادات (CT)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radExamCompletionTime_CT || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* وقت الفحص إلى التقرير (CT عيادات) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-purple-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (CT عيادات)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.patientWaitingTime_CT || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-purple-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* العمود الثاني - جهاز MRI */}
                      <div>
                        <div className="mb-3 bg-gradient-to-r from-purple-50 to-purple-100 p-2 rounded-lg border-r-4 border-purple-500">
                          <h3 className="text-sm sm:text-base font-semibold text-purple-800 text-center">أجهزة MRI</h3>
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          {/* معدل استخدام MRI */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-purple-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">معدل استخدام MRI</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.criticalResultsReporting || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-purple-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 01-2-2z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أكثر من 80%</span>
                            </div>
                          </div>
                          
                          {/* زمن انتظار المنومين (MRI) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-indigo-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار المنومين (MRI)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.reportTurnaroundTime_MRI || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-indigo-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* وقت الفحص إلى التقرير (MRI منومين) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (MRI منومين)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radRetakeRate_MRI || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                          
                          {/* زمن انتظار العيادات (MRI) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار العيادات (MRI)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radExamCompletionTime_MRI || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* وقت الفحص إلى التقرير (MRI عيادات) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-purple-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (MRI عيادات)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.patientWaitingTime_MRI || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-purple-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* العمود الثالث - جهاز Ultrasound */}
                      <div>
                        <div className="mb-3 bg-gradient-to-r from-yellow-50 to-yellow-100 p-2 rounded-lg border-r-4 border-yellow-500">
                          <h3 className="text-sm sm:text-base font-semibold text-yellow-800 text-center">أجهزة Ultrasound</h3>
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          {/* معدل استخدام Ultrasound */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-yellow-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">معدل استخدام Ultrasound</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.schedulingAccuracy || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-yellow-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 01-2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أكثر من 80%</span>
                            </div>
                          </div>
                          
                          {/* زمن انتظار المنومين (Ultrasound) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-indigo-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار المنومين (Ultrasound)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.reportTurnaroundTime_US || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-indigo-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* وقت الفحص إلى التقرير (US منومين) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (US منومين)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radRetakeRate_US || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                          
                          {/* زمن انتظار العيادات (Ultrasound) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">زمن انتظار العيادات (Ultrasound)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.radExamCompletionTime_US || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-blue-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 24 ساعة</span>
                            </div>
                          </div>
                          
                          {/* وقت الفحص إلى التقرير (US عيادات) */}
                          <div className="bg-white rounded-lg shadow-sm p-2 border-r-3 border-purple-500 transform transition-transform hover:scale-105 hover:shadow-md">
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <p className="text-[9px] sm:text-[10px] font-medium text-gray-500">وقت الفحص إلى التقرير (US عيادات)</p>
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">{kpiValues.patientWaitingTime_US || '-'}</p>
                              </div>
                              <div className="p-1 sm:p-1.5 bg-purple-100 rounded-lg">
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                            <div className="mt-1 text-[7px] sm:text-[8px] text-gray-500">
                              الهدف الأمثل
                              <span className="text-blue-600 font-medium mr-1">أقل من 5 ساعات</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* مؤشرات الألوان - محسن للجوال */}
                  <div className="bg-white rounded-lg shadow-sm p-3 mb-4 mt-4">
                    <div className="flex justify-center items-center flex-wrap gap-2 sm:gap-4">
                      <div className="flex items-center">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#0072C6] ml-1"></div>
                        <span className="text-[10px] sm:text-xs text-gray-600">ممتاز</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#00B050] ml-1"></div>
                        <span className="text-[10px] sm:text-xs text-gray-600">جيد</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#FFC000] ml-1"></div>
                        <span className="text-[10px] sm:text-xs text-gray-600">يحتاج تحسين</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-[#C00000] ml-1"></div>
                        <span className="text-[10px] sm:text-xs text-gray-600">غير مقبول</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* حقوق الملكية */}
              <div className="mt-4 text-center text-[10px] sm:text-xs text-gray-500">
                <p>© {String(new Date().getFullYear())} قسم الأشعة - مستشفى شرق جدة - جميع الحقوق محفوظة</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RAD;
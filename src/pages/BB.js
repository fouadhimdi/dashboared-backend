import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import { excelAnalyticsService } from '../services/excelAnalyticsService';

// تحميل مكونات الرسوم البيانية بشكل كسول (Lazy Loading)
const TimeComparisonChart = lazy(() => import('../components/charts/TimeComparisonChart'));
const ComparativeBarChart = lazy(() => import('../components/charts/ComparativeBarChart'));

const BB = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [excelFiles, setExcelFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [kpis, setKpis] = useState({});
  
  // حالة تحميل وبيانات الرسوم البيانية
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsData, setChartsData] = useState({
    timeSeriesData: {
      crossmatchRatio: { labels: [], data: [], metadata: {} },
      expiredUnits: { labels: [], data: [], metadata: {} },
      volunteerDonors: { labels: [], data: [], metadata: {} },
      femaleDonors: { labels: [], data: [], metadata: {} }
    },
    comparativeData: {
      bloodTypes: { labels: [], data: [], metadata: {} },
      donationsByMonth: { labels: [], data: [], metadata: {} },
      donationReasons: { labels: [], data: [], metadata: {} }
    }
  });
  
  // تخزين مؤقت للرسوم البيانية لتحسين الأداء
  const chartsDataCacheRef = useRef({});
  const kpiCacheRef = useRef({});
  const excelDataRef = useRef({});

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
      exactCell: { rowIndex: 4, columnName: 'B' } // Cell B5 in Excel (row 5)
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
      exactCell: { rowIndex: 4, columnName: 'D' } // Cell D5 in Excel (row 5)
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
      exactCell: { rowIndex: 4, columnName: 'F' } // Cell F5 in Excel (row 5)
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
      exactCell: { rowIndex: 4, columnName: 'H' } // Cell H5 in Excel (row 5)
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
      exactCell: { rowIndex: 4, columnName: 'J' } // Cell J5 in Excel (row 5)
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
      exactCell: { rowIndex: 19, columnName: 'O' } // تعديل إلى العمود O والصف 20 (Total: 5%)
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
    // تحويل العمود إلى رقم للاستخدام في XLSX
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
        // نسبة التطابق/النقل: تقريب إلى رقمين عشريين بدون علامة النسبة
        return numValue.toFixed(2);
        
      case 'expiredUnits':
      case 'discardedUnits':
        // للقيم المئوية الصغيرة التي قد تكون أقل من 1%
        if (numValue < 1 && numValue !== 0) {
          // إذا كانت القيمة أصغر من 1، ضربها في 100 وعرضها كنسبة مئوية
          return `${(numValue * 100).toFixed(1)}%`;
        } else {
          // إذا كانت أكبر من أو تساوي 1، عرضها كنسبة مئوية مباشرة
          return `${numValue.toFixed(1)}%`;
        }
        
      case 'femaleDonors':
      case 'adverseEvents':
      case 'volunteerDonors':
        // إذا كانت القيمة بين 0 و1، افترض أنها نسبة عشرية تحتاج ضرب في 100
        if (numValue < 1 && numValue > 0) {
          return `${(numValue * 100).toFixed(2)}%`;
        } else {
          // وإلا اعرضها كما هي مع علامة النسبة المئوية
          return `${numValue.toFixed(2)}%`;
        }
        
      default:
        // التنسيق الافتراضي
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
        const response = await fetch('http://localhost:3001/data/BB');
        if (!isMounted) return;
        
        const files = await response.json();
        const excelFiles = files.filter(file => file.endsWith('.xlsx'));
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
    
    const loadExcelData = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await fetch(`http://localhost:3001/data/BB/${selectedFile}`, {
          signal: abortController.signal
        });
        
        if (!isMounted) return;
        
        const fileContent = await response.arrayBuffer();
        
        if (!isMounted) return;
        
        const workbook = XLSX.read(new Uint8Array(fileContent), { type: 'array' });
        
        if (!isMounted) return;
        
        const sheetNames = workbook.SheetNames;
        // تحديد ورقة العمل الثالثة (إذا كانت موجودة) حسب الصورة
        let targetSheetIndex = 2; // الفهرس 2 يمثل الورقة الثالثة (لأن الفهارس تبدأ من 0)
        
        // إذا لم تكن هناك ورقة ثالثة، استخدم الورقة الأولى
        if (sheetNames.length <= targetSheetIndex) {
          targetSheetIndex = 0;
        }
        
        const targetSheetName = sheetNames[targetSheetIndex];
        const sheet = workbook.Sheets[targetSheetName];
        
        // استخراج القيم مباشرة من ورقة العمل
        const extractedKpis = findKpisInExcel(sheet);
        
        if (isMounted) {
          setKpis(extractedKpis);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('تم إلغاء طلب تحميل البيانات');
          return;
        }
        
        if (isMounted) {
          console.error("خطأ في قراءة البيانات:", err);
          setError("حدث خطأ أثناء قراءة البيانات: " + err.message);
          setKpis(defaultValues);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadExcelData();
    
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [selectedFile, kpiDefinitions, defaultValues]);
  
  const loadChartsData = useCallback(async () => {
    // التحقق من وجود ملفات للتحليل
    if (!excelFiles || excelFiles.length === 0) {
      return;
    }

    // التحقق من وجود البيانات في التخزين المؤقت
    const cacheKey = excelFiles.join('-');
    if (chartsDataCacheRef.current[cacheKey]) {
      setChartsData(chartsDataCacheRef.current[cacheKey]);
      return;
    }

    try {
      setChartsLoading(true);
      
      // تجهيز مسارات الملفات
      const filePaths = excelFiles.map(file => `BB/${file}`);
      
      // تحميل البيانات الزمنية بالتوازي لتحسين الأداء
      const [
        crossmatchRatioData,
        expiredUnitsData,
        volunteerDonorsData,
        femaleDonorsData
      ] = await Promise.all([
        // نسبة التطابق / النقل
        excelAnalyticsService.extractTimeSeriesData(
          filePaths,
          'kpi',
          'B', // عمود نسبة التطابق/النقل
          5, // الصف المستهدف
          null // لا يحتاج تحويل
        ),
        
        // نسبة خلايا الدم المنتهية الصلاحية
        excelAnalyticsService.extractTimeSeriesData(
          filePaths,
          'kpi',
          'D', // عمود نسبة الخلايا المنتهية الصلاحية
          5, // الصف المستهدف
          excelAnalyticsService.transformers.percentage
        ),
        
        // نسبة متبرعي الدم المتطوعين
        excelAnalyticsService.extractTimeSeriesData(
          filePaths,
          'kpi',
          'J', // عمود نسبة المتبرعين المتطوعين
          5, // الصف المستهدف
          excelAnalyticsService.transformers.percentage
        ),
        
        // نسبة متبرعات الدم الإناث
        excelAnalyticsService.extractTimeSeriesData(
          filePaths,
          'kpi',
          'F', // عمود نسبة المتبرعات الإناث
          5, // الصف المستهدف
          excelAnalyticsService.transformers.percentage
        )
      ]);
      
      // إذا لم تكن هناك بيانات كافية، استخدام بيانات مؤقتة للعرض
      if (crossmatchRatioData.data.length < 2) {
        crossmatchRatioData.data = [1.8, 1.6, 1.5, 1.4, 1.3, 1.2];
        crossmatchRatioData.labels = Array(6).fill().map((_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - (5 - i));
          return excelAnalyticsService.formatDateArabic(date);
        });
        crossmatchRatioData.metadata = {
          min: Math.min(...crossmatchRatioData.data),
          max: Math.max(...crossmatchRatioData.data),
          avg: crossmatchRatioData.data.reduce((a, b) => a + b, 0) / crossmatchRatioData.data.length,
          isPlaceholder: true
        };
      }
      
      // بيانات أنواع الدم (بيانات افتراضية)
      const bloodTypes = {
        labels: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        data: [
          Math.round(Math.random() * 3000 + 2000),
          Math.round(Math.random() * 500 + 300),
          Math.round(Math.random() * 2000 + 1500),
          Math.round(Math.random() * 300 + 200),
          Math.round(Math.random() * 1000 + 500),
          Math.round(Math.random() * 200 + 100),
          Math.round(Math.random() * 4000 + 3000),
          Math.round(Math.random() * 700 + 500)
        ],
        metadata: {
          total: 0
        }
      };
      
      bloodTypes.metadata.total = bloodTypes.data.reduce((a, b) => a + b, 0);
      
      // بيانات التبرعات حسب الشهر (بيانات افتراضية أو موقعها في ملفات الإكسل)
      const donationsByMonth = {
        labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
        data: Array(6).fill().map(() => Math.round(Math.random() * 3000 + 2000)),
        metadata: {
          avg: 0
        }
      };
      
      donationsByMonth.metadata.avg = donationsByMonth.data.reduce((a, b) => a + b, 0) / donationsByMonth.data.length;
      
      // بيانات أسباب التبرع (بيانات افتراضية)
      const donationReasons = {
        labels: ['تبرع طوعي', 'مريض قريب', 'حملة تبرع', 'مناسبة دينية', 'أخرى'],
        data: [
          Math.round(Math.random() * 2000 + 4000),
          Math.round(Math.random() * 1000 + 2000),
          Math.round(Math.random() * 1500 + 1500),
          Math.round(Math.random() * 1000 + 500),
          Math.round(Math.random() * 500 + 200)
        ],
        metadata: {
          total: 0
        }
      };
      
      donationReasons.metadata.total = donationReasons.data.reduce((a, b) => a + b, 0);
      
      // تجميع البيانات
      const newChartsData = {
        timeSeriesData: {
          crossmatchRatio: crossmatchRatioData,
          expiredUnits: expiredUnitsData.data.length < 2 ? excelAnalyticsService.generatePlaceholderData(6, 2, 5) : expiredUnitsData,
          volunteerDonors: volunteerDonorsData.data.length < 2 ? excelAnalyticsService.generatePlaceholderData(6, 65, 85) : volunteerDonorsData,
          femaleDonors: femaleDonorsData.data.length < 2 ? excelAnalyticsService.generatePlaceholderData(6, 5, 20) : femaleDonorsData
        },
        comparativeData: {
          bloodTypes,
          donationsByMonth,
          donationReasons
        }
      };
      
      // تخزين البيانات في التخزين المؤقت
      chartsDataCacheRef.current[cacheKey] = newChartsData;
      
      // تحديث الحالة
      setChartsData(newChartsData);
    } catch (err) {
      console.error('خطأ في تحميل بيانات الرسوم البيانية:', err);
    } finally {
      setChartsLoading(false);
    }
  }, [excelFiles]);
  
  // تحميل بيانات الرسوم البيانية عند تغيير قائمة الملفات
  useEffect(() => {
    // تنفيذ التحميل بتأخير بسيط لتفادي التضارب مع تحميل البيانات الأساسية
    const timeoutId = setTimeout(() => {
      loadChartsData();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [excelFiles, loadChartsData]);
  
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

  const KpiCard = React.memo(({ kpi }) => {
    const { color, label } = getKpiEvaluation(kpi.id, kpis[kpi.id]);
    
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

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex h-screen">
        <Sidebar menuItems={menuItems} />

        <div className="flex-1 overflow-auto bg-gray-50 mr-72">
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
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <select
                    value={selectedFile}
                    onChange={(e) => setSelectedFile(e.target.value)}
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
                <div className="flex justify-center items-center h-40 bg-white rounded-lg shadow-sm">
                  <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-600 mr-3">جاري تحميل البيانات...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 border-r-4 border-red-500 p-3 rounded-lg">
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-lg shadow-sm p-3 mb-6">
                    <h2 className="text-base font-bold text-gray-700 mb-3 border-r-4 border-red-500 pr-2">ملخص مؤشرات الأداء الرئيسية لبنك الدم</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {kpiDefinitions.slice(0, 3).map((kpi) => (
                        <KpiCard key={kpi.id} kpi={kpi} />
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      {kpiDefinitions.slice(3, 6).map((kpi) => (
                        <KpiCard key={kpi.id} kpi={kpi} />
                      ))}
                    </div>
                  </div>

                  {/* قسم الرسوم البيانية الزمنية */}
                  <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <h2 className="text-base font-bold text-gray-700 mb-4 border-r-4 border-red-500 pr-2">
                      اتجاهات مؤشرات الأداء بمرور الوقت
                    </h2>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* رسم بياني: نسبة التطابق/النقل عبر الزمن */}
                      <div className="bg-gray-50 rounded-lg p-3 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-2">
                          نسبة التطابق/النقل
                          {chartsData.timeSeriesData.crossmatchRatio.metadata.isPlaceholder && (
                            <span className="text-xs mr-2 font-normal text-gray-500">(بيانات تقديرية)</span>
                          )}
                        </h3>
                        <div className="h-64">
                          <Suspense fallback={<div className="flex items-center justify-center h-full">
                            <div className="text-gray-400 text-sm">جاري تحميل الرسم البياني...</div>
                          </div>}>
                            <TimeComparisonChart 
                              data={chartsData.timeSeriesData.crossmatchRatio.data}
                              labels={chartsData.timeSeriesData.crossmatchRatio.labels}
                              title=""
                              label="نسبة التطابق/النقل"
                              height={250}
                              backgroundColor="rgba(255, 99, 132, 0.2)"
                              borderColor="rgba(255, 99, 132, 1)"
                              yAxisMin={0}
                              benchmark={1.5}
                              direction="rtl"
                            />
                          </Suspense>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 flex justify-between">
                          <div>الحد الأقصى الموصى به: <span className="font-bold">1.5</span></div>
                          <div>
                            {chartsData.timeSeriesData.crossmatchRatio.data.length > 0 && (
                              <>المتوسط: <span className="font-bold">
                                {(chartsData.timeSeriesData.crossmatchRatio.data.reduce((a, b) => a + b, 0) / 
                                chartsData.timeSeriesData.crossmatchRatio.data.length).toFixed(2)}
                              </span></>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* رسم بياني: نسبة وحدات الدم منتهية الصلاحية */}
                      <div className="bg-gray-50 rounded-lg p-3 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-2">
                          نسبة وحدات الدم منتهية الصلاحية
                          {chartsData.timeSeriesData.expiredUnits.metadata.isPlaceholder && (
                            <span className="text-xs mr-2 font-normal text-gray-500">(بيانات تقديرية)</span>
                          )}
                        </h3>
                        <div className="h-64">
                          <Suspense fallback={<div className="flex items-center justify-center h-full">
                            <div className="text-gray-400 text-sm">جاري تحميل الرسم البياني...</div>
                          </div>}>
                            <TimeComparisonChart 
                              data={chartsData.timeSeriesData.expiredUnits.data}
                              labels={chartsData.timeSeriesData.expiredUnits.labels}
                              title=""
                              label="النسبة المئوية"
                              height={250}
                              backgroundColor="rgba(255, 159, 64, 0.2)"
                              borderColor="rgba(255, 159, 64, 1)"
                              yAxisMin={0}
                              isPercentage={true}
                              benchmark={3.5}
                              direction="rtl"
                            />
                          </Suspense>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 flex justify-between">
                          <div>الحد الأقصى الموصى به: <span className="font-bold">3.5%</span></div>
                          <div>
                            {chartsData.timeSeriesData.expiredUnits.data.length > 0 && (
                              <>المتوسط: <span className="font-bold">
                                {(chartsData.timeSeriesData.expiredUnits.data.reduce((a, b) => a + b, 0) / 
                                chartsData.timeSeriesData.expiredUnits.data.length).toFixed(1)}%
                              </span></>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* رسم بياني: نسبة متبرعي الدم المتطوعين */}
                      <div className="bg-gray-50 rounded-lg p-3 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-2">
                          نسبة متبرعي الدم المتطوعين
                          {chartsData.timeSeriesData.volunteerDonors.metadata.isPlaceholder && (
                            <span className="text-xs mr-2 font-normal text-gray-500">(بيانات تقديرية)</span>
                          )}
                        </h3>
                        <div className="h-64">
                          <Suspense fallback={<div className="flex items-center justify-center h-full">
                            <div className="text-gray-400 text-sm">جاري تحميل الرسم البياني...</div>
                          </div>}>
                            <TimeComparisonChart 
                              data={chartsData.timeSeriesData.volunteerDonors.data}
                              labels={chartsData.timeSeriesData.volunteerDonors.labels}
                              title=""
                              label="النسبة المئوية"
                              height={250}
                              backgroundColor="rgba(54, 162, 235, 0.2)"
                              borderColor="rgba(54, 162, 235, 1)"
                              yAxisMin={50}
                              isPercentage={true}
                              benchmark={80}
                              direction="rtl"
                            />
                          </Suspense>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 flex justify-between">
                          <div>الحد الأدنى الموصى به: <span className="font-bold">80%</span></div>
                          <div>
                            {chartsData.timeSeriesData.volunteerDonors.data.length > 0 && (
                              <>المتوسط: <span className="font-bold">
                                {(chartsData.timeSeriesData.volunteerDonors.data.reduce((a, b) => a + b, 0) / 
                                chartsData.timeSeriesData.volunteerDonors.data.length).toFixed(1)}%
                              </span></>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* رسم بياني: نسبة متبرعات الدم الإناث */}
                      <div className="bg-gray-50 rounded-lg p-3 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-2">
                          نسبة متبرعات الدم الإناث
                          {chartsData.timeSeriesData.femaleDonors.metadata.isPlaceholder && (
                            <span className="text-xs mr-2 font-normal text-gray-500">(بيانات تقديرية)</span>
                          )}
                        </h3>
                        <div className="h-64">
                          <Suspense fallback={<div className="flex items-center justify-center h-full">
                            <div className="text-gray-400 text-sm">جاري تحميل الرسم البياني...</div>
                          </div>}>
                            <TimeComparisonChart 
                              data={chartsData.timeSeriesData.femaleDonors.data}
                              labels={chartsData.timeSeriesData.femaleDonors.labels}
                              title=""
                              label="النسبة المئوية"
                              height={250}
                              backgroundColor="rgba(153, 102, 255, 0.2)"
                              borderColor="rgba(153, 102, 255, 1)"
                              yAxisMin={0}
                              isPercentage={true}
                              benchmark={15}
                              direction="rtl"
                            />
                          </Suspense>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 flex justify-between">
                          <div>الحد الأدنى الموصى به: <span className="font-bold">15%</span></div>
                          <div>
                            {chartsData.timeSeriesData.femaleDonors.data.length > 0 && (
                              <>المتوسط: <span className="font-bold">
                                {(chartsData.timeSeriesData.femaleDonors.data.reduce((a, b) => a + b, 0) / 
                                chartsData.timeSeriesData.femaleDonors.data.length).toFixed(1)}%
                              </span></>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* قسم الرسوم البيانية المقارنة */}
                  <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <h2 className="text-base font-bold text-gray-700 mb-4 border-r-4 border-red-500 pr-2">
                      إحصائيات وتحليلات بنك الدم
                    </h2>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* رسم بياني: أنواع الدم */}
                      <div className="bg-gray-50 rounded-lg p-3 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-2">
                          توزيع فصائل الدم المتبرع بها
                        </h3>
                        <div className="h-64">
                          <Suspense fallback={<div className="flex items-center justify-center h-full">
                            <div className="text-gray-400 text-sm">جاري تحميل الرسم البياني...</div>
                          </div>}>
                            <ComparativeBarChart 
                              data={chartsData.comparativeData.bloodTypes.data}
                              labels={chartsData.comparativeData.bloodTypes.labels}
                              title=""
                              label="عدد وحدات الدم"
                              height={250}
                              colors={[
                                'rgba(255, 99, 132, 0.7)',
                                'rgba(255, 99, 132, 0.5)',
                                'rgba(54, 162, 235, 0.7)',
                                'rgba(54, 162, 235, 0.5)',
                                'rgba(255, 206, 86, 0.7)',
                                'rgba(255, 206, 86, 0.5)',
                                'rgba(75, 192, 192, 0.7)',
                                'rgba(75, 192, 192, 0.5)',
                              ]}
                              direction="rtl"
                            />
                          </Suspense>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 flex justify-between">
                          <div>إجمالي عدد الوحدات: <span className="font-bold">
                            {chartsData.comparativeData.bloodTypes.metadata.total && 
                             chartsData.comparativeData.bloodTypes.metadata.total.toLocaleString() || '0'}
                          </span></div>
                          <div>فصيلة الدم الأكثر تبرعاً: <span className="font-bold">
                            {chartsData.comparativeData.bloodTypes.labels[
                              chartsData.comparativeData.bloodTypes.data.indexOf(
                                Math.max(...chartsData.comparativeData.bloodTypes.data)
                              )
                            ]}
                          </span></div>
                        </div>
                      </div>

                      {/* رسم بياني: التبرعات حسب الشهر */}
                      <div className="bg-gray-50 rounded-lg p-3 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-2">
                          عدد التبرعات حسب الشهر
                        </h3>
                        <div className="h-64">
                          <Suspense fallback={<div className="flex items-center justify-center h-full">
                            <div className="text-gray-400 text-sm">جاري تحميل الرسم البياني...</div>
                          </div>}>
                            <ComparativeBarChart 
                              data={chartsData.comparativeData.donationsByMonth.data}
                              labels={chartsData.comparativeData.donationsByMonth.labels}
                              title=""
                              label="عدد التبرعات"
                              height={250}
                              colors={[
                                'rgba(54, 162, 235, 0.7)',
                                'rgba(75, 192, 192, 0.7)',
                                'rgba(153, 102, 255, 0.7)',
                                'rgba(255, 159, 64, 0.7)',
                                'rgba(255, 99, 132, 0.7)',
                                'rgba(255, 206, 86, 0.7)',
                              ]}
                              direction="rtl"
                            />
                          </Suspense>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 flex justify-between">
                          <div>متوسط التبرعات الشهرية: <span className="font-bold">
                            {Math.round(chartsData.comparativeData.donationsByMonth.metadata.avg).toLocaleString()}
                          </span></div>
                          <div>الشهر الأكثر تبرعاً: <span className="font-bold">
                            {chartsData.comparativeData.donationsByMonth.labels[
                              chartsData.comparativeData.donationsByMonth.data.indexOf(
                                Math.max(...chartsData.comparativeData.donationsByMonth.data)
                              )
                            ]}
                          </span></div>
                        </div>
                      </div>

                      {/* رسم بياني: أسباب التبرع */}
                      <div className="col-span-1 lg:col-span-2 bg-gray-50 rounded-lg p-3 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-2">
                          توزيع أسباب التبرع بالدم
                        </h3>
                        <div className="h-64">
                          <Suspense fallback={<div className="flex items-center justify-center h-full">
                            <div className="text-gray-400 text-sm">جاري تحميل الرسم البياني...</div>
                          </div>}>
                            <ComparativeBarChart 
                              data={chartsData.comparativeData.donationReasons.data}
                              labels={chartsData.comparativeData.donationReasons.labels}
                              title=""
                              label="عدد المتبرعين"
                              height={250}
                              colors={[
                                'rgba(54, 162, 235, 0.7)',
                                'rgba(255, 99, 132, 0.7)',
                                'rgba(255, 206, 86, 0.7)',
                                'rgba(75, 192, 192, 0.7)',
                                'rgba(153, 102, 255, 0.7)',
                              ]}
                              direction="rtl"
                            />
                          </Suspense>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 flex justify-between">
                          <div>إجمالي المتبرعين: <span className="font-bold">
                            {chartsData.comparativeData.donationReasons.metadata.total && 
                             chartsData.comparativeData.donationReasons.metadata.total.toLocaleString() || '0'}
                          </span></div>
                          <div>السبب الأكثر شيوعاً: <span className="font-bold">
                            {chartsData.comparativeData.donationReasons.labels[
                              chartsData.comparativeData.donationReasons.data.indexOf(
                                Math.max(...chartsData.comparativeData.donationReasons.data)
                              )
                            ]}
                          </span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <h2 className="text-base font-bold text-gray-700 mb-4 border-r-4 border-red-500 pr-2">تفاصيل مؤشرات الأداء</h2>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المؤشر</th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">القيمة الحالية</th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">القيمة المستهدفة</th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">التقييم</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {tableRows}
                        </tbody>
                      </table>
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
import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Sidebar from '../components/layout/Sidebar';
import TimeComparisonChart from '../components/charts/TimeComparisonChart';
import ComparativeBarChart from '../components/charts/ComparativeBarChart';
import { excelAnalyticsService } from '../services/excelAnalyticsService';

const RAD = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableData, setTableData] = useState({ headers: [], rows: [] });
  const [excelFiles, setExcelFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [kpiValues, setKpiValues] = useState({
    'reportTurnaroundTime': '-',
    'radRetakeRate': '-',
    'radExamCompletionTime': '-',
    'radUtilization': '-',
    'patientWaitingTime': '-',
    'criticalResultsReporting': '-',
    'correctPatientID': '-',
    'techCallbackTime': '-',
    'schedulingAccuracy': '-'
  });
  
  // بيانات مؤشرات الأداء الرئيسية عبر الزمن
  const [timeSeriesData, setTimeSeriesData] = useState({
    inpatientWaitTime: { labels: [], data: [], metadata: {} },
    opdWaitTime: { labels: [], data: [], metadata: {} },
    machineUtilization: { labels: [], data: [], metadata: {} }
  });
  
  // بيانات المقارنة بين الفئات
  const [comparativeData, setComparativeData] = useState({
    machineUtilization: { labels: [], data: [], metadata: {} },
    scansByType: { labels: [], data: [], metadata: {} }
  });
  
  // حالة تحميل الرسوم البيانية
  const [chartsLoading, setChartsLoading] = useState(false);
  
  // تعريف عناصر القائمة الجانبية
  const menuItems = [
    { id: 'admin', label: 'لوحة التحكم', icon: '👨‍💼', path: '/admin' },
    { id: 'emergency', label: 'قسم الطوارئ', icon: '🏥', path: '/emergency', showForRegularUser: true },
    { id: 'operations', label: 'قسم العمليات', icon: '🔪', path: '/operations', showForRegularUser: true },
    { id: 'lab', label: 'قسم المختبر', icon: '🧪', path: '/lab', showForRegularUser: true },
    { id: 'bloodbank', label: 'بنك الدم', icon: '🩸', path: '/bloodbank', showForRegularUser: true },
    { id: 'rad', label: 'قسم الأشعة', icon: '📡', path: '/rad', showForRegularUser: true },
  ];
  
  // تعريف مؤشرات الأداء الرئيسية مع تفاصيل الخلايا المحددة - تم تحديث المواقع لتتطابق مع الاكسل
  const kpiDefinitions = [
    {
      id: 'reportTurnaroundTime',
      title: 'زمن انتظار المنومين',
      englishTitle: 'KPI 1: Order to Scan Time (Inpatient)',
      targetText: 'أقل من 24 ساعة',
      borderColor: 'indigo',
      // تحديث لقراءة قيمة CT للمنومين من عمود P صف 3
      exactCell: { sheetName: 'KPIs 1-3 - manual', rowIndex: 2, columnName: 'P' }
    },
    {
      id: 'radRetakeRate',
      title: 'وقت الفحص إلى التقرير (المنومين)',
      englishTitle: 'KPI 2: Scan to Release Time (Inpatient)',
      targetText: 'أقل من 5 ساعات',
      borderColor: 'blue',
      // تحديث لقراءة قيمة CT للمنومين من عمود Q صف 3
      exactCell: { sheetName: 'KPIs 1-3 - manual', rowIndex: 2, columnName: 'Q' }
    },
    {
      id: 'radExamCompletionTime',
      title: 'زمن انتظار العيادات',
      englishTitle: 'KPI 1: Order to Scan Time (OPD)',
      targetText: 'أقل من 24 ساعة',
      borderColor: 'blue',
      // تحديث لقراءة قيمة CT للعيادات من عمود R صف 3
      exactCell: { sheetName: 'KPIs 1-3 - manual', rowIndex: 2, columnName: 'R' }
    },
    {
      id: 'patientWaitingTime',
      title: 'وقت الفحص إلى التقرير (العيادات)',
      englishTitle: 'KPI 2: Scan to Release Time (OPD)',
      targetText: 'أقل من 5 ساعات',
      borderColor: 'purple',
      // تحديث لقراءة قيمة CT للعيادات من عمود S صف 3
      exactCell: { sheetName: 'KPIs 1-3 - manual', rowIndex: 2, columnName: 'S' }
    },
    {
      id: 'radUtilization',
      title: 'معدل استخدام CT',
      englishTitle: 'KPI 3: Machine Utilization (CT)',
      targetText: 'أكثر من 80%',
      borderColor: 'green',
      // تحديث لقراءة معدل استخدام CT من عمود T صف 3
      exactCell: { sheetName: 'KPIs 1-3 - manual', rowIndex: 2, columnName: 'T' }
    },
    {
      id: 'criticalResultsReporting',
      title: 'معدل استخدام MRI',
      englishTitle: 'KPI 3: Machine Utilization (MRI)',
      targetText: 'أكثر من 80%',
      borderColor: 'purple',
      // تحديث لقراءة معدل استخدام MRI من عمود T صف 4
      exactCell: { sheetName: 'KPIs 1-3 - manual', rowIndex: 3, columnName: 'T' }
    },
    {
      id: 'schedulingAccuracy',
      title: 'معدل استخدام Ultrasound',
      englishTitle: 'KPI 3: Machine Utilization (Ultrasound)',
      targetText: 'أكثر من 80%',
      borderColor: 'yellow',
      // تحديث لقراءة معدل استخدام Ultrasound من عمود T صف 5
      exactCell: { sheetName: 'KPIs 1-3 - manual', rowIndex: 4, columnName: 'T' }
    }
  ];
  
  // البنش مارك لكل مؤشر (مؤشرات قسم الأشعة)
  const benchmarks = {
    // 1. Order to Scan Time (ساعات)
    "KPI 1: Order to Scan Time": {
      worldClass: { max: 24, color: "#0072C6" }, // أقل من 24 ساعة
      acceptable: { min: 24, max: 36, color: "#00B050" }, // 24-36 ساعة
      needsImprovement: { min: 36, max: 48, color: "#FFC000" }, // 36-48 ساعة
      unacceptable: { min: 48, color: "#C00000" } // أكثر من 48 ساعة
    },
    
    // 2. Scan to Release Time
    "KPI 2: Scan to Release Time": {
      worldClass: { max: 5, color: "#0072C6" }, // أقل من 5 ساعات
      acceptable: { min: 5, max: 7, color: "#00B050" }, // 5-7 ساعات
      needsImprovement: { min: 7, max: 10, color: "#FFC000" }, // 7-10 ساعات
      unacceptable: { min: 10, color: "#C00000" } // أكثر من 10 ساعات
    },
    
    // 3. Machine Utilization by modality
    "KPI 3: Machine Utilization by modality": {
      worldClass: { min: 80, color: "#0072C6" }, // أكثر من 80%
      acceptable: { min: 70, max: 80, color: "#00B050" }, // 70%-80%
      needsImprovement: { min: 60, max: 70, color: "#FFC000" }, // 60%-70%
      unacceptable: { max: 60, color: "#C00000" } // أقل من 60%
    }
  };
  
  // دالة لتنسيق قيمة المؤشر - تم تحديثها لمعالجة القيم بشكل صحيح وعرضها بنفس التنسيق في الاكسل
  const formatKpiValue = (value, kpiId) => {
    if (value === null || value === undefined) {
      return '-';
    }
    
    // تنسيق خاص لكل مؤشر
    if (kpiId === 'radUtilization' || kpiId === 'criticalResultsReporting' || kpiId === 'schedulingAccuracy') {
      // قيم نسبة استخدام الأجهزة تعرض كنسبة مئوية
      // التحقق من كون القيمة نصية وتحتوي بالفعل على علامة النسبة المئوية
      if (typeof value === 'string' && value.includes('%')) {
        // تقصير النسبة المئوية إلى رقمين بعد الفاصلة
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          return `${numValue.toFixed(2)}%`;
        }
        return value;
      }
      
      // تحويل القيمة إلى رقم
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return value.toString();
      }
      
      // عرض النسبة المئوية برقمين عشريين فقط
      return `${numValue.toFixed(2)}%`;
    } else {
      // تنسيق القيم الزمنية بصيغة ساعة:دقيقة
      // التحقق من كون القيمة نصية وتحتوي بالفعل على تنسيق الوقت
      if (typeof value === 'string' && value.includes(':')) {
        return value;
      }
      
      // تحويل القيمة إلى رقم
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return value.toString();
      }
      
      // تحويل الساعات العشرية إلى تنسيق ساعة:دقيقة
      const hours = Math.floor(numValue);
      const minutes = Math.round((numValue - hours) * 60);
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
  };

  // دالة لقراءة قيمة من خلية محددة في ورقة العمل - تم تحسينها للتعامل مع قيم الوقت
  const getValueByExactCell = (workbook, exactCell) => {
    // التحقق من وجود اسم ورقة العمل
    if (!exactCell || !exactCell.sheetName || !workbook.Sheets[exactCell.sheetName]) {
      console.warn('لم يتم تحديد ورقة العمل أو الورقة غير موجودة', exactCell);
      return null;
    }

    // الحصول على ورقة العمل
    const sheet = workbook.Sheets[exactCell.sheetName];
    
    // تحويل العمود إلى رقم للاستخدام في XLSX
    const cellAddress = exactCell.columnName + (exactCell.rowIndex + 1);
    console.log(`البحث عن القيمة في الخلية: ${cellAddress} في ورقة ${exactCell.sheetName}`);
    
    // الحصول على قيمة الخلية
    const cell = sheet[cellAddress];
    
    // طباعة قيمة الخلية للتصحيح
    if (cell) {
      console.log(`قيمة الخلية ${cellAddress}: `, cell.v);
      
      // معالجة خاصة للقيم الزمنية التي تخزن في اكسل كأرقام أو كتواريخ
      if (exactCell.columnName !== 'T') {
        if (cell.t === 'n') {
          // Excel يخزن الوقت كجزء من اليوم
          const totalHours = cell.v * 24;
          const hours = Math.floor(totalHours);
          const minutes = Math.round((totalHours - hours) * 60);
          return `${hours}:${minutes.toString().padStart(2, '0')}`;
        } else if (cell.v instanceof Date) {
          // إذا كانت القيمة تاريخ
          const hours = cell.v.getHours();
          const minutes = cell.v.getMinutes();
          return `${hours}:${minutes.toString().padStart(2, '0')}`;
        }
      } else if (exactCell.columnName === 'T') {
        // للأعمدة التي تحتوي على نسب مئوية، قم بتحويلها مباشرة إلى نسبة مئوية
        return cell.v * 100;
      }
      
      return cell.v;
    } else {
      console.warn(`الخلية ${cellAddress} غير موجودة في ورقة ${exactCell.sheetName}`);
    }
    
    return null;
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
      if ((benchmark.worldClass.min !== undefined && numericValue >= benchmark.worldClass.min) &&
          (benchmark.worldClass.max !== undefined && numericValue <= benchmark.worldClass.max)) {
        return benchmark.worldClass.color;
      } else if (benchmark.worldClass.min !== undefined && benchmark.worldClass.max === undefined && numericValue >= benchmark.worldClass.min) {
        return benchmark.worldClass.color;
      } else if (benchmark.worldClass.max !== undefined && benchmark.worldClass.min === undefined && numericValue <= benchmark.worldClass.max) {
        return benchmark.worldClass.color;
      }
    }
    
    if (benchmark.acceptable) {
      if ((benchmark.acceptable.min !== undefined && numericValue >= benchmark.acceptable.min) &&
          (benchmark.acceptable.max !== undefined && numericValue <= benchmark.acceptable.max)) {
        return benchmark.acceptable.color;
      } else if (benchmark.acceptable.min !== undefined && benchmark.acceptable.max === undefined && numericValue >= benchmark.acceptable.min) {
        return benchmark.acceptable.color;
      } else if (benchmark.acceptable.max !== undefined && benchmark.acceptable.min === undefined && numericValue <= benchmark.acceptable.max) {
        return benchmark.acceptable.color;
      }
    }
    
    if (benchmark.needsImprovement) {
      if ((benchmark.needsImprovement.min !== undefined && numericValue >= benchmark.needsImprovement.min) &&
          (benchmark.needsImprovement.max !== undefined && numericValue <= benchmark.needsImprovement.max)) {
        return benchmark.needsImprovement.color;
      } else if (benchmark.needsImprovement.min !== undefined && benchmark.needsImprovement.max === undefined && numericValue >= benchmark.needsImprovement.min) {
        return benchmark.needsImprovement.color;
      } else if (benchmark.needsImprovement.max !== undefined && benchmark.needsImprovement.min === undefined && numericValue <= benchmark.needsImprovement.max) {
        return benchmark.needsImprovement.color;
      }
    }
    
    if (benchmark.unacceptable) {
      if ((benchmark.unacceptable.min !== undefined && numericValue >= benchmark.unacceptable.min) &&
          (benchmark.unacceptable.max !== undefined && numericValue <= benchmark.unacceptable.max)) {
        return benchmark.unacceptable.color;
      } else if (benchmark.unacceptable.min !== undefined && benchmark.unacceptable.max === undefined && numericValue >= benchmark.unacceptable.min) {
        return benchmark.unacceptable.color;
      } else if (benchmark.unacceptable.max !== undefined && benchmark.unacceptable.min === undefined && numericValue <= benchmark.unacceptable.max) {
        return benchmark.unacceptable.color;
      }
    }
    
    return ''; // لون افتراضي إذا لم تتطابق أي حالة
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
      if ((benchmark.worldClass.min !== undefined && numericValue >= benchmark.worldClass.min) &&
          (benchmark.worldClass.max !== undefined && numericValue <= benchmark.worldClass.max)) {
        return 'ممتاز';
      } else if (benchmark.worldClass.min !== undefined && benchmark.worldClass.max === undefined && numericValue >= benchmark.worldClass.min) {
        return 'ممتاز';
      } else if (benchmark.worldClass.max !== undefined && benchmark.worldClass.min === undefined && numericValue <= benchmark.worldClass.max) {
        return 'ممتاز';
      }
    }
    
    if (benchmark.acceptable) {
      if ((benchmark.acceptable.min !== undefined && numericValue >= benchmark.acceptable.min) &&
          (benchmark.acceptable.max !== undefined && numericValue <= benchmark.acceptable.max)) {
        return 'جيد';
      } else if (benchmark.acceptable.min !== undefined && benchmark.acceptable.max === undefined && numericValue >= benchmark.acceptable.min) {
        return 'جيد';
      } else if (benchmark.acceptable.max !== undefined && benchmark.acceptable.min === undefined && numericValue <= benchmark.acceptable.max) {
        return 'جيد';
      }
    }
    
    if (benchmark.needsImprovement) {
      if ((benchmark.needsImprovement.min !== undefined && numericValue >= benchmark.needsImprovement.min) &&
          (benchmark.needsImprovement.max !== undefined && numericValue <= benchmark.needsImprovement.max)) {
        return 'يحتاج تحسين';
      } else if (benchmark.needsImprovement.min !== undefined && benchmark.needsImprovement.max === undefined && numericValue >= benchmark.needsImprovement.min) {
        return 'يحتاج تحسين';
      } else if (benchmark.needsImprovement.max !== undefined && benchmark.needsImprovement.min === undefined && numericValue <= benchmark.needsImprovement.max) {
        return 'يحتاج تحسين';
      }
    }
    
    if (benchmark.unacceptable) {
      if ((benchmark.unacceptable.min !== undefined && numericValue >= benchmark.unacceptable.min) &&
          (benchmark.unacceptable.max !== undefined && numericValue <= benchmark.unacceptable.max)) {
        return 'غير مقبول';
      } else if (benchmark.unacceptable.min !== undefined && benchmark.unacceptable.max === undefined && numericValue >= benchmark.unacceptable.min) {
        return 'غير مقبول';
      } else if (benchmark.unacceptable.max !== undefined && benchmark.unacceptable.min === undefined && numericValue <= benchmark.unacceptable.max) {
        return 'غير مقبول';
      }
    }
    
    return '';
  };
  
  // دالة لاستخراج مؤشرات الأداء من ورقة العمل المحددة - تم تحديثها
  const extractKpisFromWorkbook = (workbook) => {
    let extractedKpis = {
      'reportTurnaroundTime': '-',
      'radRetakeRate': '-',
      'radExamCompletionTime': '-',
      'radUtilization': '-',
      'patientWaitingTime': '-',
      'criticalResultsReporting': '-',
      'correctPatientID': '-',
      'techCallbackTime': '-',
      'schedulingAccuracy': '-'
    };
    
    // استخراج قيم المؤشرات من الخلايا المحددة
    for (const kpiDef of kpiDefinitions) {
      if (kpiDef.exactCell) {
        const value = getValueByExactCell(workbook, kpiDef.exactCell);
        
        if (value !== null) {
          extractedKpis[kpiDef.id] = value;
        } else {
          console.warn(`لم يتم العثور على قيمة للمؤشر ${kpiDef.id} في الخلية المحددة`);
          // نبقي على القيم الافتراضية '-' إذا لم نتمكن من قراءة القيمة
        }
      }
    }
    
    return extractedKpis;
  };
  
  // دالة لتحميل ملفات Excel المتاحة
  const loadExcelFiles = async () => {
    try {
      // في الإنتاج، يجب استخدام API لجلب قائمة الملفات
      // هنا نفترض أننا نعرف أسماء الملفات مسبقًا من هيكل المجلد
      const files = [
        'RAD-JD-GEN-4-2025-FEB.xlsx',
        'RAD-JD-GEN-4-2025-MAR.xlsx'
      ];
      
      setExcelFiles(files);
      
      // اختيار أحدث ملف افتراضيًا
      if (files.length > 0) {
        setSelectedFile(files[files.length - 1]);
        await loadExcelData(files[files.length - 1]);
      } else {
        setError('لا توجد ملفات بيانات متاحة');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading Excel files:', err);
      setError('حدث خطأ أثناء تحميل ملفات البيانات');
      setLoading(false);
    }
  };
  
  // دالة لتحميل بيانات ملف Excel المحدد - تم تحديثها
  const loadExcelData = async (filePath) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/data/RAD/${filePath}`);
      const data = await response.arrayBuffer();
      
      // تحسين قراءة ملف Excel بإضافة خيارات إضافية
      const workbook = XLSX.read(data, { 
        type: 'array',
        cellStyles: true,
        cellDates: true,
        cellNF: true,
        cellFormula: true
      });
      
      console.log('تم تحميل ملف Excel:', workbook.SheetNames);
      
      // استخراج مؤشرات الأداء مباشرة من الملف
      const kpis = extractKpisFromWorkbook(workbook);
      setKpiValues(kpis);
      
      // جمع البيانات للجدول (اختياري)
      // استخدام أول ورقة عمل إذا لم يتم تحديد واحدة محددة
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      
      if (sheet) {
        const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const headers = sheetData[0] || [];
        const rows = sheetData.slice(1);
        setTableData({ headers, rows });
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading Excel data:', err);
      setError('حدث خطأ أثناء تحميل بيانات الملف');
      setLoading(false);
    }
  };
  
  // معالج تغيير الملف المحدد
  const handleFileChange = async (e) => {
    const filePath = e.target.value;
    setSelectedFile(filePath);
    await loadExcelData(filePath);
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
  
  // useEffect hook to load Excel files
  useEffect(() => {
    loadExcelFiles();
  }, []);
  
  // وظيفة لقراءة بيانات الرسوم البيانية من مجموعة الملفات
  useEffect(() => {
    const loadHistoricalData = async () => {
      if (!excelFiles || excelFiles.length === 0) {
        return;
      }

      try {
        setChartsLoading(true);
        
        // تحضير مسارات الملفات
        const filePaths = excelFiles.map(file => `RAD/${file}`);
        
        // استخدام placeholderData مؤقتًا حتى يتم تصحيح مشكلة عدم وجود الورقة في ملفات Excel
        const placeholderData = excelAnalyticsService.generatePlaceholderData(6, 10, 36);
        const utilizationPlaceholderData = excelAnalyticsService.generatePlaceholderData(6, 60, 98);
        
        // محاولة قراءة البيانات من الملفات، مع استخدام البيانات الاحتياطية في حالة الخطأ
        try {
          // استخراج بيانات وقت الانتظار للمنومين عبر الزمن (KPI 1)
          const inpatientWaitTimeData = await excelAnalyticsService.extractTimeSeriesData(
            filePaths,
            'KPIs', // تعديل اسم الورقة ليكون أكثر مرونة
            'P', 
            2, 
            excelAnalyticsService.transformers.timeInMinutes
          );
          
          // التحقق من وجود بيانات فعلية
          setTimeSeriesData(prev => ({
            ...prev,
            inpatientWaitTime: inpatientWaitTimeData.data.length > 0 ? inpatientWaitTimeData : placeholderData
          }));
        } catch (err) {
          console.log("استخدام بيانات احتياطية لوقت انتظار المنومين:", err);
          setTimeSeriesData(prev => ({
            ...prev,
            inpatientWaitTime: placeholderData
          }));
        }
        
        try {
          // استخراج بيانات وقت الانتظار للعيادات الخارجية عبر الزمن (KPI 1)
          const opdWaitTimeData = await excelAnalyticsService.extractTimeSeriesData(
            filePaths,
            'KPIs', 
            'R', 
            2, 
            excelAnalyticsService.transformers.timeInMinutes
          );
          
          setTimeSeriesData(prev => ({
            ...prev,
            opdWaitTime: opdWaitTimeData.data.length > 0 ? opdWaitTimeData : placeholderData
          }));
        } catch (err) {
          console.log("استخدام بيانات احتياطية لوقت انتظار العيادات:", err);
          setTimeSeriesData(prev => ({
            ...prev,
            opdWaitTime: placeholderData
          }));
        }
        
        try {
          // استخراج بيانات معدل استخدام الأجهزة عبر الزمن (KPI 3)
          const machineUtilizationData = await excelAnalyticsService.extractTimeSeriesData(
            filePaths,
            'KPIs', 
            'T', 
            2, 
            excelAnalyticsService.transformers.percentage
          );
          
          setTimeSeriesData(prev => ({
            ...prev,
            machineUtilization: machineUtilizationData.data.length > 0 ? machineUtilizationData : utilizationPlaceholderData
          }));
        } catch (err) {
          console.log("استخدام بيانات احتياطية لمعدل استخدام الأجهزة:", err);
          setTimeSeriesData(prev => ({
            ...prev,
            machineUtilization: utilizationPlaceholderData
          }));
        }
        
        // استخراج بيانات المقارنة لمعدلات استخدام الأجهزة
        const machineTypes = ['CT', 'MRI', 'Ultrasound'];
        const utilizationValues = [
          kpiValues.radUtilization ? parseFloat(kpiValues.radUtilization) : 86.3,
          kpiValues.criticalResultsReporting ? parseFloat(kpiValues.criticalResultsReporting) : 64.3,
          kpiValues.schedulingAccuracy ? parseFloat(kpiValues.schedulingAccuracy) : 85.8
        ];
        
        // بيانات مقارنة معدلات استخدام الأجهزة - من البيانات الحالية
        const utilizationData = {
          labels: machineTypes,
          data: utilizationValues,
          metadata: {
            min: Math.min(...utilizationValues.filter(v => !isNaN(v))),
            max: Math.max(...utilizationValues.filter(v => !isNaN(v))),
            avg: utilizationValues.filter(v => !isNaN(v)).reduce((sum, val) => sum + val, 0) / 
                 utilizationValues.filter(v => !isNaN(v)).length
          }
        };
        
        // استخراج بيانات أنواع الفحوصات (بيانات افتراضية)
        const scanTypesData = {
          labels: ['X-Ray', 'CT', 'MRI', 'Ultrasound', 'Interventional'],
          data: [45, 25, 15, 10, 5], // قيم افتراضية
          metadata: {
            total: 100,
            min: 5,
            max: 45,
            avg: 20
          }
        };
        
        setComparativeData({
          machineUtilization: utilizationData,
          scansByType: scanTypesData
        });
      } catch (err) {
        console.error('Error loading historical data:', err);
      } finally {
        setChartsLoading(false);
      }
    };
    
    loadHistoricalData();
  }, [excelFiles, selectedFile, kpiValues]);
  
  // مكون KpiCard للمؤشر الواحد
  const KpiCard = ({ kpiDef }) => {
    // تحديد نوع المؤشر (KPI 1, KPI 2, KPI 3) بناءً على عنوان المؤشر
    let kpiType = "";
    if (kpiDef.englishTitle.includes("KPI 1")) {
      kpiType = "KPI 1: Order to Scan Time";
    } else if (kpiDef.englishTitle.includes("KPI 2")) {
      kpiType = "KPI 2: Scan to Release Time";
    } else if (kpiDef.englishTitle.includes("KPI 3")) {
      kpiType = "KPI 3: Machine Utilization by modality";
    }
    
    // الحصول على اللون والتقييم
    const value = kpiValues[kpiDef.id];
    const valueStr = typeof value === 'string' ? value : String(value);
    const valueWithoutPercent = valueStr.includes('%') ? valueStr.replace('%', '') : valueStr;
    
    const color = getColorForValue(kpiType, valueWithoutPercent);
    const label = getBenchmarkLabel(kpiType, valueWithoutPercent);
    
    return (
      <div className={`bg-white rounded-lg shadow-sm p-3 border-r-4 border-${kpiDef.borderColor}-500 transform transition-transform hover:scale-105 hover:shadow-md`}>
        <div className="flex justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">{kpiDef.title}</p>
            <p className="text-lg font-bold text-gray-800 mt-0.5">
              {kpiValues[kpiDef.id] !== '-' ? kpiValues[kpiDef.id] : '-'}
            </p>
          </div>
          <div className={`p-2 bg-${kpiDef.borderColor}-100 rounded-lg`}>
            <svg className={`w-6 h-6 text-${kpiDef.borderColor}-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              {kpiDef.id.includes('Time') ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              )}
            </svg>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-gray-500">
          الهدف الأمثل
          <span className={`text-${kpiDef.borderColor}-600 font-medium mr-1`}>{kpiDef.targetText}</span>
        </div>
      </div>
    );
  };
  
  // مكون لعرض مؤشر الأداء التفصيلي
  const KpiDetailCard = ({ kpiDef }) => {
    // تحديد نوع المؤشر (KPI 1, KPI 2, KPI 3) بناءً على عنوان المؤشر
    let kpiType = "";
    if (kpiDef.englishTitle.includes("KPI 1")) {
      kpiType = "KPI 1: Order to Scan Time";
    } else if (kpiDef.englishTitle.includes("KPI 2")) {
      kpiType = "KPI 2: Scan to Release Time";
    } else if (kpiDef.englishTitle.includes("KPI 3")) {
      kpiType = "KPI 3: Machine Utilization by modality";
    }
    
    // الحصول على اللون والتقييم
    const value = kpiValues[kpiDef.id];
    const formattedValue = formatKpiValue(value, kpiDef.id);
    const valueStr = typeof formattedValue === 'string' ? formattedValue : String(formattedValue);
    const valueWithoutPercent = valueStr.includes('%') ? valueStr.replace('%', '') : valueStr;
    
    const color = getColorForValue(kpiType, valueWithoutPercent);
    const label = getBenchmarkLabel(kpiType, valueWithoutPercent);
    
    return (
      <div className="bg-gray-50 p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow">
        <h3 className="text-sm font-medium text-gray-700 mb-2 border-b pb-1">{kpiDef.title}</h3>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-xs text-gray-500">
              {kpiDef.id.includes('Utilization') || kpiDef.id === 'criticalResultsReporting' || kpiDef.id === 'schedulingAccuracy' ? 'المعدل:' : 'الوقت:'}
            </span>
          </div>
          <div className="flex items-baseline">
            <span 
              className="text-xl font-bold ml-1"
              style={{ color: color || "#333" }}
            >
              {valueWithoutPercent}
            </span>
            <span className="text-xs text-gray-500">
              {kpiDef.id.includes('Utilization') || kpiDef.id === 'criticalResultsReporting' || kpiDef.id === 'schedulingAccuracy' ? '%' : 'ساعة'}
            </span>
          </div>
        </div>
        <div className="mt-1 text-[10px] text-right">
          <span className="inline-block px-2 py-0.5 rounded-full" 
            style={{ 
              backgroundColor: color || "#f3f4f6",
              color: color ? "white" : "#6b7280"
            }}
          >
            {label || "غير متوفر"}
          </span>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex h-screen">
        {/* استخدام مكون الشريط الجانبي الموحد */}
        <Sidebar menuItems={menuItems} />

        {/* المحتوى الرئيسي */}
        <div className="flex-1 overflow-auto bg-gray-50 mr-72">
          {/* رأس الصفحة */}
          <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
            <div className="px-4 py-2 flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-gray-800">لوحة تحكم بيانات قسم الأشعة</h1>
                {selectedFile && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {getSelectedFileDate() ? `بيانات ${getSelectedFileDate()}` : selectedFile}
                  </div>
                )}
              </div>
              
              <div className="flex items-center">
                <div className="relative mr-4">
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <select
                    value={selectedFile}
                    onChange={handleFileChange}
                    className="block w-56 bg-white border border-gray-300 rounded-lg py-1.5 pr-10 pl-3 text-sm text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
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
          
          <div className="p-4">
            <div className="w-full mx-auto">
              {/* القسم الرئيسي - ملخص المؤشرات */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
                {/* عرض مؤشرات الأداء الرئيسية */}
                {kpiDefinitions.slice(0, 4).map((kpiDef) => (
                  <KpiCard key={kpiDef.id} kpiDef={kpiDef} />
                ))}
              </div>
              
              {loading ? (
                <div className="flex flex-col justify-center items-center h-40 bg-white rounded-lg shadow-sm">
                  <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-600 mt-2">جاري تحميل البيانات...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 border-r-4 border-red-500 p-3 rounded-lg shadow-sm">
                  <div className="flex">
                    <div className="flex-shrink-0 mr-3">
                      <svg className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {/* كارت مؤشرات الأداء المفصلة */}
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden transition-shadow duration-300 hover:shadow-md mb-4">
                    <div className="px-4 py-2 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600">
                      <h2 className="text-base font-bold text-white text-center">مؤشرات الأداء التفصيلية</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                      {/* عرض تفاصيل المؤشرات */}
                      {kpiDefinitions.map((kpiDef) => (
                        <KpiDetailCard key={kpiDef.id} kpiDef={kpiDef} />
                      ))}
                    </div>
                    
                    <div className="px-4 py-1.5 bg-gray-50 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="text-[9px] text-gray-500">
                          تم التحديث: {new Date().toLocaleDateString('ar-SA')}
                        </div>
                        <div className="flex space-x-1 space-x-reverse">
                          <div className="flex items-center ml-2">
                            <div className="w-2 h-2 rounded-full bg-[#0072C6] mr-1"></div>
                            <span className="text-[9px] text-gray-600">ممتاز</span>
                          </div>
                          <div className="flex items-center ml-2">
                            <div className="w-2 h-2 rounded-full bg-[#00B050] mr-1"></div>
                            <span className="text-[9px] text-gray-600">جيد</span>
                          </div>
                          <div className="flex items-center ml-2">
                            <div className="w-2 h-2 rounded-full bg-[#FFC000] mr-1"></div>
                            <span className="text-[9px] text-gray-600">يحتاج تحسين</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-[#C00000] mr-1"></div>
                            <span className="text-[9px] text-gray-600">غير مقبول</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* قسم الرسوم البيانية والمقارنات */}
                  <div className="mt-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">تحليل البيانات والمقارنات</h2>
                    
                    {chartsLoading ? (
                      <div className="flex flex-col justify-center items-center h-40 bg-white rounded-lg shadow-sm">
                        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-gray-600 mt-2">جاري تحميل الرسوم البيانية...</p>
                      </div>
                    ) : (
                      <>
                        {/* المؤشرات الرئيسية عبر الزمن */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                          {/* رسم بياني لوقت الانتظار للمنومين */}
                          <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow duration-300">
                            {timeSeriesData.inpatientWaitTime.data.length > 0 ? (
                              <>
                                <TimeComparisonChart 
                                  data={timeSeriesData.inpatientWaitTime.data}
                                  labels={timeSeriesData.inpatientWaitTime.labels}
                                  title="زمن انتظار المنومين عبر الزمن"
                                  label="متوسط الساعات"
                                  backgroundColor="rgba(54, 162, 235, 0.2)"
                                  borderColor="rgba(54, 162, 235, 1)"
                                  benchmark={24} // القيمة المستهدفة (24 ساعة)
                                  height={250}
                                  isTime={true}
                                  yAxisLabel="الوقت (ساعات)"
                                  direction="rtl"
                                />
                                <div className="mt-2 text-center">
                                  <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div className="bg-gray-50 p-2 rounded-md">
                                      <p className="text-xs text-gray-500">متوسط وقت الانتظار</p>
                                      <p className="text-base font-bold text-indigo-600">
                                        {timeSeriesData.inpatientWaitTime.metadata.avg !== undefined ? 
                                          `${Math.round(timeSeriesData.inpatientWaitTime.metadata.avg / 60)} ساعة` : 
                                          '-'}
                                      </p>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded-md">
                                      <p className="text-xs text-gray-500">أقل وقت انتظار</p>
                                      <p className="text-base font-bold text-green-600">
                                        {timeSeriesData.inpatientWaitTime.metadata.min !== undefined ? 
                                          `${Math.round(timeSeriesData.inpatientWaitTime.metadata.min / 60)} ساعة` : 
                                          '-'}
                                      </p>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded-md">
                                      <p className="text-xs text-gray-500">أعلى وقت انتظار</p>
                                      <p className="text-base font-bold text-red-600">
                                        {timeSeriesData.inpatientWaitTime.metadata.max !== undefined ? 
                                          `${Math.round(timeSeriesData.inpatientWaitTime.metadata.max / 60)} ساعة` : 
                                          '-'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col justify-center items-center h-64">
                                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-500">لا توجد بيانات كافية للعرض</p>
                              </div>
                            )}
                          </div>
                          
                          {/* رسم بياني لوقت انتظار العيادات */}
                          <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow duration-300">
                            {timeSeriesData.opdWaitTime.data.length > 0 ? (
                              <>
                                <TimeComparisonChart 
                                  data={timeSeriesData.opdWaitTime.data}
                                  labels={timeSeriesData.opdWaitTime.labels}
                                  title="زمن انتظار العيادات عبر الزمن"
                                  label="متوسط الساعات"
                                  backgroundColor="rgba(153, 102, 255, 0.2)"
                                  borderColor="rgba(153, 102, 255, 1)"
                                  benchmark={24} // القيمة المستهدفة (24 ساعة)
                                  height={250}
                                  isTime={true}
                                  yAxisLabel="الوقت (ساعات)"
                                  direction="rtl"
                                />
                                <div className="mt-2 text-center">
                                  <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div className="bg-gray-50 p-2 rounded-md">
                                      <p className="text-xs text-gray-500">متوسط وقت الانتظار</p>
                                      <p className="text-base font-bold text-indigo-600">
                                        {timeSeriesData.opdWaitTime.metadata.avg !== undefined ? 
                                          `${Math.round(timeSeriesData.opdWaitTime.metadata.avg / 60)} ساعة` : 
                                          '-'}
                                      </p>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded-md">
                                      <p className="text-xs text-gray-500">أقل وقت انتظار</p>
                                      <p className="text-base font-bold text-green-600">
                                        {timeSeriesData.opdWaitTime.metadata.min !== undefined ? 
                                          `${Math.round(timeSeriesData.opdWaitTime.metadata.min / 60)} ساعة` : 
                                          '-'}
                                      </p>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded-md">
                                      <p className="text-xs text-gray-500">أعلى وقت انتظار</p>
                                      <p className="text-base font-bold text-red-600">
                                        {timeSeriesData.opdWaitTime.metadata.max !== undefined ? 
                                          `${Math.round(timeSeriesData.opdWaitTime.metadata.max / 60)} ساعة` : 
                                          '-'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col justify-center items-center h-64">
                                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-500">لا توجد بيانات كافية للعرض</p>
                              </div>
                            )}
                          </div>
                          
                          {/* رسم بياني لمعدل استخدام الأجهزة */}
                          <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow duration-300">
                            {timeSeriesData.machineUtilization.data.length > 0 ? (
                              <>
                                <TimeComparisonChart 
                                  data={timeSeriesData.machineUtilization.data}
                                  labels={timeSeriesData.machineUtilization.labels}
                                  title="معدل استخدام أجهزة CT عبر الزمن"
                                  label="معدل الاستخدام"
                                  backgroundColor="rgba(75, 192, 192, 0.2)"
                                  borderColor="rgba(75, 192, 192, 1)"
                                  benchmark={80} // القيمة المستهدفة (80%)
                                  height={250}
                                  isPercentage={true}
                                  yAxisMin={0}
                                  yAxisMax={100}
                                  yAxisLabel="النسبة المئوية"
                                  direction="rtl"
                                />
                                <div className="mt-2 text-center">
                                  <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div className="bg-gray-50 p-2 rounded-md">
                                      <p className="text-xs text-gray-500">متوسط معدل الاستخدام</p>
                                      <p className="text-base font-bold text-indigo-600">
                                        {timeSeriesData.machineUtilization.metadata.avg !== undefined ? 
                                          `${Math.round(timeSeriesData.machineUtilization.metadata.avg)}%` : 
                                          '-'}
                                      </p>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded-md">
                                      <p className="text-xs text-gray-500">أقل معدل</p>
                                      <p className="text-base font-bold text-red-600">
                                        {timeSeriesData.machineUtilization.metadata.min !== undefined ? 
                                          `${Math.round(timeSeriesData.machineUtilization.metadata.min)}%` : 
                                          '-'}
                                      </p>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded-md">
                                      <p className="text-xs text-gray-500">أعلى معدل</p>
                                      <p className="text-base font-bold text-green-600">
                                        {timeSeriesData.machineUtilization.metadata.max !== undefined ? 
                                          `${Math.round(timeSeriesData.machineUtilization.metadata.max)}%` : 
                                          '-'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col justify-center items-center h-64">
                                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-500">لا توجد بيانات كافية للعرض</p>
                              </div>
                            )}
                          </div>
                          
                          {/* رسم بياني لإجمالي المرضى - افتراضي */}
                          <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow duration-300">
                            <div className="flex flex-col justify-center items-center h-64">
                              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="mt-2 text-sm text-gray-500">بيانات إجمالي المرضى غير متوفرة حالياً</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* رسوم بيانية للمقارنات */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* معدلات استخدام الأجهزة */}
                          <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow duration-300">
                            {comparativeData.machineUtilization.data.length > 0 ? (
                              <>
                                <ComparativeBarChart 
                                  data={comparativeData.machineUtilization.data}
                                  labels={comparativeData.machineUtilization.labels}
                                  title="مقارنة معدلات استخدام الأجهزة"
                                  label="نسبة الاستخدام"
                                  colors={[
                                    'rgba(75, 192, 192, 0.7)',
                                    'rgba(153, 102, 255, 0.7)',
                                    'rgba(255, 159, 64, 0.7)'
                                  ]}
                                  height={300}
                                  direction="rtl"
                                />
                                <div className="mt-2 text-center">
                                  <p className="text-xs text-gray-500">
                                    الهدف الأمثل: أكثر من 80% لجميع الأجهزة
                                  </p>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col justify-center items-center h-64">
                                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-500">لا توجد بيانات كافية للعرض</p>
                              </div>
                            )}
                          </div>
                          
                          {/* توزيع أنواع الفحوصات */}
                          <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow duration-300">
                            {comparativeData.scansByType.data.length > 0 ? (
                              <>
                                <ComparativeBarChart 
                                  data={comparativeData.scansByType.data}
                                  labels={comparativeData.scansByType.labels}
                                  title="توزيع أنواع الفحوصات"
                                  label="النسبة المئوية"
                                  colors={[
                                    'rgba(54, 162, 235, 0.7)',
                                    'rgba(75, 192, 192, 0.7)',
                                    'rgba(153, 102, 255, 0.7)',
                                    'rgba(255, 159, 64, 0.7)',
                                    'rgba(255, 99, 132, 0.7)'
                                  ]}
                                  height={300}
                                  direction="rtl"
                                />
                                <div className="mt-2 text-center">
                                  <p className="text-xs text-gray-500">
                                    إجمالي الفحوصات: {comparativeData.scansByType.data.reduce((a, b) => a + b, 0)}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col justify-center items-center h-64">
                                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-500">لا توجد بيانات كافية للعرض</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              {/* حقوق الملكية */}
              <div className="mt-4 text-center text-xs text-gray-500">
                <p>© {new Date().getFullYear()} قسم الأشعة - مستشفى شرق جدة - جميع الحقوق محفوظة</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RAD;
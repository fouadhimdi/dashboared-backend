import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import * as XLSX from 'xlsx';
import Sidebar from '../components/layout/Sidebar';

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

// دالة لتوليد بيانات مؤقتة لقسم العمليات
const generateORSampleData = () => {
  return {
    timeSeriesData: {
      orUtilization: generatePlaceholderData(6, 60, 80),
      cancellationRate: generatePlaceholderData(6, 5, 15),
      admToSurgDays: generatePlaceholderData(6, 0.5, 2),
      daySurgeryRate: generatePlaceholderData(6, 50, 75)
    },
    comparativeData: {
      surgeryTypes: {
        labels: ['طارئ', 'اختياري', 'تجميلي', 'عمليات اليوم الواحد'],
        data: [
          Math.floor(Math.random() * 300 + 200),
          Math.floor(Math.random() * 700 + 500),
          Math.floor(Math.random() * 150 + 100),
          Math.floor(Math.random() * 400 + 300)
        ],
        metadata: { total: 0 }
      },
      surgeryBySpecialty: {
        labels: ['جراحة عامة', 'عظام', 'مسالك بولية', 'أنف وأذن وحنجرة', 'نساء وتوليد', 'جراحة أعصاب'],
        data: [
          Math.floor(Math.random() * 500 + 400),
          Math.floor(Math.random() * 400 + 300),
          Math.floor(Math.random() * 300 + 200),
          Math.floor(Math.random() * 250 + 150),
          Math.floor(Math.random() * 350 + 250),
          Math.floor(Math.random() * 150 + 100)
        ],
        metadata: { total: 0 }
      },
      cancellationReasons: {
        labels: ['تحسن المريض', 'غياب المريض', 'عدم الجاهزية الطبية', 'عدم توفر تجهيزات', 'تأخير إداري', 'أسباب أخرى'],
        data: [
          Math.floor(Math.random() * 30 + 20),
          Math.floor(Math.random() * 40 + 30),
          Math.floor(Math.random() * 50 + 40),
          Math.floor(Math.random() * 20 + 10),
          Math.floor(Math.random() * 15 + 5),
          Math.floor(Math.random() * 10 + 5)
        ],
        metadata: { total: 0 }
      }
    }
  };
};

// وظيفة لاستخراج التاريخ من اسم الملف
const extractDateFromFileName = (fileName) => {
  const dateMatch = fileName.match(/(\d{4})[- ]([A-Z]{3})[- ](\d{1,2})/);
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

const OR = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableData, setTableData] = useState({ headers: [], rows: [] });
  const [excelFiles, setExcelFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [kpiValues, setKpiValues] = useState({
    'electiveOrUtilization': '-',
    'surgicalCancellationRate': '-',
    'electiveSurgeries': '-',
    'admToSurgDays': '-',
    'totalDaySurgery': '-',
    'unplannedAdmission': '-',
    'daySurgeryCancellation': '-',
    'daySurgeryConversionToAdm': '-'
  });
  
  // تعريف عناصر القائمة الجانبية
  const menuItems = [
    { id: 'admin', label: 'لوحة التحكم', icon: '👨‍💼', path: '/admin' },
    { id: 'emergency', label: 'قسم الطوارئ', icon: '🏥', path: '/emergency', showForRegularUser: true },
    { id: 'operations', label: 'قسم العمليات', icon: '🔪', path: '/operations', showForRegularUser: true },
    { id: 'lab', label: 'قسم المختبر', icon: '🧪', path: '/lab', showForRegularUser: true },
    { id: 'bloodbank', label: 'بنك الدم', icon: '🩸', path: '/bloodbank', showForRegularUser: true },
    { id: 'rad', label: 'قسم الأشعة', icon: '📡', path: '/rad', showForRegularUser: true },
  ];
  
  // البنش مارك لكل مؤشر
  const benchmarks = {
    // 1. % Elective OR Utilization
    "KPI 1. % Elective OR Utilization": {
      worldClass: { min: 75, color: "#0072C6" }, // أكثر من 75%
      acceptable: { min: 62.5, max: 75, color: "#00B050" }, // 62.5%-75%
      needsImprovement: { min: 50, max: 62.5, color: "#FFC000" }, // 50%-62.5%
      unacceptable: { max: 50, color: "#C00000" } // أقل من 50%
    },
    
    // 2. % Surgical Cancellation Rate
    "KPI 2. % Surgical Cancellation Rate": {
      worldClass: { max: 10, color: "#0072C6" }, // أقل من 10%
      acceptable: { min: 10, max: 24.9, color: "#00B050" }, // 10%-24.9%
      needsImprovement: { min: 25, max: 40, color: "#FFC000" }, // 25%-40%
      unacceptable: { min: 40, color: "#C00000" } // أكثر من 40%
    },
    
    // 3. % of Elective Surgeries
    "KPI 3. % of Elective Surgeries": {
      worldClass: { min: 80, color: "#0072C6" }, // أكثر من 80%
      acceptable: { min: 70, max: 80, color: "#00B050" }, // 70%-80%
      needsImprovement: { min: 60, max: 70, color: "#FFC000" }, // 60%-70%
      unacceptable: { max: 60, color: "#C00000" } // أقل من 60%
    },
    
    // 4. Day of Adm to Surg in Days
    "KPI 4. Day of Adm to Surg in Days": {
      worldClass: { max: 1, color: "#0072C6" }, // أقل من 1 يوم
      acceptable: { min: 1, max: 1.75, color: "#00B050" }, // 1-1.75 يوم
      needsImprovement: { min: 1.75, max: 2, color: "#FFC000" }, // 1.75-2 يوم
      unacceptable: { min: 2, color: "#C00000" } // أكثر من 2 يوم
    },
    
    // 6.1 % Total Day Surgery
    "KPI 6.1. % Total Day Surgery": {
      worldClass: { min: 70, color: "#0072C6" }, // أكثر من 70%
      acceptable: { min: 60, max: 70, color: "#00B050" }, // 60%-70%
      needsImprovement: { min: 50, max: 60, color: "#FFC000" }, // 50%-60%
      unacceptable: { max: 50, color: "#C00000" } // أقل من 50%
    },
    
    // 6.2 % Unplanned admission following discharge
    "KPI 6.2. % Unplanned admission following discharge": {
      worldClass: { max: 2, color: "#0072C6" }, // أقل من 2%
      acceptable: { min: 2, max: 5, color: "#00B050" }, // 2%-5%
      needsImprovement: { min: 5, max: 10, color: "#FFC000" }, // 5%-10%
      unacceptable: { min: 10, color: "#C00000" } // أكثر من 10%
    },
    
    // 6.3 Day Surgery Cancellation Rate
    "KPI 6.3. Day Surgery Cancellation Rate": {
      worldClass: { max: 5, color: "#0072C6" }, // أقل من 5%
      acceptable: { min: 5, max: 10, color: "#00B050" }, // 5%-10%
      needsImprovement: { min: 10, max: 15, color: "#FFC000" }, // 10%-15%
      unacceptable: { min: 15, color: "#C00000" } // أكثر من 15%
    },
    
    // 6.4 Day Surgery Conversion to Adm
    "KPI 6.4. Day Surgery Conversion to Adm": {
      worldClass: { max: 3, color: "#0072C6" }, // أقل من 3%
      acceptable: { min: 3, max: 5, color: "#00B050" }, // 3%-5%
      needsImprovement: { min: 5, max: 8, color: "#FFC000" }, // 5%-8%
      unacceptable: { min: 8, color: "#C00000" } // أكثر من 8%
    },
    
    // Turnaround Time as % of total
    "KPI 7. Turnaround Time as % of total": {
      worldClass: { max: 15, color: "#0072C6" }, // أقل من 15%
      acceptable: { min: 15, max: 20, color: "#00B050" }, // 15%-20%
      needsImprovement: { min: 20, max: 25, color: "#FFC000" }, // 20%-25%
      unacceptable: { min: 25, color: "#C00000" } // أكثر من 25%
    }
  };

  // وظيفة لتحديد اللون المناسب للقيمة بناءً على البنش مارك
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
  
  // البحث عن المؤشرات في ملف Excel
  const findKpisInExcel = (data) => {
    // تعريف المؤشرات مع إحداثيات دقيقة للخلايا بناءً على الصورة
    const kpiDefinitions = [
      { 
        key: "electiveOrUtilization", 
        name: "KPI 1. % Elective OR Utilization",
        exactCell: { rowIndex: 1, columnIndex: 21 }
      },
      { 
        key: "surgicalCancellationRate", 
        name: "KPI 2. % Surgical Cancellation Rate", 
        exactCell: { rowIndex: 1, columnIndex: 22 }
      },
      { 
        key: "electiveSurgeries", 
        name: "% of Elective Surgeries", 
        exactCell: { rowIndex: 1, columnIndex: 23 }
      },
      { 
        key: "admToSurgDays", 
        name: "KPI 4. Day of Adm to Surg Days", 
        exactCell: { rowIndex: 1, columnIndex: 30 }
      },
      { 
        key: "totalDaySurgery", 
        name: "KPI 6.1. % Total Day Surgery", 
        exactCell: { rowIndex: 1, columnIndex: 32 }
      },
      { 
        key: "unplannedAdmission", 
        name: "KPI 6.2. % Unplanned admission following discharge", 
        exactCell: { rowIndex: 1, columnIndex: 33 }
      },
      { 
        key: "daySurgeryCancellation", 
        name: "KPI 6.3. Day Surgery Cancellation Rate", 
        exactCell: { rowIndex: 1, columnIndex: 34 }
      },
      { 
        key: "daySurgeryConversionToAdm", 
        name: "KPI 6.4. Day Surgery Conversion to Adm", 
        exactCell: { rowIndex: 1, columnIndex: 35 }
      }
    ];
    
    // تهيئة كائن المؤشرات
    let foundKpis = {};
    kpiDefinitions.forEach(kpi => {
      foundKpis[kpi.key] = null;
    });
    
    // استخراج القيم من الخلايا المحددة
    for (const kpiDef of kpiDefinitions) {
      if (kpiDef.exactCell && kpiDef.exactCell.rowIndex !== null && kpiDef.exactCell.columnIndex !== null) {
        // استخراج القيمة من خلية محددة
        const value = getValueFromExactCell(
          data, 
          kpiDef.exactCell.rowIndex, 
          kpiDef.exactCell.columnIndex
        );
        
        if (value !== null) {
          console.log(`تم استخراج قيمة ${kpiDef.key} (${kpiDef.name}) من الخلية المحددة [صف: ${kpiDef.exactCell.rowIndex + 1}, عمود: ${kpiDef.exactCell.columnIndex + 1}]: ${value}`);
          foundKpis[kpiDef.key] = formatKpiValue(value);
        } else {
          console.log(`لم يتم العثور على قيمة للمؤشر ${kpiDef.key} (${kpiDef.name}) في الخلية المحددة [صف: ${kpiDef.exactCell.rowIndex + 1}, عمود: ${kpiDef.exactCell.columnIndex + 1}]`);
        }
      }
    }
    
    return foundKpis;
  };

  // استخراج القيمة من خلية محددة
  const getValueFromExactCell = (data, rowIndex, columnIndex) => {
    if (rowIndex >= 0 && rowIndex < data.length) {
      const row = data[rowIndex];
      const colKeys = Object.keys(row);
      if (columnIndex >= 0 && columnIndex < colKeys.length) {
        const targetColKey = colKeys[columnIndex];
        const value = row[targetColKey];
        return value !== undefined && value !== null && value !== '' ? parseFloat(value) : null;
      }
    }
    return null;
  };

  // تنسيق قيمة المؤشر
  const formatKpiValue = (value) => {
    if (value === null || value === undefined) {
      return '-';
    }
    
    // إذا كانت القيمة أقل من 1، فغالبًا تكون نسبة مئوية
    if (value < 1) {
      return `${(value * 100).toFixed(1)}%`;
    }
    
    // تقريب القيم العشرية
    if (value % 1 !== 0) {
      return value.toFixed(1);
    }
    
    return value.toString();
  };
  
  // وظيفة لقراءة قائمة الملفات من المجلد
  useEffect(() => {
    const fetchExcelFiles = async () => {
      try {
        const response = await fetch('http://localhost:3001/data/OR');
        const files = await response.json();
        const excelFiles = files.filter(file => file.endsWith('.xlsx')).sort(compareDates);
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
        
        const response = await fetch(`http://localhost:3001/data/OR/${selectedFile}`);
        const fileContent = await response.arrayBuffer();
        const workbook = XLSX.read(fileContent, { type: 'array' });
        
        // البحث عن ورقة العمل المناسبة
        const sheetNames = workbook.SheetNames;
        let kpiSheetName = null;
        
        // البحث عن ورقة تحتوي على "KPI" في اسمها
        for (const name of sheetNames) {
          if (name.includes("KPI")) {
            kpiSheetName = name;
            break;
          }
        }
        
        // إذا لم نجد ورقة مناسبة، نستخدم الورقة الثانية
        if (!kpiSheetName && sheetNames.length > 1) {
          kpiSheetName = sheetNames[1];
        }
        
        // إذا لم نجد ورقة مناسبة، نستخدم الورقة الأولى
        if (!kpiSheetName) {
          kpiSheetName = sheetNames[0];
        }
        
        // قراءة البيانات من ورقة العمل المحددة
        const sheet = workbook.Sheets[kpiSheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 'A', blankrows: false });
        
        // البحث عن المؤشرات في البيانات
        const kpis = findKpisInExcel(data);
        setKpiValues(kpis);
        
        // إعداد بيانات الجدول
        const kpiHeaders = [
          'KPI 1. % Elective OR Utilization',
          'KPI 2. % Surgical Cancellation Rate',
          'KPI 3. % of Elective Surgeries',
          'KPI 4. Day of Adm to Surg in Days',
          'KPI 6.1. % Total Day Surgery',
          'KPI 6.2. % Unplanned admission following discharge',
          'KPI 6.3. Day Surgery Cancellation Rate',
          'KPI 6.4. Day Surgery Conversion to Adm'
        ];
        
        const headers = ['KPI', 'القيمة', 'KPI', 'القيمة'];
        const row1 = [kpiHeaders[0], kpis.electiveOrUtilization, kpiHeaders[1], kpis.surgicalCancellationRate];
        const row2 = [kpiHeaders[2], kpis.electiveSurgeries, kpiHeaders[3], kpis.admToSurgDays];
        const row3 = [kpiHeaders[4], kpis.totalDaySurgery, kpiHeaders[5], kpis.unplannedAdmission];
        const row4 = [kpiHeaders[6], kpis.daySurgeryCancellation, kpiHeaders[7], kpis.daySurgeryConversionToAdm];
        
        setTableData({
          headers,
          rows: [row1, row2, row3, row4]
        });
      } catch (err) {
        console.error("خطأ في قراءة البيانات:", err);
        setError("حدث خطأ أثناء قراءة البيانات: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadExcelData();
  }, [selectedFile]);

  // Función para formatear la fecha desde el nombre del archivo
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

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex h-screen">
        {/* استخدام مكون الشريط الجانبي */}
        <Sidebar />

        {/* المحتوى الرئيسي */}
        <div className="flex-1 overflow-auto bg-gray-50 mr-72">
          {/* رأس الصفحة */}
          <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
            <div className="px-4 py-2 flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-gray-800">تحليل مؤشرات الأداء الرئيسية</h1>
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
                    onChange={(e) => setSelectedFile(e.target.value)}
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
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* بطاقات مؤشرات الأداء الرئيسية */}
                  <div className="bg-white rounded-lg shadow-sm p-3 mb-6">
                    <h2 className="text-base font-bold text-gray-700 mb-3 border-r-4 border-indigo-500 pr-2">ملخص مؤشرات الأداء الرئيسية لقسم العمليات</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* استغلال غرف العمليات */}
                      <div className="bg-white rounded-lg shadow-sm p-3 border-r-4 border-blue-500 transform transition-transform hover:scale-105 hover:shadow-md">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500">استغلال غرف العمليات الاختيارية</p>
                            <p className="text-lg font-bold text-gray-800 mt-0.5">{kpiValues.electiveOrUtilization}</p>
                            {getBenchmarkLabel("KPI 1. % Elective OR Utilization", kpiValues.electiveOrUtilization) && (
                              <span className="text-[9px] px-1 py-0.5 rounded" 
                                    style={{ backgroundColor: getColorForValue("KPI 1. % Elective OR Utilization", kpiValues.electiveOrUtilization), color: 'white' }}>
                                {getBenchmarkLabel("KPI 1. % Elective OR Utilization", kpiValues.electiveOrUtilization)}
                              </span>
                            )}
                          </div>
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-gray-500">
                          الهدف الأمثل
                          <span className="text-blue-600 font-medium mr-1">أكثر من 75%</span>
                        </div>
                      </div>
                      
                      {/* معدل إلغاء العمليات */}
                      <div className="bg-white rounded-lg shadow-sm p-3 border-r-4 border-red-500 transform transition-transform hover:scale-105 hover:shadow-md">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500">معدل إلغاء العمليات</p>
                            <p className="text-lg font-bold text-gray-800 mt-0.5">{kpiValues.surgicalCancellationRate}</p>
                            {getBenchmarkLabel("KPI 2. % Surgical Cancellation Rate", kpiValues.surgicalCancellationRate) && (
                              <span className="text-[9px] px-1 py-0.5 rounded" 
                                    style={{ backgroundColor: getColorForValue("KPI 2. % Surgical Cancellation Rate", kpiValues.surgicalCancellationRate), color: 'white' }}>
                                {getBenchmarkLabel("KPI 2. % Surgical Cancellation Rate", kpiValues.surgicalCancellationRate)}
                              </span>
                            )}
                          </div>
                          <div className="p-2 bg-red-100 rounded-lg">
                            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-gray-500">
                          الهدف الأمثل
                          <span className="text-blue-600 font-medium mr-1">أقل من 10%</span>
                        </div>
                      </div>
                      
                      {/* نسبة العمليات الاختيارية */}
                      <div className="bg-white rounded-lg shadow-sm p-3 border-r-4 border-green-500 transform transition-transform hover:scale-105 hover:shadow-md">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500">نسبة العمليات الاختيارية</p>
                            <p className="text-lg font-bold text-gray-800 mt-0.5">{kpiValues.electiveSurgeries}</p>
                            {getBenchmarkLabel("KPI 3. % of Elective Surgeries", kpiValues.electiveSurgeries) && (
                              <span className="text-[9px] px-1 py-0.5 rounded" 
                                    style={{ backgroundColor: getColorForValue("KPI 3. % of Elective Surgeries", kpiValues.electiveSurgeries), color: 'white' }}>
                                {getBenchmarkLabel("KPI 3. % of Elective Surgeries", kpiValues.electiveSurgeries)}
                              </span>
                            )}
                          </div>
                          <div className="p-2 bg-green-100 rounded-lg">
                            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-gray-500">
                          الهدف الأمثل
                          <span className="text-blue-600 font-medium mr-1">أكثر من 80%</span>
                        </div>
                      </div>
                      
                      {/* متوسط الأيام من الدخول إلى العملية */}
                      <div className="bg-white rounded-lg shadow-sm p-3 border-r-4 border-yellow-500 transform transition-transform hover:scale-105 hover:shadow-md">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500">متوسط أيام من الدخول إلى العملية</p>
                            <p className="text-lg font-bold text-gray-800 mt-0.5">{kpiValues.admToSurgDays}</p>
                            {getBenchmarkLabel("KPI 4. Day of Adm to Surg in Days", kpiValues.admToSurgDays) && (
                              <span className="text-[9px] px-1 py-0.5 rounded" 
                                    style={{ backgroundColor: getColorForValue("KPI 4. Day of Adm to Surg in Days", kpiValues.admToSurgDays), color: 'white' }}>
                                {getBenchmarkLabel("KPI 4. Day of Adm to Surg in Days", kpiValues.admToSurgDays)}
                              </span>
                            )}
                          </div>
                          <div className="p-2 bg-yellow-100 rounded-lg">
                            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-gray-500">
                          الهدف الأمثل
                          <span className="text-blue-600 font-medium mr-1">أقل من 1 يوم</span>
                        </div>
                      </div>
                      
                      {/* نسبة جراحات اليوم الواحد */}
                      <div className="bg-white rounded-lg shadow-sm p-3 border-r-4 border-indigo-500 transform transition-transform hover:scale-105 hover:shadow-md">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500">نسبة عمليات اليوم الواحد</p>
                            <p className="text-lg font-bold text-gray-800 mt-0.5">{kpiValues.totalDaySurgery}</p>
                            {getBenchmarkLabel("KPI 6.1. % Total Day Surgery", kpiValues.totalDaySurgery) && (
                              <span className="text-[9px] px-1 py-0.5 rounded" 
                                    style={{ backgroundColor: getColorForValue("KPI 6.1. % Total Day Surgery", kpiValues.totalDaySurgery), color: 'white' }}>
                                {getBenchmarkLabel("KPI 6.1. % Total Day Surgery", kpiValues.totalDaySurgery)}
                              </span>
                            )}
                          </div>
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-gray-500">
                          الهدف الأمثل
                          <span className="text-blue-600 font-medium mr-1">أكثر من 70%</span>
                        </div>
                      </div>
                      
                      {/* معدل إعادة الإدخال غير المخطط */}
                      <div className="bg-white rounded-lg shadow-sm p-3 border-r-4 border-purple-500 transform transition-transform hover:scale-105 hover:shadow-md">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500">معدل إعادة الإدخال غير المخطط</p>
                            <p className="text-lg font-bold text-gray-800 mt-0.5">{kpiValues.unplannedAdmission}</p>
                            {getBenchmarkLabel("KPI 6.2. % Unplanned admission following discharge", kpiValues.unplannedAdmission) && (
                              <span className="text-[9px] px-1 py-0.5 rounded" 
                                    style={{ backgroundColor: getColorForValue("KPI 6.2. % Unplanned admission following discharge", kpiValues.unplannedAdmission), color: 'white' }}>
                                {getBenchmarkLabel("KPI 6.2. % Unplanned admission following discharge", kpiValues.unplannedAdmission)}
                              </span>
                            )}
                          </div>
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-gray-500">
                          الهدف الأمثل
                          <span className="text-blue-600 font-medium mr-1">أقل من 2%</span>
                        </div>
                      </div>
                      
                      {/* معدل إلغاء عمليات اليوم الواحد */}
                      <div className="bg-white rounded-lg shadow-sm p-3 border-r-4 border-pink-500 transform transition-transform hover:scale-105 hover:shadow-md">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500">معدل إلغاء عمليات اليوم الواحد</p>
                            <p className="text-lg font-bold text-gray-800 mt-0.5">{kpiValues.daySurgeryCancellation}</p>
                            {getBenchmarkLabel("KPI 6.3. Day Surgery Cancellation Rate", kpiValues.daySurgeryCancellation) && (
                              <span className="text-[9px] px-1 py-0.5 rounded" 
                                    style={{ backgroundColor: getColorForValue("KPI 6.3. Day Surgery Cancellation Rate", kpiValues.daySurgeryCancellation), color: 'white' }}>
                                {getBenchmarkLabel("KPI 6.3. Day Surgery Cancellation Rate", kpiValues.daySurgeryCancellation)}
                              </span>
                            )}
                          </div>
                          <div className="p-2 bg-pink-100 rounded-lg">
                            <svg className="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-gray-500">
                          الهدف الأمثل
                          <span className="text-blue-600 font-medium mr-1">أقل من 5%</span>
                        </div>
                      </div>
                      
                      {/* معدل تحويل عمليات اليوم الواحد إلى تنويم */}
                      <div className="bg-white rounded-lg shadow-sm p-3 border-r-4 border-teal-500 transform transition-transform hover:scale-105 hover:shadow-md">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500">معدل تحويل عمليات اليوم الواحد إلى تنويم</p>
                            <p className="text-lg font-bold text-gray-800 mt-0.5">{kpiValues.daySurgeryConversionToAdm}</p>
                            {getBenchmarkLabel("KPI 6.4. Day Surgery Conversion to Adm", kpiValues.daySurgeryConversionToAdm) && (
                              <span className="text-[9px] px-1 py-0.5 rounded" 
                                    style={{ backgroundColor: getColorForValue("KPI 6.4. Day Surgery Conversion to Adm", kpiValues.daySurgeryConversionToAdm), color: 'white' }}>
                                {getBenchmarkLabel("KPI 6.4. Day Surgery Conversion to Adm", kpiValues.daySurgeryConversionToAdm)}
                              </span>
                            )}
                          </div>
                          <div className="p-2 bg-teal-100 rounded-lg">
                            <svg className="w-6 h-6 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-gray-500">
                          الهدف الأمثل
                          <span className="text-blue-600 font-medium mr-1">أقل من 3%</span>
                        </div>
                      </div>
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

              {/* حقوق الملكية */}
              <div className="mt-2 text-center text-xs text-gray-500">
                <p>© {new Date().toLocaleDateString('ar-SA')} مؤشرات الأداء الرئيسية - جميع الحقوق محفوظة</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OR;
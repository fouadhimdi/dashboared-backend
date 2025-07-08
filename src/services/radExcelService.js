import * as XLSX from 'xlsx';

// قاعدة URL للـ API
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api');

// خدمة متخصصة لقراءة وتحليل بيانات الأشعة من ملفات Excel
const RadExcelService = {
  // دالة للحصول على قائمة ملفات قسم الأشعة
  async getRadFileList() {
    try {
      const response = await fetch(`${API_BASE_URL}/data/RAD`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const files = await response.json();
      return files.filter(file => file.endsWith('.xlsx'));
    } catch (error) {
      console.error('خطأ في قراءة قائمة ملفات الأشعة:', error);
      throw new Error('حدث خطأ في قراءة قائمة ملفات الأشعة');
    }
  },
  
  // دالة لقراءة ملف Excel محدد لقسم الأشعة
  async readRadExcelFile(fileName) {
    try {
      const response = await fetch(`${API_BASE_URL}/data/RAD/${fileName}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const fileContent = await response.arrayBuffer();
      const workbook = XLSX.read(fileContent, { 
        type: 'array',
        cellDates: true,
        cellNF: true
      });
      
      // البحث عن ورقة العمل المناسبة (Summary Sheet)
      const summarySheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('summary')
      ) || workbook.SheetNames[0];
      
      const summarySheet = workbook.Sheets[summarySheetName];
      
      // تحويل البيانات إلى تنسيق JSON
      const jsonData = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });
      
      return { workbook, sheetName: summarySheetName, data: jsonData };
    } catch (error) {
      console.error('خطأ في قراءة ملف Excel للأشعة:', error);
      throw new Error('حدث خطأ في قراءة ملف Excel للأشعة');
    }
  },
  
  // استخراج بيانات للرسوم البيانية الخاصة بمؤشرات الأداء الرئيسية
  extractKpiChartData(workbook) {
    try {
      const result = {
        orderToScan: { 
          labels: ['CT', 'MRI', 'Ultrasound'],
          inpatientData: [],
          opdData: [],
          benchmarks: 24 // القيمة المستهدفة (24 ساعة)
        },
        scanToRelease: {
          labels: ['CT', 'MRI', 'Ultrasound'],
          inpatientData: [],
          opdData: [],
          benchmarks: 5 // القيمة المستهدفة (5 ساعات)
        },
        machineUtilization: {
          labels: ['CT', 'MRI', 'Ultrasound'],
          data: [],
          benchmarks: 80 // القيمة المستهدفة (80%)
        }
      };
      
      // التأكد من وجود صفحة Summary Sheet
      if (!workbook.Sheets['Summary Sheet']) {
        throw new Error('لم يتم العثور على صفحة Summary Sheet');
      }
      
      const sheet = workbook.Sheets['Summary Sheet'];
      
      // 1. Order to Scan Time (وقت الطلب إلى الفحص)
      // استخراج بيانات المنومين
      const ctOrderToScanInpatient = this.getCellValue(sheet, 'I5');
      const mriOrderToScanInpatient = this.getCellValue(sheet, 'I6');
      const usOrderToScanInpatient = this.getCellValue(sheet, 'I7');
      
      result.orderToScan.inpatientData = [
        this.convertToHours(ctOrderToScanInpatient),
        this.convertToHours(mriOrderToScanInpatient),
        this.convertToHours(usOrderToScanInpatient)
      ];
      
      // استخراج بيانات العيادات
      const ctOrderToScanOpd = this.getCellValue(sheet, 'I8');
      const mriOrderToScanOpd = this.getCellValue(sheet, 'I9');
      const usOrderToScanOpd = this.getCellValue(sheet, 'I10');
      
      result.orderToScan.opdData = [
        this.convertToHours(ctOrderToScanOpd),
        this.convertToHours(mriOrderToScanOpd),
        this.convertToHours(usOrderToScanOpd)
      ];
      
      // 2. Scan to Release Time (وقت الفحص إلى التقرير)
      // استخراج بيانات المنومين
      const ctScanToReleaseInpatient = this.getCellValue(sheet, 'J5');
      const mriScanToReleaseInpatient = this.getCellValue(sheet, 'J6');
      const usScanToReleaseInpatient = this.getCellValue(sheet, 'J7');
      
      result.scanToRelease.inpatientData = [
        this.convertToHours(ctScanToReleaseInpatient),
        this.convertToHours(mriScanToReleaseInpatient),
        this.convertToHours(usScanToReleaseInpatient)
      ];
      
      // استخراج بيانات العيادات
      const ctScanToReleaseOpd = this.getCellValue(sheet, 'J8');
      const mriScanToReleaseOpd = this.getCellValue(sheet, 'J9');
      const usScanToReleaseOpd = this.getCellValue(sheet, 'J10');
      
      result.scanToRelease.opdData = [
        this.convertToHours(ctScanToReleaseOpd),
        this.convertToHours(mriScanToReleaseOpd),
        this.convertToHours(usScanToReleaseOpd)
      ];
      
      // 3. Machine Utilization (معدل استخدام الأجهزة)
      const ctUtilization = this.getCellValue(sheet, 'M5');
      const mriUtilization = this.getCellValue(sheet, 'M6');
      const usUtilization = this.getCellValue(sheet, 'M7');
      
      result.machineUtilization.data = [
        this.convertToPercentage(ctUtilization),
        this.convertToPercentage(mriUtilization),
        this.convertToPercentage(usUtilization)
      ];
      
      return result;
    } catch (error) {
      console.error('خطأ في استخراج بيانات الرسوم البيانية:', error);
      throw new Error('حدث خطأ في استخراج بيانات الرسوم البيانية');
    }
  },
  
  // دالة جديدة لاستخراج بيانات الرسوم البيانية عبر الزمن من عدة ملفات
  async extractTimeSeriesData() {
    try {
      // الحصول على قائمة ملفات الإكسل
      const files = await this.getRadFileList();
      
      // ترتيب الملفات حسب التاريخ (الأقدم أولاً)
      const sortedFiles = [...files].sort((a, b) => {
        const dateA = this.extractDateFromFileName(a);
        const dateB = this.extractDateFromFileName(b);
        return dateA - dateB;
      });
      
      // تحديد عدد الملفات التي سيتم استخدامها (آخر 6 ملفات أو كل الملفات إذا كان أقل من 6)
      const filesToProcess = sortedFiles.slice(-6);
      
      console.log('Files to process for time series:', filesToProcess);
      
      // تهيئة مصفوفات البيانات عبر الزمن
      const timeSeriesData = {
        labels: [], // سيحتوي على تواريخ الملفات
        inpatientWaitTime: {
          CT: [],
          MRI: [],
          US: []
        },
        opdWaitTime: {
          CT: [],
          MRI: [],
          US: []
        },
        machineUtilization: {
          CT: [],
          MRI: [],
          US: []
        },
        scanToReleaseInpatient: {
          CT: [],
          MRI: [],
          US: []
        },
        scanToReleaseOpd: {
          CT: [],
          MRI: [],
          US: []
        }
      };
      
      // معالجة كل ملف
      for (const fileName of filesToProcess) {
        try {
          // قراءة الملف
          const { workbook } = await this.readRadExcelFile(fileName);
          
          // استخراج البيانات من الملف
          const fileData = this.extractKpiChartData(workbook);
          
          // استخراج تاريخ الملف وإضافته للتسميات
          const fileDate = this.extractFormattedDateFromFileName(fileName);
          timeSeriesData.labels.push(fileDate);
          
          // Order to Scan Time (Inpatient)
          timeSeriesData.inpatientWaitTime.CT.push(fileData.orderToScan.inpatientData[0]);
          timeSeriesData.inpatientWaitTime.MRI.push(fileData.orderToScan.inpatientData[1]);
          timeSeriesData.inpatientWaitTime.US.push(fileData.orderToScan.inpatientData[2]);
          
          // Order to Scan Time (OPD)
          timeSeriesData.opdWaitTime.CT.push(fileData.orderToScan.opdData[0]);
          timeSeriesData.opdWaitTime.MRI.push(fileData.orderToScan.opdData[1]);
          timeSeriesData.opdWaitTime.US.push(fileData.orderToScan.opdData[2]);
          
          // Scan to Release Time (Inpatient)
          timeSeriesData.scanToReleaseInpatient.CT.push(fileData.scanToRelease.inpatientData[0]);
          timeSeriesData.scanToReleaseInpatient.MRI.push(fileData.scanToRelease.inpatientData[1]);
          timeSeriesData.scanToReleaseInpatient.US.push(fileData.scanToRelease.inpatientData[2]);
          
          // Scan to Release Time (OPD)
          timeSeriesData.scanToReleaseOpd.CT.push(fileData.scanToRelease.opdData[0]);
          timeSeriesData.scanToReleaseOpd.MRI.push(fileData.scanToRelease.opdData[1]);
          timeSeriesData.scanToReleaseOpd.US.push(fileData.scanToRelease.opdData[2]);
          
          // Machine Utilization
          timeSeriesData.machineUtilization.CT.push(fileData.machineUtilization.data[0]);
          timeSeriesData.machineUtilization.MRI.push(fileData.machineUtilization.data[1]);
          timeSeriesData.machineUtilization.US.push(fileData.machineUtilization.data[2]);
          
        } catch (error) {
          console.error(`خطأ في معالجة الملف ${fileName}:`, error);
          // استمر في المعالجة حتى لو فشل ملف واحد
        }
      }
      
      // تنسيق النتائج للاستخدام في الرسوم البيانية
      const result = {
        labels: timeSeriesData.labels,
        inpatientWaitTime: {
          labels: timeSeriesData.labels,
          dataSets: [
            timeSeriesData.inpatientWaitTime.CT,
            timeSeriesData.inpatientWaitTime.MRI,
            timeSeriesData.inpatientWaitTime.US
          ],
          metadata: {
            ct: {
              avg: this.calculateAverage(timeSeriesData.inpatientWaitTime.CT),
              min: Math.min(...timeSeriesData.inpatientWaitTime.CT),
              max: Math.max(...timeSeriesData.inpatientWaitTime.CT)
            },
            mri: {
              avg: this.calculateAverage(timeSeriesData.inpatientWaitTime.MRI),
              min: Math.min(...timeSeriesData.inpatientWaitTime.MRI),
              max: Math.max(...timeSeriesData.inpatientWaitTime.MRI)
            },
            us: {
              avg: this.calculateAverage(timeSeriesData.inpatientWaitTime.US),
              min: Math.min(...timeSeriesData.inpatientWaitTime.US),
              max: Math.max(...timeSeriesData.inpatientWaitTime.US)
            }
          }
        },
        opdWaitTime: {
          labels: timeSeriesData.labels,
          dataSets: [
            timeSeriesData.opdWaitTime.CT,
            timeSeriesData.opdWaitTime.MRI,
            timeSeriesData.opdWaitTime.US
          ],
          metadata: {
            ct: {
              avg: this.calculateAverage(timeSeriesData.opdWaitTime.CT),
              min: Math.min(...timeSeriesData.opdWaitTime.CT),
              max: Math.max(...timeSeriesData.opdWaitTime.CT)
            },
            mri: {
              avg: this.calculateAverage(timeSeriesData.opdWaitTime.MRI),
              min: Math.min(...timeSeriesData.opdWaitTime.MRI),
              max: Math.max(...timeSeriesData.opdWaitTime.MRI)
            },
            us: {
              avg: this.calculateAverage(timeSeriesData.opdWaitTime.US),
              min: Math.min(...timeSeriesData.opdWaitTime.US),
              max: Math.max(...timeSeriesData.opdWaitTime.US)
            }
          }
        },
        scanToReleaseInpatient: {
          labels: timeSeriesData.labels,
          dataSets: [
            timeSeriesData.scanToReleaseInpatient.CT,
            timeSeriesData.scanToReleaseInpatient.MRI,
            timeSeriesData.scanToReleaseInpatient.US
          ],
          metadata: {
            ct: {
              avg: this.calculateAverage(timeSeriesData.scanToReleaseInpatient.CT),
              min: Math.min(...timeSeriesData.scanToReleaseInpatient.CT),
              max: Math.max(...timeSeriesData.scanToReleaseInpatient.CT)
            },
            mri: {
              avg: this.calculateAverage(timeSeriesData.scanToReleaseInpatient.MRI),
              min: Math.min(...timeSeriesData.scanToReleaseInpatient.MRI),
              max: Math.max(...timeSeriesData.scanToReleaseInpatient.MRI)
            },
            us: {
              avg: this.calculateAverage(timeSeriesData.scanToReleaseInpatient.US),
              min: Math.min(...timeSeriesData.scanToReleaseInpatient.US),
              max: Math.max(...timeSeriesData.scanToReleaseInpatient.US)
            }
          }
        },
        scanToReleaseOpd: {
          labels: timeSeriesData.labels,
          dataSets: [
            timeSeriesData.scanToReleaseOpd.CT,
            timeSeriesData.scanToReleaseOpd.MRI,
            timeSeriesData.scanToReleaseOpd.US
          ],
          metadata: {
            ct: {
              avg: this.calculateAverage(timeSeriesData.scanToReleaseOpd.CT),
              min: Math.min(...timeSeriesData.scanToReleaseOpd.CT),
              max: Math.max(...timeSeriesData.scanToReleaseOpd.CT)
            },
            mri: {
              avg: this.calculateAverage(timeSeriesData.scanToReleaseOpd.MRI),
              min: Math.min(...timeSeriesData.scanToReleaseOpd.MRI),
              max: Math.max(...timeSeriesData.scanToReleaseOpd.MRI)
            },
            us: {
              avg: this.calculateAverage(timeSeriesData.scanToReleaseOpd.US),
              min: Math.min(...timeSeriesData.scanToReleaseOpd.US),
              max: Math.max(...timeSeriesData.scanToReleaseOpd.US)
            }
          }
        },
        machineUtilization: {
          labels: timeSeriesData.labels,
          dataSets: [
            timeSeriesData.machineUtilization.CT,
            timeSeriesData.machineUtilization.MRI,
            timeSeriesData.machineUtilization.US
          ],
          metadata: {
            ct: {
              avg: this.calculateAverage(timeSeriesData.machineUtilization.CT),
              min: Math.min(...timeSeriesData.machineUtilization.CT),
              max: Math.max(...timeSeriesData.machineUtilization.CT)
            },
            mri: {
              avg: this.calculateAverage(timeSeriesData.machineUtilization.MRI),
              min: Math.min(...timeSeriesData.machineUtilization.MRI),
              max: Math.max(...timeSeriesData.machineUtilization.MRI)
            },
            us: {
              avg: this.calculateAverage(timeSeriesData.machineUtilization.US),
              min: Math.min(...timeSeriesData.machineUtilization.US),
              max: Math.max(...timeSeriesData.machineUtilization.US)
            }
          }
        }
      };
      
      return result;
      
    } catch (error) {
      console.error('خطأ في استخراج بيانات السلاسل الزمنية:', error);
      throw new Error('حدث خطأ في استخراج بيانات السلاسل الزمنية');
    }
  },

  // استخراج تاريخ من اسم الملف (للترتيب)
  extractDateFromFileName(fileName) {
    // نمط RAD-JD-GEN-4-2025-FEB.xlsx
    const match = fileName.match(/(\d{4})-([A-Z]{3})/);
    if (!match) return new Date(0); // تاريخ قديم جداً إذا لم يتم العثور على تطابق
    
    const year = parseInt(match[1]);
    const month = this.getMonthNumber(match[2]);
    
    return new Date(year, month, 1);
  },

  // استخراج تاريخ منسق (نص) من اسم الملف (للعرض)
  extractFormattedDateFromFileName(fileName) {
    const arabicMonths = {
      'JAN': 'يناير',
      'FEB': 'فبراير',
      'MAR': 'مارس',
      'APR': 'أبريل',
      'MAY': 'مايو',
      'JUN': 'يونيو',
      'JUL': 'يوليو',
      'AUG': 'أغسطس',
      'SEP': 'سبتمبر',
      'OCT': 'أكتوبر',
      'NOV': 'نوفمبر',
      'DEC': 'ديسمبر'
    };

    // نمط RAD-JD-GEN-4-2025-FEB.xlsx
    const match = fileName.match(/(\d{4})-([A-Z]{3})/);
    if (!match) return 'غير معروف';
    
    const year = match[1];
    const englishMonth = match[2];
    const arabicMonth = arabicMonths[englishMonth] || englishMonth;
    
    return `${arabicMonth} ${year}`;
  },

  // تحويل اسم الشهر بالإنجليزية إلى رقم (0-11)
  getMonthNumber(monthName) {
    const months = {
      'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
      'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
    };
    
    return months[monthName] || 0;
  },

  // حساب المتوسط لمجموعة من القيم
  calculateAverage(values) {
    if (!values || values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / values.length) * 100) / 100;
  },
  
  // دالة مساعدة للحصول على قيمة خلية
  getCellValue(sheet, cellAddress) {
    const cell = sheet[cellAddress];
    if (!cell) return null;
    
    return cell.v;
  },
  
  // تحويل القيمة إلى ساعات (للتعامل مع مختلف التنسيقات)
  convertToHours(value) {
    if (value === null || value === undefined) return 0;
    
    // إذا كانت القيمة رقمية مباشرة (قد تكون تنسيق تاريخ/وقت في Excel)
    if (typeof value === 'number') {
      // Excel يخزن الوقت كجزء من يوم (24 ساعة)
      return Math.round(value * 24 * 100) / 100; // تقريب إلى رقمين عشريين
    }
    
    // إذا كانت القيمة نصية
    if (typeof value === 'string') {
      // إذا كانت بتنسيق HH:MM
      if (value.includes(':')) {
        const parts = value.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        return Math.round((hours + minutes / 60) * 100) / 100;
      }
      
      // محاولة تحويل النص إلى رقم
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return Math.round(numValue * 100) / 100;
      }
    }
    
    // إذا كانت كائن تاريخ
    if (value instanceof Date) {
      const hours = value.getHours();
      const minutes = value.getMinutes();
      return Math.round((hours + minutes / 60) * 100) / 100;
    }
    
    return 0;
  },
  
  // تحويل القيمة إلى نسبة مئوية
  convertToPercentage(value) {
    if (value === null || value === undefined) return 0;
    
    // إذا كانت القيمة رقمية
    if (typeof value === 'number') {
      // إذا كانت القيمة بين 0 و 1، نفترض أنها نسبة عشرية
      if (value <= 1) {
        return Math.round(value * 100 * 100) / 100;
      }
      return Math.round(value * 100) / 100;
    }
    
    // إذا كانت القيمة نصية
    if (typeof value === 'string') {
      // إذا كانت تحتوي على %
      if (value.includes('%')) {
        return Math.round(parseFloat(value.replace('%', '')) * 100) / 100;
      }
      
      // محاولة تحويل النص إلى رقم
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        // إذا كانت القيمة بين 0 و 1، نفترض أنها نسبة عشرية
        if (numValue <= 1) {
          return Math.round(numValue * 100 * 100) / 100;
        }
        return Math.round(numValue * 100) / 100;
      }
    }
    
    return 0;
  }
};

export default RadExcelService;
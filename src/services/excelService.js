import * as XLSX from 'xlsx';

// قاعدة URL للـ API
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api');

// خدمة لقراءة ملفات Excel وتحويل البيانات
const ExcelService = {
  // دالة للحصول على قائمة الملفات
  async getFileList() {
    try {
      const response = await fetch(`${API_BASE_URL}/data/ED`);
      const files = await response.json();
      return files.filter(file => file.endsWith('.xlsx'));
    } catch (error) {
      console.error('خطأ في قراءة قائمة الملفات:', error);
      throw new Error('حدث خطأ في قراءة قائمة الملفات');
    }
  },
  
  // دالة لقراءة ملف Excel محدد
  async readExcelFile(fileName) {
    try {
      const response = await fetch(`${API_BASE_URL}/data/ED/${fileName}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const fileContent = await response.arrayBuffer();
      const workbook = XLSX.read(fileContent, { type: 'array' });
      
      // البحث عن الورقة المطلوبة
      const sheetNames = workbook.SheetNames;
      const sheetName = sheetNames.find(name => 
        name.toLowerCase().includes('ed kpis') || 
        name.toLowerCase().includes('kpis')
      ) || sheetNames[0];
      
      const sheet = workbook.Sheets[sheetName];
      
      // تحويل البيانات إلى مصفوفة ثنائية الأبعاد
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      // التحقق من وجود بيانات
      if (jsonData.length === 0) {
        throw new Error('الملف لا يحتوي على بيانات');
      }
      
      // الصف الأول يمثل العناوين
      const headers = jsonData[0];
      
      // باقي الصفوف تمثل البيانات
      const rows = jsonData.slice(1);
      
      return { headers, rows };
    } catch (error) {
      console.error('خطأ في قراءة ملف Excel:', error);
      throw new Error('حدث خطأ في قراءة ملف Excel');
    }
  },
  
  // دالة لتصدير البيانات إلى ملف Excel
  exportToExcel(data, fileName = 'export.xlsx') {
    if (!data || !data.headers || !data.rows) {
      throw new Error('بيانات غير صالحة للتصدير');
    }
    
    // إنشاء مصفوفة البيانات بما في ذلك العناوين
    const exportData = [data.headers, ...data.rows];
    
    // إنشاء ورقة عمل
    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    
    // إنشاء مصنف عمل
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    // تصدير المصنف
    XLSX.writeFile(workbook, fileName);
  },
  
  // دالة لتحليل البيانات واستخراج الإحصائيات
  analyzeData(data) {
    if (!data || !data.headers || !data.rows || data.rows.length === 0) {
      return null;
    }
    
    // تحليل البيانات
    const result = {
      totalRows: data.rows.length,
      summary: {}
    };
    
    // البحث عن الأعمدة الرقمية وحساب متوسطها
    data.headers.forEach((header, index) => {
      // التحقق مما إذا كان العمود يحتوي على قيم رقمية
      const hasNumericValues = data.rows.some(row => {
        const value = row[index];
        return value !== undefined && value !== null && !isNaN(parseFloat(value));
      });
      
      if (hasNumericValues) {
        // حساب المتوسط للقيم الرقمية
        let sum = 0;
        let count = 0;
        
        data.rows.forEach(row => {
          const value = row[index];
          if (value !== undefined && value !== null && !isNaN(parseFloat(value))) {
            sum += parseFloat(value);
            count++;
          }
        });
        
        if (count > 0) {
          result.summary[header] = {
            average: sum / count,
            count: count
          };
        }
      }
    });
    
    return result;
  }
};

export default ExcelService;
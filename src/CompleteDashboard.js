import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const CompleteDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableData, setTableData] = useState([]);
  
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
  
  useEffect(() => {
    const loadExcelData = async () => {
      try {
        setLoading(true);
        
        // قراءة الملف
        const fileContent = await window.fs.readFile('EDJDGEN42024DEC10.xlsx');
        const workbook = XLSX.read(fileContent, { type: 'array' });
        
        // الوصول إلى ورقة العمل المطلوبة
        const sheetName = "ED KPIs 1-6 - manual";
        const sheet = workbook.Sheets[sheetName];
        
        // تحديد الأعمدة التي سنعرضها (جميع الأعمدة من AB إلى AX)
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
        
        // استخراج العناوين الفعلية من Excel
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
        
        // استخراج البيانات من الصفوف 2 إلى 7
        const rows = [];
        for (let rowIndex = 2; rowIndex <= 7; rowIndex++) {
          const rowData = [];
          
          for (const column of columnIds) {
            const cellAddress = `${column.id}${rowIndex}`;
            const cell = sheet[cellAddress];
            
            let formattedValue = '';
            
            if (cell) {
              // معالجة خاصة حسب نوع العمود
              const columnLabel = column.label.toLowerCase();
              
              // معالجة KPI 4: Non Urgent وPatients by urgency %
              if (columnLabel.includes('non urgent') || columnLabel.includes('patients by urgency')) {
                if (cell.t === 'n') {
                  formattedValue = `${Math.round(cell.v * 100)}%`;
                } else {
                  formattedValue = cell.v === 0 ? '0%' : `${cell.v}`;
                }
              }
              // معالجة جميع أعمدة النسب المئوية
              else if (columnLabel.includes('%') || columnLabel.includes('rate')) {
                if (cell.t === 'n') {
                  if (cell.v < 1) {
                    formattedValue = `${Math.round(cell.v * 100)}%`;
                  } else {
                    formattedValue = `${Math.round(cell.v)}%`;
                  }
                } else {
                  formattedValue = cell.v === 0 ? '0%' : `${cell.v}`;
                }
              }
              // معالجة أعمدة الأوقات
              else if (columnLabel.includes('time') || columnLabel.includes('door to') || 
                       columnLabel.includes('decision to') || columnLabel.includes('doc to')) {
                if (cell.t === 'n') {
                  // تحويل القيمة إلى ساعات:دقائق
                  const totalMinutes = Math.round(cell.v * 24 * 60);
                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = totalMinutes % 60;
                  formattedValue = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                } else if (cell.v) {
                  // إذا كانت قيمة نصية غير فارغة
                  formattedValue = cell.v;
                } else {
                  formattedValue = '';
                }
              }
              // معالجة أعمدة الأعداد
              else if (columnLabel.includes('total') || columnLabel.includes('volume') || 
                       columnLabel.includes('patients') || columnLabel === 'ctas') {
                if (cell.t === 'n') {
                  formattedValue = Math.round(cell.v).toString();
                } else if (cell.v) {
                  formattedValue = cell.v.toString();
                } else {
                  formattedValue = '';
                }
              }
              // للأعمدة الأخرى
              else if (cell.v !== undefined && cell.v !== null) {
                formattedValue = cell.v.toString();
              }
            }
            
            rowData.push(formattedValue);
          }
          
          rows.push(rowData);
        }
        
        setTableData({ headers, rows });
        setLoading(false);
      } catch (err) {
        console.error("خطأ في قراءة البيانات:", err);
        setError("حدث خطأ أثناء قراءة البيانات: " + err.message);
        setLoading(false);
      }
    };
    
    loadExcelData();
  }, []);
  
  return (
    <div dir="rtl" className="p-4 bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">لوحة تحكم بيانات أقسام الطوارئ (ED)</h1>
      
      {loading ? (
        <div className="text-center p-6">
          <p className="text-lg">جاري تحميل البيانات...</p>
        </div>
      ) : error ? (
        <div className="text-center p-4 bg-red-100 rounded">
          <p className="text-red-700">{error}</p>
        </div>
      ) : (
        <div className="overflow-auto bg-white rounded shadow">
          <h2 className="text-xl font-semibold p-4 border-b">مؤشرات الأداء الرئيسية (KPIs)</h2>
          
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {tableData.headers.map((header, index) => (
                  <th key={index} className="p-3 text-right font-semibold border">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : ''}>
                  {row.map((cell, cellIndex) => {
                    // تحديد اللون بناءً على نوع المؤشر والقيمة
                    const columnHeader = tableData.headers[cellIndex];
                    const backgroundColor = getColorForValue(columnHeader, cell);
                    const textColor = backgroundColor ? 'white' : 'black';
                    
                    return (
                      <td 
                        key={cellIndex} 
                        className="p-3 border text-right" 
                        style={{ 
                          backgroundColor: backgroundColor || '', 
                          color: textColor
                        }}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CompleteDashboard;
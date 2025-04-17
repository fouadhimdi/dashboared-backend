// المعايير القياسية لمؤشرات الأداء الرئيسية في قسم الطوارئ
export const kpiBenchmarks = {
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
  "KPI 6: % LAMA & DAMA": {
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

/**
 * وظيفة لتحديد اللون المناسب لقيمة معينة بناءً على البنش مارك
 * @param {string} kpiName - اسم مؤشر الأداء الرئيسي
 * @param {*} value - القيمة المراد تقييمها
 * @returns {Object} - كائن يحتوي على لون الخلفية ولون النص
 */
export const getColorForKPI = (kpiName, value) => {
  // التعامل مع القيم النصية أو الفارغة
  if (value === '' || value === 'NA' || value === null || value === undefined) {
    return { backgroundColor: '', textColor: 'text-gray-900' };
  }
  
  // البحث عن البنش مارك المناسب
  let benchmark;
  
  // للمؤشرات التي تبدأ بـ KPI 3
  if (kpiName.startsWith("KPI 3: Decision to")) {
    benchmark = kpiBenchmarks["KPI 3: Decision to"];
  } else {
    // للمؤشرات الأخرى
    benchmark = kpiBenchmarks[kpiName];
  }
  
  // إذا لم يتم العثور على بنش مارك لهذا المؤشر
  if (!benchmark) {
    return { backgroundColor: '', textColor: 'text-gray-900' };
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
    return { backgroundColor: '', textColor: 'text-gray-900' };
  }
  
  // تحديد اللون بناءً على النطاقات
  if (benchmark.worldClass.max !== undefined && numericValue <= benchmark.worldClass.max) {
    return { backgroundColor: benchmark.worldClass.color, textColor: 'text-white' };
  } else if (benchmark.worldClass.min !== undefined && numericValue >= benchmark.worldClass.min) {
    return { backgroundColor: benchmark.worldClass.color, textColor: 'text-white' };
  } else if (benchmark.acceptable.min !== undefined && benchmark.acceptable.max !== undefined && 
             numericValue >= benchmark.acceptable.min && numericValue <= benchmark.acceptable.max) {
    return { backgroundColor: benchmark.acceptable.color, textColor: 'text-white' };
  } else if (benchmark.needsImprovement.min !== undefined && benchmark.needsImprovement.max !== undefined && 
             numericValue >= benchmark.needsImprovement.min && numericValue <= benchmark.needsImprovement.max) {
    return { backgroundColor: benchmark.needsImprovement.color, textColor: 'text-gray-900' };
  } else if (benchmark.unacceptable.min !== undefined && numericValue >= benchmark.unacceptable.min) {
    return { backgroundColor: benchmark.unacceptable.color, textColor: 'text-white' };
  } else if (benchmark.unacceptable.max !== undefined && numericValue <= benchmark.unacceptable.max) {
    return { backgroundColor: benchmark.unacceptable.color, textColor: 'text-white' };
  }
  
  return { backgroundColor: '', textColor: 'text-gray-900' };
};
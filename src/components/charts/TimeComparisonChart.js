import React, { useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';

// مكتبة Chart.js - تسجيل المكونات المطلوبة فقط لتحسين الأداء
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
);

/**
 * مكون الرسم البياني لعرض البيانات على مدار الزمن مع تحسينات أداء
 * @param {Object} props خصائص المكون
 * @param {Array|Array[]} props.data مصفوفة من البيانات الرقمية أو مصفوفة من مصفوفات البيانات
 * @param {Array} props.labels التسميات (عادة تواريخ)
 * @param {String} props.title عنوان الرسم البياني
 * @param {String|Array} props.label تسمية مجموعة البيانات أو مصفوفة من التسميات
 * @param {String|Array} props.backgroundColor لون خلفية المنطقة تحت الخط أو مصفوفة من الألوان
 * @param {String|Array} props.borderColor لون الخط أو مصفوفة من الألوان
 * @param {Number} props.height ارتفاع الرسم البياني بالبكسل
 * @param {Number} props.yAxisMin الحد الأدنى للمحور Y
 * @param {Number} props.yAxisMax الحد الأقصى للمحور Y
 * @param {Boolean} props.isPercentage هل البيانات نسب مئوية
 * @param {Boolean} props.isTime هل البيانات زمنية (دقائق)
 * @param {Number} props.benchmark قيمة خط المرجعية للمقارنة
 * @param {String} props.yAxisLabel تسمية محور Y
 * @param {String} props.direction اتجاه العرض (rtl/ltr)
 * @param {Boolean} props.multipleDatasets هل البيانات متعددة المجموعات
 */
const TimeComparisonChart = ({ 
  data = [], 
  labels = [], 
  title, 
  label,
  backgroundColor = 'rgba(54, 162, 235, 0.2)',
  borderColor = 'rgba(54, 162, 235, 1)',
  height = 300,
  yAxisMin,
  yAxisMax,
  isPercentage = false,
  isTime = false,
  benchmark = null,
  yAxisLabel,
  direction = 'ltr',
  multipleDatasets = false
}) => {
  const chartRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [renderedOnce, setRenderedOnce] = useState(false);
  const observerRef = useRef(null);
  const containerRef = useRef(null);
  
  // تنسيق القيم المعروضة حسب نوعها (نسبة مئوية، وقت، أو عدد)
  const formatValue = (value) => {
    if (isTime && typeof value === 'number') {
      // تحسين تنسيق القيم الزمنية لتكون بنفس تنسيق الإكسل
      const hours = Math.floor(value / 60);
      const minutes = Math.floor(value % 60);
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    } else if (isPercentage && typeof value === 'number') {
      // عرض النسب المئوية برقمين عشريين دائماً
      return `${value.toFixed(2)}%`;
    }
    return value;
  };

  // تنسيق القيم للعرض على المحور العمودي
  const formatYAxisLabel = (value) => {
    if (isPercentage) {
      // عرض النسب المئوية برقمين عشريين دائماً
      return `${value.toFixed(2)}%`;
    }
    return value;
  };

  // خيارات الرسم البياني
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: isVisible ? 1000 : 0 // تفعيل الرسوم المتحركة فقط عندما يكون الرسم البياني مرئيًا
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        rtl: direction === 'rtl',
        labels: {
          boxWidth: 12,
          font: {
            family: 'Tajawal, Arial, sans-serif',
            size: 12
          },
          color: '#333333'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: {
          family: 'Tajawal, Arial, sans-serif',
          size: 14
        },
        bodyFont: {
          family: 'Tajawal, Arial, sans-serif',
          size: 13
        },
        padding: 10,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatValue(context.parsed.y);
            }
            return label;
          }
        }
      },
      title: {
        display: !!title,
        text: title || '',
        font: {
          family: 'Tajawal, Arial, sans-serif',
          size: 16,
          weight: 'bold'
        },
        color: '#333333',
        padding: {
          top: 10,
          bottom: 20
        }
      }
    },
    scales: {
      x: {
        reverse: direction === 'rtl',
        grid: {
          display: false
        },
        ticks: {
          font: {
            family: 'Tajawal, Arial, sans-serif',
            size: 11
          },
          maxRotation: 30,
          minRotation: 0
        }
      },
      y: {
        min: yAxisMin,
        max: yAxisMax,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            family: 'Tajawal, Arial, sans-serif',
            size: 11
          },
          callback: function(value) {
            return formatYAxisLabel(value);
          }
        },
        title: {
          display: !!yAxisLabel,
          text: yAxisLabel || '',
          font: {
            family: 'Tajawal, Arial, sans-serif',
            size: 12
          }
        }
      }
    },
    // تحسين أداء الرسم البياني
    elements: {
      line: {
        tension: 0.3 // تنعيم الخط قليلاً
      },
      point: {
        // تصغير حجم النقاط لتحسين الأداء
        radius: 3,
        hoverRadius: 5,
        hitRadius: 8 
      }
    },
    // استخدام المعالجة الإضافية فقط عند العرض للمستخدم
    devicePixelRatio: isVisible ? window.devicePixelRatio : 1
  };

  // بيانات الرسم البياني
  let chartData = {
    labels,
    datasets: []
  };

  // التعامل مع البيانات المتعددة أو المفردة
  if (multipleDatasets && Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
    // في حالة البيانات المتعددة، نفترض أن كل عنصر في مصفوفة data هو مجموعة بيانات منفصلة
    const labels_array = Array.isArray(label) ? label : [label, label, label];
    const bgColors_array = Array.isArray(backgroundColor) ? backgroundColor : [backgroundColor, backgroundColor, backgroundColor];
    const borderColors_array = Array.isArray(borderColor) ? borderColor : [borderColor, borderColor, borderColor];
    
    // إنشاء مجموعة بيانات لكل مصفوفة بيانات
    data.forEach((dataSet, index) => {
      chartData.datasets.push({
        label: labels_array[index] || `البيانات ${index + 1}`,
        data: dataSet,
        fill: false, // لتجنب تداخل المناطق المظللة
        backgroundColor: bgColors_array[index] || `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.2)`,
        borderColor: borderColors_array[index] || `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`,
        borderWidth: 2,
        pointBackgroundColor: borderColors_array[index] || `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`,
        tension: 0.3
      });
    });
  } else {
    // في حالة البيانات المفردة، استخدم طريقة الإضافة القديمة
    chartData.datasets.push({
      label: Array.isArray(label) ? label[0] : label || 'البيانات',
      data: data,
      fill: true,
      backgroundColor: Array.isArray(backgroundColor) ? backgroundColor[0] : backgroundColor,
      borderColor: Array.isArray(borderColor) ? borderColor[0] : borderColor,
      borderWidth: 2,
      pointBackgroundColor: Array.isArray(borderColor) ? borderColor[0] : borderColor,
      tension: 0.3
    });
  }

  // إضافة خط المعيار
  if (benchmark !== null) {
    chartData.datasets.push({
      label: 'القيمة المستهدفة',
      data: Array(labels.length).fill(benchmark),
      fill: false,
      backgroundColor: 'transparent',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0
    });
  }

  // استخدام Intersection Observer للتحميل الكسول (Lazy Loading)
  useEffect(() => {
    // تحسين الأداء للمتصفحات القديمة
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      setIsVisible(true);
      return () => {};
    }

    // إنشاء مراقب التقاطع
    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      setIsVisible(entry.isIntersecting);
      
      // توقف عن المراقبة بعد التحميل الأول
      if (entry.isIntersecting && !renderedOnce) {
        setRenderedOnce(true);
      }
    }, {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    });

    // بدء المراقبة
    if (containerRef.current) {
      observerRef.current.observe(containerRef.current);
    }

    return () => {
      if (observerRef.current && containerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [renderedOnce]);

  return (
    <div ref={containerRef} style={{ height: `${height}px`, direction: direction }}>
      {(isVisible || renderedOnce) ? (
        <Line 
          ref={chartRef}
          data={chartData} 
          options={options} 
        />
      ) : (
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-gray-400">جاري تحميل الرسم البياني...</div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TimeComparisonChart);
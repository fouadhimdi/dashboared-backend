import React, { useEffect, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// تسجيل المكونات المطلوبة فقط لتحسين الأداء
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/**
 * مكون الرسم البياني العمودي للمقارنات مع تحسينات الأداء
 * @param {Object} props خصائص المكون
 * @param {Array} props.data مصفوفة من البيانات الرقمية
 * @param {Array} props.labels التسميات
 * @param {String} props.title عنوان الرسم البياني
 * @param {String} props.label تسمية مجموعة البيانات
 * @param {Array} props.colors مصفوفة من الألوان
 * @param {Number} props.height ارتفاع الرسم البياني بالبكسل
 * @param {String} props.yAxisLabel تسمية محور Y
 * @param {String} props.direction اتجاه العرض (rtl/ltr)
 */
const ComparativeBarChart = ({
  data = [],
  labels = [],
  title,
  label,
  colors = ['rgba(54, 162, 235, 0.7)'],
  height = 300,
  yAxisLabel,
  direction = 'ltr'
}) => {
  const chartRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [renderedOnce, setRenderedOnce] = useState(false);
  const observerRef = useRef(null);
  const containerRef = useRef(null);

  // خيارات الرسم البياني
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: isVisible ? 800 : 0 // تفعيل الرسوم المتحركة فقط عندما يكون الرسم البياني مرئيًا
    },
    plugins: {
      legend: {
        display: false, // إخفاء وسيلة الإيضاح لتحسين الأداء
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
              // Formatear a 2 decimales para porcentajes y valores
              const value = parseFloat(context.parsed.y);
              if (label.includes('نسبة') || label.includes('معدل') || title.includes('معدل') || title.includes('نسبة')) {
                label += value.toFixed(2) + '%';
              } else {
                // تنسيق القيم الكبيرة بفواصل الألوف
                label += value.toLocaleString(undefined, { 
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2 
                });
              }
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
          maxRotation: 35,
          minRotation: 0
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            family: 'Tajawal, Arial, sans-serif',
            size: 11
          },
          callback: function(value) {
            // تنسيق القيم الكبيرة
            if (value >= 1000) {
              return value >= 1000000
                ? (value / 1000000).toFixed(1) + 'M'
                : (value / 1000).toFixed(0) + 'K';
            }
            return value;
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
    devicePixelRatio: isVisible ? window.devicePixelRatio : 1
  };

  // تكرار الألوان إذا كان هناك عناصر بيانات أكثر من الألوان المتوفرة
  const ensureColors = (dataLength) => {
    if (!colors || colors.length === 0) {
      return Array(dataLength).fill('rgba(54, 162, 235, 0.7)');
    }
    if (colors.length >= dataLength) {
      return colors.slice(0, dataLength);
    }
    const repeatedColors = [];
    for (let i = 0; i < dataLength; i++) {
      repeatedColors.push(colors[i % colors.length]);
    }
    return repeatedColors;
  };

  // بيانات الرسم البياني
  const chartData = {
    labels,
    datasets: [
      {
        label: label || 'البيانات',
        data,
        backgroundColor: ensureColors(data.length),
        borderWidth: 0
      }
    ]
  };

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
      rootMargin: '100px', // تحميل الرسم البياني مسبقًا قليلاً قبل ظهوره
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
        <Bar 
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

export default React.memo(ComparativeBarChart);
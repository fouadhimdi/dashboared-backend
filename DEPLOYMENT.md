# دليل النشر - نظام إدارة المؤشرات الصحية

## إعداد المشروع للنشر على Render

### 1. ملفات الإعداد المطلوبة ✅

- `render.yaml` - إعدادات النشر على Render
- `.env` - متغيرات البيئة
- `server.js` - الخادم المحدث للإنتاج
- `package.json` - البرامج النصية المحدثة

### 2. إعدادات API ✅

جميع الصفحات تم تحديثها لاستخدام:
- قاعدة URL ديناميكية تتكيف مع بيئة الإنتاج
- استدعاءات API محدثة لتعمل مع `/api`
- معالجة أخطاء محسنة

### 3. خطوات النشر

#### أ. رفع المشروع إلى GitHub
```bash
git add .
git commit -m "إعداد المشروع للنشر على Render"
git push origin main
```

#### ب. إنشاء خدمة جديدة على Render
1. اذهب إلى [render.com](https://render.com)
2. سجل دخول أو أنشئ حساب جديد
3. انقر على "New +" > "Web Service"
4. اربط مستودع GitHub الخاص بك
5. اختر المستودع `ed-dashboard`

#### ج. إعدادات النشر على Render
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment**: Node
- **Plan**: Free (للاختبار)

#### د. متغيرات البيئة
أضف في Render Dashboard:
```
NODE_ENV=production
PORT=10000
REACT_APP_API_URL=/api
```

### 4. هيكل الملفات المحدث

```
ed-dashboard/
├── build/                 # ملفات الإنتاج
├── public/
│   └── data/              # ملفات Excel للبيانات
├── src/
│   ├── pages/             # جميع الصفحات محدثة
│   ├── services/          # خدمات محدثة
│   └── ...
├── server.js              # خادم محدث للإنتاج
├── render.yaml            # إعدادات Render
├── .env                   # متغيرات البيئة
└── package.json           # برامج نصية محدثة
```

### 5. الميزات المحدثة ✅

- **API ديناميكي**: يتكيف مع بيئة التطوير والإنتاج
- **أمان محسن**: CORS محدث للإنتاج
- **معالجة أخطاء**: أفضل لتجربة المستخدم
- **أداء محسن**: تحميل سريع للبيانات
- **استجابة**: يعمل على جميع الأجهزة

### 6. اختبار النشر

بعد النشر، تحقق من:
- [ ] تحميل الصفحة الرئيسية
- [ ] تسجيل الدخول
- [ ] تحميل ملفات Excel
- [ ] عرض المؤشرات
- [ ] التنقل بين الصفحات

### 7. استكشاف الأخطاء

إذا واجهت مشاكل:
1. تحقق من logs في Render Dashboard
2. تأكد من صحة متغيرات البيئة
3. تحقق من مسارات الملفات في `/public/data/`

### 8. تحديث البيانات

لإضافة ملفات Excel جديدة:
1. ارفع الملفات إلى `public/data/[DEPARTMENT]/`
2. تأكد من تسمية الملفات بالتنسيق: `DEPT-JD-GEN-4-YYYY-MMM-DD.xlsx`
3. سيتم تحميلها تلقائياً في التطبيق

### 9. الصيانة

- راقب الأداء في Render Dashboard
- حدث البيانات بانتظام
- اعمل نسخ احتياطية من الملفات المهمة

## تم إعداد المشروع بنجاح للنشر! 🚀
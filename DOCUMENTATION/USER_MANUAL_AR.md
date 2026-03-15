# دليل المستخدم - نظام التعرف على الوجه

الإصدار: 1.0.1  
التاريخ: 2026-03-12

## 1. الهدف

هذا الدليل يشرح طريقة استخدام وتشغيل نظام التعرف على الوجه في بيئة العمل.
ويغطي:

- بنية النظام (Architecture)
- الأدوار والصلاحيات
- سير العمل اليومي
- الإشعارات الفورية وحالة الاتصال
- سلوك الأمان
- استكشاف الأعطال

## 2. شرح البنية المعمارية

النظام مبني على نموذج عميل/خادم (Client-Server) مع خادم مركزي في مركز الإدارة وعدة عملاء في نقاط المراقبة.

### 2.1 المكونات الرئيسية

- أجهزة نقاط المراقبة: تعمل عليها واجهة React للمشغلين.
- جهاز مركز الإدارة: يشغل Django API وWebSocket وقاعدة البيانات PostgreSQL وخادم النموذج.
- خادم النموذج: مسؤول عن معالجة التعرف على الوجه.

### 2.2 تدفق البيانات والتحكم

1. المستخدم يسجل الدخول من واجهة React.
2. Django يتحقق من بيانات الدخول ثم يحفظ JWT في Cookies من نوع HTTP-only.
3. الواجهة ترسل طلبات REST مع `credentials: include`.
4. اتصالات WebSocket يتم توثيقها باستخدام JWT من Cookies.
5. Socket الحضور الخاص بالضيف يحدث حالة Online/Offline.
6. Socket إشعارات الإدارة يستقبل تحديثات مباشرة عند اتصال/انقطاع الضيوف.
7. مستهلك بث الفيديو يعالج الإطارات ويرسل نتائج الكشف للواجهة.
8. كل البيانات التشغيلية تُحفظ وتُقرأ من PostgreSQL.

### 2.3 مخطط منطقي مبسط

```text
نقاط المراقبة
  React Client (واجهة + سياق مصادقة + سياق لغة)
      | HTTP + WebSocket
      v
مركز الإدارة
  Django + DRF + Channels (المنفذ 8000)
      |-- PostgreSQL (المستخدمون، الأدوار، السجلات، الحضور)
      |-- Model Server (التعرف على الوجه)
```

### 2.4 ملفات أساسية في التطبيق

- `ADMINISTRATION_POST/DJANGO_SERVER/server/auth_views.py`: مصادقة، أدوار، إدارة الضيوف، CSRF.
- `ADMINISTRATION_POST/DJANGO_SERVER/server/urls.py`: تعريف مسارات REST.
- `ADMINISTRATION_POST/DJANGO_SERVER/server/routing.py`: تعريف مسارات WebSocket.
- `ADMINISTRATION_POST/DJANGO_SERVER/server/consumers.py`: بث الفيديو والإشعارات والحضور.
- `SURVEILLANCE_POST/REACT_CLIENT/src/services/api.js`: طلبات API وCSRF.
- `SURVEILLANCE_POST/REACT_CLIENT/src/context/AuthContext.jsx`: حالة المستخدم واتصال حضور الضيف.

## 3. الأدوار والصلاحيات

### 3.1 دور المدير (admin)

المدير يمكنه:

- الوصول الكامل للوحة التحكم وصفحات الإدارة.
- إدارة الشركات والأشخاص والكاميرات والسجلات.
- إنشاء Grant Tokens آمنة لإنشاء الحسابات.
- إدارة حسابات الضيوف (إضافة/تعديل/تعطيل/حذف).
- متابعة حالة اتصال الضيوف بشكل مباشر.

### 3.2 دور الضيف (guest)

الضيف يمكنه:

- تسجيل الدخول واستخدام المسارات المسموح بها فقط.
- العمل على صفحات التشغيل المخصصة له.
- إرسال حالة الحضور عبر WebSocket أثناء الاتصال.

## 4. المصادقة والأمان

### 4.1 JWT وCookies

- يتم تخزين `access_token` و`refresh_token` داخل Cookies من نوع HTTP-only.
- Access Token قصير المدة.
- Refresh Token يدعم التدوير (rotation) مع blacklist.

### 4.2 حماية CSRF

- الواجهة تطلب CSRF من `/api/auth/csrf/`.
- كل طلبات `POST/PUT/PATCH/DELETE` ترسل `X-CSRFToken`.

### 4.3 الحماية من المحاولات الفاشلة

- يتم احتساب محاولات تسجيل الدخول الفاشلة.
- يتم تطبيق قفل مؤقت عند تجاوز الحد.
- يوجد throttling على نقاط المصادقة والإدارة.

### 4.4 حماية كلمات مرور الكاميرات

- كلمات مرور الكاميرات تُخزن بشكل مشفر في قاعدة البيانات.

## 5. نقاط الربط (Endpoints)

### 5.1 مصادقة وإدارة حسابات

- `GET /api/auth/csrf/`
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `POST /api/auth/refresh/`
- `GET /api/auth/me/`
- `POST /api/auth/grant-token/` (للمدير)
- `POST /api/auth/register-with-token/`
- `POST /api/auth/grant-role/` (للمدير)
- `GET/POST /api/auth/guests/` (للمدير)
- `PATCH/DELETE /api/auth/guests/{user_id}/` (للمدير)

### 5.2 WebSocket

- `/ws/video/stream/`
- `/ws/face/recognize/`
- `/ws/presence/guest/`
- `/ws/admin/notifications/`

## 6. مسارات الواجهة الأمامية

### 6.1 عامة

- `/login`
- `/register-with-token`

### 6.2 للمدير

- `/home`
- `/compagnies/`
- `/persons/`
- `/cameras/`
- `/spectacles/`
- `/access-control/`

### 6.3 مشتركة (مدير/ضيف)

- `/video-stream/`
- `/check-ins/`
- `/rentrees/`

## 7. طريقة التشغيل اليومية

### 7.1 المدير

1. شغّل خدمات مركز الإدارة.
2. سجّل الدخول بحساب المدير.
3. ادخل إلى صفحة `Access Control`.
4. أنشئ رمز Grant أو أنشئ حساب ضيف مباشرة.
5. راقب حالة اتصال الضيوف من لوحة التحكم.

### 7.2 الضيف

1. شغّل عميل نقطة المراقبة.
2. سجّل الدخول بالحساب المخصص.
3. استخدم الصفحات التشغيلية المسموحة.
4. عند انتهاء العمل، استخدم تسجيل الخروج.

## 8. بدء الخدمات

### 8.1 مركز الإدارة

استخدم:

- `ADMINISTRATION_POST/START_ADMIN_SERVICES.ps1`

يبدأ:

- PostgreSQL
- Model Server على `localhost:5000`
- Django ASGI على `0.0.0.0:8000`

### 8.2 نقطة المراقبة

استخدم:

- `SURVEILLANCE_POST/START_SURVEILLANCE_CLIENT.ps1`

يتحقق من الاتصال ثم يبدأ تطبيق React.

## 9. الإعدادات المهمة

### 9.1 إعدادات الخلفية

الملف:

- `ADMINISTRATION_POST/DJANGO_SERVER/.env`

قيم مهمة:

- `SECRET_KEY`, `DEBUG`
- `ALLOWED_HOSTS`
- `DB_*`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `AUTH_COOKIE_*`
- `AUTH_LOGIN_MAX_ATTEMPTS`, `AUTH_LOGIN_LOCK_MINUTES`
- `THROTTLE_*`

### 9.2 إعدادات الواجهة

حاليًا `api.js` يستخدم `http://localhost:8000/api`.
في النشر الشبكي يجب ضبط API وWebSocket على عنوان IP الخاص بجهاز الإدارة.

## 10. استكشاف الأعطال

### 10.1 فشل تسجيل الدخول

- تحقق من اسم المستخدم وكلمة المرور.
- إذا تم تفعيل القفل المؤقت، انتظر مدة القفل.

### 10.2 الضيف لا يظهر Online

- تحقق أن الضيف سجّل الدخول.
- افحص اتصال `/ws/presence/guest/` من أدوات المتصفح.
- تأكد أن Django Channels يعمل.

### 10.3 لا توجد إشعارات للمدير

- تحقق من اتصال `/ws/admin/notifications/`.
- تأكد من أن الدور الفعلي للحساب هو `admin`.

### 10.4 الواجهة لا تصل إلى API

- تحقق من عنوان IP وجدار الحماية (المنفذ 8000).
- تحقق من إعدادات CORS وCSRF Trusted Origins.

## 11. اللغة العربية والإنجليزية

- تبديل اللغة يتم من `LangContext`.
- الواجهة تدعم العربية والإنجليزية للنصوص الرئيسية.
- الصلاحيات والمسارات لا تتغير حسب اللغة.

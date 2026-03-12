import { createContext, useContext, useState } from 'react';

// ---------------------------------------------------------------------------
// Translation catalogue
// All user-visible strings are stored here.
// Keys are semantic English identifiers; values are the rendered strings.
// ---------------------------------------------------------------------------
const translations = {
  en: {
    toggleLang: 'عربي',

    // ── Navigation ──────────────────────────────────────────────────────────
    appTitle: 'Face Recognition System',
    navVideoStream: 'Video Stream',
    navCheckIns: 'Check-Ins',
    navCompanies: 'Companies',
    navPersons: 'Persons',
    navCameras: 'Cameras',
    navSpectacles: 'Outings',
    navReturns: 'Returns',

    // ── Common ───────────────────────────────────────────────────────────────
    loading: 'Loading…',
    errorPrefix: 'Error',
    edit: 'Edit',
    delete: 'Delete',
    create: 'Create',
    update: 'Update',
    cancel: 'Cancel',
    activate: 'Activate',
    deactivate: 'Deactivate',
    actions: 'Actions',

    // ── Companies ────────────────────────────────────────────────────────────
    companiesTitle: 'Companies',
    addCompany: 'Add Company',
    editCompany: 'Edit Company',
    companyName: 'Company Name',
    deleteConfirmCompany: 'Are you sure you want to delete this company?',

    // ── Persons ──────────────────────────────────────────────────────────────
    personsTitle: 'Persons',
    addPerson: 'Add Person',
    editPerson: 'Edit Person',
    matricule: 'Matricule',
    lastName: 'Last Name',
    firstName: 'First Name',
    company: 'Company',
    selectCompany: 'Select Company',
    deleteConfirmPerson: 'Are you sure you want to delete this person?',

    // ── Cameras ──────────────────────────────────────────────────────────────
    camerasTitle: 'Cameras',
    addCamera: 'Add Camera',
    editCamera: 'Edit Camera',
    ipAddress: 'IP Address',
    modelName: 'Model Name',
    username: 'Username',
    password: 'Password',
    rtspPort: 'RTSP Port',
    streamPath: 'Stream Path',
    rtspPreviewLabel: 'RTSP URL Preview',
    checkStreams: 'Check Streams Now',
    statusOnline: 'ONLINE',
    statusOffline: 'OFFLINE',
    statusChecking: 'CHECKING…',
    streamLabel: 'Stream',
    userLabel: 'User',
    ipLabel: 'IP',
    rtspLabel: 'RTSP',
    deleteConfirmCamera: 'Are you sure you want to delete this camera?',

    // ── Spectacles (Outings) ─────────────────────────────────────────────────
    spectaclesTitle: 'Outings',
    addSpectacle: 'Add Outing',
    editSpectacle: 'Edit Outing',
    filterAll: 'All',
    filterPending: 'Pending',
    filterCompleted: 'Completed',
    dateSortieLabel: 'Exit Date',
    dateLimiteLabel: 'Return Deadline',
    dateRentreeLabel: 'Return Date',
    dateRentreeOptional: 'Return Date (optional)',
    markReturned: 'Mark Returned',
    person: 'Person',
    selectPerson: 'Select Person',
    dropzoneText: 'Drag and drop an Excel file here (.xlsx, .xls)',
    chooseExcel: 'Choose Excel File',
    excelHint: 'Expected columns: matricule (or mat), date_sortie; optional: date_rentree, date_limite_retour.',
    importedPrefix: 'Imported',
    importedCreated: 'created',
    importedErrors: 'error(s)',
    sortieLabel: 'Exit',
    limiteLabel: 'Deadline',
    rentreeLabel: 'Return',
    pendingBadge: 'Pending',
    completedBadge: 'Completed',
    deleteConfirmSpectacle: 'Are you sure you want to delete this outing record?',

    // ── Rentrees (Returns) ───────────────────────────────────────────────────
    rentreesTitle: 'Returns',
    allReturns: 'All Returns',
    lateReturnsOnly: 'Late Returns Only',
    startCameraRecognition: 'Start Camera Recognition',
    stopCameraRecognition: 'Stop Camera Recognition',
    recentEvents: 'Recent Camera Return Events',
    lateLabel: 'Late',
    onTimeLabel: 'On Time',
    cameraStatus: 'Camera',

    // ── Check-Ins ────────────────────────────────────────────────────────────
    checkInsTitle: 'Face Recognition — Check-Ins',
    startRecognition: 'Start Recognition',
    stopRecognition: 'Stop Recognition',
    noFacesDetected: 'No faces detected',
    unknownPerson: 'Unknown Person',
    stateLabel: 'State',
    companyLabel: 'Company',
    exitDateLabel: 'Exit Date',
    errorLabel: 'Error',
    timeLabel: 'Time',
    inSpectacle: 'IN OUTING',
    notOnSpectacle: 'NOT IN OUTING',
    noMatch: 'NO MATCH',
    unknown: 'UNKNOWN',

    // ── Video Stream ─────────────────────────────────────────────────────────
    videoStreamTitle: 'Face Recognition — Live Video Stream',
    connect: 'Connect',
    disconnect: 'Disconnect',
    detectionsTitle: 'Detections',
    fpsLabel: 'FPS',
    facesDetectedLabel: 'Faces Detected',
    face: 'Face',
    statusLabel: 'Status',
    compagnieLabel: 'Organisation',
    noFacesText: 'No faces detected',
    dataUnavailable: 'Detection data unavailable',

    // ── Home ─────────────────────────────────────────────────────────────────
    homeTitle: 'Face Recognition System',
    homeWelcome: 'Welcome to the Face Recognition System. Use the navigation menu to access the available features.',
    homeVideoStream: 'Video Stream',
    homeVideoStreamDesc: 'Real-time face recognition with live WebSocket streaming.',
    homeCheckIns: 'Check-Ins',
    homeCheckInsDesc: 'Face recognition check-in system with colour-coded status indicators.',
    homeCompanies: 'السريات',
    homeCompaniesDesc: 'إدارة سجلات السريات والارتباطات التنظيمية.',
    homePersons: 'الأفْرَادُ',
    homePersonsDesc: 'إدارة ملفات الأفراد وبيانات التعرّف على الوجه.',
    homeCameras: 'Cameras',
    homeCamerasDesc: 'Configure and manage RTSP camera feeds.',
    homeSpectacles: 'Outings',
    homeSpectaclesDesc: 'Track outing requests, exit dates, and return deadlines.',
    homeReturns: 'Returns',
    homeReturnsDesc: 'Monitor and manage return records and late arrivals.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  ar: {
    toggleLang: 'English',

    // ── Navigation ──────────────────────────────────────────────────────────
    appTitle: 'نظام التعرف على الوجه',
    navVideoStream: 'بث مباشر',
    navCheckIns: 'تسجيل الحضور',
    navCompanies: 'السريات',
    navPersons: 'الأفْرَادُ',
    navCameras: 'الكاميرات',
    navSpectacles: 'سجلات الخروج',
    navReturns: 'سجلات العودة',

    // ── Common ───────────────────────────────────────────────────────────────
    loading: 'جاري التحميل…',
    errorPrefix: 'خطأ',
    edit: 'تعديل',
    delete: 'حذف',
    create: 'إنشاء',
    update: 'تحديث',
    cancel: 'إلغاء',
    activate: 'تفعيل',
    deactivate: 'إلغاء التفعيل',
    actions: 'الإجراءات',

    // ── Companies ────────────────────────────────────────────────────────────
    companiesTitle: 'Companies',
    addCompany: 'Add Company',
    editCompany: 'Edit Company',
    companyName: 'Company Name',
    deleteConfirmCompany: 'Are you sure you want to delete this company?',

    // ── Persons ──────────────────────────────────────────────────────────────
    personsTitle: 'الأفْرَادُ',
    addPerson: 'إضافة فرد',
    editPerson: 'تعديل الفرد',
    matricule: 'المعرّف',
    lastName: 'اللقب',
    firstName: 'الاسم الأول',
    company: 'السرية',
    selectCompany: 'اختر السرية',
    deleteConfirmPerson: 'هل أنت متأكد من حذف هذا الفرد؟',

    // ── Cameras ──────────────────────────────────────────────────────────────
    camerasTitle: 'الكاميرات',
    addCamera: 'إضافة كاميرا',
    editCamera: 'تعديل الكاميرا',
    ipAddress: 'عنوان IP',
    modelName: 'طراز الكاميرا',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    rtspPort: 'منفذ RTSP',
    streamPath: 'مسار البث',
    rtspPreviewLabel: 'معاينة رابط RTSP',
    checkStreams: 'فحص البثوث الآن',
    statusOnline: 'متصل',
    statusOffline: 'غير متصل',
    statusChecking: 'جاري الفحص…',
    streamLabel: 'البث',
    userLabel: 'المستخدم',
    ipLabel: 'العنوان',
    rtspLabel: 'RTSP',
    deleteConfirmCamera: 'هل أنت متأكد من حذف هذه الكاميرا؟',

    // ── Spectacles (Outings) ─────────────────────────────────────────────────
    spectaclesTitle: 'سجلات الخروج',
    addSpectacle: 'إضافة سجل خروج',
    editSpectacle: 'تعديل سجل الخروج',
    filterAll: 'الكل',
    filterPending: 'قيد الانتظار',
    filterCompleted: 'مكتملة',
    dateSortieLabel: 'تاريخ الخروج',
    dateLimiteLabel: 'تاريخ حد العودة',
    dateRentreeLabel: 'تاريخ العودة',
    dateRentreeOptional: 'تاريخ العودة (اختياري)',
    markReturned: 'تسجيل العودة',
    person: 'الفرد',
    selectPerson: 'اختر الفرد',
    dropzoneText: 'اسحب وأفلت ملف Excel هنا (.xlsx, .xls)',
    chooseExcel: 'اختر ملف Excel',
    excelHint: 'الأعمدة المتوقعة: المعرّف (أو mat)، تاريخ الخروج؛ اختياري: تاريخ العودة، حد العودة.',
    importedPrefix: 'تم استيراد',
    importedCreated: 'سجل مُنشأ',
    importedErrors: 'خطأ',
    sortieLabel: 'الخروج',
    limiteLabel: 'الحد',
    rentreeLabel: 'العودة',
    pendingBadge: 'قيد الانتظار',
    completedBadge: 'مكتمل',
    deleteConfirmSpectacle: 'هل أنت متأكد من حذف سجل الخروج هذا؟',

    // ── Rentrees (Returns) ───────────────────────────────────────────────────
    rentreesTitle: 'سجلات العودة',
    allReturns: 'جميع العودات',
    lateReturnsOnly: 'العودات المتأخرة فقط',
    startCameraRecognition: 'بدء التعرف بالكاميرا',
    stopCameraRecognition: 'إيقاف التعرف بالكاميرا',
    recentEvents: 'أحداث العودة الأخيرة',
    lateLabel: 'متأخر',
    onTimeLabel: 'في الوقت',
    cameraStatus: 'الكاميرا',

    // ── Check-Ins ────────────────────────────────────────────────────────────
    checkInsTitle: 'التعرف على الوجه — تسجيل الحضور',
    startRecognition: 'بدء التعرف',
    stopRecognition: 'إيقاف التعرف',
    noFacesDetected: 'لم يُرصد أي وجه',
    unknownPerson: 'فرد مجهول',
    stateLabel: 'الحالة',
    companyLabel: 'Company',
    exitDateLabel: 'تاريخ الخروج',
    errorLabel: 'خطأ',
    timeLabel: 'الوقت',
    inSpectacle: 'في الخروج',
    notOnSpectacle: 'ليس في خروج',
    noMatch: 'لا تطابق',
    unknown: 'مجهول',

    // ── Video Stream ─────────────────────────────────────────────────────────
    videoStreamTitle: 'التعرف على الوجه — بث مباشر',
    connect: 'اتصال',
    disconnect: 'قطع الاتصال',
    detectionsTitle: 'الاكتشافات',
    fpsLabel: 'إطارات/ث',
    facesDetectedLabel: 'الوجوه المكتشفة',
    face: 'وجه',
    statusLabel: 'الحالة',
    compagnieLabel: 'المؤسسة',
    noFacesText: 'لم يُرصد أي وجه',
    dataUnavailable: 'بيانات الاكتشاف غير متاحة',

    // ── Home ─────────────────────────────────────────────────────────────────
    homeTitle: 'نظام التعرف على الوجه',
    homeWelcome: 'مرحباً بك في نظام التعرف على الوجه. استخدم قائمة التنقل للوصول إلى الميزات المتاحة.',
    homeVideoStream: 'بث مباشر',
    homeVideoStreamDesc: 'بث فيديو مباشر مع التعرف على الوجه عبر WebSocket.',
    homeCheckIns: 'تسجيل الحضور',
    homeCheckInsDesc: 'نظام تسجيل الحضور بالتعرف على الوجه مع مؤشرات حالة ملوّنة.',
    homeCompanies: 'Companies',
    homeCompaniesDesc: 'Manage company records and organisational associations.',
    homePersons: 'الأفْرَادُ',
    homePersonsDesc: 'إدارة ملفات الأفراد وبيانات التعرّف على الوجه.',
    homeCameras: 'الكاميرات',
    homeCamerasDesc: 'ضبط وإدارة بثوث كاميرات RTSP.',
    homeSpectacles: 'سجلات الخروج',
    homeSpectaclesDesc: 'تتبع طلبات الخروج، تواريخ المغادرة، ومواعيد العودة.',
    homeReturns: 'سجلات العودة',
    homeReturnsDesc: 'مراقبة وإدارة سجلات العودة والتأخيرات.',
  },
};

// ---------------------------------------------------------------------------
export const LangContext = createContext(null);

export const LangProvider = ({ children }) => {
  const [lang, setLang] = useState('en');
  const toggle = () => setLang((l) => (l === 'en' ? 'ar' : 'en'));
  const T = translations[lang];
  return (
    <LangContext.Provider value={{ lang, toggle, T }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);

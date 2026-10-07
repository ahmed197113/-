// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appName => 'برّ';

  @override
  String get continueLabel => 'متابعة';

  @override
  String get next => 'التالي';

  @override
  String get skip => 'تخطي';

  @override
  String get start => 'ابدأ الآن';

  @override
  String get cancel => 'إلغاء';

  @override
  String get confirm => 'تأكيد';

  @override
  String get retry => 'إعادة المحاولة';

  @override
  String get save => 'حفظ';

  @override
  String get close => 'إغلاق';

  @override
  String get optional => 'اختياري';

  @override
  String get onboarding1Title => 'اطمئن على والديك كل يوم';

  @override
  String get onboarding1Body =>
      'مهما بعدت المسافة، تبقى قريبًا. ضغطة واحدة من والدك تخبرك أنه بخير.';

  @override
  String get onboarding2Title => 'لا دواء يُنسى بعد اليوم';

  @override
  String get onboarding2Body =>
      'تذكير واضح بالصوت والصورة على جوال والدك، ويصلك إشعار إن فاته دواء.';

  @override
  String get onboarding3Title => 'رعاية يتقاسمها الإخوة';

  @override
  String get onboarding3Body =>
      'عائلة واحدة، ومهام واضحة، وكل الإخوة على اطلاع. البرّ مسؤولية مشتركة.';

  @override
  String get welcomeTitle => 'أهلًا بك في برّ';

  @override
  String get welcomeSubtitle => 'رعاية الوالدين، بقلب واحد';

  @override
  String get welcomeStartWithPhone => 'التسجيل برقم الجوال';

  @override
  String get welcomeHaveLinkCode => 'أنا الأب/الأم ومعي رمز من أولادي';

  @override
  String get phoneTitle => 'رقم جوالك';

  @override
  String get phoneSubtitle => 'سنرسل لك رمز تحقق برسالة نصية';

  @override
  String get phoneHint => '05xxxxxxxx';

  @override
  String get phoneInvalid => 'رقم الجوال غير صحيح';

  @override
  String get sendCode => 'إرسال الرمز';

  @override
  String get otpTitle => 'رمز التحقق';

  @override
  String otpSentTo(String phone) {
    return 'أرسلنا رمزًا من 6 أرقام إلى $phone';
  }

  @override
  String get otpInvalidLength => 'أدخل الرمز كاملًا (6 أرقام)';

  @override
  String get verify => 'تحقق';

  @override
  String get resendCode => 'إعادة إرسال الرمز';

  @override
  String resendIn(int seconds) {
    return 'إعادة الإرسال بعد $seconds ث';
  }

  @override
  String get demoOtpHint => 'وضع التجربة: الرمز هو 123456';

  @override
  String get accountTypeTitle => 'من أنت؟';

  @override
  String get accountTypeSubtitle => 'نختار لك الواجهة المناسبة';

  @override
  String get accountTypeCaregiver => 'أنا ابن / ابنة';

  @override
  String get accountTypeCaregiverDesc => 'أتابع رعاية والديّ وأنسّق مع إخوتي';

  @override
  String get accountTypeElder => 'أنا الأب / الأم';

  @override
  String get accountTypeElderDesc => 'واجهة بسيطة بأزرار كبيرة';

  @override
  String get yourName => 'اسمك';

  @override
  String get nameRequired => 'اكتب اسمك من فضلك';

  @override
  String get createFamilyTitle => 'أنشئ مساحة عائلتك';

  @override
  String get createFamilySubtitle => 'مساحة خاصة تجمعك بوالديك وإخوتك';

  @override
  String get familyNameLabel => 'اسم العائلة';

  @override
  String get familyNameHint => 'مثال: عائلة أبو محمد';

  @override
  String get createFamily => 'إنشاء العائلة';

  @override
  String get myFamily => 'عائلتي';

  @override
  String get parentsSection => 'الوالدان';

  @override
  String get membersSection => 'أفراد العائلة';

  @override
  String get addParent => 'إضافة والد';

  @override
  String get inviteSibling => 'دعوة أخ / أخت';

  @override
  String get noParentsTitle => 'لم تُضف والديك بعد';

  @override
  String get noParentsBody =>
      'أضف الأب أو الأم لتبدأ متابعة أدويتهم والاطمئنان عليهم يوميًا.';

  @override
  String get linked => 'مرتبط';

  @override
  String get notLinked => 'لم يُربط جهازه';

  @override
  String checkedInToday(String time) {
    return 'اطمأننا عليه اليوم $time';
  }

  @override
  String get noCheckinToday => 'لم يسجّل «أنا بخير» اليوم';

  @override
  String get linkDevice => 'ربط جهاز الوالد';

  @override
  String get relationFather => 'الأب';

  @override
  String get relationMother => 'الأم';

  @override
  String get relationGrandfather => 'الجد';

  @override
  String get relationGrandmother => 'الجدة';

  @override
  String get roleAdmin => 'مدير العائلة';

  @override
  String get roleCaregiver => 'مقدّم رعاية';

  @override
  String get roleViewer => 'مشاهد فقط';

  @override
  String get roleElder => 'والد';

  @override
  String get addParentTitle => 'إضافة والد';

  @override
  String get parentName => 'الاسم';

  @override
  String get parentNickname => 'كيف تناديه؟';

  @override
  String get parentNicknameHint => 'مثال: بابا، ماما، يمّه';

  @override
  String get relation => 'صلة القرابة';

  @override
  String get parentPhone => 'رقم جواله';

  @override
  String get freePlanEldersLimit =>
      'الخطة المجانية تتيح متابعة والد واحد. ستتوفر خطة العائلة قريبًا لمتابعة أكثر من والد.';

  @override
  String get freePlanMembersLimit =>
      'الخطة المجانية تتيح فردين من العائلة. ستتوفر خطة العائلة قريبًا لإضافة كل الإخوة.';

  @override
  String linkTitle(String name) {
    return 'ربط جهاز $name';
  }

  @override
  String get linkInstructions =>
      'على جوال والدك: افتح «برّ» واختر «معي رمز من أولادي»، ثم امسح الرمز أو اكتب الأرقام.';

  @override
  String linkExpiresIn(int minutes) {
    return 'ينتهي الرمز بعد $minutes دقيقة';
  }

  @override
  String get linkExpired => 'انتهت صلاحية الرمز';

  @override
  String get newCode => 'رمز جديد';

  @override
  String get setupThisDevice => 'تجهيز هذا الجوال لوالدي الآن';

  @override
  String setupThisDeviceConfirm(String name) {
    return 'سيُسجَّل خروجك من هذا الجوال، ويتحوّل إلى جوال $name بالواجهة المبسطة. هل أنت متأكد؟';
  }

  @override
  String get inviteTitle => 'دعوة فرد من العائلة';

  @override
  String get inviteBody =>
      'عندما يسجّل برقم الجوال هذا، ينضم إلى العائلة تلقائيًا.';

  @override
  String get memberPhone => 'رقم الجوال';

  @override
  String get role => 'الصلاحية';

  @override
  String get sendInvite => 'إرسال الدعوة';

  @override
  String get inviteSent => 'أُرسلت الدعوة';

  @override
  String get pendingInvite => 'بانتظار التسجيل';

  @override
  String get elderLinkTitle => 'اكتب الرمز';

  @override
  String get elderLinkSubtitle => 'الرمز من 6 أرقام، تجده عند ابنك أو ابنتك';

  @override
  String get scanCode => 'امسح الرمز بالكاميرا';

  @override
  String get linkNow => 'ربط';

  @override
  String get scanTitle => 'وجّه الكاميرا نحو الرمز';

  @override
  String elderGreeting(String name) {
    return 'أهلًا يا $name';
  }

  @override
  String get myMedsToday => 'أدويتي اليوم';

  @override
  String get imFine => 'أنا بخير';

  @override
  String get callMyKids => 'اتصل بأولادي';

  @override
  String get sos => 'طوارئ';

  @override
  String get sosHoldHint => 'اضغط مطوّلًا 3 ثوانٍ';

  @override
  String get imFineDone => 'الحمد لله على سلامتك\nأخبرنا أولادك أنك بخير';

  @override
  String get imFineAlready => 'سجّلت اليوم أنك بخير';

  @override
  String get medsComingSoon => 'سيضيف أولادك أدويتك هنا قريبًا';

  @override
  String get noKidsPhones => 'لا توجد أرقام لأولادك بعد';

  @override
  String sosCalling(String name) {
    return 'جارٍ الاتصال بـ $name';
  }

  @override
  String get settings => 'الإعدادات';

  @override
  String get signOut => 'تسجيل الخروج';

  @override
  String get deleteAccount => 'حذف الحساب وكل البيانات';

  @override
  String get deleteAccountConfirm =>
      'سيُحذف حسابك وكل بياناتك نهائيًا ولا يمكن استرجاعها. هل أنت متأكد؟';

  @override
  String get disclaimerTitle => 'تنبيه مهم';

  @override
  String get disclaimer =>
      '«برّ» للمساعدة والتذكير فقط، ولا يغني عن استشارة الطبيب أو الاتصال بالإسعاف (997) في الحالات الطارئة.';

  @override
  String get demoModeBanner =>
      'وضع التجربة: البيانات محفوظة على هذا الجهاز فقط';

  @override
  String get exitDemoTitle => 'الخروج من هذا الحساب؟';

  @override
  String get errorNetwork =>
      'لا يوجد اتصال بالإنترنت. تحقق من الشبكة وحاول مرة أخرى.';

  @override
  String get errorUnknown => 'حدث خطأ غير متوقع. حاول مرة أخرى.';

  @override
  String get errorInvalidOtp => 'رمز التحقق غير صحيح';

  @override
  String get errorTooManyRequests =>
      'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.';

  @override
  String get errorInvalidLinkCode => 'الرمز غير صحيح أو انتهت صلاحيته';

  @override
  String get errorPermissionDenied => 'ليست لديك صلاحية لهذا الإجراء';

  @override
  String get errorPlanLimit => 'وصلت إلى حد الخطة المجانية';

  @override
  String get errorSessionExpired => 'انتهت الجلسة، سجّل الدخول مرة أخرى';

  @override
  String get cameraPermissionRationale => 'نحتاج الكاميرا لمسح رمز الربط فقط.';
}

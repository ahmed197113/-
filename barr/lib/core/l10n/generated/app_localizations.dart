import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
  ];

  /// No description provided for @appName.
  ///
  /// In ar, this message translates to:
  /// **'برّ'**
  String get appName;

  /// No description provided for @continueLabel.
  ///
  /// In ar, this message translates to:
  /// **'متابعة'**
  String get continueLabel;

  /// No description provided for @next.
  ///
  /// In ar, this message translates to:
  /// **'التالي'**
  String get next;

  /// No description provided for @skip.
  ///
  /// In ar, this message translates to:
  /// **'تخطي'**
  String get skip;

  /// No description provided for @start.
  ///
  /// In ar, this message translates to:
  /// **'ابدأ الآن'**
  String get start;

  /// No description provided for @cancel.
  ///
  /// In ar, this message translates to:
  /// **'إلغاء'**
  String get cancel;

  /// No description provided for @confirm.
  ///
  /// In ar, this message translates to:
  /// **'تأكيد'**
  String get confirm;

  /// No description provided for @retry.
  ///
  /// In ar, this message translates to:
  /// **'إعادة المحاولة'**
  String get retry;

  /// No description provided for @save.
  ///
  /// In ar, this message translates to:
  /// **'حفظ'**
  String get save;

  /// No description provided for @close.
  ///
  /// In ar, this message translates to:
  /// **'إغلاق'**
  String get close;

  /// No description provided for @optional.
  ///
  /// In ar, this message translates to:
  /// **'اختياري'**
  String get optional;

  /// No description provided for @onboarding1Title.
  ///
  /// In ar, this message translates to:
  /// **'اطمئن على والديك كل يوم'**
  String get onboarding1Title;

  /// No description provided for @onboarding1Body.
  ///
  /// In ar, this message translates to:
  /// **'مهما بعدت المسافة، تبقى قريبًا. ضغطة واحدة من والدك تخبرك أنه بخير.'**
  String get onboarding1Body;

  /// No description provided for @onboarding2Title.
  ///
  /// In ar, this message translates to:
  /// **'لا دواء يُنسى بعد اليوم'**
  String get onboarding2Title;

  /// No description provided for @onboarding2Body.
  ///
  /// In ar, this message translates to:
  /// **'تذكير واضح بالصوت والصورة على جوال والدك، ويصلك إشعار إن فاته دواء.'**
  String get onboarding2Body;

  /// No description provided for @onboarding3Title.
  ///
  /// In ar, this message translates to:
  /// **'رعاية يتقاسمها الإخوة'**
  String get onboarding3Title;

  /// No description provided for @onboarding3Body.
  ///
  /// In ar, this message translates to:
  /// **'عائلة واحدة، ومهام واضحة، وكل الإخوة على اطلاع. البرّ مسؤولية مشتركة.'**
  String get onboarding3Body;

  /// No description provided for @welcomeTitle.
  ///
  /// In ar, this message translates to:
  /// **'أهلًا بك في برّ'**
  String get welcomeTitle;

  /// No description provided for @welcomeSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'رعاية الوالدين، بقلب واحد'**
  String get welcomeSubtitle;

  /// No description provided for @welcomeStartWithPhone.
  ///
  /// In ar, this message translates to:
  /// **'التسجيل برقم الجوال'**
  String get welcomeStartWithPhone;

  /// No description provided for @welcomeHaveLinkCode.
  ///
  /// In ar, this message translates to:
  /// **'أنا الأب/الأم ومعي رمز من أولادي'**
  String get welcomeHaveLinkCode;

  /// No description provided for @phoneTitle.
  ///
  /// In ar, this message translates to:
  /// **'رقم جوالك'**
  String get phoneTitle;

  /// No description provided for @phoneSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'سنرسل لك رمز تحقق برسالة نصية'**
  String get phoneSubtitle;

  /// No description provided for @phoneHint.
  ///
  /// In ar, this message translates to:
  /// **'05xxxxxxxx'**
  String get phoneHint;

  /// No description provided for @phoneInvalid.
  ///
  /// In ar, this message translates to:
  /// **'رقم الجوال غير صحيح'**
  String get phoneInvalid;

  /// No description provided for @sendCode.
  ///
  /// In ar, this message translates to:
  /// **'إرسال الرمز'**
  String get sendCode;

  /// No description provided for @otpTitle.
  ///
  /// In ar, this message translates to:
  /// **'رمز التحقق'**
  String get otpTitle;

  /// No description provided for @otpSentTo.
  ///
  /// In ar, this message translates to:
  /// **'أرسلنا رمزًا من 6 أرقام إلى {phone}'**
  String otpSentTo(String phone);

  /// No description provided for @otpInvalidLength.
  ///
  /// In ar, this message translates to:
  /// **'أدخل الرمز كاملًا (6 أرقام)'**
  String get otpInvalidLength;

  /// No description provided for @verify.
  ///
  /// In ar, this message translates to:
  /// **'تحقق'**
  String get verify;

  /// No description provided for @resendCode.
  ///
  /// In ar, this message translates to:
  /// **'إعادة إرسال الرمز'**
  String get resendCode;

  /// No description provided for @resendIn.
  ///
  /// In ar, this message translates to:
  /// **'إعادة الإرسال بعد {seconds} ث'**
  String resendIn(int seconds);

  /// No description provided for @demoOtpHint.
  ///
  /// In ar, this message translates to:
  /// **'وضع التجربة: الرمز هو 123456'**
  String get demoOtpHint;

  /// No description provided for @accountTypeTitle.
  ///
  /// In ar, this message translates to:
  /// **'من أنت؟'**
  String get accountTypeTitle;

  /// No description provided for @accountTypeSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'نختار لك الواجهة المناسبة'**
  String get accountTypeSubtitle;

  /// No description provided for @accountTypeCaregiver.
  ///
  /// In ar, this message translates to:
  /// **'أنا ابن / ابنة'**
  String get accountTypeCaregiver;

  /// No description provided for @accountTypeCaregiverDesc.
  ///
  /// In ar, this message translates to:
  /// **'أتابع رعاية والديّ وأنسّق مع إخوتي'**
  String get accountTypeCaregiverDesc;

  /// No description provided for @accountTypeElder.
  ///
  /// In ar, this message translates to:
  /// **'أنا الأب / الأم'**
  String get accountTypeElder;

  /// No description provided for @accountTypeElderDesc.
  ///
  /// In ar, this message translates to:
  /// **'واجهة بسيطة بأزرار كبيرة'**
  String get accountTypeElderDesc;

  /// No description provided for @yourName.
  ///
  /// In ar, this message translates to:
  /// **'اسمك'**
  String get yourName;

  /// No description provided for @nameRequired.
  ///
  /// In ar, this message translates to:
  /// **'اكتب اسمك من فضلك'**
  String get nameRequired;

  /// No description provided for @createFamilyTitle.
  ///
  /// In ar, this message translates to:
  /// **'أنشئ مساحة عائلتك'**
  String get createFamilyTitle;

  /// No description provided for @createFamilySubtitle.
  ///
  /// In ar, this message translates to:
  /// **'مساحة خاصة تجمعك بوالديك وإخوتك'**
  String get createFamilySubtitle;

  /// No description provided for @familyNameLabel.
  ///
  /// In ar, this message translates to:
  /// **'اسم العائلة'**
  String get familyNameLabel;

  /// No description provided for @familyNameHint.
  ///
  /// In ar, this message translates to:
  /// **'مثال: عائلة أبو محمد'**
  String get familyNameHint;

  /// No description provided for @createFamily.
  ///
  /// In ar, this message translates to:
  /// **'إنشاء العائلة'**
  String get createFamily;

  /// No description provided for @myFamily.
  ///
  /// In ar, this message translates to:
  /// **'عائلتي'**
  String get myFamily;

  /// No description provided for @parentsSection.
  ///
  /// In ar, this message translates to:
  /// **'الوالدان'**
  String get parentsSection;

  /// No description provided for @membersSection.
  ///
  /// In ar, this message translates to:
  /// **'أفراد العائلة'**
  String get membersSection;

  /// No description provided for @addParent.
  ///
  /// In ar, this message translates to:
  /// **'إضافة والد'**
  String get addParent;

  /// No description provided for @inviteSibling.
  ///
  /// In ar, this message translates to:
  /// **'دعوة أخ / أخت'**
  String get inviteSibling;

  /// No description provided for @noParentsTitle.
  ///
  /// In ar, this message translates to:
  /// **'لم تُضف والديك بعد'**
  String get noParentsTitle;

  /// No description provided for @noParentsBody.
  ///
  /// In ar, this message translates to:
  /// **'أضف الأب أو الأم لتبدأ متابعة أدويتهم والاطمئنان عليهم يوميًا.'**
  String get noParentsBody;

  /// No description provided for @linked.
  ///
  /// In ar, this message translates to:
  /// **'مرتبط'**
  String get linked;

  /// No description provided for @notLinked.
  ///
  /// In ar, this message translates to:
  /// **'لم يُربط جهازه'**
  String get notLinked;

  /// No description provided for @checkedInToday.
  ///
  /// In ar, this message translates to:
  /// **'اطمأننا عليه اليوم {time}'**
  String checkedInToday(String time);

  /// No description provided for @noCheckinToday.
  ///
  /// In ar, this message translates to:
  /// **'لم يسجّل «أنا بخير» اليوم'**
  String get noCheckinToday;

  /// No description provided for @linkDevice.
  ///
  /// In ar, this message translates to:
  /// **'ربط جهاز الوالد'**
  String get linkDevice;

  /// No description provided for @relationFather.
  ///
  /// In ar, this message translates to:
  /// **'الأب'**
  String get relationFather;

  /// No description provided for @relationMother.
  ///
  /// In ar, this message translates to:
  /// **'الأم'**
  String get relationMother;

  /// No description provided for @relationGrandfather.
  ///
  /// In ar, this message translates to:
  /// **'الجد'**
  String get relationGrandfather;

  /// No description provided for @relationGrandmother.
  ///
  /// In ar, this message translates to:
  /// **'الجدة'**
  String get relationGrandmother;

  /// No description provided for @roleAdmin.
  ///
  /// In ar, this message translates to:
  /// **'مدير العائلة'**
  String get roleAdmin;

  /// No description provided for @roleCaregiver.
  ///
  /// In ar, this message translates to:
  /// **'مقدّم رعاية'**
  String get roleCaregiver;

  /// No description provided for @roleViewer.
  ///
  /// In ar, this message translates to:
  /// **'مشاهد فقط'**
  String get roleViewer;

  /// No description provided for @roleElder.
  ///
  /// In ar, this message translates to:
  /// **'والد'**
  String get roleElder;

  /// No description provided for @addParentTitle.
  ///
  /// In ar, this message translates to:
  /// **'إضافة والد'**
  String get addParentTitle;

  /// No description provided for @parentName.
  ///
  /// In ar, this message translates to:
  /// **'الاسم'**
  String get parentName;

  /// No description provided for @parentNickname.
  ///
  /// In ar, this message translates to:
  /// **'كيف تناديه؟'**
  String get parentNickname;

  /// No description provided for @parentNicknameHint.
  ///
  /// In ar, this message translates to:
  /// **'مثال: بابا، ماما، يمّه'**
  String get parentNicknameHint;

  /// No description provided for @relation.
  ///
  /// In ar, this message translates to:
  /// **'صلة القرابة'**
  String get relation;

  /// No description provided for @parentPhone.
  ///
  /// In ar, this message translates to:
  /// **'رقم جواله'**
  String get parentPhone;

  /// No description provided for @freePlanEldersLimit.
  ///
  /// In ar, this message translates to:
  /// **'الخطة المجانية تتيح متابعة والد واحد. ستتوفر خطة العائلة قريبًا لمتابعة أكثر من والد.'**
  String get freePlanEldersLimit;

  /// No description provided for @freePlanMembersLimit.
  ///
  /// In ar, this message translates to:
  /// **'الخطة المجانية تتيح فردين من العائلة. ستتوفر خطة العائلة قريبًا لإضافة كل الإخوة.'**
  String get freePlanMembersLimit;

  /// No description provided for @linkTitle.
  ///
  /// In ar, this message translates to:
  /// **'ربط جهاز {name}'**
  String linkTitle(String name);

  /// No description provided for @linkInstructions.
  ///
  /// In ar, this message translates to:
  /// **'على جوال والدك: افتح «برّ» واختر «معي رمز من أولادي»، ثم امسح الرمز أو اكتب الأرقام.'**
  String get linkInstructions;

  /// No description provided for @linkExpiresIn.
  ///
  /// In ar, this message translates to:
  /// **'ينتهي الرمز بعد {minutes} دقيقة'**
  String linkExpiresIn(int minutes);

  /// No description provided for @linkExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت صلاحية الرمز'**
  String get linkExpired;

  /// No description provided for @newCode.
  ///
  /// In ar, this message translates to:
  /// **'رمز جديد'**
  String get newCode;

  /// No description provided for @setupThisDevice.
  ///
  /// In ar, this message translates to:
  /// **'تجهيز هذا الجوال لوالدي الآن'**
  String get setupThisDevice;

  /// No description provided for @setupThisDeviceConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سيُسجَّل خروجك من هذا الجوال، ويتحوّل إلى جوال {name} بالواجهة المبسطة. هل أنت متأكد؟'**
  String setupThisDeviceConfirm(String name);

  /// No description provided for @inviteTitle.
  ///
  /// In ar, this message translates to:
  /// **'دعوة فرد من العائلة'**
  String get inviteTitle;

  /// No description provided for @inviteBody.
  ///
  /// In ar, this message translates to:
  /// **'عندما يسجّل برقم الجوال هذا، ينضم إلى العائلة تلقائيًا.'**
  String get inviteBody;

  /// No description provided for @memberPhone.
  ///
  /// In ar, this message translates to:
  /// **'رقم الجوال'**
  String get memberPhone;

  /// No description provided for @role.
  ///
  /// In ar, this message translates to:
  /// **'الصلاحية'**
  String get role;

  /// No description provided for @sendInvite.
  ///
  /// In ar, this message translates to:
  /// **'إرسال الدعوة'**
  String get sendInvite;

  /// No description provided for @inviteSent.
  ///
  /// In ar, this message translates to:
  /// **'أُرسلت الدعوة'**
  String get inviteSent;

  /// No description provided for @pendingInvite.
  ///
  /// In ar, this message translates to:
  /// **'بانتظار التسجيل'**
  String get pendingInvite;

  /// No description provided for @elderLinkTitle.
  ///
  /// In ar, this message translates to:
  /// **'اكتب الرمز'**
  String get elderLinkTitle;

  /// No description provided for @elderLinkSubtitle.
  ///
  /// In ar, this message translates to:
  /// **'الرمز من 6 أرقام، تجده عند ابنك أو ابنتك'**
  String get elderLinkSubtitle;

  /// No description provided for @scanCode.
  ///
  /// In ar, this message translates to:
  /// **'امسح الرمز بالكاميرا'**
  String get scanCode;

  /// No description provided for @linkNow.
  ///
  /// In ar, this message translates to:
  /// **'ربط'**
  String get linkNow;

  /// No description provided for @scanTitle.
  ///
  /// In ar, this message translates to:
  /// **'وجّه الكاميرا نحو الرمز'**
  String get scanTitle;

  /// No description provided for @elderGreeting.
  ///
  /// In ar, this message translates to:
  /// **'أهلًا يا {name}'**
  String elderGreeting(String name);

  /// No description provided for @myMedsToday.
  ///
  /// In ar, this message translates to:
  /// **'أدويتي اليوم'**
  String get myMedsToday;

  /// No description provided for @imFine.
  ///
  /// In ar, this message translates to:
  /// **'أنا بخير'**
  String get imFine;

  /// No description provided for @callMyKids.
  ///
  /// In ar, this message translates to:
  /// **'اتصل بأولادي'**
  String get callMyKids;

  /// No description provided for @sos.
  ///
  /// In ar, this message translates to:
  /// **'طوارئ'**
  String get sos;

  /// No description provided for @sosHoldHint.
  ///
  /// In ar, this message translates to:
  /// **'اضغط مطوّلًا 3 ثوانٍ'**
  String get sosHoldHint;

  /// No description provided for @imFineDone.
  ///
  /// In ar, this message translates to:
  /// **'الحمد لله على سلامتك\nأخبرنا أولادك أنك بخير'**
  String get imFineDone;

  /// No description provided for @imFineAlready.
  ///
  /// In ar, this message translates to:
  /// **'سجّلت اليوم أنك بخير'**
  String get imFineAlready;

  /// No description provided for @medsComingSoon.
  ///
  /// In ar, this message translates to:
  /// **'سيضيف أولادك أدويتك هنا قريبًا'**
  String get medsComingSoon;

  /// No description provided for @noKidsPhones.
  ///
  /// In ar, this message translates to:
  /// **'لا توجد أرقام لأولادك بعد'**
  String get noKidsPhones;

  /// No description provided for @sosCalling.
  ///
  /// In ar, this message translates to:
  /// **'جارٍ الاتصال بـ {name}'**
  String sosCalling(String name);

  /// No description provided for @settings.
  ///
  /// In ar, this message translates to:
  /// **'الإعدادات'**
  String get settings;

  /// No description provided for @signOut.
  ///
  /// In ar, this message translates to:
  /// **'تسجيل الخروج'**
  String get signOut;

  /// No description provided for @deleteAccount.
  ///
  /// In ar, this message translates to:
  /// **'حذف الحساب وكل البيانات'**
  String get deleteAccount;

  /// No description provided for @deleteAccountConfirm.
  ///
  /// In ar, this message translates to:
  /// **'سيُحذف حسابك وكل بياناتك نهائيًا ولا يمكن استرجاعها. هل أنت متأكد؟'**
  String get deleteAccountConfirm;

  /// No description provided for @disclaimerTitle.
  ///
  /// In ar, this message translates to:
  /// **'تنبيه مهم'**
  String get disclaimerTitle;

  /// No description provided for @disclaimer.
  ///
  /// In ar, this message translates to:
  /// **'«برّ» للمساعدة والتذكير فقط، ولا يغني عن استشارة الطبيب أو الاتصال بالإسعاف (997) في الحالات الطارئة.'**
  String get disclaimer;

  /// No description provided for @demoModeBanner.
  ///
  /// In ar, this message translates to:
  /// **'وضع التجربة: البيانات محفوظة على هذا الجهاز فقط'**
  String get demoModeBanner;

  /// No description provided for @exitDemoTitle.
  ///
  /// In ar, this message translates to:
  /// **'الخروج من هذا الحساب؟'**
  String get exitDemoTitle;

  /// No description provided for @errorNetwork.
  ///
  /// In ar, this message translates to:
  /// **'لا يوجد اتصال بالإنترنت. تحقق من الشبكة وحاول مرة أخرى.'**
  String get errorNetwork;

  /// No description provided for @errorUnknown.
  ///
  /// In ar, this message translates to:
  /// **'حدث خطأ غير متوقع. حاول مرة أخرى.'**
  String get errorUnknown;

  /// No description provided for @errorInvalidOtp.
  ///
  /// In ar, this message translates to:
  /// **'رمز التحقق غير صحيح'**
  String get errorInvalidOtp;

  /// No description provided for @errorTooManyRequests.
  ///
  /// In ar, this message translates to:
  /// **'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.'**
  String get errorTooManyRequests;

  /// No description provided for @errorInvalidLinkCode.
  ///
  /// In ar, this message translates to:
  /// **'الرمز غير صحيح أو انتهت صلاحيته'**
  String get errorInvalidLinkCode;

  /// No description provided for @errorPermissionDenied.
  ///
  /// In ar, this message translates to:
  /// **'ليست لديك صلاحية لهذا الإجراء'**
  String get errorPermissionDenied;

  /// No description provided for @errorPlanLimit.
  ///
  /// In ar, this message translates to:
  /// **'وصلت إلى حد الخطة المجانية'**
  String get errorPlanLimit;

  /// No description provided for @errorSessionExpired.
  ///
  /// In ar, this message translates to:
  /// **'انتهت الجلسة، سجّل الدخول مرة أخرى'**
  String get errorSessionExpired;

  /// No description provided for @cameraPermissionRationale.
  ///
  /// In ar, this message translates to:
  /// **'نحتاج الكاميرا لمسح رمز الربط فقط.'**
  String get cameraPermissionRationale;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}

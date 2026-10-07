// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'Barr';

  @override
  String get continueLabel => 'Continue';

  @override
  String get next => 'Next';

  @override
  String get skip => 'Skip';

  @override
  String get start => 'Get started';

  @override
  String get cancel => 'Cancel';

  @override
  String get confirm => 'Confirm';

  @override
  String get retry => 'Retry';

  @override
  String get save => 'Save';

  @override
  String get close => 'Close';

  @override
  String get optional => 'Optional';

  @override
  String get onboarding1Title => 'Know your parents are well, every day';

  @override
  String get onboarding1Body =>
      'However far you are, stay close. One tap from your parent tells you they\'re okay.';

  @override
  String get onboarding2Title => 'No more forgotten medicine';

  @override
  String get onboarding2Body =>
      'Clear voice and photo reminders on your parent\'s phone, and an alert to you if a dose is missed.';

  @override
  String get onboarding3Title => 'Care shared by siblings';

  @override
  String get onboarding3Body =>
      'One family, clear tasks, and every sibling in the loop. Caring is a shared duty.';

  @override
  String get welcomeTitle => 'Welcome to Barr';

  @override
  String get welcomeSubtitle => 'Caring for parents, together';

  @override
  String get welcomeStartWithPhone => 'Sign up with phone number';

  @override
  String get welcomeHaveLinkCode =>
      'I\'m a parent and have a code from my children';

  @override
  String get phoneTitle => 'Your phone number';

  @override
  String get phoneSubtitle => 'We\'ll text you a verification code';

  @override
  String get phoneHint => '05xxxxxxxx';

  @override
  String get phoneInvalid => 'Invalid phone number';

  @override
  String get sendCode => 'Send code';

  @override
  String get otpTitle => 'Verification code';

  @override
  String otpSentTo(String phone) {
    return 'We sent a 6-digit code to $phone';
  }

  @override
  String get otpInvalidLength => 'Enter the full 6-digit code';

  @override
  String get verify => 'Verify';

  @override
  String get resendCode => 'Resend code';

  @override
  String resendIn(int seconds) {
    return 'Resend in ${seconds}s';
  }

  @override
  String get demoOtpHint => 'Demo mode: the code is 123456';

  @override
  String get accountTypeTitle => 'Who are you?';

  @override
  String get accountTypeSubtitle => 'We\'ll pick the right experience for you';

  @override
  String get accountTypeCaregiver => 'I\'m a son / daughter';

  @override
  String get accountTypeCaregiverDesc =>
      'I follow my parents\' care and coordinate with siblings';

  @override
  String get accountTypeElder => 'I\'m a father / mother';

  @override
  String get accountTypeElderDesc => 'A simple interface with big buttons';

  @override
  String get yourName => 'Your name';

  @override
  String get nameRequired => 'Please enter your name';

  @override
  String get createFamilyTitle => 'Create your family space';

  @override
  String get createFamilySubtitle =>
      'A private space for you, your parents and siblings';

  @override
  String get familyNameLabel => 'Family name';

  @override
  String get familyNameHint => 'e.g. The Ahmed family';

  @override
  String get createFamily => 'Create family';

  @override
  String get myFamily => 'My family';

  @override
  String get parentsSection => 'Parents';

  @override
  String get membersSection => 'Family members';

  @override
  String get addParent => 'Add parent';

  @override
  String get inviteSibling => 'Invite sibling';

  @override
  String get noParentsTitle => 'No parents added yet';

  @override
  String get noParentsBody =>
      'Add your father or mother to start following their medicines and daily check-ins.';

  @override
  String get linked => 'Linked';

  @override
  String get notLinked => 'Device not linked';

  @override
  String checkedInToday(String time) {
    return 'Checked in today $time';
  }

  @override
  String get noCheckinToday => 'No check-in today';

  @override
  String get linkDevice => 'Link parent\'s device';

  @override
  String get relationFather => 'Father';

  @override
  String get relationMother => 'Mother';

  @override
  String get relationGrandfather => 'Grandfather';

  @override
  String get relationGrandmother => 'Grandmother';

  @override
  String get roleAdmin => 'Family admin';

  @override
  String get roleCaregiver => 'Caregiver';

  @override
  String get roleViewer => 'Viewer';

  @override
  String get roleElder => 'Parent';

  @override
  String get addParentTitle => 'Add parent';

  @override
  String get parentName => 'Name';

  @override
  String get parentNickname => 'What do you call them?';

  @override
  String get parentNicknameHint => 'e.g. Dad, Mom';

  @override
  String get relation => 'Relation';

  @override
  String get parentPhone => 'Phone number';

  @override
  String get freePlanEldersLimit =>
      'The free plan supports one parent. The Family plan is coming soon.';

  @override
  String get freePlanMembersLimit =>
      'The free plan supports two family members. The Family plan is coming soon.';

  @override
  String linkTitle(String name) {
    return 'Link $name\'s device';
  }

  @override
  String get linkInstructions =>
      'On your parent\'s phone: open Barr, choose \"I have a code\", then scan the code or type the digits.';

  @override
  String linkExpiresIn(int minutes) {
    return 'Code expires in $minutes min';
  }

  @override
  String get linkExpired => 'Code expired';

  @override
  String get newCode => 'New code';

  @override
  String get setupThisDevice => 'Set up this phone for my parent now';

  @override
  String setupThisDeviceConfirm(String name) {
    return 'You\'ll be signed out and this phone will become $name\'s phone with the simple interface. Continue?';
  }

  @override
  String get inviteTitle => 'Invite a family member';

  @override
  String get inviteBody =>
      'When they sign up with this number, they join the family automatically.';

  @override
  String get memberPhone => 'Phone number';

  @override
  String get role => 'Role';

  @override
  String get sendInvite => 'Send invite';

  @override
  String get inviteSent => 'Invite sent';

  @override
  String get pendingInvite => 'Pending sign-up';

  @override
  String get elderLinkTitle => 'Enter the code';

  @override
  String get elderLinkSubtitle => 'A 6-digit code from your son or daughter';

  @override
  String get scanCode => 'Scan code with camera';

  @override
  String get linkNow => 'Link';

  @override
  String get scanTitle => 'Point the camera at the code';

  @override
  String elderGreeting(String name) {
    return 'Hello, $name';
  }

  @override
  String get myMedsToday => 'My medicines';

  @override
  String get imFine => 'I\'m fine';

  @override
  String get callMyKids => 'Call my children';

  @override
  String get sos => 'Emergency';

  @override
  String get sosHoldHint => 'Press and hold 3 seconds';

  @override
  String get imFineDone => 'Thank God you\'re well\nWe told your children';

  @override
  String get imFineAlready => 'You checked in today';

  @override
  String get medsComingSoon =>
      'Your children will add your medicines here soon';

  @override
  String get noKidsPhones => 'No phone numbers for your children yet';

  @override
  String sosCalling(String name) {
    return 'Calling $name';
  }

  @override
  String get settings => 'Settings';

  @override
  String get signOut => 'Sign out';

  @override
  String get deleteAccount => 'Delete account and all data';

  @override
  String get deleteAccountConfirm =>
      'Your account and all your data will be permanently deleted. Are you sure?';

  @override
  String get disclaimerTitle => 'Important';

  @override
  String get disclaimer =>
      'Barr is for assistance and reminders only. It does not replace a doctor or emergency services.';

  @override
  String get demoModeBanner => 'Demo mode: data is stored on this device only';

  @override
  String get exitDemoTitle => 'Sign out of this account?';

  @override
  String get errorNetwork =>
      'No internet connection. Check your network and try again.';

  @override
  String get errorUnknown => 'Something went wrong. Please try again.';

  @override
  String get errorInvalidOtp => 'Invalid verification code';

  @override
  String get errorTooManyRequests =>
      'Too many attempts. Please wait and try again.';

  @override
  String get errorInvalidLinkCode => 'The code is invalid or expired';

  @override
  String get errorPermissionDenied =>
      'You don\'t have permission for this action';

  @override
  String get errorPlanLimit => 'You\'ve reached the free plan limit';

  @override
  String get errorSessionExpired => 'Session expired, please sign in again';

  @override
  String get cameraPermissionRationale =>
      'We need the camera only to scan the link code.';

  @override
  String get medsTitle => 'Medicines';

  @override
  String medsOf(String name) {
    return '$name\'s medicines';
  }

  @override
  String get addMedication => 'Add medicine';

  @override
  String get editMedication => 'Edit medicine';

  @override
  String get deleteMedication => 'Delete medicine';

  @override
  String get deleteMedicationConfirm =>
      'Reminders for this medicine will stop. Are you sure?';

  @override
  String get medName => 'Medicine name';

  @override
  String get medDose => 'Dose';

  @override
  String get medDoseHint => 'e.g. 1 tablet, 5 ml';

  @override
  String get medPhoto => 'Box photo';

  @override
  String get takePhoto => 'Camera';

  @override
  String get pickPhoto => 'Gallery';

  @override
  String get medTimes => 'Dose times';

  @override
  String get addTime => 'Add time';

  @override
  String get timesRequired => 'Add at least one time';

  @override
  String get freqOnce => 'Once daily';

  @override
  String get freqTwice => 'Twice';

  @override
  String get freqThrice => '3 times';

  @override
  String get medDays => 'Days';

  @override
  String get everyDay => 'Every day';

  @override
  String get medDuration => 'Duration';

  @override
  String get ongoing => 'Ongoing';

  @override
  String untilDate(String date) {
    return 'Until $date';
  }

  @override
  String get chooseEndDate => 'Choose end date';

  @override
  String get mealInstruction => 'Instructions';

  @override
  String get mealNone => 'None';

  @override
  String get mealBefore => 'Before meal';

  @override
  String get mealAfter => 'After meal';

  @override
  String get mealWith => 'With meal';

  @override
  String get mealBeforeSleep => 'Before sleep';

  @override
  String get medNotes => 'Notes';

  @override
  String get stockSection => 'Stock';

  @override
  String get stockQty => 'Units available';

  @override
  String get perDose => 'Units per dose';

  @override
  String get stockLow => 'Running low';

  @override
  String stockDaysLeft(int days) {
    return 'Enough for $days days';
  }

  @override
  String get illBuyIt => 'I\'ll buy it';

  @override
  String buyerClaimed(String name) {
    return '$name will buy it';
  }

  @override
  String get cancelClaim => 'Cancel';

  @override
  String get freePlanMedsLimit =>
      'The free plan supports 3 medicines. The Family plan is coming soon.';

  @override
  String get noMedsTitle => 'No medicines yet';

  @override
  String get noMedsBody =>
      'Add your parent\'s medicines to send voice and photo reminders on time, even offline.';

  @override
  String get todaySchedule => 'Today\'s schedule';

  @override
  String get allMeds => 'All medicines';

  @override
  String medsToday(int taken, int due) {
    return 'Medicines today: $taken of $due';
  }

  @override
  String get noDosesToday => 'No doses scheduled today';

  @override
  String get doseTaken => 'Taken';

  @override
  String get doseMissed => 'Missed';

  @override
  String get doseSnoozed => 'Snoozed';

  @override
  String get doseUpcoming => 'Upcoming';

  @override
  String get doseDue => 'Due now';

  @override
  String get doseSkipped => 'Skipped';

  @override
  String get markTaken => 'Mark as taken';

  @override
  String get takenIt => 'Taken';

  @override
  String get later => 'Later';

  @override
  String get nextDose => 'Next medicine';

  @override
  String nextDoseAt(String name, String time) {
    return 'Next: $name at $time';
  }

  @override
  String get allDosesDone => 'All medicines taken today';

  @override
  String get doseTimeNow => 'Medicine time';

  @override
  String doseSpeech(String name, String dose, String instruction) {
    return '$name. $dose. $instruction';
  }

  @override
  String get doseSpeechIntro => 'It\'s time for your medicine';

  @override
  String get takenThanks => 'Well done, stay healthy';

  @override
  String get laterOk => 'We\'ll remind you in 10 minutes';

  @override
  String reminderTitle(String name) {
    return 'Medicine time: $name';
  }

  @override
  String reminderBody(String dose) {
    return '$dose — tap \"Taken\" after you take it';
  }

  @override
  String get listen => 'Listen';

  @override
  String get permsTitle => 'Let\'s set up medicine reminders';

  @override
  String get permsBody =>
      'So the alarm rings on time, even when the phone is locked or offline, we need:';

  @override
  String get permNotifications => 'Notifications';

  @override
  String get permNotificationsWhy => 'To show the medicine reminder';

  @override
  String get permExactAlarms => 'Exact alarms';

  @override
  String get permExactAlarmsWhy => 'To ring exactly on time';

  @override
  String get permBattery => 'Background activity';

  @override
  String get permBatteryWhy => 'So battery saving doesn\'t stop reminders';

  @override
  String get allow => 'Allow';

  @override
  String get allowed => 'Done';

  @override
  String get done => 'Done';

  @override
  String parentDetails(String name) {
    return '$name\'s details';
  }

  @override
  String get weekdayShort1 => 'Mon';

  @override
  String get weekdayShort2 => 'Tue';

  @override
  String get weekdayShort3 => 'Wed';

  @override
  String get weekdayShort4 => 'Thu';

  @override
  String get weekdayShort5 => 'Fri';

  @override
  String get weekdayShort6 => 'Sat';

  @override
  String get weekdayShort7 => 'Sun';

  @override
  String get requiredField => 'This field is required';

  @override
  String get invalidNumber => 'Enter a valid number';

  @override
  String get urgentAlerts => 'Urgent alerts';

  @override
  String get todayTimeline => 'Today\'s events';

  @override
  String get noEventsToday => 'No events yet today';

  @override
  String get statusGreen => 'Fine';

  @override
  String get statusYellow => 'Attention';

  @override
  String get statusRed => 'Needs follow-up';

  @override
  String alertSos(String name) {
    return '$name pressed the emergency button!';
  }

  @override
  String alertMissedDose(String name, String med) {
    return '$name hasn\'t confirmed $med';
  }

  @override
  String alertNoCheckin(String name) {
    return '$name hasn\'t checked in yet';
  }

  @override
  String alertNoCheckinEscalated(String name) {
    return 'No check-in from $name since morning — call them';
  }

  @override
  String alertInactivity(String name) {
    return 'No activity on $name\'s phone for a long time';
  }

  @override
  String alertLowStock(String name, String med) {
    return '$name\'s $med is running low';
  }

  @override
  String tlCheckin(String name) {
    return '$name checked in';
  }

  @override
  String tlDoseTaken(String name, String med) {
    return '$name took $med';
  }

  @override
  String tlDoseSnoozed(String name, String med) {
    return '$name snoozed $med';
  }

  @override
  String tlDoseMissed(String name, String med) {
    return '$name missed $med';
  }

  @override
  String tlSos(String name) {
    return '$name pressed emergency';
  }

  @override
  String tlSosResolved(String name) {
    return '$name confirmed safe';
  }

  @override
  String get call => 'Call';

  @override
  String get sosTitle => 'Emergency';

  @override
  String sosFrom(String name) {
    return '$name needs help';
  }

  @override
  String sosAt(String time) {
    return 'at $time';
  }

  @override
  String get openMap => 'Open location on map';

  @override
  String get noLocation => 'Location unavailable';

  @override
  String locationAccuracy(int meters) {
    return 'Accuracy about $meters m';
  }

  @override
  String get imOnIt => 'I\'m on it';

  @override
  String followingBy(String names) {
    return 'Following: $names';
  }

  @override
  String get markSafe => 'Confirmed safe';

  @override
  String sosResolvedBy(String name) {
    return '$name confirmed they\'re safe';
  }

  @override
  String get sosSending => 'Notifying your family…';

  @override
  String get sosSent => 'Your family has been notified';

  @override
  String get sosSentBody => 'They will call you right away';

  @override
  String get sosCancel => 'I\'m fine, cancel the alert';

  @override
  String sosSomeoneOnIt(String names) {
    return '$names is following up now';
  }

  @override
  String parentSettings(String name) {
    return '$name\'s settings';
  }

  @override
  String get checkinDeadline => 'Check-in deadline';

  @override
  String get checkinDeadlineHelp =>
      'If they haven\'t checked in by this time you get an alert, then a stronger one 2 hours later.';

  @override
  String get inactivityAlert => 'Inactivity alert';

  @override
  String get inactivityHelp =>
      'Alert if the app isn\'t opened on their phone for:';

  @override
  String hoursN(int n) {
    return '$n hours';
  }

  @override
  String get emergencyContacts => 'Emergency numbers';

  @override
  String get emergencyContactsHelp =>
      'On SOS the phone calls the first number. Without numbers it calls the first child.';

  @override
  String get addContact => 'Add number';

  @override
  String get contactName => 'Name';

  @override
  String get saved => 'Saved';

  @override
  String get permLocation => 'Location';

  @override
  String get permLocationWhy =>
      'Only to send your location to your family in an emergency';
}

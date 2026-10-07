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
}

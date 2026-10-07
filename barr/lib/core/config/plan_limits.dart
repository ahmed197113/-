/// Free-plan limits. Server-side values (families/{fid}.limits) win when
/// present; these are the defaults used by demo mode and as a fallback.
abstract final class PlanLimits {
  static const freeMaxElders = 1;
  static const freeMaxMembers = 2;
  static const freeMaxMedications = 3;
  static const premiumMaxElders = 10;
  static const premiumMaxMembers = 20;
  static const premiumMaxMedications = 1000;

  static const linkCodeValidity = Duration(minutes: 15);
}

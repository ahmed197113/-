import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/data/auth_providers.dart';
import '../../features/auth/presentation/screens/account_type_screen.dart';
import '../../features/auth/presentation/screens/otp_screen.dart';
import '../../features/auth/presentation/screens/phone_screen.dart';
import '../../features/auth/presentation/screens/welcome_screen.dart';
import '../../features/elder_home/presentation/screens/call_kids_screen.dart';
import '../../features/elder_home/presentation/screens/dose_alarm_screen.dart';
import '../../features/elder_home/presentation/screens/elder_meds_screen.dart';
import '../../features/elder_home/presentation/screens/reminder_permissions_screen.dart';
import '../../features/elder_home/presentation/screens/elder_home_screen.dart';
import '../../features/elder_linking/presentation/screens/elder_link_screen.dart';
import '../../features/elder_linking/presentation/screens/link_code_screen.dart';
import '../../features/elder_linking/presentation/screens/scan_code_screen.dart';
import '../../features/family/presentation/screens/add_elder_screen.dart';
import '../../features/family/presentation/screens/caregiver_home_screen.dart';
import '../../features/family/presentation/screens/create_family_screen.dart';
import '../../features/family/presentation/screens/invite_screen.dart';
import '../../features/medications/presentation/screens/medication_form_screen.dart';
import '../../features/medications/presentation/screens/medications_screen.dart';
import '../../features/onboarding/onboarding_controller.dart';
import '../../features/onboarding/onboarding_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../widgets/splash_screen.dart';
import 'app_stage.dart';

final appStageProvider = Provider<AppStage>((ref) {
  final uid = ref.watch(authUidProvider);
  final profile = ref.watch(currentProfileProvider);
  return resolveStage(
    loading: uid.isLoading || (uid.value != null && profile.isLoading),
    onboardingSeen: ref.watch(onboardingSeenProvider),
    uid: uid.value,
    profile: profile.value,
  );
});

final routerProvider = Provider<GoRouter>((ref) {
  final stage = ValueNotifier<AppStage>(ref.read(appStageProvider));
  ref.listen(appStageProvider, (_, next) => stage.value = next);
  ref.onDispose(stage.dispose);

  return GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: stage,
    debugLogDiagnostics: kDebugMode,
    redirect: (context, state) => redirectFor(stage.value, state.matchedLocation),
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.onboarding, builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: Routes.welcome, builder: (_, _) => const WelcomeScreen()),
      GoRoute(path: Routes.phone, builder: (_, _) => const PhoneScreen()),
      GoRoute(path: Routes.otp, builder: (_, _) => const OtpScreen()),
      GoRoute(path: Routes.accountType, builder: (_, _) => const AccountTypeScreen()),
      GoRoute(path: Routes.createFamily, builder: (_, _) => const CreateFamilyScreen()),
      GoRoute(
        path: Routes.home,
        builder: (_, _) => const CaregiverHomeScreen(),
        routes: [
          GoRoute(path: 'add-elder', builder: (_, _) => const AddElderScreen()),
          GoRoute(path: 'invite', builder: (_, _) => const InviteScreen()),
          GoRoute(path: 'settings', builder: (_, _) => const SettingsScreen()),
          GoRoute(
            path: 'elder/:elderId/link',
            builder: (_, state) => LinkCodeScreen(elderId: state.pathParameters['elderId']!),
          ),
          GoRoute(
            path: 'elder/:elderId/meds',
            builder: (_, state) => MedicationsScreen(elderId: state.pathParameters['elderId']!),
            routes: [
              GoRoute(
                path: 'new',
                builder: (_, state) => MedicationFormScreen(elderId: state.pathParameters['elderId']!),
              ),
              GoRoute(
                path: ':medId/edit',
                builder: (_, state) => MedicationFormScreen(
                  elderId: state.pathParameters['elderId']!,
                  medicationId: state.pathParameters['medId'],
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: Routes.elderLink,
        builder: (_, _) => const ElderLinkScreen(),
        routes: [GoRoute(path: 'scan', builder: (_, _) => const ScanCodeScreen())],
      ),
      GoRoute(
        path: Routes.elderHome,
        builder: (_, _) => const ElderHomeScreen(),
        routes: [
          GoRoute(path: 'kids', builder: (_, _) => const CallKidsScreen()),
          GoRoute(path: 'meds', builder: (_, _) => const ElderMedsScreen()),
          GoRoute(path: 'permissions', builder: (_, _) => const ReminderPermissionsScreen()),
          GoRoute(
            path: 'dose/:doseId',
            builder: (_, state) => DoseAlarmScreen(doseId: state.pathParameters['doseId']!),
          ),
        ],
      ),
    ],
  );
});

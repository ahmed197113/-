import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/auth_screen.dart';
import '../../features/credits/presentation/store_screen.dart';
import '../../features/editor/presentation/editor_screen.dart';
import '../../features/gallery/presentation/gallery_screen.dart';
import '../../features/generation/presentation/generating_screen.dart';
import '../../features/generation/presentation/results_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/settings/application/app_settings.dart';
import '../../features/settings/presentation/privacy_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/share/presentation/export_screen.dart';
import '../../features/templates/presentation/home_screen.dart';
import '../../features/templates/presentation/template_detail_screen.dart';
import '../../features/upload/presentation/consent_screen.dart';
import '../../features/upload/presentation/upload_screen.dart';
import '../l10n/tr.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/home',
    redirect: (context, state) {
      final s = ref.read(appSettingsProvider);
      final loc = state.matchedLocation;
      if (loc == '/privacy') return null;
      if (!s.onboardingDone) return loc == '/onboarding' ? null : '/onboarding';
      if (!s.signedIn) return loc == '/auth' || loc == '/onboarding' ? null : '/auth';
      return null;
    },
    routes: [
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/auth', builder: (_, _) => const AuthScreen()),
      GoRoute(path: '/privacy', builder: (_, _) => const PrivacyScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _Shell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/gallery', builder: (_, _) => const GalleryScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/shop', builder: (_, _) => const StoreScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/profile', builder: (_, _) => const SettingsScreen())]),
        ],
      ),
      GoRoute(path: '/store', builder: (_, _) => const StoreScreen()),
      GoRoute(
        path: '/template/:id',
        builder: (_, s) => TemplateDetailScreen(templateId: s.pathParameters['id']!),
      ),
      GoRoute(path: '/consent', builder: (_, s) => ConsentScreen(next: s.extra as String? ?? '/home')),
      GoRoute(
        path: '/upload/:id',
        builder: (_, s) => UploadScreen(
          templateId: s.pathParameters['id']!,
          gender: s.uri.queryParameters['gender'] ?? 'male',
        ),
      ),
      GoRoute(path: '/generating/:id', builder: (_, s) => GeneratingScreen(jobId: s.pathParameters['id']!)),
      GoRoute(path: '/results/:id', builder: (_, s) => ResultsScreen(jobId: s.pathParameters['id']!)),
      GoRoute(path: '/editor', builder: (_, s) => EditorScreen(args: s.extra! as EditorArgs)),
      GoRoute(path: '/export', builder: (_, s) => ExportScreen(path: s.extra! as String)),
    ],
  );
  ref.listen(appSettingsProvider, (prev, next) {
    if (prev?.onboardingDone != next.onboardingDone || prev?.signedIn != next.signedIn) router.refresh();
  });
  return router;
});

class _Shell extends StatelessWidget {
  const _Shell({required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: shell,
        bottomNavigationBar: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
          destinations: [
            NavigationDestination(icon: const Icon(Icons.auto_awesome_outlined), selectedIcon: const Icon(Icons.auto_awesome), label: context.tr('الرئيسية', 'Home')),
            NavigationDestination(icon: const Icon(Icons.photo_library_outlined), selectedIcon: const Icon(Icons.photo_library), label: context.tr('معرضي', 'Gallery')),
            NavigationDestination(icon: const Icon(Icons.toll_outlined), selectedIcon: const Icon(Icons.toll), label: context.tr('المتجر', 'Store')),
            NavigationDestination(icon: const Icon(Icons.person_outline), selectedIcon: const Icon(Icons.person), label: context.tr('حسابي', 'Profile')),
          ],
        ),
      );
}

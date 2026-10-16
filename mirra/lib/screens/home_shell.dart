import 'package:flutter/material.dart';

import '../core/app_state.dart';
import 'growth_tab.dart';
import 'history_tab.dart';
import 'home_tab.dart';
import 'settings_tab.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  static final tab = ValueNotifier<int>(0);

  /// Switches tab from anywhere, closing any pushed screens first.
  static void goTo(BuildContext context, int index) {
    Navigator.of(context).popUntil((r) => r.isFirst);
    tab.value = index;
  }

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<int>(
      valueListenable: HomeShell.tab, builder: (context, tab, _) => _build(context, tab));

  void _select(int index) => HomeShell.tab.value = index;

  Widget _build(BuildContext context, int tab) {
    final app = AppScope.of(context);
    return Scaffold(
      body: IndexedStack(
        index: tab,
        children: const [HomeTab(), GrowthTab(), HistoryTab(), SettingsTab()],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: _select,
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.home_outlined),
              selectedIcon: const Icon(Icons.home_rounded),
              label: app.t('nav.home')),
          NavigationDestination(
              icon: const Icon(Icons.trending_up_rounded),
              selectedIcon: const Icon(Icons.rocket_launch_rounded),
              label: app.t('nav.growth')),
          NavigationDestination(
              icon: const Icon(Icons.history_rounded),
              selectedIcon: const Icon(Icons.timeline_rounded),
              label: app.t('nav.journey')),
          NavigationDestination(
              icon: const Icon(Icons.person_outline_rounded),
              selectedIcon: const Icon(Icons.person_rounded),
              label: app.t('nav.profile')),
        ],
      ),
    );
  }
}

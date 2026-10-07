import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/services/reminder_scheduler.dart';
import '../../../../core/services/service_providers.dart';
import '../../../../core/storage/prefs.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../sos/data/sos_providers.dart';

const reminderPermissionsSeenKey = 'barr.reminder_permissions_seen';

/// Explains each permission before requesting it (Play policy + trust).
/// Usually completed by the child in Setup Mode on the parent's phone.
class ReminderPermissionsScreen extends ConsumerStatefulWidget {
  const ReminderPermissionsScreen({super.key});

  @override
  ConsumerState<ReminderPermissionsScreen> createState() => _ReminderPermissionsScreenState();
}

class _ReminderPermissionsScreenState extends ConsumerState<ReminderPermissionsScreen>
    with WidgetsBindingObserver {
  ReminderPermissions? _status;
  bool? _location;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Exact-alarm and battery settings open system screens; re-check on return.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    final s = await ref.read(reminderSchedulerProvider).permissions();
    final loc = await ref.read(locationServiceProvider).hasPermission();
    if (mounted) {
      setState(() {
        _status = s;
        _location = loc;
      });
    }
  }

  Future<void> _run(Future<void> Function() request) async {
    await request();
    await _refresh();
  }

  Future<void> _finish() async {
    await ref.read(sharedPreferencesProvider).setBool(reminderPermissionsSeenKey, true);
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final scheduler = ref.read(reminderSchedulerProvider);
    final s = _status;

    return Theme(
      data: AppTheme.elder(),
      child: Builder(builder: (context) {
        final theme = Theme.of(context);
        return Scaffold(
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Icon(Icons.alarm_on_rounded, size: 80, color: BarrColors.teal),
                const SizedBox(height: 8),
                Text(l.permsTitle, textAlign: TextAlign.center, style: theme.textTheme.headlineMedium),
                const SizedBox(height: 12),
                Text(l.permsBody, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
                const SizedBox(height: 20),
                _PermissionRow(
                  title: l.permNotifications,
                  why: l.permNotificationsWhy,
                  granted: s?.notifications,
                  onAllow: () => _run(scheduler.requestNotifications),
                ),
                _PermissionRow(
                  title: l.permExactAlarms,
                  why: l.permExactAlarmsWhy,
                  granted: s?.exactAlarms,
                  onAllow: () => _run(scheduler.requestExactAlarms),
                ),
                _PermissionRow(
                  title: l.permBattery,
                  why: l.permBatteryWhy,
                  granted: s?.batteryUnrestricted,
                  onAllow: () => _run(scheduler.requestBatteryUnrestricted),
                ),
                _PermissionRow(
                  title: l.permLocation,
                  why: l.permLocationWhy,
                  granted: _location,
                  onAllow: () => _run(() => ref.read(locationServiceProvider).requestPermission()),
                ),
                const SizedBox(height: 16),
                FilledButton(onPressed: _finish, child: Text(l.done)),
              ],
            ),
          ),
        );
      }),
    );
  }
}

class _PermissionRow extends StatelessWidget {
  const _PermissionRow({
    required this.title,
    required this.why,
    required this.granted,
    required this.onAllow,
  });

  final String title;
  final String why;
  final bool? granted;
  final VoidCallback onAllow;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: theme.textTheme.titleLarge),
                    Text(why, style: theme.textTheme.bodyMedium?.copyWith(fontSize: 20)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              granted == true
                  ? const Icon(Icons.check_circle_rounded, color: BarrColors.ok, size: 48)
                  : FilledButton(
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(100, 64),
                        textStyle: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                      ),
                      onPressed: onAllow,
                      child: Text(l.allow),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/router/app_stage.dart';
import '../../../../core/services/reminder_scheduler.dart';
import '../../../../core/services/service_providers.dart';
import '../../../../core/storage/prefs.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/device_timezone.dart';
import '../../../../core/utils/clock.dart';
import '../../../../core/utils/dates.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../auth/data/auth_providers.dart';
import '../../../medications/domain/dose_schedule.dart';
import '../../../medications/domain/reminder_plan.dart';
import '../../../medications/presentation/labels.dart';
import '../../data/elder_home_providers.dart';
import 'reminder_permissions_screen.dart';
import '../widgets/elder_tile.dart';
import '../widgets/sos_hold_button.dart';

/// The parent's home: exactly four big actions, no menus, no swipes.
/// Settings are locked and controlled by the children.
class ElderHomeScreen extends ConsumerStatefulWidget {
  const ElderHomeScreen({super.key});

  @override
  ConsumerState<ElderHomeScreen> createState() => _ElderHomeScreenState();
}

class _ElderHomeScreenState extends ConsumerState<ElderHomeScreen> with WidgetsBindingObserver {
  /// Hidden exit for caregivers: tap the greeting 7 times.
  int _secretTaps = 0;
  StreamSubscription<String>? _openedSub;
  late final ReminderScheduler _scheduler;

  @override
  void initState() {
    super.initState();
    _scheduler = ref.read(reminderSchedulerProvider);
    // Keep local alarms in sync with the medicines/logs (works offline).
    ref.listenManual(myReminderPlanProvider, (_, plan) {
      if (plan != null) _syncReminders(plan);
    }, fireImmediately: true);
    _openedSub = _scheduler.doseOpened.listen(_openDose);
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startup();
      _touch();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _openedSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _touch();
  }

  Future<void> _startup() async {
    try {
      await _scheduler.init();
      final launchDose = await _scheduler.takeLaunchDoseId();
      if (!mounted) return;
      if (launchDose != null) {
        _openDose(launchDose);
        return;
      }
      final prefs = ref.read(sharedPreferencesProvider);
      if (prefs.getBool(reminderPermissionsSeenKey) != true) {
        context.push(Routes.elderPermissions);
      }
    } catch (e) {
      debugPrint('Reminder startup failed: $e');
    }
  }

  void _openDose(String doseId) {
    if (!mounted) return;
    context.push(Routes.elderDose(doseId));
  }

  void _syncReminders(List<PlannedReminder> plan) {
    // May fire during initState; localizations are only available after.
    WidgetsBinding.instance.addPostFrameCallback((_) => _doSync(plan));
  }

  void _doSync(List<PlannedReminder> plan) {
    if (!mounted) return;
    final l = AppLocalizations.of(context);
    _scheduler
        .sync(
          [
            for (final r in plan)
              ReminderNotification(
                id: r.notificationId,
                at: r.at,
                title: l.reminderTitle(r.medication.name),
                body: l.reminderBody(r.medication.dose),
                doseId: r.doseId,
              ),
          ],
          ReminderActionLabels(taken: l.takenIt, later: l.later),
        )
        .catchError((Object e) => debugPrint('Reminder sync failed: $e'));
  }

  Future<void> _checkIn() async {
    final ref0 = ref.read(currentProfileProvider).value?.elderRef;
    if (ref0 == null) return;
    final l = AppLocalizations.of(context);
    final ok = await runWithFeedback(context, () => ref.read(checkinRepositoryProvider).checkIn(ref0));
    if (!ok || !mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => Theme(
        data: AppTheme.elder(),
        child: AlertDialog(
          icon: const Icon(Icons.favorite_rounded, color: BarrColors.ok, size: 72),
          content: Text(l.imFineDone,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, height: 1.5)),
          actions: [
            FilledButton(onPressed: () => Navigator.pop(ctx), child: Text(l.close)),
          ],
        ),
      ),
    );
  }


  void _sos() => context.push(Routes.elderSos);

  /// Heartbeat for inactivity alerts + device timezone for server rules.
  Future<void> _touch() async {
    final elder = ref.read(myElderRefProvider);
    if (elder == null) return;
    final tz = await ref.read(deviceTimezoneProvider.future);
    await ref.read(checkinRepositoryProvider).touch(elder, timezone: tz).catchError((Object _) {});
  }

  Future<void> _secretTap() async {
    if (++_secretTaps < 7) return;
    _secretTaps = 0;
    final l = AppLocalizations.of(context);
    final ok = await confirmDialog(
      context,
      title: l.exitDemoTitle,
      message: l.signOut,
      confirmLabel: l.signOut,
      cancelLabel: l.cancel,
      destructive: true,
    );
    if (ok) await ref.read(authRepositoryProvider).signOut();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final elder = ref.watch(myElderProvider).value;
    final name = elder?.displayName ?? ref.watch(currentProfileProvider).value?.displayName ?? '';
    final checkedInToday =
        elder?.lastCheckinAt != null && isSameDay(elder!.lastCheckinAt!, DateTime.now());
    final doses = ref.watch(myTodayDosesProvider);
    final now = ref.watch(nowProvider).value ?? DateTime.now();
    final next = doses == null ? null : currentDose(doses, now);
    final String? medsSubtitle;
    if (doses == null || doses.isEmpty) {
      medsSubtitle = null;
    } else if (next == null) {
      medsSubtitle = l.allDosesDone;
    } else {
      medsSubtitle = l.nextDoseAt(next.medication.name, formatTime(context, next.at));
    }
    final medsAttention = next != null && next.stateAt(now) != DoseState.upcoming;

    return Theme(
      data: AppTheme.elder(),
      child: Builder(builder: (context) {
        return Scaffold(
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  GestureDetector(
                    onTap: _secretTap,
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        l.elderGreeting(name),
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(
                                child: ElderTile(
                                  icon: medsAttention
                                      ? Icons.notifications_active_rounded
                                      : Icons.medication_rounded,
                                  label: l.myMedsToday,
                                  subtitle: medsSubtitle,
                                  color: medsAttention ? BarrColors.attention : BarrColors.teal,
                                  onTap: () => context.push(Routes.elderMeds),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: ElderTile(
                                  icon: checkedInToday
                                      ? Icons.check_circle_rounded
                                      : Icons.favorite_rounded,
                                  label: l.imFine,
                                  subtitle: checkedInToday ? l.imFineAlready : null,
                                  color: BarrColors.ok,
                                  onTap: _checkIn,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Expanded(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(
                                child: ElderTile(
                                  icon: Icons.call_rounded,
                                  label: l.callMyKids,
                                  color: BarrColors.warm,
                                  onTap: () => context.push(Routes.elderKids),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: SosHoldButton(
                                  label: l.sos,
                                  hint: l.sosHoldHint,
                                  onTriggered: _sos,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }),
    );
  }
}

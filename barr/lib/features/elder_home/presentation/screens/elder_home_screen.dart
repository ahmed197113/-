import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/router/app_stage.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/dates.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../auth/data/auth_providers.dart';
import '../../data/elder_home_providers.dart';
import '../widgets/elder_tile.dart';
import '../widgets/sos_hold_button.dart';

/// The parent's home: exactly four big actions, no menus, no swipes.
/// Settings are locked and controlled by the children.
class ElderHomeScreen extends ConsumerStatefulWidget {
  const ElderHomeScreen({super.key});

  @override
  ConsumerState<ElderHomeScreen> createState() => _ElderHomeScreenState();
}

class _ElderHomeScreenState extends ConsumerState<ElderHomeScreen> {
  /// Hidden exit for caregivers: tap the greeting 7 times.
  int _secretTaps = 0;

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

  void _showMedsSoon() {
    final l = AppLocalizations.of(context);
    showDialog<void>(
      context: context,
      builder: (ctx) => Theme(
        data: AppTheme.elder(),
        child: AlertDialog(
          icon: const Icon(Icons.medication_rounded, size: 72, color: BarrColors.teal),
          content: Text(l.medsComingSoon,
              textAlign: TextAlign.center, style: const TextStyle(fontSize: 26)),
          actions: [FilledButton(onPressed: () => Navigator.pop(ctx), child: Text(l.close))],
        ),
      ),
    );
  }

  Future<void> _sos() async {
    final l = AppLocalizations.of(context);
    final kids = ref.read(myChildrenProvider).where((m) => m.phone != null).toList();
    // Phase 3 adds the family-wide alert + location; for now call the
    // first emergency contact directly.
    if (kids.isEmpty) {
      showSnack(context, l.noKidsPhones, error: true);
      return;
    }
    showSnack(context, l.sosCalling(kids.first.displayName));
    await launchUrl(Uri(scheme: 'tel', path: kids.first.phone));
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
                                  icon: Icons.medication_rounded,
                                  label: l.myMedsToday,
                                  color: BarrColors.teal,
                                  onTap: _showMedsSoon,
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/router/app_stage.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/clock.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../core/widgets/skeleton.dart';
import '../../../../shared/domain/entities/app_user.dart';
import '../../../auth/data/auth_providers.dart';
import '../../../family/data/family_providers.dart';
import '../../data/medication_providers.dart';
import '../../domain/dose_schedule.dart';
import '../../domain/medication.dart';
import '../labels.dart';
import '../widgets/dose_tile.dart';
import '../widgets/med_photo.dart';

/// Caregiver: one parent's medicines — today's timeline + the full list.
class MedicationsScreen extends ConsumerWidget {
  const MedicationsScreen({super.key, required this.elderId});

  final String elderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final fid = ref.watch(currentFamilyIdProvider);
    if (fid == null) return const SizedBox.shrink();
    final elderRef = ElderRef(familyId: fid, elderId: elderId);
    final elder = (ref.watch(eldersProvider(fid)).value ?? const [])
        .where((e) => e.id == elderId)
        .firstOrNull;
    final family = ref.watch(familyProvider(fid)).value;
    final role = ref.watch(myRoleProvider(fid));
    final medsAsync = ref.watch(medicationsProvider(elderRef));
    final today = ref.watch(todayDosesProvider(elderRef));
    final now = ref.watch(nowProvider).value ?? DateTime.now();
    final repo = ref.read(medicationRepositoryProvider);

    void addMedication() {
      // Free-plan limit is family-wide; demo/Firestore repos enforce it too.
      final count = medsAsync.value?.length ?? 0;
      if (family != null && count >= family.maxMedications) {
        showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            icon: const Icon(Icons.workspace_premium_rounded, size: 40),
            content: Text(l.freePlanMedsLimit, textAlign: TextAlign.center),
            actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l.close))],
          ),
        );
        return;
      }
      context.push(Routes.newMedication(elderId));
    }

    Future<void> markTaken(ScheduledDose d) => runWithFeedback(
          context,
          () => repo.logDose(
            fid,
            elderId,
            doseId: d.id,
            medication: d.medication,
            scheduledAt: d.at,
            status: DoseStatus.taken,
            source: 'caregiver',
          ),
        );

    return Scaffold(
      appBar: AppBar(
        title: Text(l.medsOf(elder?.displayName ?? '')),
        actions: [
          if (role.canEdit)
            IconButton(
              tooltip: l.parentSettings(elder?.displayName ?? ''),
              icon: const Icon(Icons.tune_rounded),
              onPressed: () => context.push(Routes.elderSettings(elderId)),
            ),
        ],
      ),
      floatingActionButton: role.canEdit
          ? FloatingActionButton.extended(
              onPressed: addMedication,
              icon: const Icon(Icons.add_rounded),
              label: Text(l.addMedication),
            )
          : null,
      body: medsAsync.when(
        loading: () => const Padding(padding: EdgeInsets.all(16), child: Skeleton(height: 200)),
        error: (e, _) => Center(child: Text(l.errorUnknown)),
        data: (meds) {
          if (meds.isEmpty) {
            return Center(
              child: EmptyState(
                icon: Icons.medication_outlined,
                title: l.noMedsTitle,
                body: l.noMedsBody,
                action: role.canEdit
                    ? FilledButton.icon(
                        onPressed: addMedication,
                        icon: const Icon(Icons.add_rounded),
                        label: Text(l.addMedication),
                      )
                    : null,
              ),
            );
          }
          final adherence = today == null ? null : adherenceOf(today, now);
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
            children: [
              _Header(
                l.todaySchedule,
                trailing: adherence == null || adherence.due == 0
                    ? null
                    : l.medsToday(adherence.taken, adherence.due),
              ),
              Card(
                child: today == null
                    ? const Skeleton(height: 120)
                    : today.isEmpty
                        ? ListTile(title: Text(l.noDosesToday))
                        : Column(
                            children: [
                              for (final d in today)
                                DoseTile(
                                  dose: d,
                                  now: now,
                                  onMarkTaken: role.canEdit ? () => markTaken(d) : null,
                                ),
                            ],
                          ),
              ),
              _Header(l.allMeds),
              for (final m in meds) ...[
                _MedicationCard(
                  medication: m,
                  canEdit: role.canEdit,
                  onEdit: () => context.push(Routes.editMedication(elderId, m.id)),
                  onToggleBuyer: () {
                    final me = ref.read(currentProfileProvider).value;
                    if (me == null) return;
                    final mine = m.buyer?.uid == me.uid;
                    runWithFeedback(
                      context,
                      () => repo.setBuyer(fid, elderId, m.id,
                          mine ? null : StockBuyer(uid: me.uid, name: me.displayName)),
                    );
                  },
                  myUid: ref.watch(authUidProvider).value,
                ),
                const SizedBox(height: 12),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header(this.text, {this.trailing});

  final String text;
  final String? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 20, 4, 10),
        child: Row(
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(text,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              ),
            ),
            if (trailing != null)
              Text(trailing!, style: TextStyle(color: Theme.of(context).colorScheme.primary)),
          ],
        ),
      );
}

class _MedicationCard extends StatelessWidget {
  const _MedicationCard({
    required this.medication,
    required this.canEdit,
    required this.onEdit,
    required this.onToggleBuyer,
    required this.myUid,
  });

  final Medication medication;
  final bool canEdit;
  final VoidCallback onEdit;
  final VoidCallback onToggleBuyer;
  final String? myUid;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final m = medication;
    final times = m.times.map((t) => formatDoseTime(context, t)).join('، ');
    final days = m.weekdays.isEmpty
        ? l.everyDay
        : (m.weekdays.toList()..sort()).map((d) => weekdayShort(l, d)).join('، ');

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: canEdit ? onEdit : null,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  MedPhoto(url: m.photoUrl, size: 64),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m.name,
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                        Text(m.dose),
                        const SizedBox(height: 4),
                        Text('$times · $days',
                            style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
                        if (m.meal != MealInstruction.none)
                          Text(m.meal.label(l),
                              style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
                      ],
                    ),
                  ),
                  if (canEdit) const Icon(Icons.chevron_left_rounded),
                ],
              ),
              if (m.stockQty != null) ...[
                const Divider(height: 20),
                Row(
                  children: [
                    Icon(
                      m.isLowStock ? Icons.warning_amber_rounded : Icons.inventory_2_outlined,
                      color: m.isLowStock ? BarrColors.danger : theme.colorScheme.outline,
                      size: 20,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        m.isLowStock ? '${l.stockLow} · ${l.stockDaysLeft(m.daysLeft ?? 0)}'
                            : l.stockDaysLeft(m.daysLeft ?? 0),
                        style: TextStyle(color: m.isLowStock ? BarrColors.danger : null),
                      ),
                    ),
                    if (m.isLowStock || m.buyer != null)
                      m.buyer == null
                          ? FilledButton.tonal(
                              style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
                              onPressed: onToggleBuyer,
                              child: Text(l.illBuyIt),
                            )
                          : Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(l.buyerClaimed(m.buyer!.name),
                                    style: const TextStyle(color: BarrColors.ok)),
                                if (m.buyer!.uid == myUid)
                                  TextButton(onPressed: onToggleBuyer, child: Text(l.cancelClaim)),
                              ],
                            ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

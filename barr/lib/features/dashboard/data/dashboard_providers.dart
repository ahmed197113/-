import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/clock.dart';
import '../../../shared/domain/entities/app_user.dart';
import '../../../shared/domain/entities/elder.dart';
import '../../family/data/family_providers.dart';
import '../../medications/data/medication_providers.dart';
import '../../sos/data/sos_providers.dart';
import '../domain/alert_engine.dart';
import '../domain/timeline.dart';

class ElderDashboard {
  const ElderDashboard({required this.elder, required this.alerts, required this.timeline});

  final Elder elder;
  final List<FamilyAlert> alerts;
  final List<TimelineEvent> timeline;

  ElderStatus get status => statusOf(elder, alerts);
}

/// Keyed by [ElderRef] (value equality) — the elder is looked up live.
final elderDashboardProvider = Provider.family<ElderDashboard?, ElderRef>((ref, e) {
  final elder = (ref.watch(eldersProvider(e.familyId)).value ?? const <Elder>[])
      .where((x) => x.id == e.elderId)
      .firstOrNull;
  if (elder == null) return null;
  final now = ref.watch(nowProvider).value ?? DateTime.now();
  final doses = ref.watch(todayDosesProvider(e)) ?? const [];
  final meds = ref.watch(medicationsProvider(e)).value ?? const [];
  final sos = ref.watch(recentSosProvider(e)).value ?? const [];
  return ElderDashboard(
    elder: elder,
    alerts: alertsForElder(elder: elder, now: now, doses: doses, medications: meds, sosEvents: sos),
    timeline: timelineFor(elder: elder, now: now, doses: doses, sosEvents: sos),
  );
});

class FamilyDashboard {
  const FamilyDashboard({required this.elders, required this.alerts, required this.timeline});

  final List<ElderDashboard> elders;
  final List<FamilyAlert> alerts;
  final List<TimelineEvent> timeline;

  List<FamilyAlert> get openSos => alerts.where((a) => a.type == AlertType.sos).toList();
}

final familyDashboardProvider = Provider.family<FamilyDashboard?, String>((ref, fid) {
  final elders = ref.watch(eldersProvider(fid)).value;
  if (elders == null) return null;
  final per = [
    for (final e in elders)
      ?ref.watch(elderDashboardProvider(ElderRef(familyId: fid, elderId: e.id))),
  ];
  return FamilyDashboard(
    elders: per,
    alerts: sortAlerts([for (final d in per) ...d.alerts]),
    timeline: [for (final d in per) ...d.timeline]..sort((a, b) => b.at.compareTo(a.at)),
  );
});

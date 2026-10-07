import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../shared/domain/entities/app_user.dart';
import '../../../../shared/domain/entities/elder.dart';
import '../../../auth/data/auth_providers.dart';
import '../../../family/data/family_providers.dart';
import '../../../medications/presentation/labels.dart';
import '../../data/sos_providers.dart';
import '../../domain/sos_event.dart';

/// Caregiver: full-screen emergency with location, call, "I'm on it".
class SosAlertScreen extends ConsumerWidget {
  const SosAlertScreen({super.key, required this.elderId, required this.eventId});

  final String elderId;
  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final fid = ref.watch(currentFamilyIdProvider);
    if (fid == null) return const SizedBox.shrink();
    final elderRef = ElderRef(familyId: fid, elderId: elderId);
    final elder = (ref.watch(eldersProvider(fid)).value ?? const <Elder>[])
        .where((e) => e.id == elderId)
        .firstOrNull;
    final event = (ref.watch(recentSosProvider(elderRef)).value ?? const <SosEvent>[])
        .where((e) => e.id == eventId)
        .firstOrNull;
    final me = ref.watch(currentProfileProvider).value?.displayName ?? '';
    final repo = ref.read(sosRepositoryProvider);
    final resolved = event?.status == SosStatus.resolved;
    final color = resolved ? BarrColors.ok : BarrColors.danger;

    return Scaffold(
      backgroundColor: color,
      appBar: AppBar(
        foregroundColor: Colors.white,
        title: Text(l.sosTitle, style: const TextStyle(color: Colors.white, fontSize: 22)),
      ),
      body: SafeArea(
        child: event == null || elder == null
            ? const Center(child: CircularProgressIndicator(color: Colors.white))
            : ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Icon(resolved ? Icons.verified_user_rounded : Icons.sos_rounded,
                      size: 96, color: Colors.white),
                  const SizedBox(height: 8),
                  Text(
                    resolved ? l.sosResolvedBy(event.resolvedBy ?? '') : l.sosFrom(elder.displayName),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
                  ),
                  Text(l.sosAt(formatTime(context, event.at)),
                      textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 18)),
                  const SizedBox(height: 24),
                  _Panel(
                    child: event.location == null
                        ? ListTile(leading: const Icon(Icons.location_off_rounded), title: Text(l.noLocation))
                        : ListTile(
                            leading: const Icon(Icons.location_on_rounded, color: BarrColors.danger),
                            title: Text(l.openMap),
                            subtitle: event.location!.accuracy == null
                                ? null
                                : Text(l.locationAccuracy(event.location!.accuracy!.round())),
                            trailing: const Icon(Icons.open_in_new_rounded),
                            onTap: () => launchUrl(event.location!.mapsUri, mode: LaunchMode.externalApplication),
                          ),
                  ),
                  if (elder.phone != null) ...[
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: color),
                      onPressed: () => launchUrl(Uri(scheme: 'tel', path: elder.phone)),
                      icon: const Icon(Icons.call_rounded),
                      label: Text('${l.call} ${elder.displayName}'),
                    ),
                  ],
                  if (event.acknowledgedBy.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(l.followingBy(event.acknowledgedBy.join('، ')),
                        textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 16)),
                  ],
                  if (!resolved) ...[
                    const SizedBox(height: 16),
                    if (!event.acknowledgedBy.contains(me))
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: const BorderSide(color: Colors.white, width: 2),
                        ),
                        onPressed: () => runWithFeedback(
                            context, () => repo.acknowledge(elderRef, eventId, byName: me)),
                        icon: const Icon(Icons.directions_run_rounded),
                        label: Text(l.imOnIt),
                      ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white, width: 2),
                      ),
                      onPressed: () async {
                        final ok = await runWithFeedback(
                            context, () => repo.resolve(elderRef, eventId, byName: me));
                        if (ok && context.mounted && context.canPop()) context.pop();
                      },
                      icon: const Icon(Icons.verified_user_rounded),
                      label: Text(l.markSafe),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: child,
      );
}

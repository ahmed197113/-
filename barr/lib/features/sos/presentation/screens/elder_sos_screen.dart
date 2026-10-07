import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../elder_home/data/elder_home_providers.dart';
import '../../data/sos_providers.dart';
import '../../domain/sos_event.dart';
import '../elder_sos_controller.dart';

/// Parent: shown right after SOS — reassurance, call, and cancel.
class ElderSosScreen extends ConsumerStatefulWidget {
  const ElderSosScreen({super.key});

  @override
  ConsumerState<ElderSosScreen> createState() => _ElderSosScreenState();
}

class _ElderSosScreenState extends ConsumerState<ElderSosScreen> {
  String? _eventId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _send());
  }

  Future<void> _send() async {
    final controller = ref.read(elderSosControllerProvider);
    String? id;
    final ok = await runWithFeedback(context, () async => id = await controller.trigger());
    if (!mounted) return;
    setState(() => _eventId = id);
    if (ok) await controller.callEmergency();
  }

  Future<void> _cancel() async {
    final id = _eventId;
    if (id != null) {
      await runWithFeedback(context, () => ref.read(elderSosControllerProvider).cancel(id));
    }
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final elderRef = ref.watch(myElderRefProvider);
    final event = elderRef == null || _eventId == null
        ? null
        : (ref.watch(recentSosProvider(elderRef)).value ?? const <SosEvent>[])
            .where((e) => e.id == _eventId)
            .firstOrNull;
    final target = ref.read(elderSosControllerProvider).emergencyTarget();
    const white = TextStyle(color: Colors.white);

    return Theme(
      data: AppTheme.elder(),
      child: Scaffold(
        backgroundColor: BarrColors.danger,
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 24),
              Icon(_eventId == null ? Icons.wifi_tethering_rounded : Icons.check_circle_rounded,
                  size: 120, color: Colors.white),
              const SizedBox(height: 16),
              Text(_eventId == null ? l.sosSending : l.sosSent,
                  textAlign: TextAlign.center,
                  style: white.copyWith(fontSize: 36, fontWeight: FontWeight.w800)),
              if (_eventId != null)
                Text(l.sosSentBody, textAlign: TextAlign.center, style: white.copyWith(fontSize: 26)),
              if (event != null && event.acknowledgedBy.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(l.sosSomeoneOnIt(event.acknowledgedBy.join('، ')),
                    textAlign: TextAlign.center,
                    style: white.copyWith(fontSize: 26, fontWeight: FontWeight.w700)),
              ],
              const SizedBox(height: 32),
              if (target != null)
                FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: BarrColors.danger),
                  onPressed: () => ref.read(elderSosControllerProvider).callEmergency(),
                  icon: const Icon(Icons.call_rounded, size: 40),
                  label: Text('${l.call} ${target.name}'),
                ),
              const SizedBox(height: 16),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(88),
                  side: const BorderSide(color: Colors.white, width: 3),
                  textStyle: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                ),
                onPressed: _cancel,
                child: Text(l.sosCancel, textAlign: TextAlign.center),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

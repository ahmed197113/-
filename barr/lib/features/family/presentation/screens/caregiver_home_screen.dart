import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/router/app_stage.dart';
import '../../../../core/services/push_service.dart';
import '../../../../core/services/service_providers.dart';
import '../../../../core/utils/phone.dart';
import '../../../../core/widgets/demo_banner.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/skeleton.dart';
import '../../../../shared/domain/entities/enums.dart';
import '../../../../shared/domain/entities/family.dart';
import '../../../auth/data/auth_providers.dart';
import '../../../dashboard/data/dashboard_providers.dart';
import '../../../dashboard/domain/alert_engine.dart';
import '../../../dashboard/presentation/widgets/alerts_bar.dart';
import '../../../dashboard/presentation/widgets/timeline_section.dart';
import '../../../sos/domain/sos_event.dart';
import '../../data/family_providers.dart';
import '../l10n_labels.dart';
import '../widgets/elder_card.dart';

class CaregiverHomeScreen extends ConsumerStatefulWidget {
  const CaregiverHomeScreen({super.key});

  @override
  ConsumerState<CaregiverHomeScreen> createState() => _CaregiverHomeScreenState();
}

class _CaregiverHomeScreenState extends ConsumerState<CaregiverHomeScreen> {
  StreamSubscription<PushOpen>? _pushSub;

  /// SOS events already shown full-screen in this session.
  final _shownSos = <String>{};

  @override
  void initState() {
    super.initState();
    final push = ref.read(pushServiceProvider);
    _pushSub = push.opened.listen(_onPushOpened);
    final uid = ref.read(authUidProvider).value;
    if (uid != null) push.start(uid);

    // Open a new emergency full-screen as soon as it appears.
    ref.listenManual(familyDashboardProvider(ref.read(currentFamilyIdProvider) ?? ''), (_, next) {
      for (final a in next?.openSos ?? const <FamilyAlert>[]) {
        if (a.sos!.status == SosStatus.active && _shownSos.add(a.sos!.id)) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) context.push(Routes.sosAlert(a.elder.id, a.sos!.id));
          });
          break;
        }
      }
    }, fireImmediately: true);
  }

  @override
  void dispose() {
    _pushSub?.cancel();
    super.dispose();
  }

  void _onPushOpened(PushOpen p) {
    if (!mounted) return;
    if (p.type == 'sos' && p.elderId != null && p.eventId != null) {
      _shownSos.add(p.eventId!);
      context.push(Routes.sosAlert(p.elderId!, p.eventId!));
    } else if (p.elderId != null) {
      context.push(Routes.medications(p.elderId!));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final fid = ref.watch(currentFamilyIdProvider);
    if (fid == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    final family = ref.watch(familyProvider(fid)).value;
    final eldersAsync = ref.watch(eldersProvider(fid));
    final members = ref.watch(membersProvider(fid)).value ?? const <Member>[];
    final invites = ref.watch(invitesProvider(fid)).value ?? const <Invite>[];
    final role = ref.watch(myRoleProvider(fid));
    final dashboard = ref.watch(familyDashboardProvider(fid));

    Future<void> showLimit(String message) => showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            icon: const Icon(Icons.workspace_premium_rounded, size: 40),
            content: Text(message, textAlign: TextAlign.center),
            actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l.close))],
          ),
        );

    void addElder() {
      final count = eldersAsync.value?.length ?? 0;
      if (family != null && count >= family.maxElders) {
        showLimit(l.freePlanEldersLimit);
      } else {
        context.push(Routes.addElder);
      }
    }

    void inviteMember() {
      final nonElder = members.where((m) => m.role != FamilyRole.elder).length + invites.length;
      if (family != null && nonElder >= family.maxMembers) {
        showLimit(l.freePlanMembersLimit);
      } else {
        context.push(Routes.invite);
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(family?.name ?? l.myFamily),
        actions: [
          IconButton(
            tooltip: l.settings,
            icon: const Icon(Icons.settings_rounded),
            onPressed: () => context.push(Routes.settings),
          ),
        ],
      ),
      floatingActionButton: role.canEdit
          ? FloatingActionButton.extended(
              onPressed: addElder,
              icon: const Icon(Icons.person_add_alt_1_rounded),
              label: Text(l.addParent),
            )
          : null,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
          children: [
            const ClipRRect(
              borderRadius: BorderRadius.all(Radius.circular(12)),
              child: DemoBanner(),
            ),
            if (dashboard != null) AlertsBar(alerts: dashboard.alerts),
            _SectionTitle(l.parentsSection),
            ...eldersAsync.when(
              loading: () => const [Skeleton(height: 140)],
              error: (e, _) => [Text(l.errorUnknown)],
              data: (elders) => elders.isEmpty
                  ? [
                      EmptyState(
                        icon: Icons.elderly_rounded,
                        title: l.noParentsTitle,
                        body: l.noParentsBody,
                        action: role.canEdit
                            ? FilledButton.icon(
                                onPressed: addElder,
                                icon: const Icon(Icons.add_rounded),
                                label: Text(l.addParent),
                              )
                            : null,
                      ),
                    ]
                  : [
                      for (final e in elders) ...[
                        ElderCard(
                          elder: e,
                          onLink: () => context.push(Routes.linkElder(e.id)),
                          onOpen: () => context.push(Routes.medications(e.id)),
                        ),
                        const SizedBox(height: 12),
                      ],
                    ],
            ),
            if ((eldersAsync.value ?? const []).isNotEmpty) ...[
              _SectionTitle(l.todayTimeline),
              TimelineSection(events: dashboard?.timeline ?? const []),
            ],
            _SectionTitle(l.membersSection),
            Card(
              child: Column(
                children: [
                  for (final m in members)
                    ListTile(
                      leading: CircleAvatar(
                        child: Text(m.displayName.characters.firstOrNull ?? '؟'),
                      ),
                      title: Text(m.displayName),
                      subtitle: m.phone == null ? null : Text(PhoneUtils.display(m.phone!),
                          textDirection: TextDirection.ltr, textAlign: TextAlign.start),
                      trailing: Chip(label: Text(m.role.label(l))),
                    ),
                  for (final i in invites)
                    ListTile(
                      leading: const CircleAvatar(child: Icon(Icons.hourglass_top_rounded)),
                      title: Text(PhoneUtils.display(i.phone), textDirection: TextDirection.ltr,
                          textAlign: TextAlign.start),
                      subtitle: Text(l.pendingInvite),
                      trailing: Chip(label: Text(i.role.label(l))),
                    ),
                  if (role.canManageMembers)
                    ListTile(
                      leading: const Icon(Icons.group_add_rounded),
                      title: Text(l.inviteSibling),
                      onTap: inviteMember,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 20, 4, 10),
        child: Semantics(
          header: true,
          child: Text(
            text,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
        ),
      );
}

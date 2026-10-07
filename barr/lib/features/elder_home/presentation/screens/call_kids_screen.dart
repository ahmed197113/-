import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/elder_home_providers.dart';

/// One big tappable card per child — tap to call.
class CallKidsScreen extends ConsumerWidget {
  const CallKidsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final kids = ref.watch(myChildrenProvider).where((m) => m.phone != null).toList();

    return Theme(
      data: AppTheme.elder(),
      child: Builder(builder: (context) {
        return Scaffold(
          appBar: AppBar(
            toolbarHeight: 80,
            title: Text(l.callMyKids, style: Theme.of(context).textTheme.titleLarge),
            leading: IconButton(
              iconSize: 40,
              icon: const BackButtonIcon(),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          body: SafeArea(
            child: kids.isEmpty
                ? Center(
                    child: Text(l.noKidsPhones,
                        textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: kids.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 16),
                    itemBuilder: (context, i) {
                      final kid = kids[i];
                      return Semantics(
                        button: true,
                        label: '${l.callMyKids}: ${kid.displayName}',
                        excludeSemantics: true,
                        child: Material(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(28),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(28),
                            onTap: () => launchUrl(Uri(scheme: 'tel', path: kid.phone)),
                            child: Padding(
                              padding: const EdgeInsets.all(20),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 44,
                                    backgroundColor: BarrColors.warm,
                                    child: Text(
                                      kid.displayName.characters.firstOrNull ?? '؟',
                                      style: const TextStyle(
                                          fontSize: 40, color: Colors.white, fontWeight: FontWeight.w800),
                                    ),
                                  ),
                                  const SizedBox(width: 20),
                                  Expanded(
                                    child: Text(kid.displayName,
                                        style: Theme.of(context).textTheme.headlineMedium),
                                  ),
                                  const Icon(Icons.call_rounded, size: 48, color: BarrColors.ok),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        );
      }),
    );
  }
}

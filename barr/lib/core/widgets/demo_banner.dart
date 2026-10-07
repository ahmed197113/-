import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../l10n/generated/app_localizations.dart';

class DemoBanner extends ConsumerWidget {
  const DemoBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(appConfigProvider).isDemo) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: scheme.tertiaryContainer,
      child: Text(
        AppLocalizations.of(context).demoModeBanner,
        textAlign: TextAlign.center,
        style: TextStyle(color: scheme.onTertiaryContainer, fontSize: 13),
      ),
    );
  }
}

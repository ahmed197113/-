import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/generated/app_localizations.dart';
import '../../../../core/router/app_stage.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/demo_banner.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const DemoBanner(),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    const Spacer(),
                    Container(
                      width: 120,
                      height: 120,
                      decoration: const BoxDecoration(color: BarrColors.teal, shape: BoxShape.circle),
                      child: const Icon(Icons.favorite_rounded, size: 64, color: Colors.white),
                    ),
                    const SizedBox(height: 24),
                    Text(l.welcomeTitle,
                        style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text(l.welcomeSubtitle,
                        style: theme.textTheme.titleMedium
                            ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    const Spacer(),
                    FilledButton.icon(
                      onPressed: () => context.push(Routes.phone),
                      icon: const Icon(Icons.phone_iphone_rounded),
                      label: Text(l.welcomeStartWithPhone),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () => context.push(Routes.elderLink),
                      icon: const Icon(Icons.pin_rounded),
                      label: Text(l.welcomeHaveLinkCode, textAlign: TextAlign.center),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      l.disclaimer,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

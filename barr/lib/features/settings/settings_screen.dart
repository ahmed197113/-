import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/feedback.dart';
import '../auth/data/auth_providers.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);

    Future<void> deleteAccount() async {
      final ok = await confirmDialog(
        context,
        title: l.deleteAccount,
        message: l.deleteAccountConfirm,
        confirmLabel: l.confirm,
        cancelLabel: l.cancel,
        destructive: true,
      );
      if (ok && context.mounted) {
        await runWithFeedback(context, () => ref.read(authRepositoryProvider).deleteAccount());
      }
    }

    return Scaffold(
      appBar: AppBar(title: Text(l.settings)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: theme.colorScheme.secondaryContainer,
            child: ListTile(
              leading: const Icon(Icons.health_and_safety_rounded),
              title: Text(l.disclaimerTitle, style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(l.disclaimer),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.logout_rounded),
                  title: Text(l.signOut),
                  onTap: () => ref.read(authRepositoryProvider).signOut(),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(Icons.delete_forever_rounded, color: theme.colorScheme.error),
                  title: Text(l.deleteAccount, style: TextStyle(color: theme.colorScheme.error)),
                  onTap: deleteAccount,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../core/app_state.dart';
import '../core/l10n.dart';
import '../widgets/common.dart';
import 'home_shell.dart';

class SettingsTab extends StatelessWidget {
  const SettingsTab({super.key});

  Future<void> _editName(BuildContext context, AppState app) async {
    final controller = TextEditingController(text: app.name);
    final value = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(app.t('settings.name')),
        content: TextField(
          controller: controller,
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          decoration: InputDecoration(hintText: app.t('onboarding.nameHint')),
          onSubmitted: (v) => Navigator.pop(c, v),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c),
              child: Text(app.t('common.cancel'))),
          FilledButton(
              onPressed: () => Navigator.pop(c, controller.text),
              child: Text(app.t('common.save'))),
        ],
      ),
    );
    controller.dispose();
    if (value != null) app.setName(value);
  }

  void _pickLanguage(BuildContext context, AppState app) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            for (final e in L10n.languages.entries)
              ListTile(
                title: Text(e.value,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                trailing: app.locale == e.key
                    ? const Icon(Icons.check_circle_rounded)
                    : null,
                onTap: () {
                  app.setLocale(e.key);
                  Navigator.pop(c);
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _reset(BuildContext context, AppState app) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(app.t('settings.resetTitle')),
        content: Text(app.t('settings.resetBody')),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: Text(app.t('common.cancel'))),
          FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(c).colorScheme.error),
              onPressed: () => Navigator.pop(c, true),
              child: Text(app.t('settings.reset'))),
        ],
      ),
    );
    if (ok == true) {
      HomeShell.tab.value = 0;
      await app.resetAll();
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final theme = Theme.of(context);
    final latest = app.latest;

    Widget tile(IconData icon, String title,
            {String? subtitle, VoidCallback? onTap, Widget? trailing}) =>
        ListTile(
          leading: Icon(icon, color: theme.colorScheme.primary),
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: subtitle == null ? null : Text(subtitle),
          trailing: trailing ?? const Icon(Icons.chevron_right_rounded),
          onTap: onTap,
        );

    void page(String titleKey, String bodyKey) =>
        Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => TextPage(titleKey: titleKey, bodyKey: bodyKey)));

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          Panel(
            child: Row(children: [
              CircleAvatar(
                radius: 32,
                backgroundColor: theme.colorScheme.primaryContainer,
                child: Text(
                  latest?.emoji ??
                      (app.name.isEmpty ? '🙂' : app.name[0].toUpperCase()),
                  style: const TextStyle(fontSize: 30),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(app.name.isEmpty ? app.t('settings.guest') : app.name,
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w800)),
                    Text(
                      latest == null
                          ? app.t('settings.noType')
                          : app.t('types.${latest.typeKey}.name'),
                      style:
                          TextStyle(color: theme.colorScheme.onSurfaceVariant),
                    ),
                    Text(app.t('settings.testsTaken', {'n': app.results.length}),
                        style: TextStyle(
                            fontSize: 12.5,
                            color: theme.colorScheme.onSurfaceVariant)),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_rounded),
                onPressed: () => _editName(context, app),
              ),
            ]),
          ),
          SectionTitle(app.t('settings.preferences')),
          Card(
            child: Column(children: [
              tile(Icons.translate_rounded, app.t('settings.language'),
                  subtitle: L10n.languages[app.locale],
                  onTap: () => _pickLanguage(context, app)),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Icon(Icons.dark_mode_rounded,
                          color: theme.colorScheme.primary),
                      const SizedBox(width: 16),
                      Text(app.t('settings.theme'),
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                    ]),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: SegmentedButton<ThemeMode>(
                        segments: [
                          ButtonSegment(
                              value: ThemeMode.system,
                              label: Text(app.t('settings.themeSystem'))),
                          ButtonSegment(
                              value: ThemeMode.light,
                              label: Text(app.t('settings.themeLight'))),
                          ButtonSegment(
                              value: ThemeMode.dark,
                              label: Text(app.t('settings.themeDark'))),
                        ],
                        selected: {app.themeMode},
                        showSelectedIcon: false,
                        onSelectionChanged: (s) => app.setTheme(s.first),
                      ),
                    ),
                  ],
                ),
              ),
            ]),
          ),
          SectionTitle(app.t('settings.learn')),
          Card(
            child: Column(children: [
              tile(Icons.science_rounded, app.t('settings.science'),
                  onTap: () => page('settings.science', 'legal.science')),
              tile(Icons.health_and_safety_rounded,
                  app.t('settings.disclaimer'),
                  onTap: () => page('settings.disclaimer', 'legal.disclaimer')),
              tile(Icons.privacy_tip_rounded, app.t('settings.privacy'),
                  onTap: () => page('settings.privacy', 'legal.privacy')),
              tile(Icons.info_rounded, app.t('settings.about'),
                  onTap: () => page('settings.about', 'legal.about')),
              tile(Icons.share_rounded, app.t('settings.shareApp'),
                  onTap: () => SharePlus.instance
                      .share(ShareParams(text: app.t('share.app')))),
            ]),
          ),
          SectionTitle(app.t('settings.data')),
          Card(
            child: tile(Icons.delete_forever_rounded, app.t('settings.reset'),
                subtitle: app.t('settings.resetSubtitle'),
                trailing: const SizedBox.shrink(),
                onTap: () => _reset(context, app)),
          ),
          const SizedBox(height: 28),
          const Center(child: LogoMark(size: 44)),
          const SizedBox(height: 8),
          Text('Mirra 1.0.0',
              textAlign: TextAlign.center,
              style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
        ],
      ),
    );
  }
}

/// Simple scrollable text page; [bodyKey] points to a list of paragraphs.
/// Paragraphs starting with "# " are rendered as headings.
class TextPage extends StatelessWidget {
  const TextPage({super.key, required this.titleKey, required this.bodyKey});

  final String titleKey;
  final String bodyKey;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(app.t(titleKey))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(22, 8, 22, 40),
        children: [
          for (final p in app.l10n.list(bodyKey))
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: p.startsWith('# ')
                  ? Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text(p.substring(2),
                          style: theme.textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w800)),
                    )
                  : Text(p, style: const TextStyle(height: 1.7)),
            ),
        ],
      ),
    );
  }
}

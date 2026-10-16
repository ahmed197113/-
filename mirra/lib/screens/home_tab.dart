import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/personality.dart';
import '../widgets/common.dart';
import 'home_shell.dart';
import 'result_screen.dart';
import 'test_screen.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key});

  static void startTest(BuildContext context) => Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => const TestScreen()));

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final latest = app.latest;
    final theme = Theme.of(context);
    final dayOfYear =
        DateTime.now().difference(DateTime(DateTime.now().year)).inDays;
    final tips = app.l10n.list('tips');

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    app.name.isEmpty
                        ? app.t('home.helloAnon')
                        : app.t('home.hello', {'name': app.name}),
                    style: theme.textTheme.headlineSmall
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(app.t('home.subtitle'),
                      style: TextStyle(
                          color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
            const LogoMark(size: 48),
          ]),
          const SizedBox(height: 22),
          if (app.progress.isNotEmpty) ...[
            Panel(
              onTap: () => startTest(context),
              child: Row(children: [
                SizedBox(
                  width: 52,
                  height: 52,
                  child: Stack(alignment: Alignment.center, children: [
                    CircularProgressIndicator(
                      value: app.progress.length / Personality.questionCount,
                      strokeWidth: 5,
                      backgroundColor: theme.colorScheme.primaryContainer,
                    ),
                    Text(
                        '${(app.progress.length / Personality.questionCount * 100).round()}%',
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w700)),
                  ]),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(app.t('home.continueTitle'),
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 16)),
                      Text(app.t('home.continueBody')),
                    ],
                  ),
                ),
                const Icon(Icons.play_circle_fill_rounded, size: 36),
              ]),
            ),
            const SizedBox(height: 16),
          ],
          if (latest == null)
            _DiscoverCard(onStart: () => startTest(context))
          else
            _TypeCard(result: latest),
          if (latest != null) ...[
            const SizedBox(height: 16),
            Panel(
              child: Column(children: [
                for (final t in Personality.traits) ...[
                  TraitBar(
                    trait: t,
                    label: app.t('traits.$t.name'),
                    value: latest.scores[t]!,
                  ),
                  if (t != Personality.traits.last) const SizedBox(height: 14),
                ],
              ]),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => startTest(context),
              icon: const Icon(Icons.refresh_rounded),
              label: Text(app.t('home.retake')),
            ),
          ],
          if (app.plan != null) ...[
            SectionTitle(app.t('home.todayChallenge'),
                icon: Icons.flag_rounded),
            Panel(
              onTap: () => HomeShell.goTo(context, 1),
              child: Row(children: [
                Icon(Personality.icons[app.plan!.traitFor(app.plan!.today)],
                    color:
                        Personality.colors[app.plan!.traitFor(app.plan!.today)],
                    size: 32),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    app.t(
                        'challenges.${app.plan!.traitFor(app.plan!.today)}.${app.plan!.challengeFor(app.plan!.today)}'),
                    style: const TextStyle(height: 1.5),
                  ),
                ),
                Icon(
                  app.plan!.done.contains(app.plan!.today)
                      ? Icons.check_circle_rounded
                      : Icons.chevron_right_rounded,
                  color: theme.colorScheme.primary,
                ),
              ]),
            ),
          ],
          if (tips.isNotEmpty) ...[
            SectionTitle(app.t('home.tipTitle'),
                icon: Icons.tips_and_updates_rounded),
            Panel(
              child: Text(tips[dayOfYear % tips.length],
                  style: const TextStyle(fontSize: 15, height: 1.6)),
            ),
          ],
          SectionTitle(app.t('home.scienceTitle'),
              icon: Icons.science_rounded),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(app.t('home.scienceBody'),
                    style: const TextStyle(height: 1.6)),
                const SizedBox(height: 12),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final t in Personality.traits)
                    Chip(
                      avatar: Icon(Personality.icons[t],
                          size: 18, color: Personality.colors[t]),
                      label: Text(app.t('traits.$t.name')),
                    ),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DiscoverCard extends StatelessWidget {
  const _DiscoverCard({required this.onStart});

  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return GradientCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.psychology_alt_rounded, size: 46),
          const SizedBox(height: 12),
          Text(app.t('home.discoverTitle'),
              style:
                  const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text(app.t('home.discoverBody'),
              style: const TextStyle(height: 1.5, color: Colors.white70)),
          const SizedBox(height: 16),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final key in ['chipQuestions', 'chipTime', 'chipScience'])
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(app.t('home.$key'),
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600)),
              ),
          ]),
          const SizedBox(height: 20),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF6C4BFF),
            ),
            onPressed: onStart,
            child: Text(app.t('home.startTest')),
          ),
        ],
      ),
    );
  }
}

class _TypeCard extends StatelessWidget {
  const _TypeCard({required this.result});

  final TestResult result;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final key = result.typeKey;
    return GradientCard(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => ResultScreen(result: result))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Text(result.emoji, style: const TextStyle(fontSize: 46)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(app.t('home.yourType'),
                      style: const TextStyle(color: Colors.white70)),
                  Text(app.t('types.$key.name'),
                      style: const TextStyle(
                          fontSize: 24, fontWeight: FontWeight.w800)),
                  Text(app.t('variants.${result.variant}.name'),
                      style: const TextStyle(
                          color: Colors.white70, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 12),
          Text(app.t('types.$key.tagline'),
              style: const TextStyle(fontSize: 15, height: 1.5)),
          const SizedBox(height: 14),
          Row(children: [
            Text(app.t('home.viewReport'),
                style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(width: 6),
            const Icon(Icons.arrow_forward_rounded, size: 20),
          ]),
        ],
      ),
    );
  }
}

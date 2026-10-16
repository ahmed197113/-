import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/personality.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import '../widgets/radar_chart.dart';
import 'home_shell.dart';

class ResultScreen extends StatelessWidget {
  const ResultScreen({super.key, required this.result, this.fresh = false});

  final TestResult result;
  final bool fresh;

  String _shareText(AppState app) {
    final key = result.typeKey;
    final lines = [
      app.t('share.headline', {
        'type': '${result.emoji} ${app.t('types.$key.name')}',
      }),
      app.t('types.$key.tagline'),
      '',
      for (final t in Personality.traits)
        '• ${app.t('traits.$t.name')}: ${result.scores[t]!.round()}%',
      '',
      app.t('share.cta'),
    ];
    return lines.join('\n');
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final theme = Theme.of(context);
    final s = result.scores;
    final key = result.typeKey;
    final ranked = Personality.ranked(s);
    final focus = Personality.focusTraits(s);
    final insights = Personality.insights(s);
    final told = [
      for (final t in ranked)
        for (final (i, agreed) in Personality.evidence(result.answers, t, max: 1))
          app.t('questions.$i.${agreed ? 'me' : 'not'}'),
    ];
    final labels = {
      for (final t in Personality.traits) t: app.t('traits.$t.name')
    };
    final portrait = [
      app.name.isEmpty
          ? app.t('result.portraitIntroAnon')
          : app.t('result.portraitIntro', {'name': app.name}),
      for (final t in ranked)
        app.t('traits.$t.${Personality.level(s[t]!)}.summary'),
      app.t('variants.${result.variant}.text'),
    ].join(' ');

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _header(context, app)),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
            sliver: SliverList.list(children: [
              Panel(
                child: Center(
                  child: RadarChart(scores: s, labels: labels, size: 300),
                ),
              ),
              if (told.isNotEmpty) ...[
                SectionTitle(app.t('result.evidenceTitle'),
                    icon: Icons.record_voice_over_rounded),
                Panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                          app.t('result.evidenceBody',
                              {'n': result.answers.length}),
                          style: TextStyle(
                              height: 1.5,
                              color: theme.colorScheme.onSurfaceVariant)),
                      const SizedBox(height: 10),
                      BulletList(told,
                          icon: Icons.format_quote_rounded,
                          color: theme.colorScheme.primary),
                    ],
                  ),
                ),
              ],
              SectionTitle(app.t('result.portraitTitle'),
                  icon: Icons.auto_awesome_rounded),
              Panel(
                child: Text(portrait,
                    style: const TextStyle(fontSize: 15.5, height: 1.75)),
              ),
              SectionTitle(app.t('result.superpower'),
                  icon: Icons.bolt_rounded),
              Row(children: [
                Expanded(
                  child: _HighlightTile(
                    title: app.t('result.strongest'),
                    trait: ranked.first,
                    value: s[ranked.first]!,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _HighlightTile(
                    title: app.t('result.growthArea'),
                    trait: ranked.last,
                    value: s[ranked.last]!,
                  ),
                ),
              ]),
              if (insights.isNotEmpty) ...[
                SectionTitle(app.t('result.insightsTitle'),
                    icon: Icons.insights_rounded),
                for (final id in insights)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Panel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(app.t('insights.$id.title'),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800, fontSize: 16)),
                          const SizedBox(height: 6),
                          Text(app.t('insights.$id.text'),
                              style: const TextStyle(height: 1.6)),
                        ],
                      ),
                    ),
                  ),
              ],
              SectionTitle(app.t('result.typeTitle'),
                  icon: Icons.fingerprint_rounded),
              Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(app.t('types.$key.desc'),
                        style: const TextStyle(height: 1.7)),
                    const SizedBox(height: 16),
                    _subTitle(context, app.t('result.strengths')),
                    BulletList(app.l10n.list('types.$key.strengths'),
                        icon: Icons.star_rounded, color: Brand.gold),
                    const SizedBox(height: 12),
                    _subTitle(context, app.t('result.blindSpots')),
                    BulletList(app.l10n.list('types.$key.blind'),
                        icon: Icons.visibility_off_rounded,
                        color: theme.colorScheme.error),
                    const SizedBox(height: 12),
                    _subTitle(context, app.t('result.careers')),
                    const SizedBox(height: 6),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final c in app.l10n.list('types.$key.careers'))
                        Chip(
                          avatar: const Icon(Icons.work_outline_rounded,
                              size: 16),
                          label: Text(c),
                        ),
                    ]),
                  ],
                ),
              ),
              SectionTitle(app.t('result.traitsTitle'),
                  icon: Icons.analytics_rounded),
              for (final t in Personality.traits)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _TraitDetail(
                      trait: t, value: s[t]!, answers: result.answers),
                ),
              const SizedBox(height: 12),
              GradientCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.rocket_launch_rounded, size: 40),
                    const SizedBox(height: 10),
                    Text(app.t('result.planTitle'),
                        style: const TextStyle(
                            fontSize: 22, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text(
                      app.t('result.planBody', {
                        'a': app.t('traits.${focus[0]}.name'),
                        'b': app.t('traits.${focus[1]}.name'),
                      }),
                      style:
                          const TextStyle(color: Colors.white70, height: 1.5),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Brand.primary,
                      ),
                      onPressed: () {
                        app.startPlan(focus);
                        HomeShell.goTo(context, 1);
                      },
                      child: Text(app.plan == null
                          ? app.t('result.planStart')
                          : app.t('result.planRestart')),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => SharePlus.instance
                    .share(ShareParams(text: _shareText(app))),
                icon: const Icon(Icons.ios_share_rounded),
                label: Text(app.t('result.share')),
              ),
              const SizedBox(height: 20),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline_rounded,
                      size: 18, color: theme.colorScheme.onSurfaceVariant),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(app.t('legal.disclaimerShort'),
                        style: TextStyle(
                            fontSize: 12.5,
                            height: 1.5,
                            color: theme.colorScheme.onSurfaceVariant)),
                  ),
                ],
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _subTitle(BuildContext context, String text) => Text(text,
      style: TextStyle(
          fontWeight: FontWeight.w800,
          color: Theme.of(context).colorScheme.primary));

  Widget _header(BuildContext context, AppState app) {
    final key = result.typeKey;
    final date = MaterialLocalizations.of(context).formatMediumDate(result.date);
    return Container(
      decoration: const BoxDecoration(
        gradient: Brand.gradient,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(34)),
      ),
      padding: EdgeInsets.fromLTRB(
          12, MediaQuery.paddingOf(context).top + 4, 12, 28),
      child: Column(children: [
        Row(children: [
          IconButton(
            color: Colors.white,
            icon: const BackButtonIcon(),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
          Expanded(
            child: Text(date,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70)),
          ),
          IconButton(
            color: Colors.white,
            icon: const Icon(Icons.ios_share_rounded),
            onPressed: () =>
                SharePlus.instance.share(ShareParams(text: _shareText(app))),
          ),
        ]),
        TweenAnimationBuilder<double>(
          tween: Tween(begin: fresh ? 0.3 : 1, end: 1),
          duration: const Duration(milliseconds: 700),
          curve: Curves.elasticOut,
          builder: (_, v, child) => Transform.scale(scale: v, child: child),
          child: Container(
            width: 110,
            height: 110,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
            child: Text(result.emoji, style: const TextStyle(fontSize: 58)),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          app.name.isEmpty
              ? app.t('result.youAre')
              : app.t('result.nameIs', {'name': app.name}),
          style: const TextStyle(color: Colors.white70, fontSize: 15),
        ),
        const SizedBox(height: 4),
        Text(app.t('types.$key.name'),
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(app.t('variants.${result.variant}.name'),
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text(app.t('types.$key.tagline'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: Colors.white, fontSize: 16, height: 1.5)),
        ),
      ]),
    );
  }
}

class _HighlightTile extends StatelessWidget {
  const _HighlightTile(
      {required this.title, required this.trait, required this.value});

  final String title;
  final String trait;
  final double value;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final color = Personality.colors[trait]!;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Personality.icons[trait], color: color, size: 30),
          const SizedBox(height: 10),
          Text(title,
              style: TextStyle(
                  fontSize: 12.5,
                  color: Theme.of(context).colorScheme.onSurfaceVariant)),
          Text(app.t('traits.$trait.name'),
              style:
                  const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          Text('${value.round()}%',
              style: TextStyle(
                  color: color, fontWeight: FontWeight.w800, fontSize: 20)),
        ],
      ),
    );
  }
}

class _TraitDetail extends StatelessWidget {
  const _TraitDetail(
      {required this.trait, required this.value, required this.answers});

  final String trait;
  final double value;
  final Map<int, int> answers;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final level = Personality.level(value);
    final base = 'traits.$trait.$level';
    final color = Personality.colors[trait]!;
    final why = [
      for (final (i, agreed) in Personality.evidence(answers, trait))
        app.t('questions.$i.${agreed ? 'me' : 'not'}'),
    ];

    Widget block(IconData icon, String title, Widget body) => Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(icon, size: 18, color: color),
                const SizedBox(width: 6),
                Text(title,
                    style: TextStyle(
                        fontWeight: FontWeight.w800, color: color)),
              ]),
              const SizedBox(height: 4),
              body,
            ],
          ),
        );

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.fromLTRB(18, 10, 12, 10),
          childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 20),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          title: TraitBar(
            trait: trait,
            label: app.t('traits.$trait.name'),
            value: value,
            levelLabel: app.t('levels.$level'),
          ),
          children: [
            Text(app.t('$base.title'),
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 17)),
            const SizedBox(height: 6),
            Text(app.t('traits.$trait.desc'),
                style: TextStyle(
                    height: 1.6,
                    color: Theme.of(context).colorScheme.onSurfaceVariant)),
            if (why.isNotEmpty)
              block(Icons.format_quote_rounded, app.t('result.whyScore'),
                  BulletList(why, icon: Icons.check_rounded, color: color)),
            block(Icons.star_rounded, app.t('result.strengths'),
                BulletList(app.l10n.list('$base.strengths'),
                    icon: Icons.check_rounded, color: color)),
            block(Icons.warning_amber_rounded, app.t('result.challenges'),
                BulletList(app.l10n.list('$base.challenges'),
                    icon: Icons.remove_rounded, color: color)),
            block(Icons.work_rounded, app.t('result.atWork'),
                Text(app.t('$base.work'), style: const TextStyle(height: 1.6))),
            block(Icons.favorite_rounded, app.t('result.inLove'),
                Text(app.t('$base.love'), style: const TextStyle(height: 1.6))),
            block(Icons.trending_up_rounded, app.t('result.howToGrow'),
                BulletList(app.l10n.list('$base.tips'),
                    icon: Icons.arrow_right_rounded, color: color)),
          ],
        ),
      ),
    );
  }
}

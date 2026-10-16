import 'dart:async';

import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/personality.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'result_screen.dart';

class TestScreen extends StatefulWidget {
  const TestScreen({super.key});

  @override
  State<TestScreen> createState() => _TestScreenState();
}

class _TestScreenState extends State<TestScreen> {
  late int _index;
  bool _busy = false;

  static const _likertEmoji = ['🙅', '🤔', '😐', '🙂', '💯'];

  static const _likertColors = [
    Color(0xFFEF4444),
    Color(0xFFF97316),
    Color(0xFF94A3B8),
    Color(0xFF22C55E),
    Color(0xFF10B981),
  ];

  @override
  void initState() {
    super.initState();
    final answered = AppScope.read(context).progress;
    _index = 0;
    while (answered.containsKey(_index) &&
        _index < Personality.questionCount - 1) {
      _index++;
    }
  }

  Future<void> _choose(int value) async {
    if (_busy) return;
    final app = AppScope.read(context);
    app.answer(_index, value);
    setState(() => _busy = true);
    await Future<void>.delayed(const Duration(milliseconds: 260));
    if (!mounted) return;
    if (app.progress.length >= Personality.questionCount) {
      await Navigator.of(context).pushReplacement(PageRouteBuilder(
        pageBuilder: (_, _, _) => const _AnalyzingScreen(),
        transitionsBuilder: (_, a, _, child) =>
            FadeTransition(opacity: a, child: child),
      ));
      return;
    }
    setState(() {
      _busy = false;
      // Jump to the next unanswered question.
      var next = (_index + 1) % Personality.questionCount;
      while (app.progress.containsKey(next)) {
        next = (next + 1) % Personality.questionCount;
      }
      _index = next;
    });
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final theme = Theme.of(context);
    final total = Personality.questionCount;
    final done = app.progress.length;
    final selected = app.progress[_index];
    final encourage = app.l10n.list('test.encourage');
    final stage = (done * encourage.length / total).floor();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          tooltip: app.t('test.saveExit'),
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(app.t('test.saved'))));
            Navigator.of(context).pop();
          },
        ),
        title: Text(app.t('test.counter', {'n': _index + 1, 'total': total})),
        actions: [
          IconButton(
            icon: const Icon(Icons.undo_rounded),
            tooltip: app.t('common.back'),
            onPressed: _index == 0
                ? null
                : () => setState(() => _index--),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(end: done / total),
                duration: const Duration(milliseconds: 300),
                builder: (_, v, _) => ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: v,
                    minHeight: 8,
                    backgroundColor: theme.colorScheme.primaryContainer,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              if (encourage.isNotEmpty)
                Text(
                  encourage[stage.clamp(0, encourage.length - 1)],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: theme.colorScheme.onSurfaceVariant, fontSize: 13),
                ),
              const Spacer(),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 280),
                transitionBuilder: (child, a) => FadeTransition(
                  opacity: a,
                  child: SlideTransition(
                    position: Tween(
                            begin: const Offset(0.08, 0), end: Offset.zero)
                        .animate(a),
                    child: child,
                  ),
                ),
                child: Column(
                  key: ValueKey(_index),
                  children: [
                    Text(app.t('test.prompt'),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w600)),
                    const SizedBox(height: 14),
                    Text(
                      app.t('questions.$_index.q'),
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800, height: 1.4),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              for (var v = 5; v >= 1; v--)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _OptionButton(
                    label: app.t('likert.${v - 1}'),
                    emoji: _likertEmoji[v - 1],
                    color: _likertColors[v - 1],
                    selected: selected == v,
                    onTap: () => _choose(v),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OptionButton extends StatelessWidget {
  const _OptionButton({
    required this.label,
    required this.emoji,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String emoji;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: selected ? color.withValues(alpha: 0.14) : theme.cardTheme.color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: selected ? color : theme.colorScheme.outlineVariant,
            width: selected ? 2 : 1),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(children: [
              Text(emoji, style: const TextStyle(fontSize: 22)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label,
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight:
                            selected ? FontWeight.w700 : FontWeight.w500)),
              ),
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected ? color : Colors.transparent,
                  border: Border.all(color: color, width: 2),
                ),
                child: selected
                    ? const Icon(Icons.check, size: 14, color: Colors.white)
                    : null,
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _AnalyzingScreen extends StatefulWidget {
  const _AnalyzingScreen();

  @override
  State<_AnalyzingScreen> createState() => _AnalyzingScreenState();
}

class _AnalyzingScreenState extends State<_AnalyzingScreen>
    with SingleTickerProviderStateMixin {
  late final _pulse = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 900))
    ..repeat(reverse: true);
  Timer? _timer;
  int _step = 0;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 800), (t) {
      final steps = AppScope.read(context).l10n.list('analyzing').length;
      if (_step < steps - 1) {
        setState(() => _step++);
      } else {
        t.cancel();
        final result = AppScope.read(context).completeTest();
        Navigator.of(context).pushReplacement(MaterialPageRoute(
            builder: (_) => ResultScreen(result: result, fresh: true)));
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final steps = AppScope.of(context).l10n.list('analyzing');
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: Brand.gradient),
        alignment: Alignment.center,
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ScaleTransition(
              scale: Tween(begin: 0.9, end: 1.08).animate(
                  CurvedAnimation(parent: _pulse, curve: Curves.easeInOut)),
              child: const LogoMark(size: 120),
            ),
            const SizedBox(height: 36),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: Text(
                steps.isEmpty ? '' : steps[_step],
                key: ValueKey(_step),
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: 180,
              child: LinearProgressIndicator(
                value: steps.isEmpty ? null : (_step + 1) / steps.length,
                color: Colors.white,
                backgroundColor: Colors.white24,
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

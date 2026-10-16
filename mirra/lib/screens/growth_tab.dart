import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/personality.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'home_tab.dart';

class GrowthTab extends StatelessWidget {
  const GrowthTab({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final plan = app.plan;
    return SafeArea(
      child: plan == null ? _empty(context, app) : _PlanView(plan: plan),
    );
  }

  Widget _empty(BuildContext context, AppState app) {
    final latest = app.latest;
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 30),
        const Icon(Icons.rocket_launch_rounded,
            size: 90, color: Brand.primary),
        const SizedBox(height: 20),
        Text(app.t('growth.emptyTitle'),
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .headlineSmall
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        Text(app.t('growth.emptyBody'),
            textAlign: TextAlign.center,
            style: const TextStyle(height: 1.6)),
        const SizedBox(height: 28),
        if (latest == null)
          FilledButton(
            onPressed: () => HomeTab.startTest(context),
            child: Text(app.t('home.startTest')),
          )
        else ...[
          Text(app.t('growth.chooseFocus'),
              style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          _FocusPicker(initial: Personality.focusTraits(latest.scores)),
        ],
      ],
    );
  }
}

class _FocusPicker extends StatefulWidget {
  const _FocusPicker({required this.initial});

  final List<String> initial;

  @override
  State<_FocusPicker> createState() => _FocusPickerState();
}

class _FocusPickerState extends State<_FocusPicker> {
  late final Set<String> _selected = {...widget.initial};

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final t in Personality.traits)
            FilterChip(
              avatar: Icon(Personality.icons[t],
                  size: 18, color: Personality.colors[t]),
              label: Text(app.t('traits.$t.name')),
              selected: _selected.contains(t),
              onSelected: (v) => setState(() {
                if (v) {
                  if (_selected.length < 3) _selected.add(t);
                } else if (_selected.length > 1) {
                  _selected.remove(t);
                }
              }),
            ),
        ]),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: () => app.startPlan([
            for (final t in Personality.traits)
              if (_selected.contains(t)) t
          ]),
          child: Text(app.t('result.planStart')),
        ),
      ],
    );
  }
}

class _PlanView extends StatefulWidget {
  const _PlanView({required this.plan});

  final GrowthPlan plan;

  @override
  State<_PlanView> createState() => _PlanViewState();
}

class _PlanViewState extends State<_PlanView> {
  late int _day = widget.plan.today;
  final _note = TextEditingController();

  @override
  void initState() {
    super.initState();
    _note.text = widget.plan.notes[_day] ?? '';
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _openDay(int day) => setState(() {
        _day = day;
        _note.text = widget.plan.notes[day] ?? '';
      });

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final plan = widget.plan;
    final theme = Theme.of(context);
    final trait = plan.traitFor(_day);
    final color = Personality.colors[trait]!;
    final done = plan.done.contains(_day);
    final reflections = app.l10n.list('reflections');
    final locked = _day > plan.today;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text(app.t('growth.title'),
            style: theme.textTheme.headlineSmall
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(
          app.t('growth.focusLine', {
            'traits': plan.focus.map((t) => app.t('traits.$t.name')).join(' · ')
          }),
          style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: 18),
        GradientCard(
          child: Row(children: [
            SizedBox(
              width: 84,
              height: 84,
              child: Stack(alignment: Alignment.center, children: [
                SizedBox.expand(
                  child: CircularProgressIndicator(
                    value: plan.done.length / GrowthPlan.length,
                    strokeWidth: 8,
                    color: Colors.white,
                    backgroundColor: Colors.white24,
                  ),
                ),
                Text('${plan.done.length}/${GrowthPlan.length}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 18)),
              ]),
            ),
            const SizedBox(width: 18),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    const Text('🔥', style: TextStyle(fontSize: 22)),
                    const SizedBox(width: 6),
                    Text(app.t('growth.streak', {'n': plan.streak}),
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w800)),
                  ]),
                  const SizedBox(height: 6),
                  Text(
                    plan.finished
                        ? app.t('growth.finished')
                        : app.t('growth.dayOf',
                            {'n': plan.today + 1, 'total': GrowthPlan.length}),
                    style: const TextStyle(color: Colors.white70),
                  ),
                ],
              ),
            ),
          ]),
        ),
        const SizedBox(height: 18),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          alignment: WrapAlignment.center,
          children: [
            for (var d = 0; d < GrowthPlan.length; d++)
              _DayDot(
                day: d,
                done: plan.done.contains(d),
                current: d == _day,
                locked: d > plan.today,
                color: Personality.colors[plan.traitFor(d)]!,
                onTap: () => _openDay(d),
              ),
          ],
        ),
        const SizedBox(height: 20),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(Personality.icons[trait], color: color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(app.t('growth.day', {'n': _day + 1}),
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 17)),
                      Text(app.t('traits.$trait.name'),
                          style: TextStyle(
                              color: color, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ]),
              const SizedBox(height: 16),
              if (locked)
                Text(app.t('growth.locked'),
                    style:
                        TextStyle(color: theme.colorScheme.onSurfaceVariant))
              else ...[
                Text(app.t('challenges.$trait.${plan.challengeFor(_day)}'),
                    style: const TextStyle(fontSize: 16.5, height: 1.6)),
                const SizedBox(height: 18),
                if (reflections.isNotEmpty) ...[
                  Text(app.t('growth.reflect'),
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: theme.colorScheme.primary)),
                  const SizedBox(height: 4),
                  Text(reflections[_day % reflections.length],
                      style: const TextStyle(height: 1.5)),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _note,
                    minLines: 2,
                    maxLines: 5,
                    onChanged: (v) => app.setNote(_day, v),
                    decoration: InputDecoration(
                      hintText: app.t('growth.noteHint'),
                      fillColor: theme.colorScheme.surfaceContainerHighest
                          .withValues(alpha: 0.5),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                FilledButton.icon(
                  style: done
                      ? FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981))
                      : null,
                  onPressed: () => app.toggleDay(_day),
                  icon: Icon(done
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded),
                  label: Text(done
                      ? app.t('growth.completed')
                      : app.t('growth.markDone')),
                ),
              ],
            ],
          ),
        ),
        if (plan.finished) ...[
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () => HomeTab.startTest(context),
            icon: const Icon(Icons.refresh_rounded),
            label: Text(app.t('growth.retest')),
          ),
        ],
        const SizedBox(height: 16),
        TextButton.icon(
          onPressed: () async {
            final ok = await showDialog<bool>(
              context: context,
              builder: (c) => AlertDialog(
                title: Text(app.t('growth.endTitle')),
                content: Text(app.t('growth.endBody')),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c, false),
                      child: Text(app.t('common.cancel'))),
                  FilledButton(
                      onPressed: () => Navigator.pop(c, true),
                      child: Text(app.t('common.confirm'))),
                ],
              ),
            );
            if (ok == true) app.endPlan();
          },
          icon: const Icon(Icons.restart_alt_rounded),
          label: Text(app.t('growth.newPlan')),
        ),
      ],
    );
  }
}

class _DayDot extends StatelessWidget {
  const _DayDot({
    required this.day,
    required this.done,
    required this.current,
    required this.locked,
    required this.color,
    required this.onTap,
  });

  final int day;
  final bool done;
  final bool current;
  final bool locked;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      customBorder: const CircleBorder(),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: done
              ? color
              : (locked
                  ? theme.colorScheme.surfaceContainerHighest
                  : color.withValues(alpha: 0.15)),
          border: current
              ? Border.all(color: theme.colorScheme.primary, width: 3)
              : null,
        ),
        child: done
            ? const Icon(Icons.check_rounded, color: Colors.white, size: 20)
            : Text('${day + 1}',
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: locked
                        ? theme.colorScheme.onSurfaceVariant
                        : theme.colorScheme.onSurface)),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../core/personality.dart';
import '../core/theme.dart';

class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 72});

  final double size;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(size * 0.225),
        child: Image.asset('assets/images/logo.png',
            width: size, height: size, filterQuality: FilterQuality.medium),
      );
}

/// Rounded card with the brand gradient.
class GradientCard extends StatelessWidget {
  const GradientCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(22),
    this.onTap,
    this.gradient = Brand.gradient,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Gradient gradient;

  @override
  Widget build(BuildContext context) => Material(
        borderRadius: BorderRadius.circular(26),
        clipBehavior: Clip.antiAlias,
        child: Ink(
          decoration: BoxDecoration(gradient: gradient),
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: padding,
              child: DefaultTextStyle.merge(
                style: const TextStyle(color: Colors.white),
                child: IconTheme.merge(
                  data: const IconThemeData(color: Colors.white),
                  child: child,
                ),
              ),
            ),
          ),
        ),
      );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.icon});

  final String text;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 26, 4, 12),
        child: Row(children: [
          if (icon != null) ...[
            Icon(icon, size: 22, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Text(text,
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w800)),
          ),
        ]),
      );
}

class TraitBar extends StatelessWidget {
  const TraitBar({
    super.key,
    required this.trait,
    required this.label,
    required this.value,
    this.levelLabel,
  });

  final String trait;
  final String label;
  final double value;
  final String? levelLabel;

  @override
  Widget build(BuildContext context) {
    final color = Personality.colors[trait]!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Icon(Personality.icons[trait], color: color, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label,
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
          if (levelLabel != null)
            Text('$levelLabel · ',
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontSize: 13)),
          Text('${value.round()}%',
              style: TextStyle(color: color, fontWeight: FontWeight.w800)),
        ]),
        const SizedBox(height: 8),
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: value / 100),
          duration: const Duration(milliseconds: 900),
          curve: Curves.easeOutCubic,
          builder: (context, v, _) => ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: v,
              minHeight: 10,
              color: color,
              backgroundColor: color.withValues(alpha: 0.15),
            ),
          ),
        ),
      ],
    );
  }
}

class BulletList extends StatelessWidget {
  const BulletList(this.items, {super.key, required this.icon, this.color});

  final List<String> items;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final item in items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Icon(icon,
                        size: 18,
                        color: color ?? Theme.of(context).colorScheme.primary),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Text(item, style: const TextStyle(height: 1.5))),
                ],
              ),
            ),
        ],
      );
}

/// Plain surface card with padding.
class Panel extends StatelessWidget {
  const Panel({super.key, required this.child, this.padding = 20, this.onTap});

  final Widget child;
  final double padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: EdgeInsets.all(padding), child: child),
        ),
      );
}

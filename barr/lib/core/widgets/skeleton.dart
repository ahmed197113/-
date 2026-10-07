import 'package:flutter/material.dart';

/// Pulsing placeholder used while data loads.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.height = 88, this.radius = 20});

  final double height;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
    ..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Semantics(
      label: 'loading',
      child: FadeTransition(
        opacity: Tween(begin: 0.45, end: 1.0).animate(_c),
        child: Container(
          height: widget.height,
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(widget.radius)),
        ),
      ),
    );
  }
}

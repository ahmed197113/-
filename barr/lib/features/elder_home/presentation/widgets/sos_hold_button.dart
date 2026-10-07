import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_theme.dart';

/// Emergency button that only fires after a continuous 3-second press,
/// preventing accidental triggers. Shows a filling progress ring.
class SosHoldButton extends StatefulWidget {
  const SosHoldButton({
    super.key,
    required this.label,
    required this.hint,
    required this.onTriggered,
    this.holdDuration = const Duration(seconds: 3),
  });

  final String label;
  final String hint;
  final VoidCallback onTriggered;
  final Duration holdDuration;

  @override
  State<SosHoldButton> createState() => _SosHoldButtonState();
}

class _SosHoldButtonState extends State<SosHoldButton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.holdDuration)
    ..addStatusListener((s) {
      if (s == AnimationStatus.completed) {
        HapticFeedback.heavyImpact();
        widget.onTriggered();
        _c.reset();
      }
    });

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _start() {
    HapticFeedback.mediumImpact();
    _c.forward(from: 0);
  }

  void _cancel() {
    if (_c.isAnimating) _c.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${widget.label}. ${widget.hint}',
      onLongPress: widget.onTriggered,
      excludeSemantics: true,
      child: GestureDetector(
        onTapDown: (_) => _start(),
        onTapUp: (_) => _cancel(),
        onTapCancel: _cancel,
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) => Container(
            constraints: const BoxConstraints(minHeight: 120),
            decoration: BoxDecoration(
              color: Color.lerp(BarrColors.danger, const Color(0xFF7F0000), _c.value),
              borderRadius: BorderRadius.circular(28),
            ),
            padding: const EdgeInsets.all(12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 64,
                  height: 64,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      CircularProgressIndicator(
                        value: _c.value,
                        strokeWidth: 6,
                        color: Colors.white,
                        backgroundColor: Colors.white24,
                      ),
                      const Icon(Icons.sos_rounded, size: 40, color: Colors.white),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    widget.label,
                    style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
                  ),
                ),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(widget.hint, style: const TextStyle(color: Colors.white, fontSize: 18)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

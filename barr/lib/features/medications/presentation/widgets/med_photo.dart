import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Medicine box photo from a URL (cached for offline) or a local path.
class MedPhoto extends StatelessWidget {
  const MedPhoto({super.key, required this.url, this.size = 56, this.radius = 14});

  final String? url;
  final double size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final placeholder = Container(
      width: size,
      height: size,
      color: scheme.primaryContainer,
      child: Icon(Icons.medication_rounded, size: size * 0.55, color: scheme.onPrimaryContainer),
    );
    final u = url;
    Widget image;
    if (u == null || u.isEmpty) {
      image = placeholder;
    } else if (u.startsWith('http')) {
      image = CachedNetworkImage(
        imageUrl: u,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (_, _) => placeholder,
        errorWidget: (_, _, _) => placeholder,
      );
    } else {
      image = Image.file(
        File(u),
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => placeholder,
      );
    }
    return ClipRRect(borderRadius: BorderRadius.circular(radius), child: image);
  }
}

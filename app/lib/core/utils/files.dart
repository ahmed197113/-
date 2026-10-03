import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:path_provider/path_provider.dart';

/// Image provider for a result that is either a local path or a URL.
ImageProvider imageFor(String uri) =>
    uri.startsWith('http') ? NetworkImage(uri) : FileImage(File(uri)) as ImageProvider;

/// Ensures a result is available as a local file (downloads URLs once).
Future<String> ensureLocalFile(String uri) async {
  if (!uri.startsWith('http')) return uri;
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}/dl_${uri.hashCode.abs()}.png');
  if (await file.exists()) return file.path;
  final client = HttpClient();
  try {
    final req = await client.getUrl(Uri.parse(uri));
    final res = await req.close();
    if (res.statusCode != 200) throw HttpException('HTTP ${res.statusCode}');
    await res.pipe(file.openWrite());
    return file.path;
  } finally {
    client.close();
  }
}

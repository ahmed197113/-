import 'package:flutter/services.dart';
import 'package:gal/gal.dart';
import 'package:share_plus/share_plus.dart';

enum ShareTarget {
  whatsapp('com.whatsapp', 'واتساب', 'WhatsApp'),
  snapchat('com.snapchat.android', 'سناب شات', 'Snapchat'),
  instagramStory('com.instagram.android', 'ستوري إنستغرام', 'Instagram Story'),
  tiktok('com.zhiliaoapp.musically', 'تيك توك', 'TikTok'),
  other('', 'المزيد', 'More');

  const ShareTarget(this.package, this.labelAr, this.labelEn);
  final String package;
  final String labelAr;
  final String labelEn;
}

/// One-tap sharing to a specific app via a small Android intent channel,
/// falling back to the system share sheet when the app is missing.
class ShareService {
  static const _channel = MethodChannel('app.munasaba/share');

  Future<void> share(String path, ShareTarget target, {String caption = ''}) async {
    if (target != ShareTarget.other) {
      try {
        final ok = await _channel.invokeMethod<bool>('shareToApp', {
          'path': path,
          'package': target.package,
          'story': target == ShareTarget.instagramStory,
          'text': caption,
        });
        if (ok == true) return;
      } on PlatformException {
        // fall through to the share sheet
      } on MissingPluginException {
        // iOS (not implemented yet) – use share sheet
      }
    }
    await SharePlus.instance.share(ShareParams(files: [XFile(path, mimeType: 'image/png')], text: caption));
  }

  /// Saves into the phone gallery ("مناسبة" album). Returns false when the
  /// user denied permission.
  Future<bool> saveToGallery(String path) async {
    try {
      if (!await Gal.hasAccess(toAlbum: true)) {
        if (!await Gal.requestAccess(toAlbum: true)) return false;
      }
      await Gal.putImage(path, album: 'Munasaba');
      return true;
    } on GalException {
      return false;
    }
  }
}

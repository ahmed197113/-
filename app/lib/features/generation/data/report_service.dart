import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/env.dart';

/// In-app reporting of offensive AI output (Google Play AI-content policy).
class ReportService {
  const ReportService(this.firebase);
  final bool firebase;

  static const reasonsAr = [
    'محتوى غير لائق أو مسيء',
    'ملابس غير محتشمة',
    'لا يشبهني / ملامح مشوّهة',
    'محتوى ديني غير مناسب',
    'شيء آخر',
  ];

  Future<void> report({required String jobId, required String imageUri, required String reason}) async {
    if (firebase) {
      await FirebaseFirestore.instance.collection('reports').add({
        'uid': FirebaseAuth.instance.currentUser?.uid,
        'job_id': jobId,
        'image': imageUri.startsWith('http') ? imageUri : null,
        'reason': reason,
        'status': 'open',
        'created_at': FieldValue.serverTimestamp(),
      });
      return;
    }
    final uri = Uri(
      scheme: 'mailto',
      path: Env.supportEmail,
      queryParameters: {'subject': 'بلاغ عن صورة', 'body': 'Job: $jobId\nالسبب: $reason'},
    );
    await launchUrl(uri);
  }
}

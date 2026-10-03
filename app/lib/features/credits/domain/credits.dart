import 'package:flutter/foundation.dart';

enum CreditPackId { starter, popular, family }

@immutable
class CreditPack {
  const CreditPack({
    required this.id,
    required this.productId,
    required this.credits,
    required this.fallbackPrice,
    required this.titleAr,
    required this.titleEn,
    this.highlight = false,
  });

  final CreditPackId id;
  final String productId;
  final int credits;
  final String fallbackPrice;
  final String titleAr;
  final String titleEn;
  final bool highlight;
}

const kCreditPacks = [
  CreditPack(
    id: CreditPackId.starter,
    productId: 'credits_10',
    credits: 10,
    fallbackPrice: r'$2.99',
    titleAr: 'البداية',
    titleEn: 'Starter',
  ),
  CreditPack(
    id: CreditPackId.popular,
    productId: 'credits_30',
    credits: 30,
    fallbackPrice: r'$6.99',
    titleAr: 'الشائعة',
    titleEn: 'Popular',
    highlight: true,
  ),
  CreditPack(
    id: CreditPackId.family,
    productId: 'credits_80',
    credits: 80,
    fallbackPrice: r'$14.99',
    titleAr: 'العائلة',
    titleEn: 'Family',
  ),
];

const kProWeeklyProductId = 'pro_weekly';
const kProWeeklyFallbackPrice = r'$3.99';
const kProWeeklyFairUse = 60;
const kFreeTrialCredits = 2;

enum TxType { signupBonus, purchase, subscription, generation, refund, referral, rewardedAd, adminGrant }

@immutable
class CreditTransaction {
  const CreditTransaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.createdAt,
    this.note = '',
    this.jobId,
  });

  final String id;
  final TxType type;

  /// Positive for grants, negative for spend.
  final int amount;
  final DateTime createdAt;
  final String note;
  final String? jobId;

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'amount': amount,
        'created_at': createdAt.toIso8601String(),
        'note': note,
        'job_id': jobId,
      };

  factory CreditTransaction.fromJson(Map<String, dynamic> j) => CreditTransaction(
        id: j['id'] as String,
        type: TxType.values.firstWhere((t) => t.name == j['type'],
            orElse: () => TxType.adminGrant),
        amount: (j['amount'] as num).toInt(),
        createdAt: DateTime.tryParse(j['created_at'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0),
        note: j['note'] as String? ?? '',
        jobId: j['job_id'] as String?,
      );
}

@immutable
class CreditState {
  const CreditState({
    required this.balance,
    required this.proUntil,
    required this.proUsedThisWeek,
    required this.history,
    this.isDemo = false,
  });

  final int balance;
  final DateTime? proUntil;
  final int proUsedThisWeek;
  final List<CreditTransaction> history;
  final bool isDemo;

  bool get isPro => proUntil != null && proUntil!.isAfter(DateTime.now());

  /// Free/credit outputs are watermarked; Pro outputs are clean.
  bool get watermarked => !isPro;

  bool canAfford(int cost) =>
      isPro ? proUsedThisWeek + cost <= kProWeeklyFairUse : balance >= cost;

  static const empty = CreditState(
      balance: 0, proUntil: null, proUsedThisWeek: 0, history: []);
}

class InsufficientCreditsException implements Exception {
  const InsufficientCreditsException();
}

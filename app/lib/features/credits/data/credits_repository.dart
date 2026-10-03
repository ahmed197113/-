import 'dart:async';
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../../../core/config/env.dart';
import '../../../core/config/providers.dart';
import '../application/credit_ledger.dart';
import '../domain/credits.dart';

abstract interface class CreditsRepository {
  Stream<CreditState> watch();
  CreditState get current;

  /// Returns null on success, or a user-facing (Arabic) error.
  Future<String?> buyPack(CreditPack pack);
  Future<String?> buyPro();
  Future<String?> restore();
}

/// On-device ledger used in demo mode (no backend configured). Purchases are
/// simulated and clearly labelled as such in the store UI.
class LocalCreditsRepository implements CreditsRepository {
  LocalCreditsRepository(this._prefs) {
    _load();
  }

  final SharedPreferences _prefs;
  final _controller = StreamController<CreditState>.broadcast();
  static const _key = 'demo_ledger_v1';
  static const _proKey = 'demo_pro_until';
  final _uuid = const Uuid();

  late CreditLedger _ledger;
  DateTime? _proUntil;
  CreditState _state = CreditState.empty;

  void _load() {
    final raw = _prefs.getString(_key);
    final list = raw == null
        ? <CreditTransaction>[]
        : (jsonDecode(raw) as List)
            .cast<Map<String, dynamic>>()
            .map(CreditTransaction.fromJson)
            .toList();
    _ledger = CreditLedger(list);
    if (list.isEmpty) {
      _ledger.grant(CreditTransaction(
        id: 'signup',
        type: TxType.signupBonus,
        amount: kFreeTrialCredits,
        createdAt: DateTime.now(),
        note: 'هدية التسجيل',
      ));
    }
    final pro = _prefs.getString(_proKey);
    _proUntil = pro == null ? null : DateTime.tryParse(pro);
    _emit();
  }

  void _emit() {
    _prefs.setString(_key, jsonEncode(_ledger.history.map((t) => t.toJson()).toList()));
    final weekAgo = DateTime.now().subtract(const Duration(days: 7));
    final proUsed = _ledger.history
        .where((t) => t.type == TxType.generation && t.note == 'pro' && t.createdAt.isAfter(weekAgo))
        .length;
    _state = CreditState(
      balance: _ledger.balance,
      proUntil: _proUntil,
      proUsedThisWeek: proUsed,
      history: _ledger.history.reversed.toList(),
      isDemo: true,
    );
    _controller.add(_state);
  }

  @override
  CreditState get current => _state;

  @override
  Stream<CreditState> watch() async* {
    yield _state;
    yield* _controller.stream;
  }

  /// Charges for a job before anything is generated.
  void chargeForJob(String jobId, int cost) {
    final now = DateTime.now();
    if (_state.isPro) {
      if (!_state.canAfford(cost)) throw const InsufficientCreditsException();
      _ledger = CreditLedger([
        ..._ledger.history,
        CreditTransaction(id: _uuid.v4(), type: TxType.generation, amount: 0, createdAt: now, jobId: jobId, note: 'pro'),
      ]);
    } else {
      _ledger.charge(txId: _uuid.v4(), jobId: jobId, cost: cost, at: now);
    }
    _emit();
  }

  void refundJob(String jobId) {
    if (_ledger.refund(txId: _uuid.v4(), jobId: jobId, at: DateTime.now())) _emit();
  }

  @override
  Future<String?> buyPack(CreditPack pack) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    _ledger.grant(CreditTransaction(
      id: _uuid.v4(),
      type: TxType.purchase,
      amount: pack.credits,
      createdAt: DateTime.now(),
      note: 'باقة ${pack.titleAr} (تجريبي)',
    ));
    _emit();
    return null;
  }

  @override
  Future<String?> buyPro() async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    _proUntil = DateTime.now().add(const Duration(days: 7));
    _prefs.setString(_proKey, _proUntil!.toIso8601String());
    _emit();
    return null;
  }

  @override
  Future<String?> restore() async => null;
}

/// Production: balance lives in `users/{uid}` and is only ever written by
/// Cloud Functions (RevenueCat webhook, job creation, refunds).
class FirebaseCreditsRepository implements CreditsRepository {
  FirebaseCreditsRepository(this._db, this._auth);

  final FirebaseFirestore _db;
  final FirebaseAuth _auth;
  CreditState _state = CreditState.empty;
  static bool _rcConfigured = false;

  Future<void> _ensureRevenueCat() async {
    if (_rcConfigured || !Env.hasRevenueCat) return;
    final key = defaultTargetPlatform == TargetPlatform.iOS
        ? Env.revenueCatIosKey
        : Env.revenueCatAndroidKey;
    final config = PurchasesConfiguration(key)..appUserID = _auth.currentUser?.uid;
    await Purchases.configure(config);
    _rcConfigured = true;
  }

  @override
  CreditState get current => _state;

  @override
  Stream<CreditState> watch() {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return Stream.value(CreditState.empty);
    final user = _db.collection('users').doc(uid).snapshots();
    return user.asyncMap((doc) async {
      final d = doc.data() ?? const {};
      final txSnap = await _db
          .collection('transactions')
          .where('uid', isEqualTo: uid)
          .orderBy('created_at', descending: true)
          .limit(50)
          .get();
      final history = txSnap.docs.map((t) {
        final m = t.data();
        return CreditTransaction(
          id: t.id,
          type: TxType.values.firstWhere((x) => x.name == m['type'], orElse: () => TxType.adminGrant),
          amount: (m['amount'] as num?)?.toInt() ?? 0,
          createdAt: (m['created_at'] as Timestamp?)?.toDate() ?? DateTime.now(),
          note: m['note'] as String? ?? '',
          jobId: m['job_id'] as String?,
        );
      }).toList();
      _state = CreditState(
        balance: (d['credits'] as num?)?.toInt() ?? 0,
        proUntil: (d['pro_until'] as Timestamp?)?.toDate(),
        proUsedThisWeek: (d['pro_used_week'] as num?)?.toInt() ?? 0,
        history: history,
      );
      return _state;
    });
  }

  Future<String?> _purchase(String productId) async {
    if (!Env.hasRevenueCat) return 'المتجر غير مُفعّل بعد في هذه النسخة.';
    try {
      await _ensureRevenueCat();
      final offerings = await Purchases.getOfferings();
      Package? pkg;
      for (final o in offerings.all.values) {
        for (final p in o.availablePackages) {
          if (p.storeProduct.identifier.startsWith(productId)) pkg = p;
        }
      }
      if (pkg == null) return 'المنتج غير متاح حالياً، حاول لاحقاً.';
      await Purchases.purchase(PurchaseParams.package(pkg));
      // Credits are granted server-side by the RevenueCat webhook.
      return null;
    } on PlatformException catch (e) {
      final code = PurchasesErrorHelper.getErrorCode(e);
      return switch (code) {
        PurchasesErrorCode.purchaseCancelledError => 'تم إلغاء عملية الشراء.',
        PurchasesErrorCode.paymentPendingError => 'الدفع قيد المعالجة، سنضيف رصيدك فور تأكيده.',
        PurchasesErrorCode.networkError => 'تحقق من اتصالك بالإنترنت وحاول مجدداً.',
        _ => 'تعذّر إتمام الشراء، حاول مرة أخرى.',
      };
    }
  }

  @override
  Future<String?> buyPack(CreditPack pack) => _purchase(pack.productId);

  @override
  Future<String?> buyPro() => _purchase(kProWeeklyProductId);

  @override
  Future<String?> restore() async {
    if (!Env.hasRevenueCat) return null;
    try {
      await _ensureRevenueCat();
      await Purchases.restorePurchases();
      return null;
    } on PlatformException {
      return 'تعذّرت استعادة المشتريات.';
    }
  }
}

final creditsRepositoryProvider = Provider<CreditsRepository>((ref) {
  if (ref.watch(firebaseEnabledProvider)) {
    return FirebaseCreditsRepository(FirebaseFirestore.instance, FirebaseAuth.instance);
  }
  return LocalCreditsRepository(ref.watch(sharedPrefsProvider));
});

final creditStateProvider = StreamProvider<CreditState>(
  (ref) => ref.watch(creditsRepositoryProvider).watch(),
);

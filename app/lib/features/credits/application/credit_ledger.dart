import '../domain/credits.dart';

/// Pure ledger rules shared by the on-device demo store and unit tests.
/// The production source of truth is the Cloud Functions transaction in
/// `functions/src/credits.ts`; this mirrors those rules exactly.
class CreditLedger {
  CreditLedger(List<CreditTransaction> history) : _history = [...history];

  final List<CreditTransaction> _history;

  List<CreditTransaction> get history => List.unmodifiable(_history);

  int get balance => _history.fold(0, (sum, t) => sum + t.amount);

  bool hasRefundFor(String jobId) =>
      _history.any((t) => t.type == TxType.refund && t.jobId == jobId);

  bool hasChargeFor(String jobId) =>
      _history.any((t) => t.type == TxType.generation && t.jobId == jobId);

  void grant(CreditTransaction tx) {
    if (tx.amount <= 0) throw ArgumentError('grant must be positive');
    if (_history.any((t) => t.id == tx.id)) return; // idempotent
    _history.add(tx);
  }

  /// Atomically checks and deducts. Throws when the balance is insufficient,
  /// so the balance can never go negative.
  void charge({required String txId, required String jobId, required int cost, required DateTime at}) {
    if (cost <= 0) throw ArgumentError('cost must be positive');
    if (hasChargeFor(jobId)) return; // idempotent per job
    if (balance < cost) throw const InsufficientCreditsException();
    _history.add(CreditTransaction(
        id: txId, type: TxType.generation, amount: -cost, createdAt: at, jobId: jobId));
  }

  /// Refunds a failed job exactly once.
  bool refund({required String txId, required String jobId, required DateTime at}) {
    if (hasRefundFor(jobId)) return false;
    final charge = _history.where((t) => t.type == TxType.generation && t.jobId == jobId);
    if (charge.isEmpty) return false;
    _history.add(CreditTransaction(
        id: txId, type: TxType.refund, amount: -charge.first.amount, createdAt: at, jobId: jobId));
    return true;
  }
}

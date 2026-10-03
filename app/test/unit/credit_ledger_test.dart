import 'package:flutter_test/flutter_test.dart';
import 'package:munasaba/features/credits/application/credit_ledger.dart';
import 'package:munasaba/features/credits/domain/credits.dart';

void main() {
  final t0 = DateTime(2026, 10, 1);
  CreditLedger fresh([int credits = 2]) => CreditLedger([
        CreditTransaction(id: 'signup', type: TxType.signupBonus, amount: credits, createdAt: t0),
      ]);

  test('charge deducts before generation', () {
    final l = fresh();
    l.charge(txId: 'a', jobId: 'job1', cost: 1, at: t0);
    expect(l.balance, 1);
  });

  test('balance can never go negative', () {
    final l = fresh(1);
    l.charge(txId: 'a', jobId: 'j1', cost: 1, at: t0);
    expect(() => l.charge(txId: 'b', jobId: 'j2', cost: 1, at: t0), throwsA(isA<InsufficientCreditsException>()));
    expect(l.balance, 0);
  });

  test('charge is idempotent per job', () {
    final l = fresh();
    l.charge(txId: 'a', jobId: 'j1', cost: 1, at: t0);
    l.charge(txId: 'b', jobId: 'j1', cost: 1, at: t0);
    expect(l.balance, 1);
  });

  test('failed job is refunded exactly once', () {
    final l = fresh();
    l.charge(txId: 'a', jobId: 'j1', cost: 1, at: t0);
    expect(l.refund(txId: 'r1', jobId: 'j1', at: t0), isTrue);
    expect(l.refund(txId: 'r2', jobId: 'j1', at: t0), isFalse);
    expect(l.balance, 2);
  });

  test('cannot refund a job that was never charged', () {
    final l = fresh();
    expect(l.refund(txId: 'r', jobId: 'nope', at: t0), isFalse);
    expect(l.balance, 2);
  });

  test('grants are idempotent by transaction id (webhook retries)', () {
    final l = fresh();
    final tx = CreditTransaction(id: 'rc_123', type: TxType.purchase, amount: 30, createdAt: t0);
    l.grant(tx);
    l.grant(tx);
    expect(l.balance, 32);
  });

  test('pro fair use', () {
    final s = CreditState(
      balance: 0,
      proUntil: DateTime.now().add(const Duration(days: 3)),
      proUsedThisWeek: kProWeeklyFairUse - 1,
      history: const [],
    );
    expect(s.isPro, isTrue);
    expect(s.watermarked, isFalse);
    expect(s.canAfford(1), isTrue);
    expect(s.canAfford(2), isFalse);
  });

  test('transactions serialise', () {
    final tx = CreditTransaction(id: 'x', type: TxType.refund, amount: 1, createdAt: t0, jobId: 'j');
    final back = CreditTransaction.fromJson(tx.toJson());
    expect(back.type, TxType.refund);
    expect(back.jobId, 'j');
    expect(back.amount, 1);
  });
}

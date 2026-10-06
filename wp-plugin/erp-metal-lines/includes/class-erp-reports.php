<?php
/**
 * التقارير المالية — نقل حرفي لـ accounting/reports.py.
 * التجميع يتم في SQL (SUM … GROUP BY) وليس بلوب على السطور.
 */
defined('ABSPATH') || exit;

final class ERP_Reports
{
    /** _lines() + فلاتر: يبني شرط WHERE على السطور المرحّلة. */
    private static function where(?string $date_from, ?string $date_to, array $filters, array &$args): string
    {
        $w = ["e.state = 'posted'"];
        if ($date_from) {
            $w[] = 'e.date >= %s';
            $args[] = $date_from;
        }
        if ($date_to) {
            $w[] = 'e.date <= %s';
            $args[] = $date_to;
        }
        foreach (['project_id', 'cost_center_id', 'partner_id', 'account_id'] as $col) {
            if (isset($filters[$col]) && $filters[$col] !== '' && $filters[$col] !== null) {
                $w[] = "l.{$col} = %d";
                $args[] = (int) $filters[$col];
            }
        }
        if (!empty($filters['account_ids'])) {
            $w[] = 'l.account_id IN (' . implode(',', array_fill(0, count($filters['account_ids']), '%d')) . ')';
            foreach ($filters['account_ids'] as $id) {
                $args[] = (int) $id;
            }
        }
        if (!empty($filters['account_types'])) {
            $w[] = 'a.type IN (' . implode(',', array_fill(0, count($filters['account_types']), '%s')) . ')';
            foreach ($filters['account_types'] as $t) {
                $args[] = $t;
            }
        }
        return implode(' AND ', $w);
    }

    private static function from(): string
    {
        return ERP_DB::t('journal_line') . ' l JOIN ' . ERP_DB::t('journal_entry') . ' e ON e.id = l.entry_id JOIN '
            . ERP_DB::t('account') . ' a ON a.id = l.account_id';
    }

    /** sums_by_account(): account_id => [debit, credit] */
    public static function sums_by_account(?string $date_from, ?string $date_to, array $filters = []): array
    {
        $args = [];
        $where = self::where($date_from, $date_to, $filters, $args);
        $out = [];
        foreach (ERP_DB::rows('SELECT l.account_id, SUM(l.debit) d, SUM(l.credit) c FROM ' . self::from()
            . " WHERE {$where} GROUP BY l.account_id", $args) as $r) {
            $out[(int) $r['account_id']] = [ERP_Money::norm($r['d']), ERP_Money::norm($r['c'])];
        }
        return $out;
    }

    public static function totals(?string $date_from, ?string $date_to, array $filters = []): array
    {
        $args = [];
        $where = self::where($date_from, $date_to, $filters, $args);
        $r = ERP_DB::row('SELECT COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM ' . self::from()
            . " WHERE {$where}", $args);
        return [ERP_Money::norm($r['d']), ERP_Money::norm($r['c'])];
    }

    /**
     * build_tree(): يجمع القيم صعوداً للحسابات الرئيسية ويرجع صفوفاً مرتبة بالكود مع المستوى.
     * @param array $accounts id => account
     * @param array $values   account_id => list of values
     */
    public static function build_tree(array $accounts, array $values, bool $show_zero = false, ?int $max_level = null): array
    {
        $width = $values ? count(reset($values)) : 1;
        $agg = [];
        foreach ($values as $aid => $vals) {
            $a = $accounts[$aid] ?? null;
            while ($a !== null) {
                $id = (int) $a['id'];
                if (!isset($agg[$id])) {
                    $agg[$id] = array_fill(0, $width, '0');
                }
                foreach ($vals as $i => $v) {
                    $agg[$id][$i] = ERP_Money::add($agg[$id][$i], $v);
                }
                $a = $a['parent_id'] !== null ? ($accounts[(int) $a['parent_id']] ?? null) : null;
            }
        }
        $levels = [];
        $level = function ($a) use (&$level, &$levels, $accounts) {
            $id = (int) $a['id'];
            if (!isset($levels[$id])) {
                $p = $a['parent_id'];
                $levels[$id] = ($p === null || !isset($accounts[(int) $p])) ? 0 : $level($accounts[(int) $p]) + 1;
            }
            return $levels[$id];
        };
        $sorted = array_values($accounts);
        usort($sorted, function ($x, $y) {
            return strcmp($x['code'], $y['code']);
        });
        $rows = [];
        foreach ($sorted as $a) {
            $vals = $agg[(int) $a['id']] ?? array_fill(0, $width, '0');
            $lv = $level($a);
            if ($max_level !== null && $lv > $max_level) {
                continue;
            }
            $any = false;
            foreach ($vals as $v) {
                if (!ERP_Money::is_zero($v)) {
                    $any = true;
                    break;
                }
            }
            if (!$show_zero && !$any) {
                continue;
            }
            $rows[] = ['account' => $a, 'level' => $lv, 'vals' => $vals, 'is_group' => (bool) (int) $a['is_group']];
        }
        return $rows;
    }

    private static function split($b): array
    {
        return [ERP_Money::max($b, '0'), ERP_Money::max(ERP_Money::neg($b), '0')];
    }

    /** trial_balance() */
    public static function trial_balance(string $date_from, string $date_to, string $level = 'all', bool $show_zero = false,
                                         array $filters = []): array
    {
        $max_level = ($level === '' || $level === 'all') ? null : (int) $level;
        $before = gmdate('Y-m-d', strtotime($date_from . ' -1 day UTC'));
        $opening = self::sums_by_account(null, $before, $filters);
        $period = self::sums_by_account($date_from, $date_to, $filters);
        $accounts = [];
        foreach (ERP_DB::rows('SELECT * FROM ' . ERP_DB::t('account')) as $a) {
            $accounts[(int) $a['id']] = $a;
        }
        $values = [];
        foreach (array_unique(array_merge(array_keys($opening), array_keys($period))) as $aid) {
            [$od, $oc] = $opening[$aid] ?? ['0', '0'];
            [$pd, $pc] = $period[$aid] ?? ['0', '0'];
            $ob = ERP_Money::sub($od, $oc);
            $cb = ERP_Money::sub(ERP_Money::add($ob, $pd), $pc);
            $values[$aid] = array_merge(self::split($ob), [$pd, $pc], self::split($cb));
        }
        $rows = self::build_tree($accounts, $values, $show_zero, $max_level);
        foreach ($rows as &$r) {
            $ob = ERP_Money::sub($r['vals'][0], $r['vals'][1]);
            $cb = ERP_Money::sub($r['vals'][4], $r['vals'][5]);
            $r['vals'] = array_merge(self::split($ob), [$r['vals'][2], $r['vals'][3]], self::split($cb));
        }
        unset($r);
        $totals = array_fill(0, 6, '0');
        foreach ($values as $vals) {
            $ob = ERP_Money::sub($vals[0], $vals[1]);
            $cb = ERP_Money::sub($vals[4], $vals[5]);
            $t = array_merge(self::split($ob), [$vals[2], $vals[3]], self::split($cb));
            foreach ($t as $i => $v) {
                $totals[$i] = ERP_Money::add($totals[$i], $v);
            }
        }
        return ['rows' => $rows, 'totals' => $totals, 'balanced' => ERP_Money::cmp($totals[4], $totals[5]) === 0,
            'date_from' => $date_from, 'date_to' => $date_to, 'level' => $level === '' ? 'all' : $level, 'show_zero' => $show_zero];
    }

    /** account_ledger(): دفتر الأستاذ برصيد تراكمي. */
    public static function ledger(int $account_id, string $date_from, string $date_to, array $filters = []): array
    {
        $account = ERP_Accounts::get($account_id);
        $f = $filters + ['account_ids' => ERP_Accounts::descendants_ids($account_id)];
        $before = gmdate('Y-m-d', strtotime($date_from . ' -1 day UTC'));
        [$bd, $bc] = self::totals(null, $before, $f);
        $opening = ERP_Money::sub($bd, $bc);
        $args = [];
        $where = self::where($date_from, $date_to, $f, $args);
        $lines = ERP_DB::rows('SELECT l.*, e.number entry_number, e.date entry_date, e.memo entry_memo, e.source entry_source, '
            . 'e.source_url entry_source_url FROM ' . self::from() . " WHERE {$where} ORDER BY e.date, l.entry_id, l.id", $args);
        $rows = [];
        $bal = $opening;
        $td = '0';
        $tc = '0';
        foreach ($lines as $ln) {
            $bal = ERP_Money::sub(ERP_Money::add($bal, $ln['debit']), $ln['credit']);
            $td = ERP_Money::add($td, $ln['debit']);
            $tc = ERP_Money::add($tc, $ln['credit']);
            $rows[] = ['line' => $ln, 'balance' => $bal];
        }
        return ['account' => $account, 'rows' => $rows, 'opening' => $opening, 'closing' => $bal, 'total_debit' => $td,
            'total_credit' => $tc];
    }

    /** period_from_request(): بداية السنة المالية الافتراضية حتى اليوم. */
    public static function default_period(): array
    {
        $today = current_time('Y-m-d');
        $year = (int) substr($today, 0, 4);
        $fy = ERP_Company::get()['fiscal_year_start'];
        $start = $fy ? sprintf('%04d-%s', $year, substr($fy, 5)) : sprintf('%04d-01-01', $year);
        if (strcmp($start, $today) > 0) {
            $start = sprintf('%04d-%s', $year - 1, substr($start, 5));
        }
        return [$start, $today];
    }

    /** أرصدة الخزائن والبنوك (لوحة التحكم). */
    public static function treasury_balances(): array
    {
        $out = [];
        foreach (ERP_DB::rows('SELECT * FROM ' . ERP_DB::t('account') . " WHERE kind IN ('cash','bank') AND is_group = 0 "
            . 'AND active = 1 ORDER BY code') as $a) {
            $out[] = ['account' => $a, 'balance' => ERP_Accounts::balance((int) $a['id'])];
        }
        return $out;
    }
}

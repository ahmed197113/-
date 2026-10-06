<?php
/**
 * النواة المحاسبية — نقل حرفي لـ accounting/models.py و accounting/posting.py.
 * أي رسالة أو شرط هنا يقابل نظيره في الأصل (مذكور بجانب كل دالة).
 */
defined('ABSPATH') || exit;

final class ERP_Company
{
    /** Company.get(): أول سجل أو إنشاء سجل بالقيم الافتراضية. */
    public static function get(): array
    {
        $row = ERP_DB::row('SELECT * FROM ' . ERP_DB::t('company') . ' ORDER BY id LIMIT 1');
        if ($row === null) {
            $defaults = [];
            foreach (ERP_DB::meta()['company']['fields'] as $f) {
                if (isset($f['default'])) {
                    $defaults[$f['column']] = $f['default'];
                }
            }
            ERP_DB::insert('company', $defaults);
            $row = ERP_DB::row('SELECT * FROM ' . ERP_DB::t('company') . ' ORDER BY id LIMIT 1');
        }
        return $row;
    }
}

final class ERP_Sequence
{
    public static function defaults(): array
    {
        return ERP_Seed::data()['sequence_defaults'];
    }

    /**
     * Sequence.next(key): قراءة بـ SELECT … FOR UPDATE داخل معاملة ⇒ يستحيل تكرار الرقم مع التزامن.
     */
    public static function next(string $key): string
    {
        return ERP_DB::transaction(function () use ($key) {
            $t = ERP_DB::t('sequence');
            $seq = ERP_DB::row("SELECT * FROM {$t} WHERE seq_key = %s FOR UPDATE", [$key]);
            if ($seq === null) {
                $prefix = self::defaults()[$key] ?? ($key . '-');
                // INSERT IGNORE ثم إعادة القراءة بالقفل — آمن لو حاولت عمليتان الإنشاء في نفس اللحظة
                ERP_DB::query("INSERT IGNORE INTO {$t} (seq_key, prefix, next_number, padding) VALUES (%s, %s, 1, 5)",
                    [$key, $prefix]);
                $seq = ERP_DB::row("SELECT * FROM {$t} WHERE seq_key = %s FOR UPDATE", [$key]);
            }
            $num = $seq['prefix'] . str_pad((string) $seq['next_number'], (int) $seq['padding'], '0', STR_PAD_LEFT);
            ERP_DB::query("UPDATE {$t} SET next_number = next_number + 1 WHERE id = %d", [(int) $seq['id']]);
            return $num;
        });
    }
}

final class ERP_Accounts
{
    private static $cache = null;

    public static function flush(): void
    {
        self::$cache = null;
    }

    /** كل الحسابات مفهرسة بالـ id. */
    public static function all(): array
    {
        if (self::$cache === null) {
            self::$cache = [];
            foreach (ERP_DB::rows('SELECT * FROM ' . ERP_DB::t('account') . ' ORDER BY code') as $a) {
                self::$cache[(int) $a['id']] = $a;
            }
        }
        return self::$cache;
    }

    public static function get($id): ?array
    {
        $all = self::all();
        return $all[(int) $id] ?? ERP_DB::get('account', (int) $id);
    }

    public static function by_code(string $code): ?array
    {
        return ERP_DB::row('SELECT * FROM ' . ERP_DB::t('account') . ' WHERE code = %s', [$code]);
    }

    /** __str__ للحساب: "كود - اسم". */
    public static function str(array $a): string
    {
        return $a['code'] . ' - ' . $a['name'];
    }

    /** Account.descendants_ids(): الحساب وكل الفروع (BFS). */
    public static function descendants_ids(int $id): array
    {
        $ids = [$id];
        $frontier = [$id];
        $t = ERP_DB::t('account');
        while ($frontier) {
            $ph = implode(',', array_fill(0, count($frontier), '%d'));
            $frontier = array_map('intval', ERP_DB::col("SELECT id FROM {$t} WHERE parent_id IN ({$ph})", $frontier));
            $ids = array_merge($ids, $frontier);
        }
        return $ids;
    }

    /** Account.level */
    public static function level(array $a): int
    {
        $all = self::all();
        $lvl = 0;
        $p = $a['parent_id'];
        while ($p !== null && isset($all[(int) $p])) {
            $lvl++;
            $p = $all[(int) $p]['parent_id'];
        }
        return $lvl;
    }

    /** Account.balance(): (مدين - دائن) شاملاً الفروع، للقيود المرحّلة. */
    public static function balance(int $id, ?string $date_to = null, ?string $date_from = null): string
    {
        $ids = self::descendants_ids($id);
        $ph = implode(',', array_fill(0, count($ids), '%d'));
        $sql = 'SELECT COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM ' . ERP_DB::t('journal_line') . ' l JOIN '
            . ERP_DB::t('journal_entry') . " e ON e.id = l.entry_id WHERE e.state = 'posted' AND l.account_id IN ({$ph})";
        $args = $ids;
        if ($date_to) {
            $sql .= ' AND e.date <= %s';
            $args[] = $date_to;
        }
        if ($date_from) {
            $sql .= ' AND e.date >= %s';
            $args[] = $date_from;
        }
        $r = ERP_DB::row($sql, $args);
        return ERP_Money::sub($r['d'], $r['c']);
    }

    /**
     * التحقق عند حفظ حساب: Account.clean() + AccountForm.clean() في الأصل.
     * @return array<string,string> أخطاء الحقول
     */
    public static function validate(array $data, ?array $instance): array
    {
        $errors = [];
        $all = self::all();
        $parent = $data['parent_id'] ? ($all[(int) $data['parent_id']] ?? null) : null;
        if ($instance && $parent && (int) $parent['id'] === (int) $instance['id']) {
            $errors['__all__'] = 'لا يمكن أن يكون الحساب أباً لنفسه';
        }
        if ($parent && !(int) $parent['is_group']) {
            $errors['parent_id'] = 'الحساب الرئيسي يجب أن يكون حساباً تجميعياً';
        }
        if ($parent && $data['type'] && $parent['type'] !== $data['type']) {
            $errors['type'] = 'نوع الحساب يجب أن يطابق نوع الحساب الرئيسي';
        }
        if ($instance) {
            $t = ERP_DB::t('account');
            if (!$data['is_group'] && ERP_DB::value("SELECT COUNT(*) FROM {$t} WHERE parent_id = %d", [(int) $instance['id']])) {
                $errors['is_group'] = 'الحساب له حسابات فرعية ولا يمكن تحويله لحساب تحليلي';
            }
            if ($data['is_group'] && ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('journal_line') . ' WHERE account_id = %d',
                    [(int) $instance['id']])) {
                $errors['is_group'] = 'الحساب عليه حركات ولا يمكن تحويله لحساب تجميعي';
            }
        }
        return $errors;
    }

    /** account_form: الكود المقترح للحساب الفرعي الجديد. */
    public static function suggest_child_code(array $parent): string
    {
        $last = ERP_DB::row('SELECT code FROM ' . ERP_DB::t('account') . ' WHERE parent_id = %d ORDER BY code DESC LIMIT 1',
            [(int) $parent['id']]);
        if ($last && ctype_digit($last['code'])) {
            return bcadd($last['code'], '1', 0);
        }
        return $parent['code'] . '01';
    }
}

final class ERP_Mapping
{
    public static function roles(): array
    {
        $out = [];
        foreach (ERP_Seed::data()['roles'] as [$role, $label]) {
            $out[$role] = $label;
        }
        return $out;
    }

    /** AccountMapping.get(role) */
    public static function get(string $role): array
    {
        $row = ERP_DB::row('SELECT a.* FROM ' . ERP_DB::t('account_mapping') . ' m JOIN ' . ERP_DB::t('account')
            . ' a ON a.id = m.account_id WHERE m.role = %s', [$role]);
        if ($row === null) {
            $label = self::roles()[$role] ?? $role;
            throw new ERP_Validation_Error("لم يتم تحديد حساب لـ «{$label}» في إعدادات التوجيه المحاسبي");
        }
        return $row;
    }

    public static function find(string $role): ?array
    {
        try {
            return self::get($role);
        } catch (ERP_Validation_Error $e) {
            return null;
        }
    }
}

final class ERP_Partners
{
    public static function is_vendor(array $p): bool
    {
        return in_array($p['type'], ['supplier', 'subcontractor'], true);
    }

    /** Partner.ar_account() */
    public static function ar_account(array $p): array
    {
        return $p['receivable_account_id'] ? ERP_Accounts::get($p['receivable_account_id']) : ERP_Mapping::get('receivable');
    }

    /** Partner.ap_account() */
    public static function ap_account(array $p): array
    {
        if ($p['payable_account_id']) {
            return ERP_Accounts::get($p['payable_account_id']);
        }
        if ($p['type'] === 'subcontractor') {
            $m = ERP_Mapping::find('subcontractor_payable');
            if ($m) {
                return $m;
            }
        }
        return ERP_Mapping::get('payable');
    }

    /** Partner.main_account() */
    public static function main_account(array $p): array
    {
        return self::is_vendor($p) ? self::ap_account($p) : self::ar_account($p);
    }

    /** Partner.balance(): كل الحسابات (مدين موجب / دائن سالب). */
    public static function balance(int $id, ?string $date_to = null): string
    {
        $sql = 'SELECT COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM ' . ERP_DB::t('journal_line') . ' l JOIN '
            . ERP_DB::t('journal_entry') . " e ON e.id = l.entry_id WHERE e.state = 'posted' AND l.partner_id = %d";
        $args = [$id];
        if ($date_to) {
            $sql .= ' AND e.date <= %s';
            $args[] = $date_to;
        }
        $r = ERP_DB::row($sql, $args);
        return ERP_Money::sub($r['d'], $r['c']);
    }
}

/**
 * EntryBuilder — يجمع سطور القيد ويدمج المتشابه (نفس الحساب والجانب والجهة والمشروع ومركز التكلفة والبيان).
 */
final class ERP_EntryBuilder
{
    public $date;
    public $memo;
    public $source;
    public $reference;
    public $source_url;
    private $lines = [];

    public function __construct(string $date, string $memo, string $source = 'manual', string $reference = '',
                                string $source_url = '')
    {
        $this->date = $date;
        $this->memo = $memo;
        $this->source = $source;
        $this->reference = $reference;
        $this->source_url = $source_url;
    }

    public function add(array $account, $debit = '0', $credit = '0', string $label = '', ?array $partner = null,
                        ?array $project = null, ?array $cost_center = null): self
    {
        $debit = ERP_Money::r2($debit);
        $credit = ERP_Money::r2($credit);
        if (ERP_Money::cmp($debit, '0') < 0) {
            [$debit, $credit] = ['0.00', ERP_Money::r2(ERP_Money::sub($credit, $debit))];
        }
        if (ERP_Money::cmp($credit, '0') < 0) {
            [$debit, $credit] = [ERP_Money::r2(ERP_Money::sub($debit, $credit)), '0.00'];
        }
        if (ERP_Money::is_zero($debit) && ERP_Money::is_zero($credit)) {
            return $this;
        }
        $side = ERP_Money::is_zero($debit) ? 'c' : 'd';
        $key = implode('|', [$account['id'], $side, $partner['id'] ?? '', $project['id'] ?? '', $cost_center['id'] ?? '', $label]);
        if (isset($this->lines[$key])) {
            $this->lines[$key]['debit'] = ERP_Money::add($this->lines[$key]['debit'], $debit);
            $this->lines[$key]['credit'] = ERP_Money::add($this->lines[$key]['credit'], $credit);
        } else {
            $this->lines[$key] = ['account' => $account, 'debit' => $debit, 'credit' => $credit, 'label' => $label,
                'partner' => $partner, 'project' => $project, 'cost_center' => $cost_center];
        }
        return $this;
    }

    public function debit(array $account, $amount, array $kw = []): self
    {
        return $this->add($account, $amount, '0', $kw['label'] ?? '', $kw['partner'] ?? null, $kw['project'] ?? null,
            $kw['cost_center'] ?? null);
    }

    public function credit(array $account, $amount, array $kw = []): self
    {
        return $this->add($account, '0', $amount, $kw['label'] ?? '', $kw['partner'] ?? null, $kw['project'] ?? null,
            $kw['cost_center'] ?? null);
    }

    public function lines(): array
    {
        return array_values($this->lines);
    }

    public function post(): int
    {
        return ERP_Posting::create_entry($this->date, $this->memo, $this->lines(), $this->source, $this->reference,
            $this->source_url, true);
    }
}

final class ERP_Posting
{
    /** check_lock_date() */
    public static function check_lock_date(string $date): void
    {
        $company = ERP_Company::get();
        if ($company['lock_date'] && strcmp($date, $company['lock_date']) <= 0) {
            throw new ERP_Validation_Error(sprintf(
                'الفترة مقفلة حتى %s. لا يمكن تسجيل أو تعديل حركات بتاريخ %s',
                str_replace('-', '/', $company['lock_date']), str_replace('-', '/', $date)
            ));
        }
    }

    /**
     * validate_lines() — نفس الشروط والرسائل.
     * إضافة متفق عليها كتابةً (البند 2-6 في المواصفات): رفض الحسابات غير النشطة.
     */
    public static function validate_lines(array $lines): string
    {
        $count = 0;
        foreach ($lines as $ln) {
            if (!ERP_Money::is_zero($ln['debit']) || !ERP_Money::is_zero($ln['credit'])) {
                $count++;
            }
        }
        if ($count < 2) {
            throw new ERP_Validation_Error('القيد يجب أن يحتوي على سطرين على الأقل');
        }
        $total_d = '0';
        $total_c = '0';
        foreach ($lines as $ln) {
            $total_d = ERP_Money::add($total_d, ERP_Money::r2($ln['debit']));
            $total_c = ERP_Money::add($total_c, ERP_Money::r2($ln['credit']));
        }
        if (ERP_Money::cmp($total_d, $total_c) !== 0) {
            throw new ERP_Validation_Error(sprintf('القيد غير متزن: إجمالي المدين %s ≠ إجمالي الدائن %s',
                ERP_Money::money($total_d, 2, false), ERP_Money::money($total_c, 2, false)));
        }
        foreach ($lines as $ln) {
            $acc = $ln['account'];
            if ((int) $acc['is_group']) {
                throw new ERP_Validation_Error('الحساب ' . ERP_Accounts::str($acc) . ' حساب تجميعي ولا يقبل قيوداً');
            }
            if (!(int) $acc['active']) {
                throw new ERP_Validation_Error('الحساب ' . ERP_Accounts::str($acc) . ' غير نشط ولا يقبل قيوداً');
            }
            if (!ERP_Money::is_zero($ln['debit']) && !ERP_Money::is_zero($ln['credit'])) {
                throw new ERP_Validation_Error('لا يجوز أن يحتوي السطر الواحد على مدين ودائن معاً');
            }
        }
        return $total_d;
    }

    /** create_entry() — داخل معاملة واحدة: القيد وسطوره معاً أو لا شيء. */
    public static function create_entry(string $date, string $memo, array $lines, string $source = 'manual',
                                        string $reference = '', string $source_url = '', bool $post = true): int
    {
        return ERP_DB::transaction(function () use ($date, $memo, $lines, $source, $reference, $source_url, $post) {
            self::check_lock_date($date);
            self::validate_lines($lines);
            $id = ERP_DB::insert('journal_entry', [
                'number' => ERP_Sequence::next('JE'),
                'date' => $date,
                'memo' => mb_substr($memo, 0, 300),
                'source' => $source,
                'reference' => mb_substr($reference, 0, 100),
                'source_url' => $source_url,
                'state' => $post ? 'posted' : 'draft',
                'created_by_id' => get_current_user_id() ?: null,
            ]);
            foreach ($lines as $ln) {
                if (ERP_Money::is_zero($ln['debit']) && ERP_Money::is_zero($ln['credit'])) {
                    continue;
                }
                ERP_DB::insert('journal_line', [
                    'entry_id' => $id,
                    'account_id' => (int) $ln['account']['id'],
                    'debit' => ERP_Money::r2($ln['debit']),
                    'credit' => ERP_Money::r2($ln['credit']),
                    'label' => mb_substr((string) ($ln['label'] ?? ''), 0, 300),
                    'partner_id' => isset($ln['partner']['id']) ? (int) $ln['partner']['id'] : null,
                    'project_id' => isset($ln['project']['id']) ? (int) $ln['project']['id'] : null,
                    'cost_center_id' => isset($ln['cost_center']['id']) ? (int) $ln['cost_center']['id'] : null,
                ]);
            }
            ERP_Audit::log($post ? 'post' : 'create', 'journal_entry', $id, null, ERP_Journal::snapshot($id),
                'قيد ' . ERP_DB::value('SELECT number FROM ' . ERP_DB::t('journal_entry') . ' WHERE id=%d', [$id]));
            return $id;
        });
    }

    /** remove_entry(): حذف القيد الآلي عند إرجاع المستند لمسودة (مع احترام تاريخ الإقفال). */
    public static function remove_entry(?int $entry_id): void
    {
        if (!$entry_id) {
            return;
        }
        $e = ERP_DB::get('journal_entry', $entry_id);
        if (!$e) {
            return;
        }
        self::check_lock_date($e['date']);
        $before = ERP_Journal::snapshot($entry_id);
        ERP_DB::delete('journal_entry', $entry_id);
        ERP_Audit::log('delete', 'journal_entry', $entry_id, $before, null, 'حذف قيد ' . $e['number']);
    }

    /** post_manual() */
    public static function post_manual(int $entry_id): void
    {
        ERP_DB::transaction(function () use ($entry_id) {
            $e = ERP_DB::row('SELECT * FROM ' . ERP_DB::t('journal_entry') . ' WHERE id = %d FOR UPDATE', [$entry_id]);
            self::check_lock_date($e['date']);
            $lines = [];
            foreach (ERP_Journal::lines($entry_id) as $ln) {
                $lines[] = ['account' => ERP_Accounts::get($ln['account_id']), 'debit' => $ln['debit'], 'credit' => $ln['credit']];
            }
            self::validate_lines($lines);
            ERP_DB::update('journal_entry', $entry_id, ['state' => 'posted']);
            ERP_Audit::log('post', 'journal_entry', $entry_id, null, null, 'ترحيل قيد ' . $e['number']);
        });
    }
}

final class ERP_Journal
{
    const AUTO_EXCLUDED = ['manual', 'opening', 'closing'];

    public static function is_auto(array $e): bool
    {
        return !in_array($e['source'], self::AUTO_EXCLUDED, true);
    }

    public static function lines(int $entry_id): array
    {
        return ERP_DB::rows('SELECT * FROM ' . ERP_DB::t('journal_line') . ' WHERE entry_id = %d ORDER BY id', [$entry_id]);
    }

    public static function totals(int $entry_id): array
    {
        $r = ERP_DB::row('SELECT COALESCE(SUM(debit),0) d, COALESCE(SUM(credit),0) c FROM ' . ERP_DB::t('journal_line')
            . ' WHERE entry_id = %d', [$entry_id]);
        return [ERP_Money::norm($r['d']), ERP_Money::norm($r['c'])];
    }

    /** لقطة القيد وسطوره لسجل التدقيق. */
    public static function snapshot(int $entry_id): ?array
    {
        $e = ERP_DB::get('journal_entry', $entry_id);
        if (!$e) {
            return null;
        }
        $e['lines'] = array_map(function ($l) {
            return array_intersect_key($l, array_flip(['account_id', 'debit', 'credit', 'label', 'partner_id', 'project_id',
                'cost_center_id']));
        }, self::lines($entry_id));
        return $e;
    }

    /**
     * حفظ قيد يدوي (مسودة) بسطوره — journal_form + BalancedFormSet في الأصل.
     * @param array $header date, source, reference, memo
     * @param array $lines  كل سطر: account_id, label, debit, credit, partner_id, project_id, cost_center_id
     */
    public static function save_manual(?int $id, array $header, array $lines): int
    {
        return ERP_DB::transaction(function () use ($id, $header, $lines) {
            $before = $id ? self::snapshot($id) : null;
            if ($id) {
                $e = ERP_DB::row('SELECT * FROM ' . ERP_DB::t('journal_entry') . ' WHERE id = %d FOR UPDATE', [$id]);
                if (!$e || $e['state'] !== 'draft' || self::is_auto($e)) {
                    throw new ERP_Validation_Error('لا يمكن تعديل هذا القيد');
                }
                ERP_DB::update('journal_entry', $id, $header);
                ERP_DB::query('DELETE FROM ' . ERP_DB::t('journal_line') . ' WHERE entry_id = %d', [$id]);
            } else {
                $header['number'] = ERP_Sequence::next('JE');
                $header['state'] = 'draft';
                $header['created_by_id'] = get_current_user_id() ?: null;
                $id = ERP_DB::insert('journal_entry', $header);
            }
            foreach ($lines as $ln) {
                $ln['entry_id'] = $id;
                ERP_DB::insert('journal_line', $ln);
            }
            ERP_Audit::log($before ? 'update' : 'create', 'journal_entry', $id, $before, self::snapshot($id),
                'قيد يدوي ' . ERP_DB::value('SELECT number FROM ' . ERP_DB::t('journal_entry') . ' WHERE id=%d', [$id]));
            return $id;
        });
    }
}

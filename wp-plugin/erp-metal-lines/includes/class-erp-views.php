<?php
/**
 * شاشات المرحلة الأولى — نقل لـ accounting/views.py و accounting/reports.py (جزء العرض).
 * الصلاحيات و nonce تُفحص في الموجّه قبل الوصول هنا. كل الكتابة داخل معاملات ومسجلة في سجل التدقيق.
 */
defined('ABSPATH') || exit;

final class ERP_Views
{
    const PER_PAGE = 50;

    private static function is_post(): bool
    {
        return isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST';
    }

    private static function page(string $tpl, array $ctx): string
    {
        return ERP_Templates::page($tpl, $ctx);
    }

    // ================================================================== القائمة العامة (render_list)
    /**
     * @param array $columns [[title, callable(row): html_escaped, is_num, total?]]
     * @param array $filters [[name, title, choices, callable(&$where, &$args, $value)]]
     */
    private static function render_list(array $o): string
    {
        $table = ERP_DB::t($o['table']);
        $where = [$o['where'] ?? '1=1'];
        $args = $o['args'] ?? [];
        $q = ERP_UI::get('q');
        if ($q !== '' && !empty($o['search'])) {
            $or = [];
            foreach ($o['search'] as $col) {
                $or[] = "{$col} LIKE %s";
                $args[] = '%' . ERP_DB::wpdb()->esc_like($q) . '%';
            }
            $where[] = '(' . implode(' OR ', $or) . ')';
        }
        $active = [];
        foreach ($o['filters'] ?? [] as [$name, $title, $choices, $apply]) {
            $val = ERP_UI::get($name);
            if ($val !== '' && isset($choices[$val])) {
                $apply($where, $args, $val);
            } else {
                $val = '';
            }
            $active[] = ['name' => $name, 'title' => $title, 'choices' => $choices, 'value' => $val];
        }
        $from = $o['from'] ?? "{$table} t";
        $select = $o['select'] ?? 't.*';
        $w = implode(' AND ', $where);
        $order = $o['order'] ?? 't.id DESC';
        $count = (int) ERP_DB::value("SELECT COUNT(*) FROM {$from} WHERE {$w}", $args);
        $pages = max(1, (int) ceil($count / self::PER_PAGE));
        $page = max(1, min($pages, (int) (ERP_UI::get('page', '1') ?: 1)));
        $offset = ($page - 1) * self::PER_PAGE;
        $rows = ERP_DB::rows("SELECT {$select} FROM {$from} WHERE {$w} ORDER BY {$order} LIMIT " . self::PER_PAGE
            . " OFFSET {$offset}", $args);
        $totals = null;
        if (array_filter(array_column($o['columns'], 3))) {
            $all = $count <= self::PER_PAGE ? $rows : ERP_DB::rows("SELECT {$select} FROM {$from} WHERE {$w}", $args);
            $totals = [];
            foreach ($o['columns'] as $c) {
                if (!empty($c[3])) {
                    $sum = '0';
                    foreach ($all as $r) {
                        $sum = ERP_Money::add($sum, $c[3]($r));
                    }
                    $totals[] = erp_money($sum);
                } else {
                    $totals[] = '';
                }
            }
        }
        $out_rows = [];
        foreach ($rows as $r) {
            $out_rows[] = ['url' => isset($o['row_url']) ? $o['row_url']($r) : null,
                'cells' => array_map(function ($c) use ($r) {
                    return $c[1]($r);
                }, $o['columns'])];
        }
        return self::page('list', [
            'title' => $o['title'], 'icon' => $o['icon'] ?? 'bi-list', 'columns' => array_map(function ($c) {
                return [$c[0], !empty($c[2])];
            }, $o['columns']), 'rows' => $out_rows, 'page' => $page, 'pages' => $pages, 'q' => $q,
            'has_search' => !empty($o['search']), 'filters' => $active, 'new_url' => $o['new_url'] ?? null,
            'buttons' => $o['buttons'] ?? [], 'totals' => $totals,
        ]);
    }

    private static function bool_icon($v): string
    {
        return '<i class="bi ' . ((int) $v ? 'bi-check-circle-fill text-success' : 'bi-dash') . '"></i>';
    }

    // ================================================================== النموذج العام (save_form)
    /**
     * يعالج نموذجاً بسيطاً (بدون سطور): GET يعرض، POST يتحقق ويحفظ داخل معاملة ويسجّل في التدقيق.
     */
    private static function simple_form(string $table, ?array $instance, array $fields, array $ctx, array $initial,
                                        callable $success, ?callable $validate = null): string
    {
        $values = $instance ? self::display_values($table, $instance, $fields) : $initial;
        $errors = [];
        $non_field = '';
        if (self::is_post()) {
            [$clean, $errors] = ERP_UI::clean_form($table, $fields);
            $values = self::raw_post_values($fields);
            if (!$errors && $validate) {
                $errors = $validate($clean, $instance);
                if (isset($errors['__all__'])) {
                    $non_field = $errors['__all__'];
                    unset($errors['__all__']);
                }
            }
            if (!$errors && $non_field === '') {
                try {
                    $id = ERP_DB::transaction(function () use ($table, $instance, $clean) {
                        if ($instance) {
                            ERP_DB::update($table, (int) $instance['id'], $clean);
                            ERP_Audit::log('update', $table, $instance['id'], $instance, ERP_DB::get($table, $instance['id']));
                            return (int) $instance['id'];
                        }
                        $id = ERP_DB::insert($table, $clean);
                        ERP_Audit::log('create', $table, $id, null, ERP_DB::get($table, $id));
                        return $id;
                    });
                    ERP_Accounts::flush();
                    ERP_UI::flash('success', 'تم الحفظ بنجاح');
                    ERP_Router::redirect($success($id));
                } catch (ERP_Validation_Error $e) {
                    $non_field = $e->getMessage();
                }
            }
        }
        return self::page('form', $ctx + ['table' => $table, 'fields' => $fields, 'values' => $values, 'errors' => $errors,
                'non_field_error' => $non_field]);
    }

    private static function raw_post_values(array $fields): array
    {
        $v = [];
        foreach (array_keys($fields) as $name) {
            $v[$name] = isset($_POST[$name]) ? sanitize_text_field(wp_unslash($_POST[$name])) : '';
        }
        return $v;
    }

    private static function display_values(string $table, array $row, array $fields): array
    {
        $v = [];
        foreach (array_keys($fields) as $name) {
            $col = ERP_DB::field($table, $name)['column'];
            $v[$name] = $row[$col] ?? '';
        }
        return $v;
    }

    // ================================================================== لوحة التحكم
    public static function dashboard(): string
    {
        $today = ERP_UI::today();
        $year_start = substr($today, 0, 4) . '-01-01';
        $jl = ERP_DB::t('journal_line');
        $je = ERP_DB::t('journal_entry');
        $ac = ERP_DB::t('account');
        $type_sum = function (string $type, ?string $from) use ($jl, $je, $ac) {
            $sql = "SELECT COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM {$jl} l JOIN {$je} e ON e.id=l.entry_id "
                . "JOIN {$ac} a ON a.id=l.account_id WHERE e.state='posted' AND a.type=%s";
            $args = [$type];
            if ($from) {
                $sql .= ' AND e.date >= %s';
                $args[] = $from;
            }
            $r = ERP_DB::row($sql, $args);
            return ERP_Money::sub($r['d'], $r['c']);
        };
        $kind_sum = function (string $kind) use ($jl, $je, $ac) {
            $r = ERP_DB::row("SELECT COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c FROM {$jl} l JOIN {$je} e "
                . "ON e.id=l.entry_id JOIN {$ac} a ON a.id=l.account_id WHERE e.state='posted' AND a.kind=%s", [$kind]);
            return ERP_Money::sub($r['d'], $r['c']);
        };
        $revenue = ERP_Money::neg($type_sum('income', $year_start));
        $expense = $type_sum('expense', $year_start);
        $treasury = ERP_Reports::treasury_balances();
        // آخر 12 شهراً باستعلام مجمّع واحد
        $months = [];
        [$y, $m] = [(int) substr($today, 0, 4), (int) substr($today, 5, 2)];
        for ($i = 0; $i < 12; $i++) {
            array_unshift($months, sprintf('%04d-%02d', $y, $m));
            if (--$m === 0) {
                [$y, $m] = [$y - 1, 12];
            }
        }
        $series = [];
        foreach (ERP_DB::rows("SELECT DATE_FORMAT(e.date,'%Y-%m') ym, a.type, SUM(l.debit) d, SUM(l.credit) c FROM {$jl} l "
            . "JOIN {$je} e ON e.id=l.entry_id JOIN {$ac} a ON a.id=l.account_id WHERE e.state='posted' "
            . "AND a.type IN ('income','expense') AND e.date >= %s GROUP BY ym, a.type", [$months[0] . '-01']) as $r) {
            $series[$r['ym']][$r['type']] = $r['type'] === 'income' ? ERP_Money::sub($r['c'], $r['d']) : ERP_Money::sub($r['d'], $r['c']);
        }
        $chart = ['labels' => [], 'revenue' => [], 'expense' => []];
        foreach ($months as $ym) {
            $chart['labels'][] = str_replace('-', '/', $ym);
            // للرسم البياني فقط (عرض) — ليست قيمة محاسبية
            $chart['revenue'][] = (float) ($series[$ym]['income'] ?? 0);
            $chart['expense'][] = (float) ($series[$ym]['expense'] ?? 0);
        }
        $company = ERP_Company::get();
        $steps = [
            ['بيانات الشركة والسنة المالية', '/settings/', $company['tax_id'] !== ''],
            ['مراجعة شجرة الحسابات وإضافة البنوك والخزائن', '/accounts/',
                (int) ERP_DB::value("SELECT COUNT(*) FROM {$ac} WHERE kind='bank'") > 2],
            ['إدخال الأرصدة الافتتاحية (قيد افتتاحي)', '/journal/new/',
                (bool) ERP_DB::value("SELECT COUNT(*) FROM {$je} WHERE source='opening'")],
            ['إضافة العملاء ومقاولي الباطن والموردين', '/partners/new/?type=customer',
                (bool) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('partner'))],
        ];
        $show_steps = false;
        foreach ($steps as $s) {
            $show_steps = $show_steps || !$s[2];
        }
        return self::page('dashboard', [
            'title' => 'لوحة التحكم', 'cash' => ERP_Money::sum(array_column($treasury, 'balance')), 'treasury' => $treasury,
            'receivable' => $kind_sum('receivable'), 'payable' => ERP_Money::neg($kind_sum('payable')),
            'revenue' => $revenue, 'expense' => $expense, 'profit' => ERP_Money::sub($revenue, $expense), 'chart' => $chart,
            'recent' => ERP_DB::rows("SELECT * FROM {$je} WHERE state='posted' ORDER BY date DESC, id DESC LIMIT 8"),
            'drafts' => (int) ERP_DB::value("SELECT COUNT(*) FROM {$je} WHERE state='draft'"),
            'steps' => $steps, 'show_steps' => $show_steps,
        ]);
    }

    // ================================================================== شجرة الحسابات
    public static function account_tree(): string
    {
        $accounts = ERP_Accounts::all();
        $sums = [];
        foreach (ERP_Reports::sums_by_account(null, null) as $aid => [$d, $c]) {
            $sums[$aid] = ERP_Money::sub($d, $c);
        }
        $totals = [];
        foreach ($sums as $aid => $v) {
            $a = $accounts[$aid] ?? null;
            while ($a) {
                $totals[(int) $a['id']] = ERP_Money::add($totals[(int) $a['id']] ?? '0', $v);
                $a = $a['parent_id'] !== null ? ($accounts[(int) $a['parent_id']] ?? null) : null;
            }
        }
        $sorted = array_values($accounts);
        usort($sorted, function ($x, $y) {
            return strcmp($x['code'], $y['code']);
        });
        $lv = [];
        $rows = [];
        foreach ($sorted as $a) {
            $lv[(int) $a['id']] = $a['parent_id'] === null ? 0 : ($lv[(int) $a['parent_id']] ?? 0) + 1;
            $rows[] = ['a' => $a, 'balance' => $totals[(int) $a['id']] ?? '0', 'level' => $lv[(int) $a['id']]];
        }
        return self::page('account_tree', ['title' => 'شجرة الحسابات', 'rows' => $rows]);
    }

    private static function account_fields(): array
    {
        return [
            'code' => [], 'name' => [], 'parent' => ['choices_from' => ERP_UI::account_options('is_group = 1')],
            'type' => [], 'kind' => [], 'is_group' => [], 'active' => [], 'notes' => [],
        ];
    }

    public static function account_form($pk = null): string
    {
        $obj = $pk ? ERP_DB::get('account', (int) $pk) : null;
        if ($pk && !$obj) {
            ERP_Router::error_page(404, 'الحساب غير موجود.');
        }
        $initial = ['active' => 1, 'kind' => 'other'];
        $parent_id = (int) ERP_UI::get('parent');
        if (!$obj && $parent_id && ($parent = ERP_DB::get('account', $parent_id))) {
            $initial += ['parent' => $parent['id'], 'type' => $parent['type'], 'code' => ERP_Accounts::suggest_child_code($parent)];
        }
        return self::simple_form('account', $obj, self::account_fields(),
            ['title' => $obj ? 'تعديل حساب ' . ERP_Accounts::str($obj) : 'حساب', 'icon' => 'bi-diagram-3'], $initial,
            function () {
                return '/accounts/';
            },
            function ($clean, $instance) {
                return ERP_Accounts::validate($clean, $instance);
            });
    }

    public static function account_delete($pk): string
    {
        if (!self::is_post()) {
            ERP_Router::redirect('/accounts/');
        }
        $obj = ERP_DB::get('account', (int) $pk);
        if ($obj) {
            try {
                ERP_DB::transaction(function () use ($obj) {
                    ERP_DB::delete('account', (int) $obj['id']);
                    ERP_Audit::log('delete', 'account', $obj['id'], $obj, null, 'حذف حساب ' . ERP_Accounts::str($obj));
                });
                ERP_Accounts::flush();
                ERP_UI::flash('success', 'تم الحذف');
            } catch (ERP_Validation_Error $e) {
                ERP_UI::flash('danger', 'لا يمكن الحذف لوجود حركات أو سجلات مرتبطة. يمكنك إيقافه (غير نشط) بدلاً من ذلك');
            }
        }
        ERP_Router::redirect('/accounts/');
        return '';
    }

    // ================================================================== مراكز التكلفة والضرائب
    public static function cost_center_list(): string
    {
        $cc = ERP_DB::t('cost_center');
        return self::render_list([
            'title' => 'مراكز التكلفة', 'table' => 'cost_center', 'icon' => 'bi-bullseye', 'order' => 't.code',
            'from' => "{$cc} t LEFT JOIN {$cc} p ON p.id = t.parent_id", 'select' => "t.*, CONCAT(p.code, ' - ', p.name) parent_str",
            'search' => ['t.code', 't.name'], 'new_url' => home_url('/cost-centers/new/'),
            'row_url' => function ($r) {
                return home_url("/cost-centers/{$r['id']}/");
            },
            'columns' => [
                ['الكود', function ($r) { return erp_e($r['code']); }],
                ['الاسم', function ($r) { return erp_e($r['name']); }],
                ['الرئيسي', function ($r) { return erp_e($r['parent_str'] ?? ''); }],
                ['نشط', function ($r) { return self::bool_icon($r['active']); }],
            ],
        ]);
    }

    public static function cost_center_form($pk = null): string
    {
        $obj = $pk ? ERP_DB::get('cost_center', (int) $pk) : null;
        return self::simple_form('cost_center', $obj, [
            'code' => [], 'name' => [], 'parent' => ['choices_from' => ERP_UI::code_name_options('cost_center')], 'active' => [],
        ], ['title' => 'مركز تكلفة'], ['active' => 1], function () {
            return '/cost-centers/';
        });
    }

    public static function tax_list(): string
    {
        return self::render_list([
            'title' => 'الضرائب', 'table' => 'tax', 'icon' => 'bi-percent', 'order' => 't.kind, t.rate',
            'new_url' => home_url('/taxes/new/'),
            'row_url' => function ($r) {
                return home_url("/taxes/{$r['id']}/");
            },
            'columns' => [
                ['الاسم', function ($r) { return erp_e($r['name']); }],
                ['النوع', function ($r) { return erp_e(ERP_DB::display('tax', 'kind', $r['kind'])); }],
                ['النسبة %', function ($r) { return erp_e(erp_qty($r['rate'])); }, true],
                ['النطاق', function ($r) { return erp_e(ERP_DB::display('tax', 'scope', $r['scope'])); }],
                ['نشط', function ($r) { return self::bool_icon($r['active']); }],
            ],
        ]);
    }

    public static function tax_form($pk = null): string
    {
        $obj = $pk ? ERP_DB::get('tax', (int) $pk) : null;
        $accs = ERP_UI::account_options();
        return self::simple_form('tax', $obj, [
            'name' => [], 'kind' => [], 'rate' => [], 'scope' => [], 'sale_account' => ['choices_from' => $accs],
            'purchase_account' => ['choices_from' => $accs], 'active' => [],
        ], ['title' => 'ضريبة'], ['active' => 1, 'scope' => 'both'], function () {
            return '/taxes/';
        });
    }

    // ================================================================== العملاء والموردون
    public static function partner_list(): string
    {
        $ptype = ERP_UI::get('type');
        $titles = ['customer' => 'العملاء', 'supplier' => 'الموردون', 'subcontractor' => 'مقاولو الباطن'];
        $where = '1=1';
        $args = [];
        if ($ptype !== '' && isset(ERP_DB::choices('partner', 'type')[$ptype])) {
            if (in_array($ptype, ['customer', 'supplier'], true)) {
                $where = 't.type IN (%s, %s)';
                $args = [$ptype, 'both'];
            } else {
                $where = 't.type = %s';
                $args = [$ptype];
            }
        }
        $balance = function ($r) {
            static $cache = [];
            return $cache[$r['id']] ?? ($cache[$r['id']] = ERP_Partners::balance((int) $r['id']));
        };
        return self::render_list([
            'title' => $titles[$ptype] ?? 'العملاء والموردون ومقاولو الباطن', 'table' => 'partner', 'icon' => 'bi-people',
            'where' => $where, 'args' => $args, 'order' => 't.name', 'search' => ['t.name', 't.code', 't.phone', 't.tax_id'],
            'new_url' => erp_url('/partners/new/', ['type' => $ptype]),
            'row_url' => function ($r) {
                return home_url("/partners/{$r['id']}/");
            },
            'columns' => [
                ['الكود', function ($r) { return erp_e($r['code']); }],
                ['الاسم', function ($r) { return erp_e($r['name']); }],
                ['النوع', function ($r) { return erp_e(ERP_DB::display('partner', 'type', $r['type'])); }],
                ['التليفون', function ($r) { return erp_e($r['phone']); }],
                ['الرقم الضريبي', function ($r) { return erp_e($r['tax_id']); }],
                ['الرصيد', function ($r) use ($balance) { return erp_e(erp_money($balance($r))); }, true, $balance],
            ],
        ]);
    }

    public static function partner_form($pk = null): string
    {
        $obj = $pk ? ERP_DB::get('partner', (int) $pk) : null;
        $type = ERP_UI::get('type') ?: 'customer';
        return self::simple_form('partner', $obj, [
            'code' => [], 'name' => [], 'type' => [], 'tax_id' => [], 'national_id' => [], 'phone' => [], 'email' => [],
            'address' => [], 'credit_limit' => [], 'payment_days' => [],
            'receivable_account' => ['choices_from' => ERP_UI::account_options("is_group = 0 AND type = 'asset'")],
            'payable_account' => ['choices_from' => ERP_UI::account_options("is_group = 0 AND type = 'liability'")],
            'active' => [], 'notes' => [],
        ], ['title' => 'بيانات جهة التعامل', 'icon' => 'bi-person-vcard'],
            ['type' => isset(ERP_DB::choices('partner', 'type')[$type]) ? $type : 'customer', 'active' => 1,
                'credit_limit' => '0', 'payment_days' => '0'],
            function ($id) {
                return "/partners/{$id}/";
            });
    }

    public static function partner_detail($pk): string
    {
        $p = ERP_DB::get('partner', (int) $pk);
        if (!$p) {
            ERP_Router::error_page(404, 'جهة التعامل غير موجودة.');
        }
        return self::page('partner_detail', ['title' => $p['name'], 'p' => $p, 'balance' => ERP_Partners::balance((int) $p['id'])]);
    }

    // ================================================================== قيود اليومية
    public static function journal_list(): string
    {
        $je = ERP_DB::t('journal_entry');
        $jl = ERP_DB::t('journal_line');
        return self::render_list([
            'title' => 'قيود اليومية', 'table' => 'journal_entry', 'icon' => 'bi-journal-text',
            'select' => "t.*, (SELECT SUM(debit) FROM {$jl} x WHERE x.entry_id = t.id) total", 'from' => "{$je} t",
            'order' => 't.date DESC, t.id DESC', 'search' => ['t.number', 't.memo', 't.reference'],
            'new_url' => home_url('/journal/new/'),
            'buttons' => [[home_url('/journal/templates/'), 'قيود جاهزة', 'bi-lightning-charge', 'warning']],
            'filters' => [
                ['source', 'المصدر', ERP_DB::choices('journal_entry', 'source'), function (&$w, &$a, $v) {
                    $w[] = 't.source = %s';
                    $a[] = $v;
                }],
                ['state', 'الحالة', ERP_DB::choices('journal_entry', 'state'), function (&$w, &$a, $v) {
                    $w[] = 't.state = %s';
                    $a[] = $v;
                }],
            ],
            'row_url' => function ($r) {
                return home_url("/journal/{$r['id']}/");
            },
            'columns' => [
                ['رقم القيد', function ($r) { return erp_e($r['number']); }],
                ['التاريخ', function ($r) { return erp_e(erp_date($r['date'])); }],
                ['البيان', function ($r) { return erp_e($r['memo']); }],
                ['المصدر', function ($r) { return erp_e(ERP_DB::display('journal_entry', 'source', $r['source'])); }],
                ['المبلغ', function ($r) { return erp_e(erp_money($r['total'])); }, true],
                ['الحالة', function ($r) { return erp_state_badge($r['state']); }],
            ],
        ]);
    }

    public static function journal_detail($pk): string
    {
        $e = ERP_DB::get('journal_entry', (int) $pk);
        if (!$e) {
            ERP_Router::error_page(404, 'القيد غير موجود.');
        }
        [$d, $c] = ERP_Journal::totals((int) $e['id']);
        $lines = ERP_DB::rows('SELECT l.*, a.code acode, a.name aname, p.name pname, cc.name ccname FROM '
            . ERP_DB::t('journal_line') . ' l JOIN ' . ERP_DB::t('account') . ' a ON a.id=l.account_id LEFT JOIN '
            . ERP_DB::t('partner') . ' p ON p.id=l.partner_id LEFT JOIN ' . ERP_DB::t('cost_center')
            . ' cc ON cc.id=l.cost_center_id WHERE l.entry_id=%d ORDER BY l.id', [(int) $e['id']]);
        $creator = $e['created_by_id'] ? get_userdata((int) $e['created_by_id']) : null;
        return self::page('journal_detail', ['title' => 'قيد رقم ' . $e['number'], 'e' => $e, 'lines' => $lines,
            'total_debit' => $d, 'total_credit' => $c, 'creator' => $creator ? $creator->display_name : 'النظام',
            'company' => ERP_Company::get()]);
    }

    private static function journal_line_fields(): array
    {
        return [
            'account' => ['choices_from' => ERP_UI::account_options()],
            'label' => [], 'debit' => [], 'credit' => [],
            'partner' => ['choices_from' => ERP_UI::options('partner', '1=1', [], 'name', 'name')],
            'project' => ['choices_from' => ERP_UI::code_name_options('project')],
            'cost_center' => ['choices_from' => ERP_UI::code_name_options('cost_center')],
        ];
    }

    public static function journal_form($pk = null): string
    {
        $obj = $pk ? ERP_DB::get('journal_entry', (int) $pk) : null;
        if ($pk && !$obj) {
            ERP_Router::error_page(404, 'القيد غير موجود.');
        }
        if ($obj && ERP_Journal::is_auto($obj)) {
            ERP_UI::flash('warning', 'هذا قيد آلي ناتج عن مستند؛ عدّل المستند الأصلي بدلاً منه');
            ERP_Router::redirect("/journal/{$obj['id']}/");
        }
        if ($obj && $obj['state'] !== 'draft') {
            ERP_UI::flash('warning', 'لا يمكن تعديل مستند مرحّل. ألغِ الترحيل أولاً.');
            ERP_Router::redirect("/journal/{$obj['id']}/");
        }
        $header_fields = ['date' => [], 'source' => ['label' => 'نوع القيد', 'choices' => ['manual' => 'قيد يومية', 'opening' => 'قيد افتتاحي']],
            'reference' => [], 'memo' => []];
        $line_fields = self::journal_line_fields();
        $values = $obj ? ['date' => $obj['date'], 'source' => $obj['source'], 'reference' => $obj['reference'], 'memo' => $obj['memo']]
            : ['date' => ERP_UI::today(), 'source' => 'manual'];
        $errors = [];
        $non_field = '';
        $non_form = '';
        $line_rows = [];
        if ($obj) {
            foreach (ERP_Journal::lines((int) $obj['id']) as $l) {
                $line_rows[] = [['account' => $l['account_id'], 'label' => $l['label'], 'debit' => ERP_Money::fixed($l['debit']),
                    'credit' => ERP_Money::fixed($l['credit']), 'partner' => $l['partner_id'], 'project' => $l['project_id'],
                    'cost_center' => $l['cost_center_id']], []];
            }
        }
        $empty = ['debit' => '0', 'credit' => '0'];
        for ($i = 0; $i < 2; $i++) {
            $line_rows[] = [$empty, []];
        }
        if (self::is_post()) {
            $values = self::raw_post_values($header_fields);
            [$clean, $errors] = ERP_UI::clean_form('journal_entry', $header_fields);
            if (!$errors && !in_array($clean['source'], ['manual', 'opening'], true)) {
                $errors['source'] = 'اختر قيمة صحيحة.';
            }
            [$lines, $line_rows, $non_form, $line_errors] = self::clean_journal_lines($line_fields);
            if (!$errors && !$line_errors && $non_form === '') {
                try {
                    $id = ERP_Journal::save_manual($obj ? (int) $obj['id'] : null, $clean, $lines);
                    ERP_UI::flash('success', 'تم الحفظ بنجاح');
                    ERP_Router::redirect("/journal/{$id}/");
                } catch (ERP_Validation_Error $e) {
                    $non_field = $e->getMessage();
                }
            }
        }
        return self::page('journal_form', [
            'title' => 'قيد يومية', 'obj' => $obj, 'table' => 'journal_entry', 'fields' => $header_fields, 'values' => $values,
            'errors' => $errors, 'non_field_error' => $non_field,
            'fs' => ['prefix' => 'lines', 'title' => 'سطور القيد', 'table' => 'journal_line', 'fields' => $line_fields,
                'rows' => $line_rows, 'non_form_error' => $non_form, 'empty' => $empty],
        ]);
    }

    /** BalancedFormSet.clean() — نفس الشروط والرسائل. */
    private static function clean_journal_lines(array $fields): array
    {
        $rows = ERP_UI::formset_rows('lines', array_keys($fields));
        $lines = [];
        $display = [];
        $any_error = false;
        $d = '0';
        $c = '0';
        $n = 0;
        $non_form = '';
        foreach ($rows as $r) {
            $vals = array_intersect_key($r, $fields);
            if ($r['DELETE']) {
                continue;
            }
            if ($r['_empty']) {
                $display[] = [$vals, []];
                continue;
            }
            $errs = [];
            $acc = $r['account'] !== '' && ctype_digit($r['account']) && isset($fields['account']['choices_from'][(int) $r['account']])
                ? (int) $r['account'] : null;
            if ($acc === null) {
                $errs['account'] = $r['account'] === '' ? 'هذا الحقل مطلوب.' : 'اختر قيمة صحيحة. الاختيار غير متاح.';
            }
            $amounts = [];
            foreach (['debit', 'credit'] as $k) {
                if ($r[$k] === '') {
                    $errs[$k] = 'هذا الحقل مطلوب.';
                    continue;
                }
                try {
                    $amounts[$k] = ERP_Money::parse_input($r[$k], 16, 2);
                } catch (ERP_Validation_Error $e) {
                    $errs[$k] = $e->getMessage();
                }
            }
            $fk = [];
            foreach (['partner', 'project', 'cost_center'] as $k) {
                if ($r[$k] === '') {
                    $fk[$k] = null;
                } elseif (ctype_digit($r[$k]) && isset($fields[$k]['choices_from'][(int) $r[$k]])) {
                    $fk[$k] = (int) $r[$k];
                } else {
                    $errs[$k] = 'اختر قيمة صحيحة. الاختيار غير متاح.';
                }
            }
            if (mb_strlen($r['label']) > 300) {
                $errs['label'] = 'تأكد أن عدد الحروف لا يزيد عن 300.';
            }
            $display[] = [$vals, $errs];
            if ($errs) {
                $any_error = true;
                continue;
            }
            if (!ERP_Money::is_zero($amounts['debit']) && !ERP_Money::is_zero($amounts['credit'])) {
                $non_form = $non_form ?: 'السطر الواحد لا يجمع مدين ودائن';
            }
            if (ERP_Money::cmp($amounts['debit'], '0') < 0 || ERP_Money::cmp($amounts['credit'], '0') < 0) {
                $non_form = $non_form ?: 'لا تُقبل قيم سالبة';
            }
            $d = ERP_Money::add($d, $amounts['debit']);
            $c = ERP_Money::add($c, $amounts['credit']);
            $n++;
            $lines[] = ['account_id' => $acc, 'label' => $r['label'], 'debit' => $amounts['debit'], 'credit' => $amounts['credit'],
                'partner_id' => $fk['partner'], 'project_id' => $fk['project'], 'cost_center_id' => $fk['cost_center']];
        }
        if (!$any_error && $non_form === '') {
            if ($n < 2) {
                $non_form = 'القيد يحتاج سطرين على الأقل';
            } elseif (ERP_Money::cmp($d, $c) !== 0) {
                $non_form = sprintf('القيد غير متزن: مدين %s - دائن %s = فرق %s', ERP_Money::money($d, 2, false),
                    ERP_Money::money($c, 2, false), ERP_Money::money(ERP_Money::sub($d, $c), 2, false));
            }
        }
        if (!$display) {
            $display[] = [['debit' => '0', 'credit' => '0'], []];
        }
        return [$lines, $display, $non_form, $any_error];
    }

    public static function journal_action($pk, $action): string
    {
        if (!self::is_post()) {
            ERP_Router::redirect("/journal/{$pk}/");
        }
        $e = ERP_DB::get('journal_entry', (int) $pk);
        if (!$e) {
            ERP_Router::error_page(404, 'القيد غير موجود.');
        }
        try {
            if (ERP_Journal::is_auto($e)) {
                throw new ERP_Validation_Error('القيود الآلية تُدار من المستند الأصلي');
            }
            if ($action === 'post') {
                ERP_Posting::post_manual((int) $e['id']);
                ERP_UI::flash('success', 'تم ترحيل القيد');
            } elseif ($action === 'unpost') {
                ERP_DB::transaction(function () use ($e) {
                    ERP_Posting::check_lock_date($e['date']);
                    ERP_DB::update('journal_entry', (int) $e['id'], ['state' => 'draft']);
                    ERP_Audit::log('unpost', 'journal_entry', $e['id'], null, null, 'إلغاء ترحيل قيد ' . $e['number']);
                });
                ERP_UI::flash('info', 'أُعيد القيد لمسودة');
            } elseif ($action === 'delete') {
                if ($e['state'] !== 'draft') {
                    throw new ERP_Validation_Error('ألغِ ترحيل القيد أولاً');
                }
                ERP_DB::transaction(function () use ($e) {
                    $before = ERP_Journal::snapshot((int) $e['id']);
                    ERP_DB::delete('journal_entry', (int) $e['id']);
                    ERP_Audit::log('delete', 'journal_entry', $e['id'], $before, null, 'حذف قيد ' . $e['number']);
                });
                ERP_UI::flash('success', 'تم حذف القيد');
                ERP_Router::redirect('/journal/');
            } elseif ($action === 'reverse') {
                $lines = [];
                foreach (ERP_Journal::lines((int) $e['id']) as $ln) {
                    $lines[] = ['account' => ERP_Accounts::get($ln['account_id']), 'debit' => $ln['credit'], 'credit' => $ln['debit'],
                        'label' => $ln['label'], 'partner' => $ln['partner_id'] ? ['id' => $ln['partner_id']] : null,
                        'project' => $ln['project_id'] ? ['id' => $ln['project_id']] : null,
                        'cost_center' => $ln['cost_center_id'] ? ['id' => $ln['cost_center_id']] : null];
                }
                $new = ERP_Posting::create_entry(ERP_UI::today(), "عكس القيد {$e['number']}: {$e['memo']}", $lines, 'manual',
                    $e['number']);
                $num = ERP_DB::value('SELECT number FROM ' . ERP_DB::t('journal_entry') . ' WHERE id=%d', [$new]);
                ERP_UI::flash('success', "تم إنشاء قيد عكسي رقم {$num}");
                ERP_Router::redirect("/journal/{$new}/");
            }
        } catch (ERP_Validation_Error $ex) {
            ERP_UI::flash('danger', $ex->getMessage());
        }
        ERP_Router::redirect("/journal/{$e['id']}/");
        return '';
    }

    // ================================================================== القيود الجاهزة
    public static function template_list(): string
    {
        $templates = ERP_DB::rows('SELECT * FROM ' . ERP_DB::t('journal_template') . ' WHERE active = 1 ORDER BY name');
        foreach ($templates as &$t) {
            $t['lines'] = ERP_DB::rows('SELECT tl.*, a.name aname FROM ' . ERP_DB::t('journal_template_line') . ' tl JOIN '
                . ERP_DB::t('account') . ' a ON a.id = tl.account_id WHERE tl.template_id = %d ORDER BY tl.id', [(int) $t['id']]);
        }
        unset($t);
        return self::page('template_list', ['title' => 'القيود الجاهزة', 'templates' => $templates]);
    }

    public static function template_form($pk = null): string
    {
        $obj = $pk ? ERP_DB::get('journal_template', (int) $pk) : null;
        $fields = ['name' => [], 'memo' => [], 'ask_partner' => [], 'ask_project' => [], 'active' => []];
        $line_fields = ['account' => ['choices_from' => ERP_UI::account_options()], 'side' => [], 'percent' => [], 'label' => [],
            'use_partner' => [], 'use_project' => []];
        $values = $obj ? self::display_values('journal_template', $obj, $fields) : ['active' => 1];
        $rows = [];
        if ($obj) {
            foreach (ERP_DB::rows('SELECT * FROM ' . ERP_DB::t('journal_template_line') . ' WHERE template_id=%d ORDER BY id',
                [(int) $obj['id']]) as $l) {
                $rows[] = [['account' => $l['account_id'], 'side' => $l['side'], 'percent' => ERP_Money::norm($l['percent']),
                    'label' => $l['label'], 'use_partner' => $l['use_partner'], 'use_project' => $l['use_project']], []];
            }
        }
        $empty = ['percent' => '100'];
        $rows[] = [$empty, []];
        $rows[] = [$empty, []];
        $errors = [];
        $non_field = '';
        if (self::is_post()) {
            $values = self::raw_post_values($fields);
            [$clean, $errors] = ERP_UI::clean_form('journal_template', $fields);
            $lines = [];
            $rows = [];
            $line_error = false;
            foreach (ERP_UI::formset_rows('lines', array_keys($line_fields)) as $r) {
                if ($r['DELETE']) {
                    continue;
                }
                $vals = array_intersect_key($r, $line_fields);
                if ($r['_empty']) {
                    $rows[] = [$vals, []];
                    continue;
                }
                $errs = [];
                if (!ctype_digit($r['account']) || !isset($line_fields['account']['choices_from'][(int) $r['account']])) {
                    $errs['account'] = 'هذا الحقل مطلوب.';
                }
                if (!in_array($r['side'], ['debit', 'credit'], true)) {
                    $errs['side'] = 'هذا الحقل مطلوب.';
                }
                try {
                    $pct = ERP_Money::parse_input($r['percent'] === '' ? '100' : $r['percent'], 7, 3);
                } catch (ERP_Validation_Error $e) {
                    $errs['percent'] = $e->getMessage();
                }
                $rows[] = [$vals, $errs];
                if ($errs) {
                    $line_error = true;
                    continue;
                }
                $lines[] = ['account_id' => (int) $r['account'], 'side' => $r['side'], 'percent' => $pct,
                    'label' => mb_substr($r['label'], 0, 200), 'use_partner' => $r['use_partner'] !== '',
                    'use_project' => $r['use_project'] !== ''];
            }
            if (!$errors && !$line_error) {
                $id = ERP_DB::transaction(function () use ($obj, $clean, $lines) {
                    if ($obj) {
                        ERP_DB::update('journal_template', (int) $obj['id'], $clean);
                        ERP_DB::query('DELETE FROM ' . ERP_DB::t('journal_template_line') . ' WHERE template_id=%d', [(int) $obj['id']]);
                        $id = (int) $obj['id'];
                    } else {
                        $id = ERP_DB::insert('journal_template', $clean);
                    }
                    foreach ($lines as $l) {
                        ERP_DB::insert('journal_template_line', $l + ['template_id' => $id]);
                    }
                    ERP_Audit::log($obj ? 'update' : 'create', 'journal_template', $id, $obj, $clean + ['lines' => $lines]);
                    return $id;
                });
                ERP_UI::flash('success', 'تم الحفظ بنجاح');
                ERP_Router::redirect('/journal/templates/');
            }
        }
        return self::page('form', ['title' => 'نموذج قيد جاهز', 'table' => 'journal_template', 'fields' => $fields,
            'values' => $values, 'errors' => $errors, 'non_field_error' => $non_field,
            'formsets' => [['prefix' => 'lines', 'title' => 'أطراف القيد', 'table' => 'journal_template_line',
                'fields' => $line_fields, 'rows' => $rows, 'empty' => $empty]]]);
    }

    public static function template_use($pk): string
    {
        $t = ERP_DB::get('journal_template', (int) $pk);
        if (!$t) {
            ERP_Router::error_page(404, 'النموذج غير موجود.');
        }
        $tlines = ERP_DB::rows('SELECT * FROM ' . ERP_DB::t('journal_template_line') . ' WHERE template_id=%d ORDER BY id',
            [(int) $t['id']]);
        $partners = ERP_UI::options('partner', 'active = 1', [], 'name', 'name');
        $projects = ERP_UI::code_name_options('project', "status <> 'closed'");
        $ccs = ERP_UI::code_name_options('cost_center', 'active = 1');
        $values = ['date' => ERP_UI::today(), 'memo' => $t['memo'], 'post_now' => '1'];
        $errors = [];
        $non_field = '';
        if (self::is_post()) {
            $values = array_map(function ($k) {
                return ERP_UI::post($k);
            }, array_combine(['date', 'amount', 'memo', 'reference', 'partner', 'project', 'cost_center', 'post_now'],
                ['date', 'amount', 'memo', 'reference', 'partner', 'project', 'cost_center', 'post_now']));
            if (!ERP_UI::valid_date($values['date'])) {
                $errors['date'] = $values['date'] === '' ? 'هذا الحقل مطلوب.' : 'أدخل تاريخاً صحيحاً.';
            }
            $amount = null;
            try {
                if ($values['amount'] === '') {
                    throw new ERP_Validation_Error('هذا الحقل مطلوب.');
                }
                $amount = ERP_Money::parse_input($values['amount'], 16, 2);
                if (ERP_Money::cmp($amount, '0.01') < 0) {
                    throw new ERP_Validation_Error('تأكد أن القيمة أكبر من أو تساوي 0.01.');
                }
            } catch (ERP_Validation_Error $e) {
                $errors['amount'] = $e->getMessage();
            }
            foreach (['memo' => 300, 'reference' => 100] as $k => $max) {
                if (mb_strlen($values[$k]) > $max) {
                    $errors[$k] = "تأكد أن عدد الحروف لا يزيد عن {$max}.";
                }
            }
            $sel = ['partner' => [$partners, (bool) (int) $t['ask_partner']], 'project' => [$projects, (bool) (int) $t['ask_project']],
                'cost_center' => [$ccs, false]];
            $picked = [];
            foreach ($sel as $k => [$opts, $req]) {
                $v = $values[$k];
                if ($v === '') {
                    if ($req) {
                        $errors[$k] = 'هذا الحقل مطلوب.';
                    }
                    $picked[$k] = null;
                } elseif (!ctype_digit($v) || !isset($opts[(int) $v])) {
                    $errors[$k] = 'اختر قيمة صحيحة. الاختيار غير متاح.';
                } else {
                    $picked[$k] = ['id' => (int) $v];
                }
            }
            if (!$errors) {
                $lines = [];
                foreach ($tlines as $tl) {
                    $amt = ERP_Money::pct_amount($amount, $tl['percent']);
                    $lines[] = ['account' => ERP_Accounts::get($tl['account_id']),
                        'debit' => $tl['side'] === 'debit' ? $amt : '0', 'credit' => $tl['side'] === 'credit' ? $amt : '0',
                        'label' => $tl['label'] !== '' ? $tl['label'] : $values['memo'],
                        'partner' => (int) $tl['use_partner'] ? $picked['partner'] : null,
                        'project' => (int) $tl['use_project'] ? $picked['project'] : null,
                        'cost_center' => $tl['side'] === 'debit' ? $picked['cost_center'] : null];
                }
                try {
                    $id = ERP_Posting::create_entry($values['date'], $values['memo'] !== '' ? $values['memo'] : $t['name'], $lines,
                        'manual', $values['reference'], '', $values['post_now'] !== '');
                    $num = ERP_DB::value('SELECT number FROM ' . ERP_DB::t('journal_entry') . ' WHERE id=%d', [$id]);
                    ERP_UI::flash('success', "تم إنشاء القيد {$num} من النموذج «{$t['name']}»");
                    ERP_Router::redirect("/journal/{$id}/");
                } catch (ERP_Validation_Error $e) {
                    $non_field = $e->getMessage();
                }
            }
        }
        $preview = [];
        foreach ($tlines as $tl) {
            $preview[] = $tl + ['astr' => ERP_Accounts::str(ERP_Accounts::get($tl['account_id']))];
        }
        return self::page('template_use', ['title' => 'قيد جاهز: ' . $t['name'], 't' => $t, 'tlines' => $preview,
            'values' => $values, 'errors' => $errors, 'non_field_error' => $non_field, 'partners' => $partners,
            'projects' => $projects, 'ccs' => $ccs]);
    }

    // ================================================================== الإعدادات
    public static function settings(): string
    {
        $company = ERP_Company::get();
        $fields = ['name' => [], 'legal_name' => [], 'tax_id' => [], 'commercial_reg' => [], 'address' => [], 'phone' => [],
            'email' => [], 'currency' => [], 'currency_name' => [], 'currency_sub' => [], 'fiscal_year_start' => [], 'lock_date' => []];
        $values = self::display_values('company', $company, $fields);
        $errors = [];
        if (self::is_post()) {
            $values = self::raw_post_values($fields);
            [$clean, $errors] = ERP_UI::clean_form('company', $fields);
            if (!$errors) {
                ERP_DB::transaction(function () use ($company, $clean) {
                    ERP_DB::update('company', (int) $company['id'], $clean);
                    ERP_Audit::log('update', 'company', $company['id'], $company, ERP_DB::get('company', $company['id']),
                        'تعديل بيانات الشركة / تاريخ الإقفال');
                });
                ERP_UI::flash('success', 'تم حفظ الإعدادات');
                ERP_Router::redirect('/settings/');
            }
        }
        return self::page('settings', ['title' => 'الإعدادات', 'fields' => $fields, 'values' => $values, 'errors' => $errors]);
    }

    public static function mapping(): string
    {
        $roles = ERP_Mapping::roles();
        $accs = ERP_UI::account_options();
        $current = [];
        foreach (ERP_DB::rows('SELECT role, account_id FROM ' . ERP_DB::t('account_mapping')) as $m) {
            $current[$m['role']] = $m['account_id'];
        }
        $errors = [];
        if (self::is_post()) {
            $new = [];
            foreach ($roles as $role => $label) {
                $v = ERP_UI::post($role);
                if ($v !== '' && (!ctype_digit($v) || !isset($accs[(int) $v]))) {
                    $errors[$role] = 'اختر قيمة صحيحة. الاختيار غير متاح.';
                }
                $new[$role] = $v === '' ? null : (int) $v;
            }
            if (!$errors) {
                ERP_DB::transaction(function () use ($new, $current) {
                    $t = ERP_DB::t('account_mapping');
                    foreach ($new as $role => $acc) {
                        if ($acc) {
                            ERP_DB::query("INSERT INTO {$t} (role, account_id) VALUES (%s, %d) ON DUPLICATE KEY UPDATE account_id = %d",
                                [$role, $acc, $acc]);
                        } else {
                            ERP_DB::query("DELETE FROM {$t} WHERE role = %s", [$role]);
                        }
                    }
                    ERP_Audit::log('update', 'account_mapping', null, $current, $new, 'تعديل التوجيه المحاسبي');
                });
                ERP_UI::flash('success', 'تم حفظ التوجيه المحاسبي');
                ERP_Router::redirect('/settings/mapping/');
            }
            $current = array_filter($new);
        }
        return self::page('mapping', ['title' => 'التوجيه المحاسبي للقيود الآلية', 'roles' => $roles, 'accs' => $accs,
            'current' => $current, 'errors' => $errors]);
    }

    public static function year_close(): string
    {
        $y = (int) substr(ERP_UI::today(), 0, 4) - 1;
        $values = ['date_from' => "{$y}-01-01", 'date_to' => "{$y}-12-31", 'lock' => '1'];
        $errors = [];
        $non_field = '';
        if (self::is_post()) {
            $values = ['date_from' => ERP_UI::post('date_from'), 'date_to' => ERP_UI::post('date_to'), 'lock' => ERP_UI::post('lock')];
            foreach (['date_from', 'date_to'] as $k) {
                if (!ERP_UI::valid_date($values[$k])) {
                    $errors[$k] = $values[$k] === '' ? 'هذا الحقل مطلوب.' : 'أدخل تاريخاً صحيحاً.';
                }
            }
            if (!$errors) {
                try {
                    $id = ERP_DB::transaction(function () use ($values) {
                        $re = ERP_Mapping::get('retained_earnings');
                        $lines = [];
                        $net = '0';
                        $args = [$values['date_from'], $values['date_to']];
                        foreach (ERP_DB::rows('SELECT l.account_id, SUM(l.debit) d, SUM(l.credit) c FROM ' . ERP_DB::t('journal_line')
                            . ' l JOIN ' . ERP_DB::t('journal_entry') . ' e ON e.id=l.entry_id JOIN ' . ERP_DB::t('account')
                            . " a ON a.id=l.account_id WHERE e.state='posted' AND e.date >= %s AND e.date <= %s "
                            . "AND a.type IN ('income','expense') GROUP BY l.account_id ORDER BY l.account_id", $args) as $r) {
                            $bal = ERP_Money::sub($r['d'], $r['c']);
                            if (!ERP_Money::is_zero($bal)) {
                                $lines[] = ['account' => ERP_Accounts::get($r['account_id']), 'debit' => ERP_Money::max(ERP_Money::neg($bal), '0'),
                                    'credit' => ERP_Money::max($bal, '0'), 'label' => 'إقفال الحساب'];
                                $net = ERP_Money::add($net, $bal);
                            }
                        }
                        $lines[] = ['account' => $re, 'debit' => ERP_Money::max($net, '0'), 'credit' => ERP_Money::max(ERP_Money::neg($net), '0'),
                            'label' => 'صافي نتيجة الفترة'];
                        $id = ERP_Posting::create_entry($values['date_to'],
                            "قيد إقفال الحسابات الختامية {$values['date_from']} - {$values['date_to']}", $lines, 'closing');
                        if ($values['lock'] !== '') {
                            $c = ERP_Company::get();
                            ERP_DB::update('company', (int) $c['id'], ['lock_date' => $values['date_to']]);
                            ERP_Audit::log('update', 'company', $c['id'], ['lock_date' => $c['lock_date']],
                                ['lock_date' => $values['date_to']], 'إقفال الفترة حتى ' . $values['date_to']);
                        }
                        return $id;
                    });
                    $num = ERP_DB::value('SELECT number FROM ' . ERP_DB::t('journal_entry') . ' WHERE id=%d', [$id]);
                    ERP_UI::flash('success', "تم إنشاء قيد الإقفال {$num}");
                    ERP_Router::redirect("/journal/{$id}/");
                } catch (ERP_Validation_Error $e) {
                    $non_field = $e->getMessage();
                }
            }
        }
        return self::page('year_close', ['title' => 'إقفال السنة المالية', 'values' => $values, 'errors' => $errors,
            'non_field_error' => $non_field]);
    }

    public static function backup(): array
    {
        $json = wp_json_encode(ERP_Backup::export(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        return ['download' => ['type' => 'application/json; charset=utf-8',
            'name' => 'erp-backup-' . current_time('Ymd-Hi') . '.json', 'body' => $json]];
    }

    /** إدارة النظام: التهيئة، المسح، الاسترجاع (أزرار محمية للمدير فقط). */
    public static function system(): string
    {
        if (self::is_post()) {
            $op = ERP_UI::post('op');
            try {
                if ($op === 'setup') {
                    ERP_Seed::setup_company();
                    ERP_UI::flash('success', 'تمت تهيئة النظام بنجاح');
                } elseif ($op === 'reset') {
                    if (ERP_UI::post('confirm') !== 'نعم') {
                        throw new ERP_Validation_Error('للتأكيد اكتب كلمة «نعم» في خانة التأكيد.');
                    }
                    ERP_Seed::reset_data();
                    ERP_UI::flash('success', 'تم مسح البيانات — البرنامج جاهز للبدء من الصفر');
                } elseif ($op === 'restore') {
                    $file = $_FILES['backup_file'] ?? null; // phpcs:ignore — يُتحقق منه بالكامل أدناه
                    if (!$file || !is_uploaded_file($file['tmp_name']) || (int) $file['error'] !== UPLOAD_ERR_OK) {
                        throw new ERP_Validation_Error('اختر ملف النسخة الاحتياطية.');
                    }
                    if ((int) $file['size'] > 50 * 1024 * 1024) {
                        throw new ERP_Validation_Error('حجم الملف أكبر من 50 ميجابايت.');
                    }
                    if (strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION)) !== 'json') {
                        throw new ERP_Validation_Error('يُقبل ملف JSON فقط.');
                    }
                    $counts = ERP_Backup::restore((string) file_get_contents($file['tmp_name']));
                    ERP_UI::flash('success', 'تم الاسترجاع بنجاح: ' . array_sum($counts) . ' سجل');
                }
            } catch (ERP_Validation_Error $e) {
                ERP_UI::flash('danger', $e->getMessage());
            }
            ERP_Router::redirect('/settings/system/');
        }
        return self::page('system', ['title' => 'إدارة النظام', 'empty' => ERP_Seed::is_empty(),
            'accounts' => (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('account')),
            'entries' => (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('journal_entry')),
            'errors_count' => (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('error_log'))]);
    }

    public static function audit_log(): string
    {
        $actions = ['create' => 'إنشاء', 'update' => 'تعديل', 'delete' => 'حذف', 'post' => 'ترحيل', 'unpost' => 'إلغاء ترحيل',
            'setup' => 'تهيئة', 'reset' => 'مسح البيانات', 'restore' => 'استرجاع', 'backup' => 'نسخة احتياطية'];
        return self::render_list([
            'title' => 'سجل التدقيق (للقراءة فقط)', 'table' => 'audit_log', 'icon' => 'bi-shield-check', 'order' => 't.id DESC',
            'search' => ['t.user_login', 't.summary', 't.table_name'],
            'filters' => [['action', 'العملية', $actions, function (&$w, &$a, $v) {
                $w[] = 't.action = %s';
                $a[] = $v;
            }]],
            'columns' => [
                ['الوقت', function ($r) { return erp_e(get_date_from_gmt(substr($r['created_at'], 0, 19), 'Y/m/d H:i:s')); }],
                ['المستخدم', function ($r) { return erp_e($r['user_login']); }],
                ['العملية', function ($r) use ($actions) { return erp_e($actions[$r['action']] ?? $r['action']); }],
                ['الجدول', function ($r) { return erp_e(ERP_DB::meta()[$r['table_name']]['verbose'] ?? $r['table_name']); }],
                ['السجل', function ($r) { return erp_e($r['record_id']); }],
                ['البيان', function ($r) { return erp_e($r['summary']); }],
                ['قبل / بعد', function ($r) {
                    if (!$r['before_data'] && !$r['after_data']) {
                        return '';
                    }
                    return '<details><summary class="small">عرض</summary><pre class="small mb-0" style="white-space:pre-wrap;max-width:420px">'
                        . erp_e($r['before_data']) . "\n→\n" . erp_e($r['after_data']) . '</pre></details>';
                }],
                ['IP', function ($r) { return erp_e($r['ip']); }],
            ],
        ]);
    }

    // ================================================================== التقارير
    public static function reports_index(): string
    {
        return self::page('reports/index', ['title' => 'التقارير']);
    }

    private static function filter_options(): array
    {
        return ['projects' => ERP_UI::code_name_options('project'), 'cost_centers' => ERP_UI::code_name_options('cost_center')];
    }

    private static function common_filters(): array
    {
        $f = [];
        foreach (['project' => 'project_id', 'cost_center' => 'cost_center_id'] as $k => $col) {
            $v = ERP_UI::get($k);
            if ($v !== '' && ctype_digit($v)) {
                $f[$col] = (int) $v;
            }
        }
        return $f;
    }

    public static function trial_balance(): string
    {
        [$df, $dt] = ERP_Reports::default_period();
        $date_from = ERP_UI::date_param('date_from', $df);
        $date_to = ERP_UI::date_param('date_to', $dt);
        $level = ERP_UI::get('level', 'all');
        if (!in_array($level, ['all', '', '0', '1', '2', '3'], true)) {
            $level = 'all';
        }
        $tb = ERP_Reports::trial_balance($date_from, $date_to, $level, ERP_UI::get('zero') === '1', self::common_filters());
        return self::page('reports/trial_balance', ['title' => 'ميزان المراجعة'] + $tb + self::filter_options());
    }

    public static function ledger(): string
    {
        [$df, $dt] = ERP_Reports::default_period();
        $ctx = ['title' => 'دفتر الأستاذ / كشف حساب', 'date_from' => ERP_UI::date_param('date_from', $df),
            'date_to' => ERP_UI::date_param('date_to', $dt), 'accounts' => ERP_UI::options('account', '1=1', [], function ($a) {
                return ERP_Accounts::str($a);
            }, 'code'), 'partners' => ERP_UI::options('partner', '1=1', [], 'name', 'name'), 'account' => null] + self::filter_options();
        $aid = ERP_UI::get('account');
        if ($aid !== '' && ctype_digit($aid)) {
            if (!ERP_DB::get('account', (int) $aid)) {
                ERP_Router::error_page(404, 'الحساب غير موجود.');
            }
            $f = self::common_filters();
            $pid = ERP_UI::get('partner');
            if ($pid !== '' && ctype_digit($pid)) {
                $f['partner_id'] = (int) $pid;
            }
            $ctx = ERP_Reports::ledger((int) $aid, $ctx['date_from'], $ctx['date_to'], $f) + $ctx;
        }
        return self::page('reports/ledger', $ctx);
    }

    /** partner_statement(): حسابات الجهة الأساسية + الدفعات المقدمة والمحتجزات (أو كل الحسابات). */
    public static function partner_statement($pk = null): string
    {
        [$df, $dt] = ERP_Reports::default_period();
        $date_from = ERP_UI::date_param('date_from', $df);
        $date_to = ERP_UI::date_param('date_to', $dt);
        $pk = $pk ?: ERP_UI::get('partner');
        $ctx = ['title' => 'كشف حساب عميل / مورد', 'partners' => ERP_DB::rows('SELECT * FROM ' . ERP_DB::t('partner') . ' ORDER BY name'),
            'date_from' => $date_from, 'date_to' => $date_to, 'partner' => null];
        if ($pk && ctype_digit((string) $pk)) {
            $partner = ERP_DB::get('partner', (int) $pk);
            if (!$partner) {
                ERP_Router::error_page(404, 'جهة التعامل غير موجودة.');
            }
            $acc_ids = [];
            foreach (['ar_account', 'ap_account'] as $getter) {
                try {
                    $acc_ids[] = (int) ERP_Partners::$getter($partner)['id'];
                } catch (ERP_Validation_Error $e) {
                    // مثل الأصل: يتجاهل الأدوار غير المحددة
                }
            }
            foreach (['customer_advance', 'supplier_advance', 'retention_receivable', 'retention_payable'] as $role) {
                $m = ERP_Mapping::find($role);
                if ($m) {
                    $acc_ids[] = (int) $m['id'];
                }
            }
            $all = ERP_UI::get('all_accounts') === '1';
            $f = ['partner_id' => (int) $partner['id']];
            if (!$all) {
                $f['account_ids'] = array_values(array_unique($acc_ids));
            }
            $before = gmdate('Y-m-d', strtotime($date_from . ' -1 day UTC'));
            [$bd, $bc] = ERP_Reports::totals(null, $before, $f);
            $opening = ERP_Money::sub($bd, $bc);
            $led = ERP_Reports::ledger_lines($date_from, $date_to, $f, $opening);
            $by_account = ERP_Reports::by_account(null, $date_to, $f);
            $ctx = array_merge($ctx, ['partner' => $partner, 'opening' => $opening, 'all_accounts' => $all,
                'by_account' => $by_account], $led);
        }
        return self::page('reports/partner_statement', $ctx);
    }
}

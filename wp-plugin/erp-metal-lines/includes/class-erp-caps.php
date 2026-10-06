<?php
/**
 * الصلاحيات والأدوار.
 *
 * ملاحظة مطابقة: البرنامج الأصلي لا يحتوي على نظام صلاحيات تفصيلي — أي مستخدم مسجّل يستطيع كل شيء،
 * والمدير (superuser) وحده يدخل لوحة إدارة المستخدمين. التقسيم التالي إضافة مقترحة تحتاج اعتماداً كتابياً.
 */
defined('ABSPATH') || exit;

final class ERP_Caps
{
    /** cap => الوصف */
    public static function caps(): array
    {
        return [
            'erp_access' => 'الدخول للبرنامج ولوحة التحكم',
            'erp_view_reports' => 'عرض التقارير',
            'erp_manage_accounts' => 'شجرة الحسابات ومراكز التكلفة والضرائب',
            'erp_manage_partners' => 'العملاء والموردون ومقاولو الباطن',
            'erp_edit_entries' => 'إنشاء وتعديل المستندات والقيود (مسودات)',
            'erp_post_entries' => 'ترحيل / إلغاء ترحيل / القيد العكسي',
            'erp_manage_settings' => 'الإعدادات والتوجيه المحاسبي وإقفال الفترات',
            'erp_admin' => 'إدارة النظام: النسخ الاحتياطي والاسترجاع والتهيئة والمسح وسجل التدقيق',
        ];
    }

    /** الأدوار المقترحة. */
    public static function roles(): array
    {
        $all = array_keys(self::caps());
        return [
            'erp_manager' => ['مدير النظام المحاسبي', $all],
            'erp_accountant' => ['محاسب', ['erp_access', 'erp_view_reports', 'erp_manage_partners', 'erp_edit_entries',
                'erp_post_entries']],
            'erp_data_entry' => ['مدخل بيانات', ['erp_access', 'erp_manage_partners', 'erp_edit_entries']],
            'erp_viewer' => ['مراجع (عرض فقط)', ['erp_access', 'erp_view_reports']],
        ];
    }

    public static function install(): void
    {
        foreach (self::roles() as $role => [$label, $caps]) {
            remove_role($role);
            add_role($role, $label, array_fill_keys($caps, true) + ['read' => true]);
        }
        $admin = get_role('administrator');
        if ($admin) {
            foreach (array_keys(self::caps()) as $cap) {
                $admin->add_cap($cap);
            }
        }
    }

    public static function uninstall(): void
    {
        foreach (array_keys(self::roles()) as $role) {
            remove_role($role);
        }
        $admin = get_role('administrator');
        if ($admin) {
            foreach (array_keys(self::caps()) as $cap) {
                $admin->remove_cap($cap);
            }
        }
    }
}

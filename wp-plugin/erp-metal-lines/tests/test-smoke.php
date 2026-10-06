<?php
class Test_Smoke extends ERP_TestCase
{
    public function test_schema_installed_with_foreign_keys(): void
    {
        $this->assertSame([], ERP_Schema::missing_tables());
        $this->assertSame([], ERP_Schema::missing_foreign_keys());
        $this->setup_company();
        $this->assertSame(113, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('account')));
        $this->assertSame(17, (int) ERP_DB::value('SELECT COUNT(*) FROM ' . ERP_DB::t('journal_template')));
    }
}

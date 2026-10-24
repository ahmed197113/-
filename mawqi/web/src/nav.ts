export interface NavItem { path: string; label: string; icon: string; perm?: string }

export const NAV: NavItem[] = [
  { path: '/', label: 'لوحة التحكم', icon: 'dashboard' },
  { path: '/projects', label: 'المشاريع', icon: 'projects' },
  { path: '/workers', label: 'العمال', icon: 'workers' },
  { path: '/attendance', label: 'الحضور والغياب', icon: 'attendance' },
  { path: '/daily-reports', label: 'التقرير اليومي', icon: 'report' },
  { path: '/issues', label: 'المشاكل والبلاغات', icon: 'issues' },
  { path: '/invoices', label: 'المستخلصات', icon: 'contracts' },
  { path: '/direct-orders', label: 'الإسناد المباشر', icon: 'assign' },
  { path: '/reports', label: 'التقارير والتصدير', icon: 'exports' },
  { path: '/settings', label: 'الإعدادات', icon: 'settings' },
]

export interface NavItem { path: string; label: string; icon: string; ready: boolean }

export const NAV: NavItem[] = [
  { path: '/', label: 'لوحة التحكم', icon: 'dashboard', ready: true },
  { path: '/projects', label: 'المشاريع', icon: 'projects', ready: false },
  { path: '/workers', label: 'العمال', icon: 'workers', ready: false },
  { path: '/attendance', label: 'الحضور والغياب', icon: 'attendance', ready: false },
  { path: '/daily-reports', label: 'التقرير اليومي', icon: 'report', ready: false },
  { path: '/issues', label: 'المشاكل والبلاغات', icon: 'issues', ready: false },
  { path: '/invoices', label: 'المستخلصات', icon: 'contracts', ready: false },
  { path: '/direct-orders', label: 'الإسناد المباشر', icon: 'assign', ready: false },
  { path: '/reports', label: 'التقارير والتصدير', icon: 'exports', ready: false },
]

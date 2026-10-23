'use strict';
// سياسة الصلاحيات — تُطبَّق في الخادم على كل طلب
const { HttpError } = require('./util');

const ROLES = {
  gm: 'مدير عام',
  pm: 'مدير مشروع',
  supervisor: 'مشرف موقع',
  accountant: 'محاسب / إدارة مالية',
  owner: 'المالك',
};

// الأدوار المسموح لها بكل إجراء
const POLICY = {
  'users.manage': ['gm', 'owner'],
  'settings.manage': ['gm', 'owner'],
  'projects.create': ['gm', 'owner'],
  'projects.edit': ['gm', 'owner', 'pm'],
  'workers.manage': ['gm', 'owner', 'pm'],
  'workers.transfer': ['gm', 'owner', 'pm'],
  'attendance.record': ['gm', 'pm', 'supervisor'],
  'reports.create': ['gm', 'pm', 'supervisor'],
  'issues.create': ['gm', 'pm', 'supervisor'],
  'issues.manage': ['gm', 'owner', 'pm'],
  'costs.view': ['gm', 'owner', 'pm', 'accountant'],
  'payroll.view': ['gm', 'owner', 'accountant'],
  'invoices.view': ['gm', 'owner', 'pm', 'accountant'],
  'invoices.edit': ['gm', 'owner', 'pm', 'accountant'],
  'invoices.approve': ['gm', 'owner'],
  // الصرف: للإدارة المالية والمالك فقط
  'invoices.pay': ['accountant', 'owner'],
};

function can(user, action) {
  const roles = POLICY[action];
  if (!roles) throw new Error(`Unknown action ${action}`);
  return !!user && roles.includes(user.role);
}

function require_(action) {
  return (req, res, next) => {
    if (!can(req.user, action)) return next(new HttpError(403, 'ليست لديك صلاحية لهذا الإجراء'));
    next();
  };
}

const SEES_ALL = ['gm', 'owner', 'accountant'];

// شرط SQL لتقييد المشاريع المرئية للمستخدم. alias: اسم جدول المشاريع في الاستعلام
function projectScope(user, alias = 'p') {
  if (SEES_ALL.includes(user.role)) return { sql: '1=1', params: [] };
  if (user.role === 'pm') return { sql: `${alias}.manager_id = ?`, params: [user.id] };
  if (user.role === 'supervisor') return { sql: `${alias}.supervisor_id = ?`, params: [user.id] };
  return { sql: '0=1', params: [] };
}

function visibleProjectIds(db, user) {
  const s = projectScope(user);
  return db.prepare(`SELECT id FROM projects p WHERE ${s.sql}`).all(...s.params).map((r) => r.id);
}

function canAccessProject(db, user, projectId) {
  const s = projectScope(user);
  return !!db.prepare(`SELECT 1 FROM projects p WHERE p.id = ? AND ${s.sql}`).get(Number(projectId), ...s.params);
}

function assertProject(db, user, projectId) {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(projectId));
  if (!p) throw new HttpError(404, 'المشروع غير موجود');
  if (!canAccessProject(db, user, p.id)) throw new HttpError(403, 'لا تملك صلاحية على هذا المشروع');
  return p;
}

function assertCan(user, action) {
  if (!can(user, action)) throw new HttpError(403, 'ليست لديك صلاحية لهذا الإجراء');
}

module.exports = { ROLES, POLICY, can, require: require_, assertCan, projectScope, visibleProjectIds, canAccessProject, assertProject };

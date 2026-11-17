/**
 * Frontend role utilities — mirrors server/config/roles.js
 * Single source of truth for role checks in the UI.
 */

export const ROLES = {
  SUPERADMIN:    'superadmin',
  ADMIN:         'admin',
  ADMIN2:        'admin2',
  TEACHER:       'teacher',
  PARENT:        'parent',
  FEE_COLLECTOR: 'fee_collector',
};

// Named permission groups matching backend
export const PERMISSIONS = {
  SUPER_ADMIN:                ['admin', 'superadmin', 'super_admin'],
  ADMIN_ANY:                  ['admin', 'admin2', 'superadmin', 'super_admin'],
  VIEW_STUDENTS:              ['admin', 'admin2', 'teacher', 'fee_collector', 'superadmin', 'super_admin'],
  MANAGE_STUDENTS:            ['admin', 'admin2', 'superadmin', 'super_admin'],
  VIEW_TEACHERS:              ['admin', 'admin2', 'superadmin', 'super_admin'],
  MANAGE_TEACHERS:            ['admin', 'superadmin', 'super_admin'],
  MANAGE_STUDENT_ATTENDANCE:  ['admin', 'admin2', 'teacher', 'superadmin', 'super_admin'],
  MANAGE_TEACHER_ATTENDANCE:  ['admin', 'admin2', 'superadmin', 'super_admin'],
  ASSIGN_INCHARGE:            ['admin', 'admin2', 'superadmin', 'super_admin'],
  MANAGE_FEES:                ['admin', 'admin2', 'fee_collector', 'superadmin', 'super_admin'],
  COLLECT_FEES:               ['admin', 'admin2', 'fee_collector', 'superadmin', 'super_admin'],
  ENTER_MARKS:                ['admin', 'admin2', 'teacher', 'superadmin', 'super_admin'],
  INCHARGE_REVIEW:            ['admin', 'admin2', 'teacher', 'superadmin', 'super_admin'],
  ADMIN2_REVIEW_RESULTS:      ['admin', 'admin2', 'superadmin', 'super_admin'],
  PUBLISH_RESULTS:            ['admin', 'superadmin', 'super_admin'],
  SEND_NOTIFICATIONS:         ['admin', 'admin2', 'superadmin', 'super_admin'],
  MANAGE_SESSIONS:            ['admin', 'superadmin', 'super_admin'],
  SUBMIT_ADMISSION:           ['admin', 'admin2', 'fee_collector', 'superadmin', 'super_admin'],
  REVIEW_ADMISSION:           ['admin', 'admin2', 'superadmin', 'super_admin'],
};

/**
 * Check if a user has a specific named permission.
 * @param {object} user - user object with .role property
 * @param {string} permissionKey - key from PERMISSIONS
 */
export const can = (user, permissionKey) => {
  if (!user?.role) return false;
  const role = (user.role || '').toLowerCase().trim();
  const effectiveRole = ['superadmin', 'super_admin', 'super-admin'].includes(role) ? 'admin' : role;
  const allowed = PERMISSIONS[permissionKey];
  if (!allowed) {
    console.warn(`[RBAC] Unknown permission key: "${permissionKey}"`);
    return false;
  }
  return allowed.includes(role) || allowed.includes(effectiveRole);
};

/**
 * Check if user has any of the given roles.
 * Replaces: user.role === 'admin'
 * With:     hasRole(user, 'admin', 'admin2')
 */
export const hasRole = (user, ...roles) => {
  if (!user?.role) return false;
  const role = (user.role || '').toLowerCase().trim();
  const effectiveRole = ['superadmin', 'super_admin', 'super-admin'].includes(role) ? 'admin' : role;
  const allowed = roles.map(r => (r || '').toLowerCase().trim());
  if (allowed.includes('admin')) {
    allowed.push('superadmin', 'super_admin', 'super-admin');
  }
  return allowed.includes(role) || allowed.includes(effectiveRole);
};

/**
 * Convenience shorthands
 */
export const isAdmin      = (user) => hasRole(user, 'admin', 'admin2');
export const isSuperAdmin = (user) => hasRole(user, 'admin');
export const isTeacher    = (user) => hasRole(user, 'teacher');
export const isParent     = (user) => hasRole(user, 'parent');
export const isFinance    = (user) => hasRole(user, 'admin', 'admin2', 'fee_collector');
export const isStaff      = (user) => hasRole(user, 'admin', 'admin2', 'teacher');

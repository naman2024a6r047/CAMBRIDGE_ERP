/**
 * ROLE HIERARCHY & PERMISSION SYSTEM
 *
 * Instead of hardcoding role checks everywhere, define permissions centrally.
 * This makes it trivial to add new roles or change permissions in one place.
 */

// All valid roles in the system
const ROLES = {
  SUPERADMIN:    'superadmin',
  ADMIN:         'admin',
  ADMIN2:        'admin2',
  TEACHER:       'teacher',
  STUDENT:       'student',
  PARENT:        'parent',
  FEE_COLLECTOR: 'fee_collector',
};

/**
 * Role hierarchy levels.
 * Higher number = more permissions.
 * Used by hasMinimumRole() to allow "at least this level" checks.
 */
const ROLE_LEVELS = {
  parent:        1,
  student:       1,
  fee_collector: 2,
  teacher:       3,
  admin2:        4,
  admin:         5,
  superadmin:    5,
  super_admin:   5,
};

/**
 * Permission groups — named sets of roles that share access to a feature.
 * Use these in middleware instead of hardcoding role arrays everywhere.
 */
const PERMISSIONS = {
  // Full admin access — only super admin
  SUPER_ADMIN: ['admin', 'superadmin', 'super_admin'],

  // Admin-level access (both admin types)
  ADMIN_ANY: ['admin', 'admin2', 'superadmin', 'super_admin'],

  // Can view students and their data
  VIEW_STUDENTS: ['admin', 'admin2', 'teacher', 'fee_collector', 'superadmin', 'super_admin'],

  // Can manage students (CRUD)
  MANAGE_STUDENTS: ['admin', 'admin2', 'superadmin', 'super_admin'],

  // Can view teachers
  VIEW_TEACHERS: ['admin', 'admin2', 'teacher', 'superadmin', 'super_admin'],

  // Can manage teachers (CRUD)
  MANAGE_TEACHERS: ['admin', 'superadmin', 'super_admin'],

  // Can mark / view student attendance
  MANAGE_STUDENT_ATTENDANCE: ['admin', 'admin2', 'teacher', 'superadmin', 'super_admin'],

  // Can mark / view teacher attendance
  MANAGE_TEACHER_ATTENDANCE: ['admin', 'admin2', 'superadmin', 'super_admin'],

  // Can view teacher attendance (teacher sees own only — handled in controller)
  VIEW_TEACHER_ATTENDANCE: ['admin', 'admin2', 'teacher', 'superadmin', 'super_admin'],

  // Can assign class incharge
  ASSIGN_INCHARGE: ['admin', 'admin2', 'superadmin', 'super_admin'],

  // Can manage fees
  MANAGE_FEES: ['admin', 'admin2', 'fee_collector', 'superadmin', 'super_admin'],

  // Can collect fees
  COLLECT_FEES: ['admin', 'admin2', 'fee_collector', 'superadmin', 'super_admin'],

  // Can enter marks (teacher restricted to own class+subject in controller)
  ENTER_MARKS: ['admin', 'admin2', 'teacher', 'superadmin', 'super_admin'],

  // Can view results
  VIEW_RESULTS: ['admin', 'admin2', 'teacher', 'parent', 'student', 'superadmin', 'super_admin'],

  // Result workflow
  SUBMIT_RESULTS:          ['admin', 'admin2', 'teacher', 'superadmin', 'super_admin'],
  INCHARGE_REVIEW:         ['admin', 'admin2', 'teacher', 'superadmin', 'super_admin'],  // teacher only if incharge
  ADMIN2_REVIEW_RESULTS:   ['admin', 'admin2', 'superadmin', 'super_admin'],
  PUBLISH_RESULTS:         ['admin', 'superadmin', 'super_admin'],

  // Notifications
  SEND_NOTIFICATIONS: ['admin', 'admin2', 'superadmin', 'super_admin'],

  // Session & promotion
  MANAGE_SESSIONS: ['admin', 'superadmin', 'super_admin'],

  // Admission requests
  SUBMIT_ADMISSION:  ['admin', 'admin2', 'fee_collector', 'superadmin', 'super_admin'],
  REVIEW_ADMISSION:  ['admin', 'admin2', 'superadmin', 'super_admin'],

  // Timetable
  MANAGE_TIMETABLE: ['admin', 'admin2', 'superadmin', 'super_admin'],
  VIEW_TIMETABLE:   ['admin', 'admin2', 'teacher', 'parent', 'student', 'superadmin', 'super_admin'],
};

const CLASSES = [
  'Nursery',
  'Lower KG',
  'Upper KG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
];

module.exports = { ROLES, ROLE_LEVELS, PERMISSIONS, CLASSES };

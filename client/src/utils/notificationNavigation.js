/**
 * Intelligent Notification Navigation Resolver
 * Resolves the destination route and CTA button label based on notification metadata,
 * subcategory, title/message contents, and the user's current role.
 */

export function getNotificationDestination(notif, userRole = '') {
  if (!notif) return { url: '', label: 'View Details' };

  // 1. If explicit link is provided in the notification record
  if (notif.link && typeof notif.link === 'string' && notif.link.trim()) {
    const rawLink = notif.link.trim();
    return {
      url: rawLink,
      label: notif.link_label || 'Open Section',
    };
  }

  const role = (userRole || '').toLowerCase();
  const type = (notif.type || '').toLowerCase();
  const subCategory = (notif.sub_category || '').toLowerCase();
  const title = (notif.title || '').toLowerCase();
  const message = (notif.message || '').toLowerCase();
  const text = `${title} ${message} ${subCategory} ${type}`;

  const has = (...keywords) => keywords.some(k => text.includes(k));

  // --- A. Datesheet / Exams ---
  if (type === 'exam_datesheet' || has('datesheet', 'date sheet', 'exam schedule', 'examination schedule', 'term exam', 'half yearly exam', 'final exam')) {
    if (role === 'admin') return { url: '/admin/datesheets', label: 'Open Datesheets' };
    if (role === 'admin2') return { url: '/admin2/datesheets', label: 'Open Datesheets' };
    if (role === 'teacher') return { url: '/teacher/datesheet', label: 'View Class Datesheet' };
    if (role === 'parent' || role === 'student') return { url: '/parent/exams', label: 'View Exam Datesheet' };
    return { url: '/fc/events', label: 'View Calendar & Events' };
  }

  // --- B. Results / Marks / Report Card ---
  if (type === 'result' || has('result', 'marksheet', 'report card', 'grade card', 'marks uploaded', 'performance report', 'term marks')) {
    if (role === 'admin') return { url: '/admin/student-performance', label: 'View Results & Performance' };
    if (role === 'admin2') return { url: '/admin2/results', label: 'Review & Approve Results' };
    if (role === 'teacher') return { url: '/teacher/marks', label: 'Enter & Review Marks' };
    if (role === 'parent' || role === 'student') return { url: '/parent/report-card', label: 'View Report Card' };
    return { url: '/fc', label: 'Open Portal' };
  }

  // --- C. Fees / Dues / Payments ---
  if (type === 'fee_reminder' || has('fee', 'dues', 'installment', 'tuition', 'receipt', 'late fee', 'overdue fee', 'challan')) {
    if (role === 'admin') return { url: '/admin/fees', label: 'Manage Student Fees' };
    if (role === 'admin2') return { url: '/admin2', label: 'Open Dashboard' };
    if (role === 'fee_collector') return { url: '/fc/collect', label: 'Collect Student Fees' };
    if (role === 'parent' || role === 'student') return { url: '/parent/fees', label: 'View & Pay Fees' };
    return { url: '/teacher', label: 'Open Dashboard' };
  }

  // --- D. Attendance ---
  if (type === 'attendance_alert' || has('attendance', 'absent', 'leave mark', 'present', 'half day', 'attendance short')) {
    if (role === 'admin') return { url: '/admin/attendance', label: 'View Attendance Records' };
    if (role === 'admin2') return { url: '/admin2/teachers', label: 'Teacher Attendance' };
    if (role === 'teacher') return { url: '/teacher/attendance', label: 'Mark Class Attendance' };
    if (role === 'parent' || role === 'student') return { url: '/parent/attendance', label: 'Check Attendance Log' };
    return { url: '/fc', label: 'Open Portal' };
  }

  // --- E. Admissions ---
  if (has('admission', 'application form', 'enrolment', 'registered student', 'applicant', 'new student admission')) {
    if (role === 'admin') return { url: '/admin/admissions', label: 'Review Admissions' };
    if (role === 'admin2') return { url: '/admin2/admissions', label: 'Review Admissions' };
    if (role === 'fee_collector') return { url: '/fc/admissions', label: 'View Admissions Log' };
    if (role === 'parent' || role === 'student') return { url: '/admission', label: 'Go to Admission Portal' };
    return { url: '/teacher', label: 'Open Dashboard' };
  }

  // --- F. Timetable / Schedule ---
  if (has('timetable', 'time-table', 'period', 'class routine', 'lecture schedule')) {
    if (role === 'admin') return { url: '/admin/timetable', label: 'View Timetable' };
    if (role === 'admin2') return { url: '/admin2/timetable', label: 'View Timetable' };
    if (role === 'teacher') return { url: '/teacher/timetable', label: 'View Teaching Timetable' };
    if (role === 'parent' || role === 'student') return { url: '/parent/timetable', label: 'View Class Timetable' };
    return { url: '/fc', label: 'Open Portal' };
  }

  // --- G. Achievements / Awards ---
  if (type === 'achievement' || has('achievement', 'award', 'certificate', 'competition', 'winner', 'trophy', 'medal')) {
    if (role === 'teacher') return { url: '/teacher/achievements', label: 'View Class Achievements' };
    if (role === 'parent' || role === 'student') return { url: '/parent/achievements', label: 'View Student Achievements' };
    if (role === 'admin') return { url: '/admin/students', label: 'View Student Directory' };
    if (role === 'admin2') return { url: '/admin2/student-performance', label: 'Student Performance' };
    return { url: '/fc', label: 'Open Portal' };
  }

  // --- H. Events / Holidays ---
  if (type === 'holiday' || has('holiday', 'vacation', 'celebration', 'function', 'sports day', 'annual day', 'event', 'reopening')) {
    if (role === 'admin') return { url: '/admin/events', label: 'View Events & Holidays' };
    if (role === 'admin2') return { url: '/admin2/events', label: 'View Events & Holidays' };
    if (role === 'parent' || role === 'student') return { url: '/parent/events', label: 'View School Events' };
    if (role === 'fee_collector') return { url: '/fc/events', label: 'View Events Calendar' };
    return { url: '/teacher', label: 'Open Dashboard' };
  }

  // --- I. Staff Leaves ---
  if (has('staff leave', 'leave application', 'sick leave', 'casual leave')) {
    if (role === 'admin') return { url: '/admin/leaves', label: 'Review Leave Requests' };
    if (role === 'teacher') return { url: '/teacher/leaves', label: 'My Leave Applications' };
    return { url: '/admin2/incharge', label: 'Leave Management' };
  }

  // --- J. Credentials ---
  if (has('credential', 'password', 'login access', 'portal login', 'username', 'staff account')) {
    if (role === 'admin') return { url: '/admin/credentials', label: 'Open Credential Manager' };
    if (role === 'admin2') return { url: '/admin2/credentials', label: 'Open Credential Manager' };
    if (role === 'fee_collector') return { url: '/fc/credentials', label: 'Staff Credentials' };
    if (role === 'teacher') return { url: '/teacher/profile', label: 'My Profile & Security' };
    if (role === 'parent' || role === 'student') return { url: '/parent/profile', label: 'My Profile & Security' };
  }

  // --- Fallback default: Archive page for this user's role ---
  if (role === 'admin') return { url: '/admin/notifications', label: 'View in Archive' };
  if (role === 'admin2') return { url: '/admin2/notifications', label: 'View in Archive' };
  if (role === 'teacher') return { url: '/teacher/notifications', label: 'View in Archive' };
  if (role === 'parent' || role === 'student') return { url: '/parent/notifications', label: 'View in Archive' };
  if (role === 'fee_collector') return { url: '/fc/notifications', label: 'View in Archive' };

  return { url: '/login', label: 'Open Portal' };
}

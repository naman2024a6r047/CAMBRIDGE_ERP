const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { Notification, NotificationRead, User, Student, Teacher, ClassIncharge, Timetable } = require('../models');
const { sendEmail } = require('../utils/emailService');
const { protect, hasPermission } = require('../middleware/auth');

// ══════════════════════════════════════════════════════════════════════════════
// IMPORTANT: All literal path routes MUST come BEFORE parameterized /:id routes
// otherwise Express matches "vapid-key", "subscribe" etc. as :id values.
// ══════════════════════════════════════════════════════════════════════════════

// ── Web Push Notifications Endpoints ──────────────────────────────────────────

// GET /api/notifications/vapid-key - Get public VAPID key for service worker subscription
router.get('/vapid-key', protect, (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

// POST /api/notifications/subscribe - Save push subscription details
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ message: 'Invalid push subscription details.' });
    }

    const { PushSubscription } = require('../models');
    
    // Use robust findOne and update/create instead of upsert
    let sub = await PushSubscription.findOne({ where: { endpoint } });
    if (sub) {
      sub.user_id = req.user.id;
      sub.p256dh = keys.p256dh;
      sub.auth = keys.auth;
      await sub.save();
      console.log(`[PushRoute] Updated push subscription for user ${req.user.id}`);
    } else {
      await PushSubscription.create({
        user_id: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
      console.log(`[PushRoute] Created new push subscription for user ${req.user.id}`);
    }

    res.status(201).json({ message: 'Push subscription saved successfully.' });
  } catch (err) {
    console.error('[PushRoute] Subscribe error:', err);
    res.status(500).json({ message: 'Failed to save push subscription.' });
  }
});

// POST /api/notifications/unsubscribe - Delete push subscription details
router.post('/unsubscribe', protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint is required to unsubscribe.' });
    }

    const { PushSubscription } = require('../models');
    await PushSubscription.destroy({
      where: {
        user_id: req.user.id,
        endpoint,
      },
    });

    res.json({ message: 'Push subscription removed successfully.' });
  } catch (err) {
    console.error('[PushRoute] Unsubscribe error:', err);
    res.status(500).json({ message: 'Failed to remove push subscription.' });
  }
});

// GET /api/notifications/users/search — for individual notification lookup
router.get('/users/search', protect, async (req, res) => {
  try {
    const { search, role, class: className } = req.query;
    let whereClause = { is_active: true };

    if (search && search.length >= 2) {
      whereClause[Op.or] = [
        { name:  { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (role) {
      whereClause.role = role;
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: ['id', 'name', 'email', 'role'],
      limit: 20,
    });

    // If we need to filter by class, we could join with Student table
    let finalUsers = users;
    if (role === 'student' && className) {
      const students = await Student.findAll({ where: { class: className } });
      const studentEmails = students.map(s => s.parent_email || s.student_id); // we might not have user records for all students, but assuming we do, let's match by name or email
      // A more robust join is needed for class filtering, but we keep it simple for now
    }

    res.json({ users: finalUsers });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/notifications/message
router.post('/message', protect, async (req, res) => {
  try {
    const { recipientType, selectedUserIds, subject, message } = req.body;
    let userIds = [];
    let emails = [];

    // Helper to get emails from User IDs
    const getEmails = async (ids) => {
      const users = await User.findAll({ where: { id: ids } });
      return users.map(u => u.email).filter(Boolean);
    };

    if (recipientType === 'everyone') {
      const users = await User.findAll({ where: { is_active: true } });
      userIds = users.map(u => u.id);
      emails = users.map(u => u.email).filter(Boolean);
    } else if (recipientType === 'all_teachers') {
      const users = await User.findAll({ where: { role: 'teacher', is_active: true } });
      userIds = users.map(u => u.id);
      emails = users.map(u => u.email).filter(Boolean);
    } else if (recipientType === 'all_students') {
      const users = await User.findAll({ where: { role: 'student', is_active: true } });
      userIds = users.map(u => u.id);
      emails = users.map(u => u.email).filter(Boolean);
      
      // Also get parent emails directly from Student table
      const students = await Student.findAll({ where: { is_active: true } });
      emails.push(...students.map(s => s.parent_email).filter(Boolean));
    } else if (recipientType === 'my_teachers') {
      // Find the student's class
      const student = await Student.findOne({ where: { student_id: req.user.username } });
      if (student) {
        const incharge = await ClassIncharge.findOne({ where: { class: student.class, section: student.section } });
        const timetable = await Timetable.findAll({ where: { class: student.class, section: student.section } });
        
        const teacherIds = new Set();
        if (incharge) teacherIds.add(incharge.teacher_id);
        timetable.forEach(t => teacherIds.add(t.teacher_id));

        const teachers = await Teacher.findAll({ where: { id: Array.from(teacherIds) } });
        const teacherUserIds = teachers.map(t => t.user_id).filter(Boolean);
        
        userIds = teacherUserIds;
        emails = await getEmails(userIds);
      }
    } else if (recipientType === 'individual') {
      userIds = selectedUserIds || [];
      emails = await getEmails(userIds);
    }

    // Deduplicate emails
    emails = [...new Set(emails)];

    // 1. Create Web Notifications (bulk)
    const notifs = userIds.map(id => ({
      title: subject,
      message: message,
      type: 'general',
      sent_by: req.user.id,
      recipient_type: 'individual',
      recipient_user_id: id,
      is_active: true
    }));
    if (notifs.length > 0) {
      await Notification.bulkCreate(notifs);
    }

    // 2. Send Emails
    if (emails.length > 0) {
      await sendEmail(emails, subject, message);
    }

    res.json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error('[Messages]', err);
    res.status(500).json({ message: 'Failed to send message.' });
  }
});

// ── Standard Notification CRUD ────────────────────────────────────────────────

// GET /api/notifications — filtered by recipient & role context
router.get('/', protect, async (req, res) => {
  try {
    const userRole = req.user.role;
    const { role: filterRole, class: filterClass, type: filterType, sub_category: filterSubCat, priority: filterPriority } = req.query;

    let where = { is_active: true };

    // 1. Admin & Admin2: Can see all notifications and apply filter queries
    if (['admin', 'admin2'].includes(userRole)) {
      if (filterRole && filterRole !== 'all') {
        const roleTerms = filterRole === 'teachers' ? ['teachers', 'teacher'] : filterRole === 'students' ? ['students', 'student', 'parents', 'parent'] : [filterRole];
        where.recipient_role = { [Op.in]: roleTerms };
      }
      if (filterClass && filterClass !== 'all') {
        where.target_class = filterClass;
      }
      if (filterType && filterType !== 'all') {
        where.type = filterType;
      }
      if (filterSubCat && filterSubCat !== 'all') {
        where.sub_category = filterSubCat;
      }
      if (filterPriority && filterPriority !== 'all') {
        where.priority = filterPriority;
      }
    } else if (userRole === 'teacher') {
      // 2. Teachers: See broadcast, teacher-targeted (matching subject if set), or individual
      const teacherSubject = req.user.linkedTeacher?.subject || '';
      where[Op.or] = [
        { recipient_type: 'all' },
        { recipient_role: 'all' },
        { recipient_type: 'individual', recipient_user_id: req.user.id },
        {
          [Op.and]: [
            { recipient_role: { [Op.in]: ['teachers', 'teacher'] } },
            {
              [Op.or]: [
                { target_subject: null },
                { target_subject: '' },
                { target_subject: 'all' },
                ...(teacherSubject ? [{ target_subject: { [Op.like]: `%${teacherSubject}%` } }] : []),
              ]
            }
          ]
        }
      ];
    } else if (['student', 'parent'].includes(userRole)) {
      // 3. Students / Parents: See broadcast, student/parent-targeted (matching class/section if set), or individual
      const studentClass = req.user.linkedStudent?.class || '';
      const studentSection = req.user.linkedStudent?.section || '';

      const classConditions = [
        { target_class: null },
        { target_class: '' },
        { target_class: 'all' },
      ];
      if (studentClass) classConditions.push({ target_class: studentClass });

      const sectionConditions = [
        { target_section: null },
        { target_section: '' },
        { target_section: 'all' },
      ];
      if (studentSection) sectionConditions.push({ target_section: studentSection });

      where[Op.or] = [
        { recipient_type: 'all' },
        { recipient_role: 'all' },
        { recipient_type: 'individual', recipient_user_id: req.user.id },
        {
          [Op.and]: [
            { recipient_role: { [Op.in]: ['students', 'student', 'parents', 'parent'] } },
            { [Op.or]: classConditions },
            { [Op.or]: sectionConditions },
          ]
        }
      ];
    } else {
      // 4. Other staff roles (e.g. fee collector)
      where[Op.or] = [
        { recipient_type: 'all' },
        { recipient_role: 'all' },
        { recipient_role: userRole },
        { recipient_type: 'individual', recipient_user_id: req.user.id },
      ];
    }

    const notifications = await Notification.findAll({
      where,
      include: [{ model: User, as: 'sender', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    const readRecords = await NotificationRead.findAll({ where: { user_id: req.user.id } });
    const readSet = new Set(readRecords.map(r => r.notification_id));

    const result = notifications.map(n => ({
      ...n.toJSON(),
      is_read: readSet.has(n.id),
    }));

    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/notifications — with custom audience, subcategory, and priority support
router.post('/', protect, hasPermission('SEND_NOTIFICATIONS'), async (req, res) => {
  try {
    const {
      title,
      message,
      type = 'general',
      recipient_type = 'all',
      recipient_role,
      recipient_user_id,
      target_class,
      target_section,
      target_subject,
      sub_category,
      priority = 'normal',
    } = req.body;

    if (!title || !title.trim() || !message || !message.trim()) {
      return res.status(400).json({ message: 'Title and message are required.' });
    }

    // Validate recipient config
    if (recipient_type === 'individual' && !recipient_user_id) {
      return res.status(400).json({ message: 'recipient_user_id required for individual notifications.' });
    }

    if (recipient_type === 'role' && !recipient_role) {
      return res.status(400).json({ message: 'recipient_role required for role-based notifications.' });
    }

    // Verify user exists for individual
    if (recipient_type === 'individual') {
      const targetUser = await User.findByPk(recipient_user_id);
      if (!targetUser) return res.status(404).json({ message: 'Target user not found.' });
    }

    const cleanRole = recipient_type === 'role'
      ? (recipient_role === 'teachers' || recipient_role === 'teacher' ? 'teachers' : recipient_role === 'students' || recipient_role === 'student' ? 'students' : recipient_role)
      : (recipient_type === 'all' ? 'all' : null);

    const notification = await Notification.create({
      title:             title.trim(),
      message:           message.trim(),
      type:              type || 'general',
      recipient_type,
      recipient_role:    cleanRole,
      recipient_user_id: recipient_type === 'individual' ? recipient_user_id : null,
      target_class:      target_class && target_class !== 'all' ? target_class : null,
      target_section:    target_section && target_section !== 'all' ? target_section : null,
      target_subject:    target_subject && target_subject !== 'all' ? target_subject : null,
      sub_category:      sub_category ? sub_category.trim() : 'General',
      priority:          ['normal', 'high', 'urgent'].includes(priority) ? priority : 'normal',
      sent_by:           req.user.id,
    });

    // Send native system push notifications asynchronously
    try {
      const { sendPushToUser, sendPushToRole } = require('../services/pushNotificationService');
      if (recipient_type === 'individual') {
        console.log(`[PushRoute] Dispatching push to individual user ${recipient_user_id}`);
        sendPushToUser(recipient_user_id, title, message).catch(err => console.error('[PushRoute] Push dispatch error:', err));
      } else if (recipient_type === 'role') {
        const targetRole = cleanRole === 'parents' ? 'parent' : cleanRole === 'teachers' ? 'teacher' : cleanRole === 'students' ? 'student' : cleanRole;
        console.log(`[PushRoute] Dispatching push to role: ${targetRole}`);
        sendPushToRole(targetRole, title, message).catch(err => console.error('[PushRoute] Push dispatch error:', err));
      } else {
        console.log('[PushRoute] Dispatching push to ALL users');
        sendPushToRole('all', title, message).catch(err => console.error('[PushRoute] Push dispatch error:', err));
      }
    } catch (pushErr) {
      console.error('[PushRoute] Failed to load push service:', pushErr);
    }

    res.status(201).json(notification);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ── Parameterized routes MUST come LAST ───────────────────────────────────────

// POST /api/notifications/:id/read
router.post('/:id/read', protect, async (req, res) => {
  try {
    await NotificationRead.upsert({ notification_id: req.params.id, user_id: req.user.id });
    res.json({ message: 'Marked as read.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/notifications/:id
router.delete('/:id', protect, hasPermission('SEND_NOTIFICATIONS'), async (req, res) => {
  try {
    await Notification.update({ is_active: false }, { where: { id: req.params.id } });
    res.json({ message: 'Deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { User, Student } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { sendCredentialsEmail } = require('../services/mailService');
const { credentialUpdateLimiter } = require('../middleware/rateLimiters');

// ── Role Definitions ─────────────────────────────────────────────────────────
const ADMIN_ROLES = ['admin', 'admin2', 'superadmin', 'super_admin'];
const FC_ROLES = ['fee_collector'];
const ALL_ALLOWED_ROLES = ['admin', 'admin2', 'fee_collector', 'superadmin', 'super_admin'];

// ── GET /api/credentials/teachers ───────────────────────────────────────────
// Accessible only to: admin, admin2
router.get('/teachers', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const { search } = req.query;
    const where = { role: 'teacher' };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const teachers = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'role', 'is_active', 'phone'],
      order: [['name', 'ASC']]
    });

    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── GET /api/credentials/fee-collectors ─────────────────────────────────────
// Accessible only to: admin, admin2
router.get('/fee-collectors', protect, authorize(...ADMIN_ROLES), async (req, res) => {
  try {
    const { search } = req.query;
    const where = { role: 'fee_collector' };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const collectors = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'role', 'is_active', 'phone'],
      order: [['name', 'ASC']]
    });

    res.json(collectors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── GET /api/credentials/students ───────────────────────────────────────────
// Accessible to: admin, admin2, fee_collector
router.get('/students', protect, authorize(...ALL_ALLOWED_ROLES), async (req, res) => {
  try {
    const { search, class: filterClass } = req.query;
    const where = { role: 'student' };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    const studentInclude = {
      model: Student,
      as: 'linkedStudent',
      attributes: [
        'id', 'student_id', 'class', 'section', 'roll_number',
        'parent_name', 'father_name', 'parent_phone', 'parent_email', 'approval_status'
      ],
    };

    if (filterClass && filterClass !== 'all') {
      studentInclude.where = { class: filterClass };
    }

    const students = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'role', 'is_active', 'phone', 'linked_student_id'],
      include: [studentInclude],
      order: [['name', 'ASC']]
    });

    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── PUT /api/credentials/:id ────────────────────────────────────────────────
// Accessible to: admin, admin2, fee_collector (with strict cross-role checks)
router.put('/:id', credentialUpdateLimiter, protect, authorize(...ALL_ALLOWED_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password } = req.body;
    const requesterRole = req.user.role;

    const user = await User.findByPk(id, {
      include: [{ model: Student, as: 'linkedStudent' }]
    });
    if (!user) {
      return res.status(404).json({ message: 'User credentials not found.' });
    }

    // Role-based Access Control checks:
    if (user.role === 'teacher' || user.role === 'fee_collector') {
      // Teachers and Fee Collectors can only be managed by Admins
      if (!ADMIN_ROLES.includes(requesterRole)) {
        return res.status(403).json({ 
          message: 'Access denied. Only Admins can manage Teacher and Fee Collector credentials.' 
        });
      }
    } else if (user.role === 'student') {
      // Students can be managed by Fee Collectors or Admins
      if (!ALL_ALLOWED_ROLES.includes(requesterRole)) {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to manage Student credentials.' 
        });
      }
    } else {
      // Prevents editing other admins or parent roles
      return res.status(403).json({ 
        message: `Access denied. Managing ${user.role} credentials is not allowed through this interface.` 
      });
    }

    // Validate inputs
    if (email && email !== user.email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Please provide a valid email address.' });
      }

      // Check email uniqueness
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: 'This email (Login ID) is already in use by another account.' });
      }
      user.email = email;
    }

    let passwordUpdated = false;
    if (password) {
      if (password.trim().length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
      }
      user.password = password;
      user.password_changed_at = new Date();
      passwordUpdated = true;
    }

    // Save changes to database (automatically hashes password in hooks)
    user.is_active = true;
    await user.save();

    if (user.role === 'student' && user.linked_student_id) {
      await Student.update(
        { approval_status: 'approved', is_active: true, student_status: 'active' },
        { where: { id: user.linked_student_id } }
      ).catch(() => {});
    }

    // Fast, non-blocking email notification
    let emailSent = false;
    let emailQueued = false;
    if (req.body.sendEmail !== false) {
      const emailPass = passwordUpdated ? password : '[Password Unchanged]';
      const targetEmail = (user.role === 'student' && user.linkedStudent?.parent_email && user.linkedStudent.parent_email.includes('@'))
        ? user.linkedStudent.parent_email.trim()
        : user.email;

      try {
        const emailTask = sendCredentialsEmail({
          to: targetEmail,
          name: user.name,
          loginId: user.email,
          password: emailPass,
          role: user.role === 'student' ? 'Student' : (user.role === 'teacher' ? 'Teacher' : 'Fee Collector'),
          studentDetails: user.linkedStudent,
          teacherDetails: user.linkedTeacher,
        });

        // Fast race with 2.5s timeout: keeps UI snappy even on slow SMTP connections
        const timeoutTask = new Promise((resolve) => setTimeout(() => resolve('timeout'), 2500));
        const outcome = await Promise.race([emailTask, timeoutTask]);

        if (outcome === true) {
          emailSent = true;
        } else if (outcome === 'timeout') {
          emailQueued = true;
          emailTask.then((res) => {
            console.log(`[Credentials] Background email to ${targetEmail} completed with status: ${res}`);
          }).catch(err => {
            console.error(`[Credentials] Background email error for ${targetEmail}:`, err);
          });
        }
      } catch (mailErr) {
        console.error('[Credentials] Non-fatal email error:', mailErr);
      }
    }

    res.json({
      success: true,
      emailSent,
      emailQueued,
      message: emailSent
        ? 'Credentials updated and email sent successfully.'
        : (emailQueued
            ? 'Credentials saved! Email notification is dispatching in background.'
            : 'Credentials saved successfully.'),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST /api/credentials/:id/send ──────────────────────────────────────────
// Accessible to: admin, admin2, fee_collector (with strict cross-role checks)
// Directly sends/resends credentials email to staff, teacher, or student on demand
router.post('/:id/send', credentialUpdateLimiter, protect, authorize(...ALL_ALLOWED_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { password, generateNew, keepCurrent } = req.body;
    const requesterRole = req.user.role;

    const user = await User.findByPk(id, {
      include: [{ model: Student, as: 'linkedStudent' }]
    });
    if (!user) {
      return res.status(404).json({ message: 'User credentials not found.' });
    }

    // Role-based Access Control checks:
    if (user.role === 'teacher' || user.role === 'fee_collector') {
      if (!ADMIN_ROLES.includes(requesterRole)) {
        return res.status(403).json({ 
          message: 'Access denied. Only Admins can send credentials to Teachers and Fee Collectors.' 
        });
      }
    } else if (user.role === 'student') {
      if (!ALL_ALLOWED_ROLES.includes(requesterRole)) {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to send Student credentials.' 
        });
      }
    } else {
      return res.status(403).json({ 
        message: `Access denied. Sending ${user.role} credentials is not allowed.` 
      });
    }

    let passwordToSend = '[Password Unchanged]';
    let tempPassword = null;

    if (password && String(password).trim().length >= 6) {
      const cleanPass = String(password).trim();
      user.password = cleanPass;
      user.password_changed_at = new Date();
      await user.save();
      passwordToSend = cleanPass;
      tempPassword = cleanPass;
    } else if (generateNew) {
      const { makeTemporaryPassword } = require('../utils/credentialGenerator');
      const cleanPass = makeTemporaryPassword();
      user.password = cleanPass;
      user.password_changed_at = new Date();
      await user.save();
      passwordToSend = cleanPass;
      tempPassword = cleanPass;
    } else if (keepCurrent) {
      passwordToSend = '[Please use your existing password]';
    } else {
      // Default fallback if neither specified: generate clean temporary password so user can log in
      const { makeTemporaryPassword } = require('../utils/credentialGenerator');
      const cleanPass = makeTemporaryPassword();
      user.password = cleanPass;
      user.password_changed_at = new Date();
      await user.save();
      passwordToSend = cleanPass;
      tempPassword = cleanPass;
    }

    user.is_active = true;
    await user.save();

    if (user.role === 'student' && user.linked_student_id) {
      await Student.update(
        { approval_status: 'approved', is_active: true, student_status: 'active' },
        { where: { id: user.linked_student_id } }
      ).catch(() => {});
    }

    const isStudent = user.role === 'student';
    const targetEmail = (isStudent && user.linkedStudent?.parent_email && user.linkedStudent.parent_email.includes('@'))
      ? user.linkedStudent.parent_email.trim()
      : user.email;
    const displayRole = isStudent ? 'Student' : (user.role === 'teacher' ? 'Teacher' : 'Fee Collector');

    // Fast send with 2.5s race timeout
    let emailSent = false;
    let emailQueued = false;
    try {
      const emailTask = sendCredentialsEmail({
        to: targetEmail,
        name: user.name,
        loginId: user.email,
        password: passwordToSend,
        role: displayRole,
        studentDetails: user.linkedStudent,
        teacherDetails: user.linkedTeacher,
      });
      const timeoutTask = new Promise((resolve) => setTimeout(() => resolve('timeout'), 2500));
      const outcome = await Promise.race([emailTask, timeoutTask]);

      if (outcome === true) {
        emailSent = true;
      } else if (outcome === 'timeout') {
        emailQueued = true;
        emailTask.then((res) => {
          console.log(`[Credentials] Background email to ${targetEmail} completed: ${res}`);
        }).catch(err => {
          console.error(`[Credentials] Background email error for ${targetEmail}:`, err);
        });
      }
    } catch (mailErr) {
      console.error('[Credentials] Email dispatch error:', mailErr);
    }

    res.json({
      success: true,
      emailSent,
      emailQueued,
      temporaryPassword: tempPassword,
      targetEmail,
      message: emailSent
        ? `Credentials sent to ${targetEmail} (Login ID: ${user.email}) successfully!`
        : (emailQueued
            ? `Credentials updated! Email is dispatching in background to ${targetEmail}.`
            : `Credentials updated, but email could not be delivered. Please check mail settings.`),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        parent_email: user.linkedStudent?.parent_email || null
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST /api/credentials/students/batch-auto-send ──────────────────────────
// Accessible to: admin, admin2, fee_collector
// Auto-generates passwords and dispatches credential emails to an entire class or list of students
router.post('/students/batch-auto-send', credentialUpdateLimiter, protect, authorize(...ALL_ALLOWED_ROLES), async (req, res) => {
  try {
    const { class: filterClass, studentUserIds } = req.body;
    const { makeTemporaryPassword } = require('../utils/credentialGenerator');

    const where = { role: 'student' };
    if (Array.isArray(studentUserIds) && studentUserIds.length > 0) {
      where.id = { [Op.in]: studentUserIds };
    }

    const studentInclude = {
      model: Student,
      as: 'linkedStudent',
      attributes: [
        'id', 'student_id', 'class', 'section', 'roll_number',
        'parent_name', 'father_name', 'parent_phone', 'parent_email', 'approval_status'
      ],
    };

    if (filterClass && filterClass !== 'all') {
      studentInclude.where = { class: filterClass };
    }

    const students = await User.findAll({
      where,
      include: [studentInclude]
    });

    if (!students || students.length === 0) {
      return res.status(404).json({ message: 'No student accounts found matching criteria.' });
    }

    let processedCount = 0;
    const studentResults = [];

    for (const studentUser of students) {
      try {
        const newPassword = makeTemporaryPassword();
        studentUser.password = newPassword;
        studentUser.password_changed_at = new Date();
        studentUser.is_active = true;
        await studentUser.save();

        if (studentUser.linked_student_id) {
          await Student.update(
            { approval_status: 'approved', is_active: true, student_status: 'active' },
            { where: { id: studentUser.linked_student_id } }
          ).catch(() => {});
        }

        const targetEmail = (studentUser.linkedStudent?.parent_email && studentUser.linkedStudent.parent_email.includes('@'))
          ? studentUser.linkedStudent.parent_email.trim()
          : studentUser.email;

        // Dispatch email non-blockingly
        sendCredentialsEmail({
          to: targetEmail,
          name: studentUser.name,
          loginId: studentUser.email,
          password: newPassword,
          role: 'Student',
          studentDetails: studentUser.linkedStudent,
        }).then(status => {
          console.log(`[Batch Credentials] Auto password dispatched for ${studentUser.name} to ${targetEmail}: status ${status}`);
        }).catch(err => {
          console.error(`[Batch Credentials] Error emailing ${targetEmail}:`, err.message);
        });

        processedCount++;
        studentResults.push({
          id: studentUser.id,
          name: studentUser.name,
          loginId: studentUser.email,
          targetEmail,
          class: studentUser.linkedStudent?.class || '—',
          temporaryPassword: newPassword
        });
      } catch (rowErr) {
        console.error(`[Batch Credentials] Error processing user ${studentUser.id}:`, rowErr);
      }
    }

    res.json({
      success: true,
      count: processedCount,
      students: studentResults,
      message: `Successfully auto-generated passwords and triggered email delivery for ${processedCount} student(s).`
    });

  } catch (error) {
    console.error('[Credentials] Batch auto-send error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

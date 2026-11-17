const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { User } = require('../models');
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
// Accessible only to: fee_collector (also allow admins for administrative safety)
router.get('/students', protect, authorize(...ALL_ALLOWED_ROLES), async (req, res) => {
  try {
    const { search } = req.query;
    const where = { role: 'student' };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const students = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'role', 'is_active', 'phone'],
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

    const user = await User.findByPk(id);
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
    await user.save();

    // Fast, non-blocking email notification
    let emailSent = false;
    let emailQueued = false;
    if (req.body.sendEmail !== false) {
      const emailPass = passwordUpdated ? password : '[Password Unchanged]';
      try {
        const emailTask = sendCredentialsEmail({
          to: user.email,
          name: user.name,
          loginId: user.email,
          password: emailPass,
          role: user.role
        });

        // Fast race with 2.5s timeout: keeps UI snappy even on slow SMTP connections
        const timeoutTask = new Promise((resolve) => setTimeout(() => resolve('timeout'), 2500));
        const outcome = await Promise.race([emailTask, timeoutTask]);

        if (outcome === true) {
          emailSent = true;
        } else if (outcome === 'timeout') {
          emailQueued = true;
          emailTask.then((res) => {
            console.log(`[Credentials] Background email to ${user.email} completed with status: ${res}`);
          }).catch(err => {
            console.error(`[Credentials] Background email error for ${user.email}:`, err);
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

    const user = await User.findByPk(id);
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

    // Fast send with 2.5s race timeout
    let emailSent = false;
    let emailQueued = false;
    try {
      const emailTask = sendCredentialsEmail({
        to: user.email,
        name: user.name,
        loginId: user.email,
        password: passwordToSend,
        role: user.role
      });
      const timeoutTask = new Promise((resolve) => setTimeout(() => resolve('timeout'), 2500));
      const outcome = await Promise.race([emailTask, timeoutTask]);

      if (outcome === true) {
        emailSent = true;
      } else if (outcome === 'timeout') {
        emailQueued = true;
        emailTask.then((res) => {
          console.log(`[Credentials] Background email to ${user.email} completed: ${res}`);
        }).catch(err => {
          console.error(`[Credentials] Background email error for ${user.email}:`, err);
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
      message: emailSent
        ? `Credentials sent to ${user.email} successfully!`
        : (emailQueued
            ? `Credentials updated! Email is dispatching in background to ${user.email}.`
            : `Credentials updated, but email could not be delivered. Please check mail settings.`),
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

module.exports = router;

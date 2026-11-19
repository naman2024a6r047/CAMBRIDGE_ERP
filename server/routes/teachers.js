const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { Teacher, User } = require('../models');
const { protect, authorize, hasPermission, isSuperAdmin } = require('../middleware/auth');
const { makeTeacherId, makeTemporaryPassword } = require('../utils/credentialGenerator');
const { validateTeacherCreate, validateTeacherUpdate } = require('../middleware/validator');
const { sendEmail } = require('../utils/emailService');
const { sendCredentialsEmail } = require('../services/mailService');

// (C3 fix) — whitelisted fields for teacher operations
const TEACHER_CREATE_FIELDS = ['name', 'subject', 'phone', 'status', 'assigned_classes', 'qualification', 'experience', 'date_of_joining', 'email', 'password', 'document_type', 'document_number', 'staff_type'];
const TEACHER_UPDATE_FIELDS = ['name', 'subject', 'phone', 'status', 'assigned_classes', 'qualification', 'experience', 'email', 'document_type', 'document_number', 'staff_type'];

const pick = (obj, keys) => {
  const result = {};
  for (const key of keys) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
};


let teacherSchemaEnsured = false;
const ensureTeacherSchema = async () => {
  if (teacherSchemaEnsured) return;
  try {
    const { sequelize } = require('../models');
    const qi = sequelize.getQueryInterface();
    const teachersDesc = await qi.describeTable('teachers').catch(() => null);
    if (!teachersDesc) {
      await Teacher.sync();
    } else {
      const requiredTeacherCols = [
        { name: 'teacher_id', sql: 'ALTER TABLE `teachers` ADD COLUMN `teacher_id` VARCHAR(20) NULL;' },
        { name: 'staff_type', sql: "ALTER TABLE `teachers` ADD COLUMN `staff_type` VARCHAR(50) DEFAULT 'Teacher';" },
        { name: 'document_type', sql: 'ALTER TABLE `teachers` ADD COLUMN `document_type` VARCHAR(50) NULL;' },
        { name: 'document_number', sql: 'ALTER TABLE `teachers` ADD COLUMN `document_number` VARCHAR(100) NULL;' },
        { name: 'assigned_classes', sql: 'ALTER TABLE `teachers` ADD COLUMN `assigned_classes` TEXT NULL;' },
        { name: 'qualification', sql: 'ALTER TABLE `teachers` ADD COLUMN `qualification` VARCHAR(100) NULL;' },
        { name: 'join_date', sql: 'ALTER TABLE `teachers` ADD COLUMN `join_date` DATE NULL;' },
        { name: 'status', sql: "ALTER TABLE `teachers` ADD COLUMN `status` ENUM('active', 'leave', 'inactive') DEFAULT 'active';" },
        { name: 'phone', sql: 'ALTER TABLE `teachers` ADD COLUMN `phone` VARCHAR(15) NULL;' },
        { name: 'email', sql: 'ALTER TABLE `teachers` ADD COLUMN `email` VARCHAR(150) NULL;' },
        { name: 'subject', sql: 'ALTER TABLE `teachers` ADD COLUMN `subject` VARCHAR(255) NULL;' },
      ];
      for (const col of requiredTeacherCols) {
        if (!teachersDesc[col.name]) {
          try { await sequelize.query(col.sql); } catch (e) {}
        }
      }
    }

    const usersDesc = await qi.describeTable('users').catch(() => null);
    if (usersDesc) {
      const requiredUserCols = [
        { name: 'linked_teacher_id', sql: 'ALTER TABLE `users` ADD COLUMN `linked_teacher_id` INT NULL;' },
        { name: 'linked_student_id', sql: 'ALTER TABLE `users` ADD COLUMN `linked_student_id` INT NULL;' },
        { name: 'profile_photo', sql: 'ALTER TABLE `users` ADD COLUMN `profile_photo` VARCHAR(255) NULL;' },
        { name: 'phone', sql: 'ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(15) NULL;' },
        { name: 'password_changed_at', sql: 'ALTER TABLE `users` ADD COLUMN `password_changed_at` DATETIME NULL;' },
        { name: 'login_attempts', sql: 'ALTER TABLE `users` ADD COLUMN `login_attempts` INT DEFAULT 0;' },
        { name: 'lock_until', sql: 'ALTER TABLE `users` ADD COLUMN `lock_until` DATETIME NULL;' },
      ];
      for (const col of requiredUserCols) {
        if (!usersDesc[col.name]) {
          try { await sequelize.query(col.sql); } catch (e) {}
        }
      }
    }
    teacherSchemaEnsured = true;
  } catch (err) {
    console.warn('[teachers] Schema ensure notice:', err.message);
  }
};

// GET /api/teachers
// ✅ Both admin and admin2 can view teachers
router.get('/', protect, hasPermission('VIEW_TEACHERS'), async (req, res) => {
  try {
    const { search, status } = req.query;
    const where = {};

    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name:    { [Op.like]: `%${search}%` } },
        { subject: { [Op.like]: `%${search}%` } },
        { teacher_id: { [Op.like]: `%${search}%` } },
      ];
    }

    await ensureTeacherSchema();
    let teachers;
    try {
      teachers = await Teacher.findAll({
        where,
        include: [
          {
            model: User,
            as: 'teacherUser',
            attributes: ['profile_photo']
          }
        ],
        order: [['name', 'ASC']],
      });
    } catch (queryErr) {
      console.warn('[teachers][GET /] Query with teacherUser failed, falling back:', queryErr.message);
      teacherSchemaEnsured = false;
      await ensureTeacherSchema();
      teachers = await Teacher.findAll({
        where,
        order: [['name', 'ASC']],
      });
    }

    res.json(teachers);
  } catch (err) {
    console.error('[teachers][GET /] Error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/teachers/:id
// ✅ admin, admin2, and the teacher themselves can view
router.get('/:id', protect, hasPermission('VIEW_TEACHERS'), async (req, res) => {
  try {
    await ensureTeacherSchema();
    let teacher;
    try {
      teacher = await Teacher.findByPk(req.params.id, {
        include: [
          {
            model: User,
            as: 'teacherUser',
            attributes: ['profile_photo']
          }
        ]
      });
    } catch (queryErr) {
      console.warn('[teachers][GET /:id] Query with teacherUser failed, falling back:', queryErr.message);
      teacher = await Teacher.findByPk(req.params.id);
    }
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/teachers
// ✅ Both admin and admin2 can CREATE teachers — (C3 fix) whitelisted fields
router.post('/', protect, authorize('admin', 'admin2'), validateTeacherCreate, async (req, res) => {
  const txn = await require('../models').sequelize.transaction();
  try {
    const safeData = pick(req.body, TEACHER_CREATE_FIELDS);

    // If custom email (User ID) is provided, verify it is not already taken
    if (safeData.email) {
      const existingUser = await User.findOne({ where: { email: safeData.email }, transaction: txn });
      if (existingUser) {
        await txn.rollback();
        return res.status(400).json({ message: 'Email address (User ID) is already registered.' });
      }
    }

    const teacher = await Teacher.create({ ...safeData, teacher_id: 'PENDING' }, { transaction: txn });
    const teacherId = makeTeacherId(teacher.id);
    await teacher.update({ teacher_id: teacherId }, { transaction: txn });

    // Use custom email/password if provided, fallback to auto-generators
    const userEmail = safeData.email || `${teacherId.toLowerCase()}@school.local`;
    const userPassword = safeData.password || makeTemporaryPassword();

    // Check if the generated fallback email is somehow already taken (safeguard)
    if (!safeData.email) {
      const existingUser = await User.findOne({ where: { email: userEmail }, transaction: txn });
      if (existingUser) {
        await txn.rollback();
        return res.status(400).json({ message: `Auto-generated email ${userEmail} is already registered.` });
      }
    }

    // Determine role based on staff type
    let userRole = 'teacher';
    if (safeData.staff_type === 'Fee Collector') {
      userRole = 'fee_collector';
    } else if (safeData.staff_type === 'Principal' || safeData.staff_type === 'Vice Principal') {
      userRole = 'admin2';
    }

    // Automatically create a corresponding User login record
    await User.create({
      name: teacher.name,
      email: userEmail,
      password: userPassword,
      role: userRole,
      linked_teacher_id: teacher.id,
      is_active: true,
      phone: teacher.phone,
    }, { transaction: txn });

    await txn.commit();

    res.status(201).json({
      teacher,
      credentials: {
        email: userEmail,
        password: safeData.password ? '[MANUALLY_SET]' : userPassword,
      },
      message: 'Teacher created and login credentials generated.',
    });

    // Send email asynchronously
        sendCredentialsEmail({
      to: userEmail,
      name: teacher.name,
      loginId: userEmail,
      password: userPassword,
      role: 'Teacher',
      teacherDetails: {
        subject: teacher.subject,
        assignedClasses: teacher.assigned_classes,
      }
    }).catch(e => console.warn('[teachers] Credentials email notification error:', e.message));

  } catch (err) {
    console.error('[teachers][POST /]', err);
    await txn.rollback();
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/teachers/:id
// ✅ Both admin and admin2 can EDIT teachers — (C3 fix) whitelisted fields
router.put('/:id', protect, authorize('admin', 'admin2'), validateTeacherUpdate, async (req, res) => {
  const txn = await require('../models').sequelize.transaction();
  try {
    const safeData = pick(req.body, TEACHER_UPDATE_FIELDS);
    const teacher = await Teacher.findByPk(req.params.id, { transaction: txn });
    if (!teacher) {
      await txn.rollback();
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    if (safeData.email && safeData.email !== teacher.email) {
      const existingUser = await User.findOne({ where: { email: safeData.email }, transaction: txn });
      if (existingUser && existingUser.linked_teacher_id !== teacher.id) {
        await txn.rollback();
        return res.status(400).json({ message: 'Email address (User ID) is already registered.' });
      }
    }

    await teacher.update(safeData, { transaction: txn });

    // Update corresponding User record if it exists
    const userToUpdate = await User.findOne({ where: { linked_teacher_id: teacher.id }, transaction: txn });
    if (userToUpdate) {
      const userUpdates = {};
      if (safeData.name !== undefined) userUpdates.name = safeData.name;
      if (safeData.phone !== undefined) userUpdates.phone = safeData.phone;
      if (safeData.email !== undefined) userUpdates.email = safeData.email;
      if (safeData.status === 'inactive') userUpdates.is_active = false;
      if (safeData.status === 'active' || safeData.status === 'leave') userUpdates.is_active = true;
      
      // Update role if staff type changed
      if (safeData.staff_type) {
        if (safeData.staff_type === 'Fee Collector') {
          userUpdates.role = 'fee_collector';
        } else if (safeData.staff_type === 'Principal' || safeData.staff_type === 'Vice Principal') {
          userUpdates.role = 'admin2';
        } else {
          userUpdates.role = 'teacher';
        }
      }

      await userToUpdate.update(userUpdates, { transaction: txn });
    }

    await txn.commit();
    
    const updatedTeacher = await Teacher.findByPk(req.params.id, {
      include: [{ model: User, as: 'teacherUser', attributes: ['profile_photo'] }]
    });
    res.json(updatedTeacher);
  } catch (err) {
    await txn.rollback();
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/teachers/:id
// ✅ Both admin and admin2 can delete/deactivate
router.delete('/:id', protect, authorize('admin', 'admin2'), async (req, res) => {
  try {
    await Teacher.update({ status: 'inactive' }, { where: { id: req.params.id } });
    res.json({ message: 'Teacher deactivated.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

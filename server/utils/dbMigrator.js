const { Student, AdmissionRequest, User, Session, sequelize } = require('../models');
const { makeStudentId, makeStudentEmail, makeTemporaryPassword } = require('./credentialGenerator');
const { getOrCreateFeeRecord, MONTHS } = require('../services/feeService');

async function migratePendingStudents() {
  const { Setting } = require('../models');
  const txn = await sequelize.transaction();
  try {
    // Check if legacy migration already completed to prevent auto-approving new pending admission requests
    const legacyMigrated = await Setting.findOne({
      where: { key: 'legacy_pending_students_migrated' },
      transaction: txn
    }).catch(() => null);

    if (legacyMigrated && legacyMigrated.value === 'true') {
      await txn.commit();
      return;
    }

    // 1. Auto-approve and activate any legacy pending students in the database
    const pendingStudents = await Student.findAll({
      where: { approval_status: 'pending' },
      transaction: txn,
    });

    if (pendingStudents.length > 0) {
      console.log(`[MIGRATOR] Found ${pendingStudents.length} pending students. Approving and activating...`);
      for (const student of pendingStudents) {
        await student.update({
          approval_status: 'approved',
          is_active: true,
          student_status: 'active',
          approved_at: student.approved_at || new Date(),
        }, { transaction: txn });

        await User.update(
          { is_active: true },
          { where: { linked_student_id: student.id, role: 'student' }, transaction: txn }
        );
      }
    }

    // 2. Restore any admission requests with status 'pending' that were created by the old migrator
    // (Excluding public_portal requests which must remain pending for admin approval)
    const { Op } = require('sequelize');
    const pendingRequests = await AdmissionRequest.findAll({
      where: {
        status: 'pending',
        source: { [Op.ne]: 'public_portal' },
      },
      transaction: txn,
    });

    if (pendingRequests.length > 0) {
      const activeSession = await Session.findOne({ where: { is_active: true }, transaction: txn });
      for (const req of pendingRequests) {
        const existingStudent = await Student.findOne({
          where: {
            first_name: req.first_name,
            last_name: req.last_name,
            parent_phone: req.parent_phone,
          },
          transaction: txn,
        });

        if (!existingStudent) {
          console.log(`[MIGRATOR] Restoring student from admission request: ${req.first_name} ${req.last_name}`);
          let formattedGender = 'Other';
          if (req.gender) {
            const g = req.gender.toLowerCase();
            if (g === 'male') formattedGender = 'Male';
            else if (g === 'female') formattedGender = 'Female';
          }

          const newStudent = await Student.create({
            student_id: 'PENDING',
            first_name: req.first_name,
            last_name: req.last_name,
            date_of_birth: req.date_of_birth,
            gender: formattedGender,
            class: req.applying_class,
            section: 'A',
            parent_name: req.parent_name,
            parent_phone: req.parent_phone,
            parent_email: req.parent_email,
            parent_address: req.parent_address,
            previous_school: req.previous_school,
            session_id: activeSession?.id || null,
            is_active: true,
            student_status: 'active',
            source: 'admin_created',
            admission_request_id: req.id,
            created_by: req.submitted_by,
            approval_status: 'approved',
            approved_by: req.submitted_by,
            approved_at: new Date(),
          }, { transaction: txn });

          const studentId = makeStudentId(newStudent.id);
          await newStudent.update({ student_id: studentId }, { transaction: txn });

          const userEmail = makeStudentEmail(studentId);
          const userPassword = makeTemporaryPassword();
          await User.create({
            name: `${newStudent.first_name} ${newStudent.last_name}`,
            email: userEmail,
            password: userPassword,
            role: 'student',
            linked_student_id: newStudent.id,
            is_active: true,
            phone: newStudent.parent_phone,
          }, { transaction: txn });

          await req.update({
            status: 'approved',
            student_id_created: newStudent.id,
            approved_at: new Date(),
          }, { transaction: txn });

          const now = new Date();
          const month = MONTHS[now.getMonth()];
          const year = now.getFullYear();
          await getOrCreateFeeRecord(newStudent, month, year, 'admission', txn).catch(() => {});
          await getOrCreateFeeRecord(newStudent, month, year, 'monthly', txn).catch(() => {});
        } else {
          await req.update({ student_id_created: existingStudent.id }, { transaction: txn });
        }
      }
    }

    // 3. Migrate students with source: 'admission_approved' and admission_request_id: null (already approved legacy students)
    const approvedLegacyStudents = await Student.findAll({
      where: {
        source: 'admission_approved',
        admission_request_id: null,
      },
      transaction: txn,
    });

    if (approvedLegacyStudents.length > 0) {
      console.log(`[MIGRATOR] Found ${approvedLegacyStudents.length} approved legacy students to link with admission requests.`);
      for (const student of approvedLegacyStudents) {
        const request = await AdmissionRequest.create({
          first_name: student.first_name,
          last_name: student.last_name,
          date_of_birth: student.date_of_birth,
          gender: student.gender,
          applying_class: student.class,
          parent_name: student.parent_name,
          parent_phone: student.parent_phone,
          parent_email: student.parent_email,
          parent_address: student.parent_address,
          previous_school: student.previous_school,
          status: 'approved',
          submitted_by: student.created_by || null,
          reviewed_by: student.approved_by || null,
          approved_at: student.approved_at || student.created_at,
          student_id_created: student.id,
          admission_fee_paid: 0,
        }, { transaction: txn });

        await student.update({ admission_request_id: request.id }, { transaction: txn });
        console.log(`[MIGRATOR] Created approved AdmissionRequest for ${student.first_name} ${student.last_name} (linked with student ID: ${student.id})`);
      }
    }

    const legacySetting = await Setting.findOne({
      where: { key: 'legacy_pending_students_migrated' },
      transaction: txn
    }).catch(() => null);

    if (!legacySetting) {
      await Setting.create({
        key: 'legacy_pending_students_migrated',
        value: 'true',
      }, { transaction: txn }).catch(() => {});
    }

    await txn.commit();
    console.log('[MIGRATOR] ✅ Database migration completed successfully.');
  } catch (err) {
    await txn.rollback();
    console.error('[MIGRATOR] ❌ Database migration failed:', err.message);
  }
}

async function migrateFeeColumns() {
  try {
    const qi = sequelize.getQueryInterface();
    const classFeeDesc = await qi.describeTable('class_fee_structures');
    
    // Add late_fee_per_day
    if (!classFeeDesc.late_fee_per_day) {
      console.log('[MIGRATOR] Adding late_fee_per_day to class_fee_structures');
      await qi.addColumn('class_fee_structures', 'late_fee_per_day', {
        type: require('sequelize').DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
      });
    }

    // Add session_id
    if (!classFeeDesc.session_id) {
      console.log('[MIGRATOR] Adding session_id to class_fee_structures');
      await qi.addColumn('class_fee_structures', 'session_id', {
        type: require('sequelize').DataTypes.INTEGER,
        defaultValue: 1, // Fallback session
        allowNull: false,
      });
    }

    const feesDesc = await qi.describeTable('fees');
    
    // Add late_fee_amount
    if (!feesDesc.late_fee_amount) {
      console.log('[MIGRATOR] Adding late_fee_amount to fees');
      await qi.addColumn('fees', 'late_fee_amount', {
        type: require('sequelize').DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
      });
    }

    // Update ENUM for status in fees
    // MySQL requires raw query to update ENUM values
    if (feesDesc.status && sequelize.getDialect() === 'mysql') {
      console.log('[MIGRATOR] Updating status ENUM in fees to include overdue');
      await sequelize.query(`
        ALTER TABLE fees 
        MODIFY COLUMN status ENUM('paid', 'unpaid', 'partial', 'waived', 'not_generated', 'overdue') DEFAULT 'unpaid';
      `);
    }

    if (sequelize.getDialect() === 'sqlite') {
      const [tableSql] = await sequelize.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='class_fee_structures';");
      if (tableSql && tableSql[0] && tableSql[0].sql && tableSql[0].sql.includes('session_id` INTEGER NOT NULL UNIQUE')) {
        console.log('[MIGRATOR] Fixing SQLite class_fee_structures composite unique index...');
        await sequelize.query('PRAGMA foreign_keys = OFF;');
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS class_fee_structures_temp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class VARCHAR(20) NOT NULL,
            session_id INTEGER NOT NULL,
            monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
            admission_fee DECIMAL(10,2) DEFAULT 0,
            annual_fee DECIMAL(10,2) DEFAULT 0,
            promotion_fee DECIMAL(10,2) DEFAULT 0,
            exam_fee DECIMAL(10,2) DEFAULT 0,
            monthly_due_date INTEGER DEFAULT 10,
            annual_due_date DATE,
            late_fee_per_day DECIMAL(10,2) DEFAULT 0,
            is_published TINYINT(1) DEFAULT 0,
            is_locked TINYINT(1) DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            updated_by INTEGER,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await sequelize.query(`
          INSERT OR IGNORE INTO class_fee_structures_temp 
          SELECT id, class, session_id, monthly_fee, admission_fee, annual_fee, promotion_fee, exam_fee, monthly_due_date, annual_due_date, late_fee_per_day, is_published, is_locked, is_active, updated_by, created_at, updated_at 
          FROM class_fee_structures;
        `);
        await sequelize.query('DROP TABLE class_fee_structures;');
        await sequelize.query('ALTER TABLE class_fee_structures_temp RENAME TO class_fee_structures;');
        await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS class_fee_structures_class_session_id ON class_fee_structures (class, session_id);');
        await sequelize.query('PRAGMA foreign_keys = ON;');
        console.log('[MIGRATOR] ✅ Fixed SQLite class_fee_structures composite unique constraint.');
      }
    }

    console.log('[MIGRATOR] ✅ Fee columns migration completed successfully.');
  } catch (err) {
    console.error('[MIGRATOR] ❌ Fee columns migration failed:', err.message);
  }
}

async function migrateTeacherSubjectColumn() {
  try {
    const qi = sequelize.getQueryInterface();
    const teachersDesc = await qi.describeTable('teachers');
    if (teachersDesc && teachersDesc.subject && sequelize.getDialect() === 'mysql') {
      await sequelize.query('ALTER TABLE teachers MODIFY COLUMN subject VARCHAR(255);');
      console.log('[MIGRATOR] ✅ Teacher subject column resized to VARCHAR(255).');
    }
  } catch (err) {
    console.error('[MIGRATOR] ❌ Teacher subject column migration notice:', err.message);
  }
}

async function migrateDatesheetAndAchievementTables() {
  try {
    const dialect = sequelize.getDialect();
    if (dialect === 'mysql') {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS exam_datesheets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          exam_name VARCHAR(100) NOT NULL,
          exam_type ENUM('unit_test', 'half_yearly', 'annual', 'assessment', 'pre_board', 'other') DEFAULT 'unit_test',
          class VARCHAR(20) NOT NULL,
          section VARCHAR(5) NOT NULL,
          session_id INT NULL,
          created_by_teacher_id INT NULL,
          created_by_user_id INT NOT NULL,
          status ENUM('draft', 'submitted', 'approved', 'rejected', 'declared') DEFAULT 'draft',
          instructions TEXT NULL,
          review_notes TEXT NULL,
          reviewed_by INT NULL,
          reviewed_at DATETIME NULL,
          declared_by INT NULL,
          declared_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_datesheet_class_sec (class, section),
          INDEX idx_datesheet_status (status)
        );
      `);

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS exam_datesheet_entries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          datesheet_id INT NOT NULL,
          subject VARCHAR(100) NOT NULL,
          exam_date DATE NOT NULL,
          start_time VARCHAR(15) NOT NULL,
          end_time VARCHAR(15) NOT NULL,
          room VARCHAR(50) NULL,
          syllabus_notes VARCHAR(255) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_entry_datesheet (datesheet_id),
          INDEX idx_entry_exam_date (exam_date)
        );
      `);

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS student_achievements (
          id INT AUTO_INCREMENT PRIMARY KEY,
          student_id INT NOT NULL,
          class VARCHAR(20) NOT NULL,
          section VARCHAR(5) NOT NULL,
          session_id INT NULL,
          category VARCHAR(60) NOT NULL,
          title VARCHAR(150) NOT NULL,
          position VARCHAR(50) NOT NULL,
          event_date DATE NULL,
          level VARCHAR(50) NULL,
          description TEXT NULL,
          added_by_teacher_id INT NULL,
          added_by_user_id INT NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ach_student (student_id),
          INDEX idx_ach_class_sec (class, section)
        );
      `);

      try {
        await sequelize.query(`
          ALTER TABLE notifications
          MODIFY COLUMN type ENUM(
            'fee_reminder', 'attendance_alert', 'result',
            'general', 'holiday', 'admission', 'promotion',
            'exam_datesheet', 'achievement'
          ) DEFAULT 'general';
        `);
      } catch (enumErr) {
        console.warn('[MIGRATOR] Notifications type ENUM warning:', enumErr.message);
      }
    } else {
      const { ExamDatesheet, ExamDatesheetEntry, StudentAchievement } = require('../models');
      await ExamDatesheet.sync();
      await ExamDatesheetEntry.sync();
      await StudentAchievement.sync();
    }
    console.log('[MIGRATOR] ✅ Exam datesheets and student achievements tables verified.');
  } catch (err) {
    console.error('[MIGRATOR] ❌ Datesheet/achievement table migration failed:', err.message);
  }
}

async function migrateSessionAttendanceAndPromotionColumns() {
  try {
    const qi = sequelize.getQueryInterface();
    const { DataTypes } = require('sequelize');
    const promoDesc = await qi.describeTable('promotion_history');
    const attDesc = await qi.describeTable('attendance');

    if (!attDesc.is_finalized) {
      await qi.addColumn('attendance', 'is_finalized', {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      });
    }

    const columnsToAdd = [
      ['from_section', { type: DataTypes.STRING(5), allowNull: true }],
      ['from_session_name', { type: DataTypes.STRING(30), allowNull: true }],
      ['to_session_name', { type: DataTypes.STRING(30), allowNull: true }],
      ['attendance_present', { type: DataTypes.INTEGER, defaultValue: 0 }],
      ['attendance_absent', { type: DataTypes.INTEGER, defaultValue: 0 }],
      ['attendance_late', { type: DataTypes.INTEGER, defaultValue: 0 }],
      ['attendance_holiday', { type: DataTypes.INTEGER, defaultValue: 0 }],
      ['attendance_working_days', { type: DataTypes.INTEGER, defaultValue: 0 }],
      ['attendance_percentage', { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 }],
    ];

    for (const [colName, colDef] of columnsToAdd) {
      if (!promoDesc[colName]) {
        await qi.addColumn('promotion_history', colName, colDef);
      }
    }

    // Backfill legacy attendance rows where session_id IS NULL by matching session date ranges or active session
    const { Session, Attendance, Student, PromotionHistory } = require('../models');
    const sessions = await Session.findAll({ order: [['start_date', 'ASC'], ['id', 'ASC']] });
    const activeSession = sessions.find((s) => s.is_active) || sessions[sessions.length - 1];

    const nullSessionAtts = await Attendance.findAll({
      where: { session_id: null },
      attributes: ['id', 'student_id', 'date', 'class', 'section'],
    });

    if (nullSessionAtts.length > 0 && sessions.length > 0) {
      const studentIds = [...new Set(nullSessionAtts.map((a) => a.student_id))];
      const [students, promotions] = await Promise.all([
        Student.findAll({ where: { id: studentIds }, attributes: ['id', 'session_id', 'class', 'section'] }),
        PromotionHistory.findAll({ where: { student_id: studentIds } }),
      ]);
      const studentMap = new Map(students.map((s) => [s.id, s]));
      const promoByStudent = new Map();
      promotions.forEach((p) => {
        if (!promoByStudent.has(p.student_id)) promoByStudent.set(p.student_id, []);
        promoByStudent.get(p.student_id).push(p);
      });

      for (const att of nullSessionAtts) {
        const matchedSession = sessions.find(
          (s) => s.start_date && s.end_date && att.date >= s.start_date && att.date <= s.end_date
        );
        const stu = studentMap.get(att.student_id);
        const resolvedSessionId = matchedSession?.id || stu?.session_id || activeSession?.id || null;
        if (resolvedSessionId) {
          const updateFields = { session_id: resolvedSessionId };
          if (!att.class && stu) {
            // Only fill class/section from student if student wasn't promoted out of this session
            const stuPromos = promoByStudent.get(att.student_id) || [];
            const matchingPromo = stuPromos.find((p) => String(p.from_session) === String(resolvedSessionId));
            updateFields.class = matchingPromo?.from_class || stu.class;
            updateFields.section = matchingPromo?.from_section || stu.section;
          }
          await Attendance.update(updateFields, { where: { id: att.id } });
        }
      }
      console.log(`[MIGRATOR] ✅ Backfilled session_id on ${nullSessionAtts.length} attendance record(s).`);
    }

    console.log('[MIGRATOR] ✅ Session attendance and promotion history columns verified.');
  } catch (err) {
    console.error('[MIGRATOR] ❌ Session attendance migration failed:', err.message);
  }
}

async function migrateStudentMarksheetColumns() {
  try {
    const qi = sequelize.getQueryInterface();
    const studentsDesc = await qi.describeTable('students');
    const { DataTypes } = require('sequelize');

    const columnsToAdd = [
      { name: 'father_name', type: DataTypes.STRING(100) },
      { name: 'residential_address', type: DataTypes.TEXT },
      { name: 'passport_photo', type: DataTypes.TEXT('long') },
      { name: 'parent_address', type: DataTypes.TEXT },
      { name: 'parent_occupation', type: DataTypes.STRING(100) },
      { name: 'mother_name', type: DataTypes.STRING(100) },
      { name: 'category', type: DataTypes.STRING(50) },
      { name: 'aadhar_number', type: DataTypes.STRING(30) },
      { name: 'pen_number', type: DataTypes.STRING(30) },
      { name: 'family_id', type: DataTypes.STRING(30) },
      { name: 'profile_photo', type: DataTypes.TEXT },
      { name: 'admission_date', type: DataTypes.DATEONLY },
      { name: 'father_occupation', type: DataTypes.STRING(100) },
      { name: 'mother_occupation', type: DataTypes.STRING(100) },
      { name: 'father_phone', type: DataTypes.STRING(20) },
      { name: 'father_whatsapp', type: DataTypes.STRING(20) },
      { name: 'mother_phone', type: DataTypes.STRING(20) },
      { name: 'mother_whatsapp', type: DataTypes.STRING(20) },
      { name: 'post_office_tehsil', type: DataTypes.STRING(120) },
      { name: 'district', type: DataTypes.STRING(80) },
      { name: 'pin_code', type: DataTypes.STRING(15) },
      { name: 'previous_school', type: DataTypes.STRING(150) },
      { name: 'enquiry_mode', type: DataTypes.STRING(50) },
      { name: 'form_no', type: DataTypes.STRING(40) },
    ];

    for (const col of columnsToAdd) {
      if (!studentsDesc[col.name]) {
        console.log(`[MIGRATOR] Adding column ${col.name} to students`);
        await qi.addColumn('students', col.name, {
          type: col.type,
          allowNull: true,
        });
      }
    }
    console.log('[MIGRATOR] ✅ Student marksheet identity columns verified.');
  } catch (err) {
    console.error('[MIGRATOR] ❌ Student marksheet columns migration notice:', err.message);
  }
}

async function migrateActiveSession() {
  try {
    const { Session, Student } = require('../models');
    const { Op } = require('sequelize');

    // Find or create session 2026-2027
    let [session2026, created] = await Session.findOrCreate({
      where: { name: '2026-2027' },
      defaults: {
        name: '2026-2027',
        start_date: '2026-04-01',
        end_date: '2027-03-31',
        is_active: true,
        is_archived: false,
        promotion_completed: false,
      }
    });

    // Ensure session 2026-2027 is active and not archived
    await session2026.update({ is_active: true, is_archived: false });

    // Deactivate all other sessions so only 2026-2027 is active
    await Session.update(
      { is_active: false },
      { where: { id: { [Op.ne]: session2026.id } } }
    );

    // Archive sessions strictly older than 2026-2027
    await Session.update(
      { is_archived: true },
      {
        where: {
          id: { [Op.ne]: session2026.id },
          start_date: { [Op.lt]: '2026-04-01' }
        }
      }
    );

    // Ensure active students are associated with session 2026-2027 if unlinked or pointing to old inactive sessions
    const activeStudents = await Student.findAll({
      attributes: ['id', 'session_id'],
      where: {
        is_active: true,
        approval_status: 'approved',
        [Op.or]: [
          { session_id: null },
          { session_id: { [Op.ne]: session2026.id } }
        ]
      }
    });

    if (activeStudents.length > 0) {
      await Student.update(
        { session_id: session2026.id },
        {
          where: {
            id: { [Op.in]: activeStudents.map(s => s.id) }
          }
        }
      );
      console.log(`[MIGRATOR] Associated ${activeStudents.length} active students to session 2026-2027`);
    }

    console.log('[MIGRATOR] ✅ Active academic session 2026-2027 verified and activated.');
  } catch (err) {
    console.error('[MIGRATOR] ❌ Active session migration failed:', err.message);
  }
}

async function migrateAdmissionRequestColumns() {
  try {
    const rawAdmCols = [
      'ALTER TABLE `admission_requests` ADD COLUMN `form_no` VARCHAR(40) NULL;',
      'ALTER TABLE `admission_requests` ADD COLUMN `passport_photo` LONGTEXT NULL;',
      'ALTER TABLE `students` ADD COLUMN `form_no` VARCHAR(40) NULL;',
      'ALTER TABLE `students` ADD COLUMN `passport_photo` LONGTEXT NULL;',
      'ALTER TABLE `students` ADD COLUMN `profile_photo` LONGTEXT NULL;'
    ];
    for (const sql of rawAdmCols) {
      try { await sequelize.query(sql); } catch (e) {}
    }
    const qi = sequelize.getQueryInterface();
    const { DataTypes } = require('sequelize');

    // 1. Describe and update admission_requests table
    const admDesc = await qi.describeTable('admission_requests');
    const admColsToAdd = [
      { name: 'form_no',            type: DataTypes.STRING(40) },
      { name: 'father_name',        type: DataTypes.STRING(100) },
      { name: 'father_occupation',  type: DataTypes.STRING(100) },
      { name: 'father_phone',       type: DataTypes.STRING(20) },
      { name: 'father_whatsapp',    type: DataTypes.STRING(20) },
      { name: 'mother_name',        type: DataTypes.STRING(100) },
      { name: 'mother_occupation',  type: DataTypes.STRING(100) },
      { name: 'mother_phone',       type: DataTypes.STRING(20) },
      { name: 'mother_whatsapp',    type: DataTypes.STRING(20) },
      { name: 'aadhar_number',      type: DataTypes.STRING(30) },
      { name: 'passport_photo',     type: DataTypes.TEXT('long') },
      { name: 'residential_address',type: DataTypes.TEXT },
      { name: 'post_office_tehsil', type: DataTypes.STRING(120) },
      { name: 'district',           type: DataTypes.STRING(80) },
      { name: 'pin_code',           type: DataTypes.STRING(15) },
      { name: 'application_date',   type: DataTypes.DATEONLY },
      { name: 'enquiry_mode',       type: DataTypes.STRING(50) },
      { name: 'remarks',            type: DataTypes.TEXT },
      { name: 'source',             type: DataTypes.STRING(40) },
    ];

    for (const col of admColsToAdd) {
      if (!admDesc[col.name]) {
        console.log(`[MIGRATOR] Adding column ${col.name} to admission_requests`);
        await qi.addColumn('admission_requests', col.name, {
          type: col.type,
          allowNull: true,
        });
      }
    }

    // 2. Describe and update students table
    const stuDesc = await qi.describeTable('students');
    const stuColsToAdd = [
      { name: 'father_name',        type: DataTypes.STRING(100) },
      { name: 'father_occupation',  type: DataTypes.STRING(100) },
      { name: 'mother_occupation',  type: DataTypes.STRING(100) },
      { name: 'father_phone',       type: DataTypes.STRING(20) },
      { name: 'father_whatsapp',    type: DataTypes.STRING(20) },
      { name: 'mother_phone',       type: DataTypes.STRING(20) },
      { name: 'mother_whatsapp',    type: DataTypes.STRING(20) },
      { name: 'post_office_tehsil', type: DataTypes.STRING(120) },
      { name: 'district',           type: DataTypes.STRING(80) },
      { name: 'pin_code',           type: DataTypes.STRING(15) },
      { name: 'residential_address',type: DataTypes.TEXT },
      { name: 'previous_school',    type: DataTypes.STRING(150) },
      { name: 'enquiry_mode',       type: DataTypes.STRING(50) },
      { name: 'form_no',            type: DataTypes.STRING(40) },
      { name: 'passport_photo',     type: DataTypes.TEXT('long') },
    ];

    for (const col of stuColsToAdd) {
      if (!stuDesc[col.name]) {
        console.log(`[MIGRATOR] Adding column ${col.name} to students`);
        await qi.addColumn('students', col.name, {
          type: col.type,
          allowNull: true,
        });
      }
    }

    console.log('[MIGRATOR] ✅ Admission request and student profile columns verified.');
  } catch (err) {
    console.error('[MIGRATOR] ❌ Admission column migration failed:', err.message);
  }
}

async function migrateNotificationColumns() {
  try {
    const qi = sequelize.getQueryInterface();
    const notifsDesc = await qi.describeTable('notifications');
    const { DataTypes } = require('sequelize');

    const notifCols = [
      { name: 'target_class',   type: DataTypes.STRING(50) },
      { name: 'target_section', type: DataTypes.STRING(20) },
      { name: 'target_subject', type: DataTypes.STRING(80) },
      { name: 'sub_category',   type: DataTypes.STRING(100) },
      { name: 'priority',       type: DataTypes.STRING(20) },
      { name: 'link',           type: DataTypes.STRING(255) },
      { name: 'user_id',        type: DataTypes.INTEGER },
    ];

    for (const col of notifCols) {
      if (!notifsDesc[col.name]) {
        console.log(`[MIGRATOR] Adding column ${col.name} to notifications`);
        await qi.addColumn('notifications', col.name, {
          type: col.type,
          allowNull: true,
        });
      }
    }
    console.log('[MIGRATOR] ✅ Notification custom subcategory and targeting columns verified.');
  } catch (err) {
    console.error('[MIGRATOR] ❌ Notification columns migration notice:', err.message);
  }
}


async function migrateTeacherColumns() {
  try {
    const qi = sequelize.getQueryInterface();
    const teachersDesc = await qi.describeTable('teachers').catch(() => null);
    if (!teachersDesc) return;
    const { DataTypes } = require('sequelize');

    const cols = [
      { name: 'teacher_id',       type: DataTypes.STRING(20) },
      { name: 'staff_type',       type: DataTypes.STRING(50) },
      { name: 'document_type',   type: DataTypes.STRING(50) },
      { name: 'document_number', type: DataTypes.STRING(100) },
      { name: 'assigned_classes',type: DataTypes.TEXT },
      { name: 'qualification',   type: DataTypes.STRING(100) },
      { name: 'join_date',       type: DataTypes.DATEONLY },
      { name: 'status',          type: DataTypes.ENUM('active', 'leave', 'inactive') },
      { name: 'phone',           type: DataTypes.STRING(15) },
      { name: 'email',           type: DataTypes.STRING(150) },
      { name: 'subject',         type: DataTypes.STRING(255) },
    ];

    for (const col of cols) {
      if (!teachersDesc[col.name]) {
        console.log(`[MIGRATOR] Adding column ${col.name} to teachers`);
        await qi.addColumn('teachers', col.name, {
          type: col.type,
          allowNull: true,
        }).catch(() => {});
      }
    }
    console.log('[MIGRATOR] ✅ Teacher columns verified.');
  } catch (err) {
    console.error('[MIGRATOR] ❌ Teacher columns migration notice:', err.message);
  }
}

async function migrateUserColumns() {
  try {
    const qi = sequelize.getQueryInterface();
    const usersDesc = await qi.describeTable('users').catch(() => null);
    if (!usersDesc) return;
    const { DataTypes } = require('sequelize');

    const cols = [
      { name: 'linked_teacher_id',   type: DataTypes.INTEGER },
      { name: 'linked_student_id',   type: DataTypes.INTEGER },
      { name: 'profile_photo',       type: DataTypes.TEXT('long') },
      { name: 'phone',               type: DataTypes.STRING(15) },
      { name: 'password_changed_at', type: DataTypes.DATE },
      { name: 'login_attempts',     type: DataTypes.INTEGER },
      { name: 'lock_until',          type: DataTypes.DATE },
    ];

    for (const col of cols) {
      if (!usersDesc[col.name]) {
        console.log(`[MIGRATOR] Adding column ${col.name} to users`);
        await qi.addColumn('users', col.name, {
          type: col.type,
          allowNull: true,
        }).catch(() => {});
      }
    }
    console.log('[MIGRATOR] ✅ User columns verified.');
  } catch (err) {
    console.error('[MIGRATOR] ❌ User columns migration notice:', err.message);
  }
}


async function migrateStudentPhotos() {
  const { Op } = require('sequelize');
  try {
    const dialect = typeof sequelize.getDialect === 'function' ? sequelize.getDialect() : '';
    if (dialect === 'mysql') {
      await sequelize.query('ALTER TABLE `users` MODIFY COLUMN `profile_photo` LONGTEXT NULL;').catch(() => {});
      await sequelize.query('ALTER TABLE `students` MODIFY COLUMN `profile_photo` LONGTEXT NULL;').catch(() => {});
      await sequelize.query('ALTER TABLE `students` MODIFY COLUMN `passport_photo` LONGTEXT NULL;').catch(() => {});
      await sequelize.query('ALTER TABLE `admission_requests` MODIFY COLUMN `passport_photo` LONGTEXT NULL;').catch(() => {});
    }

    // 1. Copy between passport_photo and profile_photo in students table
    await sequelize.query(`
      UPDATE students 
      SET profile_photo = passport_photo 
      WHERE (profile_photo IS NULL OR profile_photo = '') 
        AND passport_photo IS NOT NULL AND passport_photo != '';
    `).catch(() => {});

    await sequelize.query(`
      UPDATE students 
      SET passport_photo = profile_photo 
      WHERE (passport_photo IS NULL OR passport_photo = '') 
        AND profile_photo IS NOT NULL AND profile_photo != '';
    `).catch(() => {});

    // 2. Backfill photos from admission_requests to students
    try {
      const admissionRequests = await AdmissionRequest.findAll({
        where: {
          passport_photo: { [Op.ne]: null }
        },
        attributes: ['id', 'student_id_created', 'first_name', 'last_name', 'parent_phone', 'passport_photo', 'form_no']
      });

      for (const req of admissionRequests) {
        if (!req.passport_photo) continue;
        if (req.student_id_created) {
          await Student.update(
            { passport_photo: req.passport_photo, profile_photo: req.passport_photo },
            { where: { id: req.student_id_created, profile_photo: null } }
          ).catch(() => {});
        }
        if (req.form_no) {
          await Student.update(
            { passport_photo: req.passport_photo, profile_photo: req.passport_photo },
            { where: { form_no: req.form_no, profile_photo: null } }
          ).catch(() => {});
        }
      }
    } catch (e) {}

    // 3. Sync student photos to linked users
    try {
      const studentsWithPhoto = await Student.findAll({
        where: {
          profile_photo: { [Op.ne]: null }
        },
        attributes: ['id', 'profile_photo']
      });

      for (const s of studentsWithPhoto) {
        if (s.profile_photo) {
          await User.update(
            { profile_photo: s.profile_photo },
            { where: { linked_student_id: s.id } }
          ).catch(() => {});
        }
      }
    } catch (e) {}

    console.log('[MIGRATOR] ✅ Student photographs synchronized across database.');
  } catch (err) {
    console.warn('[MIGRATOR] Student photo migration notice:', err.message);
  }
}

async function syncApprovedStudentAccounts() {
  const { Op } = require('sequelize');
  try {
    // 1. Any student linked to an approved admission request should be approved & active
    const approvedAdmissions = await AdmissionRequest.findAll({
      where: { status: 'approved' },
      attributes: ['id', 'student_id_created', 'first_name', 'last_name', 'parent_phone', 'parent_email']
    });

    for (const adm of approvedAdmissions) {
      if (adm.student_id_created) {
        await Student.update(
          { approval_status: 'approved', is_active: true, student_status: 'active' },
          { where: { id: adm.student_id_created, approval_status: 'pending' } }
        ).catch(() => {});
        await User.update(
          { is_active: true },
          { where: { linked_student_id: adm.student_id_created, is_active: false } }
        ).catch(() => {});
      }
    }

    // 2. Any active student in students table must have approval_status = 'approved'
    await Student.update(
      { approval_status: 'approved' },
      { where: { is_active: true, approval_status: 'pending' } }
    ).catch(() => {});

    // 3. Any student with a user account (or active student status) must have approval_status = 'approved'
    const studentUsers = await User.findAll({
      where: { role: { [Op.in]: ['student', 'parent'] }, linked_student_id: { [Op.ne]: null } },
      attributes: ['id', 'linked_student_id', 'is_active']
    });
    for (const u of studentUsers) {
      if (u.linked_student_id) {
        await Student.update(
          { approval_status: 'approved', is_active: true, student_status: 'active' },
          { where: { id: u.linked_student_id } }
        ).catch(() => {});
        if (!u.is_active) {
          await u.update({ is_active: true }).catch(() => {});
        }
      }
    }

    // 4. Auto-link any unlinked student or parent users by matching email with student records
    const unlinkedUsers = await User.findAll({
      where: {
        role: { [Op.in]: ['student', 'parent'] },
        linked_student_id: null
      },
      attributes: ['id', 'email', 'is_active', 'role']
    });

    for (const u of unlinkedUsers) {
      if (!u.email) continue;
      const match = await Student.findOne({
        where: {
          [Op.or]: [
            sequelize.where(sequelize.fn('LOWER', sequelize.col('parent_email')), u.email.toLowerCase()),
            sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), u.email.toLowerCase()),
            sequelize.where(sequelize.fn('LOWER', sequelize.col('student_id')), u.email.toLowerCase().replace(/[^a-z0-9]/gi, '')),
          ]
        }
      });
      if (match) {
        await u.update({ linked_student_id: match.id, is_active: true }).catch(() => {});
        await match.update({ approval_status: 'approved', is_active: true, student_status: 'active' }).catch(() => {});
      }
    }

    // 5. Sync from approved admission requests
    const approvedAdmissionsList = await AdmissionRequest.findAll({
      where: { status: 'approved' },
      attributes: ['id', 'student_id_created', 'email', 'parent_email']
    });
    for (const adm of approvedAdmissionsList) {
      const parentMail = adm.parent_email?.toLowerCase();
      const studentMail = adm.email?.toLowerCase();
      if (parentMail || studentMail) {
        await Student.update(
          { approval_status: 'approved', is_active: true, student_status: 'active' },
          {
            where: {
              [Op.or]: [
                ...(parentMail ? [sequelize.where(sequelize.fn('LOWER', sequelize.col('parent_email')), parentMail)] : []),
                ...(studentMail ? [sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), studentMail)] : [])
              ]
            }
          }
        ).catch(() => {});

        await User.update(
          { is_active: true },
          {
            where: {
              role: { [Op.in]: ['student', 'parent'] },
              [Op.or]: [
                ...(parentMail ? [sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), parentMail)] : []),
                ...(studentMail ? [sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), studentMail)] : [])
              ]
            }
          }
        ).catch(() => {});
      }
    }
    console.log('[MIGRATOR] ✅ Approved student accounts and user links synchronized.');
  } catch (err) {
    console.warn('[MIGRATOR] Student approval account sync notice:', err.message);
  }
}

module.exports = {
  migrateTeacherColumns,
  migrateUserColumns,
  migratePendingStudents,
  migrateFeeColumns,
  migrateTeacherSubjectColumn,
  migrateDatesheetAndAchievementTables,
  migrateSessionAttendanceAndPromotionColumns,
  migrateStudentMarksheetColumns,
  migrateActiveSession,
  migrateAdmissionRequestColumns,
  migrateStudentPhotos,
  migrateNotificationColumns,
  syncApprovedStudentAccounts,
};

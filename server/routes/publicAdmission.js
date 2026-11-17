const express = require('express');
const router = express.Router();
const { AdmissionRequest, Notification, User, Setting, sequelize } = require('../models');
const { Op } = require('sequelize');

const ADMISSION_CLASSES = [
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
  'Class 8'
];

const REQUIRED_DOCUMENTS = [
  'Birth Certificate (Age Proof)',
  'Passport Size Photographs (2)',
  'Previous School Report (if any)',
  'Aadhaar Card (Student & Parents)',
  'Address Proof'
];

// Helper to ensure admission_requests schema is migrated on any database engine
let schemaEnsured = false;
const ensureAdmissionSchema = async () => {
  if (schemaEnsured) return;
  try {
    const qi = sequelize.getQueryInterface();
    const tableDesc = await qi.describeTable('admission_requests').catch(() => null);
    if (!tableDesc) {
      await AdmissionRequest.sync();
    } else {
      const requiredColumns = [
        { name: 'form_no',            sql: 'ALTER TABLE `admission_requests` ADD COLUMN `form_no` VARCHAR(40) NULL;' },
        { name: 'father_name',        sql: 'ALTER TABLE `admission_requests` ADD COLUMN `father_name` VARCHAR(100) NULL;' },
        { name: 'father_occupation',  sql: 'ALTER TABLE `admission_requests` ADD COLUMN `father_occupation` VARCHAR(100) NULL;' },
        { name: 'father_phone',       sql: 'ALTER TABLE `admission_requests` ADD COLUMN `father_phone` VARCHAR(20) NULL;' },
        { name: 'father_whatsapp',    sql: 'ALTER TABLE `admission_requests` ADD COLUMN `father_whatsapp` VARCHAR(20) NULL;' },
        { name: 'mother_name',        sql: 'ALTER TABLE `admission_requests` ADD COLUMN `mother_name` VARCHAR(100) NULL;' },
        { name: 'mother_occupation',  sql: 'ALTER TABLE `admission_requests` ADD COLUMN `mother_occupation` VARCHAR(100) NULL;' },
        { name: 'mother_phone',       sql: 'ALTER TABLE `admission_requests` ADD COLUMN `mother_phone` VARCHAR(20) NULL;' },
        { name: 'mother_whatsapp',    sql: 'ALTER TABLE `admission_requests` ADD COLUMN `mother_whatsapp` VARCHAR(20) NULL;' },
        { name: 'aadhar_number',      sql: 'ALTER TABLE `admission_requests` ADD COLUMN `aadhar_number` VARCHAR(30) NULL;' },
        { name: 'passport_photo',     sql: 'ALTER TABLE `admission_requests` ADD COLUMN `passport_photo` LONGTEXT NULL;' },
        { name: 'residential_address',sql: 'ALTER TABLE `admission_requests` ADD COLUMN `residential_address` TEXT NULL;' },
        { name: 'post_office_tehsil', sql: 'ALTER TABLE `admission_requests` ADD COLUMN `post_office_tehsil` VARCHAR(120) NULL;' },
        { name: 'district',           sql: 'ALTER TABLE `admission_requests` ADD COLUMN `district` VARCHAR(80) NULL;' },
        { name: 'pin_code',           sql: 'ALTER TABLE `admission_requests` ADD COLUMN `pin_code` VARCHAR(15) NULL;' },
        { name: 'application_date',   sql: 'ALTER TABLE `admission_requests` ADD COLUMN `application_date` DATE NULL;' },
        { name: 'enquiry_mode',       sql: 'ALTER TABLE `admission_requests` ADD COLUMN `enquiry_mode` VARCHAR(50) NULL;' },
        { name: 'remarks',            sql: 'ALTER TABLE `admission_requests` ADD COLUMN `remarks` TEXT NULL;' },
        { name: 'source',             sql: 'ALTER TABLE `admission_requests` ADD COLUMN `source` VARCHAR(40) DEFAULT \'public_portal\';' },
        { name: 'documents_submitted',sql: 'ALTER TABLE `admission_requests` ADD COLUMN `documents_submitted` JSON NULL;' },
      ];
      for (const col of requiredColumns) {
        if (!tableDesc[col.name]) {
          try {
            await sequelize.query(col.sql);
          } catch (e) {
            // ER_DUP_FIELDNAME or already added
          }
        }
      }
    }
    schemaEnsured = true;
  } catch (err) {
    console.warn('[Admission] Schema check notice:', err.message);
  }
};

// Helper to generate sequential Form No: ICS-YYYY-XXXX
const generateFormNumber = async () => {
  await ensureAdmissionSchema();
  const currentYear = new Date().getFullYear();
  let nextSeq = 1;

  try {
    const yearStart = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${currentYear}-12-31T23:59:59.999Z`);

    const count = await AdmissionRequest.count({
      where: {
        created_at: {
          [Op.between]: [yearStart, yearEnd]
        }
      }
    });
    nextSeq = count + 1;
  } catch (err) {
    console.warn('[Admission] count fallback:', err.message);
    nextSeq = Math.floor(1000 + Math.random() * 9000);
  }

  const seqPadded = String(nextSeq).padStart(4, '0');
  let formNo = `ICS-${currentYear}-${seqPadded}`;

  // Double check uniqueness safely
  try {
    let exists = await AdmissionRequest.findOne({ where: { form_no: formNo } });
    let counter = 1;
    while (exists && counter < 50) {
      formNo = `ICS-${currentYear}-${String(nextSeq + counter).padStart(4, '0')}`;
      exists = await AdmissionRequest.findOne({ where: { form_no: formNo } });
      counter++;
    }
  } catch (err) {
    console.warn('[Admission] form_no lookup fallback:', err.message);
    formNo = `ICS-${currentYear}-${Date.now().toString().slice(-4)}`;
  }

  return formNo;
};

// GET /api/public/admission/config
router.get('/config', async (req, res) => {
  try {
    await ensureAdmissionSchema();
    const settings = await Setting.findAll();
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });

    let schoolLogo = settingsMap.school_logo_url || settingsMap.logo_url || settingsMap.school_logo || '';
    if (!schoolLogo) {
      try {
        const adminUser = await User.findOne({
          where: { role: 'admin', is_active: true },
          attributes: ['profile_photo'],
          order: [['id', 'ASC']]
        });
        if (adminUser?.profile_photo) schoolLogo = adminUser.profile_photo;
      } catch (e) {}
    }

    res.json({
      school_name:     settingsMap.school_name || 'International Cambridge School Kishtwar',
      school_subtitle: settingsMap.school_subtitle || 'Building Bright Futures',
      school_tagline:  'Quality Education for a Brighter Tomorrow',
      school_address:  settingsMap.school_address || 'Ward No. 7, Shaheedi Mohallah, Kishtwar',
      school_logo_url: schoolLogo,
      contacts: [
        { name: 'Dr Arshad Kichloo', phone: '7780959880' },
        { name: 'Mr Sumit Kumar',    phone: '9797520072' },
      ],
      classes: ADMISSION_CLASSES,
      documents_required: REQUIRED_DOCUMENTS,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/public/admission
router.post('/', async (req, res) => {
  await ensureAdmissionSchema();
  const txn = await sequelize.transaction();
  try {
    const body = req.body || {};

    // 1. Student Name resolution (Mandatory)
    let firstName = (body.first_name || '').trim();
    let lastName = (body.last_name || '').trim();

    if (!firstName && body.student_name) {
      const parts = body.student_name.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '.';
    }

    if (!firstName) {
      await txn.rollback();
      return res.status(400).json({ message: 'Student Name is required.' });
    }
    if (!lastName) lastName = '.';

    // 2. Date of Birth (Mandatory)
    const dob = (body.date_of_birth || '').trim();
    if (!dob) {
      await txn.rollback();
      return res.status(400).json({ message: 'Date of Birth is required.' });
    }

    // 3. Gender (Mandatory)
    const gender = (body.gender || '').trim();
    if (!gender) {
      await txn.rollback();
      return res.status(400).json({ message: 'Gender is required.' });
    }

    // 4. Class Applying For (Mandatory)
    const applyingClass = (body.applying_class || '').trim();
    if (!applyingClass) {
      await txn.rollback();
      return res.status(400).json({ message: 'Please select Class applying for.' });
    }

    // 5. Passport Photograph (Mandatory)
    const passportPhoto = (body.passport_photo || '').trim();
    if (!passportPhoto) {
      await txn.rollback();
      return res.status(400).json({ message: "Student's passport-size photograph is required." });
    }

    // 6. Parentage (Mandatory)
    const fatherName = (body.father_name || body.parent_name || '').trim();
    if (!fatherName) {
      await txn.rollback();
      return res.status(400).json({ message: "Father's Name is required." });
    }

    const fatherPhone = (body.father_phone || body.parent_phone || '').trim();
    if (!fatherPhone) {
      await txn.rollback();
      return res.status(400).json({ message: "Father's Contact Phone Number is required." });
    }

    const motherName = (body.mother_name || '').trim();
    if (!motherName) {
      await txn.rollback();
      return res.status(400).json({ message: "Mother's Name is required." });
    }

    // 7. Residential Address & Location (Mandatory)
    const residentialAddress = (body.residential_address || body.parent_address || '').trim();
    if (!residentialAddress) {
      await txn.rollback();
      return res.status(400).json({ message: 'Residential Address is required.' });
    }

    const district = (body.district || 'Kishtwar').trim();
    if (!district) {
      await txn.rollback();
      return res.status(400).json({ message: 'District is required.' });
    }

    const pinCode = (body.pin_code || '').trim();
    if (!pinCode) {
      await txn.rollback();
      return res.status(400).json({ message: 'Pin Code is required.' });
    }

    const parentName = fatherName || motherName || 'Parent / Guardian';
    const motherPhone = (body.mother_phone || '').trim();
    const parentPhone = fatherPhone || motherPhone;

    const formNo = await generateFormNumber();
    const applicationDate = body.application_date || new Date().toISOString().split('T')[0];

    const admission = await AdmissionRequest.create({
      form_no:             formNo,
      first_name:          firstName,
      last_name:           lastName,
      date_of_birth:       dob,
      gender:              gender,
      applying_class:      applyingClass,
      previous_school:     body.previous_school || null,
      aadhar_number:       body.aadhar_number || null,
      passport_photo:      passportPhoto,

      parent_name:         parentName,
      father_name:         fatherName,
      father_occupation:   body.father_occupation || null,
      father_phone:        fatherPhone,
      father_whatsapp:     body.father_whatsapp || fatherPhone,
      mother_name:         motherName,
      mother_occupation:   body.mother_occupation || null,
      mother_phone:        motherPhone || null,
      mother_whatsapp:     body.mother_whatsapp || motherPhone || null,
      parent_phone:        parentPhone,
      parent_email:        body.parent_email || null,

      parent_address:      residentialAddress,
      residential_address: residentialAddress,
      post_office_tehsil:  body.post_office_tehsil || null,
      district:            district,
      pin_code:            pinCode,

      application_date:    applicationDate,
      enquiry_mode:        body.enquiry_mode || 'Online',
      remarks:             body.remarks || null,
      documents_submitted: Array.isArray(body.documents_submitted) ? body.documents_submitted : [],

      status:              'pending',
      source:              'public_portal',
      submitted_by:        null,
      admission_fee_paid:  0,
    }, { transaction: txn });

    await txn.commit();

    // Broadcast in-app notification to all administrators
    try {
      const admins = await User.findAll({
        where: {
          role: { [Op.in]: ['admin', 'admin2', 'superadmin', 'super_admin'] },
          is_active: true
        }
      });

      for (const adm of admins) {
        await Notification.create({
          user_id: adm.id,
          type:    'admission',
          title:   'New Online Admission Application',
          message: `${firstName} ${lastName} applied for ${applyingClass} (Form No: ${formNo}). Please review and approve.`,
          link:    '/admin/admissions',
        }).catch(() => {});
      }
    } catch (notifErr) {
      console.warn('[PUBLIC ADMISSION] Admin notification error:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Admission form submitted successfully! Your application is now pending admin approval.',
      form_no: formNo,
      data: admission
    });
  } catch (err) {
    await txn.rollback();
    console.error('[PUBLIC ADMISSION ERROR]', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/public/admission/status/:form_no
router.get('/status/:form_no', async (req, res) => {
  try {
    await ensureAdmissionSchema();
    const admission = await AdmissionRequest.findOne({
      where: { form_no: req.params.form_no },
      attributes: [
        'id', 'form_no', 'first_name', 'last_name', 'applying_class',
        'passport_photo', 'parent_name', 'parent_phone',
        'status', 'application_date', 'review_notes', 'approved_at', 'created_at'
      ]
    });

    if (!admission) {
      return res.status(404).json({ message: 'Admission application not found.' });
    }

    res.json(admission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

    if (!admission) {
      return res.status(404).json({ message: 'Admission application not found.' });
    }

    res.json(admission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

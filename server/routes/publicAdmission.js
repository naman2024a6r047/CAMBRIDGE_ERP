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

// Helper to generate sequential Form No: ICS-YYYY-XXXX
const generateFormNumber = async () => {
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(`${currentYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${currentYear}-12-31T23:59:59.999Z`);

  const count = await AdmissionRequest.count({
    where: {
      created_at: {
        [Op.between]: [yearStart, yearEnd]
      }
    }
  });

  const nextSeq = count + 1;
  const seqPadded = String(nextSeq).padStart(4, '0');
  let formNo = `ICS-${currentYear}-${seqPadded}`;

  // Double check uniqueness
  let exists = await AdmissionRequest.findOne({ where: { form_no: formNo } });
  let counter = 1;
  while (exists) {
    formNo = `ICS-${currentYear}-${String(nextSeq + counter).padStart(4, '0')}`;
    exists = await AdmissionRequest.findOne({ where: { form_no: formNo } });
    counter++;
  }

  return formNo;
};

// GET /api/public/admission/config
router.get('/config', async (req, res) => {
  try {
    const settings = await Setting.findAll();
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });

    res.json({
      school_name:     settingsMap.school_name || 'International Cambridge School Kishtwar',
      school_subtitle: settingsMap.school_subtitle || 'Building Bright Futures',
      school_tagline:  'Quality Education for a Brighter Tomorrow',
      school_address:  settingsMap.school_address || 'Ward No. 7, Shaheedi Mohallah, Kishtwar',
      school_logo_url: settingsMap.school_logo_url || '',
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
  const txn = await sequelize.transaction();
  try {
    const body = req.body || {};

    // 1. Student Name resolution
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

    // 2. Class Applying For
    const applyingClass = (body.applying_class || '').trim();
    if (!applyingClass) {
      await txn.rollback();
      return res.status(400).json({ message: 'Please select Class applying for.' });
    }

    // 3. Parentage
    const fatherName = (body.father_name || body.parent_name || '').trim();
    const motherName = (body.mother_name || '').trim();
    const parentName = fatherName || motherName || 'Parent / Guardian';

    const fatherPhone = (body.father_phone || body.parent_phone || '').trim();
    const motherPhone = (body.mother_phone || '').trim();
    const parentPhone = fatherPhone || motherPhone;

    if (!parentPhone) {
      await txn.rollback();
      return res.status(400).json({ message: 'Contact phone number is required.' });
    }

    const formNo = await generateFormNumber();
    const applicationDate = body.application_date || new Date().toISOString().split('T')[0];

    const admission = await AdmissionRequest.create({
      form_no:             formNo,
      first_name:          firstName,
      last_name:           lastName,
      date_of_birth:       body.date_of_birth || null,
      gender:              body.gender || 'Other',
      applying_class:      applyingClass,
      previous_school:     body.previous_school || null,
      aadhar_number:       body.aadhar_number || null,
      passport_photo:      body.passport_photo || null,

      parent_name:         parentName,
      father_name:         fatherName,
      father_occupation:   body.father_occupation || null,
      father_phone:        fatherPhone,
      father_whatsapp:     body.father_whatsapp || fatherPhone,
      mother_name:         motherName,
      mother_occupation:   body.mother_occupation || null,
      mother_phone:        motherPhone,
      mother_whatsapp:     body.mother_whatsapp || motherPhone,
      parent_phone:        parentPhone,
      parent_email:        body.parent_email || null,

      parent_address:      body.residential_address || body.parent_address || null,
      residential_address: body.residential_address || body.parent_address || null,
      post_office_tehsil:  body.post_office_tehsil || null,
      district:            body.district || 'Kishtwar',
      pin_code:            body.pin_code || null,

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
    const admission = await AdmissionRequest.findOne({
      where: { form_no: req.params.form_no },
      attributes: [
        'id', 'form_no', 'first_name', 'last_name', 'applying_class',
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

module.exports = router;

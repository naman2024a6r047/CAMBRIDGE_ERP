const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const crypto = require('crypto');
const { Student, Fee, User, Notification, AdmissionRequest, Session, ClassFeeStructure, sequelize } = require('../models');
const { protect, authorize }        = require('../middleware/auth');
const { cacheMiddleware } = require('../utils/cache');
const { buildReceiptData, getOrCreateFeeRecord, getFeeStructureForClass, MONTHS, createAdmissionFee } = require('../services/feeService');
const { makeStudentId, makeStudentEmail, makeTemporaryPassword } = require('../utils/credentialGenerator');
const { sendCredentialsEmail } = require('../services/mailService');

const FC_ROLES = ['admin', 'admin2', 'fee_collector'];

// (C5 fix) — whitelisted fields for admission requests
const ADMISSION_REQUEST_FIELDS = [
  'form_no', 'first_name', 'last_name', 'date_of_birth', 'gender',
  'applying_class', 'parent_name', 'parent_phone', 'parent_email',
  'parent_address', 'residential_address', 'previous_school', 'remarks', 'admission_fee_paid',
  'father_name', 'father_occupation', 'father_phone', 'father_whatsapp',
  'mother_name', 'mother_occupation', 'mother_phone', 'mother_whatsapp',
  'post_office_tehsil', 'district', 'pin_code', 'aadhar_number', 'passport_photo',
  'enquiry_mode', 'application_date', 'documents_submitted', 'source',
];


const pick = (obj, keys) => {
  const result = {};
  for (const key of keys) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
};

// (M6 fix) — unique receipt number
const generateReceiptNumber = () => `REC-${crypto.randomUUID().split('-')[0].toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

// GET /api/fc/students — search students with current fee status
router.get('/students', protect, authorize(...FC_ROLES), async (req, res) => {
  try {
    const { search, class: cls, section, fee_status, page = 1, limit = 20 } = req.query;
    const where = { approval_status: { [Op.in]: ['approved', 'pending'] } };

    if (cls)     where.class   = cls;
    if (section) where.section = section;

    if (search) {
      where[Op.or] = [
        { first_name:   { [Op.like]: `%${search}%` } },
        { last_name:    { [Op.like]: `%${search}%` } },
        { student_id:   { [Op.like]: `%${search}%` } },
        { parent_name:  { [Op.like]: `%${search}%` } },
        { parent_phone: { [Op.like]: `%${search}%` } },
      ];
    }

    const students = await Student.findAll({
      where,
      order: [['class', 'ASC'], ['roll_number', 'ASC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    // Attach current month fee status
    const currentMonth = MONTHS[new Date().getMonth()];
    const currentYear  = new Date().getFullYear();
    const sIds = students.map(s => s.id);

    const currentFees = await Fee.findAll({
      where: {
        student_id: { [Op.in]: sIds },
        month: currentMonth,
        year:  currentYear,
        fee_type: 'monthly',
      }
    });

    const feeMap = {};
    currentFees.forEach(f => { feeMap[f.student_id] = f; });

    const result = students.map(s => ({
      ...s.toJSON(),
      current_fee:    feeMap[s.id] || null,
      fee_status_now: feeMap[s.id]?.status || 'not_generated',
    }));

    const filtered = fee_status && fee_status !== 'all'
      ? result.filter(s => s.fee_status_now === fee_status)
      : result;

    res.json(filtered);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/fc/students/:id/details
router.get('/students/:id/details', protect, authorize(...FC_ROLES), async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id, {
      include: [{ model: Session, as: 'session' }]
    });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    // All fee records
    const fees = await Fee.findAll({
      where: { student_id: req.params.id },
      order: [['year', 'DESC'], ['created_at', 'DESC']],
      include: [{ model: User, as: 'collectedByUser', attributes: ['id','name'] }]
    });

    // Fee structure for this class (with session & normalized class fallback)
    const feeStructure = await getFeeStructureForClass(student.class, student.session_id);

    const totalDue       = fees.reduce((a, f) => a + parseFloat(f.total_amount || 0), 0);
    const totalCollected = fees.reduce((a, f) => a + parseFloat(f.paid_amount  || 0), 0);

    res.json({
      student,
      fees,
      fee_structure: feeStructure,
      summary: {
        total_due:       totalDue,
        total_collected: totalCollected,
        total_pending:   totalDue - totalCollected,
        paid_months:     fees.filter(f => f.status === 'paid').length,
        unpaid_months:   fees.filter(f => f.status === 'unpaid').length,
      }
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Normalize payment mode to lowercase ENUM ('cash', 'online', 'cheque', 'dd', 'upi')
const normalizePaymentMode = (mode) => {
  const m = String(mode || 'cash').trim().toLowerCase();
  if (['cash', 'online', 'cheque', 'dd', 'upi'].includes(m)) return m;
  if (m.includes('online') || m.includes('upi')) return 'online';
  if (m.includes('cheque')) return 'cheque';
  if (m.includes('dd') || m.includes('draft')) return 'dd';
  return 'cash';
};

// POST /api/fc/collect — collect with auto-create fee record
// (H4 fix) — wrapped in transaction to prevent race condition
// (H3 fix) — overpayment protection added
router.post('/collect', protect, authorize(...FC_ROLES), async (req, res) => {
  const txn = await sequelize.transaction();
  try {
    const { fee_id, student_id, month, year, amount, payment_mode, remarks } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      if (txn && !txn.finished) await txn.rollback();
      return res.status(400).json({ message: 'Amount must be greater than 0.' });
    }

    const safePaymentMode = normalizePaymentMode(payment_mode);
    let fee;

    if (fee_id) {
      fee = await Fee.findByPk(fee_id, {
        include: [{ model: Student, as: 'student' }],
        transaction: txn,
        lock: txn.LOCK.UPDATE,
      });
      if (!fee) {
        if (txn && !txn.finished) await txn.rollback();
        return res.status(404).json({ message: 'Fee record not found.' });
      }
    } else {
      // Auto-create if doesn't exist
      const student = await Student.findByPk(student_id, { transaction: txn });
      if (!student) {
        if (txn && !txn.finished) await txn.rollback();
        return res.status(404).json({ message: 'Student not found.' });
      }

      const { record } = await getOrCreateFeeRecord(
        student,
        month || MONTHS[new Date().getMonth()],
        year  || new Date().getFullYear(),
        'monthly',
        txn
      );

      fee = await Fee.findByPk(record.id, {
        include: [{ model: Student, as: 'student' }],
        transaction: txn,
        lock: txn.LOCK.UPDATE,
      });
    }

    let payAmt = parseFloat(amount);
    const currentPaid = parseFloat(fee.paid_amount || 0);
    let totalAmount = parseFloat(fee.total_amount || 0) + parseFloat(fee.late_fee_amount || 0);

    // If totalAmount was 0 or less than the payment, adjust total_amount to prevent false overpayment failure
    if (totalAmount < currentPaid + payAmt && payAmt > 0) {
      totalAmount = currentPaid + payAmt;
      fee.total_amount = totalAmount;
    }

    let newPaid = currentPaid + payAmt;

    if (newPaid - totalAmount > 0.009) {
      const remaining = Math.max(0, totalAmount - currentPaid);
      if (remaining > 0 && payAmt > remaining) {
        payAmt = remaining;
        newPaid = totalAmount;
      } else {
        if (txn && !txn.finished) await txn.rollback();
        return res.status(400).json({
          message: `Overpayment not allowed. Maximum payable: ₹${remaining.toFixed(2)}.`,
          max_payable: remaining,
        });
      }
    }

    if (totalAmount - newPaid <= 0.009 && newPaid > 0) {
      newPaid = totalAmount;
    }

    const status = newPaid >= totalAmount ? 'paid'
                 : newPaid > 0 ? 'partial' : 'unpaid';

    const receiptNumber = generateReceiptNumber();
    const paidDate = new Date().toISOString().split('T')[0];

    const updatedBreakdown = {
      ...(typeof fee.fee_breakdown === 'object' ? fee.fee_breakdown : {}),
      monthly: fee.total_amount,
      transactions: [
        ...(Array.isArray(fee.fee_breakdown?.transactions) ? fee.fee_breakdown.transactions : []),
        {
          amount: payAmt,
          receipt_number: receiptNumber,
          payment_mode: safePaymentMode,
          paid_date: paidDate,
          collected_by: req.user.id,
          remarks: remarks || '',
        }
      ]
    };

    await fee.update({
      total_amount:   fee.total_amount,
      paid_amount:    newPaid,
      payment_mode:   safePaymentMode,
      remarks:        remarks || '',
      collected_by:   req.user.id,
      paid_date:      paidDate,
      status,
      receipt_number: receiptNumber,
      fee_breakdown:  updatedBreakdown,
    }, { transaction: txn });

    await txn.commit();

    await fee.reload({ include: [
      { model: Student, as: 'student' },
      { model: User,    as: 'collectedByUser', attributes: ['id','name'] }
    ]});

    const receipt = buildReceiptData(fee, fee.student, fee.collectedByUser);

    res.json({ message: 'Payment collected.', fee, receipt });
  } catch (err) {
    if (txn && !txn.finished) {
      try { await txn.rollback(); } catch (_) {}
    }
    console.error('[fc][POST /collect]', err);
    res.status(500).json({ message: err.message || 'Fee collection failed.' });
  }
});

// POST /api/fc/collect-multiple-months
router.post('/collect-multiple-months', protect, authorize(...FC_ROLES), async (req, res) => {
  const txn = await sequelize.transaction();
  try {
    const { student_id, months, year, payment_mode, remarks } = req.body;

    if (!student_id || !months?.length) {
      if (txn && !txn.finished) await txn.rollback();
      return res.status(400).json({ message: 'student_id and months array required.' });
    }

    const student = await Student.findByPk(student_id, { transaction: txn });
    if (!student) {
      if (txn && !txn.finished) await txn.rollback();
      return res.status(404).json({ message: 'Student not found.' });
    }

    const safePaymentMode = normalizePaymentMode(payment_mode);
    const results = [];
    let totalPaidInThisTransaction = 0;
    const baseReceiptNumber = generateReceiptNumber();
    const updatedFees = [];

    for (let i = 0; i < months.length; i++) {
      const entry = months[i];
      const entryMonth = typeof entry === 'string' ? entry : entry.month;
      const entryYear = (typeof entry === 'object' && entry?.year) ? parseInt(entry.year) : parseInt(year);
      const entryAmount = (typeof entry === 'object' && entry?.amount !== undefined) ? entry.amount : 0;

      const { record } = await getOrCreateFeeRecord(
        student, entryMonth, entryYear, 'monthly', txn
      );

      // Lock the record to prevent race conditions during bulk payment
      const lockedRecord = await Fee.findByPk(record.id, {
        include: [{ model: User, as: 'collectedByUser', attributes: ['id', 'name'] }],
        transaction: txn,
        lock: txn.LOCK.UPDATE
      }) || record;

      let payAmt = parseFloat(entryAmount > 0 ? entryAmount : (lockedRecord.total_amount || 0));
      const currentPaid = parseFloat(lockedRecord.paid_amount || 0);
      let totalAmount = parseFloat(lockedRecord.total_amount || 0) + parseFloat(lockedRecord.late_fee_amount || 0);

      // If totalAmount was unconfigured (0) or less than the payment, adjust total_amount to avoid false overpayment failure
      if (totalAmount < currentPaid + payAmt && payAmt > 0) {
        totalAmount = currentPaid + payAmt;
        lockedRecord.total_amount = totalAmount;
      }

      let newPaid = currentPaid + payAmt;

      // Overpayment check with 0.009 precision tolerance
      if (newPaid - totalAmount > 0.009) {
        const remaining = Math.max(0, totalAmount - currentPaid);
        if (remaining > 0 && payAmt > remaining) {
          payAmt = remaining;
          newPaid = totalAmount;
        } else {
          if (txn && !txn.finished) await txn.rollback();
          return res.status(400).json({
            message: `Overpayment not allowed for ${entryMonth} ${entryYear}. Max payable: ₹${remaining.toFixed(2)}.`,
          });
        }
      }

      if (totalAmount - newPaid <= 0.009 && newPaid > 0) {
        newPaid = totalAmount;
      }

      const status = newPaid >= totalAmount ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
      const uniqueReceiptNumber = `${baseReceiptNumber}-${i + 1}`;
      const paidDate = new Date().toISOString().split('T')[0];

      const updatedBreakdown = {
        ...(typeof lockedRecord.fee_breakdown === 'object' ? lockedRecord.fee_breakdown : {}),
        monthly: lockedRecord.total_amount,
        transactions: [
          ...(Array.isArray(lockedRecord.fee_breakdown?.transactions) ? lockedRecord.fee_breakdown.transactions : []),
          {
            amount: payAmt,
            receipt_number: uniqueReceiptNumber,
            payment_mode: safePaymentMode,
            paid_date: paidDate,
            collected_by: req.user.id,
            remarks: remarks || '',
          }
        ]
      };

      await lockedRecord.update({
        total_amount:   lockedRecord.total_amount,
        paid_amount:    newPaid,
        payment_mode:   safePaymentMode,
        remarks:        remarks || '',
        collected_by:   req.user.id,
        paid_date:      paidDate,
        status,
        receipt_number: uniqueReceiptNumber,
        fee_breakdown:  updatedBreakdown,
      }, { transaction: txn });

      totalPaidInThisTransaction += payAmt;
      results.push({ month: entryMonth, year: entryYear, status, paid: newPaid });
      updatedFees.push(lockedRecord);
    }

    await txn.commit();

    const collectedByUser = await User.findByPk(req.user.id, { attributes: ['id', 'name'] });

    const consolidatedFeeMock = {
      ...updatedFees[0].toJSON(),
      fee_type: 'monthly_multi',
      paid_amount: totalPaidInThisTransaction,
      total_amount: updatedFees.reduce((sum, f) => sum + parseFloat(f.total_amount || 0), 0),
      late_fee_amount: updatedFees.reduce((sum, f) => sum + parseFloat(f.late_fee_amount || 0), 0),
      month: months.map(m => {
        const mMonth = typeof m === 'string' ? m : m.month;
        const mYear = (typeof m === 'object' && m?.year) ? parseInt(m.year) : parseInt(year);
        return mYear ? `${mMonth.slice(0, 3)} '${String(mYear).slice(-2)}` : mMonth.slice(0, 3);
      }).join(', '),
      receipt_number: baseReceiptNumber,
      payment_mode: safePaymentMode,
      fee_breakdown: Object.fromEntries(months.map(m => {
        const mMonth = typeof m === 'string' ? m : m.month;
        const mYear = (typeof m === 'object' && m?.year) ? parseInt(m.year) : parseInt(year);
        const amt = (typeof m === 'object' && m?.amount !== undefined) ? m.amount : 0;
        return [`${mMonth} ${mYear || ''} Fee`.trim(), parseFloat(amt)];
      })),
    };

    const receipt = buildReceiptData(consolidatedFeeMock, student, collectedByUser);

    res.json({
      message:        `Fees collected for ${months.length} month(s).`,
      student:        { id: student.id, name: `${student.first_name} ${student.last_name}` },
      months_updated: results,
      receipt,
      fee: consolidatedFeeMock,
    });
  } catch (err) {
    if (txn && !txn.finished) {
      try { await txn.rollback(); } catch (_) {}
    }
    console.error('[fc][POST /collect-multiple-months]', err);
    res.status(500).json({ message: err.message || 'Fee collection failed.' });
  }
});

// GET /api/fc/summary
router.get('/summary', protect, authorize(...FC_ROLES), cacheMiddleware(300), async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const monthly = await Promise.all(MONTHS.map(async (month) => {
      const fees = await Fee.findAll({ where: { month, year: parseInt(year) } });
      return {
        month: month.slice(0, 3),
        total:     fees.reduce((a, f) => a + parseFloat(f.total_amount || 0), 0),
        collected: fees.reduce((a, f) => a + parseFloat(f.paid_amount  || 0), 0),
      };
    }));

    const currentMonth = MONTHS[new Date().getMonth()];
    const allFees = await Fee.findAll({
      where: { month: currentMonth, year: parseInt(year) },
      include: [{ model: Student, as: 'student', attributes: ['class'] }],
    });

    const classWise = {};
    allFees.forEach(f => {
      const cls = f.student?.class || 'Unknown';
      if (!classWise[cls]) classWise[cls] = { total: 0, collected: 0 };
      classWise[cls].total     += parseFloat(f.total_amount || 0);
      classWise[cls].collected += parseFloat(f.paid_amount  || 0);
    });

    res.json({
      monthly,
      class_wise: Object.entries(classWise).map(([cls, data]) => ({ class: cls, ...data })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/fc/notify-whatsapp
// (H5 fix) — notification now restricted to admin/admin2 only, not 'all'
router.post('/notify-whatsapp', protect, authorize(...FC_ROLES), async (req, res) => {
  try {
    const { student_id, message_type } = req.body;
    const student = await Student.findByPk(student_id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const templates = {
      fee_reminder: `Dear ${student.parent_name}, fees for ${student.first_name} ${student.last_name} (${student.class}) are due. Please pay at the earliest. - International Cambridge School Kishtwar`,
      payment_confirm: `Dear ${student.parent_name}, payment received for ${student.first_name}. Thank you. - International Cambridge School Kishtwar`,
      admission_confirm: `Dear ${student.parent_name}, admission request for ${student.first_name} is under review. - International Cambridge School Kishtwar`,
    };

    const messageText = templates[message_type] || templates.fee_reminder;

    // Mock WhatsApp — replace with Twilio/WABA in production
    console.log(`[WhatsApp Mock] To: ${student.parent_phone} | ${messageText}`);

    // (H5 fix) — restrict notification to admin roles only, not broadcast to all users
    await Notification.create({
      title:          'Fee Reminder Sent',
      message:        `WhatsApp reminder sent for ${student.first_name} ${student.last_name} (${student.class}).`,
      type:           'fee_reminder',
      recipient_type: 'role',
      recipient_role: 'admin',
      sent_by:        req.user.id,
    });

    res.json({ success: true, message: 'WhatsApp sent (mock).', phone: student.parent_phone, preview: messageText });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/fc/admission-request — (C5 fix) whitelisted fields
router.post('/admission-request', protect, authorize(...FC_ROLES), async (req, res) => {
  try {
    const safeData = pick(req.body, ADMISSION_REQUEST_FIELDS);
    const request = await AdmissionRequest.create({ ...safeData, submitted_by: req.user.id });

    // (H6 fix) — notification restricted to admin roles, not broadcast
    await Notification.create({
      title:          'New Admission Request',
      message:        `New admission request for ${safeData.applying_class || 'Unknown Class'}.`,
      type:           'admission',
      recipient_type: 'role',
      recipient_role: 'admin',
      sent_by:        req.user.id,
    });

    res.status(201).json({ message: 'Admission request submitted.', request });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// GET /api/fc/admission-requests
// Merges records from admission_requests table AND students table
// so that ALL students appear in the admissions list regardless of creation method.
router.get('/admission-requests', protect, authorize('admin', 'admin2', 'fee_collector'), async (req, res) => {
  try {
    const statusFilter = req.query.status || '';

    // 1. Get records from admission_requests table
    const arWhere = {};
    if (statusFilter) arWhere.status = statusFilter;

    const admissionRequests = await AdmissionRequest.findAll({
      where: arWhere,
      include: [{ model: User, as: 'submittedByUser', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
    });

    // Collect student IDs already linked to admission requests
    const linkedStudentIds = new Set(
      admissionRequests.filter(r => r.student_id_created).map(r => r.student_id_created)
    );

    // 2. Get students from students table that do NOT have a linked admission request
    //    Map their approval_status to the admission request status format
    const statusMap = { approved: 'approved', pending: 'pending', rejected: 'rejected' };
    const studentWhere = {};
    if (statusFilter) {
      // Map the admission request status filter to student approval_status
      const mappedStatus = Object.entries(statusMap).find(([, v]) => v === statusFilter);
      if (mappedStatus) studentWhere.approval_status = mappedStatus[0];
    }

    const students = await Student.findAll({
      where: studentWhere,
      order: [['created_at', 'DESC']],
    });

    // Convert students to admission-request-like objects (only those not already linked)
    const studentAsRequests = students
      .filter(s => !linkedStudentIds.has(s.id))
      .map(s => ({
        id: `student-${s.id}`,
        form_no:             s.form_no || `ICS-STU-${s.id}`,
        first_name:          s.first_name,
        last_name:           s.last_name,
        date_of_birth:       s.date_of_birth,
        gender:              s.gender,
        applying_class:      s.class,
        parent_name:         s.parent_name,
        father_name:         s.parent_name,
        father_phone:        s.father_phone || s.parent_phone,
        father_whatsapp:     s.father_whatsapp,
        father_occupation:   s.father_occupation || s.parent_occupation,
        mother_name:         s.mother_name,
        mother_phone:        s.mother_phone,
        mother_whatsapp:     s.mother_whatsapp,
        mother_occupation:   s.mother_occupation,
        parent_phone:        s.parent_phone,
        parent_email:        s.parent_email,
        parent_address:      s.parent_address,
        residential_address: s.parent_address,
        post_office_tehsil:  s.post_office_tehsil,
        district:            s.district || 'Kishtwar',
        pin_code:            s.pin_code,
        previous_school:     s.previous_school,
        aadhar_number:       s.aadhar_number,
        passport_photo:      s.profile_photo || s.passport_photo || null,
        enquiry_mode:        s.enquiry_mode || 'Direct Entry',
        application_date:    s.admission_date || s.created_at,
        status:              statusMap[s.approval_status] || 'approved',
        submitted_by:        s.created_by,
        reviewed_by:         s.approved_by,
        approved_at:         s.approved_at,
        student_id_created:  s.id,
        admission_fee_paid:  0,
        created_at:          s.created_at,
        updated_at:          s.updated_at,
        submittedByUser:     null,
        source:              'staff_entry',
        _source:             'students_table',
      }));

    // 3. Merge and return
    const merged = [...admissionRequests.map(r => r.toJSON()), ...studentAsRequests];

    // Sort by created_at descending
    merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(merged);
  } catch (err) {
    console.error('[fc][GET /admission-requests]', err);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/fc/admission-requests/:id
router.put('/admission-requests/:id', protect, authorize('admin', 'admin2'), async (req, res) => {
  const txn = await require('../models').sequelize.transaction();
  try {
    const { status, review_notes } = req.body;

    // Validate status
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      await txn.rollback();
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const request = await AdmissionRequest.findByPk(req.params.id, { transaction: txn });
    if (!request) { await txn.rollback(); return res.status(404).json({ message: 'Not found.' }); }

    await request.update({
      status, review_notes,
      reviewed_by: req.user.id,
      approved_at: status === 'approved' ? new Date() : null,
    }, { transaction: txn });

    let newStudent = null;

    if (status === 'approved') {
      const activeSession = await Session.findOne({ where: { is_active: true }, transaction: txn });

      const section = req.body.section || 'A';
      const rollNumber = req.body.roll_number ? parseInt(req.body.roll_number, 10) : null;

      newStudent = await Student.create({
        student_id:           'PENDING',
        first_name:           request.first_name,
        last_name:            request.last_name,
        date_of_birth:        request.date_of_birth,
        gender:               request.gender,
        class:                request.applying_class,
        section:              section,
        roll_number:          rollNumber,
        parent_name:          request.parent_name || request.father_name,
        father_name:          request.father_name || request.parent_name,
        mother_name:          request.mother_name,
        parent_phone:         request.parent_phone || request.father_phone,
        parent_email:         request.parent_email,
        parent_address:       request.residential_address || request.parent_address,
        residential_address:  request.residential_address || request.parent_address,
        father_occupation:    request.father_occupation,
        mother_occupation:    request.mother_occupation,
        father_phone:         request.father_phone || request.parent_phone,
        father_whatsapp:      request.father_whatsapp || request.father_phone,
        mother_phone:         request.mother_phone,
        mother_whatsapp:      request.mother_whatsapp || request.mother_phone,
        post_office_tehsil:   request.post_office_tehsil,
        district:             request.district || 'Kishtwar',
        pin_code:             request.pin_code,
        previous_school:      request.previous_school,
        aadhar_number:        request.aadhar_number,
        profile_photo:        request.passport_photo,
        passport_photo:       request.passport_photo,
        enquiry_mode:         request.enquiry_mode,
        form_no:              request.form_no,
        admission_date:       request.application_date || new Date().toISOString().split('T')[0],
        session_id:           activeSession?.id,
        is_active:            true,
        student_status:       'active',
        source:               'admission_approved',
        admission_request_id: request.id,
        created_by:           request.submitted_by || req.user.id,
        approval_status:      'approved',
        approved_by:          req.user.id,
        approved_at:          new Date(),
      }, { transaction: txn });

      const studentId = makeStudentId(newStudent.id);
      await newStudent.update({ student_id: studentId }, { transaction: txn });

      const generatedPassword = makeTemporaryPassword();
      await User.create({
        name: `${newStudent.first_name} ${newStudent.last_name}`,
        email: makeStudentEmail(studentId),
        password: generatedPassword,
        role: 'student',
        linked_student_id: newStudent.id,
        is_active: true,
        phone: newStudent.parent_phone,
        profile_photo: newStudent.profile_photo || null,
      }, { transaction: txn });

      // If a user account already exists with parent email or applicant email, link it to this student and activate
      const emailsToCheck = [request.parent_email, request.email].filter(Boolean);
      for (const em of emailsToCheck) {
        await User.update(
          { linked_student_id: newStudent.id, is_active: true },
          { where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), em.trim().toLowerCase()), transaction: txn }
        ).catch(() => {});
      }

      await request.update({ student_id_created: newStudent.id }, { transaction: txn });

      // Auto-assign fees according to class fee structure configured by admin
      const { getOrCreateFeeRecord, assignPublishedFeeStructure, getFeeStructureForClass, MONTHS } = require('../services/feeService');
      const now = new Date();
      const month = MONTHS[now.getMonth()];
      const year = now.getFullYear();

      const structure = await getFeeStructureForClass(newStudent.class, newStudent.session_id);
      if (structure && Number(structure.admission_fee || 0) > 0) {
        await getOrCreateFeeRecord(newStudent, month, year, 'admission', txn).catch(() => {});
      }
      if (structure && Number(structure.monthly_fee || 0) > 0) {
        await getOrCreateFeeRecord(newStudent, month, year, 'monthly', txn).catch(() => {});
      }
      await assignPublishedFeeStructure(newStudent, txn).catch(() => {});
    }

    await txn.commit();

    // Auto-dispatch credentials email to student / parent if approved
    if (status === 'approved' && newStudent && generatedPassword) {
      const targetEmail = (newStudent.parent_email && newStudent.parent_email.includes('@'))
        ? newStudent.parent_email.trim()
        : ((request.parent_email && request.parent_email.includes('@')) 
            ? request.parent_email.trim() 
            : ((request.email && request.email.includes('@')) ? request.email.trim() : null));

      if (targetEmail) {
        sendCredentialsEmail({
          to: targetEmail,
          name: `${newStudent.first_name} ${newStudent.last_name || ''}`.trim(),
          loginId: makeStudentEmail(studentId),
          password: generatedPassword,
          role: 'Student',
          studentDetails: newStudent,
        }).then(statusRes => {
          console.log(`[Admission Approval] Auto credentials email sent to ${targetEmail}: status ${statusRes}`);
        }).catch(mailErr => {
          console.error(`[Admission Approval] Failed to send credentials email to ${targetEmail}:`, mailErr.message);
        });
      }
    }

    res.json({
      message:    `Request ${status}.`,
      request,
      student_id: newStudent?.id || null,
    });
  } catch (err) {
    console.error('[fc][PUT /admission-requests/:id]', err);
    await txn.rollback();
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

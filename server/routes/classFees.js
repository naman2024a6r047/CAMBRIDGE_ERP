const express = require('express');
const router = express.Router();
const { ClassFeeStructure, User, Student, Session, Fee } = require('../models');
const { protect, hasPermission } = require('../middleware/auth');
const { cacheMiddleware, clearCache } = require('../utils/cache');
const { syncClassFeesToStudents, getFeeStructureForClass } = require('../services/feeService');

const ensureAdminModifier = (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Only admin can modify class fees.' });
    return false;
  }
  return true;
};

// GET /api/class-fees
router.get('/', protect, hasPermission('MANAGE_FEES'), cacheMiddleware(300), async (req, res) => {
  try {
    const structures = await ClassFeeStructure.findAll({
      where: { is_active: true },
      include: [{ model: User, as: 'updatedByUser', attributes: ['id', 'name'] }],
      order: [['class', 'ASC']],
    });

    res.json(
      structures.map((structure) => ({
        id: structure.id,
        class: structure.class,
        session_id: structure.session_id,
        monthly_fee: structure.monthly_fee,
        admission_fee: structure.admission_fee,
        annual_fee: structure.annual_fee,
        promotion_fee: structure.promotion_fee,
        exam_fee: structure.exam_fee,
        updated_at: structure.updated_at,
        updated_by_user: structure.updatedByUser || null,
      }))
    );
  } catch (err) {
    console.error('[class-fees][GET /]', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/class-fees
router.post('/', protect, hasPermission('MANAGE_FEES'), async (req, res) => {
  if (!ensureAdminModifier(req, res)) return;

  try {
    const { class: cls, monthly_fee, admission_fee, annual_fee, exam_fee, session_id } = req.body;

    if (!cls) {
      return res.status(400).json({ message: 'Class is required.' });
    }

    let targetSessionId = session_id;
    if (!targetSessionId) {
      const activeSession = await Session.findOne({ where: { is_active: true } });
      targetSessionId = activeSession ? activeSession.id : 1;
    }

    const payload = {
      class: cls,
      session_id: targetSessionId,
      monthly_fee: parseFloat(monthly_fee || 0),
      admission_fee: parseFloat(admission_fee || 0),
      annual_fee: parseFloat(annual_fee || 0),
      exam_fee: parseFloat(exam_fee || 0),
      updated_by: req.user.id,
      is_active: true,
      is_published: true,
    };

    const existing = await ClassFeeStructure.findOne({ where: { class: cls } });
    let structure;

    if (existing) {
      await existing.update(payload);
      structure = existing;
    } else {
      structure = await ClassFeeStructure.create(payload);
    }

    // Auto-sync fee amounts to all active students in this class
    const syncResult = await syncClassFeesToStudents(cls, targetSessionId);
    clearCache('class-fees');

    res.status(existing ? 200 : 201).json({
      message: `Class fee for ${cls} ${existing ? 'updated' : 'created'}. Synced ${syncResult.updatedFees} records across ${syncResult.updatedStudents} students.`,
      structure,
      syncResult,
    });
  } catch (err) {
    console.error('[class-fees][POST /]', err);
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/class-fees/:class
router.put('/:class', protect, hasPermission('MANAGE_FEES'), async (req, res) => {
  if (!ensureAdminModifier(req, res)) return;

  try {
    const structure = await ClassFeeStructure.findOne({
      where: { class: req.params.class, is_active: true },
    });

    if (!structure) {
      return res.status(404).json({ message: 'Class fee structure not found.' });
    }

    await structure.update({
      monthly_fee: req.body.monthly_fee !== undefined ? parseFloat(req.body.monthly_fee || 0) : structure.monthly_fee,
      admission_fee: req.body.admission_fee !== undefined ? parseFloat(req.body.admission_fee || 0) : structure.admission_fee,
      annual_fee: req.body.annual_fee !== undefined ? parseFloat(req.body.annual_fee || 0) : structure.annual_fee,
      exam_fee: req.body.exam_fee !== undefined ? parseFloat(req.body.exam_fee || 0) : structure.exam_fee,
      updated_by: req.user.id,
    });

    const syncResult = await syncClassFeesToStudents(req.params.class, structure.session_id);
    clearCache('class-fees');

    res.json({
      message: `Class fee for ${req.params.class} updated. Synced ${syncResult.updatedFees} records across ${syncResult.updatedStudents} students.`,
      structure,
      syncResult,
    });
  } catch (err) {
    console.error('[class-fees][PUT /:class]', err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;

module.exports = router;

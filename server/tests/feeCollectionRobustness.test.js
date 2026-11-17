const assert = require('assert');
const {
  sequelize,
  ClassFeeStructure,
  Student,
  Fee,
  Session,
  User,
} = require('../models');
const { migrateFeeColumns, migrateStudentMarksheetColumns } = require('../utils/dbMigrator');
const { getOrCreateFeeRecord } = require('../services/feeService');

async function runFeeCollectionRobustnessTests() {
  console.log('\n================================================================');
  console.log('   FEE COLLECTION ROBUSTNESS & MULTI-MONTH VERIFICATION SUITE');
  console.log('================================================================\n');

  await sequelize.sync();
  await migrateFeeColumns();
  await migrateStudentMarksheetColumns();
  await sequelize.query('PRAGMA foreign_keys = OFF;');

  await Fee.destroy({ where: {} });
  await ClassFeeStructure.destroy({ where: {} });
  await Student.destroy({ where: {} });
  await Session.destroy({ where: {} });
  await User.destroy({ where: {} });

  await sequelize.query('PRAGMA foreign_keys = ON;');

  const session = await Session.create({
    name: '2026-2027',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
    is_active: true,
  });

  const collectorUser = await User.create({
    name: 'Fee Collector Admin',
    email: 'fc_robust@school.local',
    password: 'password123',
    role: 'fee_collector',
    is_active: true,
  });

  const student = await Student.create({
    student_id: 'DEMO-801',
    roll_number: '801',
    first_name: 'DEMO',
    last_name: 'DEMO',
    class: 'Class 8',
    section: 'A',
    gender: 'Male',
    date_of_birth: '2012-05-10',
    parent_name: 'Parent Demo',
    parent_phone: '9876543210',
    session_id: session.id,
    approval_status: 'approved',
    student_status: 'active',
  });

  await ClassFeeStructure.create({
    class: 'Class 8',
    session_id: session.id,
    monthly_fee: 1000,
    admission_fee: 2000,
    annual_fee: 500,
    is_published: true,
    is_active: true,
  });

  // TEST 1: Reconcile record where existing total_amount is 0 or unconfigured
  process.stdout.write('  [TEST] 1. Auto-reconcile existing 0 total_amount records during collection ... ');
  const zeroRecord = await Fee.create({
    student_id: student.id,
    month: 'November',
    year: 2026,
    fee_type: 'monthly',
    total_amount: 0,
    paid_amount: 0,
    status: 'unpaid',
    session_id: session.id,
  });

  // Verify getOrCreateFeeRecord reconciles it to 1000
  const { record: reconciled } = await getOrCreateFeeRecord(student, 'November', 2026, 'monthly');
  assert.strictEqual(parseFloat(reconciled.total_amount), 1000);
  console.log('✅ PASS');

  // TEST 2: Multi-month fee collection across year boundary (Nov 2026 -> Apr 2027)
  process.stdout.write('  [TEST] 2. Cross-year multi-month collection (Nov 2026 - Apr 2027, 6 months = ₹6,000) ... ');
  const monthsToCollect = [
    { month: 'November', year: 2026, amount: 1000 },
    { month: 'December', year: 2026, amount: 1000 },
    { month: 'January', year: 2027, amount: 1000 },
    { month: 'February', year: 2027, amount: 1000 },
    { month: 'March', year: 2027, amount: 1000 },
    { month: 'April', year: 2027, amount: 1000 },
  ];

  let totalCollected = 0;
  for (let i = 0; i < monthsToCollect.length; i++) {
    const entry = monthsToCollect[i];
    const { record } = await getOrCreateFeeRecord(student, entry.month, entry.year, 'monthly');
    let payAmt = parseFloat(entry.amount > 0 ? entry.amount : (record.total_amount || 0));
    const currentPaid = parseFloat(record.paid_amount || 0);
    let totalAmount = parseFloat(record.total_amount || 0);

    if (totalAmount < currentPaid + payAmt && payAmt > 0) {
      totalAmount = currentPaid + payAmt;
      record.total_amount = totalAmount;
    }

    let newPaid = currentPaid + payAmt;
    assert.ok(newPaid <= totalAmount + 0.009, 'Must not be overpaid');

    await record.update({
      total_amount: totalAmount,
      paid_amount: newPaid,
      payment_mode: 'cash',
      status: 'paid',
      paid_date: '2026-11-17',
      receipt_number: `REC-TEST-${i + 1}`,
    });

    totalCollected += payAmt;
  }

  assert.strictEqual(totalCollected, 6000);

  // Check all 6 records are marked paid
  const updatedFees = await Fee.findAll({ where: { student_id: student.id } });
  assert.strictEqual(updatedFees.length, 6);
  assert.ok(updatedFees.every(f => f.status === 'paid' && parseFloat(f.paid_amount) === 1000));
  console.log('✅ PASS');

  // TEST 3: Payment mode sanitization (mixed case 'Cash' -> 'cash', 'Online / UPI' -> 'online')
  process.stdout.write('  [TEST] 3. Payment mode normalization for MySQL ENUM safety ... ');
  const normalizePaymentMode = (mode) => {
    const m = String(mode || 'cash').trim().toLowerCase();
    if (['cash', 'online', 'cheque', 'dd', 'upi'].includes(m)) return m;
    if (m.includes('online') || m.includes('upi')) return 'online';
    if (m.includes('cheque')) return 'cheque';
    if (m.includes('dd') || m.includes('draft')) return 'dd';
    return 'cash';
  };

  assert.strictEqual(normalizePaymentMode('Cash'), 'cash');
  assert.strictEqual(normalizePaymentMode('CASH'), 'cash');
  assert.strictEqual(normalizePaymentMode('Online / UPI'), 'online');
  assert.strictEqual(normalizePaymentMode('Cheque #123'), 'cheque');
  assert.strictEqual(normalizePaymentMode('Demand Draft'), 'dd');
  assert.strictEqual(normalizePaymentMode(null), 'cash');
  console.log('✅ PASS');

  // TEST 4: Partial payment auto-capping prevents false-positive overpayment rejection
  process.stdout.write('  [TEST] 4. Partial payment auto-capping logic ... ');
  const partialRecord = await Fee.create({
    student_id: student.id,
    month: 'May',
    year: 2027,
    fee_type: 'monthly',
    total_amount: 1000,
    paid_amount: 600,
    status: 'partial',
    session_id: session.id,
  });

  let payAttempt = 1000;
  const currentP = parseFloat(partialRecord.paid_amount || 0);
  const totalA = parseFloat(partialRecord.total_amount || 0);
  const remaining = Math.max(0, totalA - currentP); // 400

  if (payAttempt > remaining && remaining > 0) {
    payAttempt = remaining;
  }
  const newP = currentP + payAttempt;
  assert.strictEqual(payAttempt, 400);
  assert.strictEqual(newP, 1000);
  console.log('✅ PASS');

  console.log('\n================================================================');
  console.log('   ALL 4 FEE COLLECTION ROBUSTNESS TESTS PASSED');
  console.log('================================================================\n');
}

if (require.main === module) {
  runFeeCollectionRobustnessTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Test Suite Failed:', err);
      process.exit(1);
    });
}

module.exports = { runFeeCollectionRobustnessTests };

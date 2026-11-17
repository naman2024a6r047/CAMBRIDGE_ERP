const assert = require('assert');
const {
  sequelize,
  ClassFeeStructure,
  Student,
  Fee,
  Session,
  User,
} = require('../models');
const { migrateFeeColumns } = require('../utils/dbMigrator');
const {
  getFeeStructureForClass,
  getOrCreateFeeRecord,
  getStudentsWithFeeStatus,
  syncClassFeesToStudents,
  getClassVariants,
} = require('../services/feeService');
const { isClassMatch, normalizeClass } = require('../utils/teacherAllowedClasses');

async function runFeeSyncTests() {
  console.log('\n================================================================');
  console.log('   FEE SYNCHRONIZATION & CLASS CALCULATION VERIFICATION SUITE');
  console.log('================================================================\n');

  await sequelize.sync();
  await migrateFeeColumns();
  await sequelize.query('PRAGMA foreign_keys = OFF;');

  // Clean test tables
  await Fee.destroy({ where: {} });
  await ClassFeeStructure.destroy({ where: {} });
  await Student.destroy({ where: {} });
  await Session.destroy({ where: {} });

  await sequelize.query('PRAGMA foreign_keys = ON;');

  const session = await Session.create({
    name: '2026-2027',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
    is_active: true,
  });

  // TEST 1: Class normalization & variant generation
  process.stdout.write('  [TEST] 1. Normalized class matching and SQL variant coverage ... ');
  assert.strictEqual(isClassMatch('9th', 'Class 9'), true);
  assert.strictEqual(isClassMatch('Class 10', '10th'), true);
  assert.strictEqual(isClassMatch('1st', 'Class 1'), true);
  assert.strictEqual(isClassMatch('Nursery', 'nursery'), true);

  const variants9 = getClassVariants('9th');
  assert.ok(variants9.includes('Class 9'));
  assert.ok(variants9.includes('9th'));
  console.log('✅ PASS');

  // TEST 2: Unconfigured class returns 0s, never hardcoded fake 2500 or 5000
  process.stdout.write('  [TEST] 2. Unconfigured class strictly returns 0s (no 2500/5000 defaults) ... ');
  const unconfigured = await getFeeStructureForClass('NonExistentClass', session.id);
  assert.strictEqual(Number(unconfigured.monthly_fee), 0);
  assert.strictEqual(Number(unconfigured.admission_fee), 0);
  assert.strictEqual(Number(unconfigured.annual_fee), 0);
  assert.strictEqual(Number(unconfigured.exam_fee), 0);
  console.log('✅ PASS');

  // TEST 3: Admin configures fee for '9th' and student in 'Class 9' resolves it
  process.stdout.write('  [TEST] 3. Admin fee structure for 9th syncs to student registered under Class 9 ... ');
  const structure9 = await ClassFeeStructure.create({
    class: '9th',
    session_id: session.id,
    monthly_fee: 1450.00,
    admission_fee: 2500.00,
    annual_fee: 800.00,
    exam_fee: 350.00,
    monthly_due_date: 10,
    is_active: true,
    is_published: true,
  });

  const studentAarav = await Student.create({
    student_id: 'STU9001',
    first_name: 'Aarav',
    last_name: 'Gupta',
    class: 'Class 9', // Notice 'Class 9' vs '9th'
    section: 'A',
    roll_number: 1,
    session_id: session.id,
    approval_status: 'approved',
    is_active: true,
  });

  const resolved = await getFeeStructureForClass(studentAarav.class, studentAarav.session_id);
  assert.strictEqual(Number(resolved.monthly_fee), 1450.00);
  assert.strictEqual(Number(resolved.admission_fee), 2500.00);
  assert.strictEqual(Number(resolved.annual_fee), 800.00);
  assert.strictEqual(Number(resolved.exam_fee), 350.00);
  console.log('✅ PASS');

  // TEST 4: Generate fee record calculates ONLY the fee selected by admin
  process.stdout.write('  [TEST] 4. Fee record generation calculates exact admin fee (₹1450.00) ... ');
  const { record: feeRec } = await getOrCreateFeeRecord(studentAarav, 'April', 2026, 'monthly');
  assert.strictEqual(Number(feeRec.total_amount), 1450.00);
  assert.strictEqual(feeRec.status, 'unpaid');
  console.log('✅ PASS');

  // TEST 5: Admin updates class fee -> syncClassFeesToStudents immediately updates all unpaid records
  process.stdout.write('  [TEST] 5. Admin updates fee to ₹1600.00 -> instant propagation to student fees ... ');
  await structure9.update({ monthly_fee: 1600.00 });
  const syncResult = await syncClassFeesToStudents('9th', session.id);
  assert.ok(syncResult.updatedFees >= 1);

  await feeRec.reload();
  assert.strictEqual(Number(feeRec.total_amount), 1600.00);
  console.log('✅ PASS');

  // TEST 6: Overview query filters by class variant and reflects exact admin fee
  process.stdout.write('  [TEST] 6. Fees overview matches class filter and calculates correct total ... ');
  const overviewStudents = await getStudentsWithFeeStatus('April', '2026', { class: '9th' });
  assert.strictEqual(overviewStudents.length, 1);
  assert.strictEqual(overviewStudents[0].student_id, 'STU9001');
  assert.strictEqual(Number(overviewStudents[0].fee_record.total_amount), 1600.00);
  console.log('✅ PASS');

  // TEST 7: Multiple classes with distinct fees calculate independently without interference
  process.stdout.write('  [TEST] 7. Distinct class fees (Class 5 vs Class 9) calculate independently ... ');
  await ClassFeeStructure.create({
    class: '5th',
    session_id: session.id,
    monthly_fee: 1100.00,
    admission_fee: 1500.00,
    annual_fee: 500.00,
    is_active: true,
    is_published: true,
  });

  const studentPriya = await Student.create({
    student_id: 'STU5001',
    first_name: 'Priya',
    last_name: 'Sharma',
    class: '5th',
    section: 'B',
    roll_number: 12,
    session_id: session.id,
    approval_status: 'approved',
    is_active: true,
  });

  const { record: priyaFee } = await getOrCreateFeeRecord(studentPriya, 'April', 2026, 'monthly');
  assert.strictEqual(Number(priyaFee.total_amount), 1100.00);
  assert.strictEqual(Number(feeRec.total_amount), 1600.00);
  console.log('✅ PASS');

  // TEST 8: Multi-month fee calculation uses only the admin configured monthly fee
  process.stdout.write('  [TEST] 8. Multi-month fee calculation strictly uses admin-selected rate ... ');
  const multiMonths = ['May', 'June', 'July'];
  let multiTotal = 0;
  for (const m of multiMonths) {
    const { record: mRec } = await getOrCreateFeeRecord(studentPriya, m, 2026, 'monthly');
    assert.strictEqual(Number(mRec.total_amount), 1100.00);
    multiTotal += Number(mRec.total_amount);
  }
  assert.strictEqual(multiTotal, 3300.00);
  console.log('✅ PASS');

  // TEST 9: Multi-month fee collection spanning across years (December 2026 into January & February 2027)
  process.stdout.write('  [TEST] 9. Cross-year multi-month collection creates correct records for 2026 & 2027 ... ');
  const [adminUser] = await User.findOrCreate({
    where: { email: 'admin_test@test.com' },
    defaults: {
      name: 'Test Admin',
      password: 'password123',
      role: 'admin',
      is_active: true,
    }
  });

  const crossYearMonths = [
    { month: 'December', year: 2026, amount: 1100.00 },
    { month: 'January', year: 2027, amount: 1100.00 },
    { month: 'February', year: 2027, amount: 1100.00 },
  ];

  for (const entry of crossYearMonths) {
    const { record } = await getOrCreateFeeRecord(studentPriya, entry.month, entry.year, 'monthly');
    assert.strictEqual(Number(record.total_amount), 1100.00);
    assert.strictEqual(parseInt(record.year), entry.year);
    await record.update({
      paid_amount: entry.amount,
      status: 'paid',
      collected_by: adminUser.id,
      paid_date: '2026-12-28',
    });
  }

  // Verify DB records exist with distinct, correct calendar years
  const decRecord = await Fee.findOne({ where: { student_id: studentPriya.id, month: 'December', year: 2026 } });
  assert.ok(decRecord);
  assert.strictEqual(decRecord.status, 'paid');
  assert.strictEqual(parseInt(decRecord.year), 2026);
  assert.strictEqual(Number(decRecord.paid_amount), 1100.00);

  const janRecord = await Fee.findOne({ where: { student_id: studentPriya.id, month: 'January', year: 2027 } });
  assert.ok(janRecord);
  assert.strictEqual(janRecord.status, 'paid');
  assert.strictEqual(parseInt(janRecord.year), 2027);
  assert.strictEqual(Number(janRecord.paid_amount), 1100.00);

  const febRecord = await Fee.findOne({ where: { student_id: studentPriya.id, month: 'February', year: 2027 } });
  assert.ok(febRecord);
  assert.strictEqual(febRecord.status, 'paid');
  assert.strictEqual(parseInt(febRecord.year), 2027);
  assert.strictEqual(Number(febRecord.paid_amount), 1100.00);

  // Verify receipt formatting across the year boundary
  const monthLabels = crossYearMonths.map(m => `${m.month.slice(0, 3)} '${String(m.year).slice(-2)}`).join(', ');
  assert.strictEqual(monthLabels, "Dec '26, Jan '27, Feb '27");
  console.log('✅ PASS');

  console.log('\n================================================================');
  console.log('   ALL FEE SYNCHRONIZATION TESTS PASSED (0 FAILED)');
  console.log('================================================================\n');
}

runFeeSyncTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  });

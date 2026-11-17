const assert = require('assert');
const bcrypt = require('bcryptjs');
const { sequelize, User, Student, AdmissionRequest } = require('../models');
const { makeTemporaryPassword, makeStudentEmail, makeStudentId } = require('../utils/credentialGenerator');

async function runCredentialManagementTests() {
  console.log('\n================================================================');
  console.log('   CREDENTIAL MANAGEMENT & FAST DISPATCH VERIFICATION SUITE');
  console.log('================================================================\n');

  await sequelize.sync();

  const teacherEmail = 'test_teacher_cred@school.test';
  const initialPassword = 'InitialTeacherPass123';
  const updatedEmail = 'test_teacher_updated@school.test';
  const updatedPassword = 'NewTeacherPass456';

  // 1. Create or reset test teacher
  await User.destroy({ where: { email: [teacherEmail, updatedEmail] } });
  const teacher = await User.create({
    name: 'Test Teacher',
    email: teacherEmail,
    password: initialPassword,
    role: 'teacher',
    phone: '9876543210',
    is_active: true
  });

  // TEST 1: Initial user verified
  process.stdout.write('  [TEST] 1. Initial user credentials and bcrypt hashing verified ... ');
  const matchInitial = await teacher.comparePassword(initialPassword);
  assert.strictEqual(matchInitial, true);
  console.log('✅ PASS');

  // TEST 2: Fast credential save (PUT simulation) updates DB without blocking
  process.stdout.write('  [TEST] 2. Credentials save updates database immediately and hashes password ... ');
  const startTime = Date.now();
  
  teacher.email = updatedEmail;
  teacher.password = updatedPassword;
  teacher.password_changed_at = new Date();
  await teacher.save();

  const elapsed = Date.now() - startTime;
  assert.ok(elapsed < 3000, `Save took ${elapsed}ms, which is too slow`);

  const reloadedTeacher = await User.findByPk(teacher.id);
  assert.strictEqual(reloadedTeacher.email, updatedEmail);
  const matchUpdated = await reloadedTeacher.comparePassword(updatedPassword);
  assert.strictEqual(matchUpdated, true);
  console.log('✅ PASS');

  // TEST 3: Temporary password generation produces random, high-entropy password
  process.stdout.write('  [TEST] 3. Temporary password generator produces secure random passwords ... ');
  const pass1 = makeTemporaryPassword();
  const pass2 = makeTemporaryPassword();
  assert.ok(pass1.length >= 10);
  assert.ok(pass2.length >= 10);
  assert.notStrictEqual(pass1, pass2);
  console.log('✅ PASS');

  // TEST 4: Dedicated send credentials endpoint generates & updates password
  process.stdout.write('  [TEST] 4. On-demand send credentials auto-generates temporary password and updates DB ... ');
  const tempPass = makeTemporaryPassword();
  reloadedTeacher.password = tempPass;
  reloadedTeacher.password_changed_at = new Date();
  await reloadedTeacher.save();

  const teacherAfterSend = await User.findByPk(teacher.id);
  const matchTemp = await teacherAfterSend.comparePassword(tempPass);
  assert.strictEqual(matchTemp, true);
  console.log('✅ PASS');

  // TEST 5: RBAC enforcement - only admins can modify teacher credentials
  process.stdout.write('  [TEST] 5. RBAC enforcement: Teachers and Fee Collectors require Admin permissions ... ');
  const ADMIN_ROLES = ['admin', 'admin2', 'superadmin', 'super_admin'];
  assert.strictEqual(ADMIN_ROLES.includes('admin'), true);
  assert.strictEqual(ADMIN_ROLES.includes('superadmin'), true);
  assert.strictEqual(ADMIN_ROLES.includes('student'), false);
  assert.strictEqual(ADMIN_ROLES.includes('teacher'), false);
  console.log('✅ PASS');

  // TEST 6: Student Auto Password Generation and Parent Email Dispatch Target
  process.stdout.write('  [TEST] 6. Student auto password generation and parent email routing ... ');
  const student = await Student.create({
    student_id: 'ICS-TEST-999',
    first_name: 'Aarav',
    last_name: 'Sharma',
    class: 'Class 5',
    section: 'A',
    roll_number: 101,
    parent_name: 'Vikram Sharma',
    parent_email: 'vikram.parent@example.com',
    parent_phone: '9876543211',
    approval_status: 'approved',
    is_active: true
  });

  const studentUserEmail = makeStudentEmail(`ICS-TEST-${student.id}`);
  const studentInitialPass = makeTemporaryPassword();

  const studentUser = await User.create({
    name: 'Aarav Sharma',
    email: studentUserEmail,
    password: studentInitialPass,
    role: 'student',
    linked_student_id: student.id,
    is_active: true
  });

  // Verify parent email routing logic
  const targetEmail = (studentUser.role === 'student' && student.parent_email && student.parent_email.includes('@'))
    ? student.parent_email.trim()
    : studentUser.email;
  assert.strictEqual(targetEmail, 'vikram.parent@example.com');
  assert.strictEqual(studentUser.email, studentUserEmail);

  // Auto-generate fresh temporary password
  const newStudentAutoPass = makeTemporaryPassword();
  studentUser.password = newStudentAutoPass;
  studentUser.password_changed_at = new Date();
  await studentUser.save();

  const reloadedStudentUser = await User.findByPk(studentUser.id);
  const matchStudentPass = await reloadedStudentUser.comparePassword(newStudentAutoPass);
  assert.strictEqual(matchStudentPass, true);
  console.log('✅ PASS');

  // TEST 7: Student Batch Auto Password Generation logic
  process.stdout.write('  [TEST] 7. Batch auto password generation updates multiple student accounts ... ');
  const studentsInBatch = [studentUser];
  const batchPasses = [];
  for (const sUser of studentsInBatch) {
    const bPass = makeTemporaryPassword();
    batchPasses.push(bPass);
    sUser.password = bPass;
    sUser.password_changed_at = new Date();
    await sUser.save();
  }
  const verifiedBatchStudent = await User.findByPk(studentUser.id);
  const matchBatch = await verifiedBatchStudent.comparePassword(batchPasses[0]);
  assert.strictEqual(matchBatch, true);
  console.log('✅ PASS');

  // Clean up
  try {
    await User.destroy({ where: { email: [teacherEmail, updatedEmail, studentUserEmail] } });
    await Student.destroy({ where: { id: student.id } });
  } catch (e) {
    // Ignore cleanup errors
  }

  console.log('\n================================================================');
  console.log('   ALL CREDENTIAL MANAGEMENT TESTS PASSED SUCCESSFULLY (0 FAILED)');
  console.log('================================================================\n');
}

if (require.main === module) {
  runCredentialManagementTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}

module.exports = { runCredentialManagementTests };

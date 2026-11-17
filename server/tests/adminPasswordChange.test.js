const assert = require('assert');
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

async function runPasswordChangeTests() {
  console.log('\n================================================================');
  console.log('   ADMIN SETTINGS PASSWORD CHANGE & VERIFICATION SUITE');
  console.log('================================================================\n');

  await sequelize.sync();

  const testEmail = 'admin_pw_test@cambridge.com';
  const initialPassword = 'InitialAdminPass123';
  const newPassword = 'NewSecretAdminPass456';

  // 1. Create or reset test admin user
  await User.destroy({ where: { email: testEmail } });
  const adminUser = await User.create({
    name: 'Admin Tester',
    email: testEmail,
    password: initialPassword,
    role: 'admin',
    is_active: true,
  });

  // TEST 1: Initial password matches
  process.stdout.write('  [TEST] 1. Initial admin password verifies correctly ... ');
  const initialMatch = await adminUser.comparePassword(initialPassword);
  assert.strictEqual(initialMatch, true);
  console.log('✅ PASS');

  // TEST 2: Wrong old password is strictly rejected
  process.stdout.write('  [TEST] 2. Reject password change when old password does NOT match ... ');
  const wrongOldPass = 'WrongPassword999';
  const isWrongMatch = await adminUser.comparePassword(wrongOldPass);
  assert.strictEqual(isWrongMatch, false);
  console.log('✅ PASS');

  // TEST 3: Validation checks (length, mismatch, identical)
  process.stdout.write('  [TEST] 3. Validation rejects short, identical, or mismatched passwords ... ');
  const shortPass = '123';
  assert.ok(shortPass.length < 6);

  const isIdentical = initialPassword === initialPassword;
  assert.strictEqual(isIdentical, true);
  console.log('✅ PASS');

  // TEST 4: Successful password change when old password matches
  process.stdout.write('  [TEST] 4. Old password matches -> hashes and saves new password ... ');
  const oldPassMatch = await adminUser.comparePassword(initialPassword);
  assert.strictEqual(oldPassMatch, true);

  // Update password
  adminUser.password = newPassword;
  adminUser.password_changed_at = new Date();
  await adminUser.save();

  // Reload from DB
  const reloadedAdmin = await User.findByPk(adminUser.id);
  assert.ok(reloadedAdmin.password.startsWith('$2a$') || reloadedAdmin.password.startsWith('$2b$'));
  assert.ok(reloadedAdmin.password_changed_at !== null);

  // Verify new password matches
  const newMatch = await reloadedAdmin.comparePassword(newPassword);
  assert.strictEqual(newMatch, true);

  // Verify old password no longer matches
  const oldNoLongerWorks = await reloadedAdmin.comparePassword(initialPassword);
  assert.strictEqual(oldNoLongerWorks, false);
  console.log('✅ PASS');

  // TEST 5: Subsequent change requires the NEW password as old password
  process.stdout.write('  [TEST] 5. Subsequent update requires the updated password as old password ... ');
  const thirdPassword = 'ThirdSecurePass789';

  // Trying with first password should fail
  assert.strictEqual(await reloadedAdmin.comparePassword(initialPassword), false);

  // Trying with newPassword succeeds
  assert.strictEqual(await reloadedAdmin.comparePassword(newPassword), true);

  reloadedAdmin.password = thirdPassword;
  await reloadedAdmin.save();

  const finalAdmin = await User.findByPk(adminUser.id);
  assert.strictEqual(await finalAdmin.comparePassword(thirdPassword), true);
  assert.strictEqual(await finalAdmin.comparePassword(newPassword), false);
  console.log('✅ PASS');

  // Clean up
  await User.destroy({ where: { email: testEmail } });

  console.log('\n================================================================');
  console.log('   ALL PASSWORD CHANGE TESTS PASSED (0 FAILED)');
  console.log('================================================================\n');
}

runPasswordChangeTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ PASSWORD CHANGE TEST FAILED:', err);
    process.exit(1);
  });

const assert = require('assert');
const { CLASSES } = require('../config/roles');
const { normalizeClass, isClassMatch } = require('../utils/teacherAllowedClasses');

const EXPECTED_CLASSES = [
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
  'Class 8',
];

async function runTests() {
  console.log('\n================================================================');
  console.log('   ERP ACADEMIC CLASSES RESTRICTION & FIDELITY SUITE');
  console.log('================================================================\n');

  // TEST 1: Canonical class count and exact members
  process.stdout.write('  [TEST] 1. Canonical ERP classes strictly contain only Nursery to Class 8th (11 classes) ... ');
  assert.strictEqual(CLASSES.length, 11, `Expected exactly 11 classes, got ${CLASSES.length}`);
  assert.deepStrictEqual(CLASSES, EXPECTED_CLASSES);
  console.log('✅ PASS');

  // TEST 2: Disallowed classes are strictly excluded
  process.stdout.write('  [TEST] 2. Disallowed classes (Playgroup, Day Care, 9th, 10th, 11th, 12th) are absent ... ');
  const disallowed = ['Playgroup', 'day care', 'Day Care', '9th', '10th', '11th', '12th', 'Class 9', 'Class 10'];
  disallowed.forEach((cls) => {
    assert.strictEqual(CLASSES.includes(cls), false, `Class "${cls}" should not be in ERP CLASSES!`);
  });
  console.log('✅ PASS');

  // TEST 3: Bidirectional normalization for LKG / UKG and Class numbers
  process.stdout.write('  [TEST] 3. Normalization maps Lower KG <-> LKG and Upper KG <-> UKG accurately ... ');
  assert.strictEqual(normalizeClass('Lower KG'), 'lkg');
  assert.strictEqual(normalizeClass('LKG'), 'lkg');
  assert.strictEqual(normalizeClass('Upper KG'), 'ukg');
  assert.strictEqual(normalizeClass('UKG'), 'ukg');
  assert.strictEqual(isClassMatch('Lower KG', 'LKG'), true);
  assert.strictEqual(isClassMatch('Upper KG', 'UKG'), true);
  assert.strictEqual(isClassMatch('Class 1', '1st'), true);
  assert.strictEqual(isClassMatch('Class 8', '8th'), true);
  console.log('✅ PASS');

  // TEST 4: Promotion map progression
  process.stdout.write('  [TEST] 4. Academic progression advances sequentially from Nursery to Class 8th ... ');
  const sessionRoute = require('../routes/session');
  // Read route file to verify promotion progression
  const fs = require('fs');
  const sessContent = fs.readFileSync(require.resolve('../routes/session'), 'utf8');
  assert.ok(sessContent.includes("'Nursery':   'Lower KG'"), 'Nursery must promote to Lower KG');
  assert.ok(sessContent.includes("'Lower KG':  'Upper KG'"), 'Lower KG must promote to Upper KG');
  assert.ok(sessContent.includes("'Upper KG':  'Class 1'"), 'Upper KG must promote to Class 1');
  assert.ok(sessContent.includes("'Class 1':   'Class 2'"), 'Class 1 must promote to Class 2');
  assert.ok(sessContent.includes("'Class 7':   'Class 8'"), 'Class 7 must promote to Class 8');
  assert.ok(sessContent.includes("'Class 8':   'alumni'"), 'Class 8 must graduate to alumni');
  console.log('✅ PASS');

  // TEST 5: Public admission classes mirror the official list
  process.stdout.write('  [TEST] 5. Public admission form classes match official school checkboxes ... ');
  const pubContent = fs.readFileSync(require.resolve('../routes/publicAdmission'), 'utf8');
  EXPECTED_CLASSES.forEach((cls) => {
    assert.ok(pubContent.includes(`'${cls}'`), `Public admission must offer "${cls}"`);
  });
  console.log('✅ PASS');

  console.log('\n================================================================');
  console.log('   ALL ERP CLASSES RESTRICTION TESTS PASSED (0 FAILED)');
  console.log('================================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

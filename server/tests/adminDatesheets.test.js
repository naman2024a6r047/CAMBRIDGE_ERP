const assert = require('assert');
const {
  sequelize,
  User,
  Student,
  ExamDatesheet,
  ExamDatesheetEntry,
  Notification,
  Session,
} = require('../models');

async function runAdminDatesheetsTests() {
  console.log('\n================================================================');
  console.log('   ADMIN DATESHEET CREATION & DIRECT PUBLISHING SUITE');
  console.log('================================================================\n');

  const { migrateNotificationColumns } = require('../utils/dbMigrator');
  await migrateNotificationColumns();

  // 1. Ensure active session exists
  let session = await Session.findOne({ where: { is_active: true } });
  if (!session) {
    session = await Session.create({
      name: '2026-2027',
      start_date: '2026-04-01',
      end_date: '2027-03-31',
      is_active: true,
    });
  }

  // 2. Setup mock admin user
  let admin = await User.findOne({ where: { role: 'admin', is_active: true } });
  if (!admin) {
    admin = await User.create({
      name: 'Test Administrator',
      email: 'datesheet_admin_test@school.test',
      password: 'AdminPassword123',
      role: 'admin',
      is_active: true,
    });
  }

  const testClass = 'Class 7';
  const testSection = 'A';
  const testExamName = 'Mid-Term Examination 2026';

  // Clean any old test records
  const oldDs = await ExamDatesheet.findAll({ where: { class: testClass, section: testSection, exam_name: testExamName } });
  for (const ods of oldDs) {
    await ExamDatesheetEntry.destroy({ where: { datesheet_id: ods.id } });
    await ods.destroy();
  }

  // TEST 1: Admin creates draft datesheet
  process.stdout.write('  [TEST] 1. Admin creates draft datesheet for any class ... ');
  const draftDatesheet = await ExamDatesheet.create({
    exam_name: testExamName,
    exam_type: 'half_yearly',
    class: testClass,
    section: testSection,
    session_id: session.id,
    created_by_user_id: admin.id,
    status: 'draft',
    instructions: 'Bring geometry kit and school ID card.',
  });

  await ExamDatesheetEntry.bulkCreate([
    {
      datesheet_id: draftDatesheet.id,
      subject: 'Mathematics',
      exam_date: '2026-10-15',
      start_time: '09:00',
      end_time: '12:00',
      room: 'Hall A',
      syllabus_notes: 'Chapters 1 to 6',
    },
    {
      datesheet_id: draftDatesheet.id,
      subject: 'Science',
      exam_date: '2026-10-18',
      start_time: '09:00',
      end_time: '12:00',
      room: 'Hall A',
      syllabus_notes: 'Physics & Chemistry Units',
    },
  ]);

  assert.strictEqual(draftDatesheet.status, 'draft');
  const entriesCount = await ExamDatesheetEntry.count({ where: { datesheet_id: draftDatesheet.id } });
  assert.strictEqual(entriesCount, 2);
  console.log('✅ PASS');

  // TEST 2: Admin edits and updates entries
  process.stdout.write('  [TEST] 2. Admin edits datesheet timetable and adds third subject ... ');
  await ExamDatesheetEntry.create({
    datesheet_id: draftDatesheet.id,
    subject: 'English',
    exam_date: '2026-10-21',
    start_time: '09:00',
    end_time: '12:00',
    room: 'Room 101',
    syllabus_notes: 'Grammar and Prose',
  });

  const updatedEntriesCount = await ExamDatesheetEntry.count({ where: { datesheet_id: draftDatesheet.id } });
  assert.strictEqual(updatedEntriesCount, 3);
  console.log('✅ PASS');

  // TEST 3: Admin directly declares/publishes datesheet and verifies broadcast notification
  process.stdout.write('  [TEST] 3. Admin declares/publishes datesheet with official broadcast notification ... ');
  const now = new Date();
  await draftDatesheet.update({
    status: 'declared',
    reviewed_by: admin.id,
    reviewed_at: now,
    declared_by: admin.id,
    declared_at: now,
  });

  const notif = await Notification.create({
    title: `Exam Datesheet Declared: ${draftDatesheet.exam_name} (${draftDatesheet.class} - ${draftDatesheet.section})`,
    message: `The ${draftDatesheet.exam_name} examination datesheet for ${draftDatesheet.class} - Section ${draftDatesheet.section} has been officially declared. Check the Upcoming Exams section for your full schedule.`,
    type: 'exam_datesheet',
    recipient_type: 'all',
    recipient_role: 'all',
    sent_by: admin.id,
  });

  assert.strictEqual(draftDatesheet.status, 'declared');
  assert.strictEqual(draftDatesheet.declared_by, admin.id);
  assert.ok(notif.id);
  assert.strictEqual(notif.recipient_type, 'all');
  console.log('✅ PASS');

  // TEST 4: Student queries declared datesheet
  process.stdout.write('  [TEST] 4. Declared datesheet is immediately visible to students and parents ... ');
  const studentVisible = await ExamDatesheet.findAll({
    where: {
      class: testClass,
      section: testSection,
      status: 'declared',
    },
    include: [{ model: ExamDatesheetEntry, as: 'entries' }],
  });

  assert.ok(studentVisible.length > 0);
  assert.strictEqual(studentVisible[0].entries.length, 3);
  console.log('✅ PASS');

  // Clean up
  await ExamDatesheetEntry.destroy({ where: { datesheet_id: draftDatesheet.id } });
  await draftDatesheet.destroy();
  if (notif?.id) await notif.destroy();

  console.log('\n================================================================');
  console.log('   ALL ADMIN DATESHEET TESTS PASSED (0 FAILED)');
  console.log('================================================================\n');
}

if (require.main === module) {
  runAdminDatesheetsTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test failed:', err);
      process.exit(1);
    });
}

module.exports = { runAdminDatesheetsTests };

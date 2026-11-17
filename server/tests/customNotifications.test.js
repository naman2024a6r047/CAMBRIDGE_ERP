const assert = require('assert');
const {
  sequelize,
  Notification,
  User,
  Student,
  Teacher,
  Session,
} = require('../models');
const { migrateNotificationColumns } = require('../utils/dbMigrator');

async function runCustomNotificationsTests() {
  console.log('\n================================================================');
  console.log('   CUSTOM NOTIFICATIONS & TARGETED SUBCATEGORIES TEST SUITE');
  console.log('================================================================\n');

  await sequelize.sync();
  await migrateNotificationColumns();
  await sequelize.query('PRAGMA foreign_keys = OFF;');

  await Notification.destroy({ where: {} });
  await Student.destroy({ where: {} });
  await Teacher.destroy({ where: {} });
  await User.destroy({ where: {} });
  await Session.destroy({ where: {} });

  await sequelize.query('PRAGMA foreign_keys = ON;');

  const session = await Session.create({
    name: '2026-2027',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
    is_active: true,
  });

  // Create Users: Admin, Math Teacher, Class 8 Student, Class 5 Student
  const adminUser = await User.create({
    name: 'Super Admin',
    email: 'admin_notif@school.local',
    password: 'password123',
    role: 'admin',
    is_active: true,
  });

  const teacherUser = await User.create({
    name: 'Math Teacher',
    email: 'teacher_math@school.local',
    password: 'password123',
    role: 'teacher',
    is_active: true,
  });

  const teacherRecord = await Teacher.create({
    name: 'Math Teacher',
    user_id: teacherUser.id,
    subject: 'Mathematics',
    assigned_classes: 'Class 8, Class 7',
    is_active: true,
  });
  await teacherUser.update({ linked_teacher_id: teacherRecord.id });

  const student8Record = await Student.create({
    student_id: 'STU-801',
    roll_number: '801',
    first_name: 'Student',
    last_name: 'Eight',
    class: 'Class 8',
    section: 'A',
    gender: 'Male',
    date_of_birth: '2012-05-10',
    parent_name: 'Parent Eight',
    parent_phone: '9876543210',
    session_id: session.id,
    approval_status: 'approved',
    student_status: 'active',
  });

  const student8User = await User.create({
    name: 'Student Eight',
    email: 'stu8@school.local',
    password: 'password123',
    role: 'student',
    linked_student_id: student8Record.id,
    is_active: true,
  });

  const student5Record = await Student.create({
    student_id: 'STU-501',
    roll_number: '501',
    first_name: 'Student',
    last_name: 'Five',
    class: 'Class 5',
    section: 'B',
    gender: 'Female',
    date_of_birth: '2015-08-15',
    parent_name: 'Parent Five',
    parent_phone: '9876543211',
    session_id: session.id,
    approval_status: 'approved',
    student_status: 'active',
  });

  const student5User = await User.create({
    name: 'Student Five',
    email: 'stu5@school.local',
    password: 'password123',
    role: 'student',
    linked_student_id: student5Record.id,
    is_active: true,
  });

  // TEST 1: Column verification
  process.stdout.write('  [TEST] 1. Verify custom subcategory and targeting schema columns ... ');
  const qi = sequelize.getQueryInterface();
  const desc = await qi.describeTable('notifications');
  assert.ok(desc.target_class, 'target_class column must exist');
  assert.ok(desc.target_section, 'target_section column must exist');
  assert.ok(desc.target_subject, 'target_subject column must exist');
  assert.ok(desc.sub_category, 'sub_category column must exist');
  assert.ok(desc.priority, 'priority column must exist');
  console.log('✅ PASS');

  // TEST 2: Admin creates "teachers only" custom notification with Mathematics subject
  process.stdout.write('  [TEST] 2. Admin sends "Teachers Only" notice with department subcategory ... ');
  const teacherNotice = await Notification.create({
    title: 'Math Department Staff Meeting',
    message: 'Mandatory curriculum review meeting on Friday at 3:00 PM.',
    type: 'academic',
    recipient_type: 'role',
    recipient_role: 'teachers',
    target_subject: 'Mathematics',
    sub_category: 'Department Meeting',
    priority: 'high',
    sent_by: adminUser.id,
  });
  assert.strictEqual(teacherNotice.recipient_role, 'teachers');
  assert.strictEqual(teacherNotice.target_subject, 'Mathematics');
  assert.strictEqual(teacherNotice.priority, 'high');
  console.log('✅ PASS');

  // TEST 3: Admin creates "students only" custom notification with Class 8 subcategory
  process.stdout.write('  [TEST] 3. Admin sends "Students Only" notice targeted to Class 8 (Section A) ... ');
  const student8Notice = await Notification.create({
    title: 'Class 8 Science Practical Assignment',
    message: 'Please bring your biology workbook tomorrow.',
    type: 'academic',
    recipient_type: 'role',
    recipient_role: 'students',
    target_class: 'Class 8',
    target_section: 'A',
    sub_category: 'Homework & Syllabus',
    priority: 'normal',
    sent_by: adminUser.id,
  });
  assert.strictEqual(student8Notice.recipient_role, 'students');
  assert.strictEqual(student8Notice.target_class, 'Class 8');
  assert.strictEqual(student8Notice.target_section, 'A');
  console.log('✅ PASS');

  // TEST 4: Admin creates "all" broadcast notice
  process.stdout.write('  [TEST] 4. Admin sends broadcast notice to entire school ... ');
  const broadcastNotice = await Notification.create({
    title: 'Winter Vacation Announcement',
    message: 'The school will observe winter vacations starting next Monday.',
    type: 'holiday',
    recipient_type: 'all',
    recipient_role: 'all',
    sub_category: 'Holiday Notice',
    priority: 'urgent',
    sent_by: adminUser.id,
  });
  assert.strictEqual(broadcastNotice.recipient_type, 'all');
  assert.strictEqual(broadcastNotice.priority, 'urgent');
  console.log('✅ PASS');

  // TEST 5: Verify Teacher visibility rules
  process.stdout.write('  [TEST] 5. Teacher visibility: sees Math notice & Broadcast, NOT Class 8 student notice ... ');
  const { Op } = require('sequelize');

  const teacherWhere = {
    is_active: true,
    [Op.or]: [
      { recipient_type: 'all' },
      { recipient_role: 'all' },
      { recipient_type: 'individual', recipient_user_id: teacherUser.id },
      {
        [Op.and]: [
          { recipient_role: { [Op.in]: ['teachers', 'teacher'] } },
          {
            [Op.or]: [
              { target_subject: null },
              { target_subject: '' },
              { target_subject: 'all' },
              { target_subject: { [Op.like]: '%Mathematics%' } },
            ]
          }
        ]
      }
    ]
  };

  const teacherVisible = await Notification.findAll({ where: teacherWhere });
  const teacherTitles = teacherVisible.map(n => n.title);
  assert.ok(teacherTitles.includes('Math Department Staff Meeting'), 'Teacher must see Math Meeting');
  assert.ok(teacherTitles.includes('Winter Vacation Announcement'), 'Teacher must see Winter Vacation');
  assert.ok(!teacherTitles.includes('Class 8 Science Practical Assignment'), 'Teacher must NOT receive student-only practical notice');
  console.log('✅ PASS');

  // TEST 6: Verify Student Class 8 vs Student Class 5 visibility rules
  process.stdout.write('  [TEST] 6. Student class targeting: Class 8 student sees Class 8 notice, Class 5 does NOT ... ');
  const getStudentWhere = (sClass, sSec, uId) => ({
    is_active: true,
    [Op.or]: [
      { recipient_type: 'all' },
      { recipient_role: 'all' },
      { recipient_type: 'individual', recipient_user_id: uId },
      {
        [Op.and]: [
          { recipient_role: { [Op.in]: ['students', 'student', 'parents', 'parent'] } },
          {
            [Op.or]: [
              { target_class: null },
              { target_class: '' },
              { target_class: 'all' },
              { target_class: sClass },
            ]
          },
          {
            [Op.or]: [
              { target_section: null },
              { target_section: '' },
              { target_section: 'all' },
              { target_section: sSec },
            ]
          }
        ]
      }
    ]
  });

  const stu8Notifs = await Notification.findAll({ where: getStudentWhere('Class 8', 'A', student8User.id) });
  const stu8Titles = stu8Notifs.map(n => n.title);
  assert.ok(stu8Titles.includes('Class 8 Science Practical Assignment'), 'Class 8 student must see Class 8 notice');
  assert.ok(stu8Titles.includes('Winter Vacation Announcement'), 'Class 8 student must see Winter Vacation');
  assert.ok(!stu8Titles.includes('Math Department Staff Meeting'), 'Class 8 student must NOT see teacher meeting');

  const stu5Notifs = await Notification.findAll({ where: getStudentWhere('Class 5', 'B', student5User.id) });
  const stu5Titles = stu5Notifs.map(n => n.title);
  assert.ok(!stu5Titles.includes('Class 8 Science Practical Assignment'), 'Class 5 student must NOT see Class 8 notice');
  assert.ok(stu5Titles.includes('Winter Vacation Announcement'), 'Class 5 student sees schoolwide broadcast');
  console.log('✅ PASS');

  // TEST 7: Admin visibility: Admin can filter and view all notices
  process.stdout.write('  [TEST] 7. Admin visibility: complete overview with subcategory & priority queries ... ');
  const allNotifs = await Notification.findAll({ where: { is_active: true } });
  assert.strictEqual(allNotifs.length, 3);

  const urgentNotifs = await Notification.findAll({ where: { priority: 'urgent', is_active: true } });
  assert.strictEqual(urgentNotifs.length, 1);
  assert.strictEqual(urgentNotifs[0].title, 'Winter Vacation Announcement');
  console.log('✅ PASS');

  console.log('\n================================================================');
  console.log('   ALL 7 CUSTOM NOTIFICATION TESTS PASSED SUCCESSFULLY');
  console.log('================================================================\n');
}

if (require.main === module) {
  runCustomNotificationsTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Test Suite Failed:', err);
      process.exit(1);
    });
}

module.exports = { runCustomNotificationsTests };

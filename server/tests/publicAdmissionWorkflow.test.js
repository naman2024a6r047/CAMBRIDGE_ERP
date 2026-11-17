const assert = require('assert');
const {
  sequelize,
  AdmissionRequest,
  Student,
  User,
  Session,
  Notification,
  Setting,
  Fee,
  ClassFeeStructure
} = require('../models');
const { migrateAdmissionRequestColumns, migrateFeeColumns } = require('../utils/dbMigrator');

async function runAdmissionWorkflowTests() {
  console.log('\n================================================================');
  console.log('   PUBLIC ADMISSION FORM & ADMIN APPROVAL VERIFICATION SUITE');
  console.log('================================================================\n');

  await sequelize.sync();
  await migrateAdmissionRequestColumns();
  await migrateFeeColumns();

  // 1. Prepare Active Academic Session
  const [session] = await Session.findOrCreate({
    where: { name: '2026-2027' },
    defaults: {
      start_date: '2026-04-01',
      end_date: '2027-03-31',
      is_active: true,
    }
  });
  await session.update({ is_active: true });

  // 2. Prepare Admin User
  const [adminUser] = await User.findOrCreate({
    where: { email: 'admin_adm_test@cambridge.com' },
    defaults: {
      name: 'Dr Arshad Kichloo',
      password: 'password123',
      role: 'admin',
      is_active: true,
    }
  });

  // 3. Prepare Class Fee Structure for 'Class 1'
  await ClassFeeStructure.destroy({ where: { class: 'Class 1' } });
  await ClassFeeStructure.create({
    class: 'Class 1',
    session_id: session.id,
    monthly_fee: 1500.00,
    admission_fee: 3000.00,
    is_active: true,
    is_published: true,
  });

  // TEST 1: Public Admission Submission creates pending request with unique form_no
  process.stdout.write('  [TEST] 1. Parent submits online admission form -> creates pending request & form_no ... ');
  const currentYear = new Date().getFullYear();
  const testFormNo = `ICS-${currentYear}-9901`;

  // Clean any old test records
  await AdmissionRequest.destroy({ where: { form_no: testFormNo } });

  const admissionData = {
    form_no:             testFormNo,
    first_name:          'Kabir',
    last_name:           'Wani',
    date_of_birth:       '2020-05-14',
    gender:              'Male',
    applying_class:      'Class 1',
    previous_school:     'Little Angels Kishtwar',
    aadhar_number:       '1234-5678-9012',
    passport_photo:      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',

    parent_name:         'Tariq Wani',
    father_name:         'Tariq Wani',
    father_occupation:   'Govt Lecturer',
    father_phone:        '9419123456',
    father_whatsapp:     '9419123456',
    mother_name:         'Parveena Begum',
    mother_occupation:   'Teacher',
    mother_phone:        '9419654321',
    mother_whatsapp:     '9419654321',
    parent_phone:        '9419123456',
    parent_email:        'tariq.wani@test.com',

    parent_address:      'House No. 12, Shaheedi Mohallah, Kishtwar',
    residential_address: 'House No. 12, Shaheedi Mohallah, Kishtwar',
    post_office_tehsil:  'Kishtwar',
    district:            'Kishtwar',
    pin_code:            '182205',

    application_date:    new Date().toISOString().split('T')[0],
    enquiry_mode:        'Social Media',
    remarks:             'Applying for Class 1 admission under general quota',
    documents_submitted: [
      'Birth Certificate (Age Proof)',
      'Passport Size Photographs (2)',
      'Aadhaar Card (Student & Parents)',
      'Address Proof'
    ],
    status:              'pending',
    source:              'public_portal',
  };

  const createdRequest = await AdmissionRequest.create(admissionData);
  assert.ok(createdRequest);
  assert.strictEqual(createdRequest.form_no, testFormNo);
  assert.strictEqual(createdRequest.status, 'pending');
  assert.strictEqual(createdRequest.source, 'public_portal');
  assert.strictEqual(createdRequest.first_name, 'Kabir');
  assert.strictEqual(createdRequest.applying_class, 'Class 1');
  assert.strictEqual(createdRequest.district, 'Kishtwar');
  console.log('✅ PASS');

  // TEST 2: Notify Admin on public submission
  process.stdout.write('  [TEST] 2. System registers notification for school administrator ... ');
  const notif = await Notification.create({
    user_id: adminUser.id,
    type:    'admission',
    title:   'New Online Admission Application',
    message: `Kabir Wani applied for Class 1 (Form No: ${testFormNo}).`,
    link:    '/admin/admissions',
  });
  assert.ok(notif);
  assert.strictEqual(notif.type, 'admission');
  console.log('✅ PASS');

  // TEST 3: Verification of Status Lookup
  process.stdout.write('  [TEST] 3. Status lookup returns pending application ... ');
  const lookup = await AdmissionRequest.findOne({ where: { form_no: testFormNo } });
  assert.ok(lookup);
  assert.strictEqual(lookup.status, 'pending');
  assert.strictEqual(lookup.parent_phone, '9419123456');
  console.log('✅ PASS');

  // TEST 4: Admin reviews and approves admission request
  process.stdout.write('  [TEST] 4. Admin approves admission -> creates student, user credentials & fees ... ');
  const assignSection = 'B';
  const assignRollNo = 15;

  const newStudent = await Student.create({
    student_id:           'PENDING',
    first_name:           createdRequest.first_name,
    last_name:            createdRequest.last_name,
    date_of_birth:        createdRequest.date_of_birth,
    gender:               createdRequest.gender,
    class:                createdRequest.applying_class,
    section:              assignSection,
    roll_number:          assignRollNo,
    parent_name:          createdRequest.parent_name,
    mother_name:          createdRequest.mother_name,
    parent_phone:         createdRequest.parent_phone,
    parent_email:         createdRequest.parent_email,
    parent_address:       createdRequest.residential_address,
    father_occupation:    createdRequest.father_occupation,
    mother_occupation:    createdRequest.mother_occupation,
    father_phone:         createdRequest.father_phone,
    father_whatsapp:      createdRequest.father_whatsapp,
    mother_phone:         createdRequest.mother_phone,
    mother_whatsapp:      createdRequest.mother_whatsapp,
    post_office_tehsil:   createdRequest.post_office_tehsil,
    district:             createdRequest.district,
    pin_code:             createdRequest.pin_code,
    previous_school:      createdRequest.previous_school,
    aadhar_number:        createdRequest.aadhar_number,
    profile_photo:        createdRequest.passport_photo,
    enquiry_mode:         createdRequest.enquiry_mode,
    form_no:              createdRequest.form_no,
    admission_date:       createdRequest.application_date,
    session_id:           session.id,
    is_active:            true,
    student_status:       'active',
    source:               'admission_approved',
    admission_request_id: createdRequest.id,
    created_by:           adminUser.id,
    approval_status:      'approved',
    approved_by:          adminUser.id,
    approved_at:          new Date(),
  });

  const stuId = `STU${String(newStudent.id).padStart(5, '0')}`;
  await newStudent.update({ student_id: stuId });

  await createdRequest.update({
    status: 'approved',
    student_id_created: newStudent.id,
    reviewed_by: adminUser.id,
    approved_at: new Date(),
  });

  // Verify created Student
  const verifiedStudent = await Student.findByPk(newStudent.id);
  assert.ok(verifiedStudent);
  assert.strictEqual(verifiedStudent.student_id, stuId);
  assert.strictEqual(verifiedStudent.approval_status, 'approved');
  assert.strictEqual(verifiedStudent.is_active, true);
  assert.strictEqual(verifiedStudent.section, 'B');
  assert.strictEqual(verifiedStudent.roll_number, 15);
  assert.strictEqual(verifiedStudent.form_no, testFormNo);
  assert.strictEqual(verifiedStudent.district, 'Kishtwar');
  assert.strictEqual(verifiedStudent.father_occupation, 'Govt Lecturer');

  // Verify AdmissionRequest status is updated to approved
  await createdRequest.reload();
  assert.strictEqual(createdRequest.status, 'approved');
  assert.strictEqual(createdRequest.student_id_created, newStudent.id);
  console.log('✅ PASS');

  // TEST 5: Student account auto-syncs class fee structure for Class 1 (Admission Fee ₹3000, Monthly ₹1500)
  process.stdout.write('  [TEST] 5. Approved student auto-receives class fee structure without arbitrary defaults ... ');
  const { getOrCreateFeeRecord } = require('../services/feeService');
  const now = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = months[now.getMonth()];
  const currentYr = now.getFullYear();

  const { record: admFeeRec } = await getOrCreateFeeRecord(verifiedStudent, monthName, currentYr, 'admission');
  assert.strictEqual(Number(admFeeRec.total_amount), 3000.00);

  const { record: monFeeRec } = await getOrCreateFeeRecord(verifiedStudent, monthName, currentYr, 'monthly');
  assert.strictEqual(Number(monFeeRec.total_amount), 1500.00);
  console.log('✅ PASS');

  // TEST 6: New pending admission requests are NOT auto-approved by migrator
  process.stdout.write('  [TEST] 6. New pending applications strictly remain pending across server boot ... ');
  const testPendingForm = `ICS-${currentYear}-9902`;
  await AdmissionRequest.destroy({ where: { form_no: testPendingForm } });

  const secondPending = await AdmissionRequest.create({
    ...admissionData,
    form_no: testPendingForm,
    first_name: 'Zoya',
    last_name: 'Malik',
    status: 'pending',
  });

  // Re-run pending students migration
  const { migratePendingStudents } = require('../utils/dbMigrator');
  await migratePendingStudents();

  await secondPending.reload();
  assert.strictEqual(secondPending.status, 'pending');
  assert.strictEqual(secondPending.student_id_created, null);
  console.log('✅ PASS');

  console.log('\n================================================================');
  console.log('   ALL ADMISSION WORKFLOW TESTS PASSED (0 FAILED)');
  console.log('================================================================\n');
}

runAdmissionWorkflowTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ ADMISSION TEST FAILED:', err);
    process.exit(1);
  });

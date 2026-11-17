const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Student = sequelize.define('Student', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  student_id: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false,
  },
  first_name:  { type: DataTypes.STRING(60), allowNull: false },
  last_name:   { type: DataTypes.STRING(60), allowNull: false },
  date_of_birth: DataTypes.DATEONLY,
  gender:      DataTypes.ENUM('Male', 'Female', 'Other'),
  class:       { type: DataTypes.STRING(20), allowNull: false },
  section:     { type: DataTypes.STRING(5),  allowNull: false },
  roll_number: DataTypes.INTEGER,
  session_id:  DataTypes.INTEGER,

  // Parent info
  parent_name:       DataTypes.STRING(100),
  father_name:       DataTypes.STRING(100),
  parent_email:      DataTypes.STRING(150),
  parent_phone:      DataTypes.STRING(20),
  parent_address:    DataTypes.TEXT,
  residential_address: DataTypes.TEXT,
  parent_occupation: DataTypes.STRING(100),
  father_occupation: DataTypes.STRING(100),
  mother_name:       DataTypes.STRING(100),
  mother_occupation: DataTypes.STRING(100),
  father_phone:      DataTypes.STRING(20),
  father_whatsapp:   DataTypes.STRING(20),
  mother_phone:      DataTypes.STRING(20),
  mother_whatsapp:   DataTypes.STRING(20),
  post_office_tehsil:DataTypes.STRING(120),
  district:          DataTypes.STRING(80),
  pin_code:          DataTypes.STRING(15),
  previous_school:   DataTypes.STRING(150),
  enquiry_mode:      DataTypes.STRING(50),
  form_no:           DataTypes.STRING(40),

  // Student Identity & Category
  category:          DataTypes.STRING(50),
  aadhar_number:     DataTypes.STRING(20),
  pen_number:        DataTypes.STRING(30),
  family_id:         DataTypes.STRING(30),

  admission_date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  },

  profile_photo: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  passport_photo: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },

  // ── Status system ─────────────────────────────────────────────────────────
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  student_status: {
    type: DataTypes.ENUM('active', 'inactive', 'alumni', 'transferred', 'suspended'),
    defaultValue: 'active'
  },
  // Source of creation
  source: {
    type: DataTypes.ENUM('admin_created', 'admission_approved'),
    defaultValue: 'admin_created'
  },
  admission_request_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  approval_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'approved'
  },
  approved_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
}, {
  tableName: 'students',
  getterMethods: {
    full_name() { return `${this.first_name} ${this.last_name}`; }
  }
});

module.exports = Student;

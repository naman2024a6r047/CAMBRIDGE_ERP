const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AdmissionRequest = sequelize.define('AdmissionRequest', {
  id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  form_no:            { type: DataTypes.STRING(40), unique: true, allowNull: true },
  
  // 1. Student details
  first_name:         { type: DataTypes.STRING(60),  allowNull: false },
  last_name:          { type: DataTypes.STRING(60),  allowNull: false },
  date_of_birth:      { type: DataTypes.DATEONLY },
  gender:             { type: DataTypes.ENUM('Male', 'Female', 'Other') },
  applying_class:     { type: DataTypes.STRING(30),  allowNull: false },
  previous_school:    { type: DataTypes.STRING(150) },
  aadhar_number:       { type: DataTypes.STRING(30) },
  passport_photo:     { type: DataTypes.TEXT('long') }, // Base64 data URL or file path

  // 2. Parentage details
  parent_name:        { type: DataTypes.STRING(100), allowNull: false },
  father_name:        { type: DataTypes.STRING(100) },
  father_occupation:  { type: DataTypes.STRING(100) },
  father_phone:       { type: DataTypes.STRING(20) },
  father_whatsapp:    { type: DataTypes.STRING(20) },
  mother_name:        { type: DataTypes.STRING(100) },
  mother_occupation:  { type: DataTypes.STRING(100) },
  mother_phone:       { type: DataTypes.STRING(20) },
  mother_whatsapp:    { type: DataTypes.STRING(20) },
  parent_phone:       { type: DataTypes.STRING(20),  allowNull: false },
  parent_email:       { type: DataTypes.STRING(150) },

  // 3. Address details
  parent_address:     { type: DataTypes.TEXT },
  residential_address:{ type: DataTypes.TEXT },
  post_office_tehsil: { type: DataTypes.STRING(120) },
  district:           { type: DataTypes.STRING(80), defaultValue: 'Kishtwar' },
  pin_code:           { type: DataTypes.STRING(15) },

  // 4. Other details
  application_date:   { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  enquiry_mode:       { type: DataTypes.STRING(50) }, // Newspaper, Social Media, Reference, Other
  remarks:            { type: DataTypes.TEXT },
  documents_submitted:{ type: DataTypes.JSON }, // array or map of doc items

  // Workflow & Status
  status: {
    type: DataTypes.ENUM('pending', 'under_review', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  source:             { type: DataTypes.STRING(40), defaultValue: 'public_portal' }, // public_portal, fee_collector, admin
  submitted_by:       { type: DataTypes.INTEGER, allowNull: true }, // user id if submitted internally
  reviewed_by:        { type: DataTypes.INTEGER, allowNull: true }, // admin id
  review_notes:       { type: DataTypes.TEXT },
  approved_at:        { type: DataTypes.DATE },

  // If approved — student ID created
  student_id_created: { type: DataTypes.INTEGER, allowNull: true },
  admission_fee_paid: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
}, { 
  tableName: 'admission_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AdmissionRequest;

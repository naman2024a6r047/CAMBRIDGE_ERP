const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { sendPushToUsers } = require('../utils/pushService');

const Notification = sequelize.define('Notification', {
  id:      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title:   { type: DataTypes.STRING(150), allowNull: false },
  message: { type: DataTypes.TEXT,        allowNull: false },
  type: {
    type: DataTypes.ENUM(
      'fee_reminder', 'attendance_alert', 'result',
      'general', 'holiday', 'admission', 'promotion',
      'exam_datesheet', 'achievement'
    ),
    defaultValue: 'general'
  },
  sent_by: DataTypes.INTEGER,

  // ── Recipient config ───────────────────────────────────────────────────────
  recipient_type: {
    type: DataTypes.ENUM('all', 'role', 'individual'),
    defaultValue: 'all'
  },
  recipient_role: {
    type: DataTypes.ENUM('all', 'students', 'parents', 'teachers', 'fee_collector', 'admin2'),
    allowNull: true
  },
  recipient_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true   // Only set when recipient_type = 'individual'
  },

  // ── Custom subcategories and targeting ─────────────────────────────────────
  target_class: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  target_section: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  target_subject: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  sub_category: {
    type: DataTypes.STRING(100),
    defaultValue: 'General'
  },
  priority: {
    type: DataTypes.STRING(20),
    defaultValue: 'normal'
  },
  link: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { 
  tableName: 'notifications',
  hooks: {
    afterCreate: async (notification, options) => {
      try {
        const { User, Student, Teacher } = notification.sequelize.models;
        const { Op } = require('sequelize');
        let targetUserIds = [];

        if (notification.recipient_type === 'individual' && notification.recipient_user_id) {
          targetUserIds = [notification.recipient_user_id];
        } else if (notification.recipient_type === 'all') {
          const users = await User.findAll({ where: { is_active: true }, attributes: ['id'] });
          targetUserIds = users.map(u => u.id);
        } else if (notification.recipient_type === 'role' && notification.recipient_role) {
          if (['teachers', 'teacher'].includes(notification.recipient_role)) {
            if (notification.target_subject && notification.target_subject !== 'all') {
              const teachers = await Teacher.findAll({
                where: { subject: { [Op.like]: `%${notification.target_subject}%` } },
                attributes: ['id']
              });
              const teacherIds = teachers.map(t => t.id);
              const users = await User.findAll({
                where: { linked_teacher_id: { [Op.in]: teacherIds }, is_active: true },
                attributes: ['id']
              });
              targetUserIds = users.map(u => u.id);
            } else {
              const users = await User.findAll({ where: { role: 'teacher', is_active: true }, attributes: ['id'] });
              targetUserIds = users.map(u => u.id);
            }
          } else if (['students', 'student', 'parents', 'parent'].includes(notification.recipient_role)) {
            if (notification.target_class && notification.target_class !== 'all') {
              const studentWhere = { is_active: true, class: notification.target_class };
              if (notification.target_section && notification.target_section !== 'all') {
                studentWhere.section = notification.target_section;
              }
              const students = await Student.findAll({ where: studentWhere, attributes: ['id'] });
              const studentIds = students.map(s => s.id);
              const users = await User.findAll({
                where: {
                  linked_student_id: { [Op.in]: studentIds },
                  is_active: true,
                },
                attributes: ['id']
              });
              targetUserIds = users.map(u => u.id);
            } else {
              const users = await User.findAll({
                where: { role: { [Op.in]: ['student', 'parent'] }, is_active: true },
                attributes: ['id']
              });
              targetUserIds = users.map(u => u.id);
            }
          } else {
            let rolesToQuery = [notification.recipient_role];
            if (notification.recipient_role === 'all') {
              rolesToQuery = ['admin', 'admin2', 'parent', 'teacher', 'fee_collector'];
            }
            const users = await User.findAll({ 
              where: { role: rolesToQuery, is_active: true },
              attributes: ['id'] 
            });
            targetUserIds = users.map(u => u.id);
          }
        }

        if (targetUserIds.length > 0) {
          // Fire and forget push notification delivery
          sendPushToUsers(targetUserIds, {
            title: notification.title,
            message: notification.message
          }).catch(err => console.error('[NotificationHook] Push delivery error:', err));
        }
      } catch (error) {
        console.error('[NotificationHook] Failed to process push notifications:', error);
      }
    }
  }
});

module.exports = Notification;

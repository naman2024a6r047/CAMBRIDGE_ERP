const nodemailer = require('nodemailer');
const {
  SCHOOL_NAME,
  buildCredentialsEmail,
  buildNotificationEmail,
  buildAdmissionApprovedEmail,
  buildFeeReceiptEmail
} = require('./emailTemplates');

/**
 * Creates a configured Nodemailer transporter with defensive timeouts
 */
const createTransporter = () => {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT, 10) || 465;
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465 (SSL), false for 587 (TLS/STARTTLS)
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false // Defensive setting for shared hosting/cPanel/Hostinger
    },
    connectionTimeout: 4000, // 4s max to establish connection
    greetingTimeout: 4000,   // 4s max for SMTP greeting
    socketTimeout: 6000      // 6s max socket inactivity timeout
  });
};

/**
 * Resolve sender address
 */
const getSenderAddress = () => {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const defaultFrom = user 
    ? `"International Cambridge School" <${user}>` 
    : `"International Cambridge School ERP" <noreply@cambridge-erp.ktwr.in>`;
  return process.env.EMAIL_FROM || process.env.SMTP_FROM || defaultFrom;
};

/**
 * Dispatches mailOptions with strict timeout guard
 */
const dispatchMail = async (transporter, mailOptions) => {
  const sendPromise = transporter.sendMail(mailOptions);
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('SMTP send operation timed out after 5 seconds')), 5000)
  );
  return Promise.race([sendPromise, timeoutPromise]);
};

/**
 * Sends login credentials to a user via email.
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.name - Recipient's name
 * @param {string} options.loginId - User's login ID (email)
 * @param {string} options.password - Plain text password
 * @param {string} options.role - User's role
 * @param {Object} [options.studentDetails] - Optional student metadata (class, section, roll)
 * @param {Object} [options.teacherDetails] - Optional teacher metadata (subject, classes)
 * @returns {Promise<boolean>} - Returns true if email sent successfully, false otherwise
 */
const sendCredentialsEmail = async ({
  to,
  name,
  loginId,
  password,
  role,
  studentDetails = null,
  teacherDetails = null
}) => {
  const transporter = createTransporter();
  const portalUrl = process.env.CLIENT_URL || 'https://cambridge-erp.ktwr.in';

  if (!transporter) {
    console.warn('[Mail Service] ⚠️ Email environment variables are not configured. Email will not be sent.');
    return false;
  }

  try {
    const template = buildCredentialsEmail({
      name,
      loginId,
      password,
      role,
      portalUrl,
      studentDetails,
      teacherDetails
    });

    const mailOptions = {
      from: getSenderAddress(),
      to,
      subject: template.subject,
      text: template.text,
      html: template.html
    };

    const info = await dispatchMail(transporter, mailOptions);
    console.log(`[Mail Service] 📧 Credentials email delivered to ${to} (${info.messageId || 'sent'})`);
    return true;
  } catch (error) {
    console.error('[Mail Service] ❌ Failed to send credentials email to', to, error.message);
    return false;
  }
};

/**
 * Sends an official notification / circular email
 */
const sendNotificationEmail = async ({
  to,
  subject,
  message,
  priority = 'normal',
  subCategory = 'General Notice',
  targetAudience = 'All Students & Staff',
  actionUrl = null,
  senderName = 'Office of the Principal'
}) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[Mail Service] ⚠️ SMTP not configured for notifications.');
    return false;
  }

  try {
    const template = buildNotificationEmail({
      subject,
      message,
      priority,
      subCategory,
      targetAudience,
      actionUrl,
      senderName
    });

    const isArray = Array.isArray(to);
    const bccList = isArray ? to.filter(Boolean).join(',') : '';
    const fallbackTo = getSenderAddress();
    const toAddr = isArray ? fallbackTo : to;

    const mailOptions = {
      from: getSenderAddress(),
      to: toAddr,
      subject: template.subject,
      text: template.text,
      html: template.html
    };

    if (isArray && bccList) {
      mailOptions.bcc = bccList;
    }

    const info = await dispatchMail(transporter, mailOptions);
    console.log(`[Mail Service] 📧 Notification email delivered: "${subject}" (${info.messageId || 'sent'})`);
    return true;
  } catch (error) {
    console.error('[Mail Service] ❌ Failed to send notification email:', error.message);
    return false;
  }
};

/**
 * Sends admission approval confirmation email
 */
const sendAdmissionApprovedEmail = async ({
  to,
  studentName,
  parentName,
  className,
  formNo,
  studentId,
  loginId,
  password
}) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    const template = buildAdmissionApprovedEmail({
      studentName,
      parentName,
      className,
      formNo,
      studentId,
      loginId,
      password,
      portalUrl: process.env.CLIENT_URL || 'https://cambridge-erp.ktwr.in'
    });

    const mailOptions = {
      from: getSenderAddress(),
      to,
      subject: template.subject,
      text: template.text,
      html: template.html
    };

    const info = await dispatchMail(transporter, mailOptions);
    console.log(`[Mail Service] 📧 Admission approval email delivered to ${to} (${info.messageId || 'sent'})`);
    return true;
  } catch (error) {
    console.error('[Mail Service] ❌ Failed to send admission approval email:', error.message);
    return false;
  }
};

/**
 * Sends fee payment receipt email
 */
const sendFeeReceiptEmail = async ({
  to,
  studentName,
  parentName,
  className,
  receiptNo,
  amount,
  paymentMode,
  paymentDate,
  pendingAmount
}) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    const template = buildFeeReceiptEmail({
      studentName,
      parentName,
      className,
      receiptNo,
      amount,
      paymentMode,
      paymentDate,
      pendingAmount,
      portalUrl: process.env.CLIENT_URL || 'https://cambridge-erp.ktwr.in'
    });

    const mailOptions = {
      from: getSenderAddress(),
      to,
      subject: template.subject,
      text: template.text,
      html: template.html
    };

    const info = await dispatchMail(transporter, mailOptions);
    console.log(`[Mail Service] 📧 Fee receipt email delivered to ${to} (${info.messageId || 'sent'})`);
    return true;
  } catch (error) {
    console.error('[Mail Service] ❌ Failed to send fee receipt email:', error.message);
    return false;
  }
};

module.exports = {
  sendCredentialsEmail,
  sendNotificationEmail,
  sendAdmissionApprovedEmail,
  sendFeeReceiptEmail
};

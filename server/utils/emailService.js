const nodemailer = require('nodemailer');
const {
  SCHOOL_NAME,
  renderEmailShell,
  buildNotificationEmail
} = require('../services/emailTemplates');

let transporter = null;
let isConfigured = false;

const initTransporter = () => {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT, 10) || 465;
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    isConfigured = true;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 6000
    });
  }
};

/**
 * Sends an email to a single recipient or multiple BCC recipients.
 * Automatically wraps unformatted text into the official International Cambridge School template.
 * 
 * @param {string|string[]} to - Recipient email(s). If array, sent as BCC.
 * @param {string} subject - Email subject line
 * @param {string} text - Email plain body text
 * @param {string} [customHtml] - Optional pre-rendered HTML body
 */
const sendEmail = async (to, subject, text, customHtml = null) => {
  try {
    if (!isConfigured) initTransporter();

    const isArray = Array.isArray(to);
    const bccList = isArray ? to.filter(Boolean).join(',') : '';
    const user = process.env.EMAIL_USER || process.env.SMTP_USER;
    const defaultFrom = user 
      ? `"International Cambridge School" <${user}>` 
      : `"International Cambridge School ERP" <noreply@cambridge-erp.ktwr.in>`;
    const fromAddr = process.env.EMAIL_FROM || process.env.SMTP_FROM || defaultFrom;
    const toAddr = isArray ? fromAddr : to;

    // Build responsive HTML template if not explicitly provided
    let htmlContent = customHtml;
    if (!htmlContent) {
      const template = buildNotificationEmail({
        subject,
        message: text,
        priority: subject.toLowerCase().includes('urgent') ? 'urgent' : (subject.toLowerCase().includes('important') ? 'high' : 'normal'),
        subCategory: 'Official Communication',
        targetAudience: isArray ? 'School Community' : 'Recipient',
        senderName: 'Office of the Principal'
      });
      htmlContent = template.html;
    }

    if (!transporter) {
      console.log('=====================================================');
      console.log(`📬 [EMAIL SERVICE MOCK] SMTP not configured.`);
      console.log(`FROM: ${fromAddr}`);
      console.log(`TO: ${toAddr}`);
      if (isArray && bccList) console.log(`BCC: ${bccList}`);
      console.log(`SUBJECT: ${subject}`);
      console.log(`BODY:\n${text}`);
      console.log('=====================================================');
      return true;
    }

    const mailOptions = {
      from: fromAddr,
      to: toAddr,
      subject,
      text,
      html: htmlContent
    };

    if (isArray && bccList) {
      mailOptions.bcc = bccList;
    }

    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SMTP send operation timed out after 5 seconds')), 5000)
    );
    await Promise.race([sendPromise, timeoutPromise]);
    console.log(`[Email Service] 📧 Email sent successfully: "${subject}" to ${isArray ? `(${to.length} recipients)` : to}`);
    return true;
  } catch (err) {
    console.error('[Email Service] ❌ Email sending failed:', err.message);
    return false;
  }
};

module.exports = {
  sendEmail,
};

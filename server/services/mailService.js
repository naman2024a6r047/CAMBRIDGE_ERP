const nodemailer = require('nodemailer');

/**
 * Sends login credentials to a user via email.
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.name - Recipient's name
 * @param {string} options.loginId - User's login ID (email)
 * @param {string} options.password - Plain text password
 * @param {string} options.role - User's role
 * @returns {Promise<boolean>} - Returns true if email sent successfully, false otherwise
 */
const sendCredentialsEmail = async ({ to, name, loginId, password, role }) => {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT, 10) || 465;
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const defaultFrom = user ? `"International Cambridge School" <${user}>` : '"Cambridge School ERP" <noreply@cambridge-erp.ktwr.in>';
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || defaultFrom;
  const portalUrl = process.env.CLIENT_URL || 'https://cambridge-erp.ktwr.in';

  if (!host || !user || !pass) {
    console.warn('[Mail Service] ⚠️ Email environment variables are not configured. Email will not be sent.');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465 (SSL), false for 587 (TLS/STARTTLS)
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false // Defensive setting for shared hosting/transports
      },
      connectionTimeout: 4000, // 4s max to establish connection
      greetingTimeout: 4000,   // 4s max for SMTP greeting
      socketTimeout: 6000      // 6s max socket inactivity timeout
    });

    const mailOptions = {
      from,
      to,
      subject: 'International Cambridge School - Login Credentials',
      text: `Hello ${name},

Your Cambridge School ERP login credentials have been created/updated.

Login Portal URL:
${portalUrl}

Your Login ID / Email:
${loginId}

Your Password:
${password}

Role:
${role}

Please log in to your account.
Do not reply to this automated email.

For any queries, please contact the school administration.

Regards,
International Cambridge School ERP Administration`,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
<h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">International Cambridge School</h2>
<p>Hello <strong>${name}</strong>,</p>
<p>Your School ERP login credentials have been successfully created/updated.</p>
<div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
  <p style="margin: 6px 0;"><strong>Login Portal:</strong> <a href="${portalUrl}" target="_blank" style="color: #2563eb; text-decoration: none;">${portalUrl}</a></p>
  <p style="margin: 6px 0;"><strong>Login ID:</strong> <code>${loginId}</code></p>
  <p style="margin: 6px 0;"><strong>Password:</strong> <code>${password}</code></p>
  <p style="margin: 6px 0;"><strong>Assigned Role:</strong> <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 13px;">${role}</span></p>
</div>
<p style="font-size: 14px; color: #64748b;">Please log in to your account and change your password after first login.</p>
<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
<p style="font-size: 12px; color: #94a3b8;">This is an automated notification from International Cambridge School ERP. Please do not reply directly to this email.</p>
</div>`
    };

    // Strict 5-second timeout guard to prevent any process stalling
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SMTP send operation timed out after 5 seconds')), 5000)
    );
    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log(`[Mail Service] 📧 Email sent successfully to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('[Mail Service] ❌ Failed to send email:', error);
    return false;
  }
};

module.exports = {
  sendCredentialsEmail
};

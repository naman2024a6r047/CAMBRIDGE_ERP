/**
 * emailTemplates.js
 * 
 * World-class, responsive, bulletproof HTML email templates for
 * International Cambridge School Kishtwar ERP.
 * 
 * Compatible with all major email clients: Gmail (Web, iOS, Android),
 * Apple Mail, Outlook (Desktop, Web, Mobile), Yahoo Mail, Samsung Mail.
 */

const SCHOOL_NAME = 'International Cambridge School';
const SCHOOL_SUBTITLE = 'Kishtwar, Jammu & Kashmir';
const SCHOOL_ADDRESS = 'Kishtwar, Jammu & Kashmir — 182204';
const DEFAULT_PORTAL_URL = process.env.CLIENT_URL || 'https://cambridge-erp.ktwr.in';

/**
 * Escapes HTML characters for safe rendering in templates
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Master Shell for all school emails
 */
function renderEmailShell({
  preheader = '',
  categoryBadge = 'OFFICIAL COMMUNICATION',
  badgeColor = '#3b82f6',
  badgeBg = '#eff6ff',
  title = '',
  contentHtml = '',
  actionUrl = DEFAULT_PORTAL_URL,
  actionText = 'Open School ERP Portal',
  footerNote = ''
}) {
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title || SCHOOL_NAME)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, span { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    body, p, h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
    body { width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; margin: 0; padding: 0; background-color: #f1f5f9; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    a { color: #2563eb; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .credential-row td { display: block !important; width: 100% !important; padding: 6px 0 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <!-- Preheader preview text (hidden from view inside email) -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #f1f5f9; opacity: 0; mso-hide: all;">
    ${escapeHtml(preheader || title)} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; width: 100%; padding: 30px 10px 40px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03); border: 1px solid #e2e8f0;">
          
          <!-- School Branded Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #091325 0%, #172554 50%, #1e3a8a 100%); padding: 34px 28px 30px 28px; text-align: center; border-top: 5px solid #f59e0b;">
              <!-- Crest Badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 14px auto;">
                <tr>
                  <td align="center" style="width: 54px; height: 54px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4); text-align: center; vertical-align: middle; border: 2px solid #fef3c7;">
                    <span style="font-family: 'Times New Roman', Times, Georgia, serif; font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 1px; display: block; line-height: 50px;">ICS</span>
                  </td>
                </tr>
              </table>

              <!-- School Title -->
              <h1 style="color: #ffffff; font-size: 21px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                ${SCHOOL_NAME}
              </h1>

              <!-- Location Subtitle -->
              <p style="color: #fbbf24; font-size: 11.5px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin: 0;">
                ${SCHOOL_SUBTITLE}
              </p>

              <!-- Category Badge -->
              ${categoryBadge ? `
              <div style="margin-top: 18px;">
                <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.12); color: #e2e8f0; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; padding: 4px 14px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2);">
                  ${escapeHtml(categoryBadge)}
                </span>
              </div>` : ''}
            </td>
          </tr>

          <!-- Gold Accent Divider Ribbon -->
          <tr>
            <td height="3" style="background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%); line-height: 3px; font-size: 3px;">&nbsp;</td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td class="mobile-padding" style="padding: 34px 32px 28px 32px;">
              ${contentHtml}

              <!-- Action Call-to-Action Button (if provided) -->
              ${actionUrl ? `
              <div style="margin: 32px 0 24px 0; text-align: center;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${actionUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="18%" stroke="f" fillcolor="#2563eb">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${escapeHtml(actionText)}</center>
                </v:roundrect>
                <![endif]-->
                <a href="${actionUrl}" target="_blank" style="mso-hide:all; display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; font-size: 14.5px; font-weight: 700; text-decoration: none; padding: 13px 30px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35); letter-spacing: 0.3px; border: 1px solid #1d4ed8;">
                  ${escapeHtml(actionText)} &rarr;
                </a>
              </div>` : ''}

              <!-- Security / Advice Notice Box -->
              ${footerNote ? `
              <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; padding: 14px 16px; margin: 24px 0 0 0;">
                <p style="font-size: 12.5px; line-height: 1.5; color: #475569; margin: 0;">
                  ${footerNote}
                </p>
              </div>` : ''}
            </td>
          </tr>

          <!-- Institutional Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 26px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 4px 0;">
                ${SCHOOL_NAME}
              </p>
              <p style="font-size: 11.5px; color: #64748b; margin: 0 0 10px 0;">
                ${SCHOOL_ADDRESS}
              </p>

              <!-- Portal Link -->
              <p style="font-size: 12px; margin: 0 0 14px 0;">
                <a href="${DEFAULT_PORTAL_URL}" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: none;">
                  Official ERP Portal: ${DEFAULT_PORTAL_URL.replace(/^https?:\/\//, '')}
                </a>
              </p>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 14px auto; max-width: 400px;" />

              <p style="font-size: 11px; line-height: 1.5; color: #94a3b8; margin: 0;">
                This is an official automated communication from the International Cambridge School ERP system.<br />
                Please do not reply directly to this email. For assistance, kindly contact the school administration office.
              </p>
              <p style="font-size: 10.5px; color: #cbd5e1; margin: 8px 0 0 0;">
                &copy; ${currentYear} International Cambridge School Kishtwar. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Credentials Email Template (Students, Parents, Teachers, Staff)
 */
function buildCredentialsEmail({
  name,
  loginId,
  password,
  role = 'User',
  portalUrl = DEFAULT_PORTAL_URL,
  studentDetails = null,
  teacherDetails = null
}) {
  const isStudent = role.toLowerCase().includes('student') || role.toLowerCase().includes('parent');
  const isTeacher = role.toLowerCase().includes('teacher');
  const formattedRole = isStudent ? 'Student & Parent Portal' : (isTeacher ? 'Faculty & Teacher Portal' : `${role} Portal`);

  const preheader = `Your Cambridge School ERP credentials for ${name}. Login ID: ${loginId}`;
  const categoryBadge = isStudent ? 'STUDENT & PARENT ACCESS' : (isTeacher ? 'FACULTY PORTAL ACCESS' : 'ERP ACCESS CREDENTIALS');

  let detailsBlock = '';

  if (studentDetails && (studentDetails.class || studentDetails.student_id)) {
    detailsBlock = `
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin: 18px 0 20px 0;">
      <p style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Student Record Profile</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #334155;">
        ${studentDetails.student_id ? `<tr><td style="padding: 2px 0; width: 120px; color: #64748b;">Student ID:</td><td style="padding: 2px 0; font-weight: 600;">${escapeHtml(studentDetails.student_id)}</td></tr>` : ''}
        ${studentDetails.class ? `<tr><td style="padding: 2px 0; width: 120px; color: #64748b;">Class & Section:</td><td style="padding: 2px 0; font-weight: 600;">${escapeHtml(studentDetails.class)} ${studentDetails.section ? `(${escapeHtml(studentDetails.section)})` : ''}</td></tr>` : ''}
        ${studentDetails.roll_number ? `<tr><td style="padding: 2px 0; width: 120px; color: #64748b;">Roll Number:</td><td style="padding: 2px 0; font-weight: 600;">${escapeHtml(studentDetails.roll_number)}</td></tr>` : ''}
        ${studentDetails.parent_name ? `<tr><td style="padding: 2px 0; width: 120px; color: #64748b;">Parent / Guardian:</td><td style="padding: 2px 0; font-weight: 600;">${escapeHtml(studentDetails.parent_name)}</td></tr>` : ''}
      </table>
    </div>`;
  } else if (teacherDetails && (teacherDetails.subject || teacherDetails.assignedClasses)) {
    detailsBlock = `
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin: 18px 0 20px 0;">
      <p style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Faculty Assignment</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #334155;">
        ${teacherDetails.subject ? `<tr><td style="padding: 2px 0; width: 120px; color: #64748b;">Department/Subject:</td><td style="padding: 2px 0; font-weight: 600;">${escapeHtml(teacherDetails.subject)}</td></tr>` : ''}
        ${teacherDetails.assignedClasses ? `<tr><td style="padding: 2px 0; width: 120px; color: #64748b;">Assigned Classes:</td><td style="padding: 2px 0; font-weight: 600;">${escapeHtml(teacherDetails.assignedClasses)}</td></tr>` : ''}
      </table>
    </div>`;
  }

  const contentHtml = `
    <!-- Greeting -->
    <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0;">
      Dear ${escapeHtml(name)},
    </p>

    <p style="font-size: 14.5px; line-height: 1.65; color: #334155; margin: 0 0 18px 0;">
      Welcome to <strong>${SCHOOL_NAME}</strong>. Your authorized credentials for the official School Management & ERP Portal have been successfully provisioned.
    </p>

    ${detailsBlock}

    <!-- Credentials Card Box -->
    <div style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 22px 24px; margin: 22px 0; box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.04);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <!-- Portal URL -->
        <tr class="credential-row">
          <td style="padding: 8px 0; width: 35%; color: #64748b; font-size: 13px; font-weight: 600;">Portal Address:</td>
          <td style="padding: 8px 0; width: 65%;">
            <a href="${portalUrl}" target="_blank" style="color: #2563eb; font-weight: 700; font-size: 13.5px; text-decoration: underline;">
              ${escapeHtml(portalUrl.replace(/^https?:\/\//, ''))}
            </a>
          </td>
        </tr>
        
        <!-- User ID / Login ID -->
        <tr class="credential-row">
          <td style="padding: 8px 0; width: 35%; color: #64748b; font-size: 13px; font-weight: 600;">User ID / Login:</td>
          <td style="padding: 8px 0; width: 65%;">
            <code style="background-color: #ffffff; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 6px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 14px; font-weight: 700; color: #0f172a; display: inline-block;">
              ${escapeHtml(loginId)}
            </code>
          </td>
        </tr>

        <!-- Password -->
        <tr class="credential-row">
          <td style="padding: 8px 0; width: 35%; color: #64748b; font-size: 13px; font-weight: 600;">Access Password:</td>
          <td style="padding: 8px 0; width: 65%;">
            <code style="background-color: #eff6ff; border: 1.5px dashed #93c5fd; padding: 5px 12px; border-radius: 6px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 15px; font-weight: 800; color: #1e3a8a; display: inline-block; letter-spacing: 0.5px;">
              ${escapeHtml(password)}
            </code>
          </td>
        </tr>

        <!-- Portal Role -->
        <tr class="credential-row">
          <td style="padding: 8px 0; width: 35%; color: #64748b; font-size: 13px; font-weight: 600;">Authorized Role:</td>
          <td style="padding: 8px 0; width: 65%;">
            <span style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 12px;">
              ${escapeHtml(formattedRole)}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Quick Instructions -->
    <div style="margin: 22px 0 10px 0;">
      <p style="font-size: 13.5px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0;">Getting Started in 3 Simple Steps:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #475569; line-height: 1.6;">
        <tr>
          <td style="vertical-align: top; width: 22px; color: #2563eb; font-weight: 800;">1.</td>
          <td style="padding-bottom: 6px;">Click the <strong>Sign In to ERP Portal</strong> button below to open the secure login page.</td>
        </tr>
        <tr>
          <td style="vertical-align: top; width: 22px; color: #2563eb; font-weight: 800;">2.</td>
          <td style="padding-bottom: 6px;">Enter your <strong>User ID</strong> and the temporary <strong>Access Password</strong> provided above.</td>
        </tr>
        <tr>
          <td style="vertical-align: top; width: 22px; color: #2563eb; font-weight: 800;">3.</td>
          <td style="padding-bottom: 6px;">For student & parent accounts, instantly review attendance logs, report cards, datesheets, and fee receipts.</td>
        </tr>
      </table>
    </div>
  `;

  const footerNote = `<strong>Security Notice:</strong> Please safeguard these credentials. For enhanced privacy, we recommend setting a personal password in your profile settings upon your first login. The school administration will never ask for your password via phone or message.`;

  const html = renderEmailShell({
    preheader,
    categoryBadge,
    title: `${SCHOOL_NAME} - Portal Login Credentials`,
    contentHtml,
    actionUrl: `${portalUrl.replace(/\/$/, '')}/login`,
    actionText: 'Sign In to ERP Portal',
    footerNote
  });

  const plainText = `${SCHOOL_NAME} - ${SCHOOL_SUBTITLE}
==================================================
PORTAL LOGIN CREDENTIALS

Dear ${name},

Your authorized credentials for the International Cambridge School ERP Portal have been successfully provisioned.

--- LOGIN DETAILS ---
Portal URL : ${portalUrl}
Login ID   : ${loginId}
Password   : ${password}
Role       : ${formattedRole}

To log in:
1. Visit: ${portalUrl}/login
2. Sign in using your Login ID and Password above.
3. Keep this password safe and change it upon first login.

For queries or technical support, please contact the school administration.

${SCHOOL_NAME}
${SCHOOL_ADDRESS}`;

  return { html, text: plainText, subject: `${SCHOOL_NAME} - Your ERP Login Credentials` };
}

/**
 * 2. Official Circular / Notification Template
 */
function buildNotificationEmail({
  subject,
  message,
  priority = 'normal',
  subCategory = 'General Notice',
  targetAudience = 'All Students & Staff',
  actionUrl = DEFAULT_PORTAL_URL,
  senderName = 'Office of the Principal'
}) {
  const normPriority = (priority || 'normal').toLowerCase();
  let badgeBg = '#eff6ff';
  let badgeColor = '#1d4ed8';
  let priorityLabel = 'NOTICE';

  if (normPriority === 'urgent') {
    badgeBg = '#fee2e2';
    badgeColor = '#b91c1c';
    priorityLabel = 'URGENT CIRCULAR';
  } else if (normPriority === 'high') {
    badgeBg = '#fef3c7';
    badgeColor = '#b45309';
    priorityLabel = 'IMPORTANT NOTICE';
  }

  const preheader = `[${priorityLabel}] ${subject} - ${SCHOOL_NAME}`;
  const paragraphs = String(message || '').split(/\n+/).filter(Boolean);

  const formattedBody = paragraphs.map(p => 
    `<p style="font-size: 14.5px; line-height: 1.7; color: #334155; margin: 0 0 14px 0;">${escapeHtml(p)}</p>`
  ).join('');

  const contentHtml = `
    <!-- Notification Header Meta Box -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin: 0 0 24px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 12.5px; color: #64748b;">
        <tr>
          <td style="padding: 2px 0;">
            <strong style="color: #475569;">Classification:</strong> ${escapeHtml(subCategory || 'Official Circular')}
          </td>
          <td align="right" style="padding: 2px 0;">
            <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; text-transform: uppercase;">
              ${escapeHtml(priorityLabel)}
            </span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 4px 0 0 0;">
            <strong style="color: #475569;">Audience:</strong> ${escapeHtml(targetAudience || 'School Community')}
          </td>
        </tr>
      </table>
    </div>

    <!-- Notice Subject -->
    <h2 style="font-size: 19px; font-weight: 800; color: #0f172a; line-height: 1.35; margin: 0 0 16px 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">
      ${escapeHtml(subject)}
    </h2>

    <!-- Main Message Body -->
    <div style="margin: 18px 0 26px 0;">
      ${formattedBody}
    </div>

    <!-- Sign-off Block -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px;">
      <p style="font-size: 13.5px; font-weight: 700; color: #1e293b; margin: 0 0 2px 0;">
        ${escapeHtml(senderName)}
      </p>
      <p style="font-size: 12px; color: #64748b; margin: 0;">
        ${SCHOOL_NAME}, Kishtwar
      </p>
    </div>
  `;

  const footerNote = `To review this announcement and past circulars at any time, log into your personal Cambridge School ERP account.`;

  const html = renderEmailShell({
    preheader,
    categoryBadge: priorityLabel,
    title: subject,
    contentHtml,
    actionUrl: actionUrl || `${DEFAULT_PORTAL_URL}/login`,
    actionText: 'View in ERP Portal',
    footerNote
  });

  const plainText = `${SCHOOL_NAME} - ${SCHOOL_SUBTITLE}
==================================================
OFFICIAL CIRCULAR: ${subject.toUpperCase()}
Priority: ${priorityLabel} | Category: ${subCategory}
Target: ${targetAudience}

${message}

Issued by:
${senderName}
${SCHOOL_NAME}, Kishtwar
Portal: ${DEFAULT_PORTAL_URL}`;

  return { html, text: plainText, subject: `[${priorityLabel}] ${subject} - ${SCHOOL_NAME}` };
}

/**
 * 3. Admission Approval Confirmation Template
 */
function buildAdmissionApprovedEmail({
  studentName,
  parentName,
  className,
  formNo,
  studentId,
  loginId,
  password,
  portalUrl = DEFAULT_PORTAL_URL
}) {
  const preheader = `Admission Confirmed! Welcome ${studentName} to ${SCHOOL_NAME}.`;

  const contentHtml = `
    <!-- Celebratory Badge -->
    <div style="text-align: center; margin: 0 0 20px 0;">
      <span style="display: inline-block; background-color: #ecfdf5; color: #047857; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 6px 16px; border-radius: 20px; border: 1px solid #a7f3d0;">
        🎉 ADMISSION CONFIRMED
      </span>
    </div>

    <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">
      Dear ${escapeHtml(parentName || 'Parent / Guardian')},
    </p>

    <p style="font-size: 14.5px; line-height: 1.65; color: #334155; margin: 0 0 16px 0;">
      We are delighted to inform you that the admission of <strong>${escapeHtml(studentName)}</strong> to <strong>${escapeHtml(className || 'our school')}</strong> has been formally approved and registered in the school records.
    </p>

    <!-- Admission Details Table -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 18px 0 22px 0;">
      <p style="font-size: 12.5px; font-weight: 700; color: #475569; text-transform: uppercase; margin: 0 0 10px 0;">Confirmed Admission Record</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13.5px; color: #334155;">
        <tr><td style="padding: 4px 0; color: #64748b; width: 40%;">Student Full Name:</td><td style="padding: 4px 0; font-weight: 700;">${escapeHtml(studentName)}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Enrolled Class:</td><td style="padding: 4px 0; font-weight: 700;">${escapeHtml(className)}</td></tr>
        ${formNo ? `<tr><td style="padding: 4px 0; color: #64748b;">Application Form No:</td><td style="padding: 4px 0; font-weight: 700;">${escapeHtml(formNo)}</td></tr>` : ''}
        ${studentId ? `<tr><td style="padding: 4px 0; color: #64748b;">Permanent Student ID:</td><td style="padding: 4px 0; font-weight: 700; color: #1e3a8a;">${escapeHtml(studentId)}</td></tr>` : ''}
      </table>
    </div>

    <!-- Credentials Card Box -->
    <div style="background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%); border: 1.5px solid #93c5fd; border-radius: 12px; padding: 20px 22px; margin: 20px 0;">
      <p style="font-size: 13px; font-weight: 700; color: #1e40af; margin: 0 0 8px 0;">Student & Parent Portal Credentials</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13.5px;">
        <tr><td style="padding: 4px 0; width: 35%; color: #475569;">Login User ID:</td><td style="padding: 4px 0; font-weight: 700; font-family: monospace;">${escapeHtml(loginId)}</td></tr>
        <tr><td style="padding: 4px 0; color: #475569;">Access Password:</td><td style="padding: 4px 0; font-weight: 800; font-family: monospace; color: #1e3a8a;">${escapeHtml(password)}</td></tr>
      </table>
    </div>

    <p style="font-size: 13.5px; line-height: 1.6; color: #475569; margin: 16px 0;">
      Through the Student & Parent Portal, you will be able to track daily attendance, examination datesheets, term report cards, syllabus updates, and fee receipts directly online.
    </p>
  `;

  const footerNote = `Please visit the school administrative office if you require assistance with school uniforms, transportation routes, or textbooks.`;

  const html = renderEmailShell({
    preheader,
    categoryBadge: 'ADMISSION CONFIRMATION',
    title: `Admission Approved - ${studentName}`,
    contentHtml,
    actionUrl: `${portalUrl.replace(/\/$/, '')}/login`,
    actionText: 'Access Student Portal',
    footerNote
  });

  const plainText = `${SCHOOL_NAME} - ${SCHOOL_SUBTITLE}
==================================================
ADMISSION CONFIRMATION

Dear ${parentName || 'Parent / Guardian'},

We are pleased to inform you that the admission of ${studentName} into ${className} has been approved.

Student Name : ${studentName}
Class        : ${className}
${studentId ? `Student ID   : ${studentId}\n` : ''}
Portal User ID: ${loginId}
Password     : ${password}
Portal URL   : ${portalUrl}/login

Welcome to International Cambridge School Kishtwar!`;

  return { html, text: plainText, subject: `Admission Approved - Welcome ${studentName} to ${SCHOOL_NAME}` };
}

/**
 * 4. Fee Payment & Receipt Acknowledgment Template
 */
function buildFeeReceiptEmail({
  studentName,
  parentName,
  className,
  receiptNo,
  amount,
  paymentMode = 'Online',
  paymentDate = new Date().toLocaleDateString('en-IN'),
  breakdown = null,
  pendingAmount = 0,
  portalUrl = DEFAULT_PORTAL_URL
}) {
  const preheader = `Fee payment receipt #${receiptNo} for ${studentName}: ₹${amount}`;

  const formattedAmount = Number(amount || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });

  const contentHtml = `
    <div style="text-align: center; margin: 0 0 20px 0;">
      <span style="display: inline-block; background-color: #ecfdf5; color: #047857; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 5px 14px; border-radius: 20px; border: 1px solid #a7f3d0;">
        ✓ PAYMENT RECEIVED
      </span>
    </div>

    <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0;">
      Dear ${escapeHtml(parentName || 'Parent / Guardian')},
    </p>

    <p style="font-size: 14.5px; line-height: 1.6; color: #334155; margin: 0 0 18px 0;">
      Thank you for your payment. We hereby acknowledge receipt of school fees for <strong>${escapeHtml(studentName)}</strong> (${escapeHtml(className)}).
    </p>

    <!-- Receipt Amount Banner -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); border-radius: 12px; padding: 22px; text-align: center; margin: 18px 0 24px 0; color: #ffffff;">
      <p style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #93c5fd; margin: 0 0 4px 0;">Total Amount Paid</p>
      <p style="font-size: 32px; font-weight: 800; color: #fbbf24; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${formattedAmount}
      </p>
      <p style="font-size: 12px; color: #cbd5e1; margin: 6px 0 0 0;">
        Receipt No: <strong style="color: #ffffff;">${escapeHtml(receiptNo)}</strong> &bull; Date: ${escapeHtml(paymentDate)}
      </p>
    </div>

    <!-- Receipt Details Table -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 18px; margin: 0 0 20px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #334155;">
        <tr><td style="padding: 4px 0; color: #64748b; width: 40%;">Student:</td><td style="padding: 4px 0; font-weight: 700;">${escapeHtml(studentName)}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Class:</td><td style="padding: 4px 0; font-weight: 600;">${escapeHtml(className)}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Payment Mode:</td><td style="padding: 4px 0; font-weight: 600; text-transform: uppercase;">${escapeHtml(paymentMode)}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Outstanding Balance:</td><td style="padding: 4px 0; font-weight: 700; color: ${pendingAmount > 0 ? '#b91c1c' : '#059669'};">₹${Number(pendingAmount || 0).toLocaleString('en-IN')}</td></tr>
      </table>
    </div>
  `;

  const footerNote = `Official tax-compliant fee receipts with authorized QR stamp can be downloaded at any time from the Student Fee section in your ERP Portal.`;

  const html = renderEmailShell({
    preheader,
    categoryBadge: 'OFFICIAL FEE RECEIPT',
    title: `Fee Receipt #${receiptNo} - ${studentName}`,
    contentHtml,
    actionUrl: `${portalUrl.replace(/\/$/, '')}/parent/fees`,
    actionText: 'View Fee Ledger in Portal',
    footerNote
  });

  const plainText = `${SCHOOL_NAME} - ${SCHOOL_SUBTITLE}
==================================================
OFFICIAL FEE RECEIPT

Receipt No : ${receiptNo}
Date       : ${paymentDate}
Student    : ${studentName} (${className})
Amount Paid: ${formattedAmount}
Mode       : ${paymentMode}
Outstanding: ₹${pendingAmount}

Thank you for your timely payment.
Portal: ${DEFAULT_PORTAL_URL}`;

  return { html, text: plainText, subject: `Fee Receipt #${receiptNo} - ${studentName} - ${SCHOOL_NAME}` };
}

module.exports = {
  SCHOOL_NAME,
  SCHOOL_SUBTITLE,
  SCHOOL_ADDRESS,
  renderEmailShell,
  buildCredentialsEmail,
  buildNotificationEmail,
  buildAdmissionApprovedEmail,
  buildFeeReceiptEmail
};

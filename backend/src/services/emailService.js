import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fallbackFromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const supportContactEmail = process.env.SUPPORT_CONTACT_EMAIL || "reachIQ.support@gmail.com";

let resendClient = undefined;

function getResendClient() {
  if (resendClient !== undefined) {
    return resendClient;
  }

  if (!process.env.RESEND_API_KEY) {
    resendClient = null;
    return resendClient;
  }

  try {
    const { Resend } = require("resend");
    resendClient = new Resend(process.env.RESEND_API_KEY);
    return resendClient;
  } catch (error) {
    console.warn("[ReachIQ] Resend is unavailable, so support emails are temporarily disabled.", error?.message || error);
    resendClient = null;
    return resendClient;
  }
}

function buildEmailHeader() {
  return `
    <div style="background:#6C63FF;padding:24px 40px;text-align:center;">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="padding-right:12px;vertical-align:middle;">
            <svg width="36" height="36" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 18C16 11.3726 21.3726 6 28 6H78C84.6274 6 90 11.3726 90 18V70C90 83.2548 79.2548 94 66 94H20L10 98L13.6 85.4C15.1635 79.9278 16 74.2643 16 68.5735V18Z" fill="white" />
              <path d="M30 25H50.6C63.4933 25 71.6 31.36 71.6 42.56C71.6 51.7333 66.0933 57.92 56.16 59.5733L74 77H60.5067L44.6133 60.8933H41.84V77H30V25ZM49.8267 51.4267C56.7867 51.4267 60.12 48.6133 60.12 43.1867C60.12 37.8133 56.7867 35.1067 49.8267 35.1067H41.84V51.4267H49.8267Z" fill="#6C63FF" />
              <circle cx="79" cy="18" r="12" fill="#00D9A6" />
            </svg>
          </td>
          <td style="vertical-align:middle;">
            <span style="color:white;font-size:22px;font-weight:600;font-family:Arial,sans-serif;">
              reach<span style="color:#00D9A6;">iq</span>
            </span>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildEmailShell(content) {
  return `
    <div style="background:#0A0A0F;padding:32px 16px;font-family:Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;border:1px solid #2A2A3D;border-radius:20px;overflow:hidden;background:#12121A;">
        ${buildEmailHeader()}
        <div style="padding:32px 28px;color:#F0F0FF;line-height:1.6;">
          ${content}
        </div>
      </div>
    </div>
  `;
}

export async function sendSupportReplyEmail({ to, subject, reply }) {
  const resend = getResendClient();
  if (!resend) return null;

  return resend.emails.send({
    from: `ReachIQ <${fallbackFromAddress}>`,
    to,
    reply_to: supportContactEmail,
    subject,
    html: buildEmailShell(`
      <h2 style="margin:0 0 16px;">Support reply</h2>
      <p style="margin:0;">${reply}</p>
    `)
  });
}

export async function notifySupportInboxEmail({ subject, message, fromEmail, fromName }) {
  const resend = getResendClient();
  if (!resend) return null;

  const supportInbox = process.env.SUPPORT_INBOX_EMAIL || "kavie100507@gmail.com";

  return resend.emails.send({
    from: `ReachIQ <${fallbackFromAddress}>`,
    to: supportInbox,
    reply_to: supportContactEmail,
    subject: `New ReachIQ support ticket: ${subject}`,
    html: buildEmailShell(`
      <h2>New support ticket</h2>
      <p><strong>From:</strong> ${fromName || "ReachIQ user"} (${fromEmail || "no-email"})</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `)
  });
}

export async function sendWelcomeEmail({ to, fullName }) {
  const resend = getResendClient();
  if (!resend) return null;

  return resend.emails.send({
    from: `ReachIQ <${fallbackFromAddress}>`,
    to,
    reply_to: supportContactEmail,
    subject: "Welcome to ReachIQ",
    html: buildEmailShell(`
      <h2 style="margin:0 0 16px;">Welcome to ReachIQ</h2>
      <p style="margin:0 0 16px;">Hi ${fullName || "there"},</p>
      <p style="margin:0 0 16px;">
        Welcome to ReachIQ. Your workspace is ready for lead discovery, AI-generated outreach, website previews, campaign launches, and follow-ups.
      </p>
      <p style="margin:0 0 16px;">
        Start with Find Leads, add the best-fit businesses into your pipeline, then launch a campaign with your chosen message and website template.
      </p>
      <p style="margin:0;">
        If you need help, reply to this email or contact us at ${supportContactEmail}.
      </p>
    `)
  });
}

export async function sendPaymentReviewEmail({
  to,
  fullName,
  planLabel,
  amount,
  transactionId,
  approvedAt,
  invoiceNumber,
  status,
  reviewNotes
}) {
  const resend = getResendClient();
  if (!resend || !to || !status) return null;

  const normalizedStatus = String(status).trim().toLowerCase();
  const approved = normalizedStatus === "approved";
  const safePlanLabel = planLabel || "ReachIQ plan";
  const greetingName = fullName || "there";
  const heading = approved ? "Payment approved" : "Payment review update";
  const subject = approved
    ? `ReachIQ: ${safePlanLabel} activated`
    : `ReachIQ: ${safePlanLabel} payment needs attention`;
  const statusMessage = approved
    ? `${safePlanLabel} is now active on your account.`
    : `${safePlanLabel} could not be approved yet.`;
  const notesBlock = reviewNotes
    ? `<p style="margin:16px 0 0;"><strong>Review note:</strong> ${reviewNotes}</p>`
    : "";
  const receiptBlock = approved
    ? `
      <div style="margin:20px 0 0;padding:16px;border:1px solid #2A2A3D;border-radius:16px;background:#0F0F17;">
        <p style="margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:0.14em;color:#9898B8;">Payment Receipt</p>
        <p style="margin:0 0 6px;"><strong>Plan:</strong> ${safePlanLabel}</p>
        <p style="margin:0 0 6px;"><strong>Amount:</strong> ${amount || "-"}</p>
        <p style="margin:0 0 6px;"><strong>Transaction ID:</strong> ${transactionId || "-"}</p>
        <p style="margin:0 0 6px;"><strong>Approved on:</strong> ${approvedAt || "-"}</p>
        <p style="margin:0;"><strong>Receipt No:</strong> ${invoiceNumber || "-"}</p>
      </div>
    `
    : "";

  return resend.emails.send({
    from: `ReachIQ <${fallbackFromAddress}>`,
    to,
    reply_to: supportContactEmail,
    subject,
    html: buildEmailShell(`
      <h2 style="margin:0 0 16px;">${heading}</h2>
      <p style="margin:0 0 16px;">Hi ${greetingName},</p>
      <p style="margin:0 0 16px;">${statusMessage}</p>
      ${receiptBlock}
      ${notesBlock}
      <p style="margin:16px 0 0;">
        ${approved
          ? "You can start using your upgraded ReachIQ quota right away."
          : "Please review the note above and resubmit your UPI payment details if needed."}
      </p>
    `)
  });
}

export async function sendPaymentSubmissionEmail({
  to,
  fullName,
  planLabel,
  amount,
  transactionId
}) {
  const resend = getResendClient();
  if (!resend || !to) return null;

  const safePlanLabel = planLabel || "ReachIQ plan";
  const greetingName = fullName || "there";

  return resend.emails.send({
    from: `ReachIQ <${fallbackFromAddress}>`,
    to,
    reply_to: supportContactEmail,
    subject: `ReachIQ: ${safePlanLabel} payment submitted`,
    html: buildEmailShell(`
      <h2 style="margin:0 0 16px;">Payment submitted</h2>
      <p style="margin:0 0 16px;">Hi ${greetingName},</p>
      <p style="margin:0 0 16px;">
        We received your UPI submission for ${safePlanLabel}. The ReachIQ team will review it and activate your plan after verification.
      </p>
      <div style="margin:20px 0 0;padding:16px;border:1px solid #2A2A3D;border-radius:16px;background:#0F0F17;">
        <p style="margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:0.14em;color:#9898B8;">Submission Details</p>
        <p style="margin:0 0 6px;"><strong>Plan:</strong> ${safePlanLabel}</p>
        <p style="margin:0 0 6px;"><strong>Amount:</strong> ${amount || "-"}</p>
        <p style="margin:0;"><strong>Transaction ID:</strong> ${transactionId || "-"}</p>
      </div>
      <p style="margin:16px 0 0;">If you need help, reply to this email or contact us at ${supportContactEmail}.</p>
    `)
  });
}

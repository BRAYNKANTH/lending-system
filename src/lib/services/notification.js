import fs from 'fs';
import path from 'path';
import { sendSms } from './sms.js';

const logFilePath = path.join(process.cwd(), 'notifications_log.txt');

/**
 * Dispatches a notification to a specific phone number/user via Text.lk SMS
 * (falls back to a console-only mock when TEXTLK_API_TOKEN isn't set — see
 * sms.js). Also logs to console and, in local dev only, appends to a text
 * file for quick inspection — Vercel's filesystem is read-only outside
 * /tmp, so file logging is skipped in production.
 */
export async function sendNotification({ recipientName, phone, message, role }) {
  const timestamp = new Date().toLocaleString();
  const logMessage = `[${timestamp}] TO: ${recipientName} (${phone}) [Role: ${role}]\nMSG: "${message}"\n---------------------------------------------\n`;

  console.log('\n======================================================');
  console.log(`🔔 NOTIFICATION DISPATCHED [Channel: SMS]`);
  console.log(`To: ${recipientName} (${phone})`);
  console.log(`Message: ${message}`);
  console.log('======================================================\n');

  if (process.env.NODE_ENV !== 'production') {
    try {
      fs.appendFileSync(logFilePath, logMessage);
    } catch (err) {
      console.error('Failed to write notification to log file:', err);
    }
  }

  const smsResult = await sendSms({ to: phone, message });

  return { success: smsResult.success, mocked: smsResult.mocked, timestamp };
}

/**
 * Sends a temporary password to a user who requested a self-service reset.
 */
export async function notifyPasswordReset({ user, tempPassword }) {
  await sendNotification({
    recipientName: user.name,
    phone: user.phone,
    message: `Password reset requested. Your temporary password is: ${tempPassword} (you will be asked to change it on login).`,
    role: user.role
  });
}

/**
 * Triggers alerts for loan creation
 */
export async function notifyLoanCreation({ borrower, principal, interestType, tempPassword }) {
  let borrowerMsg = `You received a loan of LKR ${Number(principal).toLocaleString()}. Interest type: ${interestType.toUpperCase()}.`;
  if (tempPassword) {
    borrowerMsg += ` Log in with your phone number ${borrower.phone} and temporary password: ${tempPassword} (you will be asked to change it on first login).`;
  }
  await sendNotification({
    recipientName: borrower.name,
    phone: borrower.phone,
    message: borrowerMsg,
    role: 'borrower'
  });
}

/**
 * Triggers alerts for collections. paymentType distinguishes an interest
 * payment (recurring, doesn't close the loan) from a principal payment
 * (reduces the fixed loan amount, closes the loan at zero).
 */
export async function notifyPaymentReceived({ borrower, admin, amount, paymentType, principalOutstanding, interestBalance }) {
  const formattedAmount = Number(amount).toLocaleString();
  const kind = paymentType === 'interest' ? 'interest' : 'principal';
  const remainingMsg = paymentType === 'interest'
    ? `Interest due: LKR ${Number(interestBalance).toLocaleString()}.`
    : `Principal remaining: LKR ${Number(principalOutstanding).toLocaleString()}.`;

  const borrowerMsg = `${kind === 'interest' ? 'Interest' : 'Principal'} payment of LKR ${formattedAmount} received. ${remainingMsg}`;

  await sendNotification({
    recipientName: borrower.name,
    phone: borrower.phone,
    message: borrowerMsg,
    role: 'borrower'
  });

  if (admin) {
    const adminMsg = `Collection recorded: LKR ${formattedAmount} (${kind}) from ${borrower.name}. ${remainingMsg}`;
    await sendNotification({
      recipientName: admin.name,
      phone: admin.phone,
      message: adminMsg,
      role: 'admin'
    });
  }
}

/**
 * Proactive daily reminder for an active loan's outstanding interest.
 */
export async function notifyPaymentReminder({ borrower, interestBalance, interestType }) {
  await sendNotification({
    recipientName: borrower.name,
    phone: borrower.phone,
    message: `Reminder: your ${interestType} interest payment of LKR ${Number(interestBalance).toLocaleString()} is due. Please arrange payment with your collection agent.`,
    role: 'borrower'
  });
}

/**
 * Alerts the admin (and optionally the borrower) when a day is marked
 * 'not_paid' on the daily collection tracker.
 */
export async function notifyMissedPayment({ borrower, admin, collectionDate }) {
  const dateStr = new Date(collectionDate).toLocaleDateString();

  if (admin) {
    await sendNotification({
      recipientName: admin.name,
      phone: admin.phone,
      message: `Missed collection: ${borrower.name} did not pay on ${dateStr}.`,
      role: 'admin'
    });
  }
}

/**
 * Alerts when a loan is marked as defaulted.
 */
export async function notifyLoanDefaulted({ borrower, admin, reason, principalOutstanding }) {
  const msg = `Your loan has been marked as defaulted. Outstanding principal: LKR ${Number(principalOutstanding).toLocaleString()}. Please contact us immediately.`;
  await sendNotification({ recipientName: borrower.name, phone: borrower.phone, message: msg, role: 'borrower' });

  if (admin) {
    await sendNotification({
      recipientName: admin.name,
      phone: admin.phone,
      message: `Loan for ${borrower.name} marked defaulted. Reason: ${reason}. Outstanding principal: LKR ${Number(principalOutstanding).toLocaleString()}.`,
      role: 'admin'
    });
  }
}

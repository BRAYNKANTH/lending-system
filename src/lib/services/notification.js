import fs from 'fs';
import path from 'path';

const logFilePath = path.join(process.cwd(), 'notifications_log.txt');

/**
 * Dispatches a notification to a specific phone number/user.
 * Logs to console (visible in Vercel function logs) and, in local dev only,
 * appends to a text file for quick inspection — Vercel's filesystem is
 * read-only outside /tmp, so file logging is skipped in production.
 */
export async function sendNotification({ recipientName, phone, message, role }) {
  const timestamp = new Date().toLocaleString();
  const logMessage = `[${timestamp}] TO: ${recipientName} (${phone}) [Role: ${role}]\nMSG: "${message}"\n---------------------------------------------\n`;

  console.log('\n======================================================');
  console.log(`🔔 NOTIFICATION DISPATCHED [Channel: SMS/WhatsApp]`);
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

  // Twilio/WhatsApp integration placeholder:
  /*
  try {
    // const client = new twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    // await client.messages.create({ body: message, to: phone, from: process.env.TWILIO_PHONE });
  } catch (apiError) {
    console.error("Failed to send real SMS:", apiError);
  }
  */

  return { success: true, timestamp };
}

/**
 * Triggers alerts for loan creation
 */
export async function notifyLoanCreation({ borrower, principal, interestType, tempPassword }) {
  let borrowerMsg = `You received a loan of LKR ${Number(principal).toLocaleString()}. Interest type: ${interestType.toUpperCase()}.`;
  if (tempPassword) {
    borrowerMsg += ` Your account login is ${borrower.phone}@lend.com with temporary password: ${tempPassword} (you will be asked to change it on first login).`;
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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logFilePath = path.join(__dirname, '..', '..', 'notifications_log.txt');

/**
 * Dispatches a notification to a specific phone number/user.
 * Logs to console and writes to a text file for immediate visual inspection in development.
 */
export async function sendNotification({ recipientName, phone, message, role }) {
  const timestamp = new Date().toLocaleString();
  const logMessage = `[${timestamp}] TO: ${recipientName} (${phone}) [Role: ${role}]\nMSG: "${message}"\n---------------------------------------------\n`;

  // 1. Output to console with styled headers
  console.log('\n======================================================');
  console.log(`🔔 NOTIFICATION DISPATCHED [Channel: SMS/WhatsApp]`);
  console.log(`To: ${recipientName} (${phone})`);
  console.log(`Message: ${message}`);
  console.log('======================================================\n');

  // 2. Append to a mock log file so developers can verify outputs without opening terminals
  try {
    fs.appendFileSync(logFilePath, logMessage);
  } catch (err) {
    console.error('Failed to write notification to log file:', err);
  }

  // 3. Twilio/WhatsApp integration placeholder:
  /*
  try {
    // Example Twilio integration:
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
 * Triggers alerts for collections
 */
export async function notifyPaymentReceived({ borrower, admin, amount, balance }) {
  const formattedAmount = Number(amount).toLocaleString();
  const formattedBalance = Number(balance).toLocaleString();
  
  const borrowerMsg = `Payment of LKR ${formattedAmount} received. Remaining balance: LKR ${formattedBalance}.`;
  
  // Alert Borrower
  await sendNotification({
    recipientName: borrower.name,
    phone: borrower.phone,
    message: borrowerMsg,
    role: 'borrower'
  });

  // Alert Admin
  if (admin) {
    const adminMsg = `Collection recorded: LKR ${formattedAmount} from ${borrower.name}. Outstanding balance: LKR ${formattedBalance}.`;
    await sendNotification({
      recipientName: admin.name,
      phone: admin.phone,
      message: adminMsg,
      role: 'admin'
    });
  }
}

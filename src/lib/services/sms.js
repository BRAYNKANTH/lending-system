import { toTextLkFormat } from '../phone.js';

const TEXTLK_ENDPOINT = 'https://app.text.lk/api/v3/sms/send';

/**
 * Sends a real SMS via Text.lk when TEXTLK_API_TOKEN is configured.
 * Falls back to a console-only mock (no external call) when it isn't, so
 * local development and environments without a Text.lk account keep working
 * exactly as before. Never throws — a failed SMS should never break the
 * loan/payment flow that triggered it; callers just get a status back.
 */
export async function sendSms({ to, message }) {
  const recipient = toTextLkFormat(to);
  if (!recipient) {
    console.warn(`SMS not sent — invalid recipient phone: "${to}"`);
    return { success: false, mocked: false, reason: 'invalid_recipient' };
  }

  const apiToken = process.env.TEXTLK_API_TOKEN;
  const senderId = process.env.TEXTLK_SENDER_ID;

  if (!apiToken || !senderId) {
    console.log(`[SMS MOCK — Text.lk not configured] To: ${recipient} | Message: ${message}`);
    return { success: true, mocked: true };
  }

  try {
    const response = await fetch(TEXTLK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        recipient,
        sender_id: senderId,
        type: 'plain',
        message
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.status !== 'success') {
      console.error('Text.lk SMS send failed:', response.status, data);
      return { success: false, mocked: false, error: data?.message || `HTTP ${response.status}` };
    }

    console.log(`SMS sent via Text.lk to ${recipient} (uid: ${data.data?.uid || 'n/a'})`);
    return { success: true, mocked: false, data: data.data };
  } catch (err) {
    console.error('Text.lk SMS send error:', err);
    return { success: false, mocked: false, error: err.message };
  }
}

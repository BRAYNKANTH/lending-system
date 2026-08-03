import crypto from 'crypto';

// Generates a random human-typeable temporary password (e.g. "K7F2-93QZ")
export function generateTempPassword() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
}

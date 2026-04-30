import crypto from 'crypto';

const PREFIX = 'enc:v1';

function getKey(): Buffer {
  const secret = process.env.MESSAGE_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('MESSAGE_SECRET ou JWT_SECRET precisa estar configurado');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptMessage(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decryptMessage(value: string): string {
  if (!value.startsWith(`${PREFIX}:`)) {
    return value;
  }

  const [, , ivB64, tagB64, dataB64] = value.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

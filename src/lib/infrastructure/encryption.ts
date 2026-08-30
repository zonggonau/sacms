import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits recommended for GCM

function getMasterKey(): Buffer {
  const secret = process.env.INFRA_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error(
      '[SECURITY] Neither INFRA_ENCRYPTION_KEY nor NEXTAUTH_SECRET is set. ' +
      'Cannot encrypt/decrypt infrastructure credentials. ' +
      'Set one of these environment variables before starting the server.'
    )
  }
  // Derive a deployment-specific salt from the secret itself (first 16 chars of its SHA-256)
  // This ensures different deployments with different secrets produce different master keys
  const salt = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 16)
  return crypto.scryptSync(secret, salt, 32)
}


/**
 * Encrypt a plain text string using AES-256-GCM
 */
export function encryptCredential(plainText: string): string {
  if (!plainText) return ''
  const key = getMasterKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted (in hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt an AES-256-GCM encrypted string
 */
export function decryptCredential(cipherPayload: string): string {
  if (!cipherPayload) return ''
  const parts = cipherPayload.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format')
  }

  const [ivHex, authTagHex, encryptedHex] = parts
  const key = getMasterKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}

/**
 * Helper to generate high-entropy random passwords for PostgreSQL and MinIO
 */
export function generateSecurePassword(length = 24): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const randomBytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += charset[randomBytes[i] % charset.length]
  }
  return result
}

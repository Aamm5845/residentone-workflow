import crypto from 'crypto'

// Use environment variable for encryption key, with a fallback for development
// In production, ENCRYPTION_KEY should be a 32-byte (64 hex character) key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production!'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Derive a 32-byte key from the encryption key
 * This ensures we always have a valid key length for AES-256
 */
function getKey(): Buffer {
  // If the key is already 64 hex chars (32 bytes), use it directly
  if (/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    return Buffer.from(ENCRYPTION_KEY, 'hex')
  }
  // Otherwise, derive a 32-byte key using SHA-256
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * Returns a base64 encoded string containing IV + auth tag + ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return ''

  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Combine IV + auth tag + ciphertext and encode as base64
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'hex')
  ])

  return combined.toString('base64')
}

/**
 * Decrypt data that was encrypted with the encrypt function
 * Expects a base64 encoded string containing IV + auth tag + ciphertext
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return ''

  try {
    const key = getKey()
    const combined = Buffer.from(encryptedData, 'base64')

    // Extract IV, auth tag, and ciphertext
    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext.toString('hex'), 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    return ''
  }
}

/**
 * Mask a card number, showing only the last 4 digits
 * Example: "4111111111111111" -> "****-****-****-1111"
 */
export function maskCardNumber(cardNumber: string): string {
  if (!cardNumber || cardNumber.length < 4) return '****-****-****-****'
  const lastFour = cardNumber.slice(-4)
  return `****-****-****-${lastFour}`
}

/**
 * Get the last 4 digits of a card number
 */
export function getLastFour(cardNumber: string): string {
  if (!cardNumber || cardNumber.length < 4) return ''
  return cardNumber.slice(-4)
}

/**
 * Detect card brand from card number
 */
export function detectCardBrand(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\D/g, '')

  // Visa: starts with 4
  if (/^4/.test(cleanNumber)) return 'VISA'

  // Mastercard: starts with 51-55 or 2221-2720
  if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) return 'MASTERCARD'

  // American Express: starts with 34 or 37
  if (/^3[47]/.test(cleanNumber)) return 'AMEX'

  // Discover: starts with 6011, 622126-622925, 644-649, 65
  if (/^6(?:011|5|4[4-9]|22)/.test(cleanNumber)) return 'DISCOVER'

  return 'UNKNOWN'
}

/**
 * Format card expiry for display
 */
export function formatExpiry(month: number, year: number): string {
  const m = month.toString().padStart(2, '0')
  const y = year.toString().slice(-2)
  return `${m}/${y}`
}

/**
 * Validate card number using Luhn algorithm
 */
export function validateCardNumber(cardNumber: string): boolean {
  const cleanNumber = cardNumber.replace(/\D/g, '')

  if (cleanNumber.length < 13 || cleanNumber.length > 19) {
    return false
  }

  let sum = 0
  let isEven = false

  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i], 10)

    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }

    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}

/**
 * Validate CVV
 */
export function validateCvv(cvv: string, cardBrand: string): boolean {
  const cleanCvv = cvv.replace(/\D/g, '')

  // AMEX has 4-digit CVV, others have 3
  if (cardBrand === 'AMEX') {
    return cleanCvv.length === 4
  }

  return cleanCvv.length === 3
}

/**
 * Validate expiry date
 */
export function validateExpiry(month: number, year: number): boolean {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Year should be 2 or 4 digits
  const fullYear = year < 100 ? 2000 + year : year

  if (fullYear < currentYear) return false
  if (fullYear === currentYear && month < currentMonth) return false
  if (month < 1 || month > 12) return false

  return true
}

const crypto = require('crypto');

// Environment variables should be set in your .env file
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key-here'; // Must be 32 bytes for AES-256
const IV_LENGTH = 16; // For AES, this is always 16 bytes

/**
 * Encrypts a buffer using AES-256-CBC
 * @param {Buffer} buffer - The buffer to encrypt
 * @returns {Buffer} - The encrypted buffer with IV prepended
 */
const encryptBuffer = (buffer) => {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        throw new Error('Invalid buffer provided for encryption');
    }

    // Create an initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);

    // Encrypt the buffer
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

    // Return iv + encrypted data
    return Buffer.concat([iv, encrypted]);
};

/**
 * Decrypts a buffer using AES-256-CBC
 * @param {Buffer} encryptedBuffer - The encrypted buffer with IV prepended
 * @returns {Buffer} - The decrypted buffer
 */
const decryptBuffer = (encryptedBuffer) => {
    if (!encryptedBuffer || !Buffer.isBuffer(encryptedBuffer)) {
        throw new Error('Invalid buffer provided for decryption');
    }

    // Extract the IV from the beginning of the buffer
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const encryptedData = encryptedBuffer.slice(IV_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);

    // Decrypt the data
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

    return decrypted;
};

module.exports = {
    encryptBuffer,
    decryptBuffer
};

const { Vonage } = require('@vonage/server-sdk');
const crypto = require('crypto');
const db = require('../config/database');
const { generateVerificationCode } = require('../func');

// Initialize Vonage with your API credentials
const vonage = new Vonage({
    apiKey: process.env.VONAGE_API_KEY,
    apiSecret: process.env.VONAGE_API_SECRET
});


// Send SMS using Vonage
const sendSMS = (to, text) => {
    return new Promise((resolve, reject) => {
        vonage.sms.send(
            process.env.VONAGE_BRAND_NAME, // From
            to, // To
            text, // Message text
            {
                type: 'unicode'
            },
            (err, responseData) => {
                if (err) {
                    console.error('Error sending SMS:', err);
                    return reject(err);
                }

                // Check if message was sent successfully
                if (responseData.messages[0].status === '0') {
                    console.log('Message sent successfully');
                    resolve(responseData.messages[0]['message-id']);
                } else {
                    console.error(`Message failed with error: ${responseData.messages[0]['error-text']}`);
                    reject(new Error(responseData.messages[0]['error-text']));
                }
            }
        );
    });
};

// Send OTP verification code to user's phone
const sendOTPCode = async (phoneNumber, language = 'FR') => {
    const client = await db.pool.connect();
    try {
        // Generate OTP code
        const otpCode = generateVerificationCode();

        // Generate a reference ID for this OTP
        const referenceID = crypto.randomBytes(20).toString('hex');

        // Store OTP code with expiration (10 minutes from now) in database
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        await client.query(
            `INSERT INTO otp_codes (
                reference_id, phone_number, code, created_at, expires_at, attempts, verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                referenceID,
                phoneNumber,
                otpCode,
                new Date(), // created_at
                expiresAt,
                0, // initial attempts
                'pending' // initial verified status
            ]
        );

        // Prepare message text based on language
        const message = language === 'FR'
            ? `Votre code de vérification AdCity est: ${otpCode}. Il expire dans 10 minutes.`
            : `Your AdCity verification code is: ${otpCode}. It expires in 10 minutes.`;

        // Here you would send the SMS using your SMS provider
        // await sendSMS(phoneNumber, message);

        // Log the verification attempt
        await client.query(
            `INSERT INTO otp_logs (
                phone_number, reference_id, action, timestamp, status
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
                phoneNumber,
                referenceID,
                'send',
                new Date(),
                'success'
            ]
        );

        return referenceID;
    } catch (error) {
        console.error('Error sending OTP:', error);

        // Log the failed attempt if possible
        try {
            await client.query(
                `INSERT INTO otp_logs (
                    phone_number, action, timestamp, status, error
                ) VALUES ($1, $2, $3, $4, $5)`,
                [
                    phoneNumber,
                    'send',
                    new Date(),
                    'failed',
                    error.message
                ]
            );
        } catch (logError) {
            console.error('Error logging OTP failure:', logError);
        }

        throw error;
    } finally {
        // Always release the client back to the pool
        client.release();
    }
};


module.exports = { sendSMS };
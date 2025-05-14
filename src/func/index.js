const multer = require('multer');
const { UAParser } = require('ua-parser-js');
const { format, isToday, isYesterday } = require('date-fns');
const { fr } = require('date-fns/locale');
const crypto = require('crypto');
const { admin, firestore, auth } = require('../config/firebase-admin');
const nodemailer = require('nodemailer');





const generateVerificationToken = () => {
    // Generate a 32-byte random token
    const token = crypto.randomBytes(32).toString('hex');

    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36);

    return `${token}${timestamp}`;
};


// Generate a random ticket
const generateTicketID = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const millis = String(now.getMilliseconds()).padStart(3, '0');

    return `${year}${month}${date}${hours}${minutes}${seconds}${millis}`;
}

// Fonction pour générer un numéro de profil unique (exemple simple)
const getUserProfileNumber = () => {
    return 'USER - ' + Math.floor(Math.random() * 1000000); // Numéro aléatoire à 6 chiffres
};

// Fonction pour générer un code de vérification
const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000); // Génère un code à 6 chiffres
};

const monthNames = [
    "January", "February", "March", "April",
    "May", "June", "July", "August",
    "September", "October", "November", "December"
];

const formateDate = (newDate) => {
    const date = new Date(newDate);

    if (isToday(date)) {
        return `Aujourd'hui à ${format(date, 'HH:mm', { locale: fr })}`;
    }

    if (isYesterday(date)) {
        return `Hier à ${format(date, 'HH:mm', { locale: fr })}`;
    }

    return format(date, "d MMMM yyyy 'à' HH:mm", { locale: fr });
}

const formateDateTimestamp = (adTimestamp) => {
    const adDate = new Date(adTimestamp * 1000); // Convertir le timestamp en millisecondes
    const now = new Date();

    const diffTime = now - adDate; // Différence en millisecondes
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Convertir en jours

    const options = { hour: '2-digit', minute: '2-digit' }; // Format de l'heure

    if (diffDays === 0) {
        // Aujourd'hui
        return `Aujourd'hui à ${adDate.toLocaleTimeString('fr-FR', options)}`;
    } else if (diffDays === 1) {
        // Hier
        return `Hier à ${adDate.toLocaleTimeString('fr-FR', options)}`;
    } else if (diffDays === 2) {
        // Avant-hier
        return `Avant-hier à ${adDate.toLocaleTimeString('fr-FR', options)}`;
    } else {
        // Date plus ancienne
        return adDate.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
            ` à ${adDate.toLocaleTimeString('fr-FR', options)}`;
    }
};

const trackFirstLoginDevice = async (userID, deviceInfo) => {
    const userDeviceRef = admin.firestore().doc(`USERS/${userID}/DEVICES/INITIAL`);

    await userDeviceRef.set({
        firstLoginDate: admin.firestore.FieldValue.serverTimestamp(),
        device: {
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            ipAddress: deviceInfo.ipAddress,
            location: deviceInfo.location,
            deviceType: deviceInfo.deviceType
        },
        isActive: true
    });

    return true;
};

const trackUserDevice = async () => {
    const parser = new UAParser();
    const result = parser.getResult();

    const deviceInfo = {
        browser: `${result.browser.name} ${result.browser.version}`,
        os: `${result.os.name} ${result.os.version}`,
        device: result.device.type || 'desktop',
        timestamp: Date.now(),
        ipAddress: await fetchIPAddress()
    };

    return deviceInfo;
};

const fetchIPAddress = async () => {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
};

const storage = multer.memoryStorage();
const limits = { fileSize: 30 * 1024 * 1024 }; // 30MB
const upload = multer({
    storage: storage,
    limits: limits,
});

const uploadVerif = multer({
    storage: storage,
    limits: {
        fileSize: 30 * 1024 * 1024, // 30MB limit
    },
    fileFilter: (req, file, cb) => {
        // Define allowed file types
        const allowedDocumentTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        const allowedSelfieTypes = ['image/jpeg', 'image/png', 'image/jpg'];

        if (file.fieldname === 'document') {
            if (allowedDocumentTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Format de document non autorisé. Seuls les fichiers PDF, JPG, JPEG ou PNG sont acceptés.'), false);
            }
        } else if (file.fieldname === 'selfie') {
            if (allowedSelfieTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Format de selfie non autorisé. Seuls les fichiers JPG, JPEG ou PNG sont acceptés.'), false);
            }
        } else {
            cb(new Error('Type de fichier non pris en charge.'), false);
        }
    }
});


const isDeviceKnown = (deviceInfo, existingDevices) => {
    return existingDevices.some(device =>
        device.browser.name === deviceInfo.browser.name &&
        device.browser.version === deviceInfo.browser.version &&
        device.os.name === deviceInfo.os.name &&
        device.os.version === deviceInfo.os.version &&
        device.ipAddress === deviceInfo.ipAddress
    );
};

const handleDeviceVerification = async (userID, deviceInfo) => {
    const devicesSnapshot = await firestore
        .collection('USERS')
        .doc(userID)
        .collection('DEVICES')
        .get();

    const existingDevices = devicesSnapshot.docs.map(doc => doc.data());

    if (isDeviceKnown(deviceInfo, existingDevices)) {
        return { isKnown: true };
    }

    // Si l'appareil est inconnu, envoyez une alerte et enregistrez-le
    const newDeviceRef = await firestore
        .collection('USERS')
        .doc(userID)
        .collection('DEVICES')
        .add({
            ...deviceInfo,
            lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        });

    return {
        isKnown: false,
        deviceID: newDeviceRef.id,
        reason: "Un nouvel appareil a été détecté."
    };
};

const createNodemailerTransport = () => {
    const nodemailerTransport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        logger: true,
        debug: true,
        auth: {
            user: process.env.SMTP_MAIL,
            pass: process.env.SMTP_PASS,
        },
    });
    return nodemailerTransport;
};

const generateSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Retire les caractères spéciaux
        .replace(/\s+/g, '-')     // Remplace les espaces par des tirets
        .replace(/--+/g, '-')     // Évite les doubles tirets
        .trim();
};

const checkIfPhoneNumberExists = async (phoneNumber) => {
    const querySnapshot = await firestore.collection('USERS').where('phoneNumber', '==', phoneNumber).limit(1).get();
    return !querySnapshot.empty;
};

const checkIfEmailExists = async (email) => {
    const querySnapshot = await firestore.collection('USERS').where('email', '==', email).limit(1).get();
    return !querySnapshot.empty;
};

const formatRelativeDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();

    const diffTime = today - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays === 2) return "Avant-hier";

    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' }); // Ex: "13 mars"
};


module.exports = {
    formatRelativeDate,
    createNodemailerTransport,
    formateDateTimestamp,
    generateVerificationCode,
    generateVerificationToken,
    checkIfPhoneNumberExists,
    monthNames,
    getUserProfileNumber,
    upload,
    uploadVerif,
    formateDate,
    generateTicketID,
    trackUserDevice,
    trackFirstLoginDevice,
    handleDeviceVerification,
    generateSlug,
    checkIfEmailExists
};
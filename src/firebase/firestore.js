const { sendDeviceVerificationEmail } = require('../controllers/emailController');
const { admin, firestore, auth } = require('../config/firebase-admin');

const sendUserNotification = async (userID, notification) => {
    try {
        if (notification) {
            await firestore.collection('NOTIFICATIONS').add({
                userID: userID,
                title: notification.title,
                message: notification.message,
                time: admin.firestore.FieldValue.serverTimestamp(),
                isRead: false,
            });

            console.log('Une notification a été envoyée pour: ', notification.title);
        } else {
            throw new Error('Erreur d\'envoi de la notification');
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la notification:', error);
    }
};


const paymentProcessing = async (paymentData, userID) => {
    try {

    } catch (error) {

    }
}


const markNotificationAsRead = async (notificationID) => {
    try {
        const notificationRef = firestore.collection('NOTIFICATIONS').doc(notificationID);
        await notificationRef.update({ read: true });
        console.log('Notification marquée comme lue.');
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la notification:', error);
        throw new Error('Erreur lors de la mise à jour de la notification.');
    }
};

// Fonction pour obtenir les données de l'utilisateur par son ID
const getUserDataByID = async (userID) => {
    try {
        const userSnapshot = await firestore.collection('USERS').doc(userID).get();

        if (!userSnapshot.exists) {
            throw Error('Utilisateur non trouvé');
        }

        const userData = userSnapshot.data();

        return userData;
    } catch (error) {
        console.error('Erreur lors de la récupération des données utilisateur:', error);
        throw Error('Erreur lors de la récupération des données utilisateur');
    }
};




// Fonction pour récupérer l'URL de profil
const getUserProfileURL = async (userID) => {
    try {
        const userRef = admin.firestore().collection('USERS').doc(userID);

        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            throw new Error('Utilisateur non trouvé');
        }

        const userData = userDoc.data();
        const { profilURL } = userData;

        return profilURL;
    } catch (error) {
        console.error('Erreur lors de la collecte de l\'URL de profil:', error);
        throw new Error('Échec de la collecte du profil');
    }
}

// Fonction pour mettre à jour l'URL de couverture
const updateUserCoverURL = async (userID, file) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);

        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            throw new Error('Utilisateur non trouvé');
        }

        await userRef.update({ coverURL: file });

        console.log('URL de profil mise à jour avec succès');
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'URL de profil:', error);
        throw new Error('Échec de la mise à jour du profil');
    }
};


const verifyUserDevice = async (userID, deviceInfo) => {
    try {
        const deviceRef = firestore.collection('USERS').doc(userID).collection('DEVICES');
        const devicesSnapshot = await deviceRef.get();

        // First-time login case
        if (devicesSnapshot.empty) {
            const newDevice = await deviceRef.add({
                ...deviceInfo,
                lastUsed: admin.firestore.FieldValue.serverTimestamp(),
                status: 'verified'
            });

            return {
                verified: true,
                deviceId: newDevice.id,
                message: 'Premier périphérique vérifié'
            };
        }

        // Check against existing devices
        let isKnownDevice = false;
        devicesSnapshot.forEach(doc => {
            const device = doc.data();
            if (
                device.browser === deviceInfo.browser &&
                device.os === deviceInfo.os &&
                device.ipAddress === deviceInfo.ipAddress
            ) {
                isKnownDevice = true;
                deviceRef.doc(doc.id).update({
                    lastUsed: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        // New device detected - requires verification
        if (!isKnownDevice) {
            // Disable user account
            await auth.updateUser(userID, {
                disabled: true
            });
            const userRef = admin.firestore().collection('USERS').doc(userID);
            const userDoc = await userRef.get();
            const { email, displayName } = userDoc.data();

            const newDeviceRef = await deviceRef.add({
                ...deviceInfo,
                lastUsed: admin.firestore.FieldValue.serverTimestamp(),
                status: 'pending_verification'
            });

            await sendDeviceVerificationEmail(email, displayName, deviceInfo, newDeviceRef.id);

            return {
                verified: false,
                requiresVerification: true,
                deviceId: newDeviceRef.id,
                accountStatus: 'disabled'
            };
        }

        return {
            verified: true,
            deviceId: deviceRef.id
        };
    } catch (error) {
        console.error('Device verification error:', error);
        throw error;
    }
};


const saveLocation = async (country, city) => {
    const locationRef = firestore.collection('LOCATIONS');
    const countryDoc = locationRef.doc(country);

    const doc = await countryDoc.get();
    
    if (!doc.exists) {
        await countryDoc.set({
            cities: [city]
        });
    } else {
        if (!doc.data().cities.includes(city)) {
            await countryDoc.update({
                cities: admin.firestore.FieldValue.arrayUnion(city)
            });
        }
    }
};


const getUserDevices = async (userID) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID).collection('DEVICES');
        const devicesSnapshot = await userRef.get();
        const devices = [];
        devicesSnapshot.forEach(doc => {
            devices.push(doc.data());
        });
        const response = {
            success: true,
            message: 'Informations récupérées avec succès',
            devices: devices
        }
        return response;
    } catch (error) {
        const response = {
            success: false,
            message: 'Erreur lors de la collecte des informations',
        }
        return  response;
    }
}



module.exports = {
    getUserDataByID,
    getUserProfileURL,
    markNotificationAsRead,
    sendUserNotification,
    getUserDevices,
    updateUserCoverURL,
    verifyUserDevice,
    paymentProcessing,
    saveLocation,
};
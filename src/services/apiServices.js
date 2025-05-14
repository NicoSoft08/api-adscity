const { firestore, admin } = require("../config/firebase-admin");


const trackUserDevice = async (userID, newDeviceInfo) => {
    const userDevicesRef = firestore.collection('USERS').doc(userID).collection('DEVICES');
    
    // 🔹 Filtrer directement dans Firestore pour éviter un `forEach`
    const querySnapshot = await userDevicesRef
        .where("browser", "==", newDeviceInfo.browser)
        .where("os", "==", newDeviceInfo.os)
        .where("device", "==", newDeviceInfo.device)
        .where("model", "==", newDeviceInfo.model)
        .where("ip", "==", newDeviceInfo.ip)
        .get();

    if (!querySnapshot.empty) {
        const deviceDoc = querySnapshot.docs[0]; // Récupérer le premier appareil trouvé
        const deviceData = deviceDoc.data();
        
        if (deviceData.verified) {
            return { isNewDevice: false, requiresVerification: false };
        }
        
        return { isNewDevice: true, requiresVerification: true, deviceID: deviceDoc.id };
    }

    // 🔹 Ajouter l'appareil s'il est totalement nouveau
    const newDeviceRef = await userDevicesRef.add({
        ...newDeviceInfo,
        verified: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { isNewDevice: true, requiresVerification: true, deviceID: newDeviceRef.id };
};



module.exports = { trackUserDevice };
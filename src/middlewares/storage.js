const { storage } = require('../config/firebase-admin');

const uploadFileToStorage = async (file) => {
    try {
        const bucket = storage.bucket(process.env.FIRBASE_STORAGE_BUCKET);
        const fileName = `profile-images/${Date.now()}_${file.originalname}`;

        const fileUpload = bucket.file(fileName);

        await fileUpload.save(file.buffer)
    } catch (error) {
        
    }
};


const updateUserProfileURL = async (userID, profileURL) => {};


module.exports = { 
    uploadFileToStorage,
    updateUserProfileURL,
};
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccount");


// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),    
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
    storageBucket: `${serviceAccount.project_id}.appspot.com`
});

const auth = admin.auth();
const firestore = admin.firestore();
const storage = admin.storage();
const messaging = admin.messaging();

// Configure Firestore to ignore undefined properties
firestore.settings({ ignoreUndefinedProperties: true });


// Export the Firebase Admin SDK objects
module.exports = {
    admin,
    auth,
    firestore,
    messaging,
    storage
};
const { PLAN_CONFIGS } = require("../config/constant");
const { firestore, admin } = require("../config/firebase-admin");

const collectAllPaymentsWithStatus = async () => {
    try {
        const paymentsSnapshot = await firestore.collection('PAYMENTS').get();
        const allPayments = [];
        const processingPayments = [];
        const completedPayments = [];
        const expiredPayments = [];

        paymentsSnapshot.forEach(doc => {
            const payments = { id: doc.id, ...doc.data() };
            allPayments.push(payments);

            if (payments.status === 'processing') {
                processingPayments.push(payments);
            } else if (payments.status === 'completed') {
                completedPayments.push(payments);
            } else if (payments.status === 'expired') {
                expiredPayments.push(payments);
            }
        });

        return { allPayments, processingPayments, completedPayments, expiredPayments };
    } catch (error) {
        console.error('Erreur lors de la récupération des paiements avec statut :', error);
        throw error;
    }
};

const collectPaymentProcess = async (userID, paymentData) => {
    try {
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.log('Utilisateur non trouvé');
            return false;
        };

        const expiryDate = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + (15 * 60 * 1000)) // 15 minutes en millisecondes
        );
        const { displayName, email, profileNumber } = userDoc.data();
        const paymentCollection = firestore.collection('PAYMENTS');
        await paymentCollection.add({
            ...paymentData,
            displayName,
            email,
            profileNumber,
            userID,
            status: "processing", // "processing", "paid", "failed", "expired"
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expireAt: expiryDate,
            paymentIntentId: paymentCollection.id,
        });
        return true;
    } catch (error) {
        console.error('Erreur lors du traitement du paiement :', error);
        return false;
    };
};

const collectPaymentByUserID = async (userID) => {
    try {
        const paymentRef = firestore.collection('PAYMENTS');
        const paymentQuery = paymentRef.where('userID', '==', userID);
        const paymentDoc = await paymentQuery.get();
        if (paymentDoc.empty) {
            return false;
        };

        const paymentData = paymentDoc.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return paymentData;
    } catch (error) {
        console.error('Erreur lors du traitement du paiement :', error);
        return false;
    };
};

const collectPayments = async () => {
    try {
        const paymentRef = firestore.collection('PAYMENTS');
        const paymentDoc = await paymentRef.get();
        if (paymentDoc.empty) {
            return false;
        };
        const paymentData = paymentDoc.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return paymentData;
    } catch (error) {
        console.error('Erreur lors du traitement du paiement :', error);
        return false;
    };
};

const upgradePaymentStatus = async (paymentID, status) => {
    if (!['processing', 'completed', 'failed'].includes(status)) {
        console.log('Statut de paiement invalide');
        return false;
    };

    try {
        const paymentRef = firestore.collection('PAYMENTS').doc(paymentID);
        const paymentDoc = await paymentRef.get();
        if (!paymentDoc.exists) {
            return false;
        };

        const { plan, userID } = paymentDoc.data();

        await paymentRef.update({
            status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (status === 'completed') {
            const userRef = firestore.collection('USERS').doc(userID);
            const planConfig = PLAN_CONFIGS[plan] || {};
            const startDate = admin.firestore.FieldValue.serverTimestamp();
            const endDate = admin.firestore.Timestamp.fromDate(
                new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
            );

            await userRef.update({
                plans: {
                    [plan]: planConfig,
                    subscriptionDate: startDate,
                    expiryDate: endDate,
                }
            });
        };
        return true;
    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut de paiement :', error);
        return false;
    };
};

const collectProcessingPayments = async () => {
    try {
        const paymentRef = firestore.collection('PAYMENTS');
        const paymentQuery = paymentRef.where('status', '==', 'processing');
        const paymentDoc = await paymentQuery.get();
        if (paymentDoc.empty) {
            return [];
        };
        const processingPayments = paymentDoc.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return processingPayments;
    } catch (error) {
        console.error('Erreur lors de la récupération des paiements en cours :', error);
        return false;
    };
};

const collectCompletedPayments = async () => {
    try {
        const paymentRef = firestore.collection('PAYMENTS');
        const paymentQuery = paymentRef.where('status', '==', 'completed');
        const paymentDoc = await paymentQuery.get();
        if (paymentDoc.empty) {
            return false;
        };
        const completedPayments = paymentDoc.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return completedPayments;
    } catch (error) {
        console.error('Erreur lors de la récupération des paiements terminés :', error);
        return false;
    };
};

const collectFailedPayments = async () => {
    try {
        const paymentRef = firestore.collection('PAYMENTS');
        const paymentQuery = paymentRef.where('status', '==', 'failed');
        const paymentDoc = await paymentQuery.get();
        if (paymentDoc.empty) {
            return false;
        };
        const failedPayments = paymentDoc.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return failedPayments;
    } catch (error) {
        console.error('Erreur lors de la récupération des paiements échoués :', error);
        return false;
    };
};

const fetchPaymentAccounts = async (selectedMethod, selectedProvider) => {
    try {
        const accountsRef = firestore.collection('PAYMENT_ACCOUNTS');
        const snapshot = await accountsRef
            .where('paymentMethod', '==', selectedMethod)
            .where('provider', '==', selectedProvider)
            .orderBy('priority', 'desc')
            .get();

        if (snapshot.empty) {
            console.log('Aucun compte trouvé pour cette méthode et ce fournisseur');
            return [];
        }

        const accounts = [];
        snapshot.forEach(doc => {
            accounts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        console.log('Comptes de paiement récupérés avec succès');
        return accounts;
    } catch (error) {
        console.error('Erreur lors de la récupération des comptes de paiement :', error);
        return [];
    }
}

const createNewPaymentAccount = async (paymentMethod, provider, accountNumber, ownerName, priority, isActive) => {
    try {
        // Check if account already exists
        const accountsRef = firestore.collection('PAYMENT_ACCOUNTS');
        const existingAccount = await accountsRef
            .where('paymentMethod', '==', paymentMethod)
            .where('provider', '==', provider)
            .where('accountNumber', '==', accountNumber)
            .get();

        if (!existingAccount.empty) {
            console.log('Compte de paiement déjà existant');
            return false;
        }

        // Create new account document
        const newAccountRef = accountsRef.doc();
        const accountData = {
            accountID: newAccountRef.id,
            paymentMethod,
            provider,
            accountNumber,
            ownerName,
            priority: priority || 1,
            isActive: isActive !== undefined ? isActive : true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await newAccountRef.set(accountData);
        console.log('Compte de paiement créé avec succès');
        return true;
    } catch (error) {
        console.error('Erreur lors de la création du compte de paiement :', error);
        return false;
    }
};

const deletePaymentAccountByID = async (accountID) => {
    try {
        const accountRef = firestore.collection('PAYMENT_ACCOUNTS').doc(accountID);
        const accountDoc = await accountRef.get();
        if (!accountDoc.exists) {
            console.log('Compte de paiement non trouvé');
            return false;
        }
        await accountRef.delete();
        console.log('Compte de paiement supprimé avec succès');
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression du compte de paiement :', error);
        return false;
    }
}

const togglePaymentAccountStatusByID = async (accountID, isActive) => { 
    try {
        const  accountRef = firestore.collection('PAYMENT_ACCOUNTS').doc(accountID);
        const accountDoc = await accountRef.get();
        if (!accountDoc.exists) {
            console.log('Compte de paiement non trouvé');
            return false;
        }
        
        await accountRef.update({
            isActive: isActive,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erreur lors de la modification du statut du compte de paiement :', error);
        return false;
    }
}

const createPayment = async (userID, paymentData) => {
    try {
        // Verify user exists
        const userRef = firestore.collection('USERS').doc(userID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.log('Utilisateur non trouvé');
            return false;
        }

        const userData = userDoc.data();

        // Create a new subscription record
        const subscriptionRef = firestore.collection('SUBSCRIPTIONS').doc();
        const subscriptionID = subscriptionRef.id;

        const now = new Date();
        const startDate = new Date(paymentData.startDate);
        const endDate = new Date(paymentData.endDate);

        // Create subscription object
        const subscriptionData = {
            subscriptionID,
            userID,
            planID: paymentData.planID,
            planName: paymentData.planName,
            price: paymentData.price,
            currency: paymentData.currency,
            features: paymentData.features || [],
            limits: paymentData.limits || {},
            startDate,
            expiryDate: endDate,
            status: paymentData.status || 'active',
            paymentDate: now,
            createdAt: now,
            updatedAt: now
        };

        // Save subscription to database
        await subscriptionRef.set(subscriptionData);

        // Update user's plans data structure based on the existing format
        // This matches the structure seen in the user collection
        const planType = paymentData.planType || 'individual'; // Default to individual if not specified

        const planUpdateData = {
            [`plans.${planType}.isActive`]: true,
            [`plans.${planType}.subscriptionDate`]: now,
            [`plans.${planType}.expiryDate`]: endDate,
            [`plans.${planType}.type`]: planType,
            currentPlan: paymentData.planID,
            subscriptionID,
            updatedAt: now
        };

        // Add plan-specific limits
        if (paymentData.limits) {
            planUpdateData[`plans.${planType}.max_ads`] = paymentData.limits.adsPerMonth || 20;
            planUpdateData[`plans.${planType}.max_photos`] = paymentData.limits.photosPerAd || 10;

            // Also update the adLimits for backward compatibility
            planUpdateData.adLimits = {
                adsPerMonth: paymentData.limits.adsPerMonth || 20,
                photosPerAd: paymentData.limits.photosPerAd || 10,
                adValidity: paymentData.limits.adValidity || 30
            };
        }

        await userRef.update(planUpdateData);

        // Create payment record
        const paymentRef = firestore.collection('PAYMENTS').doc();
        await paymentRef.set({
            paymentID: paymentRef.id,
            userId: userID,
            subscriptionID,
            amount: paymentData.price,
            currency: paymentData.currency,
            status: 'pending',
            type: 'subscription',
            planID: paymentData.planID,
            planName: paymentData.planName,
            planType: planType,
            paymentDate: now,
            createdAt: now
        });

        console.log('Paiement créé avec succès');
        return true;
    } catch (error) {
        console.error('Erreur lors de la création du paiement :', error);
        return false;
    }
};


module.exports = {
    createNewPaymentAccount,
    deletePaymentAccountByID,
    togglePaymentAccountStatusByID,
    fetchPaymentAccounts,
    collectAllPaymentsWithStatus,
    collectCompletedPayments,
    collectFailedPayments,
    collectPaymentByUserID,
    collectPaymentProcess,
    collectPayments,
    collectProcessingPayments,
    createPayment,
    upgradePaymentStatus,
};
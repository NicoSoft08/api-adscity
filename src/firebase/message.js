const { firestore, admin } = require("../config/firebase-admin");

const collectUserMessage = async (userID) => {
    try {
        // Récupérer les messages où l'utilisateur est soit l'expéditeur, soit le destinataire
        const conversationsRef = firestore.collection('CONVERSATIONS')
            .where('participants', 'array-contains', userID)
            .orderBy('updatedAt', 'desc');

        let totalUnreadCount = 0;

        const conversationsSnap = await conversationsRef.get();

        if (conversationsSnap.empty) {
            console.log("⚠️ Aucune conversation trouvée pour cet utilisateur.");
            return [];
        };

        // Calculer le nombre total de messages non lus
        conversationsSnap.forEach(doc => {
            const conversationData = doc.data();
            const unreadCount = conversationData.unreadCount || {};

            // Ajouter le nombre de messages non lus pour cet utilisateur
            totalUnreadCount += unreadCount[userID] || 0;
        });

        const conversations = conversationsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return {
            conversations: conversations,
            totalUnreadCount: totalUnreadCount
        };
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des messages :", error);
        return [];
    };
};

const sendAnnouncerMessage = async (senderID, receiverID, text) => {
    if (!senderID || !receiverID || !text.trim()) {
        console.error("❌ Données invalides : senderID, receiverID et text sont requis.");
        return false;
    }

    // Créer un ID de conversation unique basé sur les participants (triés pour garantir la cohérence)
    const participants = [senderID, receiverID].sort();
    const conversationID = participants.join('_');
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    try {

        // Référence au document de conversation spécifique
        const conversationRef = firestore.collection('CONVERSATIONS').doc(conversationID);
        // Utiliser une transaction pour garantir la cohérence des données
        return await firestore.runTransaction(async (transaction) => {
            const conversationSnap = await transaction.get(conversationRef);

            // Vérifier si la conversation existe déjà
            if (!conversationSnap.exists) {
                // Créer une nouvelle conversation
                transaction.set(conversationRef, {
                    participants,
                    lastMessage: text,
                    updatedAt: timestamp,
                    createdAt: timestamp,
                    unreadCount: { [receiverID]: 1 }
                });
            } else {
                // Mettre à jour la conversation existante
                const conversationData = conversationSnap.data();
                const unreadCount = conversationData.unreadCount || {};

                // Incrémenter le compteur de messages non lus pour le destinataire
                unreadCount[receiverID] = (unreadCount[receiverID] || 0) + 1;

                transaction.update(conversationRef, {
                    lastMessage: text,
                    updatedAt: timestamp,
                    unreadCount: unreadCount
                });
            }

            // Ajouter le message à la sous-collection MESSAGES
            const messageRef = conversationRef.collection('MESSAGES').doc();
            transaction.set(messageRef, {
                senderID,
                receiverID,
                text,
                status: "sent",
                createdAt: timestamp,
                read: false
            });

            return true;
        })
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi du message :", error);
        throw error;
    }
};

const readConversation = async (conversationID, userID) => {
    try {
        const conversationRef = firestore.collection('CONVERSATIONS').doc(conversationID);
        const conversationSnap = await conversationRef.get();
        if (!conversationSnap.exists) {
            console.error("❌ Conversation introuvable.");
            return false;
        }
        const conversationData = conversationSnap.data();
        const unreadCount = conversationData.unreadCount || {};

        // Vérifier que l'utilisateur fait partie de la conversation
        if (!conversationData.participants.includes(userID)) {
            console.error("❌ Vous n'êtes pas autorisé à marquer cette conversation comme lue.");
            return false;
        }

        if (!unreadCount[userID]) {
            console.error("❌ Aucun message non lu à marquer comme lu.");
            return false;
        }

        unreadCount[userID] = 0;
        await conversationRef.update({ unreadCount });

        // Marquer tous les messages comme lus
        const messagesQuery = await conversationRef.collection('MESSAGES')
            .where('receiverID', '==', userID)
            .where('read', '==', false)
            .get();

        const batch = firestore.batch();
        messagesQuery.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        await batch.commit();

        console.log("✅ Conversation marquée comme lue.");
        return true;
    } catch (error) {
        console.error("❌ Erreur lors de la lecture de la conversation :", error);
        return false;
    }
}

const collectChatMessages = async (conversationID) => {
    try {
        // 🔹 Vérifier si la conversation existe
        const conversationRef = firestore.collection('CONVERSATIONS').doc(conversationID);
        const conversationSnap = await conversationRef.get();

        if (!conversationSnap.exists) {
            console.error("❌ Conversation introuvable.");
            return false;
        }

        // 🔹 Récupérer les messages de la conversation
        const messagesRef = conversationRef.collection('MESSAGES').orderBy('createdAt', 'asc');
        const messagesSnap = await messagesRef.get();

        const messages = messagesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return messages;
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des messages :", error);
        return false;
    }
};

module.exports = {
    collectChatMessages,
    collectUserMessage,
    sendAnnouncerMessage,
    readConversation,
}
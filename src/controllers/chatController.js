const { firestore } = require("../config/firebase-admin");
const { sendAnnouncerMessage, collectUserMessage, collectChatMessages, readConversation } = require("../firebase/message");

const fetchUserMessages = async (req, res) => {
    const { userID } = req.params;
    try {
        const data = await collectUserMessage(userID);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Erreur lors de la récupération des messages"
            });
        }
        res.status(200).json({
            success: true,
            message: "Récupération des messages réussie",
            data: data
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des messages:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    }
};

const sendMessage = async (req, res) => {
    const { senderID, receiverID, text } = req.body;
    const user = req.user; // Utilisateur authentifié via middleware

    // Vérification de sécurité: l'expéditeur doit être l'utilisateur authentifié
    if (user.uid !== senderID) {
        return res.status(403).json({
            success: false,
            message: "Vous n'êtes pas autorisé à envoyer des messages au nom d'un autre utilisateur"
        });
    }
    
    // Validation des données
    if (!senderID || !receiverID || !text || !text.trim()) {
        return res.status(400).json({
            success: false,
            message: "Données incomplètes pour l'envoi du message"
        });
    }

    try {
        // Vérifier si les deux utilisateurs existent
        const [senderDoc, receiverDoc] = await Promise.all([
            firestore.collection('USERS').doc(senderID).get(),
            firestore.collection('USERS').doc(receiverID).get()
        ]);

        if (!senderDoc.exists || !receiverDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Un ou plusieurs utilisateurs n'existent pas"
            });
        }

        const result = await sendAnnouncerMessage(senderID, receiverID, text);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Erreur lors de l'envoi du message"
            });
        };
        res.status(200).json({
            success: true,
            message: "Message envoyé avec succès"
        });
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const markConversationAsRead = async (req, res) => {
    const { conversationID } = req.params;
    const { userID } = req.body;
    const user = req.user; // Utilisateur authentifié via middleware

    // Vérification de sécurité: l'expéditeur doit être l'utilisateur authentifié
    if (user.uid !== userID) {
        return res.status(403).json({
            success: false,
            message: "Vous n'êtes pas autorisé à effectuer cette action"
        });
    }

    if (!conversationID || !userID) {
        return res.status(400).json({
            success: false,
            message: "Données incomplètes pour la marque de conversation comme lue"
        });
    }

    try {
        const isConversationMarked = await readConversation(conversationID, userID);
        if (!isConversationMarked) {
            return res.status(404).json({
                success: false,
                message: "Erreur lors de la marque de conversation comme lue"
            });
        }
        res.status(200).json({
            success: true,
            message: "Conversation marquée comme lue avec succès"
        });
    } catch (error) {
        console.error('Erreur lors de la marque de conversation comme lue:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
        
    }

}

const fetchChatMessages = async (req, res) => {
    const { conversationID } = req.params;
    try {
        const messages = await collectChatMessages(conversationID);
        if (!messages) {
            return res.status(404).json({
                success: false,
                message: "Erreur lors de la récupération des messages"
            });
        }
        res.status(200).json({
            success: true,
            message: "Récupération des messages réussie",
            messages: messages
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des messages:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    }
};

module.exports = {
    fetchChatMessages,
    fetchUserMessages,
    sendMessage,
    markConversationAsRead,
};
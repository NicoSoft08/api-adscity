const db = require('../config/database');
const { admin } = require('../config/firebase-admin');

const sendAnnouncerMessage = async (senderID, receiverID, text) => {
    if (!senderID || !receiverID || !text.trim()) {
        console.error("❌ Données invalides : senderID, receiverID et text sont requis.");
        return false;
    }

    // Créer un ID de conversation unique basé sur les participants (triés pour garantir la cohérence)
    const participants = [senderID, receiverID].sort();
    const conversationID = participants.join('_');
    const now = new Date();

    // Utiliser une transaction PostgreSQL pour garantir la cohérence des données
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Vérifier si la conversation existe déjà
        const conversationQuery = 'SELECT * FROM conversations WHERE id = $1';
        const conversationResult = await client.query(conversationQuery, [conversationID]);
        const conversationExists = conversationResult.rows.length > 0;

        if (!conversationExists) {
            // Créer une nouvelle conversation
            const createConversationQuery = `
          INSERT INTO conversations (id, created_at, updated_at, last_message)
          VALUES ($1, $2, $2, $3)
        `;
            await client.query(createConversationQuery, [conversationID, now, text]);

            // Ajouter les participants
            for (const participantID of participants) {
                const unreadCount = participantID === receiverID ? 1 : 0;
                const addParticipantQuery = `
            INSERT INTO conversation_participants (conversation_id, user_id, unread_count)
            VALUES ($1, $2, $3)
          `;
                await client.query(addParticipantQuery, [conversationID, participantID, unreadCount]);
            }
        } else {
            // Mettre à jour la conversation existante
            const updateConversationQuery = `
          UPDATE conversations
          SET last_message = $1, updated_at = $2
          WHERE id = $3
        `;
            await client.query(updateConversationQuery, [text, now, conversationID]);

            // Incrémenter le compteur de messages non lus pour le destinataire
            const updateUnreadCountQuery = `
          UPDATE conversation_participants
          SET unread_count = unread_count + 1
          WHERE conversation_id = $1 AND user_id = $2
        `;
            await client.query(updateUnreadCountQuery, [conversationID, receiverID]);
        }

        // Ajouter le message
        const messageID = uuidv4();
        const createMessageQuery = `
        INSERT INTO messages (id, conversation_id, sender_id, receiver_id, text, created_at, status, read)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
        await client.query(createMessageQuery, [
            messageID,
            conversationID,
            senderID,
            receiverID,
            text,
            now,
            'sent',
            false
        ]);

        await client.query('COMMIT');

        // Émettre une notification pour les fonctionnalités temps réel (optionnel)
        await client.query(`
        SELECT pg_notify('new_message', $1)
      `, [JSON.stringify({
            messageID,
            conversationID,
            senderID,
            receiverID,
            text,
            createdAt: now
        })]);

        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Erreur lors de l'envoi du message :", error);
        throw error;
    } finally {
        client.release();
    }
};

const readConversation = async (conversationID, userID) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Vérifier si la conversation existe
        const conversationQuery = `
        SELECT c.*, json_agg(cp.user_id) AS participants
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.id = $1
        GROUP BY c.id
      `;
        const conversationResult = await client.query(conversationQuery, [conversationID]);

        if (conversationResult.rows.length === 0) {
            console.error("❌ Conversation introuvable.");
            await client.query('ROLLBACK');
            return false;
        }

        const conversationData = conversationResult.rows[0];

        // Vérifier que l'utilisateur fait partie de la conversation
        if (!conversationData.participants.includes(userID)) {
            console.error("❌ Vous n'êtes pas autorisé à marquer cette conversation comme lue.");
            await client.query('ROLLBACK');
            return false;
        }

        // Vérifier s'il y a des messages non lus
        const unreadCountQuery = `
        SELECT unread_count
        FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2
      `;
        const unreadCountResult = await client.query(unreadCountQuery, [conversationID, userID]);

        if (unreadCountResult.rows.length === 0 || unreadCountResult.rows[0].unread_count === 0) {
            console.error("❌ Aucun message non lu à marquer comme lu.");
            await client.query('ROLLBACK');
            return false;
        }

        // Mettre à jour le compteur de messages non lus
        const updateUnreadCountQuery = `
        UPDATE conversation_participants
        SET unread_count = 0
        WHERE conversation_id = $1 AND user_id = $2
      `;
        await client.query(updateUnreadCountQuery, [conversationID, userID]);

        // Marquer tous les messages comme lus
        const updateMessagesQuery = `
        UPDATE messages
        SET read = true
        WHERE conversation_id = $1 AND receiver_id = $2 AND read = false
      `;
        await client.query(updateMessagesQuery, [conversationID, userID]);

        await client.query('COMMIT');
        console.log("✅ Conversation marquée comme lue.");

        // Émettre une notification pour les fonctionnalités temps réel (optionnel)
        await client.query(`
        SELECT pg_notify('conversation_read', $1)
      `, [JSON.stringify({
            conversationID,
            userID,
            timestamp: new Date()
        })]);

        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Erreur lors de la lecture de la conversation :", error);
        return false;
    } finally {
        client.release();
    }
};

const collectUserMessage = async (userID) => {
    try {
        // Récupérer les conversations où l'utilisateur est un participant
        const conversationsQuery = `
        SELECT 
          c.id,
          c.created_at AS "createdAt",
          c.updated_at AS "updatedAt",
          c.last_message AS "lastMessage",
          (
            SELECT json_agg(cp2.user_id)
            FROM conversation_participants cp2
            WHERE cp2.conversation_id = c.id
          ) AS participants,
          (
            SELECT json_object_agg(cp3.user_id, cp3.unread_count)
            FROM conversation_participants cp3
            WHERE cp3.conversation_id = c.id
          ) AS "unreadCount",
          cp.unread_count AS user_unread_count
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE cp.user_id = $1
        ORDER BY c.updated_at DESC
      `;

        const conversationsResult = await db.query(conversationsQuery, [userID]);

        if (conversationsResult.rows.length === 0) {
            console.log("⚠️ Aucune conversation trouvée pour cet utilisateur.");
            return { conversations: [], totalUnreadCount: 0 };
        }

        // Calculer le nombre total de messages non lus
        let totalUnreadCount = 0;
        const conversations = conversationsResult.rows.map(row => {
            // Ajouter le nombre de messages non lus pour cet utilisateur
            totalUnreadCount += row.user_unread_count || 0;

            // Convertir les dates en objets Date pour correspondre au format Firestore
            return {
                id: row.id,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                lastMessage: row.lastMessage,
                participants: row.participants || [],
                unreadCount: row.unreadCount || {}
            };
        });

        return {
            conversations: conversations,
            totalUnreadCount: totalUnreadCount
        };
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des messages :", error);
        return { conversations: [], totalUnreadCount: 0 };
    }
};

const collectChatMessages = async (conversationID) => {
    try {
        // 🔹 Vérifier si la conversation existe
        const conversationQuery = `
        SELECT * FROM conversations WHERE id = $1
      `;
        const conversationResult = await db.query(conversationQuery, [conversationID]);

        if (conversationResult.rows.length === 0) {
            console.error("❌ Conversation introuvable.");
            return false;
        }

        // 🔹 Récupérer les messages de la conversation
        const messagesQuery = `
        SELECT 
          id,
          sender_id AS "senderID",
          receiver_id AS "receiverID",
          text,
          created_at AS "createdAt",
          status,
          read
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
      `;

        const messagesResult = await db.query(messagesQuery, [conversationID]);

        // Formater les messages pour correspondre à la structure attendue
        const messages = messagesResult.rows.map(row => {
            // Convertir les dates en format compatible avec le client
            return {
                id: row.id,
                senderID: row.senderID,
                receiverID: row.receiverID,
                text: row.text,
                createdAt: row.createdAt,
                status: row.status,
                read: row.read
            };
        });

        return messages;
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des messages :", error);
        return false;
    }
};


module.exports = {
    sendAnnouncerMessage,
    readConversation,
    collectUserMessage,
    collectChatMessages
};
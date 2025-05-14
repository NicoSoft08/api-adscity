const fs = require('fs');
const { firestore } = require('../config/firebase-admin');
const { pool } = require('../config/database');

/**
 * Exporte une collection ou sous-collection Firestore au format JSON ou SQL
 * @param {string} path - Chemin complet de la collection ou sous-collection
 * @param {string} format - Format d'export ('json' ou 'sql')
 * @param {string} tableName - Nom de la table SQL (par défaut = dernier segment du chemin)
 * @param {boolean} includeParentRef - Inclure une référence au document parent pour les sous-collections
 * @returns {Promise<void>}
 */
async function exportCollection(path, format = 'json', tableName = null, includeParentRef = true) {
    try {
        console.log(`Exportation de la collection ${path} au format ${format}...`);

        // Déterminer si c'est une sous-collection en vérifiant si le chemin contient des segments impairs
        const segments = path.split('/');
        const isSubcollection = segments.length > 1 && segments.length % 2 === 0;

        // Obtenir le nom de la collection (dernier segment pour une collection, avant-dernier pour une sous-collection)
        const collectionName = segments[segments.length - 1];

        // Si aucun nom de table n'est spécifié, utiliser le nom de la collection
        const sqlTableName = tableName || collectionName.toLowerCase();

        // Référence à la collection ou sous-collection
        const collectionRef = firestore.collection(path);
        const snapshot = await collectionRef.get();

        if (snapshot.empty) {
            console.log(`La collection ${path} est vide.`);
            return;
        }

        if (format === 'json') {
            // Export au format JSON
            const data = [];
            snapshot.forEach(doc => {
                const docData = { id: doc.id, ...doc.data() };

                // Si c'est une sous-collection et que nous voulons inclure la référence au parent
                if (isSubcollection && includeParentRef) {
                    // Ajouter l'ID du document parent
                    const parentId = segments[segments.length - 2];
                    docData.parentId = parentId;

                    // Si le chemin a plus de 3 segments, ajouter aussi l'ID de la collection parente
                    if (segments.length > 3) {
                        const parentCollectionName = segments[segments.length - 3];
                        docData.parentCollection = parentCollectionName;
                    }
                }

                data.push(docData);
            });

            const outputFileName = `${path.replace(/\//g, '_')}.json`;
            fs.writeFileSync(outputFileName, JSON.stringify(data, null, 2));
            console.log(`Exportation JSON terminée: ${outputFileName}`);
        }
        else if (format === 'sql') {
            // Export au format SQL
            let sqlContent = '';

            // Déterminer les colonnes à partir du premier document
            let columns = new Set(['id']);

            // Si c'est une sous-collection, ajouter une colonne pour la référence au parent
            if (isSubcollection && includeParentRef) {
                columns.add('parent_id');

                // Si le chemin a plus de 3 segments, ajouter aussi une colonne pour la collection parente
                if (segments.length > 3) {
                    columns.add('parent_collection');
                }
            }

            let firstDoc = null;

            snapshot.forEach(doc => {
                if (!firstDoc) {
                    firstDoc = doc;
                    const data = doc.data();
                    Object.keys(data).forEach(key => {
                        // Convertir les noms de colonnes camelCase en snake_case
                        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                        columns.add(snakeKey);
                    });
                }
            });

            columns = Array.from(columns);

            // Créer l'instruction CREATE TABLE
            sqlContent += `-- Table: ${sqlTableName}\n`;
            sqlContent += `CREATE TABLE IF NOT EXISTS ${sqlTableName} (\n`;

            columns.forEach((column, index) => {
                if (column === 'id') {
                    sqlContent += `  id VARCHAR(255) PRIMARY KEY`;
                } else if (column === 'parent_id') {
                    sqlContent += `  parent_id VARCHAR(255)`;
                } else if (column === 'parent_collection') {
                    sqlContent += `  parent_collection VARCHAR(255)`;
                } else {
                    // Par défaut, utiliser TEXT pour tous les champs
                    sqlContent += `  ${column} TEXT`;
                }

                if (index < columns.length - 1) {
                    sqlContent += ',\n';
                } else {
                    sqlContent += '\n';
                }
            });

            // Si c'est une sous-collection, ajouter une contrainte de clé étrangère
            if (isSubcollection && includeParentRef) {
                const parentTableName = segments[segments.length - 3].toLowerCase();
                sqlContent += `,\n  FOREIGN KEY (parent_id) REFERENCES ${parentTableName}(id) ON DELETE CASCADE`;
            }

            sqlContent += `);\n\n`;

            // Créer les instructions INSERT
            snapshot.forEach(doc => {
                const data = doc.data();
                const values = [];

                // Préparer les valeurs pour chaque colonne
                columns.forEach(column => {
                    if (column === 'id') {
                        values.push(escapeSqlString(doc.id));
                    } else if (column === 'parent_id' && isSubcollection) {
                        values.push(escapeSqlString(segments[segments.length - 2]));
                    } else if (column === 'parent_collection' && isSubcollection && segments.length > 3) {
                        values.push(escapeSqlString(segments[segments.length - 3]));
                    } else {
                        // Convertir le nom de colonne snake_case en camelCase pour accéder aux données
                        const camelKey = column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

                        let value = data[camelKey];

                        if (value === undefined) {
                            values.push('NULL');
                        } else if (value === null) {
                            values.push('NULL');
                        } else if (typeof value === 'object') {
                            // Convertir les objets et tableaux en JSON
                            values.push(escapeSqlString(JSON.stringify(value)));
                        } else if (typeof value === 'boolean') {
                            values.push(value ? 'TRUE' : 'FALSE');
                        } else if (typeof value === 'number') {
                            values.push(value.toString());
                        } else if (value instanceof Date) {
                            values.push(escapeSqlString(value.toISOString()));
                        } else {
                            values.push(escapeSqlString(String(value)));
                        }
                    }
                });

                sqlContent += `INSERT INTO ${sqlTableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            });

            const outputFileName = `${path.replace(/\//g, '_')}.sql`;
            fs.writeFileSync(outputFileName, sqlContent);
            console.log(`Exportation SQL terminée: ${outputFileName}`);
        }
        else {
            throw new Error(`Format d'exportation non pris en charge: ${format}`);
        }
    } catch (error) {
        console.error(`Erreur lors de l'exportation de la collection ${path}:`, error);
        throw error;
    }
}

/**
 * Exporte toutes les sous-collections d'un document Firestore
 * @param {string} documentPath - Chemin du document parent
 * @param {string} format - Format d'export ('json' ou 'sql')
 * @returns {Promise<void>}
 */
async function exportSubcollections(documentPath, format = 'json') {
    try {
        console.log(`Recherche des sous-collections pour le document ${documentPath}...`);

        const documentRef = firestore.doc(documentPath);
        const collections = await documentRef.listCollections();

        if (collections.length === 0) {
            console.log(`Aucune sous-collection trouvée pour le document ${documentPath}.`);
            return;
        }

        console.log(`${collections.length} sous-collections trouvées pour le document ${documentPath}.`);

        for (const collection of collections) {
            const subcollectionPath = `${documentPath}/${collection.id}`;
            await exportCollection(subcollectionPath, format);
        }
    } catch (error) {
        console.error(`Erreur lors de l'exportation des sous-collections pour ${documentPath}:`, error);
        throw error;
    }
}

/**
 * Exporte toutes les sous-collections pour tous les documents d'une collection
 * @param {string} collectionPath - Chemin de la collection parent
 * @param {string} format - Format d'export ('json' ou 'sql')
 * @returns {Promise<void>}
 */
async function exportAllSubcollections(collectionPath, format = 'json') {
    try {
        console.log(`Exportation de toutes les sous-collections pour la collection ${collectionPath}...`);

        const collectionRef = firestore.collection(collectionPath);
        const snapshot = await collectionRef.get();

        if (snapshot.empty) {
            console.log(`La collection ${collectionPath} est vide.`);
            return;
        }

        for (const doc of snapshot.docs) {
            const documentPath = `${collectionPath}/${doc.id}`;
            await exportSubcollections(documentPath, format);
        }
    } catch (error) {
        console.error(`Erreur lors de l'exportation des sous-collections pour ${collectionPath}:`, error);
        throw error;
    }
};


async function exportCollectionAndSubCollections() {
    try {
        // 1. Exporter la collection principale USERS
        await exportCollection('USERS', 'sql', 'users');

        // 2. Exporter toutes les sous-collections pour tous les utilisateurs
        await exportAllSubcollections('USERS', 'sql');

        console.log('Exportation des utilisateurs et leurs sous-collections terminée avec succès.');
    } catch (error) {
        console.error('Erreur lors de l\'exportation:', error);
    }
}

/**
 * Échappe une chaîne pour une utilisation sécurisée dans une instruction SQL
 * @param {string} str - Chaîne à échapper
 * @returns {string} - Chaîne échappée
 */
function escapeSqlString(str) {
    if (typeof str !== 'string') return str;
    return `'${str.replace(/'/g, "''")}'`;
};


async function verifyImport() {
    const client = await pool.connect();

    try {
        // Vérifier le nombre d'utilisateurs
        const usersCount = await client.query('SELECT COUNT(*) FROM users');
        console.log(`Nombre d'utilisateurs importés: ${usersCount.rows[0].count}`);

        // Vérifier le nombre de notifications
        const notificationsCount = await client.query('SELECT COUNT(*) FROM notifications');
        console.log(`Nombre de notifications importées: ${notificationsCount.rows[0].count}`);

        // Vérifier le nombre d'activités de connexion
        const loginActivityCount = await client.query('SELECT COUNT(*) FROM login_activity');
        console.log(`Nombre d'activités de connexion importées: ${loginActivityCount.rows[0].count}`);

        // Vérifier le nombre d'annonces
        const postsCount = await client.query('SELECT COUNT(*) FROM posts');
        console.log(`Nombre d'annonces importées: ${postsCount.rows[0].count}`);

        // Vérifier le nombre de conversations
        const conversationsCount = await client.query('SELECT COUNT(*) FROM conversations');
        console.log(`Nombre de conversations importées: ${conversationsCount.rows[0].count}`);

        // Vérifier le nombre de messages
        const messagesCount = await client.query('SELECT COUNT(*) FROM messages');
        console.log(`Nombre de messages importés: ${messagesCount.rows[0].count}`);
    } catch (error) {
        console.error('Erreur lors de la vérification de l\'importation:', error);
    } finally {
        client.release();
    }
}

module.exports = {
    exportCollection,
    exportSubcollections,
    exportAllSubcollections,
    exportCollectionAndSubCollections,

    verifyImport
};

const { auth } = require("../config/firebase-admin");
const {
    searchQuery,
    updateInteraction,
    updateContactClick,
    contactUs,
    collectLocations,
    advancedItemSearch,
    evaluateUser,
    socialLinksUpdate,
    incrementView,
    incrementClick,
    fetchFilteredPostsQuery,
    publishAdvertising,
    collectPubs,
    collectPubById,
    collectViewCount,
    logAdminIDAction,
    logClientIDAction,
    collectVerifications,
    incrementShare,
    emailVerificationLink
} = require("../firebase/api");

const searchItems = async (req, res) => {
    const { query } = req.query;

    try {
        const searchResults = await searchQuery(query);
        if (!searchResults || searchResults.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun résultat trouvé'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Résultats de recherche',
            searchResults: searchResults
        });
    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const logAdminAction = async (req, res) => {
    const { userID } = req.params;
    const { action, details } = req.body;

    if (!userID || !action || !details) {
        return res.status(400).json({
            success: false,
            message: 'Informations manquantes'
        });
    }

    try {
        const isLogged = await logAdminIDAction(userID, action, details);
        if (!isLogged) {
            return res.status(404).json({
                success: false,
                message: 'Action non trouvée'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Action enregistrée avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la gestion de l\'action:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const logClientAction = async (req, res) => {
    const { userID } = req.params;
    const { action, details } = req.body;

    if (!userID || !action || !details) {
        return res.status(400).json({
            success: false,
            message: 'Informations manquantes'
        });
    }

    try {
        const isLogged = await logClientIDAction(userID, action, details);
        if (!isLogged) {
            return res.status(404).json({
                success: false,
                message: 'Action non trouvée'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Action enregistrée avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la gestion de l\'action:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const manageInteraction = async (req, res) => {
    const { postID, userID, category } = req.body;

    try {
        const interactionResult = await updateInteraction(postID, userID, category);
        if (!interactionResult) {
            return res.status(404).json({
                success: false,
                message: 'Interaction non trouvée'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Interaction gérée avec succès'
        });
    } catch (error) {
        consoleole.error('Erreur lors de la gestion de l\'interaction:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const manageContactClick = async (req, res) => {
    const { userID, city } = req.body;

    try {
        const interactionResult = await updateContactClick(userID, city);
        if (!interactionResult) {
            return res.status(404).json({
                success: false,
                message: 'Interaction non trouvée'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Interaction gérée avec succès'
        });
    } catch (error) {
        consoleole.error('Erreur lors de la gestion de l\'interaction:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const contactSupportClient = async (req, res) => {
    const { formData } = req.body;

    try {
        const isSent = await contactUs(formData);
        if (!isSent) {
            return res.status(404).json({
                success: false,
                message: 'Erreur lors de la transmission du formulaire'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Formulaire envoyé avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la transmission du formulaire:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const getPostsLocations = async (req, res) => {
    try {
        const postsLocations = await collectLocations();
        if (!postsLocations || postsLocations.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucune localisation trouvée'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Localisations récupérées avec succès',
            postsLocations: postsLocations
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des localisations:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const advancedSearch = async (req, res) => {
    const { queryParams } = req.query;
    const { category, item, location, minPrice, maxPrice } = queryParams;
    try {
        const searchResults = await advancedItemSearch(category, item, location, minPrice, maxPrice);
        if (!searchResults || searchResults.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun résultat trouvé'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Résultats de recherche',
            searchResults: searchResults
        });
    } catch (error) {
        console.error('Erreur lors de la recherche avancée:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const rateUser = async (req, res) => {
    const { userID } = req.params;
    const { rating, comment } = req.body;

    try {
        const isRated = await evaluateUser(userID, rating, comment);
        if (!isRated) {
            return res.status(404).json({
                success: false,
                message: 'Évaluation non trouvée'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Évaluation enregistrée avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la notation de l\'utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const updateUserSocialLinks = async (req, res) => {
    const { userID } = req.params;
    const { socialLinks } = req.body;

    try {
        const isUpdated = await socialLinksUpdate(userID, socialLinks);
        if (!isUpdated) {
            return res.status(404).json({
                success: false,
                message: 'Echec de la mise à jour'
            });
        };
        res.status(200).json({
            success: isUpdated.success,
            message: isUpdated.message
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour des réseaux sociaux: ', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const incrementViewCount = async (req, res) => {
    const { postID } = req.params;
    const { userID } = req.body;

    try {
        const isUpdated = await incrementView(postID, userID);
        if (!isUpdated) {
            return res.status(404).json({
                success: false,
                message: 'Echec de la mise à jour'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Nombre de vues mis à jour avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du nombre de vues: ', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const incrementClickCount = async (req, res) => {
    const { postID } = req.params;
    const { userID } = req.body;

    try {
        const isUpdated = await incrementClick(postID, userID);
        if (!isUpdated) {
            return res.status(404).json({
                success: false,
                message: 'Echec de la mise à jour'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Nombre de clicks mis à jour avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du nombre de clicks: ', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const incrementShareCount = async (req, res) => {
    const { postID } = req.params;
    const { userID } = req.body;

    try {
        const isUpdated = await incrementShare(postID, userID);
        if (!isUpdated) {
            return res.status(404).json({
                success: false,
                message: 'Echec de la mise à jour'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Nombre de partages mis à jour avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du nombre de partages: ', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    }
}

const fetchFilteredPosts = async (req, res) => {
    const { item, category, minPrice, maxPrice } = req.query;

    try {
        const filteredPosts = await fetchFilteredPostsQuery(item, category, minPrice, maxPrice);
        if (!filteredPosts) {
            return res.status(404).json({
                success: false,
                message: 'Aucun post trouvé'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Posts récupérés avec succès',
            filteredPosts: filteredPosts
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des posts filtrés: ', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const hostAdvertising = async (req, res) => {
    const pubData = req.body;

    try {
        const isPublished = await publishAdvertising(pubData);
        if (!isPublished) {
            return res.status(404).json({
                success: false,
                message: 'Echec de la publication'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Annonce publiée avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la publication d\'un annonce: ', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    }
};

const fetchPubById = async (req, res) => {
    const { pub_id } = req.params;

    if (!pub_id) {
        return res.status(400).json({
            success: false,
            message: 'ID de l\'annonce manquant'
        });
    }

    try {
        const data = await collectPubById(pub_id);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Aucune annonce trouvée'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Annonce récupérée avec succès',
            data: data
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'annonce: ', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const fetchPubs = async (req, res) => {
    try {
        const pubs = await collectPubs();
        if (!pubs) {
            return res.status(404).json({
                success: false,
                message: 'Aucune annonce trouvée'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Annonces récupérées avec succès',
            pubs: pubs
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des annonces: ', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    };
};

const getViewCount = async (req, res) => {
    const { postID } = req.params;

    if (!postID) {
        return res.status(400).json({
            success: false,
            message: 'ID du post manquant'
        });
    }

    try {
        const viewCount = await collectViewCount(postID);
        if (!viewCount) {
            return res.status(404).json({
                success: false,
                message: 'Aucun post trouvé'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Nombre de vues récupéré avec succès',
            viewCount: viewCount
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du nombre de vues: ', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    }
};

const fetchVerifications = async (req, res) => {
    try {
        const data = await collectVerifications();
        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Aucune vérification trouvée'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Vérifications récupérées avec succès',
            data: data
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des vérifications: ', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plustard'
        });
    }
}

const resendVerificationEmail = async (req, res) => {
    const { userID } = req.params;

    try {
        // Get user from Firebase Auth
        const userRecord = await auth.getUser(userID);

        if (userRecord.emailVerified) {
            return res.status(400).json({
                success: false,
                message: "L'email de cet utilisateur est déjà vérifié"
            });
        }

        const isSent = await emailVerificationLink(userID);
        if (!isSent) {
            return res.status(500).json({
                success: false,
                message: "Erreur technique, réessayez plus tard"
            });
        }
        
        // Log the action
        console.log(`Verification email sent to ${userRecord.email}`);

        // Return success response
        res.status(200).json({
            success: true,
            message: "Email de vérification envoyé avec succès"
        });
    } catch (error) {
        console.error("Erreur lors du renvoi de l'email de vérification:", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    }
};

module.exports = {
    advancedSearch,
    contactSupportClient,
    fetchFilteredPosts,
    fetchPubs,
    fetchPubById,
    fetchVerifications,
    getPostsLocations,
    getViewCount,
    hostAdvertising,
    incrementViewCount,
    incrementClickCount,
    incrementShareCount,
    manageInteraction,
    manageContactClick,
    logAdminAction,
    logClientAction,
    rateUser,
    resendVerificationEmail,
    searchItems,
    updateUserSocialLinks,
};
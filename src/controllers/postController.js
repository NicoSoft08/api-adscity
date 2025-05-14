// const { collectPosts } = require("../database/post");
const {
    makePost,
    validatePost,
    rejectPost,
    collectPosts,
    collectPendingPosts,
    collectApprovedPosts,
    collectRejectedPosts,
    collectPostByID,
    collectPostsByUserID,
    collectPendingPostsByUserID,
    collectApprovedPostsByUserID,
    collectRejectedPostsByUserID,
    collectActivePostsByUserID,
    collectOutdatedPostsByUserID,
    collectPostsByCategoryName,
    collectRelatedPosts,
    reportPostID,
    collectPostBySlug,
    updatePostByID,
    deletePostByID,
    suspendPostByID,
    markPostSold,
    fetchNearbyPostsByLocation,
    collectDataFromPostID,
    adminDeletePostByID,
    repostPost
} = require("../firebase/post");
const { verifyCaptcha } = require("../middlewares/authMiddleware");

const createPost = async (req, res) => {
    const { postData, userID, captchaToken } = req.body;

    // Validate required fields
    if (!postData || !userID) {
        return res.status(400).json({
            success: false,
            message: 'Données de l\'annonce manquantes'
        });
    }

    // Verify CAPTCHA
    if (!captchaToken) {
        return res.status(400).json({
            success: false,
            message: "Vérification CAPTCHA requise"
        });
    }

    // Verify the captcha token with Google's API
    const captchaVerification = await verifyCaptcha(captchaToken);
    if (!captchaVerification.success) {
        return res.status(400).json({
            success: false,
            message: "Échec de la vérification CAPTCHA",
            error: 'captcha_failed'
        });
    }

    try {
        const isPostCreated = await makePost(postData, userID, captchaToken);
        if (!isPostCreated) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la création de l\'annonce'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonce créée avec succès'
        });
    } catch (error) {
        console.error('Erreur pendant la création du poste:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    }
};

const adminApprovePost = async (req, res) => {
    const { postID } = req.params;

    try {
        const isPostApproved = await validatePost(postID);
        if (!isPostApproved) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la validation de l\'annonce'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonce validée avec succès'
        });
    } catch (error) {
        console.error('Erreur pendant la validation du poste:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const reportPostByID = async (req, res) => {
    const { postID } = req.params;
    const { userID, reason } = req.body;

    // Vérification des données d'entrée
    if (!postID || !userID || !reason) {
        return res.status(400).json({
            success: false,
            message: 'Données invalides'
        });
    }

    // Liste des raisons valides
    const validReasons = [
        'Contenu inapproprié',
        'Produit illégal',
        'Annonce frauduleuse',
        'Violation des règles du site',
        'Produit contrefait',
        'Informations trompeuses',
    ];

    if (!validReasons.includes(reason)) {
        return res.status(400).json({
            success: false,
            message: 'Raison de signalement invalide'
        });
    }

    try {
        const isPostReported = await reportPostID(postID, userID, reason);
        if (!isPostReported) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors du signalement de l\'annonce'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonce signalée avec succès'
        });
    } catch (error) {
        console.error('Erreur pendant le signalement de l\'annonce:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const adminRefusePost = async (req, res) => {
    const { postID } = req.params;
    const { reason } = req.body;

    try {
        isPostRefused = await rejectPost(postID, reason);
        if (!isPostRefused) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors du rejet de l\'annonce'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonce rejetée avec succès'
        });
    } catch (error) {
        console.error('Erreur pendant le rejet du poste:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const adminDeletePost = async (req, res) => {
    const { postID } = req.params;

    try {
        const isPostDeleted = await adminDeletePostByID(postID);
        if (!isPostDeleted) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la suppression de l\'annonce'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Annonce supprimée avec succès'
        });
    } catch (error) {
        console.error('Erreur pendant la suppression de l\'annonce:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    }
};

const getPosts = async (req, res) => {
    try {
        const posts = await collectPosts();
        if (!posts) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonces récupérées avec succès',
            posts: posts,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
        
    }
};

const getPostsData = async (req, res) => {
    try {
        const postsData = await collectPosts();
        if (!postsData) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des données des annonces'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Données des annonces récupérées avec succès',
            postsData: postsData,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des données des annonces:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getPendingPosts = async (req, res) => {
    try {
        const pendingPosts = await collectPendingPosts();
        if (!pendingPosts) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces en attente'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonces en attente récupérées avec succès',
            pendingPosts: pendingPosts,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces en attente:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getApprovedPosts = async (req, res) => {
    try {
        const approvedPosts = await collectApprovedPosts();
        if (!approvedPosts) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces approuvées'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonces approuvées récupérées avec succès',
            approvedPosts: approvedPosts,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces approuvées:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getRefusedPosts = async (req, res) => {
    try {
        const refusedPosts = await collectRejectedPosts();
        if (!refusedPosts) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces rejetées'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonces rejetées récupérées avec succès',
            refusedPosts: refusedPosts,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces rejetées:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getPostBySlug = async (req, res) => {
    const { category, subcategory, slug } = req.params; 

    try {
        const postData = await collectPostBySlug(category, subcategory, slug);
        if (!postData) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération de l\'annonce'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonce récupérée avec succès',
            postData: postData,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération de l\'annonce par slug:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getDataFromPostID = async (req, res) => {
    const { post_id } = req.params;

    try {
        const data = await collectDataFromPostID(post_id);
        if (!data) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération de l\'annonce'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Annonce récupérée avec succès',
            data: data,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération de l\'annonce par ID:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getPostByID = async (req, res) => {
    const { postID } = req.params;
    console.log('postID:', postID);

    try {
        const postData = await collectPostByID(postID);
        if (!postData) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération de l\'annonce'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonce récupérée avec succès',
            postData: postData,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération de l\'annonce par ID:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getPostsByUserID = async (req, res) => {
    const { userID } = req.params;

    try {
        const postsData = await collectPostsByUserID(userID);
        if (!postsData) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonces récupérées avec succès',
            postsData: postsData,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces par ID utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getPendingPostsByUserID = async (req, res) => {
    const { userID } = req.params;

    try {
        const pendingPosts = await collectPendingPostsByUserID(userID);
        if (!pendingPosts) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces en attente'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonces en attente récupérées avec succès',
            pendingPosts: pendingPosts,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces en attente par ID utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getApprovedPostsByUserID = async (req, res) => {
    const { userID } = req.params;

    try {
        const approvedPosts = await collectApprovedPostsByUserID(userID);
        if (!approvedPosts) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces approuvées'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonces approuvées récupérées avec succès',
            approvedPosts: approvedPosts,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces approuvées par ID utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getRefusedPostsByUserID = async (req, res) => {
    const { userID } = req.params;

    try {
        const refusedPosts = await collectRejectedPostsByUserID(userID);
        if (!refusedPosts) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces refusées'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonces refusées récupérées avec succès',
            approvedPosts: refusedPosts,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces refusées par ID utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getActivePostsByUserID = async (req, res) => {
    const { UserID } = req.params;

    try {
        const activePosts = await collectActivePostsByUserID(UserID);
        if (!activePosts) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces actives'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Annonces actives récupérées avec succès',
            activePosts: activePosts,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces actives par ID utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getOutdatedPostsByUserID = async (req, res) => {
    const { userID } = req.params;

    try {
        const inactivePosts = await collectOutdatedPostsByUserID(userID);
        if (!inactivePosts) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces inactives'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonces inactives récupérées avec succès',
            activePosts: inactivePosts,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces inactives par ID utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const getPostsByCategoryName = async (req, res) => {
    const { categoryName } = req.body;
    console.log(categoryName);

    try {
        const postsByCategoryName = await collectPostsByCategoryName(categoryName);
        if (!postsByCategoryName) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces par nom de catégorie'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonces récupérées avec succès',
            postsByCategoryName: postsByCategoryName,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces par nom de catégorie:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    }
};

const getRelatedPosts = async (req, res) => {
    const { post_id, category } = req.body;

    try {
        const relatedPosts = await collectRelatedPosts(post_id, category);
        if (!relatedPosts) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la récupération des annonces par nom de catégorie'
            });
        };
        res.status(201).json({
            success: true,
            message: 'Annonces récupérées avec succès',
            relatedPosts: relatedPosts,
        });
    } catch (error) {
        console.error('Erreur pendant la récupération des annonces par nom de catégorie:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const updatePost = async (req, res) => {
    const { postID } = req.params;
    const { updatedData, userID } = req.body;

    console.log(postID);

    try {
        const isUpdated = await updatePostByID(postID, updatedData, userID);
        if (!isUpdated) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la mise à jour de l\'annonce'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Annonce mise à jour avec succès',
        });
    } catch (error) {
        console.error('Erreur pendant la mise à jour de l\'annonce:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const deletePost = async (req, res) => {
    const { postID } = req.params;
    const { userID } = req.body;

    try {
        const isDeleted = await deletePostByID(postID, userID);
        if (!isDeleted) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la suppression de l\'annonce'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Annonce supprimée avec succès',
        });
    } catch (error) {
        console.error('Erreur pendant la suppression de l\'annonce:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const adminSuspendPost = async (req, res) => {
    const { postID } = req.params;
    const { reason } = req.body;

    try {
        const isSuspended = await suspendPostByID(postID, reason);
        if (!isSuspended) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la suspension de l\'annonce'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Annonce suspendue avec succès',
        });
    } catch (error) {
        console.error('Erreur pendant la suspension de l\'annonce:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const markPostAsSold = async (req, res) => {
    const { postID } = req.params;
    const { userID } = req.body;

    try {
        const isMarkedAsSold = await markPostSold(userID, postID);
        if (!isMarkedAsSold) {
            return res.status(404).json({
                success: false,
                message: 'Erreur lors de la mise à jour',
            });
        };
        res.status(200).json({
            success: true,
            message: 'Annonce marquée comme vendue',
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'annonce:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const fetchNearbyPosts = async (req, res) => {
    const { country, city } = req.query;

    if (!country || !city) {
        return res.status(400).json({
            success: false,
            message: 'Pays et ville sont requis pour la recherche.'
        });
    }

    try {
        console.log(`📍 Recherche d'annonces proches pour: ${country}, ${city}`);

        const nearbyPosts = await fetchNearbyPostsByLocation(country, city);
        if (nearbyPosts.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucune annonce trouvée à proximité.'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Annonces récupérées avec succès',
            nearbyPosts: nearbyPosts,
        });
    } catch (error) {
        console.error('❌ Erreur pendant la récupération des annonces par proximité:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    };
};

const repostPostByID = async (req, res) => {
    const { postID } = req.params;
    const { userID, postData } = req.body;

    if (!postID) {
        return res.status(400).json({
            success: false,
            message: 'ID de l\'annonce requis pour la républication.'
        });
    }

    if (!userID) {
        return res.status(400).json({
            success: false,
            message: 'ID de l\'utilisateur requis pour la républication.'
        });
    }

    if (!postData) {
        return res.status(400).json({
            success: false,
            message: 'Données de l\'annonce requises pour la républication.'
        });
    }

    try {
        const isReposted = await repostPost(postID, userID, postData);
        if (!isReposted) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la républication de l\'annonce'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Annonce républiée avec succès',
        });
    } catch (error) {
        console.error('Erreur pendant la républication de l\'annonce:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard'
        });
    }
};

module.exports = {
    adminApprovePost,
    createPost,
    adminDeletePost,
    deletePost,
    fetchNearbyPosts,
    getActivePostsByUserID,
    getApprovedPosts,
    getApprovedPostsByUserID,
    getPendingPostsByUserID,
    getPendingPosts,
    getPostsByCategoryName,
    getPostByID,
    getPostBySlug,
    getPostsByUserID,
    getPostsData,
    getPosts,
    getOutdatedPostsByUserID,
    getRefusedPostsByUserID,
    getRefusedPosts,
    getRelatedPosts,
    markPostAsSold,
    adminRefusePost,
    reportPostByID,
    adminSuspendPost,
    updatePost,
    getDataFromPostID,
    repostPostByID,
};
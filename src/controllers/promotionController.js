const { isPromotionActive, collectPromotionLimits } = require("../firebase/promotion");

const getPromotionLimits = async (req, res) => {
    try {
        const features = await collectPromotionLimits();
        if (!features) {
            return res.status(404).json({
                success: false,
                message: 'Aucune limite de la promotion trouvée.'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Limites de la promotion récupérées avec succès.',
            features: features
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des limites de promotion:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur technique, réessayez plus tard.' 
        });
    };
};

const checkPromotionStatus = async (req, res) => {
    try {
        const isActive = await isPromotionActive();
        if (!isActive) {
            return res.status(404).json({
                success: false,
                message: 'La promotion n\'est pas active.'
            });
        };
        res.status(200).json({
            success: true,
            message: 'La promotion est active.'
        });
    } catch (error) {
        console.error('Erreur lors de la vérification de la promotion active:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard.'
        });
    };
};


module.exports = {
    checkPromotionStatus,
    getPromotionLimits
};
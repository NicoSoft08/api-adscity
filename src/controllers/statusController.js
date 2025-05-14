const { createStatusData, getStatusData, getAllStatusesData } = require("../firebase/status");

const createStatus = async (req, res) => {
    const { statusData, userID } = req.body;

    if (!statusData || !userID) {
        return res.status(400).json({
            success: false,
            message: "Données de statut manquantes"
        });
    }

    try {
        const isCreated = await createStatusData(statusData, userID);
        if (!isCreated) {
            return res.status(404).json({
                success: false,
                message: "Erreur lors de la création du statut"
            });
        }
        res.status(201).json({
            success: true,
            message: "Statut créé avec succès"
        });
    } catch (error) {
        console.error("Erreur lors de la création du statut :", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la création du statut"
        });
    }
};

const getStatusByUserID  = async (req, res) => {
    const { userID } = req.params;

    try {
        const data = await getStatusData(userID);
        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Aucun statut trouvé pour cet utilisateur"
            });
        }
        res.status(200).json({
            success: true,
            message: "Statut récupéré avec succès",
            data: data
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des données de statut :", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des données de statut"
        });
    }
};

const getAllStatuses = async (req, res) => {
    try {
        const statuses = await getAllStatusesData();
        if (!statuses) {
            return res.status(404).json({
                success: false,
                message: "Aucun statut trouvé"
            });
        }
        res.status(200).json({
            success: true,
            message: "Statuts récupérés avec succès",
            statuses: statuses
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des statuts :", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des statuts"
        });
    }
};


module.exports = {
    createStatus,
    getAllStatuses,
    getStatusByUserID,
};
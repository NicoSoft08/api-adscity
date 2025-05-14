const { translator } = require("../firebase/translate");

const translateController = async (req, res) => {
    const { text, source, target } = req.body;

    if (!text || !source || !target) {
        return res.status(400).json({
            success: false,
            message: 'Les champs "text", "source" et "target" sont requis.'
        });
    }
    if (source === target) {
        return res.status(400).json({
            success: false,
            message: 'La source et la cible ne peuvent être identiques.'
        });
    }

    try {
        const data = await translator(text, source, target);
        if (data) {
            res.status(200).json({
                success: true,
                message: 'Traduction réussie.',
                data: data
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Erreur technique, réessayez plus tard.'
            });
        }
    } catch (error) {
        console.error('Erreur lors de la traduction :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard.'
        });

    }
};

module.exports = { translateController };
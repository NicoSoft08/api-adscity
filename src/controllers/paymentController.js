const { collectPaymentProcess, collectPaymentByUserID, collectPayments, upgradePaymentStatus, collectProcessingPayments, collectCompletedPayments, collectFailedPayments, collectAllPaymentsWithStatus, createPayment, createNewPaymentAccount, fetchPaymentAccounts, deletePaymentAccountByID, togglePaymentAccountStatusByID } = require("../firebase/payment");

const createPaymentIntent = async (req, res) => {
    const { userID, paymentData } = req.body;

    if (!userID || !paymentData) {
        return res.status(400).json({
            success: false,
            message: "Données de paiement incomplètes"
        });
    }

    try {
        const paymentIntent = await createPayment(userID, paymentData);
        if (!paymentIntent) {
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la création du paiement'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Paiement créé avec succès',
        });
    } catch (error) {
        console.error('Erreur lors de la création du paiement :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du paiement'
        });
    }
};

const getPaymentByUserID = async (req, res) => {
    const { userID } = req.params;

    try {
        const paymentData = await collectPaymentByUserID(userID);
        if (!paymentData) {
            return res.status(404).json({
                success: false,
                message: 'Aucun paiement trouvé pour cet utilisateur'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Paiements récupérés avec succès',
            paymentData: paymentData
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des paiements :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayer plus tard'
        });
    };
};

const getPayments = async (req, res) => {
    try {
        const paymentData = await collectPayments();
        if (!paymentData) {
            return res.status(404).json({
                success: false,
                message: 'Aucun paiement trouvé'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Paiements récupérés avec succès',
            paymentData: paymentData
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des paiements :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayer plus tard'
        });
    };
};

const getPaymentStatus = async (req, res) => {
    try {
        const { allPayments, processingPayments, completedPayments, expiredPayments } = await collectAllPaymentsWithStatus();
        res.status(200).json({
            success: true,
            message: 'Statuts des paiements récupérés avec succès',
            allPayments: allPayments,
            processingPayments: processingPayments,
            completedPayments: completedPayments,
            expiredPayments: expiredPayments
        });
    } catch (error) {

    }
};

const updatePaymentStatus = async (req, res) => {
    const { paymentID } = req.params;
    const { status } = req.body;

    try {
        const updatedPayment = await upgradePaymentStatus(paymentID, status);
        if (!updatedPayment) {
            return res.status(404).json({
                success: false,
                message: 'Paiement non trouvé'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Statut du paiement mis à jour avec succès',
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut du paiement :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayer plus tard'
        });
    };
};

const getProcessingPayments = async (req, res) => {
    try {
        const processingPayments = await collectProcessingPayments();
        if (!processingPayments) {
            return res.status(404).json({
                success: false,
                message: 'Aucun paiement en cours de traitement trouvé'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Paiements en cours de traitement récupérés avec succès',
            processingPayments: processingPayments
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des paiements en cours de traitement :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayer plus tard'
        });
    };
};

const getCompletedPayments = async (req, res) => {
    try {
        const completedPayments = await collectCompletedPayments();
        if (!completedPayments) {
            return res.status(404).json({
                success: false,
                message: 'Aucun paiement terminé trouvé'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Paiements terminés récupérés avec succès',
            completedPayments: completedPayments
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des paiements terminés :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayer plus tard'
        });
    };
};

const getFailedPayments = async (req, res) => {
    try {
        const failedPayments = await collectFailedPayments();
        if (!failedPayments) {
            return res.status(404).json({
                success: false,
                message: 'Aucun paiement en échec trouvé'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Paiements en échec récupérés avec succès',
            failedPayments: failedPayments
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des paiements en échec :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayer plus tard'
        });
    };
};

const fetchAccounts = async (req, res) => {
    const { selectedMethod, selectedProvider } = req.params; 

    if (!selectedMethod || !selectedProvider) {
        return res.status(400).json({
            success: false,
            message: 'Méthode de paiement et fournisseur requis'
        });
    }

    try {
        const accounts = await fetchPaymentAccounts(selectedMethod, selectedProvider);
        if (!accounts) {
            return res.status(404).json({
                success: false,
                message: 'Aucun compte de paiement trouvé'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Comptes de paiement récupérés avec succès',
            accounts: accounts
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des comptes de paiement :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayer plus tard'
        });
    }
}

const createPaymentAccount = async (req, res) => {
    const { paymentMethod, provider, accountNumber, ownerName, priority, isActive } = req.body;

    // Validate required fields
    if (!paymentMethod || !provider || !accountNumber) {
        return res.status(400).json({
            success: false,
            message: "Les champs méthode de paiement, fournisseur et numéro de compte sont obligatoires"
        });
    }

    try {
        const newPaymentAccount = await createNewPaymentAccount(paymentMethod, provider, accountNumber, ownerName, priority, isActive);
        if (!newPaymentAccount) {
            return res.status(400).json({
                success: false,
                message: 'Erreur lors de la création du compte de paiement'
            });
        }
        res.status(201).json({
            success: true,
            message: 'Compte de paiement créé avec succès',
        });
    } catch (error) {
        console.error('Erreur lors de la création du compte de paiement :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayer plus tard'
        });
    }
};

const deletePaymentAccount = async (req, res) => {
    const { accountID } = req.params;

    if (!accountID) {
        return res.status(400).json({
            success: false,
            message: 'ID du compte de paiement requis'
        });
    }

    try {
        const deletedAccount = await deletePaymentAccountByID(accountID);
        if (!deletedAccount) {
            return res.status(404).json({
                success: false,
                message: 'Compte de paiement non trouvé'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Compte de paiement supprimé avec succès',
        });
    } catch (error) {
        console.error('Erreur lors de la suppression du compte de paiement :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayer plus tard'
        });
    }
}

const togglePaymentAccountStatus = async (req, res) => {
    const { accountID } = req.params; 
    const { isActive } = req.body;

    if (!accountID) {
        return res.status(400).json({
            success: false,
            message: 'ID du compte de paiement requis'
        });
    }

    try {
       const  updatedAccount = await togglePaymentAccountStatusByID(accountID, isActive); 
       if (!updatedAccount) {
            return res.status(404).json({
                success: false,
                message: 'Compte de paiement non trouvé'
            });
        }
        res.status(200).json({
            success: true,
            message: isActive ? "Compte activé avec succès" : "Compte désactivé avec succès"
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut du compte de paiement :', error);
        res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayer plus tard'
        });
    }
}

module.exports = {
    createPaymentAccount,
    deletePaymentAccount,
    togglePaymentAccountStatus,
    fetchAccounts,
    getPaymentStatus,
    getPaymentByUserID,
    createPaymentIntent,
    getPayments,
    getCompletedPayments,
    getFailedPayments,
    getProcessingPayments,
    updatePaymentStatus,
};
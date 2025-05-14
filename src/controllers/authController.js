const { auth } = require("../config/firebase-admin");
const {
    createUser,
    signinUser,
    logoutUser,
    deletionUser,
    verifyCode,
    updatePassword,
    addNewAdmin,
    authorizeDevice,
    desableDevice,
    disableUser,
    restoreUser,
    requestPasswordResetEmail,
    verifyResetTokenValidity,
    verifyPasswordResetToken,
    deletePasswordResetToken
} = require("../firebase/auth");
const { checkIfPhoneNumberExists, checkIfEmailExists } = require("../func");
const { verifyCaptcha } = require("../middlewares/authMiddleware");
const { getFirebaseErrorMessage } = require("../utils/firebaseErrorHandler");


const registerUser = async (req, res) => {
    const { address, city, country, email, password, firstName, lastName, phoneNumber, displayName, captchaToken } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !phoneNumber) {
        return res.status(400).json({
            success: false,
            message: "Veuillez remplir tous les champs obligatoires"
        });
    }

    const phoneAlreadyExists = await checkIfPhoneNumberExists(phoneNumber);
    if (phoneAlreadyExists) {
        return res.status(400).json({
            success: false,
            message: 'Le numéro de téléphone est déjà associé à un compte. Veuillez vous connecter ou utiliser un autre numéro de téléphone.'
        });
    }

    const emailAlreadyExists = await checkIfEmailExists(email);
    if (emailAlreadyExists) {
        return res.status(400).json({
            success: false,
            message: 'L\'adresse e-mail est déjà associée à un compte. Veuillez vous connecter ou utiliser un autre e-mail.'
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
        const newUser = await createUser(address, city, country, email, password, firstName, lastName, phoneNumber, displayName, captchaToken);
        if (!newUser) {
            return res.status(400).json({
                success: false,
                message: 'Une erreur est survenue lors de la création de votre compte. Veuillez réessayer plus tard.'
            });
        };

        res.status(200).json({
            success: true,
            message: 'Votre compte a été créé avec succès. Veuillez vérifier votre adresse e-mail pour confirmer votre compte.'
        });
    } catch (error) {
        const errorMessage = getFirebaseErrorMessage(error);
        console.error('Erreur lors de la création de l\'utilisateur :', error);
        return res.status(500).json({
            success: false,
            error: errorMessage,
            message: 'Une erreur est survenue lors de la création de votre compte. Veuillez réessayer plus tard.'
        });
    }
};

const loginUser = async (req, res) => {
    const { userID, deviceInfo, captchaToken } = req.body;
    console.log(deviceInfo);

    if (!userID) {
        return res.status(400).json({
            success: false,
            message: "Données incomplètes. Veuillez fournir l'identifiant.",
        });
    }

    // Verify the captcha token with Google
    if (!captchaToken) {
        return res.status(400).json({
            success: false,
            message: "Vérification CAPTCHA requise"
        });
    }

    try {
        // Verify the captcha token with Google's API
        const captchaVerification = await verifyCaptcha(captchaToken);
        if (!captchaVerification.success) {
            return res.status(400).json({
                success: false,
                message: "Échec de la vérification CAPTCHA"
            });
        }

        const signInResult = await signinUser(userID, deviceInfo);

        if (!signInResult.success) {
            return res.status(400).json({
                success: false,
                message: signInResult.message || "Échec de la connexion.",
            });
        }

        res.status(200).json({
            success: true,
            message: signInResult.message,
            role: signInResult.role,
        });

    } catch (error) {
        console.error('❌ Erreur lors de la connexion de l\'utilisateur :', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard.',
        });
    }
};

const loginAdmin = async (req, res) => {
    const { userID, deviceInfo } = req.body;
    console.log('Device Info:', deviceInfo);

    try {
        const signInResult = await signinUser(userID, deviceInfo);
        if (!signInResult || !signInResult.success) {
            return res.status(400).json({
                success: false,
                message: signInResult?.message || "Échec de la connexion.",
            });
        }
        res.status(200).json({
            success: signInResult.success,
            message: signInResult.message,
            status: signInResult.status,
        });
    } catch (error) {
        const errorMessage = getFirebaseErrorMessage(error);
        console.error('Erreur lors de la connexion de l\'administrateur :', error);
        return res.status(500).json({
            success: false,
            error: errorMessage,
            message: 'Erreur technique, réessayez plus tard.'
        });
    };
};

const signoutUser = async (req, res) => {
    const { userID } = req.user;
    try {
        if (!userID) {
            return res.status(401).json({
                success: false,
                message: "Utilisateur non authentifié.",
            });
        }

        console.log(`🟡 Tentative de déconnexion pour : ${userID}`);

        const isSignedOut = await logoutUser(userID);
        console.log(`🔹 isSignedOut: ${isSignedOut}`); // Voir la valeur retournée

        if (!isSignedOut) {
            console.error(`❌ Erreur lors de la déconnexion de ${userID}`);
            return res.status(400).json({
                success: false,
                message: "Erreur lors de la déconnexion ou utilisateur introuvable.",
            });
        }

        console.log(`✅ Réponse envoyée : Déconnexion réussie`);
        res.status(200).json({
            success: true,
            message: "Déconnexion réussie. À bientôt !",
        });

    } catch (error) {
        console.error("❌ Erreur dans `signoutUser` :", error.message);
        return res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard.",
            error: error.message,
        });
    }
};

const deleteUser = async (req, res) => {
    const { userID } = req.body;

    try {
        const isDeleted = await deletionUser(userID);
        if (!isDeleted) {
            return res.status(400).json({
                success: false,
                message: 'L\'utilisateur n\'a pas été trouvé ou n\'a pas encore vérifié son email.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Votre compte a été supprimé avec succès.',
        });
    } catch (error) {
        const errorMessage = getFirebaseErrorMessage(error);
        console.error('Erreur lors de la suppression de l\'utilisateur :', error);
        return res.status(500).json({
            success: false,
            error: errorMessage,
            message: 'Erreur technique, réessayez plus tard.'
        });
    }
};

const disableUserAccount = async (req, res) => {
    const { userID } = req.body;

    try {
        const isDisabled = await disableUser(userID);
        if (!isDisabled) {
            return res.status(400).json({
                success: false,
                message: 'L\'utilisateur n\'a pas été trouvé ou n\'a pas encore vérifié son email.'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Votre compte a été désactivé avec succès.'
        });
    } catch (error) {
        console.error('Erreur lors de la désactivation de l\'utilisateur :', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard.'
        });
    }
};

const restoreUserAccount = async (req, res) => {
    const { userID } = req.body;

    try {
        const isRestored = await restoreUser(userID);
        if (!isRestored) {
            return res.status(400).json({
                success: false,
                message: 'L\'utilisateur n\'a pas été trouvé ou n\'a pas encore vérifié son email.'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Votre compte a été restauré avec succès.'
        });
    } catch (error) {
        console.error('Erreur lors de la restauration de l\'utilisateur :', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard.'
        });
    }
};

const verifyOTPCode = async (req, res) => {
    const { email, code } = req.body;

    try {
        const isVerified = await verifyCode(email, code);
        if (!isVerified) {
            return res.status(400).json({
                success: false,
                message: 'Code incorrect ou expiré'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Code vérifié avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la vérification du code OTP :', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur technique, réessayez plus tard.'
        });
    };
};

const changePassword = async (req, res) => {
    const { email, newPassword, token, captchaToken } = req.body;

    console.log('Received data:', req.body);

    if (!email || !newPassword || !token || !captchaToken) {
        return res.status(400).json({
            success: false,
            message: 'Tous les champs sont obligatoires'
        });
    }

    // Verify CAPTCHA token with Google's API
    const captchaVerification = await verifyCaptcha(captchaToken);
    if (!captchaVerification.success) {
        return res.status(400).json({
            success: false,
            message: "Échec de la vérification CAPTCHA"
        });
    }

    try {
        // First, verify the reset token is valid and matches the email
        const tokenValid = await verifyPasswordResetToken(email, token);
        if (!tokenValid) {
            return res.status(400).json({
                success: false,
                message: 'Lien de réinitialisation invalide ou expiré'
            });
        }

        const isChanged = await updatePassword(email, newPassword, token);
        if (!isChanged) {
            return res.status(400).json({
                success: false,
                message: 'Mot de passe incorrect ou expiré'
            });
        };

        // Delete the used token to prevent reuse
        await deletePasswordResetToken(email, token);

        res.status(200).json({
            success: true,
            message: 'Mot de passe modifié avec succès'
        });
    } catch (error) {
        const errorMessage = getFirebaseErrorMessage(error);
        console.error('Erreur lors de la modification du mot de passe :', error);
        return res.status(500).json({
            success: false,
            error: errorMessage,
            message: 'Erreur technique, réessayez plus tard.'
        });
    };
};

const createNewAdmin = async (req, res) => {
    const { displayName, firstName, lastName, email, phoneNumber, password, permissions, address, city, country, captchaToken } = req.body;

    if (!displayName || !firstName || !lastName || !email || !phoneNumber || !password || !permissions || !address || !city || !country || !captchaToken) {
        return res.status(400).json({
            success: false,
            message: 'Tous les champs sont obligatoires'
        });
    }

    // Verify CAPTCHA token with Google's API
    const captchaVerification = await verifyCaptcha(captchaToken);
    if (!captchaVerification.success) {
        return res.status(400).json({
            success: false,
            message: "Échec de la vérification CAPTCHA"
        });
    }

    try {
        const isAdminCreated = await addNewAdmin(displayName, firstName, lastName, email, phoneNumber, password, permissions, address, city, country, captchaToken);
        if (!isAdminCreated) {
            return res.status(400).json({
                success: false,
                message: 'L\'administrateur n\'a pas été créé'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Administrateur créé avec succès'
        });
    } catch (error) {
        const errorMessage = getFirebaseErrorMessage(error);
        console.error('Erreur lors de la création du nouvel administrateur :', error);
        return res.status(500).json({
            success: false,
            error: errorMessage,
            message: 'Erreur technique, réessayez plus tard.'
        });
    };
};

const requestPasswordReset = async (req, res) => {
    const { email, captchaToken } = req.body;

    // Validate required fields
    if (!email || !captchaToken) {
        return res.status(400).json({
            success: false,
            message: "Email et vérification CAPTCHA requis"
        });
    }

    // Verify CAPTCHA token with Google's API
    const captchaVerification = await verifyCaptcha(captchaToken);
    if (!captchaVerification.success) {
        return res.status(400).json({
            success: false,
            message: "Échec de la vérification CAPTCHA"
        });
    }

    // Check if user exists in Firebase Authentication
    const userRecord = await auth.getUserByEmail(email);
    if (!userRecord) {
        return res.status(404).json({
            success: false,
            message: "Utilisateur non trouvé"
        });
    }

    try {
        const isPasswordResetRequested = await requestPasswordResetEmail(email);
        if (!isPasswordResetRequested) {
            return res.status(400).json({
                success: false,
                message: 'La demande de réinitialisation du mot de passe a échoué'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Demande de réinitialisation du mot de passe envoyée avec succès'
        });
    } catch (error) {
        console.error("Erreur lors de la demande de réinitialisation du mot de passe:", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    }
};

const verifyResetToken = async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "Token manquant"
        });
    }

    try {
        const isTokenValid = await verifyResetTokenValidity(token);
        if (!isTokenValid) {
            return res.status(400).json({
                success: false,
                message: "Token invalide ou expiré"
            });
        }
        res.status(200).json({
            success: true,
            message: "Token valide",
            email: isTokenValid.email
        });
    } catch (error) {
        console.error("Erreur lors de la vérification du token:", error);
        res.status(500).json({
            success: false,
            message: "Erreur technique, réessayez plus tard"
        });
    }
};

const validateDevice = async (req, res) => {
    const { deviceID } = req.params;
    const { verificationToken } = req.body;
    const { userID } = req.user;

    try {
        const isDeviceValidated = await authorizeDevice(deviceID, verificationToken, userID);
        if (!isDeviceValidated) {
            return res.status(400).json({
                success: false,
                message: 'Le dispositif n\'a pas été validé'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Le dispositif a été validé avec succès'
        });
    } catch (error) {
        const errorMessage = getFirebaseErrorMessage(error);
        console.error('Erreur lors de la validation du dispositif :', error);
        return res.status(500).json({
            success: false,
            error: errorMessage,
            message: 'Erreur technique, réessayez plus tard.'
        });
    };
};

const refuseDevice = async (req, res) => {
    const { deviceID } = req.params;
    const { verificationToken } = req.body;
    const { userID } = req.user;

    try {
        const isDeviceRefused = await desableDevice(deviceID, verificationToken, userID);
        if (!isDeviceRefused) {
            return res.status(400).json({
                success: false,
                message: 'Le dispositif n\'a pas été refusé'
            });
        };
        res.status(200).json({
            success: true,
            message: 'Le dispositif a été refusé avec succès'
        });
    } catch (error) {
        const errorMessage = getFirebaseErrorMessage(error);
        console.error('Erreur lors de la validation du dispositif :', error);
        return res.status(500).json({
            success: false,
            error: errorMessage,
            message: 'Erreur technique, réessayezz plus tard.'
        });
    }
};


module.exports = {
    changePassword,
    createNewAdmin,
    requestPasswordReset,
    registerUser,
    loginAdmin,
    loginUser,
    signoutUser,
    deleteUser,
    disableUserAccount,
    restoreUserAccount,
    refuseDevice,
    validateDevice,
    verifyOTPCode,
    verifyResetToken,
};
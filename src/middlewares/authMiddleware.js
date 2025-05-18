const { setAuthCookie, clearCookie } = require('../config/cookies');
const { auth, firestore } = require('../config/firebase-admin');
const jwt = require('jsonwebtoken');

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Token manquant ou invalide'
            });
        }

        const token = authHeader.split(' ')[1];
        const decodedToken = await auth.verifyIdToken(token);

        req.user = {
            userID: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified,
        };

        next();
    } catch (error) {
        console.error('Erreur lors de la vérification du token:', error);
        return res.status(403).json({
            success: false,
            message: 'Accès refusé: token invalide ou expiré'
        });
    }
};

// Helper function to verify captcha with Google
const verifyCaptcha = async (token) => {
    try {
        const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

        const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`
        });

        const data = await response.json();

        return {
            success: data.success,
            score: data.score, // Only available in v3
            action: data.action, // Only available in v3
            timestamp: data.challenge_ts,
            hostname: data.hostname
        };
    } catch (error) {
        console.error('Error verifying captcha:', error);
        return { success: false };
    }
};

// Check Auth
const checkAuth = async (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Token non fourni.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;  // Stocker les informations décodées pour les utiliser dans les routes
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token invalide.' });
    }
};


// Check Admin Role
const checkAdminRole = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decodedToken = await auth.verifyIdToken(token);

        const userDoc = await firestore.collection('USERS').doc(decodedToken.uid).get();
        const userData = userDoc.data();

        if (userData.role === 'admin') {
            next(); // L'utilisateur est admin, continuer
        } else {
            res.status(403).json({
                success: false,
                message: 'Accès refusé : Vous n\'êtes pas administrateur.'
            });
        }
    } catch (error) {
        console.error('Erreur lors de la vérification du rôle admin:', error);
        res.status(401).json({
            success: false,
            message: 'Utilisateur non authentifié ou rôle non autorisé.'
        });
    }
};

// Check User Role
const checkUserRole = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decodedToken = await auth.verifyIdToken(token);

        const userDoc = await firestore.collection('USERS').doc(decodedToken.uid).get();
        const userData = userDoc.data();

        if (userData.role === 'user') {
            next(); // L'utilisateur est user, continuer
        } else {
            res.status(403).json({
                success: false,
                message: 'Accès refusé : Vous n\'êtes pas utilisateur.'
            });
        }
    } catch (error) {
        console.error('Erreur lors de la vérification du rôle user:', error);
        res.status(401).json({
            success: false,
            message: 'Utilisateur non authentifié ou rôle non autorisé.'
        });
    }
};

const authenticateUser = async (req, res, next) => {

    try {
        // Vérifier d'abord si le token est dans les cookies
        const cookieToken = req.cookies ? req.cookies.authToken : undefined;

        // Sinon, vérifier l'en-tête Authorization
        const authHeader = req.headers.authorization;
        let idToken = cookieToken;

        if (!idToken && authHeader && authHeader.startsWith('Bearer ')) {
            idToken = authHeader.split('Bearer ')[1];
        }

        if (!idToken) {
            return res.status(401).json({
                success: false,
                message: 'Accès non autorisé'
            });
        }

        // Vérifier le token avec Firebase Auth
        const decodedToken = await auth.verifyIdToken(idToken);

        // Définir ou rafraîchir le cookie si le token est valide
        setAuthCookie(res, idToken);

        // Stocker les informations utilisateur dans l'objet request
        req.user = decodedToken;

        // Pour les endpoints spécifiques à l'utilisateur, vérifier que l'utilisateur accède à ses propres données
        if (req.params.userID && req.params.userID !== decodedToken.uid) {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé à ces données'
            });
        }

        next();
    } catch (error) {
        console.error('Erreur d\'authentification:', error);

        // Supprimer le cookie en cas d'erreur d'authentification
        clearCookie(res);

        res.status(401).json({
            success: false,
            message: 'Accès non autorisé'
        });
    }
};

// For admin-only endpoints
const authenticateAdmin = async (req, res, next) => {
    try {
        // First authenticate the user
        await authenticateUser(req, res, async () => {
            // Then check if they have admin role
            const userRef = firestore.collection('USERS').doc(req.user.uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists || userDoc.data().role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Accès administrateur requis'
                });
            }

            next();
        });
    } catch (error) {
        console.error('Erreur d\'authentification admin:', error);
        res.status(401).json({
            success: false,
            message: 'Accès non autorisé'
        });
    }
};

const verifyAuthToken = async (req, res, next) => {
    const token = req.cookies.authToken;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Aucun token fourni.' });
    }

    try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Erreur de vérification du token Firebase :', error);
        res.status(401).json({ success: false, message: 'Token invalide ou expiré.' });
    }
}


module.exports = {
    checkAuth,
    checkAdminRole,
    checkUserRole,
    verifyToken,
    verifyCaptcha,
    authenticateUser,
    authenticateAdmin,
    verifyAuthToken
};
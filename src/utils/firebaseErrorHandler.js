const firebaseAuthErrorMessages = {
    // Firebase error codes and user-friendly messages
    'auth/invalid-email': 'L’adresse e-mail est invalide.',
    'auth/email-already-exists': 'Un compte avec cet e-mail existe déjà.',
    'auth/invalid-password': 'Le mot de passe doit contenir au moins 6 caractères.',
    'auth/user-not-found': 'Aucun utilisateur trouvé avec cet e-mail.',
    'auth/wrong-password': 'Le mot de passe est incorrect.',
    'auth/too-many-requests': 'Trop de tentatives échouées. Veuillez réessayer plus tard.',
    // Default fallback
    default: 'Une erreur est survenue. Veuillez réessayer.',
};


function getFirebaseErrorMessage(code) {
    return firebaseAuthErrorMessages[code] || firebaseAuthErrorMessages.default;
};


module.exports = { getFirebaseErrorMessage };
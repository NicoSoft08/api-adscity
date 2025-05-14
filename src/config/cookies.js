

const setAuthCookie = async (res, token) => {
    // En développement local, ne pas spécifier de domaine
    const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    };

    // En production, ajouter le domaine
    if (process.env.NODE_ENV === 'production') {
        cookieOptions.domain = '.adscity.net';
    }

    // Utiliser un nom de cookie approprié, pas le secret JWT
    res.cookie('authToken', token, cookieOptions);
};

const clearCookie = (res) => {
    // Les options doivent correspondre à celles utilisées pour définir le cookie
    const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/',
    };

    // En production, ajouter le domaine
    if (process.env.NODE_ENV === 'production') {
        cookieOptions.domain = '.adscity.net';
    }

    // Utiliser le même nom de cookie que celui défini
    res.clearCookie('authToken', cookieOptions);
};

module.exports = {
    clearCookie,
    setAuthCookie,
};
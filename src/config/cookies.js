const isProduction = process.env.NODE_ENV === 'production';

const setAuthCookie = async (res, token) => {
    const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: isProduction ? 'None' : 'Lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    };

    if (isProduction) {
        cookieOptions.domain = '.adscity.net';
    }


    // Utiliser un nom de cookie approprié, pas le secret JWT
    res.cookie('authToken', token, cookieOptions);
};

const clearCookie = (res) => {
    const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: isProduction ? 'None' : 'Lax',
        path: '/',
    };

    if (isProduction) {
        cookieOptions.domain = '.adscity.net';
    }

    // Utiliser le même nom de cookie que celui défini
    res.clearCookie('authToken', cookieOptions);
};

module.exports = {
    clearCookie,
    setAuthCookie,
};
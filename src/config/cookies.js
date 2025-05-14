

const setAuthCookie = async (res, token) => {
    const cookieOptions = {
        httpOnly: true,
        secure: true,
        domain: '.adscity.net',
        sameSite: 'None',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    };


    // Utiliser un nom de cookie approprié, pas le secret JWT
    res.cookie('authToken', token, cookieOptions);
};

const clearCookie = (res) => {
    const cookieOptions = {
        httpOnly: true,
        secure: true,
        domain: '.adscity.net',
        sameSite: 'None',
        path: '/',
    };

    // Utiliser le même nom de cookie que celui défini
    res.clearCookie('authToken', cookieOptions);
};

module.exports = {
    clearCookie,
    setAuthCookie,
};
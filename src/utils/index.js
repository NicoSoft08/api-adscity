const logActivity = (title, time, description, type, userID) => {
    const activity = {
        title: title,
        time: time,
        description: description,
        type: type,
        userID: userID,
    };
};


module.exports = {
    logActivity,
};
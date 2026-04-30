const activeUsers = new Map(); // Map of socket.id -> userId

const addPresence = (socketId, userId) => {
    activeUsers.set(socketId, userId);
};

const removePresence = (socketId) => {
    activeUsers.delete(socketId);
};

const getActiveUserIds = () => {
    return Array.from(new Set(activeUsers.values()));
};

const getActiveCount = () => {
    return getActiveUserIds().length;
};

module.exports = {
    addPresence,
    removePresence,
    getActiveUserIds,
    getActiveCount
};

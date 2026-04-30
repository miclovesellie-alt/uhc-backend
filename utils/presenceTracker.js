const activeUsers = new Map(); // Map of socket.id -> userId
const lastSeen = new Map();    // Map of userId -> Date.now() timestamp

const addPresence = (socketId, userId) => {
    activeUsers.set(socketId, userId);
    lastSeen.set(userId, Date.now());
};

const removePresence = (socketId) => {
    const userId = activeUsers.get(socketId);
    if (userId) {
        lastSeen.set(userId, Date.now()); // Mark exact time of disconnect
    }
    activeUsers.delete(socketId);
};

const getActiveUserIds = () => {
    return Array.from(new Set(activeUsers.values()));
};

const getActiveCount = () => {
    return getActiveUserIds().length;
};

const getRecentlyActiveUserIds = (minutes = 3) => {
    const now = Date.now();
    const threshold = minutes * 60 * 1000;
    const recent = [];
    
    // currently connected
    const currentlyActive = new Set(activeUsers.values());
    
    // those who were seen recently
    for (const [userId, timestamp] of lastSeen.entries()) {
        if (!currentlyActive.has(userId) && (now - timestamp) <= threshold) {
            recent.push(userId);
        }
    }
    
    return recent;
};

module.exports = {
    addPresence,
    removePresence,
    getActiveUserIds,
    getActiveCount,
    getRecentlyActiveUserIds
};

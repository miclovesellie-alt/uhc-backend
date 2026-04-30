const UserNotification = require('../models/UserNotification');
const User = require('../models/User');

let io;
const setIO = (_io) => { io = _io; };

/**
 * Send a notification to a specific user.
 */
const notifyUser = async (userId, message, type = 'INFO', actionLink = null) => {
    try {
        const notif = await UserNotification.create({
            recipient: userId,
            message,
            type,
            actionLink
        });

        if (io) {
            // Emits to all sockets. We will attach the userId in the payload.
            // On the frontend, the client will only process it if it matches their own ID.
            io.emit('USER_NOTIFICATION', {
                _id: notif._id,
                recipientId: userId,
                message: notif.message,
                type: notif.type,
                actionLink: notif.actionLink,
                createdAt: notif.createdAt
            });
        }
    } catch (err) {
        console.error('Error notifying user:', err);
    }
};

/**
 * Broadcast a notification to ALL users (e.g., for a new announcement).
 */
const broadcastToAllUsers = async (message, type = 'POST', actionLink = null) => {
    try {
        // Find all active standard users
        const users = await User.find({ role: 'user', status: 'active' }).select('_id');
        
        // Bulk insert notifications
        const notifs = users.map(u => ({
            recipient: u._id,
            message,
            type,
            actionLink
        }));
        
        if (notifs.length > 0) {
            await UserNotification.insertMany(notifs);
        }

        if (io) {
            // Emit a global user notification that the frontend knows applies to everyone
            io.emit('USER_NOTIFICATION', {
                broadcast: true,
                message,
                type,
                actionLink,
                createdAt: new Date()
            });
        }
    } catch (err) {
        console.error('Error broadcasting to users:', err);
    }
};

module.exports = { notifyUser, broadcastToAllUsers, setIO };

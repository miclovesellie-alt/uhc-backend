const UserNotification = require('../models/UserNotification');
const User = require('../models/User');

let io;
const setIO = (_io) => { io = _io; };

// ── Inactive threshold (days without login = "inactive") ──
const INACTIVE_DAYS = 7;

/**
 * Build a Mongoose query filter for the requested audience.
 * @param {"all"|"active"|"inactive"} audience
 */
function audienceFilter(audience) {
  const base = {
    status: 'active',
    role:   { $in: ['user', 'tutor', 'health_worker'] },
  };
  if (audience === 'active') {
    const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
    base.lastLogin = { $gte: cutoff };
  } else if (audience === 'inactive') {
    const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
    base.$or = [{ lastLogin: { $lt: cutoff } }, { lastLogin: null }];
  }
  // "all" → no extra filter beyond base
  return base;
}

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
        const users = await User.find({ role: 'user', status: 'active' }).select('_id');
        
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

/**
 * Broadcast a notification to a specific audience segment.
 * @param {"all"|"active"|"inactive"} audience
 * @param {string} message
 * @param {string} type
 * @param {string|null} actionLink
 * @returns {Promise<number>} number of users notified
 */
const broadcastToAudience = async (audience, message, type = 'POST', actionLink = null) => {
    try {
        const filter = audienceFilter(audience);
        const users  = await User.find(filter).select('_id').lean();

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
            io.emit('USER_NOTIFICATION', {
                broadcast: true,
                message,
                type,
                actionLink,
                createdAt: new Date()
            });
        }

        return users.length;
    } catch (err) {
        console.error('Error broadcasting to audience:', err);
        return 0;
    }
};

/**
 * Count users matching an audience segment (for preview).
 * @param {"all"|"active"|"inactive"} audience
 * @returns {Promise<number>}
 */
const countAudience = async (audience) => {
    try {
        return await User.countDocuments(audienceFilter(audience));
    } catch {
        return 0;
    }
};

module.exports = { notifyUser, broadcastToAllUsers, broadcastToAudience, countAudience, setIO };

const AdminLog = require('../models/AdminLog');
const AdminNotification = require('../models/AdminNotification');
const User = require('../models/User');

/**
 * Log an administrative action and notify all other admins.
 * 
 * @param {string} adminId - ID of the admin performing the action
 * @param {string} action - Action identifier (e.g. 'DELETE_BOOK')
 * @param {string} message - Human readable message for the notification
 * @param {Object} targetInfo - Info about the target (type, id, etc)
 */
const createAdminActivity = async (adminId, action, message, targetInfo = {}) => {
    try {
        // 1. Create the Log
        const log = new AdminLog({
            admin: adminId,
            action: action,
            targetType: targetInfo.type || 'system',
            targetId: targetInfo.id,
            details: targetInfo.details || {}
        });
        await log.save();

        // 2. Create the Notification for all other admins
        const admins = await User.find({ 
            role: { $in: ['admin', 'superadmin'] },
            _id: { $ne: adminId } 
        });

        // We create a single broadcast notification
        // Note: recipient is null for broadcast, but we can track read status in readBy array
        const notification = new AdminNotification({
            sender: adminId,
            recipient: null, // broadcast
            message: message,
            type: targetInfo.notifType || 'INFO'
        });
        await notification.save();

        return { log, notification };
    } catch (err) {
        console.error('Error in createAdminActivity:', err);
    }
};

module.exports = { createAdminActivity };

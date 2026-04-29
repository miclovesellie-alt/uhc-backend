const AdminLog = require('../models/AdminLog');
const AdminNotification = require('../models/AdminNotification');
const User = require('../models/User');

let io;
const setIO = (_io) => { io = _io; };

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

        // 3. Emit real-time notification
        if (io) {
            io.emit('ADMIN_NOTIFICATION', {
                _id: notification._id,
                message: notification.message,
                type: notification.type,
                createdAt: notification.createdAt,
                senderName: (await User.findById(adminId))?.name || 'Admin'
            });
        }

        return { log, notification };
    } catch (err) {
        console.error('Error in createAdminActivity:', err);
    }
};

/**
 * Notify admins of a user-initiated activity.
 * 
 * @param {string} userId - ID of the user performing the action
 * @param {string} message - Human readable message
 * @param {string} type - Notification type (INFO, WARNING, DANGER)
 */
const createUserActivityNotification = async (userId, message, type = 'INFO') => {
    try {
        const notification = new AdminNotification({
            sender: userId, // User is the sender in this context
            recipient: null, // broadcast to all admins
            message: message,
            type: type
        });
        await notification.save();

        // Emit real-time notification
        if (io) {
            io.emit('ADMIN_NOTIFICATION', {
                _id: notification._id,
                message: notification.message,
                type: notification.type,
                createdAt: notification.createdAt,
                senderName: (await User.findById(userId))?.name || 'User'
            });
        }

        return notification;
    } catch (err) {
        console.error('Error in createUserActivityNotification:', err);
    }
};

module.exports = { createAdminActivity, createUserActivityNotification, setIO };

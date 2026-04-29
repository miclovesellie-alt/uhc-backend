const AdminLog = require('../models/AdminLog');
const AdminNotification = require('../models/AdminNotification');
const User = require('../models/User');

let io;
const setIO = (_io) => { io = _io; };

/**
 * Log an administrative action and notify all admins.
 * Now every log also creates a notification.
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

        // 2. Create the Notification for all admins
        // We include the performing admin in the notification so everyone sees the full history
        const notification = new AdminNotification({
            sender: adminId,
            recipient: null, // broadcast
            message: `${action.replace(/_/g, ' ')}: ${message}`,
            type: targetInfo.notifType || 'INFO'
        });
        await notification.save();

        // 3. Emit real-time notification
        if (io) {
            const sender = await User.findById(adminId).select('name');
            io.emit('ADMIN_NOTIFICATION', {
                _id: notification._id,
                message: notification.message,
                type: notification.type,
                createdAt: notification.createdAt,
                senderName: sender?.name || 'Admin'
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
            sender: userId, 
            recipient: null, 
            message: message,
            type: type
        });
        await notification.save();

        // Emit real-time notification
        if (io) {
            const sender = await User.findById(userId).select('name');
            io.emit('ADMIN_NOTIFICATION', {
                _id: notification._id,
                message: notification.message,
                type: notification.type,
                createdAt: notification.createdAt,
                senderName: sender?.name || 'User'
            });
        }

        return notification;
    } catch (err) {
        console.error('Error in createUserActivityNotification:', err);
    }
};

module.exports = { createAdminActivity, createUserActivityNotification, setIO };

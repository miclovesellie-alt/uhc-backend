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
 * Log user activity and notify admins.
 * 
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Action identifier (e.g. 'USER_LOGIN')
 * @param {string} message - Human readable message
 * @param {string} type - Notification type (INFO, WARNING, DANGER)
 */
const createUserActivityLog = async (userId, action, message, type = 'INFO') => {
    try {
        // 1. Create the Log (reuse AdminLog schema for all activity feed)
        const log = new AdminLog({
            admin: userId, // We reuse the admin reference to point to the user
            action: action,
            targetType: 'user',
            targetId: userId,
            details: {}
        });
        await log.save();

        // 2. Create Notification
        const notification = new AdminNotification({
            sender: userId, 
            recipient: null, 
            message: `${action.replace(/_/g, ' ')}: ${message}`,
            type: type
        });
        await notification.save();

        // 3. Emit real-time notification
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

        return { log, notification };
    } catch (err) {
        console.error('Error in createUserActivityLog:', err);
    }
};

module.exports = { createAdminActivity, createUserActivityNotification, createUserActivityLog, setIO };

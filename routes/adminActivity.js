const express = require('express');
const router = express.Router();
const AdminLog = require('../models/AdminLog');
const AdminNotification = require('../models/AdminNotification');
const { authMiddleware, adminOnly } = require('../middleware/auth.middleware');

// @desc    Get all admin activity logs
// @route   GET /api/admin/logs
router.get('/logs', authMiddleware, adminOnly, async (req, res) => {
    try {
        const logs = await AdminLog.find()
            .populate('admin', 'name email profilePic')
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch logs' });
    }
});

// @desc    Get all admin notifications
// @route   GET /api/admin/notifications
router.get('/notifications', authMiddleware, adminOnly, async (req, res) => {
    try {
        const notifications = await AdminNotification.find()
            .populate('sender', 'name email profilePic')
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
});

// @desc    Mark notification as read
// @route   PATCH /api/admin/notifications/:id/read
router.patch('/notifications/:id/read', authMiddleware, adminOnly, async (req, res) => {
    try {
        const notification = await AdminNotification.findById(req.params.id);
        if (!notification) return res.status(404).json({ message: 'Notification not found' });

        if (!notification.readBy.includes(req.userId)) {
            notification.readBy.push(req.userId);
            await notification.save();
        }

        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update notification' });
    }
});

module.exports = router;

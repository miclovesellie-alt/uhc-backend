const express = require('express');
const router = express.Router();
const UserNotification = require('../models/UserNotification');
const authMiddleware = require('../middleware/auth');

// @desc    Get current user's notifications
router.get('/', authMiddleware, async (req, res) => {
    try {
        const notifs = await UserNotification.find({ recipient: req.userId })
            .sort({ createdAt: -1 })
            .limit(50); // limit to most recent 50
            
        res.json(notifs);
    } catch (err) {
        console.error('Fetch user notifs error:', err);
        res.status(500).json({ message: 'Server error fetching notifications' });
    }
});

// @desc    Mark all user's notifications as read
router.put('/read-all', authMiddleware, async (req, res) => {
    try {
        await UserNotification.updateMany(
            { recipient: req.userId, read: false },
            { $set: { read: true } }
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update notifications' });
    }
});

// @desc    Mark a single notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
    try {
        const notif = await UserNotification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.userId },
            { $set: { read: true } },
            { new: true }
        );
        
        if (!notif) return res.status(404).json({ message: "Notification not found" });
        
        res.json(notif);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update notification' });
    }
});

module.exports = router;

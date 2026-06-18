const express = require('express');
const router  = express.Router();
const AdminLog           = require('../models/AdminLog');
const AdminNotification  = require('../models/AdminNotification');
const User               = require('../models/User');
const Question           = require('../models/Question');
const { authMiddleware, adminOnly } = require('../middleware/auth.middleware');

/* ── helpers ── */
function todayRange() {
  const s = new Date(); s.setHours(0,0,0,0);
  return { start: s, end: new Date() };
}
function dayRange(daysAgo) {
  const s = new Date(); s.setDate(s.getDate() - daysAgo); s.setHours(0,0,0,0);
  const e = new Date(s); e.setHours(23,59,59,999);
  return { start: s, end: e };
}
const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;

// ───────────────────────────────────────────
// GET /api/admin/daily-summary
// ───────────────────────────────────────────
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { start, end } = todayRange();

    /* ─ fetch all today's logs + populate ─ */
    const todayLogs = await AdminLog.find({ createdAt: { $gte: start, $lte: end } })
      .populate('admin', 'name email role')
      .sort({ createdAt: -1 });

    /* ─ new signups ─ */
    const signupCount = await User.countDocuments({ createdAt: { $gte: start, $lte: end } });
    const newUsers    = await User.find({ createdAt: { $gte: start, $lte: end } })
      .select('name email category country createdAt').sort({ createdAt: -1 }).limit(20);

    /* ─ password resets ─ */
    const resetLogs = todayLogs.filter(l =>
      ['PASSWORD_RESET_REQUEST','PASSWORD_RESET'].includes(l.action));

    /* ─ reported questions ─ */
    const reportedCount   = await Question.countDocuments({ isReported: true, updatedAt: { $gte: start, $lte: end } });
    const reportedDetails = await Question.find({ isReported: true, updatedAt: { $gte: start, $lte: end } })
      .select('question course reportReason updatedAt').limit(15);

    /* ─ user logins: group by userId ─
       Bug 2 fix: use DB count for accurate total (populate can return null
       for deleted users, causing in-memory array to undercount).
       Bug 3 fix: fall back to log.targetId when admin is null after populate. ─ */
    const loginCount = await AdminLog.countDocuments({ action: 'USER_LOGIN', createdAt: { $gte: start, $lte: end } });
    const loginLogs  = todayLogs.filter(l => l.action === 'USER_LOGIN');
    const byUser = {};

    for (const log of loginLogs) {
      // Prefer populated admin object; fall back to targetId for deleted accounts
      const uid  = log.admin?._id?.toString() || log.targetId?.toString();
      if (!uid) continue;
      if (!byUser[uid]) {
        byUser[uid] = {
          user: {
            _id:   uid,
            name:  log.admin?.name  || 'Deleted User',
            email: log.admin?.email || '',
            role:  log.admin?.role  || 'user',
          },
          loginCount: 0,
          loginTimes: [],
          quiz: 0, quizCourses: [], notes: 0, flashcards: 0,
          requestedReset: false,
        };
      }
      byUser[uid].loginCount++;
      byUser[uid].loginTimes.push(log.createdAt);
    }

    /* ─ enrich with activity ─ */
    const activityTypes = ['QUIZ_SUBMITTED','QUIZ_COMPLETE','QUIZ_COMPLETED','NOTE_READ','NOTE_OPENED',
      'STUDY_NOTE_ACCESSED','FLASHCARD_VIEWED','FLASHCARD_OPENED','FLASHCARD_SESSION'];

    for (const log of todayLogs.filter(l => activityTypes.includes(l.action))) {
      // Fall back to targetId when admin is null after populate (Bug 3 fix)
      const uid  = log.admin?._id?.toString() || log.targetId?.toString();
      if (!uid) continue;
      if (!byUser[uid]) {
        byUser[uid] = {
          user: {
            _id:   uid,
            name:  log.admin?.name  || 'Deleted User',
            email: log.admin?.email || '',
            role:  log.admin?.role  || 'user',
          },
          loginCount: 0, loginTimes: [],
          quiz: 0, quizCourses: [], notes: 0, flashcards: 0, requestedReset: false,
        };
      }
      if (log.action.includes('QUIZ')) {
        byUser[uid].quiz++;
        if (log.details?.course) byUser[uid].quizCourses.push(log.details.course);
      } else if (log.action.includes('NOTE')) {
        byUser[uid].notes++;
      } else if (log.action.includes('FLASHCARD')) {
        byUser[uid].flashcards++;
      }
    }

    /* ─ mark reset users ─ */
    for (const log of resetLogs) {
      const uid = log.admin?._id?.toString() || log.targetId?.toString();
      if (uid && byUser[uid]) byUser[uid].requestedReset = true;
    }

    /* ─ fallback: users seen via User.lastLogin but missing from AdminLog ─
       Catches gaps caused by failed log writes (e.g. Google-OAuth login
       where the AdminLog creation silently threw). ─ */
    const loginFallback = await User.find({
      lastLogin: { $gte: start, $lte: end },
      role: { $in: ['user', 'tutor', 'health_worker'] },
    }).select('_id name email role lastLogin').lean();

    for (const u of loginFallback) {
      const uid = u._id.toString();
      if (!byUser[uid]) {
        byUser[uid] = {
          user: { _id: uid, name: u.name, email: u.email, role: u.role },
          loginCount: 1,
          loginTimes: [u.lastLogin],
          quiz: 0, quizCourses: [], notes: 0, flashcards: 0,
          requestedReset: false,
          fromLastLogin: true,   // flag: sourced from User.lastLogin, not AdminLog
        };
      }
    }

    const userActivity = Object.values(byUser);

    /* ─ admin-only logs ─ */
    const adminLogs = todayLogs.filter(l => ['admin','superadmin'].includes(l.admin?.role));
    const adminLoginCount = adminLogs.filter(l => l.action === 'ADMIN_LOGIN').length;

    /* ─ hourly breakdown ─ */
    const hourlyLogins = Array(24).fill(0);
    for (const log of [...loginLogs, ...adminLogs.filter(l => l.action === 'ADMIN_LOGIN')]) {
      hourlyLogins[new Date(log.createdAt).getHours()]++;
    }

    /* ─ yesterday deltas ─ */
    const yr = dayRange(1);
    const [ySign, yLogin, yReset, yReport] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: yr.start, $lte: yr.end } }),
      AdminLog.countDocuments({ action: 'USER_LOGIN', createdAt: { $gte: yr.start, $lte: yr.end } }),
      AdminLog.countDocuments({ action: { $in: ['PASSWORD_RESET_REQUEST','PASSWORD_RESET'] }, createdAt: { $gte: yr.start, $lte: yr.end } }),
      Question.countDocuments({ isReported: true, updatedAt: { $gte: yr.start, $lte: yr.end } }),
    ]);

    /* ─ auto-insights ─ */
    const insights = [];
    if (signupCount > ySign) {
      const pct = ySign > 0 ? Math.round(((signupCount - ySign)/ySign)*100) : 100;
      insights.push({ type: 'positive', text: `Signups ↑ ${pct}% vs yesterday (${signupCount} today, ${ySign} yesterday)` });
    } else if (signupCount < ySign) {
      insights.push({ type: 'warning', text: `Signups ↓ today — ${signupCount} vs ${ySign} yesterday` });
    } else {
      insights.push({ type: 'neutral', text: `Signup pace steady at ${signupCount} today` });
    }
    if (resetLogs.length > 0)
      insights.push({ type: 'warning', text: `${resetLogs.length} password reset request${resetLogs.length>1?'s':''} today — monitor for suspicious activity` });
    if (reportedCount > 0)
      insights.push({ type: 'danger', text: `${reportedCount} question${reportedCount>1?'s':''} reported — review in Questions panel` });
    const peak = hourlyLogins.indexOf(Math.max(...hourlyLogins));
    if (Math.max(...hourlyLogins) > 0)
      insights.push({ type: 'info', text: `Peak login hour: ${peak}:00–${peak+1}:00 (${hourlyLogins[peak]} logins)` });
    if (adminLoginCount > 0)
      insights.push({ type: 'info', text: `${adminLoginCount} admin login${adminLoginCount>1?'s':''} recorded today` });

    res.json({
      date: new Date().toISOString(),
      signups:          { count: signupCount, yesterday: ySign, users: newUsers },
      logins:           { count: loginCount, yesterday: yLogin, unique: userActivity.length },
      passwordResets:   { count: resetLogs.length, yesterday: yReset, details: resetLogs.map(l=>({ user: l.admin?.name||'Unknown', email: l.admin?.email||'', time: l.createdAt, action: l.action })) },
      reportedQuestions:{ count: reportedCount, yesterday: yReport, details: reportedDetails },
      userActivity,
      adminActivity: adminLogs.map(l=>({ admin: l.admin?.name||'Admin', role: l.admin?.role||'admin', action: l.action, message: l.action.replace(/_/g,' '), details: l.details, time: l.createdAt })),
      adminLoginCount,
      hourlyLogins,
      insights,
    });
  } catch (err) {
    console.error('Daily summary error:', err);
    res.status(500).json({ message: 'Failed to load daily summary' });
  }
});

// ───────────────────────────────────────────
// GET /api/admin/daily-summary/analytics
// ───────────────────────────────────────────
router.get('/analytics', authMiddleware, adminOnly, async (req, res) => {
  try {
    const now   = new Date(); now.setHours(0,0,0,0);
    const nowEnd = new Date();

    const [tSign, tLogin, tReset, tReport] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: now, $lte: nowEnd } }),
      AdminLog.countDocuments({ action: 'USER_LOGIN', createdAt: { $gte: now, $lte: nowEnd } }),
      AdminLog.countDocuments({ action: 'PASSWORD_RESET_REQUEST', createdAt: { $gte: now, $lte: nowEnd } }),
      Question.countDocuments({ isReported: true, updatedAt: { $gte: now, $lte: nowEnd } }),
    ]);

    const yr = dayRange(1);
    const [ySign, yLogin, yReset, yReport] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: yr.start, $lte: yr.end } }),
      AdminLog.countDocuments({ action: 'USER_LOGIN', createdAt: { $gte: yr.start, $lte: yr.end } }),
      AdminLog.countDocuments({ action: 'PASSWORD_RESET_REQUEST', createdAt: { $gte: yr.start, $lte: yr.end } }),
      Question.countDocuments({ isReported: true, updatedAt: { $gte: yr.start, $lte: yr.end } }),
    ]);

    // 7d averages
    const d7 = await Promise.all(Array.from({length:7},(_,i)=>i+1).map(async d=>{
      const r = dayRange(d);
      const [s,l,rs,rp] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: r.start, $lte: r.end } }),
        AdminLog.countDocuments({ action: 'USER_LOGIN', createdAt: { $gte: r.start, $lte: r.end } }),
        AdminLog.countDocuments({ action: 'PASSWORD_RESET_REQUEST', createdAt: { $gte: r.start, $lte: r.end } }),
        Question.countDocuments({ isReported: true, updatedAt: { $gte: r.start, $lte: r.end } }),
      ]);
      return { s, l, rs, rp };
    }));

    // 30d trend for chart
    const trend30 = await Promise.all(Array.from({length:30},(_,i)=>29-i).map(async dAgo=>{
      const r = dayRange(dAgo);
      const [s,l] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: r.start, $lte: r.end } }),
        AdminLog.countDocuments({ action: 'USER_LOGIN', createdAt: { $gte: r.start, $lte: r.end } }),
      ]);
      return { day: r.start.toLocaleDateString('en-US',{month:'short',day:'numeric'}), signups:s, logins:l };
    }));

    res.json({
      comparison: {
        labels: ['Today','Yesterday','7d Avg'],
        signups: [tSign, ySign, avg(d7.map(d=>d.s))],
        logins:  [tLogin, yLogin, avg(d7.map(d=>d.l))],
        resets:  [tReset, yReset, avg(d7.map(d=>d.rs))],
        reported:[tReport, yReport, avg(d7.map(d=>d.rp))],
      },
      trend30,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ message: 'Failed to load analytics' });
  }
});

module.exports = router;

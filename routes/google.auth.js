const express = require("express");
const router = express.Router();
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { createUserActivityLog } = require("../utils/adminLogger");

// ===================================================
// GOOGLE STRATEGY
// ===================================================
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL || "https://uhc-backend.onrender.com/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email      = profile.emails?.[0]?.value;
        const googleId   = profile.id;
        const name       = profile.displayName;

        if (!email) return done(null, false, { message: "No email from Google" });

        // 1. Try to find by googleId first
        let user = await User.findOne({ googleId });

        // 2. Fall back to matching by email (links existing account)
        if (!user) {
          user = await User.findOne({ email });
          if (user) {
            // Link the Google account to the existing user
            user.googleId     = googleId;
            user.authProvider = "google";
            user.isEmailVerified = true; // Google already verified it
            await user.save();
          }
        }

        // 3. Create a brand new user
        if (!user) {
          user = new User({
            name,
            email,
            googleId,
            authProvider:    "google",
            isEmailVerified: true,     // Google verified
            password:        null,
            // Defaults — user can fill these in later from their profile
            category: "student",
            country:  "Ghana",
          });
          await user.save();

          await createUserActivityLog(
            user._id,
            "USER_SIGNUP",
            `${name} registered via Google OAuth`,
            "INFO"
          );
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// ===================================================
// ROUTES
// ===================================================

// Step 1: Redirect user to Google
router.get(
  "/",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// Step 2: Google calls us back here
router.get(
  "/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || "https://uhcacadamy.com"}/auth?error=google_failed`,
  }),
  async (req, res) => {
    try {
      const user = req.user;

      // Stamp last-login & login point (same logic as regular login)
      user.lastLogin = new Date();
      const now = new Date();
      const lastPoint = user.lastLoginPointDate;
      if (!lastPoint || now - lastPoint >= 24 * 60 * 60 * 1000) {
        user.points = (user.points || 0) + 1;
        user.lastLoginPointDate = now;
      }
      await user.save();

      await createUserActivityLog(
        user._id,
        "USER_LOGIN",
        `${user.name} logged in via Google`,
        "INFO"
      );

      // Issue a JWT identical to the regular login token
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      const FRONTEND = process.env.FRONTEND_URL || "https://uhcacadamy.com";

      // Pass token + user as URL params to the React callback page
      const userPayload = encodeURIComponent(
        JSON.stringify({ ...user.toObject(), password: undefined })
      );

      // Redirect to our React handler page
      res.redirect(`${FRONTEND}/auth/google/callback?token=${token}&user=${userPayload}`);
    } catch (err) {
      console.error("Google callback error:", err);
      const FRONTEND = process.env.FRONTEND_URL || "https://uhcacadamy.com";
      res.redirect(`${FRONTEND}/auth?error=google_failed`);
    }
  }
);

module.exports = router;

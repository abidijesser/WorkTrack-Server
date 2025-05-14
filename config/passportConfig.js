const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
require("dotenv").config();

// Check if Google credentials are available
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn(
    "Google authentication is disabled: Missing Google Client ID or Secret"
  );
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Only configure Google Strategy if credentials are available
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3001/auth/google/callback",
        scope: ["profile", "email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            if (!user.googleId) {
              // Associe l'ID Google s'il n'est pas déjà enregistré
              user.googleId = profile.id;
              await user.save();
            }
            console.log("✅ Utilisateur Google connecté :", user);
            return done(null, user);
          }

          // Si l'utilisateur n'existe pas, on le crée
          const newUser = new User({
            googleId: profile.id,
            name: profile.name.givenName || profile.displayName,
            lastname: profile.name.familyName || "",
            email: profile.emails[0].value,
            image: profile.photos[0].value,
            verified: true,
            role: "Client",
          });

          user = await newUser.save();
          console.log("✅ Nouvel utilisateur Google enregistré :", user);
          return done(null, user);
        } catch (err) {
          console.error("❌ Erreur Google OAuth :", err);
          return done(err);
        }
      }
    )
  );
}

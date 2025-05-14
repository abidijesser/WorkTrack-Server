const passport = require("passport");
const FacebookStrategy = require("passport-facebook").Strategy;
const User = require("../models/User");
require("dotenv").config();

// Check if Facebook credentials are available
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
  console.warn(
    "Facebook authentication is disabled: Missing Facebook App ID or Secret"
  );
  module.exports = passport;
  return;
}

// Configuration de la stratégie Facebook
if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: FACEBOOK_APP_ID,
        clientSecret: FACEBOOK_APP_SECRET,
        callbackURL: "http://localhost:3001/api/auth/facebook/callback",
        profileFields: ["id", "displayName", "email", "photos"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log("Facebook profile:", profile);

          // Vérifier si l'utilisateur existe déjà avec cet email
          let email =
            profile.emails && profile.emails[0]
              ? profile.emails[0].value
              : null;
          let user = null;

          if (email) {
            user = await User.findOne({ email: email });
          }

          if (user) {
            // Si l'utilisateur existe mais n'a pas d'ID Facebook, on l'associe
            if (!user.facebookId) {
              user.facebookId = profile.id;
              await user.save();
            }
            console.log("✅ Utilisateur Facebook connecté :", user);
            return done(null, user);
          }

          // Si l'utilisateur n'existe pas, on le crée
          const newUser = new User({
            facebookId: profile.id,
            name: profile.displayName || "",
            email: email || `fb_${profile.id}@placeholder.com`, // Utiliser un email de placeholder si non fourni
            image:
              profile.photos && profile.photos[0]
                ? profile.photos[0].value
                : "",
            verified: true,
            role: "Client",
          });

          await newUser.save();
          console.log("✅ Nouvel utilisateur Facebook créé :", newUser);
          return done(null, newUser);
        } catch (error) {
          console.error("❌ Erreur d'authentification Facebook:", error);
          return done(error, false);
        }
      }
    )
  );
}


module.exports = passport;

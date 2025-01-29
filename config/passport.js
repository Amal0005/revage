const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
require("dotenv").config();

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Google OAuth credentials are missing in the environment variables.");
}

passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:1111/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log("Access Token:", accessToken);
          console.log("Profile:", profile);
  
          if (!profile.emails || !profile.emails[0].value) {
            return done(new Error("No email found in Google profile"), null);
          }
  
          let user = await User.findOne({ googleId: profile.id });
          if (user) {
            if (user.isBlocked) {
              return done(null, false, { message: "User is blocked" });
            }
            console.log("User found by Google ID:", user);
            return done(null, user);
          }
  
          user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
            if (user.isBlocked) {
              return done(null, false, { message: "User is blocked" });
            }
            console.log("User found by email. Updating Google ID if missing...");
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
              console.log("Google ID updated for existing user.");
            }
            return done(null, user);
          }
  
          console.log("No user found. Creating new user...");
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            isAdmin: 0, 
            isBlocked: false 
          });
          await user.save();
          console.log("New user created:", user);
          return done(null, user);
        } catch (error) {
          console.error("Error in Google Strategy:", error);
          return done(error, null);
        }
      }
    )
  );

passport.serializeUser((user, done) => {
  console.log("Serializing user:", user);
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    console.log("Deserializing user with ID:", id);
    const user = await User.findById(id);
    console.log("User deserialized:", user);
    done(null, user);
  } catch (err) {
    console.error("Error during deserialization:", err);
    done(err, null);
  }
});

module.exports = passport;

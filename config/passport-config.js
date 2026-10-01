const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20");
const keys = require("./keys.js");
const db = require("../models");
const Users = db.Users;


// passport serialize/deserialize user info
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    // A missing user (e.g. deleted) just means "not logged in"
    Users.findOne({ where: { id: id } })
        .then((user) => done(null, user || false))
        .catch(done);
});

passport.use(
    // google strategy setup
    new GoogleStrategy({
        callbackURL: keys.google.callbackURL,
        clientID: keys.google.clientID,
        clientSecret: keys.google.clientSecret
    }, (accessToken, refreshToken, profile, done) => {
        Users.findOne({ where: { googleID: profile.id } }).then((currentUser) => {
            if (currentUser) {
                // keep the name in sync with the Google account
                if (profile.displayName && currentUser.name !== profile.displayName) {
                    return currentUser.update({ name: profile.displayName });
                }
                return currentUser;
            }
            return Users.create({ name: profile.displayName || "FridgeBook user", googleID: profile.id });
        })
            .then((user) => done(null, user.dataValues))
            .catch(done);

    })
);
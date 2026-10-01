module.exports = {
    // google oauth
    google:{
        clientID: process.env.GOOGLE_CLIENT_ID || '492502873196-nnlrsopjgrjumcfmct3qt0lvijvn8uog.apps.googleusercontent.com',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/redirect"
    },

    cookieSession:{
        sessioinKey: process.env.SESSION_SECRET || "dev-only-session-secret"
    },
}

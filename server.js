const express = require("express");
const router = require("./routes");

// load databse
var db = require("./models");

// load auth config
const passportSetup = require("./config/passport-config.js");
const myKeys = require("./config/keys.js");
const passport = require("passport");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


var session = require("express-session");

// Render (and the Netlify proxy in front of it) terminate TLS upstream
app.set("trust proxy", 1);

app.use(express.static("public"));
app.use(session({
  secret: myKeys.cookieSession.sessioinKey,
  resave: false,
  saveUninitialized: false
})); //cookie: { maxAge: 0.5 * 60 * 60 * 1000 } }
app.use(passport.initialize());
app.use(passport.session());

app.use(router);                                   //"backend routing/api call"


var syncOptions = { force: false };
if (process.env.NODE_ENV === "test") {
  syncOptions.force = true;
}

db.sequelize.sync(syncOptions).then(function () {
  app.listen(PORT, function () {
    console.log(`Server now running on PORT ${PORT}.`);
  })
});

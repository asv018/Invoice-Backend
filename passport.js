// passport.js

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');

passport.use(new LocalStrategy({ usernameField: 'email' },
  function(email, password, done) {
    User.findOne({ email: email }, function(err, user) {
      if (err) return done(err);
      if (!user) return done(null, false, { message: 'Incorrect email.' });

      user.comparePassword(password, function(err, isMatch) {
        if (err) return done(err);
        if (isMatch) return done(null, user);
        else return done(null, false, { message: 'Incorrect password.' });
      });
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

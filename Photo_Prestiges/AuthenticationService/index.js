var express = require('express');
let app = express();
const mongoose = require('mongoose');
const port = process.env.AUTHENTICATION_SERVICE_URL || 3015;
var jwt = require('jsonwebtoken');
var passportJWT = require("passport-jwt");
const JwtStrategy = require('passport-jwt').Strategy;
const bcrypt = require('bcrypt');
const saltRounds = 10;
const db = mongoose.connection;

require('./mongooseconnection');

var ExtractJwt = passportJWT.ExtractJwt;

var jwtOptions = { jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey:  process.env.JWT_SECRET };

const strategy = new JwtStrategy(jwtOptions, (payload, done) => {
    const authservice = new AuthService();
    authservice.getExistingPayload(payload)
    .then((value) => {
        if(!value) {
            return done(null, false)
        }
        if(value) {
            return done(null, value)
        }
    })
    .catch((e) => {
        return done(e, false)
    })
})
passport.use(strategy);

app.use(express.json());

app.post('/login', async function(req, res) {
    const { username, password } = req.body;
    let user = await db.collection('users');

    if(user.findOne({username, password})) {
        var payload = {uid: user.uid, username: user.username};
        var authToken = jwt.sign(payload, jwtOptions.secretOrKey);
        res.json({message: "ok", token: authToken});
    } else {
        res.status(401).json({message:"username or password is incorrect"});
    }
});


app.post('/register', async function(req, res) {
    let user = await db.collection('users');
    const { username, password, email, role, uid } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.'});
    }

    let findUser = await db.collection('users').findOne({ username });
    
    if (findUser) {
      return res.status(400).json({ message: 'Username already exists.' });
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const lastUser = await db.collection('users').findOne({}, { sort: { uid: -1 } });
    const newUid = lastUser ? lastUser.uid + 1 : 1;
    const newUser = {
        uid: newUid,
        username: username,
        password: hashedPassword,
        email: email,
        role: role
    };
    user.insertOne(newUser);
    const authToken = jwt.sign({ uid: newUser.uid }, jwtOptions.secretOrKey);
    res.json({ message: 'User created!', authToken });
  });

app.listen(port, () => {
    console.log('Authentication is listining to this port: ' + port);
});




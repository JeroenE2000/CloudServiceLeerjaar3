var express = require('express');
let app = express();
const mongoose = require('mongoose');
require('dotenv').config();
const port = process.env.AUTHENTICATION_SERVICE_PORT || 3015;
var jwt = require('jsonwebtoken');

var passportJWT = require("passport-jwt");
const JwtStrategy = require('passport-jwt').Strategy;
const bcrypt = require('bcrypt');
const saltRounds = 10;
const User = require('./Models/User');
const db = mongoose.connection;

require('./mongooseconnection');

var ExtractJwt = passportJWT.ExtractJwt;

var jwtOptions = { jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey:  process.env.JWT_SECRET };

app.use(express.json());

app.post('/login', async function(req, res) {
    const { username, password } = req.body;
    let findUser = await User.findOne({username: username})

    if(findUser != null && await bcrypt.compare(password, findUser.password)) {
        var payload = {uid: findUser.uid, username: findUser.username, role: findUser.role};
        var authToken = jwt.sign(payload, jwtOptions.secretOrKey, {expiresIn: 604800});
        res.json({message: "ok", token: authToken});
    } else {
         res.status(401).json({message: "Username or password is incorrect"});
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
    res.json({ message: 'User created!' });
  });

app.listen(port, () => {
    console.log('Authentication is listining to this port: ' + port);
});




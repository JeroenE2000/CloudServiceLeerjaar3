const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue, consumeFromDirectExchange} = require('../rabbitmqconnection');
const port = process.env.AUTHENTICATION_SERVICE_PORT || 3015;
require('dotenv').config();
var express = require('express');
let app = express();
const mongoose = require('mongoose');
var jwt = require('jsonwebtoken');

var passportJWT = require("passport-jwt");
const bcrypt = require('bcrypt');
const saltRounds = 10;
const User = require('./Models/User');
const { opaqueTokenCheck } = require('../Middleware/roles');
const db = mongoose.connection;

require('./mongooseconnection');

var ExtractJwt = passportJWT.ExtractJwt;

var jwtOptions = { jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey:  process.env.JWT_SECRET };

app.use(express.json());

app.post('/login', opaqueTokenCheck, async function(req, res) {
    const { username, password } = req.body;
    let findUser = await User.findOne({username: username})

    if(findUser != null && await bcrypt.compare(password, findUser.password)) {
        var payload = {uid: findUser.uid, username: findUser.username, role: findUser.role};
        var authToken = jwt.sign(payload, jwtOptions.secretOrKey, {expiresIn: 604800});
        return res.json({message: "ok", token: authToken});
    } else {
         res.status(401).json({message: "Username or password is incorrect"});
    }
});


app.post('/register', opaqueTokenCheck, async function(req, res) {
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
    const userCount = await db.collection('users').find().sort({uid: -1}).limit(1).toArray();
    let nextuserID = 1;
    if (userCount.length > 0) {
        // Convert usercount to a number and add 1 to get the next user ID
        nextuserID = parseInt(userCount[0].uid) + 1;
    }
    const newUser = {
        uid: nextuserID,
        username: username,
        password: hashedPassword,
        email: email,
        role: role
    };
    user.insertOne(newUser);
    return res.json({ message: 'User created!' });
  });

app.listen(port, async() => {
    console.log('Authentication is listining to this port: ' + port);
    if(await connectToRabbitMQ() == false) {
        console.log("RabbitMQ is not connected");
    } 
    else {
        await connectToRabbitMQ();
        // dit zorgt ervoor dat de target aan een user wordt toegevoegd hij pakt de UserTargetQueue en roept daarbij de users collection aan om 
        // de targetID toe te voegen aan de user
        await consumeFromQueue("UserTargetQueue", "users", "get_user_target", async (data, dbname) => {
            let findUser = await User.findOne({ uid: data.uid });
            if(findUser != null) {
                const targetIDArray = [data.targetID];
                await User.updateOne({uid: data.uid}, {$push: {targetIDs: { $each: targetIDArray }}});
            }
        });
        await consumeFromDirectExchange("targetDeleteExchange", "users", "delete_target_fromuser_admin", async (data, dbname) => {
            await User.findOneAndUpdate({uid: data.userId}, {$pull: {targetIDs: data.tid}}, {new: true});
            console.log(`Removed target with tid ${data.tid} from user with uid ${data.userId} targetIDs`);
        });

        await consumeFromDirectExchange("targetDeleteExchange", "users", "delete_target_of_user", async (data, dbname) => {
            await User.findOneAndUpdate({uid: data.userId}, {$pull: {targetIDs: data.tid}}, {new: true});
            console.log(`Removed target with tid ${data.tid} from user with uid ${data.userId} targetIDs`);
        });
    }
});




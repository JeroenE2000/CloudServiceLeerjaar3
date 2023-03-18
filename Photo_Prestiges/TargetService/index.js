const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../Middleware/roles');
const app = express();
require('dotenv').config();
const port = process.env.TARGET_SERVICE_PORT || 3012;
const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue} = require('../rabbitmqconnection');

let data;

require('./mongooseconnection');

const db = mongoose.connection;

app.use(express.json());

// make a GET request to the database to get all the targets
app.get('/targets', authMiddleware, async function(req, res, next) {
    let target = await db.collection('targets').find().toArray();
    res.json({message: "success", data: target});
});

//make a post request to the database to add a target
app.post('/targets', async function(req, res, next) {
    try {
        data = req.body;
        await sendMessageToQueue('targetQueue', JSON.stringify(req.body));
        res.json({message: "success"});
    } catch (error) {
        console.log(error);
        res.status(500).json({message: "something went wrong", data: error})
    }
});



  
app.listen(port, async() => {
    console.log('Server is up on port ' + port);

    await connectToRabbitMQ();
    await consumeFromQueue("targetQueue", "targets", async (data, dbname) => {
        await mongoose.connection.collection(dbname).insertOne(data);
    });
});

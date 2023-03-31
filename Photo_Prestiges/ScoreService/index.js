var express = require('express');
const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue} = require('../rabbitmqconnection');
let app = express();
const mongoose = require('mongoose');
require('dotenv').config();
const db = mongoose.connection;
const port = process.env.SCORE_SERVICE_PORT || 3013;

require('./mongooseconnection');

app.use(express.json());



app.listen(port, async () => {
    console.log('ScoreService is up on port ' + port);
    if(await connectToRabbitMQ() == false) {
        console.log("RabbitMQ is not connected");
        res.json({message: "RabbitMQ is not connected"});
    } else {
        await connectToRabbitMQ();
        
        await consumeFromQueue('ScoreData', '', 'score_data', async (data, dbname) => {
            await db.collection('scores').insertOne(data);
        });
    }
});
const { opaqueTokenCheck } = require('../Middleware/roles');
var express = require('express');
const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue} = require('../rabbitmqconnection');
let app = express();
const mongoose = require('mongoose');
require('dotenv').config();
const db = mongoose.connection;
const port = process.env.SCORE_SERVICE_PORT || 3013;

require('./mongooseconnection');

app.use(express.json());

// Route to get all scores by target
/*app.get('admin/scores/:id', opaqueTokenCheck, async function(req, res) {
    
    try{
        let id = req.params.id;
        let dataScores = db.collection('score').find({targetId: id}).toArray();
        return res.json({message: "success", data: dataScores});
    }catch(error){
        return res.json({message: "Error", data: error});
    }
    
});
// Route to get all scores from user by target
app.get('scores/:id', opaqueTokenCheck, async function(req, res) {
    try{
        let id = req.params.id;
        let dataScores = db.collection('score').find({targetId: id}).toArray();
        return res.json({message: "success", data: dataScores});
    }catch(error){
        return res.json({message: "Error", data: error});
    }
    
});*/

app.listen(port, async () => {
    await connectToRabbitMQ();
    
    await consumeFromQueue('ScoreData', '', 'score_data', async (data, dbname) => {
        await db.collection('scores').insertOne(data);
    });
    console.log('Server is up on port ' + port);
});
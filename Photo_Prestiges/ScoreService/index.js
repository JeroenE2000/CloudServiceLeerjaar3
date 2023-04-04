const { opaqueTokenCheck } = require('../Middleware/roles');
var express = require('express');
const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue} = require('../rabbitmqconnection');
let app = express();
const mongoose = require('mongoose');
require('dotenv').config();
const db = mongoose.connection;
const ScoreModel = require('./Models/Score');
const port = process.env.SCORE_SERVICE_PORT || 3013;

require('./mongooseconnection');

app.use(express.json());

//Route to get all scores by target
app.get('/admin/scores/:tid', opaqueTokenCheck, async function(req, res) {
    try{
        let targetId = parseInt(req.params.tid);
        let dataScores = await ScoreModel.find({'uploads.targetId': targetId});
        return res.json({message: "success", data: dataScores});
    }catch(error){
        return res.json({message: "Error", data: error});
    }
    
});
// Route to get all the scores of users on my target and a specific target
app.get('/scores/:tid', opaqueTokenCheck, async function(req, res) {
    let targetId = req.params.tid;
    const userId = parseInt(req.headers['user_id']);
    const scores = await ScoreModel.find({ownerId: userId , 'uploads.targetId': targetId});

    if(scores.length == 0){
        return res.json({message: "Deze target is of niet van jouw of hij bestaat niet"});
    }
    return res.json({message: "success", data: scores});
});

// Get my score of a specific target
app.get('/scores/myscore/:tid', opaqueTokenCheck, async function(req, res) {
    let targetId = req.params.tid;
    const userId = parseInt(req.headers['user_id']);
    const scores = await ScoreModel.find({'uploads.userId': userId , 'uploads.targetId': targetId});

    if(scores.length == 0){
        return res.json({message: "Deze target bestaat nog niet of je hebt geen score op deze target"});
    }
    const scoresData = scores.map(score => ({
        score: score.uploads.score,
        targetId: score.uploads.targetId
      }));

    return res.json({message: "Jouw score op de target zijn", data: scoresData});
});

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

        await consumeFromQueue('uploadDelete', '' , 'delete_score_of_upload_of_target', async (data, dbname) => {
            let targetId = data.targetUploadid;
            let uploadId = parseInt(data.uploadId);
            let userId = parseInt(data.uid);
            const getUserScore = await ScoreModel.find({'uploads.userId': userId , 'uploads.targetId': targetId, 'uploads.uploadId': uploadId});
            if(getUserScore.length === 0){
                console.log("Deze target bestaat nog niet of je hebt geen score op deze target");
            }
            await ScoreModel.deleteOne({ 'uploads.uploadId': uploadId });            
        });
    }
});
const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../Middleware/roles');
const app = express();
require('dotenv').config();
const multer = require('multer');
const upload = multer();
const TargetModel = require('./Models/Target');

var bodyParser = require('body-parser');
const port = process.env.TARGET_SERVICE_PORT || 3012;
const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue} = require('../rabbitmqconnection');

let data , userdata;

require('./mongooseconnection');

const db = mongoose.connection;

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

// make a GET request to the database to get all the targets
app.get('/targets', authMiddleware, async function(req, res) {
    let target = await db.collection('targets').find().toArray();
    res.json({message: "success", data: target});
});

//make a post request to the database to add a target
app.post('/targets', authMiddleware, upload.single('image'), async function(req, res, next) {
    try {
        const buffer = req.file.path;
        const targetCount = await db.collection('targets').find().sort({tid: -1}).limit(1).toArray();
        let nextTargetId = 1;
        if (targetCount.length > 0) {
            nextTargetId = parseInt(targetCount[0].tid) + 1;
        }
        data = {
            tid: nextTargetId,
            targetName: req.body.targetName,
            description: req.body.description,
            location: {
              coordinates: [req.body.longitude, req.body.latitude],
              placename: req.body.placename
            },
            image: {
              data: buffer,
              contentType: req.file.mimetype
            }
        };
        userdata = {
            uid: req.user.uid,
            targetID: nextTargetId
        }
        await sendMessageToQueue('targetQueue', JSON.stringify(data));
        await sendMessageToQueue('UserTargetQueue', JSON.stringify(userdata));
        res.json({message: "success"});
    } catch (error) {
        console.log(error);
        res.status(500).json({message: "something went wrong", data: error})
    }
});

  
app.listen(port, async() => {
    console.log('Server is up on port ' + port);
    if(await connectToRabbitMQ() == false) {
        console.log("RabbitMQ is not connected");
    } 
    else {
        await connectToRabbitMQ();
        await consumeFromQueue("targetQueue", "targets", async (data, dbname) => {
            upload.storage = multer.diskStorage({
                destination: function (req, file, cb) {
                    cb(null, './uploads/')
                },
                filename: function (req, file, cb) {
                    cb(null, Date.now() + '-' + file.originalname)
                }
            });
            await mongoose.connection.collection(dbname).insertOne(data);
        });

        await consumeFromQueue('getTargetImageDataQueue', 'targets', async (data, dbname) => {
            let tid = data.tid;
            let imageData = await TargetModel.findOne({tid: tid});
            await sendMessageToQueue('imageDataResponseQueue', JSON.stringify(imageData));
        });
    }   
});
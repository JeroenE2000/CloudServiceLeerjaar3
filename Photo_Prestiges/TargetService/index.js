const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../Middleware/roles');
const app = express();
require('dotenv').config();
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads/')
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({storage: storage});

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
        const tid = Math.floor(Math.random() * 9000000000) + 1000000000; // generates a 10-digit random number
        data = {
            tid: tid,
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
            targetID: tid
        }
        await sendMessageToQueue('targetQueue', JSON.stringify(data), 'get_target');
        await sendMessageToQueue('UserTargetQueue', JSON.stringify(userdata), 'get_user_target');
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
        res.json({message: "RabbitMQ is not connected"});
    } 
    else {
        await connectToRabbitMQ();
        await consumeFromQueue("targetQueue", "targets", 'get_target', async (data, dbname) => {
            await mongoose.connection.collection(dbname).insertOne(data);
        });

        await consumeFromQueue('getTargetImageDataQueue', 'targets', 'get_target_image_data', async (data, dbname) => {
            let tid = data.tid;
            let imageData = await TargetModel.findOne({tid: tid});
            if(imageData == null) {
                imageData = {message: "no image found"};
            }
            await sendMessageToQueue('imageDataResponseQueue', JSON.stringify(imageData), 'image_data_response');
        });
    }   
});
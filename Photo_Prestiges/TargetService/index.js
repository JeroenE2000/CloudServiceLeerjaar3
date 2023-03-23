const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue, sendMessageToDirectExchange, consumeFromDirectExchange} = require('../rabbitmqconnection');
const express = require('express');
const mongoose = require('mongoose');
const { opaqueTokenCheck } = require('../Middleware/roles');
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

let data , userdata;

require('./mongooseconnection');

const db = mongoose.connection;

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

// make a GET request to the database to get all the targets
app.get('/targets', opaqueTokenCheck, async function(req, res) {
    let target = await db.collection('targets').find().toArray();
    return res.json({message: "success", data: target});
});

// Route to get all targets by city
app.get('/targets/city/:city', opaqueTokenCheck, async function(req, res) {
    let city = req.params.city;

    //check if city is filled in
    if(city == null) {
       return res.json({message: "city is not filled in"});
    }
    await sendMessageToDirectExchange('targetFilterExchange', JSON.stringify({ city }), 'filter_by_city');

    await consumeFromDirectExchange('targetFilterExchange', 'targets', 'filter_by_city', async function(data, dbname) {
        const result = await Target.find({ 'location.placename': data.city });
        console.log('Received data from the direct exchange: ', result);
        return res.json({message: "success", data: result});
    });
});

// Route to get all targets by coordinates
app.get('/targets/coordinates/:lat/:long', opaqueTokenCheck, async function(req, res) {
    let lat = req.params.lat;
    let long = req.params.long;

    //check if lat and long are villed in 
    if(lat == null || long == null) {
       return res.json({message: "lat and long are not filled in"});
    }

    await sendMessageToDirectExchange('targetFilterExchange', JSON.stringify({ lat, long }), 'filter_by_coordinates');
    await consumeFromDirectExchange('targetFilterExchange', 'targets', 'filter_by_coordinates', async function(data, dbname) {
        console.log(data.lat, data.long);
        const result = await TargetModel.find({'location.coordinates': [(data.long), (data.lat)]});
        console.log('Received data from the direct exchange: ', result);
        return res.json({message: "success", data: result});
    });
});


//make a post request to the database to add a target
app.post('/targets', opaqueTokenCheck, upload.single('image'), async function(req, res, next) {
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
        const userId = req.headers['user_id']; 
        userdata = {
            uid: userId,
            targetID: tid
        }
        await sendMessageToQueue('targetQueue', JSON.stringify(data), 'get_target');
        await db.collection('targets').insertOne(data);

        //van deze afblijven deze is goed
        await sendMessageToQueue('UserTargetQueue', JSON.stringify(userdata), 'get_user_target');
        return res.json({message: "success"});
    } catch (error) {
        console.log(error);
       return res.status(500).json({message: "something went wrong", data: error})
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
            console.log("Uploaded the following data to targets: ", data);
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
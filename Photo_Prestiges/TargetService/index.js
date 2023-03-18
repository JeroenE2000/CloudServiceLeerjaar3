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
const upload = multer({ storage: storage });

var bodyParser = require('body-parser');
const port = process.env.TARGET_SERVICE_PORT || 3012;
const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue} = require('../rabbitmqconnection');

let data;

require('./mongooseconnection');

const db = mongoose.connection;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// make a GET request to the database to get all the targets
app.get('/targets', authMiddleware, async function(req, res) {
    let target = await db.collection('targets').find().toArray();
    res.json({message: "success", data: target});
});

//make a post request to the database to add a target
app.post('/targets', upload.single('image'), async function(req, res) {
    try {
        const buffer = req.file.path;
        data = {
            tid: req.body.tid,
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
        await sendMessageToQueue('targetQueue', JSON.stringify(req.body));
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
            await mongoose.connection.collection(dbname).insertOne(data);
        });
    }   
});
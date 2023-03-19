const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue} = require('../rabbitmqconnection');
const { authMiddleware } = require('../Middleware/roles');
require('./mongooseconnection');
var express = require('express');
const fs = require('fs');
let app = express();
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();
var bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const upload = multer();

upload.storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './targetupload/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const port = process.env.EXTERNAL_SERVICE_PORT || 3014;


const db = mongoose.connection;

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

async function getImageData(targetId) {
    const message = {tid: targetId};
    await sendMessageToQueue('getTargetImageDataQueue', Buffer.from(JSON.stringify(message)));
}

let targetId;


app.post('/compareUpload/:tid', authMiddleware, upload.single('image'), async function(req, res, next) {
    try {
        targetId = req.params.tid;
        getImageData(targetId);

        await consumeFromQueue('imageDataResponseQueue', '', async (data, dbname) => {
            const uploadImage = req.file.path;
            const targetImage = Buffer.from(data.image.data).toString('utf8');
            const score = await compareImages(targetImage, uploadImage);

            // console.log({message: "PLEASE WERK alsjblieft" , data: score});

            // const uploadCount = await db.collection('uploads').find().sort({uploadId: -1}).limit(1).toArray();

            // let nextUploadID = 1;
            // if (uploadCount.length > 0) {
            //     nextUploadID = parseInt(nextUploadID[0].uploadId) + 1;
            // }
            // res.json({message: "success"});

        });
    } catch (error) {
        console.log(error);
        res.status(500).json({message: "something went wrong", data: error})
    }
});

async function compareImages(targetImage, uploadImage) {
    const got = await import('got');
    const formdata = new FormData();
    const formdata2 = new FormData();
    formdata.append('image', fs.createReadStream(targetImage))
    formdata2.append('image', fs.createReadStream(uploadImage))

    const api_key = "acc_e9bb2fe17869982";
    const api_secret = "b0249401a86f021a291f14b2d25e9390";
    

    const url = "https://api.imagga.com/v2/tags";
    const url2 = "https://api.imagga.com/v2/tags";
    const [response, response2] = await Promise.all([
        axios.post(url, {body: formdata, username: api_key, password: api_secret }),
        axios.post(url2, {body: formdata2, username: api_key, password: api_secret })
    ]);

    console.log({response: response, message: "als het goed is staat hier de response"})
        // const targetTags = JSON.parse(response.body).result.tags;
        // const uploadTags = JSON.parse(response2.body).result.tags;

        // let score = 0;
        // for (let i = 0; i < targetTags.length; i++) {
        //     for (let j = 0; j < uploadTags.length; j++) {
        //         if (targetTags[i].tag.en === uploadTags[j].tag.en) {
        //             score += targetTags[i].confidence * uploadTags[j].confidence;
        //         }
        //     }
        // }
        // return score;
}



app.listen(port, async() => {
    await connectToRabbitMQ();
    console.log('Server is up on port ' + port);
});

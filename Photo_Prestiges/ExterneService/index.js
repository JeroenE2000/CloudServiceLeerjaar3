const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue} = require('../rabbitmqconnection');
const { opaqueTokenCheck } = require('../Middleware/roles');
const port = process.env.EXTERNAL_SERVICE_PORT || 3014;
require('./mongooseconnection');
require('dotenv').config();
var express = require('express');
var bodyParser = require('body-parser');
let app = express();
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
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

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

async function getImageData(targetId) {
    const message = {tid: targetId};
    const routingKey = 'get_target_image_data';
    await sendMessageToQueue('getTargetImageDataQueue', Buffer.from(JSON.stringify(message)), routingKey);
}

let targetId;
let imageData;

async function consumeData(req) {
    const uploadImage = req.file.path;
    const targetImage = Buffer.from(imageData.image.data).toString('utf8');
    const score = await compareImages(targetImage, uploadImage);
    return score;
}

app.post('/compareUpload/:tid', opaqueTokenCheck, upload.single('image'), async function(req, res, next) {
    try {
        targetId = req.params.tid;
        await getImageData(targetId);
        const score = await consumeData(req);
        return res.json({message: "success", score: score});

         // const uploadCount = await db.collection('uploads').find().sort({uploadId: -1}).limit(1).toArray();

            // let nextUploadID = 1;
            // if (uploadCount.length > 0) {
            //     nextUploadID = parseInt(nextUploadID[0].uploadId) + 1;
            // }
            // res.json({message: "success"});
    } catch (error) {
        console.log(error);
        return res.status(500).json({message: "something went wrong", data: error})
    }
});

async function compareImages(targetImage, uploadImage) {
    const targetFormdata = new FormData();
    const uploadFormdata = new FormData();
    targetFormdata.append('image', fs.createReadStream(targetImage))
    uploadFormdata.append('image', fs.createReadStream(uploadImage))

    const api_key = "acc_e9bb2fe17869982";
    const api_secret = "b0249401a86f021a291f14b2d25e9390";
    const encoded = Buffer.from(api_key + ':' + api_secret, 'utf8').toString('base64')  // encode to base64

    const url = "https://api.imagga.com/v2/tags";

    const targetOptions = {
        headers: {
            'Authorization': 'Basic ' + encoded,
        },
        method: 'POST',
        url: url,
        data: targetFormdata,
    };
    const uploadOptions = {
        headers: {
            'Authorization': 'Basic ' + encoded,
        },
        method: 'POST',
        url: url,
        data: uploadFormdata,
    };
    let targetResponse;
    let uploadResponse;
    return (async () => {
        try {
            targetResponse = await axios(targetOptions);
            uploadResponse = await axios(uploadOptions);

            const targetTags = targetResponse.data.result.tags;
            const uploadTags = uploadResponse.data.result.tags;
            
            let score = 0;
            let totalPercentageDifference = 0;
            let numberOfMatchingTags = 0;
            let percentage = 0;

            await targetTags.forEach(targetTag => {
                const matchingUploadTag = uploadTags.find(uploadTag => uploadTag.tag.en === targetTag.tag.en)
                if (matchingUploadTag) {
                    const targetConfidence = targetTag.confidence;
                    const uploadConfidence = matchingUploadTag.confidence;
                    const percentageDifference = Math.abs(targetConfidence - uploadConfidence) / targetConfidence * 100;
                    totalPercentageDifference += percentageDifference;
                    numberOfMatchingTags++;
                }
            });

            if (numberOfMatchingTags > 0) {
                score = 100 - totalPercentageDifference / numberOfMatchingTags;
                percentage = Math.round(score * 100) / 100;
            } else {
                percentage = 0;
            }
              
            percentage = score.toFixed(2);
            return percentage;
        } catch (error) {
            console.log(error);
        }
    })();
}


app.listen(port, async() => {
    await connectToRabbitMQ();
    consumeFromQueue('imageDataResponseQueue', '', 'image_data_response', async (data, dbname) => {
        imageData = data;
    });
    console.log('Server is up on port ' + port);
});

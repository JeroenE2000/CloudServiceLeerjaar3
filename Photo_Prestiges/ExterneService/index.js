const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue , consumeFromDirectExchange} = require('../rabbitmqconnection');
const { opaqueTokenCheck } = require('../Middleware/roles');
const port = process.env.EXTERNAL_SERVICE_PORT || 3014;
require('./mongooseconnection');
require('dotenv').config();
const uploadTargetModel = require('./Models/UploadTarget');
const UploadModel = require('./Models/Upload');
var express = require('express');
var bodyParser = require('body-parser');
let app = express();
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const mongoose = require('mongoose');
const multer = require('multer');
const upload = multer();
const db = mongoose.connection;

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


app.post('/compareUpload/:tid', opaqueTokenCheck, upload.single('image'), async function(req, res, next) {
    try {
        let targetId = req.params.tid;
        const result = await uploadTargetModel.findOne({tid: targetId});
        if(result == null) {
            return res.json({message: "target not found"});
        }
        const uploadImage = req.file.path;
        const targetImage = Buffer.from(result.image.data).toString('utf8');
        const score = await compareImages(targetImage, uploadImage);

        const uploadId = Math.floor(Math.random() * 9000000000) + 1000000000;
        const scoreId = Math.floor(Math.random() * 9000000000) + 1000000000; // generates a 10-digit random number
        const userId = req.headers['user_id']; 

        let uploadData = {
            uploadId: uploadId,
            tid: targetId,
            matchingtargets: {
                image: {
                    data: req.file.path,
                    contentType: req.file.mimetype
                },
                userid: {
                    userId
                },
                score: {
                    score
                },
            }   
        }
        let scoreData = {
            scoreId: scoreId,
            uploads: {
                targetId: {
                    targetId
                },
                uploadId:{
                    uploadId
                }, 
                image: {
                  data: req.file.path,
                  contentType: req.file.mimetype,
                },
                userid: {
                    userId
                },
                score: {
                    score
                },
            } 
        }
        await db.collection('uploads').insertOne(uploadData);
        await sendMessageToQueue('ScoreData', JSON.stringify(scoreData), 'score_data');

        return res.json({message: "success", data: score});
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

app.get('/uploads', opaqueTokenCheck, async function(req, res, next) {
    try {
        const result = await db.collection('uploads').find({}).toArray();
        if(result == null) {
            return res.json({message: "no uploads found"});
        }
        return res.json({message: "success", data: result});
    } catch (error) {
        console.log(error);
        return res.status(500).json({message: "something went wrong", data: error})
    }
});


// Get all target uploads from uploadtargets table
app.get('/uploadtarget', opaqueTokenCheck, async function(req, res, next) {
    try {
        const result = await db.collection('uploadtargets').find({}).toArray();
        if(result == null) {
            return res.json({message: "no uploadtarget found"});
        }
        return res.json({message: "success", data: result});
    } catch (error) {
        console.log(error);
        return res.status(500).json({message: "something went wrong", data: error})
    }
});



app.listen(port, async() => {
    await connectToRabbitMQ();
    
    await consumeFromQueue('imageDataResponseQueue', '', 'image_data_response', async (data, dbname) => {
        await db.collection('uploadtargets').insertOne(data);
    });

    await consumeFromDirectExchange("targetDeleteExchange", "users", "delete_target_from_externe_service", async (data, dbname) => {
        await uploadTargetModel.deleteOne({tid: data.tid});
        console.log(`Removed target with tid ${data.tid} from uploadtarget collection`);
    });

    await consumeFromDirectExchange("targetDeleteExchange", "users", "delete_target_from_user_externe_service", async (data, dbname) => {
        await uploadTargetModel.deleteOne({tid: data.tid});
        console.log(`Removed target with tid ${data.tid} from uploadtarget collection`);
    });

    console.log('Server is up on port ' + port);
});

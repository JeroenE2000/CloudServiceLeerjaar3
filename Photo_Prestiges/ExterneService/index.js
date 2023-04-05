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
const path = require('path');
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
        if (req.file.mimetype !== 'image/png' && req.file.mimetype !== 'image/jpeg' && req.file.mimetype !== 'image/jpg') {
            const imageData = Buffer.from(req.file.path).toString('utf8');
            fs.unlinkSync(path.join(__dirname, '..', imageData));
            return res.json({message: "invalid file type"});
        }
        let targetId = parseInt(req.params.tid);
        const result = await uploadTargetModel.findOne({tid: targetId});
        if(result == null) {
            return res.json({message: "target not found"});
        }
        const uploadImage = req.file.path;
        const targetImage = Buffer.from(result.image.data).toString('utf8');
       
        const score = await compareImages(targetImage, uploadImage);

        const uploadId = Math.floor(Math.random() * 9000000000) + 1000000000;
        const scoreId = Math.floor(Math.random() * 9000000000) + 1000000000; // generates a 10-digit random number
        const userId = parseInt(req.headers['user_id']); 

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
            ownerId: result.ownerId,
            uploads: {
                targetId,
                uploadId,
                image: {
                  data: req.file.path,
                  contentType: req.file.mimetype,
                },
                userId,
                score
            } 
        }

        await db.collection('uploads').insertOne(uploadData);
        await sendMessageToQueue('ScoreData', JSON.stringify(scoreData), 'score_data');

        return res.json({message: "success", data: score});
    } catch (error) {
        return res.status(500).json({message: "something went wrong", data: error})
    }
});

async function compareImages(targetImage, uploadImage) {
    const targetFormdata = new FormData();
    const uploadFormdata = new FormData();
    targetFormdata.append('image', fs.createReadStream(targetImage))
    uploadFormdata.append('image', fs.createReadStream(uploadImage))

    const api_key = "acc_9b966df7a565ab9";
    const api_secret = "4f0acdcdba6a54477a6ef4510d130046";
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
        return res.status(500).json({message: "something went wrong", data: error})
    }
});


app.delete('/uploaded/:uid', opaqueTokenCheck, async function(req, res, next) {
    try {
        const uploadId = req.params.uid;
        if (uploadId == null) {
            return res.json({ message: "tid is not filled in" });
        }
        const uid = req.headers['user_id']
        const oldUploadData = await UploadModel.find({ 'uploadId': uploadId });

        let targetUploadid; 
        let uploadImage;
        oldUploadData.forEach((targetData) => {
            targetUploadid = targetData.tid;
            uploadImage = targetData.matchingtargets.image.data;
        });

        const uploadTargets = await uploadTargetModel.find({ 'tid': targetUploadid });
        let ownerId;
        uploadTargets.forEach((targetData) => {
            ownerId = targetData.ownerId;
        });

        if (ownerId != uid) {
            return res.json({ message: "Deze target is niet van jouw dus kun je niet uploads verwijderen" });
        }

        if (oldUploadData == null) {
            return res.json({ message: "target does not exist or this is not the users target" });
        }
        const imageData = Buffer.from(uploadImage).toString('utf8');
    
        // //remove image from the targetupload folder
        fs.unlinkSync(path.join(__dirname, '..', imageData));
        await sendMessageToQueue('uploadDelete', JSON.stringify({ targetUploadid , uploadId , uid }), 'delete_score_of_upload_of_target');
        await UploadModel.deleteOne({ 'uploadId': uploadId });

        return res.json({ message: "Succes upload is verwijderd"});
    } catch (error) {
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
        const tids = result.map(uploadtarget => uploadtarget.tid);

        return res.json({message: "Dit zijn alle targetId's die momenteel geupload zijn waarmee je kan vergelijken", data: tids});
    } catch (error) {
        return res.status(500).json({message: "something went wrong", data: error})
    }
});



app.listen(port, async() => {
    console.log('Externe is up on port ' + port);
    
    if(await connectToRabbitMQ() == false) {
        console.log("RabbitMQ is not connected");
        res.json({message: "RabbitMQ is not connected"});
    } else {
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
    }
});

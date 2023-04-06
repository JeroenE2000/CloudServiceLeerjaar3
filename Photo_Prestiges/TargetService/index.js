const {connectToRabbitMQ, sendMessageToQueue , consumeFromQueue, sendMessageToDirectExchange, consumeFromDirectExchange} = require('../rabbitmqconnection');
const express = require('express');
const mongoose = require('mongoose');
const { opaqueTokenCheck } = require('../Middleware/roles');
const app = express();
const fs = require('fs');
const path = require('path');

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

require('./mongooseconnection');

const db = mongoose.connection;

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));


// make a GET request to the database to get all the targets
app.get('/targets', opaqueTokenCheck, async function(req, res) {
    let { page, perpage } = req.query;
    
    if (!page && perpage) {
        page = 1;
    } else if (page && !perpage) {
        perpage = 2;
    }
    if (!page || !perpage) {
      const targets = await db.collection('targets').find().toArray();
      return res.json({
        message: "success",
        data: targets
      });
    }
  
    page = parseInt(page);
    perpage = parseInt(perpage);
    const skip = (page - 1) * perpage;
    const targets = await db.collection('targets').find().skip(skip).limit(perpage).toArray();
    return res.json({
      message: "success",
      data: targets,
      page,
      perpage
    });
});

// ---------------- filter functions -----------------
app.get('/targets/collectionfilter', opaqueTokenCheck, async function(req, res) {
    const queryParamMap = {
        'location.placename': 'location.placename',
        'location.coordinates': 'location.coordinates',
        targetName: 'targetName',
        description: 'description',
        tid: 'tid',
        uid: 'uid',
        imagecontentType: 'image.contentType',
    }

    let query = {};

    for(const [queryParam, field] of Object.entries(queryParamMap)) {
        if(req.query[queryParam]) {
            query[field] = req.query[queryParam];
        }
    }
    const targets = await db.collection('targets').find(query).toArray();
    return res.json({message: "success", data: targets});
});

app.get('/targets/:tid/:field', opaqueTokenCheck, async function(req, res) {
    const tid = parseInt(req.params.tid);
    const field = req.params.field;

    const target = await db.collection('targets').findOne({tid: tid});
    if(!target) {
        return res.json({message: "target does not exist"});
    }

    if(!(field in target)) {
        return res.json({message: "field does not exist"});
    }

    const value = target[field];
    return res.json({message: "filtered field", [field]: value});
});

// Route to get all targets by city
app.get('/targetscityfilter/city/:city', opaqueTokenCheck, async function(req, res) {
    let city = req.params.city;
    //check if city is filled in
    if(city == null) {
       return res.json({message: "city is not filled in"});
    }
    const target_city_filter = await TargetModel.find({ 'location.placename': city });
    return res.json({message: "success", data: target_city_filter});
});

// Route to get all targets by coordinates
app.get('/targets/coordinates/:lat/:long', opaqueTokenCheck, async function(req, res) {
    let lat = req.params.lat;
    let long = req.params.long;

    //check if lat and long are villed in 
    if(lat == null || long == null) {
       return res.json({message: "lat and long are not filled in"});
    }
    const target_coordinates_filter = await TargetModel.find({'location.coordinates': [long, lat]});
    
    return res.json({message: "success", data: target_coordinates_filter});
});

// ----------------- end of filter functions -----------------

app.delete('/targets/:tid', opaqueTokenCheck, async function(req, res) {
    const tid = req.params.tid;
    if (tid == null) {
        return res.json({ message: "tid is not filled in" });
    }
    const uid = req.headers['user_id']
    const oldTargetData = await TargetModel.findOne({ 'tid': tid });
    if (oldTargetData == null) {
        return res.json({ message: "target does not exist or this is not the users target" });
    }
    
    const imageData = Buffer.from(oldTargetData.image.data).toString('utf8');

    //remove image from the uploads folder
    fs.unlinkSync(path.join(__dirname, '..', imageData));
    await sendMessageToDirectExchange('targetDeleteExchange', JSON.stringify({ tid, uid }), 'delete_target_of_user');
    await sendMessageToDirectExchange('targetDeleteExchange', JSON.stringify({ tid }), 'delete_target_from_user_externe_service');
    await TargetModel.deleteOne({ 'tid': tid });

    res.json({message: "success"});
});

// ------------- Start of Admin Functions -----------------
app.delete('/admin/targets/:tid', opaqueTokenCheck, async function(req, res) {
    const tid = req.params.tid;
    if (tid == null) {
      return res.json({ message: "tid is not filled in" });
    }
  
    const oldTargetData = await TargetModel.findOne({ 'tid': tid });
  
    if (oldTargetData == null) {
      return res.json({ message: "target does not exist" });
    }
  
    const userId = oldTargetData.uid;
    const imageData = Buffer.from(oldTargetData.image.data).toString('utf8');

    //remove image from the uploads folder
    fs.unlinkSync(path.join(__dirname, '..', imageData));

    // send message to rabbitmq that the target is deleted so the other services can delete the target
    await sendMessageToDirectExchange('targetDeleteExchange', JSON.stringify({ tid, userId }), 'delete_target_fromuser_admin');
    await sendMessageToDirectExchange('targetDeleteExchange', JSON.stringify({ tid }), 'delete_target_from_externe_service');
    await TargetModel.deleteOne({ 'tid': tid });

    return res.json({ message: "success", data: "Target succesvol verwijdert" });
});
  
// ------------- End of Admin Functions -----------------


app.put('/targets/:tid', opaqueTokenCheck, async function(req, res, next) {
    const tid = req.params.tid;
    if (tid == null) {
        return res.json({ message: "tid is not filled in" });
    }

    const findtarget = await TargetModel.findOne({ 'tid': tid });
    if (findtarget == null) {
        return res.json({ message: "target does not exist" });
    }

    const uid = req.headers['user_id'];
    if (findtarget.uid != uid) {
        return res.json({ message: "this is not the users target" });
    }

    try {
        const update = {};
        const requestBody = req.body;
        const fieldsToUpdate = ['targetName', 'description'];
        for (const field of fieldsToUpdate) {
            if (requestBody.hasOwnProperty(field)) {
                update[field] = requestBody[field];
            } else {
                update[field] = findtarget[field];
            }
        }
        await TargetModel.updateOne({ 'tid': tid }, update);
        return res.json({ message: "target updated" });
    } catch (err) {
        console.error(err);
        return res.json({ message: "an error occurred while updating the target" });
    }
});



//make a post request to the database to add a target
app.post('/targets', opaqueTokenCheck, upload.single('image'), async function(req, res, next) {
    try {
        const buffer = req.file.path;
        const tid = Math.floor(Math.random() * 9000000000) + 1000000000; // generates a 10-digit random number
        let data = {
            tid: tid,
            uid: parseInt(req.headers['user_id']),
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
        let userdata = {
            uid: userId,
            targetID: tid
        }
        let externeServiceData = {
            tid: tid,
            ownerId: parseInt(userId),
            image: {
                data: buffer,
                contentType: req.file.mimetype
            }
        }
        if (req.file.mimetype !== 'image/png' && req.file.mimetype !== 'image/jpeg' && req.file.mimetype !== 'image/jpg') {
            const imageData = Buffer.from(req.file.path).toString('utf8');
            fs.unlinkSync(path.join(__dirname, '..', imageData));
            return res.json({message: "invalid file type"});
        }
       
        await sendMessageToQueue('targetQueue', JSON.stringify(data));

        await sendMessageToQueue('imageDataResponseQueue', JSON.stringify(externeServiceData));
        await sendMessageToQueue('UserTargetQueue', JSON.stringify(userdata));

        return res.json({message: "success"});
    } catch (error) {
        console.log(error);
       return res.status(500).json({message: "something went wrong", data: error})
    }
});

  
app.listen(port, async() => {
    console.log('TargetService is up on port ' + port);
    if(await connectToRabbitMQ() == false) {
        console.log("RabbitMQ is not connected");
        res.json({message: "RabbitMQ is not connected"});
    } 
    else {
        await connectToRabbitMQ();

        await consumeFromQueue("targetQueue", "targets", async (data, dbname) => {
            console.log("Uploaded the following data to targets: ", data);
            await db.collection('targets').insertOne(data);
        });
    }   
});
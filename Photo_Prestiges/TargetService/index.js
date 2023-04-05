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


let targets;
let target_city_filter;
let target_coordinates_filter;

// ----------- start consumer functions for rabbitmq -----------------
async function getTargets(skip, perPage) {
    return await db.collection('targets').find().skip(skip).limit(perPage).toArray();
}

async function getTargetsByCoordinates(lat, long) {
    return await TargetModel.find({'location.coordinates': [long, lat]});
}

async function getTargetsByCity(city) {
    return await TargetModel.find({ 'location.placename': city });
}
// ----------- end of the cunsumer functions for rabbitmq -----------------

// make a GET request to the database to get all the targets
app.get('/targets', opaqueTokenCheck, async function(req, res) {
    let { page, perPage } = req.query;
    
    if (!page && perPage) {
        page = 1;
    } else if (page && !perPage) {
        perPage = 2;
    }
    if (!page || !perPage) {
      const targets = await db.collection('targets').find().toArray();
      return res.json({
        message: "success",
        data: targets
      });
    }
  
    page = parseInt(page);
    perPage = parseInt(perPage);
    const skip = (page - 1) * perPage;
    await sendMessageToQueue('getAllTargets', JSON.stringify({ skip , perPage }), 'get_all_targets');
    while (!targets) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return res.json({
      message: "success",
      data: targets,
      page,
      perPage
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
    console.log({query: query});
    const targets = await db.collection('targets').find(query).toArray();
    res.send(targets);
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
app.get('/targets/city/:city', opaqueTokenCheck, async function(req, res) {
    let city = req.params.city;

    //check if city is filled in
    if(city == null) {
       return res.json({message: "city is not filled in"});
    }
    await sendMessageToDirectExchange('targetFilterExchange', JSON.stringify({ city }), 'filter_by_city');
    while (!target_city_filter) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
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
    await sendMessageToDirectExchange('targetFilterExchange', JSON.stringify({ long, lat }), 'filter_by_coordinates');

    while (!target_coordinates_filter) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
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
       
        await sendMessageToQueue('targetQueue', JSON.stringify(data), 'get_target');

        await sendMessageToQueue('imageDataResponseQueue', JSON.stringify(externeServiceData), 'image_data_response');
        await sendMessageToQueue('UserTargetQueue', JSON.stringify(userdata), 'get_user_target');

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
        await consumeFromQueue("getAllTargets", "targets", 'get_all_targets', async (data, dbname) => {
            console.log("Get all targets from page : ", data);
            targets = await getTargets(data.skip, data.perPage);
        });

        await consumeFromQueue("targetQueue", "targets", 'get_target', async (data, dbname) => {
            console.log("Uploaded the following data to targets: ", data);
            await db.collection('targets').insertOne(data);
        });
        await consumeFromDirectExchange('targetFilterExchange', 'targets', 'filter_by_city', async function(data, dbname) {
            console.log("Filtered the following data by city: ", data)
            target_city_filter = await getTargetsByCity(data.city);
        });
        await consumeFromDirectExchange('targetFilterExchange', 'targets', 'filter_by_coordinates', async function(data, dbname) {
            console.log("Filtered the following data by coordinates: ", data)
            target_coordinates_filter = await getTargetsByCoordinates(data.lat, data.long);
        });
    }   
});
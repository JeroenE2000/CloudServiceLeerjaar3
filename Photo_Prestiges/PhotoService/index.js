var express = require('express');
var router = express.Router();
let app = express();
const mongoose = require('mongoose');
var http = require('http');
const port = process.env.PHOTO_SERVICE_PORT || 3012;

require('./mongooseconnection');

const db = mongoose.connection;

app.use(express.json());

// make a GET request to the database to get all the targets
router.get('/targets', async function(req, res, next) {
    let target = await db.collection('targets').find().toArray();
    res.json(target);
});

//make a post request to the database to add a target
router.post('/targets', async function(req, res, next) {
    let target = await db.collection('targets').insertOne(req.body);
    res.json(target);
});
  
app.listen(port, () => {
    console.log('Server is up on port ' + port);
});

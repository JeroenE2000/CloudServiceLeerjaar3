const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PHOTO_SERVICE_PORT || 3012;
const { authMiddleware , adminMiddleware  } = require('../Middleware/roles');

require('./mongooseconnection');

const db = mongoose.connection;

app.use(express.json());

// make a GET request to the database to get all the targets
app.get('/targets', authMiddleware, adminMiddleware, async function(req, res, next) {
    let target = await db.collection('targets').find().toArray();
    res.json(target);
});

//make a post request to the database to add a target
app.post('/targets', async function(req, res, next) {
    let target = await db.collection('targets').insertOne(req.body);
    res.json(target);
});
  
app.listen(port, () => {
    console.log('Server is up on port ' + port);
});
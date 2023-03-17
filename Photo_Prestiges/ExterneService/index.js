var express = require('express');
var router = express.Router();
let app = express();
const mongoose = require('mongoose');
const port = process.env.EXTERNAL_SERVICE_PORT || 3014;


require('./mongooseconnection');

const db = mongoose.connection;

app.use(express.json());



app.listen(port, () => {
    console.log('Server is up on port ' + port);
});
//Routes

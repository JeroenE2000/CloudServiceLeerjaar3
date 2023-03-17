var express = require('express');
var router = express.Router();
let app = express();
const mongoose = require('mongoose');
require('dotenv').config();
const port = process.env.USER_SERVICE_PORT || 3013;

require('./mongooseconnection');


app.listen(port, () => {
    console.log('Server is up on port ' + port);
});
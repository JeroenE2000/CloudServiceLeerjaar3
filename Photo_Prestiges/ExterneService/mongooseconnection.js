var mongoose = require('mongoose');
require('dotenv').config();
//require deze model
require('./Models/Upload');
require('./Models/UploadTarget');
//get from config file
mongoose.connect(process.env.EXTERNESERVICE_DB_CONNECTION);




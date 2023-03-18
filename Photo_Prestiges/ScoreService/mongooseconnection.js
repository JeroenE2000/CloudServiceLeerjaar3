var mongoose = require('mongoose');
require('dotenv').config();
//require deze model
require('./Models/Score');
//get from config file
mongoose.connect(process.env.SCORESERVICE_DB_CONNECTION);
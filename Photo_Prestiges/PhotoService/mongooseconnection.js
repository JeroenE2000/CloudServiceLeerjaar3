var mongoose = require('mongoose');
require('dotenv').config();
//require deze model
require('./Models/Target');
//get from config file
mongoose.connect(process.env.PHOTOSERVICE_DB_CONNECTION);
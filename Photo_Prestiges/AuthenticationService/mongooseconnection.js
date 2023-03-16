var mongoose = require('mongoose');
require('dotenv').config();
//require deze model
require('./Models/User');
//get from config file
mongoose.connect(process.env.AUTHENTICATIONSERVICE_DB_CONNECTION);




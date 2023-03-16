const mongoose = require('mongoose');
const express = require('express');
const app = express();
const axios = require('axios-express-proxy');

const port = process.env.MICROSERVICE_BASE_URL || 3000;

const targetProxy = proxy({
    baseURL: port ,
    
})

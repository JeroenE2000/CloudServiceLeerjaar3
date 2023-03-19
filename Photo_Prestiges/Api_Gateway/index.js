const express = require('express');
const app = express();
const axios = require('axios');
// Deze middleware is nodig om de role te checken van de user die de request doet en of de user wel is ingelogd
const { authMiddleware, checkRole } = require('../Middleware/roles');
// is nodig om de .env file te kunnen gebruiken
require('dotenv').config();
const multer = require('multer');

const upload = multer();
const bodyParser = require('body-parser');
const FormData = require('form-data');

//PORT api_gateway waar hij op draait
const port = process.env.MICROSERVICE_BASE_PORT || 3016;

// Microservices connections
const targetService = process.env.TARGET_SERVICE_URL || 'http://localhost:3012';
const scoreService = process.env.SCORE_SERVICE_URL || 'http://localhost:3013';
const externalService = process.env.EXTERNAL_SERVICE_URL || 'http://localhost:3014';
const authenticationService = process.env.AUTHENTICATION_SERVICE_URL || 'http://localhost:3015';

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

// targetService
// Map endpoints to microservices
//authMiddleware, checkRole("admin") dit gebruiken om een role te zetten op een route vergeet niet een header mee te sturen met de request
app.get('/targets', authMiddleware, checkRole('admin'), async (req, res) => {
    try {
        const response = await axios.get(targetService + '/targets', {
          headers: {
            authorization: req.headers.authorization // pass the bearer token received from the client request to the microservice
          }
        });
        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
  
app.post('/targets', upload.single('image'), async (req, res) => {
    try {
      
      //formdata aanmaken anders kan de image niet worden meegegeven
      const form = new FormData();
      form.append('tid', req.body.tid);
      form.append('targetName', req.body.targetName);
      form.append('description', req.body.description);
      form.append('latitude', req.body.latitude);
      form.append('longitude', req.body.longitude);
      form.append('placename', req.body.placename);
      form.append('image', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
      });

      //formdata meegeven aan de post request
      const response = await axios.post(targetService + '/targets', form, {
        headers: {
          authorization: req.headers.authorization // pass the bearer token received from the client request to the microservice
        }
      });
      res.json(response.data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
});


// ----------------- ExterneService -----------------
app.post('/compareUpload/:tid', authMiddleware, upload.single('image'), async function(req, res, next) {
    try {
      const form = new FormData();
      form.append('image', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
      const response = await axios.post(externalService + '/compareUpload/' + req.params.tid, form, {
        headers: {
          authorization: req.headers.authorization // pass the bearer token received from the client request to the microservice
        }
      });
      res.json(response.data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
});



  
app.post('/login', async (req, res) => {
    try {
      const response = await axios.post(authenticationService + '/login', req.body);
      res.json(response.data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
});
  
app.post('/register', async (req, res) => {
    try {
      const response = await axios.post(authenticationService + '/register', req.body);
      res.json(response.data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Start the server
app.listen(port, async() => {
  console.log(`ApiGateway is on port ${port}`);
});

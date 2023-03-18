const express = require('express');
const app = express();
const axios = require('axios');
// Deze middleware is nodig om de role te checken van de user die de request doet en of de user wel is ingelogd
const { authMiddleware, checkRole } = require('../Middleware/roles');
// is nodig om de .env file te kunnen gebruiken
require('dotenv').config();
const bodyParser = require('body-parser');

//PORT api_gateway waar hij op draait
const port = process.env.MICROSERVICE_BASE_PORT || 3016;

// Microservices connections
const targetService = process.env.TARGET_SERVICE_URL || 'http://localhost:3012';
const scoreService = process.env.SCORE_SERVICE_URL || 'http://localhost:3013';
const externalService = process.env.EXTERNAL_SERVICE_URL || 'http://localhost:3014';
const authenticationService = process.env.AUTHENTICATION_SERVICE_URL || 'http://localhost:3015';

app.use(bodyParser.json());

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
  
app.post('/targets', async (req, res) => {
    try {
      const response = await axios.post(targetService + '/targets', req.body);
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
app.listen(port, () => {
  console.log(`ApiGateway is on port ${port}`);
});

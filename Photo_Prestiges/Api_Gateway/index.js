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


// ----------------- TargetService Beginning -----------------
//authMiddleware, checkRole("admin") dit gebruiken om een role te zetten op een route vergeet niet een header mee te sturen met de request
app.get('/targets', authMiddleware, checkRole(['user', 'admin']), async (req, res) => {
    try {
        const response = await axios.get(targetService + '/targets?page=' + req.query.page + '&perpage=' + req.query.perpage , {
          headers: {
            opaque_token: process.env.OPAQUE_TOKEN //pass the opaque token to the target service
          }
        });
        return res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.delete('/targets/:tid', authMiddleware, checkRole(['user', 'admin']) , async (req, res) => {
    try {
        const response = await axios.delete(targetService + '/targets/' + req.params.tid, {
          headers: {
            opaque_token: process.env.OPAQUE_TOKEN,
            user_id: req.user.uid
          }
        });
        return res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.delete('/admin/targets/:tid', authMiddleware, checkRole(['admin']), async (req, res) => {
    try {
        const response = await axios.delete(targetService + '/admin/targets/' + req.params.tid, {
          headers: {
            opaque_token: process.env.OPAQUE_TOKEN,
          }
        });
        return res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
  
app.post('/targets', authMiddleware, upload.single('image'), async (req, res) => {
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
          opaque_token: process.env.OPAQUE_TOKEN,
          user_id: req.user.uid
        }
      });
      return res.json(response.data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/targets/coordinates/:lat/:long', authMiddleware, async function(req, res) {
    try {
        const response = await axios.get(targetService + '/targets/coordinates/' + req.params.lat + '/' + req.params.long, {
            headers: {
              opaque_token: process.env.OPAQUE_TOKEN
            }
        });
        return res.json(response.data);
    } catch(error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/targets/city/:city', authMiddleware, async function(req, res) {
    try {
        const response = await axios.get(targetService + '/targets/city/' + req.params.city, {
            headers: {
              opaque_token: process.env.OPAQUE_TOKEN
            }
        });
        return res.json(response.data);
    } catch(error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// ----------------- TargetService Ending -----------------


// ----------------- ExterneService Begining -----------------
app.post('/compareUpload/:tid', authMiddleware, upload.single('image'), async function(req, res, next) {
    try {
      const form = new FormData();
      form.append('image', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
      const response = await axios.post(externalService + '/compareUpload/' + req.params.tid, form, {
        headers: {
          opaque_token: process.env.OPAQUE_TOKEN,
          user_id: req.user.uid
        }
      });
      return res.json(response.data);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/uploads', authMiddleware, async function(req, res, next) {
    try {
      const response = await axios.get(externalService + '/uploads', {
        headers: {
          opaque_token: process.env.OPAQUE_TOKEN,
          user_id: req.user.uid
          }
      });
      return res.json(response.data);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.delete('/uploaded/:uid', authMiddleware, async function(req, res, next) {
    try {
      const response = await axios.delete(externalService + '/compareUpload/' + req.params.uid, {
        headers: {
          opaque_token: process.env.OPAQUE_TOKEN,
          user_id: req.user.uid
        }
      });
      return res.json(response.data);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// ----------------- ExterneService Ending -----------------

// ----------------- Score Beginning -----------------
app.get('/admin/scores/:id', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const response = await axios.get(scoreService + '/admin/scores/' + req.params.id, {
      headers: {
        opaque_token: process.env.OPAQUE_TOKEN,
        user_id: req.user.uid,
        }
    });
    return res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/scores', authMiddleware, checkRole(['user', 'admin']), async (req, res) => {
  try {
    const response = await axios.get(scoreService + '/scores?tid=' + req.query.tid, {
      headers: {
        opaque_token: process.env.OPAQUE_TOKEN,
        user_id: req.user.uid,
        }
    });
    return res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
// ----------------- Score Ending -----------------


// ----------------- AuthenticationService Begining -----------------
app.post('/login', async (req, res) => {
    try {
      const response = await axios.post(authenticationService + '/login', req.body);
      return res.json(response.data);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
});
  
app.post('/register', async (req, res) => {
    try {
      const response = await axios.post(authenticationService + '/register', req.body);
      return res.json(response.data);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
});
// ----------------- AuthenticationService Ending -----------------


// Start the server
app.listen(port, async() => {
  console.log(`ApiGateway is on port ${port}`);
});

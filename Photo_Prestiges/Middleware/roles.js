const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
      if (err) {
        return res.status(401).send('Invalid token');
      }
      req.user = decodedToken;
      next();
    });
  } else {
    return res.status(401).send('Token not found');
  }
};

//APPARTE OPAQUE FUNCTION MAKEN
const opaqueTokenCheck = (req, res, next) => {
  const authHeader = req.headers.opaque_token;
  if (authHeader) {
    if(authHeader === process.env.OPAQUE_TOKEN) {
      next();
    } else {
      return res.status(401).send('Invalid token');
    }
  } else {
    return res.status(401).send('Token not found');
  }
};

const checkRole = (roles) => {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  };
};

module.exports = {
  authMiddleware, checkRole, opaqueTokenCheck
};

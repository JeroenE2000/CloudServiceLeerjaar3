const jwt = require('jsonwebtoken');

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
    res.status(401).send('Token not found');
  }
};

// adminMiddleware.js
const adminMiddleware = (req, res, next) => {
  if (req.user.role == 'admin') {
    next();
  } else {
    res.status(403).send(`Access denied for user with role: ${req.user.role}`);
  }
}; 

module.exports = {
  adminMiddleware, authMiddleware
};

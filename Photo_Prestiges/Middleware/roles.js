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

const checkRole = (role) => {
  return (req, res, next) => {
    if (req.user.role === role) {
      next();
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
  };
}

module.exports = {
  authMiddleware, checkRole
};

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: {
    type: Number,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  uploadids: [
    {
      type: Number,
    }
  ]
});

mongoose.model('User', userSchema);
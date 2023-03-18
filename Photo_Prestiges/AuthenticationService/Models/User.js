const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    uid: {
        type: Number,
        required: true,
        unique: true
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
    email: {
        type: String,
        required: true,
    },
    role : {
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

module.exports = mongoose.model('User');
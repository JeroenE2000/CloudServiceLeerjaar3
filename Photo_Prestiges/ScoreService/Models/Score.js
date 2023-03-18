const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  scoreId: {
    type: Number,
    required: true,
  },
  score: {
    type: Number,
    required: true,
  },
  uploadids: [
    {
      type: Number,
      required: true,
    }
  ]
});

mongoose.model('Score', userSchema);
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  scoreId: {
    type: Number,
    required: true,
  },
  ownerId: {
    type: Number,
    required: true,
  },
  uploads: {
    targetId: {
      type: Number,
      required: true,
    },
    uploadId:{
      type: Number,
      required: true,
    }, 
    image: {
      data: Buffer,
      contentType: String,
    },
    userid: {
      type: Number,
      required: true
    },
    score: {
      type: Number,
      required: true
    },
  } 
});

mongoose.model('Score', userSchema);

module.exports = mongoose.model('Score');

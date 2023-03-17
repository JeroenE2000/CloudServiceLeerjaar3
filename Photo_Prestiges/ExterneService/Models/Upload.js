var mongoose = require('mongoose');

var uploadSchema = new mongoose.Schema({
  uid: {
    type: Number,
    required: true,
  },
  userid: {
    type: Number,
    required: true,
  },
  targetid: {
    type: Number,
    required: true,
  },
  image: {
    data: Buffer,
    contentType: String,
  },
  date: {
    type: Date,
    default: Date.now
  }
});

mongoose.model('Upload', uploadSchema);


var mongoose = require('mongoose');

var uploadSchema = new mongoose.Schema({
  uploadId: {
    type: Number,
    required: true,
  },
  targetid: {
    type: Number,
    required: true,
  },
  matchingtargets: {
    image: {
      data: Buffer,
      contentType: String,
    },
    userid: {
      type: Number,
      required: true
    }
  },
});

mongoose.model('Upload', uploadSchema);


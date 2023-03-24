var mongoose = require('mongoose');

var uploadSchema = new mongoose.Schema({
    tid: {
        type: Number,
        equired: true,
    },
    image: {
      data: Buffer,
      contentType: String,
    },
});

mongoose.model('uploadtarget', uploadSchema);

module.exports = mongoose.model('uploadtarget');

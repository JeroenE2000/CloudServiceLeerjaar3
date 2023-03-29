const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
    tid: {
      type: Number,
      required: true,
    },
    uid: {
      type: Number,
      required: true,
    },
    targetName: {
      type: String,
      required: true
    }, 
    description: {
      type: String,
      required: true
    },
    location: {
      coordinates: {
        type: [Number, Number],
        default: [0, 0],
        required: true
      },
      placename: {
        type: String,
        required: true
      },
    },
    image: {
      data: Buffer,
      contentType: String,
    },
  });

mongoose.model('Target', targetSchema);

module.exports = mongoose.model('Target');

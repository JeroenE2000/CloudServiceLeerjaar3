const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
    tid: {
      type: Number,
      required: true,
    },
    location: {
      coordinates: {
        type: [Number],
        default: [0, 0],
        required: true
      },
      description: {
        type: String,
        required: true
      },
      name: {
        type: String,
        required: true
      }
    },
    scores: [
      {
        user: {
          type: String,
          required: true,
        },
        score: {
          type: Number,
          required: true
        },
        date: {
          type: Date,
          default: Date.now
        }
      }
    ],
    image: {
      data: Buffer,
      contentType: String,
    },
  });

mongoose.model('target', targetSchema);

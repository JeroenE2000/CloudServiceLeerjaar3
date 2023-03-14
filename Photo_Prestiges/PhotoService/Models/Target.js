const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
    id: {
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
          unique: true
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
    ]
  });

mongoose.model('target', targetSchema);

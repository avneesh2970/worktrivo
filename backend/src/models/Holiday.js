const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    date: {
      type: Date,
      required: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    type: {
      type: String,
      enum: ['National', 'Company', 'Festival', 'Optional'],
      default: 'Festival'
    },
    year: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear()
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

holidaySchema.index({ date: 1 });
holidaySchema.index({ year: 1, date: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);

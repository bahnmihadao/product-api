const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  pid: { type: String, required: true, trim: true, unique: true },
  pname: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0, validate: Number.isFinite },
  quantity: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
}, { timestamps: true, strict: 'throw' });

module.exports = mongoose.model('Product', productSchema);

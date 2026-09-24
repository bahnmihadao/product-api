const express = require('express');
const mongoose = require('mongoose');
const Product = require('./models/product');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

function validateProduct(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Body phải là một JSON object.' });
  }
  const fields = req.method === 'POST'
    ? ['pid', 'pname', 'price', 'quantity']
    : ['pname', 'price', 'quantity'];
  const errors = [];
  for (const key of Object.keys(body)) {
    if (!fields.includes(key)) errors.push('Trường không được phép: ' + key);
  }
  for (const key of fields.filter(key => key === 'pid' || key === 'pname')) {
    if (typeof body[key] !== 'string' || !body[key].trim()) {
      errors.push(key + ' phải là chuỗi không rỗng.');
    }
  }
  if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0) {
    errors.push('price phải là số hữu hạn không âm.');
  }
  if (!Number.isSafeInteger(body.quantity) || body.quantity < 0) {
    errors.push('quantity phải là số nguyên an toàn không âm.');
  }
  if (errors.length) return res.status(400).json({ error: 'Dữ liệu không hợp lệ.', details: errors });
  req.productInput = Object.fromEntries(fields.map(key => [
    key, typeof body[key] === 'string' ? body[key].trim() : body[key],
  ]));
  next();
}

app.get('/', (req, res) => {
  res.json({ message: 'Product API', resources: '/products' });
});

app.post('/products', validateProduct, async (req, res) => {
  const product = await Product.create(req.productInput);
  res.location('/products/' + encodeURIComponent(product.pid)).status(201).json(product);
});

app.get('/products', async (req, res) => {
  // Danh sách cơ bản cho bài thực hành; phân trang là phần mở rộng.
  res.json(await Product.find().sort({ pid: 1 }));
});

app.get('/products/:pid', async (req, res) => {
  const product = await Product.findOne({ pid: req.params.pid });
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
  res.json(product);
});

app.put('/products/:pid', validateProduct, async (req, res) => {
  // pid định danh ổn định; PUT yêu cầu đủ pname, price và quantity.
  const product = await Product.findOneAndUpdate(
    { pid: req.params.pid },
    { $set: req.productInput },
    { returnDocument: 'after', runValidators: true },
  );
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
  res.json(product);
});

app.delete('/products/:pid', async (req, res) => {
  const product = await Product.findOneAndDelete({ pid: req.params.pid });
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
  res.status(204).end();
});

app.get('/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;

  if (!databaseReady) {
    return res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
    });
  }

  res.status(200).json({
    status: 'healthy',
    database: 'connected',
  });
});

app.use((req, res) => res.status(404).json({ error: 'Endpoint không tồn tại.' }));

// Express 5 chuyển lỗi từ async route đến middleware này.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.code === 11000) return res.status(409).json({ error: 'pid đã tồn tại.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON không hợp lệ.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Body vượt giới hạn dung lượng.' });
  if (['ValidationError', 'CastError', 'StrictModeError'].includes(err.name)) {
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ.' });
  }
  console.error('Request failed:', err.name);
  res.status(500).json({ error: 'Lỗi hệ thống.' });
});

module.exports = app;

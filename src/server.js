require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const app = require('./app');
const Product = require('./models/product');

let server;
let stopping = false;

async function start() {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT phải là số nguyên từ 1 đến 65535.');
  }
  if (!process.env.MONGODB_URI) throw new Error('Thiếu MONGODB_URI trong môi trường.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  // Chờ unique index sẵn sàng trước khi nhận request tạo sản phẩm.
  await Product.init();
  await new Promise((resolve, reject) => {
    server = app.listen(port, '0.0.0.0', resolve);
    server.once('error', reject);
  });
  console.log('MongoDB connected');
  console.log('Product API: http://localhost:' + port);
}

async function stop() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  clearTimeout(timeout);
}

process.on('SIGINT', () => stop().catch(() => process.exit(1)));
process.on('SIGTERM', () => stop().catch(() => process.exit(1)));
start().catch(async err => {
  // Không log URI kết nối vì có thể chứa mật khẩu ở các bước sau.
  console.error('Không thể khởi động API:', err.name);
  if (err.name === 'Error') console.error(err.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});

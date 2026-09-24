require('dotenv').config({ quiet: true });
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const Product = require('../src/models/product');
const app = require('../src/app');

const database = 'product_api_test_' + randomUUID().replaceAll('-', '');
let server;
let base;

before(async () => {
  // Luôn override tên DB: không xóa hoặc ghi dữ liệu trong productdb.
  const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('Cần MONGODB_URI hoặc TEST_MONGODB_URI để chạy integration test.');
  await mongoose.connect(uri, { dbName: database, serverSelectionTimeoutMS: 5000 });
  await Product.init();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  base = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  try {
    if (server) {
      server.closeIdleConnections();
      await new Promise(resolve => server.close(resolve));
    }
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === database) {
      await mongoose.connection.dropDatabase();
    }
  } finally {
    await mongoose.disconnect();
  }
});

async function request(path, method = 'GET', body) {
  return fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('CRUD lưu và thay đổi dữ liệu MongoDB thật', async () => {
  const input = { pid: 'P001', pname: 'Bàn phím', price: 350000, quantity: 10 };
  let response = await request('/products', 'POST', input);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).pid, input.pid);
  assert.equal((await Product.findOne({ pid: input.pid })).quantity, 10);

  response = await request('/products');
  assert.equal(response.status, 200);
  assert.ok((await response.json()).some(p => p.pid === input.pid));

  response = await request('/products/P001');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).pname, input.pname);

  response = await request('/products/P001', 'PUT', { pname: 'Bàn phím mới', price: 400000, quantity: 5 });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).price, 400000);
  assert.equal((await Product.findOne({ pid: input.pid })).quantity, 5);

  response = await request('/products/P001', 'DELETE');
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(await Product.findOne({ pid: input.pid }), null);
});

test('pid trùng trả 409 và không tạo hai bản ghi', async () => {
  const body = { pid: 'DUP', pname: 'Sản phẩm', price: 0, quantity: 0 };
  const responses = await Promise.all([
    request('/products', 'POST', body), request('/products', 'POST', body),
  ]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  assert.equal(await Product.countDocuments({ pid: 'DUP' }), 1);
});

test('Từ chối dữ liệu sai và không ghi MongoDB', async t => {
  const valid = { pid: 'BAD', pname: 'Tên', price: 10, quantity: 2 };
  const cases = [
    ['pid trống', { ...valid, pid: '  ' }],
    ['thiếu pname', { pid: 'BAD', price: 10, quantity: 2 }],
    ['giá âm', { ...valid, price: -1 }],
    ['giá sai kiểu', { ...valid, price: '10' }],
    ['số lượng lẻ', { ...valid, quantity: 1.5 }],
    ['số lượng âm', { ...valid, quantity: -1 }],
    ['thuộc tính ngoài schema', { ...valid, admin: true }],
    ['body mảng', []],
    ['body null', null],
  ];
  for (const [name, body] of cases) {
    await t.test(name, async () => {
      const count = await Product.countDocuments();
      const response = await request('/products', 'POST', body);
      assert.equal(response.status, 400);
      assert.equal(await Product.countDocuments(), count);
    });
  }
});

test('PUT không hợp lệ giữ nguyên dữ liệu và không cho đổi pid', async () => {
  const data = { pid: 'UPDATE', pname: 'Gốc', price: 10, quantity: 2 };
  assert.equal((await request('/products', 'POST', data)).status, 201);
  for (const body of [
    { pname: 'Mới', price: 5 },
    { pname: 'Mới', price: -1, quantity: 3 },
    { pid: 'NEW', pname: 'Mới', price: 5, quantity: 3 },
  ]) {
    assert.equal((await request('/products/UPDATE', 'PUT', body)).status, 400);
  }
  const saved = await Product.findOne({ pid: 'UPDATE' });
  assert.equal(saved.pname, 'Gốc');
  assert.equal(saved.price, 10);
});

test('GET, PUT, DELETE mã không tồn tại trả 404', async () => {
  assert.equal((await request('/products/MISSING')).status, 404);
  assert.equal((await request('/products/MISSING', 'PUT', { pname: 'Tên', price: 0, quantity: 0 })).status, 404);
  assert.equal((await request('/products/MISSING', 'DELETE')).status, 404);
});

test('JSON lỗi trả 400 và endpoint lạ trả 404', async () => {
  const response = await fetch(base + '/products', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid',
  });
  assert.equal(response.status, 400);
  assert.equal((await request('/unknown')).status, 404);
});

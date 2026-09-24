# Product API

Bài thực hành CI/CD — bước 6: REST API CRUD dùng Express, Mongoose và MongoDB.

## Chạy trên máy local

Yêu cầu Node.js 24 LTS và container MongoDB `nammongodb` đang chạy.

1. Cài thư viện: `npm ci`.
2. Nếu chưa có `.env`, sao chép `.env.example` thành `.env`.
3. Cấu hình `PORT` và `MONGODB_URI` trong `.env`.
4. Chạy `npm start` hoặc `npm run dev` để tự khởi động lại khi sửa file.
5. API mặc định ở http://localhost:3000.

API chỉ lắng nghe sau khi kết nối MongoDB và tạo index thành công.
Dừng bằng Ctrl+C. Đây là API học tập chưa có xác thực.

## Dữ liệu Product

- `pid`: chuỗi bắt buộc, duy nhất và không thay đổi qua PUT; khác với `_id` của MongoDB.
- `pname`: chuỗi bắt buộc, không chỉ chứa khoảng trắng.
- `price`: JSON number hữu hạn, không âm.
- `quantity`: JSON number nguyên an toàn, không âm.
- Cắt khoảng trắng đầu/cuối chuỗi; từ chối trường ngoài danh sách.
- Mongoose bổ sung `_id`, `createdAt`, `updatedAt` và `__v`.

## Endpoints

| Method | URL | Kết quả |
| --- | --- | --- |
| POST | /products | Tạo mới: 201; pid trùng: 409 |
| GET | /products | Danh sách: 200 (chưa phân trang ở bước cơ bản) |
| GET | /products/:pid | Chi tiết: 200; không thấy: 404 |
| PUT | /products/:pid | Thay đủ pname, price, quantity: 200; không thấy: 404 |
| DELETE | /products/:pid | Xóa: 204 không có body; không thấy: 404 |

Dữ liệu sai/JSON lỗi: 400. Body vượt 32 KB: 413. Lỗi hệ thống: 500, không trả chi tiết nội bộ.

## Thử trong Git Bash (giữ API chạy ở terminal khác)

```bash
curl -i -X POST http://localhost:3000/products -H "Content-Type: application/json" -d '{"pid":"P001","pname":"Keyboard","price":350000,"quantity":10}'
curl -i http://localhost:3000/products
curl -i http://localhost:3000/products/P001
curl -i -X PUT http://localhost:3000/products/P001 -H "Content-Type: application/json" -d '{"pname":"Keyboard New","price":400000,"quantity":5}'
curl -i -X DELETE http://localhost:3000/products/P001
```

## Kiểm thử

`npm test` chạy integration test với MongoDB thật. URI lấy từ `TEST_MONGODB_URI` nếu được đặt, hoặc `MONGODB_URI` trong `.env`.
Mỗi lần chạy tạo database `product_api_test_<random>` riêng và xóa đúng database đó sau test; không xóa `productdb`.

Kiểm tra CRUD và dữ liệu lưu, unique pid với request đồng thời, validation, PUT sai không thay dữ liệu, 404 và JSON lỗi.
Dockerfile, Compose, healthcheck và GitHub Actions thuộc các bước tiếp theo.

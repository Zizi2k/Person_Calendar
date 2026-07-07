# Personal Finance Calendar

Website quản lý tài chính cá nhân và gia đình với giao diện dạng lịch planner.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | HTML, CSS, JavaScript thuần |
| Deploy Frontend | GitHub Pages |
| Backend | Google Apps Script Web App |
| Database | Google Sheets |
| Giao tiếp | fetch API |

## Cấu trúc thư mục

```
├── index.html          # Dashboard chính
├── login.html          # Trang đăng nhập
├── style.css           # Giao diện calendar planner
├── app.js              # Logic ứng dụng
├── api.js              # Layer giao tiếp API
├── backend/
│   └── Code.gs         # Google Apps Script backend
└── README.md           # Hướng dẫn này
```

---

## Bước 1: Tạo Google Sheets

1. Truy cập [Google Sheets](https://sheets.google.com) và tạo Spreadsheet mới
2. Đặt tên: `Personal Finance Calendar`
3. Copy **Spreadsheet ID** từ URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```

---

## Bước 2: Cài đặt Google Apps Script

1. Trong Google Sheets, chọn **Extensions > Apps Script**
2. Xóa code mặc định, copy toàn bộ nội dung file `backend/Code.gs` vào
3. **Thay `YOUR_SPREADSHEET_ID`** bằng ID spreadsheet của bạn (dòng 15)
4. Lưu project (Ctrl+S), đặt tên: `Finance API`

### Chạy setup dữ liệu mẫu

1. Trong Apps Script Editor, chọn hàm `setupSheets` từ dropdown
2. Nhấn **Run** (▶)
3. Lần đầu sẽ yêu cầu cấp quyền:
   - Nhấn **Review permissions**
   - Chọn tài khoản Google
   - Nhấn **Advanced** > **Go to Finance API (unsafe)**
   - Nhấn **Allow**
4. Kiểm tra Google Sheets — sẽ có 3 sheet: `Users`, `Transactions`, `Categories`

### Deploy Web App

1. Nhấn **Deploy > New deployment**
2. Chọn loại: **Web app**
3. Cấu hình:
   - **Description**: Finance API v1
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Nhấn **Deploy**
5. Copy **Web App URL** (dạng `https://script.google.com/macros/s/.../exec`)

> **Lưu ý**: Mỗi lần sửa code GAS, cần **Deploy > Manage deployments > Edit > New version > Deploy** lại.

---

## Bước 3: Cấu hình Frontend

1. Mở file `api.js`
2. Thay `YOUR_GAS_WEB_APP_URL` bằng URL Web App vừa copy:

```javascript
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbx.../exec';
```

---

## Bước 4: Deploy lên GitHub Pages

### Cách 1: GitHub Pages

```bash
# Khởi tạo repo
git init
git add .
git commit -m "Initial commit: Personal Finance Calendar"
git branch -M main
git remote add origin https://github.com/USERNAME/personal-finance-calendar.git
git push -u origin main
```

1. Vào repo trên GitHub > **Settings > Pages**
2. Source: **Deploy from branch** > chọn `main` / `/ (root)`
3. Nhấn **Save**
4. Truy cập: `https://USERNAME.github.io/personal-finance-calendar/login.html`

### Cách 2: Chạy local

Mở trực tiếp `login.html` bằng trình duyệt, hoặc dùng Live Server extension trong VS Code.

> **Lưu ý**: Khi chạy local, fetch API vẫn hoạt động vì GAS Web App cho phép CORS từ mọi origin.

---

## Tài khoản mẫu

| Username | Password | Vai trò |
|---|---|---|
| admin | 123456 | Quản trị viên |
| user1 | password | Người dùng |

---

## Cấu trúc Google Sheets

### Sheet: Users

| id | username | password | fullname | role | createdAt |
|---|---|---|---|---|---|
| uuid | admin | 123456 | Quản trị viên | admin | 2026-... |

### Sheet: Transactions

| id | userId | type | groupType | amount | category | description | paymentMethod | date | note | paid | createdAt |
|---|---|---|---|---|---|---|---|---|---|---|---|
| uuid | ... | income/expense | personal/family | 50000 | Ăn uống | Cơm trưa | Tiền mặt | 2026-07-07 | | TRUE/FALSE | 2026-... |

- `type`: `income` (thu) hoặc `expense` (chi)
- `groupType`: `personal` (cá nhân) hoặc `family` (gia đình)
- `paymentMethod`: phương thức thanh toán (cá nhân) hoặc tên người chi (gia đình)
- `paid`: trạng thái đã thanh toán (TRUE/FALSE)

### Sheet: Categories

| id | name | type | createdAt |
|---|---|---|---|
| uuid | Ăn uống | expense | 2026-... |

Loại mặc định: Ăn uống, Đi lại, Học tập, Nhà ở, Điện nước, Internet, Giải trí, Sức khỏe, Gia đình, Khác

---

## Dữ liệu mẫu

Hàm `setupSheets()` tự tạo:
- 2 tài khoản người dùng
- 10 loại chi tiêu mặc định
- 8 giao dịch mẫu (thu + chi cá nhân + chi gia đình)

---

## API Endpoints

Tất cả request gửi qua POST với body JSON:

```json
{ "action": "tên_action", ...params }
```

| Action | Mô tả | Params |
|---|---|---|
| login | Đăng nhập | username, password |
| getTransactions | Lấy giao dịch | userId, type?, groupType? |
| addTransaction | Thêm giao dịch | transaction |
| updateTransaction | Sửa giao dịch | id, transaction |
| deleteTransaction | Xóa giao dịch | id |
| getCategories | Lấy loại chi tiêu | — |
| addCategory | Thêm loại | category |
| updateCategory | Sửa loại | id, category |
| deleteCategory | Xóa loại | id |
| getSummaryByMonth | Tổng kết tháng | userId, year, month |
| getSummaryByYear | Tổng kết năm | userId, year |

Response format:

```json
{ "success": true, "data": {...}, "message": "" }
```

---

## Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| CORS error | Chưa deploy Web App | Deploy lại với "Anyone" access |
| Phản hồi API không hợp lệ | URL sai hoặc chưa deploy | Kiểm tra URL trong api.js |
| Đăng nhập thất bại | Chưa chạy setupSheets | Chạy hàm setupSheets() trong GAS |
| Dữ liệu không hiện | Spreadsheet ID sai | Kiểm tra SPREADSHEET_ID trong Code.gs |
| Thay đổi code không có hiệu lực | Chưa deploy version mới | Deploy > Manage deployments > New version |

---

## Tính năng

- Đăng nhập / đăng xuất với localStorage
- Dashboard tổng quan với thống kê tháng
- Lịch tháng + danh sách giao dịch theo ngày (planner style)
- Quản lý chi tiêu cá nhân (CRUD + lọc + tìm kiếm)
- Quản lý chi tiêu gia đình (CRUD + lọc + tìm kiếm)
- Quản lý thu nhập (CRUD + lọc + tìm kiếm)
- Quản lý loại chi tiêu (thêm/sửa/xóa)
- Tổng kết theo tháng/năm với bảng và biểu đồ
- Checkbox trạng thái thanh toán
- Loading overlay khi gửi API
- Validate form (ngày, số tiền, loại chi tiêu)
- Format tiền VNĐ và ngày dd/mm/yyyy
- Responsive cho mobile và desktop

/**
 * ============================================================
 * PERSONAL FINANCE CALENDAR - Google Apps Script Backend
 * ============================================================
 * Copy toàn bộ file này vào Google Apps Script Editor
 * Chạy hàm setupSheets() một lần để tạo dữ liệu mẫu
 * Deploy > New deployment > Web app
 * ============================================================
 */

// ID của Google Spreadsheet - THAY BẰNG ID CỦA BẠN
// Lấy từ URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
const SPREADSHEET_ID = '16q1YounE7qvkllH7Df6XxtlIS_jXz5txmH2UO3Xf9eI';

// Tên các sheet
const SHEETS = {
  USERS: 'Users',
  TRANSACTIONS: 'Transactions',
  CATEGORIES: 'Categories',
  SCHEDULES: 'Schedules'
};

// ==================== HTTP HANDLERS ====================

/**
 * Xử lý GET request (dùng cho test)
 */
function doGet(e) {
  return createResponse({ success: true, message: 'Personal Finance API is running' });
}

/**
 * Xử lý POST request - router chính
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    let result;

    switch (action) {
      case 'login':
        result = login(body.username, body.password);
        break;
      case 'getTransactions':
        result = getTransactions(body.userId, body);
        break;
      case 'addTransaction':
        result = addTransaction(body.transaction);
        break;
      case 'updateTransaction':
        result = updateTransaction(body.id, body.transaction);
        break;
      case 'deleteTransaction':
        result = deleteTransaction(body.id);
        break;
      case 'getCategories':
        result = getCategories();
        break;
      case 'addCategory':
        result = addCategory(body.category);
        break;
      case 'updateCategory':
        result = updateCategory(body.id, body.category);
        break;
      case 'deleteCategory':
        result = deleteCategory(body.id);
        break;
      case 'getSummaryByMonth':
        result = getSummaryByMonth(body.userId, body.year, body.month);
        break;
      case 'getSummaryByYear':
        result = getSummaryByYear(body.userId, body.year);
        break;
      case 'getSchedules':
        result = getSchedules(body.userId, body);
        break;
      case 'addSchedule':
        result = addSchedule(body.schedule);
        break;
      case 'updateSchedule':
        result = updateSchedule(body.id, body.schedule);
        break;
      case 'deleteSchedule':
        result = deleteSchedule(body.id);
        break;
      default:
        return createResponse({ success: false, message: 'Action không hợp lệ: ' + action });
    }

    return createResponse(result);
  } catch (error) {
    return createResponse({ success: false, message: 'Lỗi server: ' + error.message });
  }
}

/**
 * Tạo response JSON
 */
function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== SHEET HELPERS ====================

/**
 * Lấy spreadsheet đang làm việc
 * Ưu tiên file đang mở (khi chạy từ Extensions > Apps Script trong Sheets)
 */
function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      Logger.log('Dùng spreadsheet đang mở: ' + active.getName() + ' | ID: ' + active.getId());
      return active;
    }
  } catch (e) {
    Logger.log('Không có spreadsheet đang mở, dùng openById: ' + e.message);
  }

  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID') {
    throw new Error('Chưa cấu hình SPREADSHEET_ID. Hãy mở Google Sheets > Extensions > Apps Script rồi chạy lại.');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Dùng openById: ' + ss.getName() + ' | ID: ' + ss.getId());
  return ss;
}

/**
 * Kiểm tra kết nối - CHẠY HÀM NÀY TRƯỚC để xem script đang trỏ vào file nào
 */
function diagnoseSetup() {
  const ss = getSpreadsheet();
  const sheetNames = ss.getSheets().map(function(s) { return s.getName(); });

  const info = [
    'Tên file: ' + ss.getName(),
    'ID: ' + ss.getId(),
    'URL: ' + ss.getUrl(),
    'Các sheet hiện có: ' + sheetNames.join(', ')
  ].join('\n');

  Logger.log(info);

  try {
    SpreadsheetApp.getUi().alert('Chẩn đoán kết nối', info, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    Logger.log('Chạy từ editor độc lập - xem log để biết kết quả');
  }

  return info;
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

/** Tạo ID duy nhất */
function generateId() {
  return Utilities.getUuid();
}

/** Lấy tất cả dữ liệu từ sheet dạng mảng object */
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    let hasData = false;
    headers.forEach((header, j) => {
      row[header] = data[i][j];
      if (data[i][j] !== '' && data[i][j] !== null) hasData = true;
    });
    if (hasData) rows.push(row);
  }

  return rows;
}

/** Tìm index của row theo id */
function findRowIndex(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) return i + 1; // 1-indexed
  }
  return -1;
}

// ==================== SETUP ====================

/**
 * Chạy hàm này MỘT LẦN để tạo sheets và dữ liệu mẫu
 *
 * QUAN TRỌNG: Mở Google Sheets trước, rồi vào Extensions > Apps Script, chạy hàm này
 * Hoặc chạy diagnoseSetup() trước để kiểm tra đúng file chưa
 */
function setupSheets() {
  try {
    const ss = getSpreadsheet();
    Logger.log('Bắt đầu setup trên file: ' + ss.getName() + ' (' + ss.getId() + ')');

    // --- Users ---
    let usersSheet = ss.getSheetByName(SHEETS.USERS);
    if (!usersSheet) {
      usersSheet = ss.insertSheet(SHEETS.USERS);
      usersSheet.appendRow(['id', 'username', 'password', 'fullname', 'role', 'createdAt']);
      usersSheet.getRange('C:C').setNumberFormat('@');
      Logger.log('Đã tạo sheet Users');
    }

    const existingUsers = getSheetDataFromSheet(usersSheet);
    if (existingUsers.length === 0) {
      const now = new Date().toISOString();
      usersSheet.appendRow([generateId(), 'admin', '123456', 'Quản trị viên', 'admin', now]);
      usersSheet.appendRow([generateId(), 'user1', 'password', 'Nguyễn Văn A', 'user', now]);
      Logger.log('Đã thêm tài khoản mẫu');
    }

    // --- Categories ---
    let catSheet = ss.getSheetByName(SHEETS.CATEGORIES);
    if (!catSheet) {
      catSheet = ss.insertSheet(SHEETS.CATEGORIES);
      catSheet.appendRow(['id', 'name', 'type', 'createdAt']);
      Logger.log('Đã tạo sheet Categories');
    }

    const existingCats = getSheetDataFromSheet(catSheet);
    if (existingCats.length === 0) {
      const now = new Date().toISOString();
      const defaultCategories = [
        'Ăn uống', 'Đi lại', 'Học tập', 'Nhà ở', 'Điện nước',
        'Internet', 'Giải trí', 'Sức khỏe', 'Gia đình', 'Khác'
      ];
      defaultCategories.forEach(function(name) {
        catSheet.appendRow([generateId(), name, 'expense', now]);
      });
      Logger.log('Đã thêm loại chi tiêu mẫu');
    }

    // --- Transactions ---
    let txSheet = ss.getSheetByName(SHEETS.TRANSACTIONS);
    if (!txSheet) {
      txSheet = ss.insertSheet(SHEETS.TRANSACTIONS);
      txSheet.appendRow([
        'id', 'userId', 'type', 'groupType', 'amount', 'category',
        'description', 'paymentMethod', 'date', 'note', 'paid', 'createdAt'
      ]);
      Logger.log('Đã tạo sheet Transactions');
    }

    const existingTx = getSheetDataFromSheet(txSheet);
    if (existingTx.length === 0) {
      const users = getSheetDataFromSheet(usersSheet);
      const userId = users[0] ? users[0].id : '';
      const now = new Date().toISOString();
      const today = new Date();
      const year = today.getFullYear();
      const month = ('0' + (today.getMonth() + 1)).slice(-2);

      const sampleData = [
        [userId, 'income', 'personal', 15000000, 'Lương', 'Lương tháng', '', year + '-' + month + '-05', 'Lương chính', false],
        [userId, 'expense', 'personal', 50000, 'Ăn uống', 'Cơm trưa', 'Tiền mặt', year + '-' + month + '-07', '', true],
        [userId, 'expense', 'personal', 35000, 'Đi lại', 'Xe buýt', 'Tiền mặt', year + '-' + month + '-07', '', true],
        [userId, 'expense', 'family', 500000, 'Điện nước', 'Tiền điện tháng', 'Bố', year + '-' + month + '-10', 'Hóa đơn EVN', false],
        [userId, 'expense', 'personal', 200000, 'Giải trí', 'Xem phim', 'Thẻ', year + '-' + month + '-12', '', false],
        [userId, 'expense', 'family', 300000, 'Ăn uống', 'Đi chợ', 'Mẹ', year + '-' + month + '-15', 'Thực phẩm', true],
        [userId, 'income', 'personal', 2000000, 'Thưởng', 'Thưởng dự án', '', year + '-' + month + '-20', '', false],
        [userId, 'expense', 'personal', 150000, 'Internet', 'Cước internet', 'Chuyển khoản', year + '-' + month + '-22', '', false]
      ];

      sampleData.forEach(function(row) {
        txSheet.appendRow([generateId()].concat(row).concat([now]));
      });
      Logger.log('Đã thêm giao dịch mẫu');
    }

    // --- Schedules (Thời khóa biểu) ---
    let schSheet = ss.getSheetByName(SHEETS.SCHEDULES);
    if (!schSheet) {
      schSheet = ss.insertSheet(SHEETS.SCHEDULES);
      schSheet.appendRow([
        'id', 'userId', 'date', 'startTime', 'endTime', 'title', 'type',
        'description', 'location', 'completed', 'note', 'createdAt'
      ]);
      Logger.log('Đã tạo sheet Schedules');
    }

    const existingSch = getSheetDataFromSheet(schSheet);
    if (existingSch.length === 0) {
      const users = getSheetDataFromSheet(usersSheet);
      const userId = users[0] ? users[0].id : '';
      const now = new Date().toISOString();
      const today = new Date();
      const year = today.getFullYear();
      const month = ('0' + (today.getMonth() + 1)).slice(-2);
      const day = ('0' + today.getDate()).slice(-2);
      const dateStr = year + '-' + month + '-' + day;

      const sampleSchedules = [
        [userId, dateStr, '07:00', '07:30', 'Thức dậy & tập thể dục', 'Cá nhân', 'Chạy bộ nhẹ', 'Nhà', false, ''],
        [userId, dateStr, '08:00', '09:00', 'Ăn sáng & chuẩn bị', 'Cá nhân', '', 'Nhà', false, ''],
        [userId, dateStr, '09:00', '12:00', 'Làm việc buổi sáng', 'Công việc', 'Xử lý email, báo cáo', 'Văn phòng', false, ''],
        [userId, dateStr, '12:00', '13:00', 'Nghỉ trưa', 'Cá nhân', 'Ăn trưa', 'Nhà hàng', false, ''],
        [userId, dateStr, '13:30', '17:00', 'Họp & làm việc nhóm', 'Họp', 'Review dự án tuần', 'Phòng họp', false, ''],
        [userId, dateStr, '19:00', '20:00', 'Học online', 'Học tập', 'Khóa tiếng Anh', 'Online', false, '']
      ];

      sampleSchedules.forEach(function(row) {
        schSheet.appendRow([generateId()].concat(row).concat([now]));
      });
      Logger.log('Đã thêm thời khóa biểu mẫu');
    }

    SpreadsheetApp.flush();

    const message = 'Setup hoàn tất!\nFile: ' + ss.getName() + '\nURL: ' + ss.getUrl();
    Logger.log(message);

    try {
      SpreadsheetApp.getUi().alert('Thành công', message, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
      Logger.log('Hoàn tất - mở Google Sheets để kiểm tra 3 tab: Users, Transactions, Categories');
    }

  } catch (error) {
    const errMsg = 'Lỗi setupSheets: ' + error.message;
    Logger.log(errMsg);
    try {
      SpreadsheetApp.getUi().alert('Lỗi', errMsg, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
      Logger.log(errMsg);
    }
    throw error;
  }
}

/** Đọc dữ liệu trực tiếp từ sheet object (dùng trong setupSheets) */
function getSheetDataFromSheet(sheet) {
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = [];

  for (var i = 1; i < data.length; i++) {
    const row = {};
    var hasData = false;
    headers.forEach(function(header, j) {
      row[header] = data[i][j];
      if (data[i][j] !== '' && data[i][j] !== null) hasData = true;
    });
    if (hasData) rows.push(row);
  }

  return rows;
}

// ==================== AUTH ====================

/**
 * Đăng nhập - kiểm tra username và password
 */
function login(username, password) {
  const users = getSheetData(SHEETS.USERS);
  const inputUser = String(username || '').trim();
  const inputPass = String(password || '').trim();

  const user = users.find(u =>
    String(u.username || '').trim() === inputUser &&
    String(u.password || '').trim() === inputPass
  );

  if (!user) {
    return { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' };
  }

  // Không trả password về client
  return {
    success: true,
    data: {
      id: user.id,
      username: user.username,
      fullname: user.fullname,
      role: user.role
    }
  };
}

// ==================== TRANSACTIONS ====================

/**
 * Lấy danh sách giao dịch
 */
function getTransactions(userId, filters) {
  let transactions = getSheetData(SHEETS.TRANSACTIONS);

  if (userId) {
    transactions = transactions.filter(t => t.userId === userId);
  }

  // Lọc theo type
  if (filters && filters.type) {
    transactions = transactions.filter(t => t.type === filters.type);
  }

  // Lọc theo groupType
  if (filters && filters.groupType) {
    transactions = transactions.filter(t => t.groupType === filters.groupType);
  }

  return { success: true, data: transactions };
}

/**
 * Thêm giao dịch mới
 */
function addTransaction(transaction) {
  if (!transaction.date || !transaction.amount || !transaction.category) {
    return { success: false, message: 'Thiếu thông tin bắt buộc (ngày, số tiền, loại)' };
  }

  const sheet = getSheet(SHEETS.TRANSACTIONS);
  const id = generateId();
  const now = new Date().toISOString();

  sheet.appendRow([
    id,
    transaction.userId,
    transaction.type || 'expense',
    transaction.groupType || 'personal',
    Number(transaction.amount),
    transaction.category,
    transaction.description || '',
    transaction.paymentMethod || '',
    transaction.date,
    transaction.note || '',
    transaction.paid || false,
    now
  ]);

  return {
    success: true,
    data: { id, ...transaction, createdAt: now }
  };
}

/**
 * Cập nhật giao dịch
 */
function updateTransaction(id, transaction) {
  const sheet = getSheet(SHEETS.TRANSACTIONS);
  const rowIndex = findRowIndex(sheet, id);

  if (rowIndex === -1) {
    return { success: false, message: 'Không tìm thấy giao dịch' };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const fieldMap = {
    userId: transaction.userId,
    type: transaction.type,
    groupType: transaction.groupType,
    amount: Number(transaction.amount),
    category: transaction.category,
    description: transaction.description,
    paymentMethod: transaction.paymentMethod,
    date: transaction.date,
    note: transaction.note,
    paid: transaction.paid
  };

  headers.forEach((header, i) => {
    if (fieldMap[header] !== undefined) {
      sheet.getRange(rowIndex, i + 1).setValue(fieldMap[header]);
    }
  });

  return { success: true, data: { id, ...transaction } };
}

/**
 * Xóa giao dịch
 */
function deleteTransaction(id) {
  const sheet = getSheet(SHEETS.TRANSACTIONS);
  const rowIndex = findRowIndex(sheet, id);

  if (rowIndex === -1) {
    return { success: false, message: 'Không tìm thấy giao dịch' };
  }

  sheet.deleteRow(rowIndex);
  return { success: true, message: 'Đã xóa giao dịch' };
}

// ==================== CATEGORIES ====================

/**
 * Lấy danh sách loại chi tiêu
 */
function getCategories() {
  const categories = getSheetData(SHEETS.CATEGORIES);
  return { success: true, data: categories };
}

/**
 * Thêm loại chi tiêu
 */
function addCategory(category) {
  if (!category.name) {
    return { success: false, message: 'Tên loại không được để trống' };
  }

  const sheet = getSheet(SHEETS.CATEGORIES);
  const id = generateId();
  const now = new Date().toISOString();

  sheet.appendRow([id, category.name, category.type || 'expense', now]);

  return { success: true, data: { id, ...category, createdAt: now } };
}

/**
 * Cập nhật loại chi tiêu
 */
function updateCategory(id, category) {
  const sheet = getSheet(SHEETS.CATEGORIES);
  const rowIndex = findRowIndex(sheet, id);

  if (rowIndex === -1) {
    return { success: false, message: 'Không tìm thấy loại chi tiêu' };
  }

  sheet.getRange(rowIndex, 2).setValue(category.name);
  sheet.getRange(rowIndex, 3).setValue(category.type || 'expense');

  return { success: true, data: { id, ...category } };
}

/**
 * Xóa loại chi tiêu
 */
function deleteCategory(id) {
  const sheet = getSheet(SHEETS.CATEGORIES);
  const rowIndex = findRowIndex(sheet, id);

  if (rowIndex === -1) {
    return { success: false, message: 'Không tìm thấy loại chi tiêu' };
  }

  sheet.deleteRow(rowIndex);
  return { success: true, message: 'Đã xóa loại chi tiêu' };
}

// ==================== SUMMARY ====================

/**
 * Tổng kết theo tháng
 */
function getSummaryByMonth(userId, year, month) {
  const transactions = getSheetData(SHEETS.TRANSACTIONS)
    .filter(t => t.userId === userId);

  let totalIncome = 0;
  let totalExpense = 0;
  let personalExpense = 0;
  let familyExpense = 0;
  const byCategory = {};

  transactions.forEach(tx => {
    const d = new Date(tx.date);
    if (d.getFullYear() !== Number(year) || d.getMonth() + 1 !== Number(month)) return;

    const amt = Number(tx.amount) || 0;

    if (tx.type === 'income') {
      totalIncome += amt;
    } else {
      totalExpense += amt;
      if (tx.groupType === 'family') familyExpense += amt;
      else personalExpense += amt;

      const cat = tx.category || 'Khác';
      byCategory[cat] = (byCategory[cat] || 0) + amt;
    }
  });

  return {
    success: true,
    data: {
      totalIncome,
      totalExpense,
      personalExpense,
      familyExpense,
      balance: totalIncome - totalExpense,
      byCategory
    }
  };
}

/**
 * Tổng kết theo năm
 */
function getSummaryByYear(userId, year) {
  const transactions = getSheetData(SHEETS.TRANSACTIONS)
    .filter(t => t.userId === userId);

  let totalIncome = 0;
  let totalExpense = 0;
  const byCategory = {};
  const months = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));

  transactions.forEach(tx => {
    const d = new Date(tx.date);
    if (d.getFullYear() !== Number(year)) return;

    const amt = Number(tx.amount) || 0;
    const m = d.getMonth();

    if (tx.type === 'income') {
      totalIncome += amt;
      months[m].income += amt;
    } else {
      totalExpense += amt;
      months[m].expense += amt;

      const cat = tx.category || 'Khác';
      byCategory[cat] = (byCategory[cat] || 0) + amt;
    }
  });

  return {
    success: true,
    data: {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      byCategory,
      months
    }
  };
}

// ==================== SCHEDULES (THỜI KHÓA BIỂU) ====================

/**
 * Lấy danh sách thời khóa biểu
 */
function getSchedules(userId, filters) {
  var schedules = getSheetData(SHEETS.SCHEDULES);

  if (userId) {
    schedules = schedules.filter(function(s) { return s.userId === userId; });
  }

  if (filters && filters.date) {
    schedules = schedules.filter(function(s) {
      return String(s.date).split('T')[0] === String(filters.date).split('T')[0];
    });
  }

  if (filters && filters.year && filters.month) {
    schedules = schedules.filter(function(s) {
      var d = new Date(s.date);
      return d.getFullYear() === Number(filters.year) && d.getMonth() + 1 === Number(filters.month);
    });
  }

  schedules.sort(function(a, b) {
    var dateCmp = String(a.date).localeCompare(String(b.date));
    if (dateCmp !== 0) return dateCmp;
    return String(a.startTime).localeCompare(String(b.startTime));
  });

  return { success: true, data: schedules };
}

/**
 * Thêm mục thời khóa biểu
 */
function addSchedule(schedule) {
  if (!schedule.date || !schedule.startTime || !schedule.endTime || !schedule.title) {
    return { success: false, message: 'Thiếu thông tin bắt buộc (ngày, giờ bắt đầu/kết thúc, tiêu đề)' };
  }

  var sheet = getSheet(SHEETS.SCHEDULES);
  if (!sheet) {
    return { success: false, message: 'Chưa có sheet Schedules. Chạy setupSheets() hoặc tạo sheet thủ công.' };
  }

  var id = generateId();
  var now = new Date().toISOString();

  sheet.appendRow([
    id,
    schedule.userId,
    schedule.date,
    schedule.startTime,
    schedule.endTime,
    schedule.title,
    schedule.type || 'Công việc',
    schedule.description || '',
    schedule.location || '',
    schedule.completed || false,
    schedule.note || '',
    now
  ]);

  return {
    success: true,
    data: { id: id, userId: schedule.userId, date: schedule.date, startTime: schedule.startTime,
      endTime: schedule.endTime, title: schedule.title, type: schedule.type || 'Công việc',
      description: schedule.description || '', location: schedule.location || '',
      completed: schedule.completed || false, note: schedule.note || '', createdAt: now }
  };
}

/**
 * Cập nhật thời khóa biểu
 */
function updateSchedule(id, schedule) {
  var sheet = getSheet(SHEETS.SCHEDULES);
  if (!sheet) {
    return { success: false, message: 'Chưa có sheet Schedules' };
  }

  var rowIndex = findRowIndex(sheet, id);
  if (rowIndex === -1) {
    return { success: false, message: 'Không tìm thấy mục thời khóa biểu' };
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var fieldMap = {
    userId: schedule.userId,
    date: schedule.date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    title: schedule.title,
    type: schedule.type,
    description: schedule.description,
    location: schedule.location,
    completed: schedule.completed,
    note: schedule.note
  };

  headers.forEach(function(header, i) {
    if (fieldMap[header] !== undefined) {
      sheet.getRange(rowIndex, i + 1).setValue(fieldMap[header]);
    }
  });

  return { success: true, data: { id: id, userId: schedule.userId, date: schedule.date,
    startTime: schedule.startTime, endTime: schedule.endTime, title: schedule.title,
    type: schedule.type, description: schedule.description, location: schedule.location,
    completed: schedule.completed, note: schedule.note } };
}

/**
 * Xóa thời khóa biểu
 */
function deleteSchedule(id) {
  var sheet = getSheet(SHEETS.SCHEDULES);
  if (!sheet) {
    return { success: false, message: 'Chưa có sheet Schedules' };
  }

  var rowIndex = findRowIndex(sheet, id);
  if (rowIndex === -1) {
    return { success: false, message: 'Không tìm thấy mục thời khóa biểu' };
  }

  sheet.deleteRow(rowIndex);
  return { success: true, message: 'Đã xóa mục thời khóa biểu' };
}

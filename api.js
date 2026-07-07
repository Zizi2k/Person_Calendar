/**
 * api.js - Lớp giao tiếp với Google Apps Script Web App
 *
 * HƯỚNG DẪN: Thay YOUR_GAS_WEB_APP_URL bằng URL Web App sau khi deploy GAS
 * Ví dụ: https://script.google.com/macros/s/AKfycbx.../exec
 */
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbzEMjTyGACvyBxViGcpggX2tYK97pEDwe50o6y_I8cOL_P9D5ncPsdl35dZXtsbSLNzsg/exec';

/**
 * Gửi request tới Google Apps Script
 * Dùng Content-Type text/plain để tránh lỗi CORS preflight
 */
async function apiRequest(action, data = {}) {
  const payload = JSON.stringify({ action, ...data });

  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('Phản hồi API không hợp lệ. Kiểm tra lại URL Web App.');
    }

    if (!result.success) {
      throw new Error(result.message || 'Yêu cầu thất bại');
    }

    return result;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// ==================== AUTH ====================

/** Đăng nhập */
async function apiLogin(username, password) {
  return apiRequest('login', { username, password });
}

// ==================== TRANSACTIONS ====================

/** Lấy danh sách giao dịch */
async function apiGetTransactions(userId, filters = {}) {
  return apiRequest('getTransactions', { userId, ...filters });
}

/** Thêm giao dịch */
async function apiAddTransaction(transaction) {
  return apiRequest('addTransaction', { transaction });
}

/** Cập nhật giao dịch */
async function apiUpdateTransaction(id, transaction) {
  return apiRequest('updateTransaction', { id, transaction });
}

/** Xóa giao dịch */
async function apiDeleteTransaction(id) {
  return apiRequest('deleteTransaction', { id });
}

// ==================== CATEGORIES ====================

/** Lấy danh sách loại chi tiêu */
async function apiGetCategories() {
  return apiRequest('getCategories');
}

/** Thêm loại chi tiêu */
async function apiAddCategory(category) {
  return apiRequest('addCategory', { category });
}

/** Cập nhật loại chi tiêu */
async function apiUpdateCategory(id, category) {
  return apiRequest('updateCategory', { id, category });
}

/** Xóa loại chi tiêu */
async function apiDeleteCategory(id) {
  return apiRequest('deleteCategory', { id });
}

// ==================== SUMMARY ====================

/** Tổng kết theo tháng */
async function apiGetSummaryByMonth(userId, year, month) {
  return apiRequest('getSummaryByMonth', { userId, year, month });
}

/** Tổng kết theo năm */
async function apiGetSummaryByYear(userId, year) {
  return apiRequest('getSummaryByYear', { userId, year });
}

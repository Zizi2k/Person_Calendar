/**
 * app.js - Logic chính cho Personal Finance Calendar
 */

// ==================== STATE ====================
let currentUser = null;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let allTransactions = [];
let allCategories = [];
let allSchedules = [];
let scheduleSelectedDate = new Date();
let editingId = null;

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const DAY_HEADERS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', init);

function init() {
  // Kiểm tra đăng nhập
  const userStr = localStorage.getItem('pf_user');
  if (!userStr) {
    window.location.href = 'login.html';
    return;
  }

  currentUser = JSON.parse(userStr);
  document.getElementById('userFullname').textContent = currentUser.fullname || currentUser.username;

  setupDateTime();
  setupNavigation();
  setupMonthYearFilters();
  setupForms();
  setupCalendarControls();
  setupSchedule();
  setupLogout();

  loadData();
}

// ==================== UTILITIES ====================

/** Hiển thị/ẩn loading overlay */
function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('active', show);
}

/** Hiển thị toast thông báo */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/** Format tiền VNĐ */
function formatMoney(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString('vi-VN') + ' ₫';
}

/** Format ngày dd/mm/yyyy */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Chuyển Date sang yyyy-mm-dd cho input date */
function toInputDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Lấy ngày từ chuỗi date */
function getDateKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Validate form - kiểm tra các trường bắt buộc */
function validateFormFields(fields) {
  let valid = true;
  fields.forEach(({ id, groupId }) => {
    const el = document.getElementById(id);
    const group = document.getElementById(groupId || id + 'Group') || el?.closest('.form-group');
    const value = el?.value?.trim();
    const isValid = value && value !== '';
    if (group) group.classList.toggle('invalid', !isValid);
    if (!isValid) valid = false;
  });
  return valid;
}

/** Populate tháng/năm cho select */
function populateMonthSelect(selectEl, selectedMonth) {
  selectEl.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const opt = document.createElement('option');
    opt.value = i + 1;
    opt.textContent = MONTH_NAMES[i];
    if (i + 1 === selectedMonth) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function populateYearSelect(selectEl, selectedYear) {
  selectEl.innerHTML = '';
  const now = new Date().getFullYear();
  for (let y = now - 5; y <= now + 1; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === selectedYear) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

// ==================== DATETIME ====================
function setupDateTime() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
}

function updateDateTime() {
  const now = new Date();
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const text = `${days[now.getDay()]}, ${formatDate(now.toISOString())} - ${now.toLocaleTimeString('vi-VN')}`;
  document.getElementById('datetimeBox').textContent = text;
}

// ==================== NAVIGATION ====================
function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('section-' + tab.dataset.section).classList.add('active');

      if (tab.dataset.section === 'summary') {
        loadSummary();
      }
      if (tab.dataset.section === 'schedule') {
        renderTimetable();
        renderScheduleTable();
      }
    });
  });
}

function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('pf_user');
    window.location.href = 'login.html';
  });
}

// ==================== FILTERS ====================
function setupMonthYearFilters() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();

  ['personal', 'family', 'income'].forEach(prefix => {
    populateMonthSelect(document.getElementById(prefix + 'FilterMonth'), m);
    populateYearSelect(document.getElementById(prefix + 'FilterYear'), y);

    document.getElementById(prefix + 'FilterMonth').addEventListener('change', () => renderTransactionTable(prefix));
    document.getElementById(prefix + 'FilterYear').addEventListener('change', () => renderTransactionTable(prefix));
    document.getElementById(prefix + 'Search').addEventListener('input', () => renderTransactionTable(prefix));
  });

  populateMonthSelect(document.getElementById('summaryMonth'), m);
  populateYearSelect(document.getElementById('summaryYear'), y);

  document.getElementById('summaryMode').addEventListener('change', (e) => {
    document.getElementById('summaryMonth').style.display = e.target.value === 'month' ? '' : 'none';
  });

  document.getElementById('summaryLoadBtn').addEventListener('click', loadSummary);

  populateMonthSelect(document.getElementById('scheduleFilterMonth'), m);
  populateYearSelect(document.getElementById('scheduleFilterYear'), y);
  document.getElementById('scheduleFilterMonth').addEventListener('change', renderScheduleTable);
  document.getElementById('scheduleFilterYear').addEventListener('change', renderScheduleTable);
  document.getElementById('scheduleSearch').addEventListener('input', renderScheduleTable);
}

// ==================== DATA LOADING ====================
async function loadData() {
  showLoading(true);
  try {
    const [txResult, catResult, schResult] = await Promise.all([
      apiGetTransactions(currentUser.id),
      apiGetCategories(),
      apiGetSchedules(currentUser.id).catch(() => ({ data: [] }))
    ]);

    allTransactions = txResult.data || [];
    allCategories = catResult.data || [];
    allSchedules = schResult.data || [];

    populateCategorySelects();
    renderDashboard();
    renderTransactionTable('personal');
    renderTransactionTable('family');
    renderTransactionTable('income');
    renderCategoryTable();
    renderTimetable();
    renderScheduleTable();
  } catch (error) {
    showToast('Lỗi tải dữ liệu: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/** Điền danh sách loại chi tiêu vào các select */
function populateCategorySelects() {
  const expenseCats = allCategories.filter(c => c.type === 'expense');

  ['personalCategory', 'familyCategory'].forEach(selectId => {
    const select = document.getElementById(selectId);
    const current = select.value;
    select.innerHTML = '<option value="">-- Chọn loại --</option>';
    expenseCats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  });
}

// ==================== DASHBOARD ====================
function renderDashboard() {
  const monthTx = filterByMonth(allTransactions, currentYear, currentMonth + 1);

  let totalIncome = 0, totalExpense = 0, familyExpense = 0, personalExpense = 0;
  const categoryTotals = {};

  monthTx.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
    } else {
      totalExpense += amt;
      if (tx.groupType === 'family') familyExpense += amt;
      else personalExpense += amt;

      const cat = tx.category || 'Khác';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    }
  });

  document.getElementById('statIncome').textContent = formatMoney(totalIncome);
  document.getElementById('statExpense').textContent = formatMoney(totalExpense);
  document.getElementById('statBalance').textContent = formatMoney(totalIncome - totalExpense);
  document.getElementById('statFamily').textContent = formatMoney(familyExpense);
  document.getElementById('statPersonal').textContent = formatMoney(personalExpense);

  renderCategoryChart(categoryTotals);
  renderCalendar(monthTx);
  renderDailyList(monthTx);
}

function filterByMonth(transactions, year, month) {
  return transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

/** Biểu đồ thanh ngang theo loại chi tiêu */
function renderCategoryChart(categoryTotals) {
  const container = document.getElementById('categoryChart');
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    container.innerHTML = '<p style="color:#9e9e9e;text-align:center">Chưa có dữ liệu chi tiêu</p>';
    return;
  }

  const maxVal = entries[0][1];
  container.innerHTML = entries.map(([cat, amount]) => `
    <div class="chart-bar-row">
      <span class="chart-bar-label">${cat}</span>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width:${(amount / maxVal) * 100}%"></div>
      </div>
      <span class="chart-bar-value">${formatMoney(amount)}</span>
    </div>
  `).join('');
}

// ==================== CALENDAR ====================
function setupCalendarControls() {
  document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderDashboard();
  });

  document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderDashboard();
  });
}

function renderCalendar(monthTx) {
  const grid = document.getElementById('calendarGrid');
  document.getElementById('calendarTitle').textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  // Đếm giao dịch và lịch theo ngày
  const dayCounts = {};
  monthTx.forEach(tx => {
    const key = getDateKey(tx.date);
    dayCounts[key] = (dayCounts[key] || 0) + 1;
  });
  const monthSchedules = allSchedules.filter(s => {
    const d = new Date(s.date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });
  monthSchedules.forEach(s => {
    const key = getDateKey(s.date);
    dayCounts[key] = (dayCounts[key] || 0) + 1;
  });

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startDow = firstDay.getDay();
  const today = new Date();
  const todayKey = getDateKey(today.toISOString());

  let html = DAY_HEADERS.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

  // Ngày tháng trước
  const prevLast = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    html += `<div class="calendar-day other-month">${prevLast - i}</div>`;
  }

  // Ngày trong tháng
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const classes = ['calendar-day'];
    if (dateKey === todayKey) classes.push('today');
    if (dayCounts[dateKey]) classes.push('has-transactions');
    html += `<div class="${classes.join(' ')}" data-date="${dateKey}">${day}</div>`;
  }

  // Ngày tháng sau
  const totalCells = startDow + lastDay.getDate();
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="calendar-day other-month">${i}</div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.calendar-day[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      grid.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
      el.classList.add('selected');
      const block = document.querySelector(`.day-block[data-date="${el.dataset.date}"]`);
      if (block) block.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

/** Danh sách giao dịch theo từng ngày - dạng planner */
function renderDailyList(monthTx) {
  const container = document.getElementById('dailyList');
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Nhóm giao dịch theo ngày
  const byDay = {};
  monthTx.forEach(tx => {
    const key = getDateKey(tx.date);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(tx);
  });

  let html = '';
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const txs = byDay[dateKey] || [];
    const dayTotal = txs.reduce((sum, tx) => {
      const amt = Number(tx.amount) || 0;
      return sum + (tx.type === 'income' ? amt : -amt);
    }, 0);

    const dayLabel = formatDate(new Date(currentYear, currentMonth, day).toISOString());

    html += `
      <div class="day-block" data-date="${dateKey}">
        <div class="day-block-header">
          <span>${dayLabel}</span>
          <span class="day-total">${dayTotal >= 0 ? '+' : ''}${formatMoney(dayTotal)}</span>
        </div>
        <div class="day-block-body">
          ${txs.length === 0
            ? '<div class="empty-day">Không có giao dịch</div>'
            : txs.map(tx => renderTransactionRow(tx)).join('')
          }
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Gắn sự kiện checkbox thanh toán
  container.querySelectorAll('.paid-checkbox').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const tx = allTransactions.find(t => t.id === id);
      if (!tx) return;

      showLoading(true);
      try {
        await apiUpdateTransaction(id, { ...tx, paid: e.target.checked });
        tx.paid = e.target.checked;
        showToast('Cập nhật trạng thái thành công', 'success');
        renderDashboard();
      } catch (error) {
        e.target.checked = !e.target.checked;
        showToast('Lỗi: ' + error.message, 'error');
      } finally {
        showLoading(false);
      }
    });
  });
}

function renderTransactionRow(tx) {
  const isIncome = tx.type === 'income';
  const paid = tx.paid === true || tx.paid === 'TRUE' || tx.paid === 'true';
  const label = isIncome
    ? `+${formatMoney(tx.amount)}`
    : `-${formatMoney(tx.amount)}`;

  return `
    <div class="transaction-row ${paid ? 'paid' : ''}">
      ${!isIncome ? `<input type="checkbox" class="paid-checkbox" data-id="${tx.id}" ${paid ? 'checked' : ''} title="Đã thanh toán">` : '<span style="width:18px"></span>'}
      <span class="tx-amount ${isIncome ? 'income' : 'expense'}">${label}</span>
      <span class="tx-category">${tx.category || (isIncome ? 'Thu' : 'Chi')}</span>
      <span class="tx-desc">${tx.description || ''} ${tx.note ? '- ' + tx.note : ''}</span>
    </div>
  `;
}

// ==================== FORMS SETUP ====================
function setupForms() {
  document.getElementById('personalForm').addEventListener('submit', (e) => handleTransactionSubmit(e, 'personal'));
  document.getElementById('familyForm').addEventListener('submit', (e) => handleTransactionSubmit(e, 'family'));
  document.getElementById('incomeForm').addEventListener('submit', (e) => handleTransactionSubmit(e, 'income'));
  document.getElementById('categoryForm').addEventListener('submit', handleCategorySubmit);

  document.getElementById('personalCancelBtn').addEventListener('click', () => resetForm('personal'));
  document.getElementById('familyCancelBtn').addEventListener('click', () => resetForm('family'));
  document.getElementById('incomeCancelBtn').addEventListener('click', () => resetForm('income'));
  document.getElementById('categoryCancelBtn').addEventListener('click', () => resetForm('category'));
  document.getElementById('scheduleForm').addEventListener('submit', handleScheduleSubmit);
  document.getElementById('scheduleCancelBtn').addEventListener('click', () => resetScheduleForm());

  // Đặt ngày mặc định
  const today = toInputDate(new Date());
  document.getElementById('personalDate').value = today;
  document.getElementById('familyDate').value = today;
  document.getElementById('incomeDate').value = today;
  document.getElementById('scheduleDate').value = today;
}

// ==================== TRANSACTION CRUD ====================
async function handleTransactionSubmit(e, type) {
  e.preventDefault();

  const prefix = type;
  const fields = [
    { id: prefix + 'Date' },
    { id: prefix + 'Amount' },
    { id: type === 'income' ? 'incomeSource' : prefix + 'Category' }
  ];

  if (!validateFormFields(fields)) {
    showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
    return;
  }

  const id = document.getElementById(prefix + 'Id').value;
  let transaction = {
    userId: currentUser.id,
    type: type === 'income' ? 'income' : 'expense',
    groupType: type === 'family' ? 'family' : 'personal',
    amount: Number(document.getElementById(prefix + 'Amount').value),
    date: document.getElementById(prefix + 'Date').value,
    description: document.getElementById(prefix + 'Desc')?.value || '',
    note: document.getElementById(prefix + 'Note')?.value || '',
    paid: false
  };

  if (type === 'income') {
    transaction.category = document.getElementById('incomeSource').value;
    transaction.paymentMethod = '';
  } else if (type === 'personal') {
    transaction.category = document.getElementById('personalCategory').value;
    transaction.paymentMethod = document.getElementById('personalPayment').value;
  } else {
    transaction.category = document.getElementById('familyCategory').value;
    transaction.paymentMethod = document.getElementById('familyPerson').value;
  }

  showLoading(true);
  try {
    if (id) {
      await apiUpdateTransaction(id, transaction);
      const idx = allTransactions.findIndex(t => t.id === id);
      if (idx >= 0) allTransactions[idx] = { ...allTransactions[idx], ...transaction };
      showToast('Cập nhật thành công', 'success');
    } else {
      const result = await apiAddTransaction(transaction);
      allTransactions.push(result.data);
      showToast('Thêm thành công', 'success');
    }

    resetForm(type);
    renderDashboard();
    renderTransactionTable(type);
  } catch (error) {
    showToast('Lỗi: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function resetForm(type) {
  const prefix = type;
  document.getElementById(prefix + 'Form').reset();
  document.getElementById(prefix + 'Id').value = '';
  document.getElementById(prefix + 'Date').value = toInputDate(new Date());
  document.getElementById(prefix + 'FormTitle').textContent =
    type === 'personal' ? 'Thêm chi tiêu cá nhân' :
    type === 'family' ? 'Thêm chi tiêu gia đình' :
    type === 'income' ? 'Thêm khoản thu' : 'Thêm loại chi tiêu';
  document.getElementById(prefix + 'CancelBtn').style.display = 'none';
  editingId = null;
}

/** Render bảng giao dịch */
function renderTransactionTable(type) {
  const prefix = type;
  const month = Number(document.getElementById(prefix + 'FilterMonth').value);
  const year = Number(document.getElementById(prefix + 'FilterYear').value);
  const search = document.getElementById(prefix + 'Search').value.toLowerCase();

  let filtered = allTransactions.filter(tx => {
    const d = new Date(tx.date);
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return false;

    if (type === 'income') return tx.type === 'income';
    if (type === 'personal') return tx.type === 'expense' && tx.groupType === 'personal';
    if (type === 'family') return tx.type === 'expense' && tx.groupType === 'family';
    return true;
  });

  if (search) {
    filtered = filtered.filter(tx =>
      (tx.description || '').toLowerCase().includes(search) ||
      (tx.category || '').toLowerCase().includes(search) ||
      (tx.paymentMethod || '').toLowerCase().includes(search) ||
      (tx.note || '').toLowerCase().includes(search)
    );
  }

  const tbody = document.querySelector(`#${prefix}Table tbody`);
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#9e9e9e">Không có dữ liệu</td></tr>';
    return;
  }

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (type === 'personal') {
    tbody.innerHTML = filtered.map(tx => {
      const paid = tx.paid === true || tx.paid === 'TRUE' || tx.paid === 'true';
      return `<tr>
        <td>${formatDate(tx.date)}</td>
        <td style="color:#ef5350;font-weight:700">${formatMoney(tx.amount)}</td>
        <td><span class="badge badge-expense">${tx.category}</span></td>
        <td>${tx.description || ''}</td>
        <td>${tx.paymentMethod || ''}</td>
        <td><input type="checkbox" ${paid ? 'checked' : ''} onchange="togglePaid('${tx.id}', this.checked)"></td>
        <td class="table-actions">
          <button class="btn-icon" onclick="editTransaction('personal','${tx.id}')">Sửa</button>
          <button class="btn-icon" onclick="deleteTransaction('${tx.id}','personal')">Xóa</button>
        </td>
      </tr>`;
    }).join('');
  } else if (type === 'family') {
    tbody.innerHTML = filtered.map(tx => {
      const paid = tx.paid === true || tx.paid === 'TRUE' || tx.paid === 'true';
      return `<tr>
        <td>${formatDate(tx.date)}</td>
        <td style="color:#ef5350;font-weight:700">${formatMoney(tx.amount)}</td>
        <td><span class="badge badge-expense">${tx.category}</span></td>
        <td>${tx.paymentMethod || ''}</td>
        <td>${tx.description || ''}</td>
        <td><input type="checkbox" ${paid ? 'checked' : ''} onchange="togglePaid('${tx.id}', this.checked)"></td>
        <td class="table-actions">
          <button class="btn-icon" onclick="editTransaction('family','${tx.id}')">Sửa</button>
          <button class="btn-icon" onclick="deleteTransaction('${tx.id}','family')">Xóa</button>
        </td>
      </tr>`;
    }).join('');
  } else {
    tbody.innerHTML = filtered.map(tx => `<tr>
      <td>${formatDate(tx.date)}</td>
      <td style="color:#66bb6a;font-weight:700">${formatMoney(tx.amount)}</td>
      <td><span class="badge badge-income">${tx.category}</span></td>
      <td>${tx.description || ''}</td>
      <td>${tx.note || ''}</td>
      <td class="table-actions">
        <button class="btn-icon" onclick="editTransaction('income','${tx.id}')">Sửa</button>
        <button class="btn-icon" onclick="deleteTransaction('${tx.id}','income')">Xóa</button>
      </td>
    </tr>`).join('');
  }
}

/** Sửa giao dịch */
function editTransaction(type, id) {
  const tx = allTransactions.find(t => t.id === id);
  if (!tx) return;

  const prefix = type;
  document.getElementById(prefix + 'Id').value = id;
  document.getElementById(prefix + 'Date').value = tx.date ? tx.date.split('T')[0] : '';
  document.getElementById(prefix + 'Amount').value = tx.amount;
  document.getElementById(prefix + 'Desc').value = tx.description || '';
  document.getElementById(prefix + 'Note').value = tx.note || '';

  if (type === 'personal') {
    document.getElementById('personalCategory').value = tx.category;
    document.getElementById('personalPayment').value = tx.paymentMethod || 'Tiền mặt';
    document.getElementById('personalFormTitle').textContent = 'Sửa chi tiêu cá nhân';
  } else if (type === 'family') {
    document.getElementById('familyCategory').value = tx.category;
    document.getElementById('familyPerson').value = tx.paymentMethod || '';
    document.getElementById('familyFormTitle').textContent = 'Sửa chi tiêu gia đình';
  } else {
    document.getElementById('incomeSource').value = tx.category;
    document.getElementById('incomeFormTitle').textContent = 'Sửa khoản thu';
  }

  document.getElementById(prefix + 'CancelBtn').style.display = '';
  document.getElementById('section-' + type).scrollIntoView({ behavior: 'smooth' });
}

/** Xóa giao dịch */
async function deleteTransaction(id, type) {
  if (!confirm('Bạn có chắc muốn xóa giao dịch này?')) return;

  showLoading(true);
  try {
    await apiDeleteTransaction(id);
    allTransactions = allTransactions.filter(t => t.id !== id);
    showToast('Xóa thành công', 'success');
    renderDashboard();
    renderTransactionTable(type);
  } catch (error) {
    showToast('Lỗi: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

/** Toggle trạng thái thanh toán */
async function togglePaid(id, checked) {
  const tx = allTransactions.find(t => t.id === id);
  if (!tx) return;

  showLoading(true);
  try {
    await apiUpdateTransaction(id, { ...tx, paid: checked });
    tx.paid = checked;
    showToast('Cập nhật trạng thái thành công', 'success');
    renderDashboard();
  } catch (error) {
    showToast('Lỗi: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ==================== CATEGORY CRUD ====================
async function handleCategorySubmit(e) {
  e.preventDefault();

  if (!validateFormFields([{ id: 'categoryName' }])) {
    showToast('Vui lòng nhập tên loại chi tiêu', 'error');
    return;
  }

  const id = document.getElementById('categoryId').value;
  const category = {
    name: document.getElementById('categoryName').value.trim(),
    type: document.getElementById('categoryType').value
  };

  showLoading(true);
  try {
    if (id) {
      await apiUpdateCategory(id, category);
      const idx = allCategories.findIndex(c => c.id === id);
      if (idx >= 0) allCategories[idx] = { ...allCategories[idx], ...category };
      showToast('Cập nhật loại thành công', 'success');
    } else {
      const result = await apiAddCategory(category);
      allCategories.push(result.data);
      showToast('Thêm loại thành công', 'success');
    }

    resetForm('category');
    populateCategorySelects();
    renderCategoryTable();
  } catch (error) {
    showToast('Lỗi: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function renderCategoryTable() {
  const tbody = document.querySelector('#categoryTable tbody');
  if (allCategories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#9e9e9e">Chưa có loại chi tiêu</td></tr>';
    return;
  }

  tbody.innerHTML = allCategories.map(cat => `<tr>
    <td>${cat.name}</td>
    <td><span class="badge ${cat.type === 'income' ? 'badge-income' : 'badge-expense'}">${cat.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}</span></td>
    <td class="table-actions">
      <button class="btn-icon" onclick="editCategory('${cat.id}')">Sửa</button>
      <button class="btn-icon" onclick="deleteCategory('${cat.id}')">Xóa</button>
    </td>
  </tr>`).join('');
}

function editCategory(id) {
  const cat = allCategories.find(c => c.id === id);
  if (!cat) return;

  document.getElementById('categoryId').value = id;
  document.getElementById('categoryName').value = cat.name;
  document.getElementById('categoryType').value = cat.type;
  document.getElementById('categoryFormTitle').textContent = 'Sửa loại chi tiêu';
  document.getElementById('categoryCancelBtn').style.display = '';
}

async function deleteCategory(id) {
  if (!confirm('Bạn có chắc muốn xóa loại này?')) return;

  showLoading(true);
  try {
    await apiDeleteCategory(id);
    allCategories = allCategories.filter(c => c.id !== id);
    showToast('Xóa loại thành công', 'success');
    populateCategorySelects();
    renderCategoryTable();
  } catch (error) {
    showToast('Lỗi: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ==================== SUMMARY ====================
async function loadSummary() {
  const mode = document.getElementById('summaryMode').value;
  const year = Number(document.getElementById('summaryYear').value);
  const month = Number(document.getElementById('summaryMonth').value);
  const container = document.getElementById('summaryContent');

  showLoading(true);
  try {
    let data;
    if (mode === 'month') {
      const result = await apiGetSummaryByMonth(currentUser.id, year, month);
      data = result.data;
      renderMonthSummary(container, data, year, month);
    } else {
      const result = await apiGetSummaryByYear(currentUser.id, year);
      data = result.data;
      renderYearSummary(container, data, year);
    }
  } catch (error) {
    container.innerHTML = `<p style="color:#ef5350">Lỗi: ${error.message}</p>`;
  } finally {
    showLoading(false);
  }
}

function renderMonthSummary(container, data, year, month) {
  const totalIncome = data.totalIncome || 0;
  const totalExpense = data.totalExpense || 0;
  const balance = totalIncome - totalExpense;
  const totalAll = totalIncome + totalExpense || 1;

  container.innerHTML = `
    <h3 style="color:var(--purple-dark);margin-bottom:12px">${MONTH_NAMES[month - 1]} ${year}</h3>

    <div class="summary-grid">
      <div class="card" style="margin:0">
        <div class="summary-item"><span>Tổng thu</span><span class="amount" style="color:#66bb6a">${formatMoney(totalIncome)}</span></div>
        <div class="summary-item"><span>Tổng chi</span><span class="amount" style="color:#ef5350">${formatMoney(totalExpense)}</span></div>
        <div class="summary-item"><span>Chi cá nhân</span><span class="amount">${formatMoney(data.personalExpense || 0)}</span></div>
        <div class="summary-item"><span>Chi gia đình</span><span class="amount">${formatMoney(data.familyExpense || 0)}</span></div>
        <div class="summary-item"><span>Số dư</span><span class="amount" style="color:#42a5f5;font-weight:700">${formatMoney(balance)}</span></div>
      </div>

      <div class="card" style="margin:0">
        <div class="card-title" style="font-size:0.95rem">So sánh Thu - Chi</div>
        <div class="compare-bar">
          <div class="compare-income" style="width:${(totalIncome / totalAll) * 100}%">Thu</div>
          <div class="compare-expense" style="width:${(totalExpense / totalAll) * 100}%">Chi</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-title">Chi tiết theo loại</div>
      <table class="data-table">
        <thead><tr><th>Loại</th><th>Số tiền</th><th>Tỷ lệ</th></tr></thead>
        <tbody>
          ${Object.entries(data.byCategory || {}).map(([cat, amt]) => `
            <tr>
              <td>${cat}</td>
              <td style="font-weight:700">${formatMoney(amt)}</td>
              <td>${totalExpense ? ((amt / totalExpense) * 100).toFixed(1) : 0}%</td>
            </tr>
          `).join('') || '<tr><td colspan="3" style="text-align:center">Không có dữ liệu</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function renderYearSummary(container, data, year) {
  const months = data.months || [];
  container.innerHTML = `
    <h3 style="color:var(--purple-dark);margin-bottom:12px">Tổng kết năm ${year}</h3>

    <div class="summary-grid">
      <div class="card" style="margin:0">
        <div class="summary-item"><span>Tổng thu năm</span><span class="amount" style="color:#66bb6a">${formatMoney(data.totalIncome || 0)}</span></div>
        <div class="summary-item"><span>Tổng chi năm</span><span class="amount" style="color:#ef5350">${formatMoney(data.totalExpense || 0)}</span></div>
        <div class="summary-item"><span>Số dư năm</span><span class="amount" style="color:#42a5f5;font-weight:700">${formatMoney((data.totalIncome || 0) - (data.totalExpense || 0))}</span></div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-title">Chi tiết theo tháng</div>
      <table class="data-table">
        <thead><tr><th>Tháng</th><th>Thu</th><th>Chi</th><th>Số dư</th></tr></thead>
        <tbody>
          ${months.map((m, i) => `
            <tr>
              <td>${MONTH_NAMES[i]}</td>
              <td style="color:#66bb6a">${formatMoney(m.income)}</td>
              <td style="color:#ef5350">${formatMoney(m.expense)}</td>
              <td style="font-weight:700">${formatMoney(m.income - m.expense)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-title">Chi tiết theo loại (cả năm)</div>
      <table class="data-table">
        <thead><tr><th>Loại</th><th>Số tiền</th></tr></thead>
        <tbody>
          ${Object.entries(data.byCategory || {}).map(([cat, amt]) => `
            <tr><td>${cat}</td><td style="font-weight:700">${formatMoney(amt)}</td></tr>
          `).join('') || '<tr><td colspan="2" style="text-align:center">Không có dữ liệu</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// ==================== SCHEDULE (THỜI KHÓA BIỂU) ====================

/** Khởi tạo module thời khóa biểu */
function setupSchedule() {
  document.getElementById('schedulePrevDay').addEventListener('click', () => {
    scheduleSelectedDate.setDate(scheduleSelectedDate.getDate() - 1);
    syncScheduleDateInput();
    renderTimetable();
  });

  document.getElementById('scheduleNextDay').addEventListener('click', () => {
    scheduleSelectedDate.setDate(scheduleSelectedDate.getDate() + 1);
    syncScheduleDateInput();
    renderTimetable();
  });

  document.getElementById('scheduleTodayBtn').addEventListener('click', () => {
    scheduleSelectedDate = new Date();
    syncScheduleDateInput();
    renderTimetable();
  });

  document.getElementById('scheduleDate').addEventListener('change', (e) => {
    scheduleSelectedDate = new Date(e.target.value + 'T00:00:00');
    renderTimetable();
  });
}

function syncScheduleDateInput() {
  document.getElementById('scheduleDate').value = toInputDate(scheduleSelectedDate);
  renderTimetable();
}

/** Format giờ HH:mm */
function formatTimeDisplay(timeStr) {
  if (!timeStr) return '';
  return String(timeStr).substring(0, 5);
}

/** Lấy lịch theo ngày đã chọn */
function getSchedulesForDate(date) {
  const key = toInputDate(date);
  return allSchedules
    .filter(s => String(s.date).split('T')[0] === key)
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
}

/** Render bảng thời khóa biểu theo giờ (6h - 22h) */
function renderTimetable() {
  const container = document.getElementById('timetable');
  const label = document.getElementById('scheduleDayLabel');
  if (!container || !label) return;

  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  label.textContent = `${days[scheduleSelectedDate.getDay()]}, ${formatDate(scheduleSelectedDate.toISOString())}`;

  const daySchedules = getSchedulesForDate(scheduleSelectedDate);

  let html = '';
  for (let h = 6; h <= 22; h++) {
    const timeLabel = String(h).padStart(2, '0') + ':00';
    const hourStr = String(h).padStart(2, '0');

    const blocks = daySchedules.filter(s => {
      const startHour = String(s.startTime).substring(0, 2);
      return startHour === hourStr;
    });

    html += `<div class="timetable-row">
      <div class="timetable-time">${timeLabel}</div>
      <div class="timetable-slot ${blocks.length === 0 ? 'empty' : ''}">`;

    if (blocks.length > 0) {
      blocks.forEach(s => {
        html += renderScheduleBlock(s);
      });
    }

    html += `</div></div>`;
  }

  if (daySchedules.length === 0) {
    html += '<div class="timetable-empty">Chưa có lịch làm việc trong ngày này</div>';
  }

  container.innerHTML = html;
}

/** Map loại lịch sang class CSS */
function getScheduleTypeClass(type) {
  const map = { 'Công việc': 'work', 'Học tập': 'study', 'Họp': 'meeting', 'Cá nhân': 'personal', 'Khác': 'other' };
  return 'type-' + (map[type] || 'other');
}

/** Render 1 khối lịch */
function renderScheduleBlock(s) {
  const completed = s.completed === true || s.completed === 'TRUE' || s.completed === 'true';
  const typeClass = getScheduleTypeClass(s.type);
  const meta = [s.location, s.description].filter(Boolean).join(' · ');

  return `
    <div class="schedule-block ${typeClass} ${completed ? 'completed' : ''}">
      <input type="checkbox" ${completed ? 'checked' : ''} onchange="toggleScheduleComplete('${s.id}', this.checked)" title="Hoàn thành">
      <span class="schedule-block-time">${formatTimeDisplay(s.startTime)} - ${formatTimeDisplay(s.endTime)}</span>
      <div class="schedule-block-body">
        <div class="schedule-block-title">${s.title}</div>
        ${meta ? `<div class="schedule-block-meta">${meta}</div>` : ''}
      </div>
      <span class="badge-schedule">${s.type || 'Khác'}</span>
      <div class="schedule-block-actions">
        <button class="btn-icon" onclick="editSchedule('${s.id}')">Sửa</button>
        <button class="btn-icon" onclick="deleteScheduleItem('${s.id}')">Xóa</button>
      </div>
    </div>`;
}

/** Render bảng danh sách lịch tháng */
function renderScheduleTable() {
  const tbody = document.querySelector('#scheduleTable tbody');
  if (!tbody) return;

  const month = Number(document.getElementById('scheduleFilterMonth').value);
  const year = Number(document.getElementById('scheduleFilterYear').value);
  const search = document.getElementById('scheduleSearch').value.toLowerCase();

  let filtered = allSchedules.filter(s => {
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  if (search) {
    filtered = filtered.filter(s =>
      (s.title || '').toLowerCase().includes(search) ||
      (s.location || '').toLowerCase().includes(search) ||
      (s.type || '').toLowerCase().includes(search) ||
      (s.description || '').toLowerCase().includes(search)
    );
  }

  filtered.sort((a, b) => {
    const d = String(a.date).localeCompare(String(b.date));
    return d !== 0 ? d : String(a.startTime).localeCompare(String(b.startTime));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9e9e9e">Không có dữ liệu</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const completed = s.completed === true || s.completed === 'TRUE' || s.completed === 'true';
    return `<tr>
      <td>${formatDate(s.date)}</td>
      <td>${formatTimeDisplay(s.startTime)} - ${formatTimeDisplay(s.endTime)}</td>
      <td style="font-weight:600">${s.title}</td>
      <td><span class="badge-schedule">${s.type || 'Khác'}</span></td>
      <td>${s.location || ''}</td>
      <td><input type="checkbox" ${completed ? 'checked' : ''} onchange="toggleScheduleComplete('${s.id}', this.checked)"></td>
      <td class="table-actions">
        <button class="btn-icon" onclick="editSchedule('${s.id}')">Sửa</button>
        <button class="btn-icon" onclick="deleteScheduleItem('${s.id}')">Xóa</button>
      </td>
    </tr>`;
  }).join('');
}

/** Thêm / sửa lịch */
async function handleScheduleSubmit(e) {
  e.preventDefault();

  const fields = [
    { id: 'scheduleDate' },
    { id: 'scheduleStart' },
    { id: 'scheduleEnd' },
    { id: 'scheduleTitle' }
  ];

  if (!validateFormFields(fields)) {
    showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
    return;
  }

  const start = document.getElementById('scheduleStart').value;
  const end = document.getElementById('scheduleEnd').value;
  if (start >= end) {
    showToast('Giờ kết thúc phải sau giờ bắt đầu', 'error');
    return;
  }

  const id = document.getElementById('scheduleId').value;
  const schedule = {
    userId: currentUser.id,
    date: document.getElementById('scheduleDate').value,
    startTime: start,
    endTime: end,
    title: document.getElementById('scheduleTitle').value.trim(),
    type: document.getElementById('scheduleType').value,
    description: document.getElementById('scheduleDesc').value.trim(),
    location: document.getElementById('scheduleLocation').value.trim(),
    note: document.getElementById('scheduleNote').value.trim(),
    completed: false
  };

  showLoading(true);
  try {
    if (id) {
      const existing = allSchedules.find(s => s.id === id);
      schedule.completed = existing ? existing.completed : false;
      await apiUpdateSchedule(id, schedule);
      const idx = allSchedules.findIndex(s => s.id === id);
      if (idx >= 0) allSchedules[idx] = { ...allSchedules[idx], ...schedule, id };
      showToast('Cập nhật lịch thành công', 'success');
    } else {
      const result = await apiAddSchedule(schedule);
      allSchedules.push(result.data);
      showToast('Thêm lịch thành công', 'success');
    }

    resetScheduleForm();
    scheduleSelectedDate = new Date(schedule.date + 'T00:00:00');
    renderDashboard();
    renderTimetable();
    renderScheduleTable();
  } catch (error) {
    showToast('Lỗi: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function resetScheduleForm() {
  document.getElementById('scheduleForm').reset();
  document.getElementById('scheduleId').value = '';
  document.getElementById('scheduleDate').value = toInputDate(scheduleSelectedDate);
  document.getElementById('scheduleFormTitle').textContent = 'Thêm lịch làm việc';
  document.getElementById('scheduleCancelBtn').style.display = 'none';
}

function editSchedule(id) {
  const s = allSchedules.find(item => item.id === id);
  if (!s) return;

  document.getElementById('scheduleId').value = id;
  document.getElementById('scheduleDate').value = String(s.date).split('T')[0];
  document.getElementById('scheduleStart').value = formatTimeDisplay(s.startTime);
  document.getElementById('scheduleEnd').value = formatTimeDisplay(s.endTime);
  document.getElementById('scheduleTitle').value = s.title || '';
  document.getElementById('scheduleType').value = s.type || 'Công việc';
  document.getElementById('scheduleDesc').value = s.description || '';
  document.getElementById('scheduleLocation').value = s.location || '';
  document.getElementById('scheduleNote').value = s.note || '';
  document.getElementById('scheduleFormTitle').textContent = 'Sửa lịch làm việc';
  document.getElementById('scheduleCancelBtn').style.display = '';

  scheduleSelectedDate = new Date(String(s.date).split('T')[0] + 'T00:00:00');

  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.querySelector('[data-section="schedule"]').classList.add('active');
  document.getElementById('section-schedule').classList.add('active');

  renderTimetable();
  document.getElementById('scheduleForm').scrollIntoView({ behavior: 'smooth' });
}

async function deleteScheduleItem(id) {
  if (!confirm('Bạn có chắc muốn xóa mục lịch này?')) return;

  showLoading(true);
  try {
    await apiDeleteSchedule(id);
    allSchedules = allSchedules.filter(s => s.id !== id);
    showToast('Xóa lịch thành công', 'success');
    renderDashboard();
    renderTimetable();
    renderScheduleTable();
  } catch (error) {
    showToast('Lỗi: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function toggleScheduleComplete(id, checked) {
  const s = allSchedules.find(item => item.id === id);
  if (!s) return;

  showLoading(true);
  try {
    await apiUpdateSchedule(id, { ...s, completed: checked });
    s.completed = checked;
    showToast('Cập nhật trạng thái thành công', 'success');
    renderTimetable();
    renderScheduleTable();
  } catch (error) {
    showToast('Lỗi: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

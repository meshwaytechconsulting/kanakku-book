/* ============================================
   கணக்கு Book — User Password Authentication Engine & Isolated Data System
   With Cross-Device Cloud Data Sync Engine
   ============================================ */

const STORAGE_USERS_KEY = 'expenseflow_auth_users_v9';
const STORAGE_SESSION_KEY = 'expenseflow_active_session_v9';
const CURRENCY = '₹';
const DEFAULT_SAVINGS_TYPES = ['General Savings / SIP', 'Recurring Deposit (RD)', 'Fixed Deposit (FD)', 'PPF / Postal Savings'];
const CLOUD_VAULT_KEY = 'kanakku_book_cloud_vault_v1';

// ─── Simple Password Hash Helper ─────────────
function hashPassword(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'pwd_' + Math.abs(hash).toString(36) + '_' + str.length;
}

const DEFAULT_USERS = [
  { id: 'usr_hari', firstName: 'Hari', lastName: 'Karthik', name: 'Hari Karthik', email: 'hari@company.com', passwordHash: hashPassword('123456'), avatar: '👨‍💼' },
];

// ─── Date Helpers ─────────────────────────────
function getTodayDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getCurrentMonthName() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date();
  return `${months[today.getMonth()]} ${today.getFullYear()}`;
}

function createDefaultMonthData() {
  return {
    income: { total: 0, entries: [], needsPct: 50, savingsPct: 20, wantsPct: 10 },
    initialBankBalance: 0,
    banks: [],
    deposits: [],
    wants: [],
    needs: [],
    savings: [],
    dailyExpenses: {},
  };
}

function formatAccountNum(accNum) {
  if (!accNum) return 'N/A';
  const str = String(accNum).trim();
  if (str.length > 4) {
    return `•••• ${str.slice(-4)}`;
  }
  return str;
}

function getMonthYearFromState() {
  const parts = (state.currentMonth || getCurrentMonthName()).split(' ');
  const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
  const monthIndex = monthMap[parts[0]] !== undefined ? monthMap[parts[0]] : new Date().getMonth();
  const year = parseInt(parts[1], 10) || new Date().getFullYear();
  return { monthIndex, year, monthStr: parts[0] };
}

function getDaysInCurrentMonth() {
  const { monthIndex, year } = getMonthYearFromState();
  return new Date(year, monthIndex + 1, 0).getDate();
}

// ─── Supabase Cross-Device Cloud Data Sync Engine ──────────────────
const SUPABASE_URL = 'https://cqwteaieumdldqjpnvdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxd3RlYWlldW1kbGRxanBudmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTMyOTEsImV4cCI6MjEwMDgyOTI5MX0.xxCNuIaY88JQ1aRk_et-b8qqROBoRWA31hfnp2qH4dg';

let supabaseClient = null;
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return supabaseClient;
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return null;
}

function updateCloudSyncBadge(statusText, isSuccess = true) {
  const badge = document.getElementById('cloudSyncStatusBadge');
  if (!badge) return;
  const parts = statusText.split(' ');
  const emoji = parts[0];
  const text = parts.slice(1).join(' ');
  badge.innerHTML = `${emoji} <span class="hide-mobile">${text}</span>`;
  badge.style.color = isSuccess ? 'var(--accent)' : 'var(--red)';
}

function showAuthError(message) {
  const banner = document.getElementById('authErrorBanner');
  const text = document.getElementById('authErrorText');
  if (banner && text) {
    text.textContent = message;
    banner.style.display = 'flex';
  }
  showToast(message, 'error');
}

function clearAuthError() {
  const banner = document.getElementById('authErrorBanner');
  if (banner) {
    banner.style.display = 'none';
  }
}

async function syncUsersToCloud() {
  try {
    const user = getAuthenticatedUser();
    if (!user) return;
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from('app_users').upsert({
      id: user.id,
      email: user.email.toLowerCase(),
      first_name: user.firstName || '',
      last_name: user.lastName || '',
      full_name: user.name || '',
      password_hash: user.passwordHash || '',
      avatar: user.avatar || '💼',
    }, { onConflict: 'id' });
    if (error) console.warn('Cloud user sync error:', error.message);
  } catch (e) { console.warn('Cloud user sync failed:', e); }
}

async function fetchUsersFromCloud() {
  // Queries performed dynamically by email on signIn
}

async function fetchCloudUserByEmail(email) {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from('app_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      name: data.full_name,
      email: data.email,
      passwordHash: data.password_hash,
      avatar: data.avatar,
    };
  } catch (e) { return null; }
}

async function syncUserDataToCloud(userId) {
  if (!userId) return;
  updateCloudSyncBadge('☁️ Syncing...', true);
  try {
    const sb = getSupabase();
    if (!sb) { updateCloudSyncBadge('☁️ Saved Locally', true); return; }
    const { error } = await sb.from('user_data').upsert({
      user_id: userId,
      data: state,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (!error) {
      updateCloudSyncBadge('☁️ Synced to Cloud', true);
    } else {
      console.warn('Cloud data sync error:', error.message);
      updateCloudSyncBadge('☁️ Saved Locally', true);
    }
  } catch (e) {
    updateCloudSyncBadge('☁️ Saved Locally', true);
  }
}

async function fetchUserDataFromCloud(userId, isManual = false) {
  if (!userId) return;
  updateCloudSyncBadge('☁️ Fetching...', true);
  try {
    const sb = getSupabase();
    if (!sb) { 
      updateCloudSyncBadge('☁️ Saved Locally', true); 
      if (isManual) showToast('Could not connect to Cloud Database.', 'error');
      return; 
    }
    const { data, error } = await sb
      .from('user_data')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    if (!error && data && data.data && data.data.data) {
      state = data.data;
      saveToStorage(false);
      renderAll();
      updateCloudSyncBadge('☁️ Synced to Cloud', true);
      if (isManual) showToast('Finances synchronized across devices!', 'success');
    } else {
      updateCloudSyncBadge('☁️ Synced to Cloud', true);
      if (isManual) showToast('Data sync failed or no data found.', 'error');
    }
  } catch (e) {
    updateCloudSyncBadge('☁️ Synced to Cloud', true);
    if (isManual) showToast('Error during cloud sync.', 'error');
  }
}

// ─── Multi-User Password Auth Registry ─────────
let authState = {
  users: [...DEFAULT_USERS],
  activeUserId: null,
};

function getUserStorageKey(userId) {
  return `expenseflow_user_data_${userId}`;
}

function loadUsersState() {
  try {
    const saved = localStorage.getItem(STORAGE_USERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        authState.users = parsed;
      }
    } else {
      saveUsersState();
    }
  } catch (e) {
    saveUsersState();
  }

  try {
    const activeId = localStorage.getItem(STORAGE_SESSION_KEY);
    if (activeId && authState.users.some(u => u.id === activeId)) {
      authState.activeUserId = activeId;
    } else {
      authState.activeUserId = null;
    }
  } catch (e) {
    authState.activeUserId = null;
  }

  fetchUsersFromCloud();
}

function saveUsersState() {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(authState.users));
    if (authState.activeUserId) {
      localStorage.setItem(STORAGE_SESSION_KEY, authState.activeUserId);
    } else {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }
  } catch (e) {}

  syncUsersToCloud();
}

function getAuthenticatedUser() {
  if (!authState.activeUserId) return null;
  return authState.users.find(u => u.id === authState.activeUserId) || null;
}

// ─── App State (Isolated Per User) ────────────
let state = {
  currentMonth: getCurrentMonthName(),
  viewMode: 'month',
  customStartDate: getTodayDate(),
  customEndDate: getTodayDate(),
  registeredAccounts: [],
  registeredSavingsInstruments: [],
  customSavingsTypes: [...DEFAULT_SAVINGS_TYPES],
  data: {},
};

let charts = { expense: null, daily: null, dailySection: null };
let editContext = null;

// ─── Initialization ───────────────────────────
async function init() {
  // Restore saved theme preference
  const savedTheme = localStorage.getItem('kanakku_theme');
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) { themeBtn.textContent = '☀️'; themeBtn.title = 'Switch to Dark Theme'; }
  }

  loadUsersState();
  await checkAuthSession();
  setDefaultDates();
  setupEventListeners();
}

async function checkAuthSession() {
  const landingScreen = document.getElementById('authLandingScreen');
  const appWrapper = document.getElementById('appWrapper');
  const authUser = getAuthenticatedUser();

  if (!authUser) {
    if (landingScreen) landingScreen.style.display = 'flex';
    if (appWrapper) appWrapper.style.display = 'none';
  } else {
    if (landingScreen) landingScreen.style.display = 'none';
    if (appWrapper) appWrapper.style.display = 'block';
    loadFromStorage();
    renderAll();
    fetchUserDataFromCloud(authUser.id);
  }
}

async function signIn(email, password) {
  clearAuthError();
  const cleanEmail = (email || '').trim().toLowerCase();
  const pwd = (password || '').trim();

  if (!cleanEmail) {
    showAuthError('Please enter your email address.');
    return false;
  }
  if (!pwd) {
    showAuthError('Please enter your password.');
    return false;
  }

  const pHash = hashPassword(pwd);

  let matched = authState.users.find(u => u.email.toLowerCase() === cleanEmail && u.passwordHash === pHash);

  if (!matched) {
    // Attempt Supabase cloud lookup for user from another device
    const cloudUser = await fetchCloudUserByEmail(cleanEmail);
    if (cloudUser && cloudUser.passwordHash === pHash) {
      // Add cloud user to local registry
      const existsLocally = authState.users.some(u => u.id === cloudUser.id);
      if (!existsLocally) {
        authState.users.push(cloudUser);
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(authState.users));
      }
      matched = cloudUser;
    }
  }

  if (!matched) {
    showAuthError('Incorrect email address or password. Please check your credentials and try again.');
    return false;
  }

  authState.activeUserId = matched.id;
  saveUsersState();
  await checkAuthSession();
  showToast(`Welcome back, ${matched.firstName || matched.name}!`, 'success');
  return true;
}

async function registerAccount(firstName, lastName, email, password, confirmPassword) {
  clearAuthError();
  const cleanFirstName = (firstName || '').trim();
  const cleanLastName = (lastName || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const pwd = (password || '').trim();
  const confirmPwd = (confirmPassword || '').trim();

  if (!cleanFirstName) { showAuthError('Please enter your First Name.'); return false; }
  if (!cleanEmail || !cleanEmail.includes('@')) { showAuthError('Please enter a valid Email Address.'); return false; }
  if (!pwd || pwd.length < 4) { showAuthError('Password must be at least 4 characters.'); return false; }
  if (pwd !== confirmPwd) { showAuthError('Passwords do not match. Please re-enter.'); return false; }

  // Check locally
  const existsLocal = authState.users.some(u => u.email.toLowerCase() === cleanEmail);
  if (existsLocal) {
    showAuthError(`An account with email "${cleanEmail}" already exists. Please sign in instead.`);
    return false;
  }

  // Check cloud for duplicate
  const cloudUser = await fetchCloudUserByEmail(cleanEmail);
  if (cloudUser) {
    showAuthError(`An account with email "${cleanEmail}" already exists in the cloud. Please sign in instead.`);
    return false;
  }

  const fullName = `${cleanFirstName} ${cleanLastName}`.trim();
  const newId = 'usr_' + Date.now();
  const newUser = {
    id: newId,
    firstName: cleanFirstName,
    lastName: cleanLastName,
    name: fullName,
    email: cleanEmail,
    passwordHash: hashPassword(pwd),
    avatar: '💼',
  };

  authState.users.push(newUser);
  authState.activeUserId = newId;
  saveUsersState();

  const monthName = getCurrentMonthName();
  state = {
    currentMonth: monthName,
    viewMode: 'month',
    customStartDate: getTodayDate(),
    customEndDate: getTodayDate(),
    registeredAccounts: [],
    registeredSavingsInstruments: [],
    customSavingsTypes: [...DEFAULT_SAVINGS_TYPES],
    data: {},
  };
  state.data[monthName] = createDefaultMonthData();
  saveToStorage();

  checkAuthSession();
  showToast(`Account created for ${cleanFirstName}!`, 'success');
  return true;
}

function logout() {
  saveToStorage();
  authState.activeUserId = null;
  saveUsersState();
  closeUserSwitchModal();
  checkAuthSession();
  showToast('Logged out securely', 'info');
}

function deleteCurrentAccount() {
  const user = getAuthenticatedUser();
  if (!user) return;

  if (!confirm(`Delete account for "${user.name} (${user.email})"? All isolated data will be permanently erased.`)) {
    return;
  }

  try {
    localStorage.removeItem(getUserStorageKey(user.id));
  } catch (e) {}

  authState.users = authState.users.filter(u => u.id !== user.id);
  authState.activeUserId = null;
  saveUsersState();

  closeUserSwitchModal();
  checkAuthSession();
  showToast('Account permanently deleted', 'info');
}

function setDefaultDates() {
  const today = getTodayDate();
  const dateInputs = ['incomeDateInput', 'bankEntryDateInput', 'savingsEntryDateInput', 'wantsDateInput', 'needsDateInput', 'startDateInput', 'endDateInput'];
  dateInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });
}

// ─── Storage per User ─────────────────────────
function saveToStorage(pushToCloud = true) {
  if (!authState.activeUserId) return;
  try {
    const key = getUserStorageKey(authState.activeUserId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    showToast('Failed to save user data', 'error');
  }

  if (pushToCloud) {
    syncUserDataToCloud(authState.activeUserId);
  }
}

function loadFromStorage() {
  if (!authState.activeUserId) return;
  try {
    const key = getUserStorageKey(authState.activeUserId);
    const saved = localStorage.getItem(key);
    if (saved) {
      state = JSON.parse(saved);
      if (!state.registeredAccounts) state.registeredAccounts = [];
      if (!state.registeredSavingsInstruments) state.registeredSavingsInstruments = [];
      if (!state.customSavingsTypes || state.customSavingsTypes.length === 0) {
        state.customSavingsTypes = [...DEFAULT_SAVINGS_TYPES];
      }
      if (!state.data || Object.keys(state.data).length === 0) {
        state.data = {};
        const monthName = getCurrentMonthName();
        state.data[monthName] = createDefaultMonthData();
        state.currentMonth = monthName;
      }
    } else {
      const monthName = getCurrentMonthName();
      state = {
        currentMonth: monthName,
        viewMode: 'month',
        customStartDate: getTodayDate(),
        customEndDate: getTodayDate(),
        registeredAccounts: [],
        registeredSavingsInstruments: [],
        customSavingsTypes: [...DEFAULT_SAVINGS_TYPES],
        data: {},
      };
      state.data[monthName] = createDefaultMonthData();
      saveToStorage();
    }
  } catch (e) {
    const monthName = getCurrentMonthName();
    state = {
      currentMonth: monthName,
      viewMode: 'month',
      customStartDate: getTodayDate(),
      customEndDate: getTodayDate(),
      registeredAccounts: [],
      registeredSavingsInstruments: [],
      customSavingsTypes: [...DEFAULT_SAVINGS_TYPES],
      data: {},
    };
    state.data[monthName] = createDefaultMonthData();
    saveToStorage();
  }
}

function renderUserBadge() {
  const user = getAuthenticatedUser();
  if (!user) return;
  const firstNameOnly = user.firstName || (user.name ? user.name.split(' ')[0] : 'User');
  document.getElementById('currentUserAvatar').textContent = user.avatar || '💼';
  document.getElementById('currentUserName').textContent = firstNameOnly;
  document.getElementById('currentUserEmail').textContent = user.email || 'No email';
  if (document.getElementById('mobileUserAvatar')) {
    document.getElementById('mobileUserAvatar').textContent = user.avatar || '💼';
  }
}

function openAccountSettingsModal() {
  const user = getAuthenticatedUser();
  if (!user) return;

  const fName = user.firstName || (user.name ? user.name.split(' ')[0] : '');
  const lName = user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : '');

  document.getElementById('modalUserAvatar').textContent = user.avatar || '💼';
  document.getElementById('modalUserName').textContent = user.name || `${fName} ${lName}`.trim();
  document.getElementById('modalUserEmail').textContent = user.email;

  document.getElementById('editFirstNameInput').value = fName;
  document.getElementById('editLastNameInput').value = lName;

  // Clear password inputs
  if (document.getElementById('changeCurrentPwdInput')) document.getElementById('changeCurrentPwdInput').value = '';
  if (document.getElementById('changeNewPwdInput')) document.getElementById('changeNewPwdInput').value = '';
  if (document.getElementById('changeConfirmPwdInput')) document.getElementById('changeConfirmPwdInput').value = '';

  document.getElementById('userSwitchModal').classList.add('active');
}

function saveProfileName() {
  const user = getAuthenticatedUser();
  if (!user) return;

  const fName = document.getElementById('editFirstNameInput').value.trim();
  const lName = document.getElementById('editLastNameInput').value.trim();

  if (!fName) {
    showToast('First Name cannot be empty', 'error');
    return;
  }

  user.firstName = fName;
  user.lastName = lName;
  user.name = `${fName} ${lName}`.trim();

  saveUsersState();
  renderUserBadge();

  document.getElementById('modalUserName').textContent = user.name;
  showToast(`Profile name updated to ${user.name}!`, 'success');
}

function changePassword() {
  const user = getAuthenticatedUser();
  if (!user) return;

  const currentPwd = document.getElementById('changeCurrentPwdInput').value;
  const newPwd = document.getElementById('changeNewPwdInput').value;
  const confirmPwd = document.getElementById('changeConfirmPwdInput').value;

  if (!currentPwd) { showToast('Enter current password', 'error'); return; }
  if (hashPassword(currentPwd) !== user.passwordHash) { showToast('Current password is incorrect', 'error'); return; }
  if (!newPwd || newPwd.length < 4) { showToast('New password must be at least 4 characters', 'error'); return; }
  if (newPwd !== confirmPwd) { showToast('New passwords do not match', 'error'); return; }

  user.passwordHash = hashPassword(newPwd);
  saveUsersState();

  document.getElementById('changeCurrentPwdInput').value = '';
  document.getElementById('changeNewPwdInput').value = '';
  document.getElementById('changeConfirmPwdInput').value = '';

  showToast('Password updated successfully!', 'success');
}

function closeUserSwitchModal() {
  document.getElementById('userSwitchModal').classList.remove('active');
}

function fmt(value) {
  if (value === undefined || value === null || isNaN(value)) return `${CURRENCY} 0.00`;
  return `${CURRENCY} ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getCurrentData() {
  if (!state.currentMonth || !state.data[state.currentMonth]) {
    const monthName = state.currentMonth || getCurrentMonthName();
    state.data[monthName] = createDefaultMonthData();
    state.currentMonth = monthName;
  }
  return state.data[state.currentMonth];
}

// ─── Date Filtering ───────────────────────────
function isDateInRange(dateStr) {
  if (state.viewMode === 'month') return true;
  if (!dateStr) return true;

  const target = new Date(dateStr).getTime();
  const start = state.customStartDate ? new Date(state.customStartDate).getTime() : 0;
  const end = state.customEndDate ? new Date(state.customEndDate).getTime() + (24 * 60 * 60 * 1000 - 1) : Infinity;

  return target >= start && target <= end;
}

function getFilteredData() {
  const d = getCurrentData();
  if (state.viewMode === 'month') return d;

  let allNeeds = [];
  let allWants = [];
  let allSavings = [];
  let allDeposits = [];
  let allBanks = [];

  Object.values(state.data).forEach(m => {
    allNeeds = allNeeds.concat((m.needs || []).filter(item => isDateInRange(item.date)));
    allWants = allWants.concat((m.wants || []).filter(item => isDateInRange(item.date)));
    allSavings = allSavings.concat((m.savings || []).filter(item => isDateInRange(item.date)));
    allDeposits = allDeposits.concat((m.deposits || []).filter(item => isDateInRange(item.date)));
    allBanks = allBanks.concat((m.banks || []).filter(item => isDateInRange(item.date)));
  });

  return {
    income: d.income,
    initialBankBalance: d.initialBankBalance,
    banks: allBanks.length > 0 ? allBanks : (d.banks || []),
    deposits: allDeposits.length > 0 ? allDeposits : (d.deposits || []),
    wants: allWants,
    needs: allNeeds,
    savings: allSavings,
    dailyExpenses: d.dailyExpenses || {},
  };
}

// ─── Automated Daily Breakdown Directly Proportional to Days of Month ──
function getDailyBreakdown(d) {
  const daysInMonth = getDaysInCurrentMonth();
  const { monthStr } = getMonthYearFromState();

  const totals = {};
  const itemsMap = {};
  const dateLabelsMap = {};

  for (let i = 1; i <= daysInMonth; i++) {
    totals[i] = 0;
    itemsMap[i] = [];
    dateLabelsMap[i] = `${i} ${monthStr}`;
  }

  function processItem(item, categoryName) {
    if (!item.date) return;
    const parts = item.date.split('-');
    if (parts.length === 3) {
      const dayNum = parseInt(parts[2], 10);
      if (dayNum >= 1 && dayNum <= daysInMonth) {
        totals[dayNum] += Number(item.amount) || 0;
        itemsMap[dayNum].push({
          category: categoryName,
          name: item.name,
          amount: Number(item.amount) || 0,
          date: item.date,
        });
      }
    }
  }

  (d.needs || []).forEach(item => processItem(item, 'Needs'));
  (d.wants || []).forEach(item => processItem(item, 'Wants'));

  let dailyTotal = 0;
  Object.values(totals).forEach(val => { dailyTotal += val; });

  return { totals, itemsMap, dateLabelsMap, daysInMonth, dailyTotal };
}

// ─── Entry Sorting Helper (Descending by Date + CreatedAt Datetime) ──
function sortEntriesDesc(a, b) {
  const dateA = a.date || '1970-01-01';
  const dateB = b.date || '1970-01-01';

  if (dateA !== dateB) {
    return dateB.localeCompare(dateA);
  }

  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.timestamp || 0);
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.timestamp || 0);

  return timeB - timeA;
}

// ─── Cumulative Computations ──
function getInstrumentCumulativeSavings(savingsList) {
  const instruments = state.registeredSavingsInstruments || [];
  const entries = savingsList || [];

  return instruments.map(inst => {
    const instEntries = entries.filter(e => e.instrumentId === inst.id || e.accountNumber === inst.accountNumber || (e.name && e.name.toLowerCase() === inst.name.toLowerCase()));

    const totalAmount = instEntries.reduce((s, item) => s + (Number(item.amount) || 0), 0);
    instEntries.sort(sortEntriesDesc);

    return {
      instrument: inst,
      cumulativeAmount: totalAmount,
      latestDate: instEntries[0]?.date || 'No entries',
      entryCount: instEntries.length,
    };
  });
}

function getAccountLatestBalances(banksList) {
  const accounts = state.registeredAccounts || [];
  const entries = banksList || [];

  return accounts.map(acc => {
    const accEntries = entries.filter(e => e.accountId === acc.id || e.accountNumber === acc.accountNumber || (e.name && e.name.toLowerCase() === acc.bankName.toLowerCase()));

    if (accEntries.length > 0) {
      accEntries.sort(sortEntriesDesc);
      const latest = accEntries[0];
      return {
        account: acc,
        latestBalance: Number(latest.balance) || 0,
        latestDate: latest.date || getTodayDate(),
        entryCount: accEntries.length,
      };
    } else {
      return {
        account: acc,
        latestBalance: 0,
        latestDate: 'No entries',
        entryCount: 0,
      };
    }
  });
}

function getComputedValues() {
  const d = getFilteredData();
  const rawData = getCurrentData();
  const income = rawData.income.total || 0;

  const needsBudget = (income * (rawData.income.needsPct || 50)) / 100;
  const savingsBudget = (income * (rawData.income.savingsPct || 20)) / 100;
  const wantsBudget = (income * (rawData.income.wantsPct || 10)) / 100;
  const balanceBudget = income - needsBudget - savingsBudget - wantsBudget;

  const needsTotal = (d.needs || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const wantsTotal = (d.wants || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const savingsTotal = (d.savings || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const dailyBreakdown = getDailyBreakdown(d);
  const dailyTotal = dailyBreakdown.dailyTotal;

  const bankAccountBalances = getAccountLatestBalances(d.banks);
  const banksTotal = bankAccountBalances.reduce((s, b) => s + b.latestBalance, 0);

  const depositsTotal = (d.deposits || []).reduce((s, dp) => s + (Number(dp.amount) || 0), 0);

  const overallTotalExpenses = needsTotal + wantsTotal + savingsTotal;
  const netRemainingIncome = income - overallTotalExpenses;

  const availBankBal = banksTotal;
  const availTotalBal = banksTotal + depositsTotal;

  return {
    income,
    needsBudget,
    savingsBudget,
    wantsBudget,
    balanceBudget,
    needsTotal,
    wantsTotal,
    savingsTotal,
    dailyTotal,
    dailyBreakdown,
    banksTotal,
    depositsTotal,
    overallTotalExpenses,
    netRemainingIncome,
    bankAccountBalances,
    availBankBal,
    availTotalBal,
    needsBalance: needsBudget - needsTotal,
    wantsBalance: wantsBudget - wantsTotal,
    savingsBalance: savingsBudget - savingsTotal,
  };
}

// ─── Navigation ───────────────────────────────
function navigateTo(section) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.section === section);
  });

  document.querySelectorAll('.content-section').forEach(sec => {
    sec.classList.remove('active');
  });
  const target = document.getElementById(`${section}-section`);
  if (target) {
    target.classList.add('active');
  }

  // Custom date range is not needed for Daily Expenses (always month-based)
  const filterToggle = document.querySelector('.filter-mode-toggle');
  const customPicker = document.getElementById('customRangePicker');
  if (section === 'daily') {
    if (filterToggle) filterToggle.style.display = 'none';
    if (customPicker) customPicker.style.display = 'none';
  } else {
    if (filterToggle) filterToggle.style.display = 'flex';
    if (state.viewMode === 'custom' && customPicker) {
      customPicker.style.display = 'flex';
    }
  }

  closeMobileSidebar();
  renderSection(section);
}

function renderSection(section) {
  switch (section) {
    case 'dashboard': renderDashboard(); break;
    case 'income': renderIncome(); break;
    case 'banks': renderBanks(); break;
    case 'wants': renderWants(); break;
    case 'needs': renderNeeds(); break;
    case 'daily': renderDaily(); break;
    case 'savings': renderSavings(); break;
  }
}

// ─── Month Management ─────────────────────────
function populateMonthSelect() {
  const select = document.getElementById('monthSelect');
  select.innerHTML = '';
  const months = Object.keys(state.data);
  if (months.length === 0) {
    const monthName = getCurrentMonthName();
    state.data[monthName] = createDefaultMonthData();
    state.currentMonth = monthName;
    months.push(monthName);
  }
  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    if (m === state.currentMonth) opt.selected = true;
    select.appendChild(opt);
  });
}

function switchMonth(month) {
  if (state.data[month]) {
    state.currentMonth = month;
    saveToStorage();
    renderAll();
  }
}

function createMonth(name) {
  if (state.data[name]) {
    showToast(`${name} already exists`, 'error');
    return;
  }
  state.data[name] = createDefaultMonthData();
  state.currentMonth = name;
  saveToStorage();
  renderAll();
  showToast(`${name} created`, 'success');
}

function deleteMonth(name) {
  if (!state.data[name]) return;
  if (!confirm(`Delete "${name}" and all its data? This cannot be undone.`)) return;
  delete state.data[name];
  const months = Object.keys(state.data);
  state.currentMonth = months.length > 0 ? months[0] : getCurrentMonthName();
  if (!state.data[state.currentMonth]) {
    state.data[state.currentMonth] = createDefaultMonthData();
  }
  saveToStorage();
  renderAll();
  showToast(`${name} deleted`, 'info');
}

function renderAll() {
  renderUserBadge();
  populateMonthSelect();
  populateSavingsTypeSelect();

  const subtext = document.getElementById('dashboardSubtext');
  if (subtext) {
    if (state.viewMode === 'month') {
      subtext.textContent = `Monthly overview for ${state.currentMonth}`;
    } else {
      subtext.textContent = `Custom Date Filter: ${state.customStartDate || 'Start'} to ${state.customEndDate || 'End'}`;
    }
  }

  const activeLink = document.querySelector('.nav-link.active');
  const section = activeLink ? activeLink.dataset.section : 'dashboard';
  renderSection(section);
}

// ─── Dynamic Custom Savings Type Management ───
function populateSavingsTypeSelect() {
  const select = document.getElementById('newSavingsType');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = state.customSavingsTypes.map(type => `
    <option value="${escapeHtml(type)}">${escapeHtml(type)}</option>
  `).join('');

  if (currentVal && state.customSavingsTypes.includes(currentVal)) {
    select.value = currentVal;
  }
}

function openCustomTypeModal() {
  document.getElementById('customTypeModal').classList.add('active');
  document.getElementById('customSavingsTypeNameInput').value = '';
  document.getElementById('customSavingsTypeNameInput').focus();
}

function closeCustomTypeModal() {
  document.getElementById('customTypeModal').classList.remove('active');
}

function saveCustomSavingsType() {
  const name = document.getElementById('customSavingsTypeNameInput').value.trim();
  if (!name) {
    showToast('Enter a valid savings type name', 'error');
    return;
  }

  const exists = state.customSavingsTypes.some(t => t.toLowerCase() === name.toLowerCase());
  if (exists) {
    showToast(`Type "${name}" already exists in picklist`, 'error');
    return;
  }

  state.customSavingsTypes.push(name);
  saveToStorage();
  populateSavingsTypeSelect();

  document.getElementById('newSavingsType').value = name;
  closeCustomTypeModal();
  showToast(`Added custom savings type "${name}"`, 'success');
}

// ─── Dashboard ────────────────────────────────
function renderDashboard() {
  const v = getComputedValues();
  const d = getFilteredData();

  const bannerEl = document.getElementById('netIncomeBanner');
  if (bannerEl) {
    const isNegative = v.netRemainingIncome < 0;
    bannerEl.innerHTML = `
      <div class="banner-title">
        <span>💵 Overall Monthly Income & Deductions</span>
      </div>
      <div class="banner-row">
        <div class="banner-main-val ${isNegative ? 'text-danger' : 'text-success'}">
          ${fmt(v.netRemainingIncome)} <span style="font-size:0.85rem;font-weight:500;color:var(--text-3);">Net Remaining Income</span>
        </div>
        <div class="banner-breakdown">
          <div class="breakdown-item">
            <span class="label">Total Income</span>
            <span class="val text-success">${fmt(v.income)}</span>
          </div>
          <div class="breakdown-item">
            <span class="label">- Needs Spent</span>
            <span class="val text-info">${fmt(v.needsTotal)}</span>
          </div>
          <div class="breakdown-item">
            <span class="label">- Wants Spent</span>
            <span class="val text-warning">${fmt(v.wantsTotal)}</span>
          </div>
          <div class="breakdown-item">
            <span class="label">- Savings & Deposits</span>
            <span class="val text-muted">${fmt(v.savingsTotal)}</span>
          </div>
        </div>
      </div>
    `;
  }

  const statsEl = document.getElementById('dashboardStats');
  statsEl.innerHTML = `
    <div class="stat-card income">
      <div class="stat-icon">💵</div>
      <div class="stat-label">Total Income</div>
      <div class="stat-value">${fmt(v.income)}</div>
      <div class="stat-sub">Net Left: ${fmt(v.netRemainingIncome)}</div>
    </div>
    <div class="stat-card needs">
      <div class="stat-icon">📋</div>
      <div class="stat-label">Needs Spent</div>
      <div class="stat-value">${fmt(v.needsTotal)}</div>
      <div class="stat-sub">Reduced from income</div>
    </div>
    <div class="stat-card wants">
      <div class="stat-icon">🛍️</div>
      <div class="stat-label">Wants Spent</div>
      <div class="stat-value">${fmt(v.wantsTotal)}</div>
      <div class="stat-sub">Reduced from income</div>
    </div>
    <div class="stat-card savings">
      <div class="stat-icon">🏆</div>
      <div class="stat-label">Savings & Deposits</div>
      <div class="stat-value">${fmt(v.savingsTotal)}</div>
      <div class="stat-sub">Target: ${fmt(v.savingsBudget)}</div>
    </div>
    <div class="stat-card bank">
      <div class="stat-icon">🏦</div>
      <div class="stat-label">Bank Accounts</div>
      <div class="stat-value">${fmt(v.banksTotal)}</div>
      <div class="stat-sub">${state.registeredAccounts.length} unique account${state.registeredAccounts.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="stat-card deposit">
      <div class="stat-icon">📈</div>
      <div class="stat-label">Total Deposits</div>
      <div class="stat-value">${fmt(v.depositsTotal)}</div>
      <div class="stat-sub">${(d.deposits || []).length} deposit${(d.deposits || []).length !== 1 ? 's' : ''}</div>
    </div>
  `;

  renderBudgetBar(v);
  renderExpenseChart(v);
  renderDailyChart(v.dailyBreakdown);
}

function renderBudgetBar(v) {
  const bar = document.getElementById('budgetBar');
  const legend = document.getElementById('budgetLegend');
  const income = v.income || 1;

  const needsPct = ((v.needsTotal / income) * 100).toFixed(1);
  const wantsPct = ((v.wantsTotal / income) * 100).toFixed(1);
  const savingsPct = ((v.savingsTotal / income) * 100).toFixed(1);
  const netPct = Math.max(0, ((v.netRemainingIncome / income) * 100)).toFixed(1);

  bar.innerHTML = `
    <div class="segment needs-seg" style="width:${needsPct}%"></div>
    <div class="segment wants-seg" style="width:${wantsPct}%"></div>
    <div class="segment savings-seg" style="width:${savingsPct}%"></div>
    <div class="segment balance-seg" style="width:${netPct}%"></div>
  `;

  legend.innerHTML = `
    <div class="legend-item"><div class="legend-dot needs"></div>Needs ${needsPct}%</div>
    <div class="legend-item"><div class="legend-dot wants"></div>Wants ${wantsPct}%</div>
    <div class="legend-item"><div class="legend-dot savings"></div>Savings ${savingsPct}%</div>
    <div class="legend-item"><div class="legend-dot balance"></div>Net Remaining ${netPct}%</div>
  `;
}

function renderExpenseChart(v) {
  const ctx = document.getElementById('expenseChart');
  if (charts.expense) charts.expense.destroy();

  charts.expense = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Needs', 'Wants', 'Savings'],
      datasets: [{
        data: [v.needsTotal, v.wantsTotal, v.savingsTotal],
        backgroundColor: [
          'rgba(163, 196, 243, 0.75)',
          'rgba(207, 186, 240, 0.75)',
          'rgba(244, 211, 94, 0.75)',
        ],
        borderColor: [
          'rgba(163, 196, 243, 1)',
          'rgba(207, 186, 240, 1)',
          'rgba(244, 211, 94, 1)',
        ],
        borderWidth: 1.5,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '72%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: 'rgba(245, 247, 250, 0.6)',
            padding: 16,
            font: { family: 'Inter', size: 11, weight: '500' },
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(20, 24, 33, 0.95)',
          titleColor: 'rgba(245, 247, 250, 0.95)',
          bodyColor: 'rgba(245, 247, 250, 0.6)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: (ctx) => ` ${CURRENCY} ${Number(ctx.raw).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          },
        },
      },
    },
  });
}

function renderDailyChart(dailyBreakdown) {
  const ctx = document.getElementById('dailyChart');
  if (charts.daily) charts.daily.destroy();

  const labels = [];
  const values = [];
  for (let i = 1; i <= dailyBreakdown.daysInMonth; i++) {
    labels.push(`D${i}`);
    values.push(dailyBreakdown.totals[i] || 0);
  }

  charts.daily = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Daily Spend (Needs + Wants)',
        data: values,
        backgroundColor: values.map(v => v > 0 ? 'rgba(207, 186, 240, 0.6)' : 'rgba(255,255,255,0.02)'),
        borderColor: values.map(v => v > 0 ? 'rgba(207, 186, 240, 0.9)' : 'transparent'),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(20, 24, 33, 0.95)',
          titleColor: '#f5f7fa',
          bodyColor: 'rgba(245, 247, 250, 0.6)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 10,
          callbacks: {
            title: (items) => `${dailyBreakdown.dateLabelsMap[items[0].dataIndex + 1]}`,
            label: (ctx) => ` ${fmt(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: 'rgba(245, 247, 250, 0.4)', font: { size: 9, family: 'Inter' } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: {
            color: 'rgba(245, 247, 250, 0.4)',
            font: { size: 10, family: 'Inter' },
            callback: (v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v,
          },
        },
      },
    },
  });
}

// ─── Income ───────────────────────────────────
function renderIncome() {
  const d = getCurrentData();
  
  if (!d.income.entries) d.income.entries = [];
  d.income.total = d.income.entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
  
  document.getElementById('incomeInput').value = fmt(d.income.total);
  document.getElementById('needsPct').value = d.income.needsPct || 50;
  document.getElementById('savingsPct').value = d.income.savingsPct || 20;
  document.getElementById('wantsPct').value = d.income.wantsPct || 10;
  document.getElementById('initialBalanceInput').value = d.initialBankBalance || '';

  const tbody = document.getElementById('incomeListBody');
  tbody.innerHTML = '';
  d.income.entries.forEach(entry => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${entry.date}</td>
      <td>${entry.source}</td>
      <td class="font-bold text-green">${fmt(entry.amount)}</td>
      <td>
        <button class="btn btn-secondary" onclick="deleteIncomeEntry('${entry.id}')" style="padding:4px 8px;font-size:0.7rem;">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateIncomeSplits();
}

function updateIncomeSplits() {
  const d = getCurrentData();
  const income = d.income.total || 0;
  const needsPct = Number(document.getElementById('needsPct').value) || 0;
  const savingsPct = Number(document.getElementById('savingsPct').value) || 0;
  const wantsPct = Number(document.getElementById('wantsPct').value) || 0;
  const balancePct = Math.max(0, 100 - needsPct - savingsPct - wantsPct);

  document.getElementById('needsAmount').textContent = fmt((income * needsPct) / 100);
  document.getElementById('savingsAmount').textContent = fmt((income * savingsPct) / 100);
  document.getElementById('wantsAmount').textContent = fmt((income * wantsPct) / 100);
  document.getElementById('balancePct').textContent = `${balancePct}%`;
  document.getElementById('balanceAmount').textContent = fmt((income * balancePct) / 100);

  const v = getComputedValues();
  document.getElementById('availBankBal').textContent = fmt(v.availBankBal);
  document.getElementById('availTotalBal').textContent = fmt(v.availTotalBal);
}

function saveIncome() {
  const d = getCurrentData();
  d.income.needsPct = Number(document.getElementById('needsPct').value) || 0;
  d.income.savingsPct = Number(document.getElementById('savingsPct').value) || 0;
  d.income.wantsPct = Number(document.getElementById('wantsPct').value) || 0;
  d.initialBankBalance = Number(document.getElementById('initialBalanceInput').value) || 0;
  saveToStorage();
  updateIncomeSplits();
}

function addIncomeEntry() {
  const d = getCurrentData();
  if (!d.income.entries) d.income.entries = [];
  
  const date = document.getElementById('incomeDateInput').value;
  const source = document.getElementById('incomeSourceInput').value.trim();
  const amount = Number(document.getElementById('incomeAmountInput').value) || 0;

  if (!date || !source || amount <= 0) {
    showToast('Enter valid Date, Source, and Amount.', 'error');
    return;
  }

  d.income.entries.push({
    id: 'inc_' + Date.now(),
    date,
    source,
    amount
  });
  
  d.income.entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  document.getElementById('incomeSourceInput').value = '';
  document.getElementById('incomeAmountInput').value = '';
  
  saveToStorage();
  renderIncome();
  renderDashboard();
  showToast('Income added successfully', 'success');
}

window.deleteIncomeEntry = function(id) {
  const d = getCurrentData();
  if (!d.income.entries) return;
  d.income.entries = d.income.entries.filter(e => e.id !== id);
  saveToStorage();
  renderIncome();
  renderDashboard();
  showToast('Income entry deleted', 'info');
};

// ─── Bank Accounts Management ─────────────────
function createBankAccount() {
  const bankName = document.getElementById('newAccountBankName').value.trim();
  const accountNumber = document.getElementById('newAccountNumber').value.trim();
  const initialBal = Number(document.getElementById('newAccountInitialBal').value) || 0;

  if (!bankName) { showToast('Enter Bank Name', 'error'); return; }
  if (!accountNumber) { showToast('Enter Unique Account Number', 'error'); return; }

  const exists = state.registeredAccounts.some(acc => acc.accountNumber.toLowerCase() === accountNumber.toLowerCase());
  if (exists) {
    showToast(`Account number ${accountNumber} already exists`, 'error');
    return;
  }

  const newAcc = {
    id: 'acc_' + Date.now(),
    bankName,
    accountNumber,
  };

  state.registeredAccounts.push(newAcc);

  if (initialBal >= 0) {
    const d = getCurrentData();
    d.banks.push({
      date: getTodayDate(),
      createdAt: new Date().toISOString(),
      accountId: newAcc.id,
      bankName: newAcc.bankName,
      accountNumber: newAcc.accountNumber,
      balance: initialBal,
    });
  }

  saveToStorage();
  renderBanks();

  document.getElementById('newAccountBankName').value = '';
  document.getElementById('newAccountNumber').value = '';
  document.getElementById('newAccountInitialBal').value = '';
  showToast(`Created account ${bankName} (${formatAccountNum(accountNumber)})`, 'success');
}

function recordBankBalance() {
  const accountId = document.getElementById('selectBankAccountId').value;
  const date = document.getElementById('bankEntryDateInput').value || getTodayDate();
  const balance = Number(document.getElementById('bankEntryBalanceInput').value);

  if (!accountId) { showToast('Select a Bank Account first', 'error'); return; }
  if (isNaN(balance) || balance < 0) { showToast('Enter valid recorded balance', 'error'); return; }

  const acc = state.registeredAccounts.find(a => a.id === accountId);
  if (!acc) { showToast('Account not found', 'error'); return; }

  const d = getCurrentData();
  d.banks.push({
    date,
    createdAt: new Date().toISOString(),
    accountId: acc.id,
    bankName: acc.bankName,
    accountNumber: acc.accountNumber,
    balance,
  });

  saveToStorage();
  renderBanks();

  document.getElementById('bankEntryBalanceInput').value = '';
  showToast(`Recorded balance ${fmt(balance)} for ${acc.bankName}`, 'success');
}

function deleteBankAccount(accId) {
  const acc = state.registeredAccounts.find(a => a.id === accId);
  if (!acc) return;
  if (!confirm(`Delete bank account "${acc.bankName} (${acc.accountNumber})"? This will remove all balance logs for this account.`)) return;

  state.registeredAccounts = state.registeredAccounts.filter(a => a.id !== accId);

  Object.values(state.data).forEach(m => {
    if (m.banks) {
      m.banks = m.banks.filter(e => e.accountId !== accId && e.accountNumber !== acc.accountNumber);
    }
  });

  saveToStorage();
  renderBanks();
  showToast('Account deleted', 'info');
}

function renderBanks() {
  const d = getFilteredData();
  const v = getComputedValues();

  const selectEl = document.getElementById('selectBankAccountId');
  if (selectEl) {
    if (state.registeredAccounts.length === 0) {
      selectEl.innerHTML = `<option value="">No Bank Accounts Created Yet</option>`;
    } else {
      selectEl.innerHTML = state.registeredAccounts.map(acc => `
        <option value="${acc.id}">${escapeHtml(acc.bankName)} (${formatAccountNum(acc.accountNumber)})</option>
      `).join('');
    }
  }

  const cardsGrid = document.getElementById('bankCardsGrid');
  if (cardsGrid) {
    if (v.bankAccountBalances.length === 0) {
      cardsGrid.innerHTML = `
        <div class="bank-account-card" style="grid-column: 1 / -1; text-align: center; padding: 24px;">
          <p class="text-muted">No registered bank accounts yet. Use the form above to add a new account.</p>
        </div>
      `;
    } else {
      cardsGrid.innerHTML = v.bankAccountBalances.map(item => `
        <div class="bank-account-card">
          <div class="bank-header-row">
            <span class="bank-name-title">🏦 ${escapeHtml(item.account.bankName)}</span>
            <span class="bank-acc-num-badge">${escapeHtml(formatAccountNum(item.account.accountNumber))}</span>
          </div>
          <div class="bank-latest-date">As of ${item.latestDate}</div>
          <div class="bank-bal-value">${fmt(item.latestBalance)}</div>
          <div class="bank-card-footer" style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.75rem;color:var(--text-3);">${item.entryCount} balance log${item.entryCount !== 1 ? 's' : ''}</span>
            <button class="btn-icon delete" onclick="deleteBankAccount('${item.account.id}')" title="Delete Account">🗑️</button>
          </div>
        </div>
      `).join('');
    }
  }

  const tbody = document.getElementById('banksTableBody');
  if (!d.banks || d.banks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🏦</div><p>No balance entries recorded</p></div></td></tr>`;
  } else {
    const sortedBanks = d.banks
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => sortEntriesDesc(a.item, b.item));

    tbody.innerHTML = sortedBanks.map(({ item: b, originalIndex }, displayIdx) => `
      <tr>
        <td class="text-muted">${displayIdx + 1}</td>
        <td class="text-muted">${b.date || getTodayDate()}</td>
        <td><strong>${escapeHtml(b.bankName || b.name)}</strong></td>
        <td><span class="bank-acc-num-badge">${escapeHtml(formatAccountNum(b.accountNumber))}</span></td>
        <td class="amount positive">${fmt(b.balance)}</td>
        <td>
          <div class="actions">
            <button class="btn-icon edit" onclick="openEditModal('banks', ${originalIndex})" title="Edit">✏️</button>
            <button class="btn-icon delete" onclick="deleteItem('banks', ${originalIndex})" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('banksTotalValue').textContent = fmt(v.banksTotal);
}

// ─── Daily Expenses Read-Only Dashboard ────────
function renderDaily() {
  const d = getCurrentData();
  const breakdown = getDailyBreakdown(d);
  const grid = document.getElementById('dailyGrid');

  let html = '';
  for (let i = 1; i <= breakdown.daysInMonth; i++) {
    const totalOnDay = breakdown.totals[i] || 0;
    const itemsOnDay = breakdown.itemsMap[i] || [];
    const dateLabel = breakdown.dateLabelsMap[i];
    const hasSpending = totalOnDay > 0;

    html += `
      <div class="day-card ${hasSpending ? 'has-spending' : ''}" onclick="showDayDetails(${i})">
        <div class="day-card-header">Day ${i}</div>
        <div style="font-size:0.68rem;color:var(--text-tertiary);margin-bottom:4px;">${dateLabel}</div>
        <div class="day-card-amount">${fmt(totalOnDay)}</div>
        ${hasSpending ? `<div class="day-card-badge">${itemsOnDay.length} entry${itemsOnDay.length !== 1 ? 's' : ''}</div>` : `<div style="font-size:0.65rem;color:var(--text-tertiary);margin-top:4px;">No expense</div>`}
      </div>
    `;
  }
  grid.innerHTML = html;

  document.getElementById('dailyTotalValue').textContent = fmt(breakdown.dailyTotal);
  renderDailySectionChart(breakdown);
}

function showDayDetails(dayNum) {
  const d = getCurrentData();
  const breakdown = getDailyBreakdown(d);
  const items = breakdown.itemsMap[dayNum] || [];
  const total = breakdown.totals[dayNum] || 0;
  const dateLabel = breakdown.dateLabelsMap[dayNum] || `Day ${dayNum}`;

  const modal = document.getElementById('dayModal');
  const title = document.getElementById('dayModalTitle');
  const body = document.getElementById('dayModalBody');

  title.textContent = `Expenses for Day ${dayNum} (${dateLabel}) — Total: ${fmt(total)}`;

  if (items.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>No Needs or Wants logged on ${dateLabel}.</p></div>`;
  } else {
    body.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Expense Name</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td class="text-muted">${item.date}</td>
                <td><span style="padding:2px 8px;border-radius:4px;font-size:0.72rem;font-weight:600;background:${item.category === 'Needs' ? 'rgba(163, 196, 243, 0.15);color:#a3c4f3' : 'rgba(207, 186, 240, 0.15);color:#cfbaf0'}">${item.category}</span></td>
                <td>${escapeHtml(item.name)}</td>
                <td class="amount">${fmt(item.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  modal.classList.add('active');
}

function closeDayModal() {
  document.getElementById('dayModal').classList.remove('active');
}

function renderDailySectionChart(breakdown) {
  const ctx = document.getElementById('dailySectionChart');
  if (charts.dailySection) charts.dailySection.destroy();

  const labels = [];
  const values = [];
  for (let i = 1; i <= breakdown.daysInMonth; i++) {
    labels.push(`D${i}`);
    values.push(breakdown.totals[i] || 0);
  }

  charts.dailySection = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Aggregated Amount (Needs + Wants)',
        data: values,
        backgroundColor: values.map(v => v > 0 ? 'rgba(207, 186, 240, 0.5)' : 'rgba(255,255,255,0.02)'),
        borderColor: values.map(v => v > 0 ? 'rgba(207, 186, 240, 0.8)' : 'transparent'),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(20, 24, 33, 0.95)',
          titleColor: '#f5f7fa',
          bodyColor: 'rgba(245, 247, 250, 0.6)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${fmt(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: 'rgba(245, 247, 250, 0.4)', font: { size: 9, family: 'Inter' } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: {
            color: 'rgba(245, 247, 250, 0.4)',
            font: { size: 10, family: 'Inter' },
            callback: (v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v,
          },
        },
      },
    },
  });
}

// ─── Savings & Deposits Management ───
function createSavingsInstrument() {
  const type = document.getElementById('newSavingsType').value;
  const name = document.getElementById('newSavingsName').value.trim();
  const accountNumber = document.getElementById('newSavingsAccNum').value.trim();
  const initialAmount = Number(document.getElementById('newSavingsInitialAmount').value) || 0;

  if (!type) { showToast('Select or create a Savings Type', 'error'); return; }
  if (!name) { showToast('Enter Instrument Name', 'error'); return; }
  if (!accountNumber) { showToast('Enter Unique Account/Ref Number', 'error'); return; }

  const exists = state.registeredSavingsInstruments.some(inst => inst.accountNumber.toLowerCase() === accountNumber.toLowerCase() && inst.type === type);
  if (exists) {
    showToast(`Instrument with Ref ${accountNumber} already exists`, 'error');
    return;
  }

  const newInst = {
    id: 'sinst_' + Date.now(),
    type,
    name,
    accountNumber,
  };

  state.registeredSavingsInstruments.push(newInst);

  if (initialAmount > 0) {
    const d = getCurrentData();
    const entry = {
      date: getTodayDate(),
      createdAt: new Date().toISOString(),
      instrumentId: newInst.id,
      type: newInst.type,
      accountNumber: newInst.accountNumber,
      name: newInst.name,
      amount: initialAmount,
    };
    d.savings.push(entry);
    if (type === 'FD' || type === 'RD') {
      d.deposits.push(entry);
    }
  }

  saveToStorage();
  renderSavings();

  document.getElementById('newSavingsName').value = '';
  document.getElementById('newSavingsAccNum').value = '';
  document.getElementById('newSavingsInitialAmount').value = '';
  showToast(`Created instrument ${name} (${formatAccountNum(accountNumber)})`, 'success');
}

function recordSavingsEntry() {
  const instId = document.getElementById('selectSavingsInstrumentId').value;
  const date = document.getElementById('savingsEntryDateInput').value || getTodayDate();
  const amount = Number(document.getElementById('savingsEntryAmountInput').value);

  if (!instId) { showToast('Select a Savings Instrument first', 'error'); return; }
  if (isNaN(amount) || amount <= 0) { showToast('Enter valid contribution amount', 'error'); return; }

  const inst = state.registeredSavingsInstruments.find(i => i.id === instId);
  if (!inst) { showToast('Instrument not found', 'error'); return; }

  const d = getCurrentData();
  const entry = {
    date,
    createdAt: new Date().toISOString(),
    instrumentId: inst.id,
    type: inst.type,
    accountNumber: inst.accountNumber,
    name: inst.name,
    amount,
  };

  d.savings.push(entry);
  if (inst.type === 'FD' || inst.type === 'RD') {
    d.deposits.push(entry);
  }

  saveToStorage();
  renderSavings();

  document.getElementById('savingsEntryAmountInput').value = '';
  showToast(`Recorded ${fmt(amount)} for ${inst.name}`, 'success');
}

function deleteSavingsInstrument(instId) {
  const inst = state.registeredSavingsInstruments.find(i => i.id === instId);
  if (!inst) return;
  if (!confirm(`Delete savings instrument "${inst.name} (${inst.accountNumber})"? This will remove all log entries for this instrument.`)) return;

  state.registeredSavingsInstruments = state.registeredSavingsInstruments.filter(i => i.id !== instId);

  Object.values(state.data).forEach(m => {
    if (m.savings) {
      m.savings = m.savings.filter(e => e.instrumentId !== instId && e.accountNumber !== inst.accountNumber);
    }
    if (m.deposits) {
      m.deposits = m.deposits.filter(e => e.instrumentId !== instId && e.accountNumber !== inst.accountNumber);
    }
  });

  saveToStorage();
  renderSavings();
  showToast('Savings instrument deleted', 'info');
}

function renderSavings() {
  const d = getFilteredData();
  const v = getComputedValues();

  renderCategoryBudget('savingsBudget', 'Investment Target', v.savingsBudget, v.savingsTotal, 'var(--gold)');
  populateSavingsTypeSelect();

  const selectEl = document.getElementById('selectSavingsInstrumentId');
  if (selectEl) {
    if (state.registeredSavingsInstruments.length === 0) {
      selectEl.innerHTML = `<option value="">No Instruments Created Yet</option>`;
    } else {
      selectEl.innerHTML = state.registeredSavingsInstruments.map(inst => `
        <option value="${inst.id}">${escapeHtml(inst.name)} [${escapeHtml(inst.type)}] (${formatAccountNum(inst.accountNumber)})</option>
      `).join('');
    }
  }

  // ─── Registered Instruments Cards ───
  const cardsGrid = document.getElementById('savingsCardsGrid');
  const cumulativeSavings = getInstrumentCumulativeSavings(d.savings);

  if (cardsGrid) {
    if (cumulativeSavings.length === 0) {
      cardsGrid.innerHTML = `
        <div class="deposit-account-card" style="grid-column: 1 / -1; text-align: center; padding: 24px;">
          <p class="text-muted">No registered instruments yet. Use the form above to add one.</p>
        </div>
      `;
    } else {
      cardsGrid.innerHTML = cumulativeSavings.map(item => `
        <div class="deposit-account-card">
          <div class="deposit-header-row">
            <span class="deposit-name-title">${escapeHtml(item.instrument.name)}</span>
            <span class="deposit-type-badge ${item.instrument.type}">${escapeHtml(item.instrument.type)}</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-3);margin-bottom:8px;">Ref: <span class="deposit-acc-num-badge">${escapeHtml(formatAccountNum(item.instrument.accountNumber))}</span></div>
          <div class="deposit-cum-value">${fmt(item.cumulativeAmount)}</div>
          <div style="font-size:0.75rem;color:var(--text-3);border-top:1px solid var(--border);padding-top:8px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
            <span>${item.entryCount} contribution${item.entryCount !== 1 ? 's' : ''}</span>
            <button class="btn-icon delete" onclick="deleteSavingsInstrument('${item.instrument.id}')" title="Delete Instrument">🗑️</button>
          </div>
        </div>
      `).join('');
    }
  }

  // ─── Cumulative FD/RD Deposits Overview (merged from Deposits page) ───
  const cumulativeGrid = document.getElementById('cumulativeDepositsGrid');
  const depositEntries = (d.deposits || []).concat((d.savings || []).filter(s => s.type === 'FD' || s.type === 'RD'));

  const uniqueDepositEntries = [];
  const seenKeys = new Set();
  depositEntries.forEach(item => {
    const key = `${item.date}_${item.accountNumber}_${item.amount}_${item.type}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueDepositEntries.push(item);
    }
  });

  const map = new Map();
  uniqueDepositEntries.forEach(dp => {
    const accNum = (dp.accountNumber || 'N/A').trim().toUpperCase();
    const type = (dp.type || 'FD').toUpperCase();
    const key = `${type}_${accNum}`;
    if (!map.has(key)) {
      map.set(key, { type, accountNumber: dp.accountNumber || 'N/A', name: dp.name || 'Deposit Account', cumulativeAmount: 0, entries: [] });
    }
    const group = map.get(key);
    group.cumulativeAmount += Number(dp.amount) || 0;
    group.entries.push(dp);
  });

  const cumulativeList = [];
  map.forEach(group => {
    group.entries.sort(sortEntriesDesc);
    cumulativeList.push({
      type: group.type, accountNumber: group.accountNumber, name: group.name,
      cumulativeAmount: group.cumulativeAmount,
      latestDate: group.entries[0]?.date || getTodayDate(),
      entryCount: group.entries.length,
    });
  });

  if (cumulativeGrid) {
    if (cumulativeList.length === 0) {
      cumulativeGrid.innerHTML = `
        <div class="deposit-account-card" style="grid-column: 1 / -1; text-align: center; padding: 24px;">
          <p class="text-muted">No FD or RD entries yet. Create an FD or RD instrument above.</p>
        </div>
      `;
    } else {
      cumulativeGrid.innerHTML = cumulativeList.map(item => `
        <div class="deposit-account-card">
          <div class="deposit-header-row">
            <span class="deposit-name-title">${escapeHtml(item.name)}</span>
            <span class="deposit-type-badge ${item.type}">${escapeHtml(item.type)}</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-3);margin-bottom:8px;">Acc: <span class="deposit-acc-num-badge">${escapeHtml(formatAccountNum(item.accountNumber))}</span></div>
          <div class="deposit-cum-value">${fmt(item.cumulativeAmount)}</div>
          <div style="font-size:0.75rem;color:var(--text-3);border-top:1px solid var(--border);padding-top:8px;margin-top:8px;">
            ${item.entryCount} deposit${item.entryCount !== 1 ? 's' : ''} (Latest: ${item.latestDate})
          </div>
        </div>
      `).join('');
    }
  }

  // ─── Savings & Deposits Log Table ───
  const tbody = document.getElementById('savingsTableBody');
  if (!d.savings || d.savings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📈</div><p>No investment or deposit logs recorded</p></div></td></tr>`;
  } else {
    const sortedSavings = d.savings
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => sortEntriesDesc(a.item, b.item));

    tbody.innerHTML = sortedSavings.map(({ item: s, originalIndex }, displayIdx) => `
      <tr>
        <td class="text-muted">${displayIdx + 1}</td>
        <td class="text-muted">${s.date || getTodayDate()}</td>
        <td><span style="padding:2px 8px;border-radius:4px;font-size:0.72rem;font-weight:600;background:${s.type === 'FD' || s.type === 'RD' ? 'var(--gold-soft);color:var(--gold)' : 'var(--accent-soft);color:var(--accent)'}">${escapeHtml(s.type || 'Investment')}</span></td>
        <td><span class="deposit-acc-num-badge">${escapeHtml(formatAccountNum(s.accountNumber))}</span></td>
        <td>${escapeHtml(s.name)}</td>
        <td class="amount positive">${fmt(s.amount)}</td>
        <td>
          <div class="actions">
            <button class="btn-icon edit" onclick="openEditModal('savings', ${originalIndex})" title="Edit">✏️</button>
            <button class="btn-icon delete" onclick="deleteItem('savings', ${originalIndex})" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('savingsTotalValue').textContent = fmt(v.savingsTotal);
  const bal = v.savingsBalance;
  const balRow = document.getElementById('savingsBalanceRow');
  balRow.classList.toggle('positive', bal >= 0);
  balRow.classList.toggle('negative', bal < 0);
  document.getElementById('savingsBalanceValue').textContent = fmt(bal);
}

// ─── Wants ────────────────────────────────────
function renderWants() {
  const d = getFilteredData();
  const v = getComputedValues();
  const tbody = document.getElementById('wantsTableBody');

  renderCategoryBudget('wantsBudget', 'Wants Budget', v.wantsBudget, v.wantsTotal, 'var(--accent)');

  if (!d.wants || d.wants.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🛍️</div><p>No wants expenses added yet</p></div></td></tr>`;
  } else {
    const sortedWants = d.wants
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => sortEntriesDesc(a.item, b.item));

    tbody.innerHTML = sortedWants.map(({ item: w, originalIndex }, displayIdx) => `
      <tr>
        <td class="text-muted">${displayIdx + 1}</td>
        <td class="text-muted">${w.date || getTodayDate()}</td>
        <td>${escapeHtml(w.name)}</td>
        <td class="amount">${fmt(w.amount)}</td>
        <td>
          <div class="actions">
            <button class="btn-icon edit" onclick="openEditModal('wants', ${originalIndex})" title="Edit">✏️</button>
            <button class="btn-icon delete" onclick="deleteItem('wants', ${originalIndex})" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('wantsTotalValue').textContent = fmt(v.wantsTotal);
  const bal = v.wantsBalance;
  const balRow = document.getElementById('wantsBalanceRow');
  balRow.classList.toggle('positive', bal >= 0);
  balRow.classList.toggle('negative', bal < 0);
  document.getElementById('wantsBalanceValue').textContent = fmt(bal);
}

function addWants() {
  const date = document.getElementById('wantsDateInput').value || getTodayDate();
  const name = document.getElementById('wantsNameInput').value.trim();
  const amount = Number(document.getElementById('wantsAmountInput').value);
  if (!name) { showToast('Enter expense name', 'error'); return; }
  if (isNaN(amount) || amount <= 0) { showToast('Enter valid amount', 'error'); return; }

  const d = getCurrentData();
  d.wants.push({ date, createdAt: new Date().toISOString(), name, amount });
  saveToStorage();
  renderWants();

  document.getElementById('wantsNameInput').value = '';
  document.getElementById('wantsAmountInput').value = '';
  showToast(`${name} added`, 'success');
}

// ─── Needs ────────────────────────────────────
function renderNeeds() {
  const d = getFilteredData();
  const v = getComputedValues();
  const tbody = document.getElementById('needsTableBody');

  renderCategoryBudget('needsBudget', 'Needs Budget', v.needsBudget, v.needsTotal, 'var(--blue)');

  if (!d.needs || d.needs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📋</div><p>No needs expenses added yet</p></div></td></tr>`;
  } else {
    const sortedNeeds = d.needs
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => sortEntriesDesc(a.item, b.item));

    tbody.innerHTML = sortedNeeds.map(({ item: n, originalIndex }, displayIdx) => `
      <tr>
        <td class="text-muted">${displayIdx + 1}</td>
        <td class="text-muted">${n.date || getTodayDate()}</td>
        <td>${escapeHtml(n.name)}</td>
        <td class="amount">${fmt(n.amount)}</td>
        <td>
          <div class="actions">
            <button class="btn-icon edit" onclick="openEditModal('needs', ${originalIndex})" title="Edit">✏️</button>
            <button class="btn-icon delete" onclick="deleteItem('needs', ${originalIndex})" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('needsTotalValue').textContent = fmt(v.needsTotal);
  const bal = v.needsBalance;
  const balRow = document.getElementById('needsBalanceRow');
  balRow.classList.toggle('positive', bal >= 0);
  balRow.classList.toggle('negative', bal < 0);
  document.getElementById('needsBalanceValue').textContent = fmt(bal);
}

function addNeeds() {
  const date = document.getElementById('needsDateInput').value || getTodayDate();
  const name = document.getElementById('needsNameInput').value.trim();
  const amount = Number(document.getElementById('needsAmountInput').value);
  if (!name) { showToast('Enter expense name', 'error'); return; }
  if (isNaN(amount) || amount <= 0) { showToast('Enter valid amount', 'error'); return; }

  const d = getCurrentData();
  d.needs.push({ date, createdAt: new Date().toISOString(), name, amount });
  saveToStorage();
  renderNeeds();

  document.getElementById('needsNameInput').value = '';
  document.getElementById('needsAmountInput').value = '';
  showToast(`${name} added`, 'success');
}

// ─── Category Budget Bar ──────────────────────
function renderCategoryBudget(elementId, title, budget, spent, color) {
  const el = document.getElementById(elementId);
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const remaining = budget - spent;
  const isOver = remaining < 0;

  el.innerHTML = `
    <div class="budget-info">
      <div class="budget-title">${title}</div>
      <div class="budget-amounts">
        <div class="budget-item">
          <span class="item-label">Budget</span>
          <span class="item-value text-muted">${fmt(budget)}</span>
        </div>
        <div class="budget-item">
          <span class="item-label">Spent</span>
          <span class="item-value ${isOver ? 'text-danger' : ''}">${fmt(spent)}</span>
        </div>
        <div class="budget-item">
          <span class="item-label">Remaining</span>
          <span class="item-value ${isOver ? 'text-danger' : 'text-success'}">${fmt(remaining)}</span>
        </div>
      </div>
    </div>
    <div class="budget-bar-mini">
      <div class="budget-bar-fill" style="width:${pct}%;background:${isOver ? 'var(--red)' : color}"></div>
    </div>
  `;
}

// ─── Generic Delete & Edit ────────────────────
function deleteItem(type, index) {
  const d = getCurrentData();
  if (!d[type] || index < 0 || index >= d[type].length) return;
  const item = d[type][index];
  if (!confirm(`Delete "${item.name || item.bankName}"?`)) return;
  d[type].splice(index, 1);
  saveToStorage();
  renderSection(getSectionForType(type));
  showToast('Deleted', 'info');
}

function getSectionForType(type) {
  const map = { banks: 'banks', deposits: 'savings', wants: 'wants', needs: 'needs', savings: 'savings' };
  return map[type] || 'dashboard';
}

function openEditModal(type, index) {
  const d = getCurrentData();
  const item = d[type][index];
  if (!item) return;

  editContext = { type, index };
  const modal = document.getElementById('editModal');
  const title = document.getElementById('editModalTitle');
  const body = document.getElementById('editModalBody');

  let formHtml = '';
  const itemDate = item.date || getTodayDate();

  switch (type) {
    case 'banks':
      title.textContent = 'Edit Bank Balance Entry';
      formHtml = `
        <div class="form-group mb-4">
          <label>Date</label>
          <input type="date" id="editDate" value="${itemDate}">
        </div>
        <div class="form-group mb-4">
          <label>Bank Name</label>
          <input type="text" id="editField1" value="${escapeHtml(item.bankName || item.name)}">
        </div>
        <div class="form-group mb-4">
          <label>Account Number</label>
          <input type="text" id="editFieldAcc" value="${escapeHtml(item.accountNumber || '')}">
        </div>
        <div class="form-group">
          <label>Recorded Balance (₹)</label>
          <input type="number" id="editField2" value="${item.balance}" min="0" step="0.01">
        </div>
      `;
      break;
    case 'deposits':
    case 'savings':
      title.textContent = 'Edit Savings / Deposit Entry';
      formHtml = `
        <div class="form-group mb-4">
          <label>Date</label>
          <input type="date" id="editDate" value="${itemDate}">
        </div>
        <div class="form-group mb-4">
          <label>Type</label>
          <select id="editField0">
            ${state.customSavingsTypes.map(t => `<option value="${escapeHtml(t)}" ${item.type === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-4">
          <label>Account / Ref Number</label>
          <input type="text" id="editFieldAcc" value="${escapeHtml(item.accountNumber || '')}">
        </div>
        <div class="form-group mb-4">
          <label>Instrument Name</label>
          <input type="text" id="editField1" value="${escapeHtml(item.name)}">
        </div>
        <div class="form-group">
          <label>Amount (₹)</label>
          <input type="number" id="editField2" value="${item.amount}" min="0" step="0.01">
        </div>
      `;
      break;
    case 'wants':
    case 'needs':
      title.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`;
      formHtml = `
        <div class="form-group mb-4">
          <label>Date</label>
          <input type="date" id="editDate" value="${itemDate}">
        </div>
        <div class="form-group mb-4">
          <label>Name</label>
          <input type="text" id="editField1" value="${escapeHtml(item.name)}">
        </div>
        <div class="form-group">
          <label>Amount (₹)</label>
          <input type="number" id="editField2" value="${item.amount}" min="0" step="0.01">
        </div>
      `;
      break;
  }

  body.innerHTML = formHtml;
  modal.classList.add('active');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
  editContext = null;
}

function saveEdit() {
  if (!editContext) return;
  const d = getCurrentData();
  const item = d[editContext.type][editContext.index];
  const editDate = document.getElementById('editDate') ? document.getElementById('editDate').value : getTodayDate();

  item.date = editDate;

  switch (editContext.type) {
    case 'banks':
      item.bankName = document.getElementById('editField1').value.trim();
      item.accountNumber = document.getElementById('editFieldAcc').value.trim();
      item.balance = Number(document.getElementById('editField2').value) || 0;
      break;
    case 'deposits':
    case 'savings':
      item.type = document.getElementById('editField0').value;
      item.accountNumber = document.getElementById('editFieldAcc').value.trim();
      item.name = document.getElementById('editField1').value.trim();
      item.amount = Number(document.getElementById('editField2').value) || 0;
      break;
    case 'wants':
    case 'needs':
      item.name = document.getElementById('editField1').value.trim();
      item.amount = Number(document.getElementById('editField2').value) || 0;
      break;
  }

  saveToStorage();
  closeEditModal();
  renderSection(getSectionForType(editContext?.type || 'dashboard'));
  showToast('Changes saved', 'success');
}

// ─── CSV Export / Import ──────────────────────
function exportCSV() {
  const rows = [['Date', 'Category', 'Type', 'Bank/Particulars', 'Account Number', 'Amount/Balance']];

  Object.keys(state.data).forEach(month => {
    const d = state.data[month];
    (d.needs || []).forEach(item => rows.push([item.date || getTodayDate(), 'Needs', 'Expense', item.name, '', item.amount]));
    (d.wants || []).forEach(item => rows.push([item.date || getTodayDate(), 'Wants', 'Expense', item.name, '', item.amount]));
    (d.savings || []).forEach(item => rows.push([item.date || getTodayDate(), 'Savings', item.type || 'Savings', item.name, item.accountNumber || '', item.amount]));
    (d.deposits || []).forEach(item => rows.push([item.date || getTodayDate(), 'Deposits', item.type || 'FD', item.name, item.accountNumber || '', item.amount]));
    (d.banks || []).forEach(item => rows.push([item.date || getTodayDate(), 'Banks', 'Account', item.bankName || item.name, item.accountNumber || '', item.balance]));
  });

  const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kanakku_Book_${state.currentMonth.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV Exported', 'success');
}

function importCSV(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const text = e.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length <= 1) {
        showToast('Empty or invalid CSV', 'error');
        return;
      }

      const d = getCurrentData();
      let importedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        if (parts.length >= 4) {
          const cleanParts = parts.map(p => p.replace(/^"|"$/g, '').trim());
          const date = cleanParts[0] || getTodayDate();
          const category = (cleanParts[1] || '').toLowerCase();
          const type = cleanParts[2] || '';
          const name = cleanParts[3] || 'Imported Entry';
          const accNum = cleanParts[4] || '';
          const amount = Number(cleanParts[5] || cleanParts[4]) || 0;

          if (category.includes('need')) {
            d.needs.push({ date, name, amount });
          } else if (category.includes('want')) {
            d.wants.push({ date, name, amount });
          } else if (category.includes('sav')) {
            d.savings.push({ date, type: type || 'Savings', accountNumber: accNum, name, amount });
          } else if (category.includes('dep')) {
            d.deposits.push({ date, type: type === 'RD' ? 'RD' : 'FD', accountNumber: accNum, name, amount });
          } else if (category.includes('bank')) {
            let acc = state.registeredAccounts.find(a => a.accountNumber === accNum || a.bankName.toLowerCase() === name.toLowerCase());
            if (!acc) {
              acc = { id: 'acc_' + Date.now() + Math.random().toString(36).substr(2, 4), bankName: name, accountNumber: accNum || 'ACC' + Math.floor(Math.random()*1000) };
              state.registeredAccounts.push(acc);
            }
            d.banks.push({ date, accountId: acc.id, bankName: acc.bankName, accountNumber: acc.accountNumber, balance: amount });
          } else {
            d.wants.push({ date, name, amount });
          }
          importedCount++;
        }
      }

      saveToStorage();
      renderAll();
      showToast(`Imported ${importedCount} entries from CSV`, 'success');
    } catch (err) {
      showToast('Error parsing CSV', 'error');
    }
  };
  reader.readAsText(file);
}

// ─── Toast Notifications ──────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function openAddMonthModal() {
  document.getElementById('addMonthModal').classList.add('active');
  document.getElementById('newYearInput').value = new Date().getFullYear();
}

function closeAddMonthModal() {
  document.getElementById('addMonthModal').classList.remove('active');
}

function createMonthFromModal() {
  const month = document.getElementById('newMonthSelect').value;
  const year = document.getElementById('newYearInput').value;
  const name = `${month} ${year}`;
  createMonth(name);
  closeAddMonthModal();
}

// ─── Auth View Mode Switcher ──────────────────
function switchAuthMode(mode) {
  clearAuthError();
  const signInForm = document.getElementById('signInForm');
  const registerForm = document.getElementById('registerForm');
  const tabSignInBtn = document.getElementById('tabSignInBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');
  const title = document.getElementById('authCardTitle');
  const subtext = document.getElementById('authCardSubtext');

  if (mode === 'signin') {
    signInForm.style.display = 'block';
    registerForm.style.display = 'none';
    tabSignInBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    if (title) title.textContent = 'Sign in to கணக்கு Book';
    if (subtext) subtext.textContent = 'Enter your email and password to access your isolated finances';
  } else {
    signInForm.style.display = 'none';
    registerForm.style.display = 'block';
    tabRegisterBtn.classList.add('active');
    tabSignInBtn.classList.remove('active');
    if (title) title.textContent = 'Create your Account';
    if (subtext) subtext.textContent = 'Setup your profile and password to start tracking';
  }
}

// ─── Event Listeners ──────────────────────────
function setupEventListeners() {
  // ─── Mobile Menu Toggle ───
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const sidebar = document.getElementById('sidebar');

  const closeSidebar = () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  };

  const toggleSidebar = () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
  };

  if (hamburgerBtn) hamburgerBtn.addEventListener('click', toggleSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  // ─── Theme Toggle ───
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const html = document.documentElement;
      const isLight = html.getAttribute('data-theme') === 'light';
      if (isLight) {
        html.removeAttribute('data-theme');
        themeBtn.textContent = '🌙';
        themeBtn.title = 'Switch to Light Theme';
        localStorage.setItem('kanakku_theme', 'dark');
      } else {
        html.setAttribute('data-theme', 'light');
        themeBtn.textContent = '☀️';
        themeBtn.title = 'Switch to Dark Theme';
        localStorage.setItem('kanakku_theme', 'light');
      }
    });
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.section);
      if (typeof closeSidebar !== 'undefined') closeSidebar(); // Auto-close on mobile
    });
  });

  document.getElementById('monthSelect').addEventListener('change', (e) => {
    switchMonth(e.target.value);
  });

  document.getElementById('addMonthBtn').addEventListener('click', openAddMonthModal);
  document.getElementById('addMonthModalClose').addEventListener('click', closeAddMonthModal);
  document.getElementById('addMonthModalCancel').addEventListener('click', closeAddMonthModal);
  document.getElementById('addMonthModalCreate').addEventListener('click', createMonthFromModal);

  document.getElementById('deleteMonthBtn').addEventListener('click', () => {
    if (state.currentMonth) deleteMonth(state.currentMonth);
  });

  // Auth Mode Tabs & Form Switchers
  document.getElementById('tabSignInBtn').addEventListener('click', () => switchAuthMode('signin'));
  document.getElementById('tabRegisterBtn').addEventListener('click', () => switchAuthMode('register'));
  document.getElementById('gotoRegisterLink').addEventListener('click', (e) => { e.preventDefault(); switchAuthMode('register'); });
  document.getElementById('gotoSignInLink').addEventListener('click', (e) => { e.preventDefault(); switchAuthMode('signin'); });

  // Password Visibility Toggles
  document.getElementById('toggleLoginPwdBtn').addEventListener('click', () => {
    const input = document.getElementById('loginPasswordInput');
    const btn = document.getElementById('toggleLoginPwdBtn');
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  });

  document.getElementById('toggleRegisterPwdBtn').addEventListener('click', () => {
    const input = document.getElementById('registerPasswordInput');
    const btn = document.getElementById('toggleRegisterPwdBtn');
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  });

  // Auth Submit Handlers
  document.getElementById('signInForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError();
    const submitBtn = document.getElementById('signInSubmitBtn');
    const email = document.getElementById('loginEmailInput').value;
    const pwd = document.getElementById('loginPasswordInput').value;

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing In...'; }
    try {
      await signIn(email, pwd);
    } catch (err) {
      console.error('Sign in error:', err);
      showAuthError('An unexpected error occurred during sign in. Please try again.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Sign In to Dashboard →'; }
    }
  });

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError();
    const submitBtn = document.getElementById('registerSubmitBtn');
    const fName = document.getElementById('registerFirstNameInput').value;
    const lName = document.getElementById('registerLastNameInput').value;
    const email = document.getElementById('registerEmailInput').value;
    const pwd = document.getElementById('registerPasswordInput').value;
    const confirmPwd = document.getElementById('registerConfirmPasswordInput').value;

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating Account...'; }
    try {
      await registerAccount(fName, lName, email, pwd, confirmPwd);
    } catch (err) {
      console.error('Register error:', err);
      showAuthError('An unexpected error occurred during account creation. Please try again.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '+ Create Account & Sign In'; }
    }
  });

  // Clear auth errors when user types in inputs
  ['loginEmailInput', 'loginPasswordInput', 'registerFirstNameInput', 'registerLastNameInput', 'registerEmailInput', 'registerPasswordInput', 'registerConfirmPasswordInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', clearAuthError);
    }
  });

  // Sidebar & Mobile User Account Profile Click -> Open Settings Modal
  document.getElementById('userProfileBadge').addEventListener('click', openAccountSettingsModal);
  if (document.getElementById('mobileUserBtn')) {
    document.getElementById('mobileUserBtn').addEventListener('click', openAccountSettingsModal);
  }
  document.getElementById('userSwitchModalClose').addEventListener('click', closeUserSwitchModal);
  document.getElementById('editProfileForm').addEventListener('submit', saveProfileName);
  document.getElementById('changePasswordForm').addEventListener('submit', changePassword);
  document.getElementById('logoutModalBtn').addEventListener('click', logout);
  document.getElementById('deleteAccountModalBtn').addEventListener('click', deleteCurrentAccount);

  document.getElementById('manualSyncBtn').addEventListener('click', () => {
    if (authState.activeUserId) {
      fetchUserDataFromCloud(authState.activeUserId, true);
    } else {
      fetchUsersFromCloud();
      showToast('Cloud Accounts Synced', 'info');
    }
  });

  document.getElementById('viewMonthModeBtn').addEventListener('click', () => {
    state.viewMode = 'month';
    document.getElementById('viewMonthModeBtn').classList.add('active');
    document.getElementById('viewCustomModeBtn').classList.remove('active');
    document.getElementById('customRangePicker').style.display = 'none';
    renderAll();
  });

  document.getElementById('viewCustomModeBtn').addEventListener('click', () => {
    state.viewMode = 'custom';
    document.getElementById('viewCustomModeBtn').classList.add('active');
    document.getElementById('viewMonthModeBtn').classList.remove('active');
    document.getElementById('customRangePicker').style.display = 'flex';
    renderAll();
  });

  document.getElementById('applyCustomDateBtn').addEventListener('click', () => {
    state.customStartDate = document.getElementById('startDateInput').value;
    state.customEndDate = document.getElementById('endDateInput').value;
    saveToStorage();
    renderAll();
    showToast('Custom date filter applied', 'info');
  });

  ['needsPct', 'savingsPct', 'wantsPct', 'initialBalanceInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateIncomeSplits);
      el.addEventListener('change', saveIncome);
    }
  });

  // Income Forms
  const addIncomeBtn = document.getElementById('addIncomeBtn');
  if (addIncomeBtn) addIncomeBtn.addEventListener('click', addIncomeEntry);

  // Bank Forms
  document.getElementById('createAccountBtn').addEventListener('click', createBankAccount);
  document.getElementById('recordBankBalanceBtn').addEventListener('click', recordBankBalance);

  // Savings Forms
  document.getElementById('createSavingsInstrumentBtn').addEventListener('click', createSavingsInstrument);
  document.getElementById('recordSavingsEntryBtn').addEventListener('click', recordSavingsEntry);

  // Custom Savings Type Modal Events
  document.getElementById('openCustomTypeModalBtn').addEventListener('click', openCustomTypeModal);
  document.getElementById('customTypeModalClose').addEventListener('click', closeCustomTypeModal);
  document.getElementById('customTypeModalCancel').addEventListener('click', closeCustomTypeModal);
  document.getElementById('customTypeModalSave').addEventListener('click', saveCustomSavingsType);

  document.getElementById('addWantsBtn').addEventListener('click', addWants);
  document.getElementById('addNeedsBtn').addEventListener('click', addNeeds);

  document.getElementById('editModalClose').addEventListener('click', closeEditModal);
  document.getElementById('editModalCancel').addEventListener('click', closeEditModal);
  document.getElementById('editModalSave').addEventListener('click', saveEdit);

  document.getElementById('dayModalClose').addEventListener('click', closeDayModal);
  document.getElementById('dayModalDone').addEventListener('click', closeDayModal);

  document.getElementById('exportBtn').addEventListener('click', exportCSV);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', (e) => {
    if (e.target.files[0]) {
      importCSV(e.target.files[0]);
      e.target.value = '';
    }
  });

  document.getElementById('hamburgerBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeAddMonthModal();
      closeDayModal();
      closeCustomTypeModal();
      closeUserSwitchModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

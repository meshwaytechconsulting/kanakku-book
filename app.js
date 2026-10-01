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
    loansAndCardsData: {},
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

function getEntriesCount(stateObj) {
  if (!stateObj || !stateObj.data) return 0;
  let count = 0;
  Object.values(stateObj.data).forEach(d => {
    if (d) {
      count += (d.needs || []).length;
      count += (d.wants || []).length;
      count += (d.savings || []).length;
      count += (d.deposits || []).length;
      count += (d.banks || []).length;
      count += (d.income?.entries || []).length;
    }
  });
  return count;
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
    if (!error && data && data.data) {
      const cloudTimestamp = data.data.lastModified || '';
      const localTimestamp = state.lastModified || '';

      if (localTimestamp > cloudTimestamp && !isManual) {
        syncUserDataToCloud(userId);
      } else if (cloudTimestamp || isManual) {
        state = data.data;
        saveToStorage(false);
        renderAll();
        updateCloudSyncBadge('☁️ Synced to Cloud', true);
        if (isManual) showToast('Finances synchronized across devices!', 'success');
      }
    } else {
      if (getEntriesCount(state) > 0) {
        syncUserDataToCloud(userId);
      }
      updateCloudSyncBadge('☁️ Saved Locally', true);
      if (isManual) showToast('Data sync failed or no data found.', 'error');
    }
  } catch (e) {
    updateCloudSyncBadge('☁️ Saved Locally', true);
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
  registeredLoansAndCards: [],
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
    registeredLoansAndCards: [],
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
    state.lastModified = new Date().toISOString();
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
      if (!state.registeredLoansAndCards) state.registeredLoansAndCards = [];
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
        registeredLoansAndCards: [],
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
      registeredLoansAndCards: [],
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

function getPreviousMonthName(monthStr) {
  if (!monthStr) return null;
  const parts = monthStr.split(' ');
  if (parts.length !== 2) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let idx = months.indexOf(parts[0]);
  let year = parseInt(parts[1]);
  if (idx === -1 || isNaN(year)) return null;
  if (idx === 0) {
    idx = 11;
    year -= 1;
  } else {
    idx -= 1;
  }
  return `${months[idx]} ${year}`;
}

function initializeMonthData(monthName) {
  const monthData = createDefaultMonthData();
  const prevMonthName = getPreviousMonthName(monthName);
  if (prevMonthName && state.data[prevMonthName]) {
    const prevData = state.data[prevMonthName];
    if (prevData.loansAndCardsData) {
      monthData.loansAndCardsData = JSON.parse(JSON.stringify(prevData.loansAndCardsData));
    }
  }
  return monthData;
}

function getCurrentData() {
  if (!state.currentMonth || !state.data[state.currentMonth]) {
    const monthName = state.currentMonth || getCurrentMonthName();
    state.data[monthName] = initializeMonthData(monthName);
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

  let allIncomeEntries = [];
  let allIncomeTotal = 0;
  Object.values(state.data).forEach(m => {
    if (m.income && m.income.entries) {
      allIncomeEntries = allIncomeEntries.concat(m.income.entries.filter(item => isDateInRange(item.date)));
    }
  });
  allIncomeTotal = allIncomeEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return {
    income: { ...d.income, entries: allIncomeEntries, total: allIncomeTotal },
    initialBankBalance: d.initialBankBalance,
    banks: allBanks,
    deposits: allDeposits,
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
          comment: item.comment || '',
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
    let accEntries = entries.filter(e => e.accountId === acc.id || e.accountNumber === acc.accountNumber || (e.name && e.name.toLowerCase() === acc.bankName.toLowerCase()));

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

  // Gather ALL bank entries across ALL months for accurate latest-balance computation
  let allBankEntries = [];
  let allDeposits = [];
  Object.values(state.data).forEach(m => {
    if (m.banks && Array.isArray(m.banks)) allBankEntries = allBankEntries.concat(m.banks);
    if (m.deposits && Array.isArray(m.deposits)) allDeposits = allDeposits.concat(m.deposits);
  });
  const bankAccountBalances = getAccountLatestBalances(allBankEntries);
  const banksTotal = bankAccountBalances.reduce((s, b) => s + b.latestBalance, 0);
  const depositsTotal = allDeposits.reduce((s, dp) => s + (Number(dp.amount) || 0), 0);

  // Loans & Credit Cards — read outstanding from the latest month that has data
  const debtInstruments = state.registeredLoansAndCards || [];
  const sortedMonthKeys = Object.keys(state.data).sort((a, b) => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [mA, yA] = a.split(' ');
    const [mB, yB] = b.split(' ');
    return (Number(yA) * 12 + months.indexOf(mA)) - (Number(yB) * 12 + months.indexOf(mB));
  });
  function getLatestDebtData(instId) {
    for (let i = sortedMonthKeys.length - 1; i >= 0; i--) {
      const mData = state.data[sortedMonthKeys[i]];
      if (mData && mData.loansAndCardsData && mData.loansAndCardsData[instId]) {
        return mData.loansAndCardsData[instId];
      }
    }
    return null;
  }
  let totalCreditLimit = 0;
  let totalCardDebt = 0;
  let totalLoanDebt = 0;
  let totalMonthlyEmi = 0;

  debtInstruments.forEach(inst => {
    const dData = getLatestDebtData(inst.id) || { outstanding: inst.initialOutstanding || 0 };
    const currentOutstanding = Number(dData.outstanding) || 0;
    if (inst.type === 'credit_card') {
      totalCreditLimit += (Number(inst.limit) || 0);
      totalCardDebt += currentOutstanding;
    } else if (inst.type === 'loan') {
      totalLoanDebt += currentOutstanding;
      totalMonthlyEmi += (Number(inst.emiAmount) || 0);
    }
  });

  const overallTotalExpenses = needsTotal + wantsTotal + savingsTotal;
  const netRemainingIncome = income - overallTotalExpenses;

  const availCreditLimit = Math.max(0, totalCreditLimit - totalCardDebt);
  const netWorth = (banksTotal + depositsTotal) - (totalCardDebt + totalLoanDebt);
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
    totalCreditLimit,
    availCreditLimit,
    totalCardDebt,
    totalLoanDebt,
    totalMonthlyEmi,
    netWorth,
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
    case 'loans': renderLoansAndCards(); break;
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
  renderPaymentSourceOptions();

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
      </div>
    `;
  }

  const statsEl = document.getElementById('dashboardStats');

  statsEl.innerHTML = `
    <div class="stat-card income">
      <div class="stat-icon">💵</div>
      <div class="stat-label">Total Income</div>
      <div class="stat-value">${fmt(v.income)}</div>
      <div class="stat-sub">From fixed & custom income</div>
    </div>
    <div class="stat-card needs">
      <div class="stat-icon">📋</div>
      <div class="stat-label">Needs Spent</div>
      <div class="stat-value">${fmt(v.needsTotal)}</div>
      <div class="stat-sub">50% budget allocation</div>
    </div>
    <div class="stat-card wants">
      <div class="stat-icon">🛍️</div>
      <div class="stat-label">Wants Spent</div>
      <div class="stat-value">${fmt(v.wantsTotal)}</div>
      <div class="stat-sub">10% budget allocation</div>
    </div>
    <div class="stat-card savings">
      <div class="stat-icon">🏆</div>
      <div class="stat-label">Savings & Deposits</div>
      <div class="stat-value">${fmt(v.savingsTotal)}</div>
      <div class="stat-sub">20% budget allocation</div>
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
  const income = v.income;

  const needsPct = income > 0 ? ((v.needsTotal / income) * 100).toFixed(1) : '0.0';
  const wantsPct = income > 0 ? ((v.wantsTotal / income) * 100).toFixed(1) : '0.0';
  const savingsPct = income > 0 ? ((v.savingsTotal / income) * 100).toFixed(1) : '0.0';
  const netPct = income > 0 ? Math.max(0, ((v.netRemainingIncome / income) * 100)).toFixed(1) : '0.0';

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

  // Render dedicated Target & Leftover Budget Summary Grid inside Budget Allocation Card
  let targetGrid = document.getElementById('budgetTargetGrid');
  if (!targetGrid) {
    targetGrid = document.createElement('div');
    targetGrid.id = 'budgetTargetGrid';
    targetGrid.className = 'budget-target-grid mt-4';
    targetGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; border-top: 1px solid var(--border); padding-top: 16px; margin-top: 16px;';
    legend.parentNode.appendChild(targetGrid);
  }

  const needsBalClass = v.needsBalance < 0 ? 'text-danger' : 'text-success';
  const wantsBalClass = v.wantsBalance < 0 ? 'text-danger' : 'text-success';
  const savingsBalClass = v.savingsBalance < 0 ? 'text-danger' : 'text-success';

  targetGrid.innerHTML = `
    <div class="target-card-item" style="background: var(--bg-surface-elevated); padding: 12px 14px; border-radius: var(--r-md); border: 1px solid var(--border);">
      <div style="font-size: 0.72rem; color: var(--text-3); text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">📋 Needs Target</div>
      <div style="font-size: 0.95rem; font-weight: 800; color: var(--blue);">${fmt(v.needsBudget)}</div>
      <div style="font-size: 0.75rem; margin-top: 4px; color: var(--text-2);">Spent: <strong>${fmt(v.needsTotal)}</strong> | <span class="${needsBalClass}">Left: <strong>${fmt(v.needsBalance)}</strong></span></div>
    </div>

    <div class="target-card-item" style="background: var(--bg-surface-elevated); padding: 12px 14px; border-radius: var(--r-md); border: 1px solid var(--border);">
      <div style="font-size: 0.72rem; color: var(--text-3); text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">🛍️ Wants Target</div>
      <div style="font-size: 0.95rem; font-weight: 800; color: var(--accent);">${fmt(v.wantsBudget)}</div>
      <div style="font-size: 0.75rem; margin-top: 4px; color: var(--text-2);">Spent: <strong>${fmt(v.wantsTotal)}</strong> | <span class="${wantsBalClass}">Left: <strong>${fmt(v.wantsBalance)}</strong></span></div>
    </div>

    <div class="target-card-item" style="background: var(--bg-surface-elevated); padding: 12px 14px; border-radius: var(--r-md); border: 1px solid var(--border);">
      <div style="font-size: 0.72rem; color: var(--text-3); text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">🏆 Savings Target</div>
      <div style="font-size: 0.95rem; font-weight: 800; color: var(--gold);">${fmt(v.savingsBudget)}</div>
      <div style="font-size: 0.75rem; margin-top: 4px; color: var(--text-2);">Spent: <strong>${fmt(v.savingsTotal)}</strong> | <span class="${savingsBalClass}">Left: <strong>${fmt(v.savingsBalance)}</strong></span></div>
    </div>

    <div class="target-card-item" style="background: var(--bg-surface-elevated); padding: 12px 14px; border-radius: var(--r-md); border: 1px solid var(--border);">
      <div style="font-size: 0.72rem; color: var(--text-3); text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">💵 Unallocated Target</div>
      <div style="font-size: 0.95rem; font-weight: 800; color: var(--green);">${fmt(v.balanceBudget)}</div>
      <div style="font-size: 0.75rem; margin-top: 4px; color: var(--text-3);">Target Unallocated Balance</div>
    </div>
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
          'rgba(96, 165, 250, 0.85)',
          'rgba(157, 157, 250, 0.85)',
          'rgba(250, 204, 21, 0.85)',
        ],
        borderColor: [
          'rgba(96, 165, 250, 1)',
          'rgba(157, 157, 250, 1)',
          'rgba(250, 204, 21, 1)',
        ],
        borderWidth: 2,
        hoverOffset: 8,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '75%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: 'rgba(255, 255, 255, 0.7)',
            padding: 16,
            font: { family: 'Inter', size: 12, weight: '600' },
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 15, 20, 0.95)',
          titleColor: 'rgba(255, 255, 255, 0.95)',
          bodyColor: 'rgba(255, 255, 255, 0.7)',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 12,
          boxPadding: 6,
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
        backgroundColor: values.map(v => v > 0 ? 'rgba(157, 157, 250, 0.7)' : 'rgba(255,255,255,0.03)'),
        borderColor: values.map(v => v > 0 ? 'rgba(157, 157, 250, 1)' : 'transparent'),
        borderWidth: 1,
        borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 2, bottomRight: 2 },
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 15, 20, 0.95)',
          titleColor: '#ffffff',
          bodyColor: 'rgba(255, 255, 255, 0.7)',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          cornerRadius: 12,
          padding: 12,
          callbacks: {
            title: (items) => `${dailyBreakdown.dateLabelsMap[items[0].dataIndex + 1]}`,
            label: (ctx) => ` ${fmt(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { size: 10, family: 'Inter', weight: '500' } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
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
  d.income.total = d.income.entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  
  document.getElementById('incomeInput').value = fmt(d.income.total);
  document.getElementById('needsPct').value = d.income.needsPct || 50;
  document.getElementById('savingsPct').value = d.income.savingsPct || 20;
  document.getElementById('wantsPct').value = d.income.wantsPct || 10;
  document.getElementById('initialBalanceInput').value = d.initialBankBalance || '';

  const tbody = document.getElementById('incomeListBody');
  if (d.income.entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💵</div><p>No income entries added yet</p></div></td></tr>`;
  } else {
    tbody.innerHTML = d.income.entries.map((entry, idx) => `
      <tr>
        <td class="text-muted">${idx + 1}</td>
        <td class="text-muted">${entry.date}</td>
        <td><strong>${escapeHtml(entry.source)}</strong></td>
        <td class="amount positive">${fmt(entry.amount)}</td>
        <td>
          <div class="actions">
            <button class="btn-icon delete" onclick="deleteIncomeEntry('${entry.id}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

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
  const needsPct = Number(document.getElementById('needsPct').value) || 0;
  const savingsPct = Number(document.getElementById('savingsPct').value) || 0;
  const wantsPct = Number(document.getElementById('wantsPct').value) || 0;

  if (needsPct + savingsPct + wantsPct > 100) {
    showToast('Budget percentages cannot exceed 100% in total.', 'error');
    return;
  }

  d.income.needsPct = needsPct;
  d.income.savingsPct = savingsPct;
  d.income.wantsPct = wantsPct;
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
  d.income.total = d.income.entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

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
  d.income.total = d.income.entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  saveToStorage();
  renderAll();
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

  if (initialBal > 0) {
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

function transferBankFunds() {
  const fromId = document.getElementById('transferFromAccountId').value;
  const toId = document.getElementById('transferToAccountId').value;
  const date = document.getElementById('transferDateInput').value || getTodayDate();
  const amount = Number(document.getElementById('transferAmountInput').value);
  const note = document.getElementById('transferNoteInput').value.trim();

  if (!fromId || !toId) {
    showToast('Select both From and To bank accounts', 'error');
    return;
  }
  if (fromId === toId) {
    showToast('From and To bank accounts must be different', 'error');
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    showToast('Enter a valid positive transfer amount', 'error');
    return;
  }

  const fromAcc = state.registeredAccounts.find(a => a.id === fromId);
  const toAcc = state.registeredAccounts.find(a => a.id === toId);
  if (!fromAcc || !toAcc) {
    showToast('Selected bank account not found', 'error');
    return;
  }

  const d = getCurrentData();
  // Gather ALL bank entries across ALL months for accurate balance
  let allBankEntries = [];
  Object.values(state.data).forEach(m => {
    if (m.banks && Array.isArray(m.banks)) {
      allBankEntries = allBankEntries.concat(m.banks);
    }
  });
  const latestBalances = getAccountLatestBalances(allBankEntries);
  const fromBalItem = latestBalances.find(b => b.account.id === fromId);
  const toBalItem = latestBalances.find(b => b.account.id === toId);

  const currentFromBal = fromBalItem ? fromBalItem.latestBalance : 0;
  const currentToBal = toBalItem ? toBalItem.latestBalance : 0;

  if (amount > currentFromBal) {
    showToast(`Insufficient balance in source account. Available: ${fmt(currentFromBal)}`, 'error');
    return;
  }

  const newFromBal = currentFromBal - amount;
  const newToBal = currentToBal + amount;

  const now = new Date();
  const timeStr1 = now.toISOString();
  const timeStr2 = new Date(now.getTime() + 1000).toISOString();

  // Outflow entry for From Account
  d.banks.push({
    date,
    createdAt: timeStr1,
    accountId: fromAcc.id,
    bankName: fromAcc.bankName,
    accountNumber: fromAcc.accountNumber,
    balance: newFromBal,
    note: note ? `Transfer to ${toAcc.bankName} (${note})` : `Transfer to ${toAcc.bankName}`,
    type: 'transfer_out',
    transferAmount: amount
  });

  // Inflow entry for To Account
  d.banks.push({
    date,
    createdAt: timeStr2,
    accountId: toAcc.id,
    bankName: toAcc.bankName,
    accountNumber: toAcc.accountNumber,
    balance: newToBal,
    note: note ? `Transfer from ${fromAcc.bankName} (${note})` : `Transfer from ${fromAcc.bankName}`,
    type: 'transfer_in',
    transferAmount: amount
  });

  saveToStorage();
  renderBanks();

  document.getElementById('transferAmountInput').value = '';
  document.getElementById('transferNoteInput').value = '';
  showToast(`Transferred ${fmt(amount)} from ${fromAcc.bankName} to ${toAcc.bankName}`, 'success');
}

window.deleteBankAccount = function(accId) {
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
  renderAll();
  showToast('Account deleted', 'info');
};

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

  const fromSelect = document.getElementById('transferFromAccountId');
  const toSelect = document.getElementById('transferToAccountId');
  const transferDateInput = document.getElementById('transferDateInput');

  if (transferDateInput && !transferDateInput.value) {
    transferDateInput.value = getTodayDate();
  }

  if (fromSelect && toSelect) {
    if (state.registeredAccounts.length === 0) {
      fromSelect.innerHTML = `<option value="">No Bank Accounts Available</option>`;
      toSelect.innerHTML = `<option value="">No Bank Accounts Available</option>`;
    } else {
      const prevFrom = fromSelect.value;
      const prevTo = toSelect.value;

      const options = state.registeredAccounts.map(acc => `
        <option value="${acc.id}">${escapeHtml(acc.bankName)} (${formatAccountNum(acc.accountNumber)})</option>
      `).join('');

      fromSelect.innerHTML = options;
      toSelect.innerHTML = options;

      if (prevFrom && state.registeredAccounts.some(a => a.id === prevFrom)) {
        fromSelect.value = prevFrom;
      }
      if (prevTo && state.registeredAccounts.some(a => a.id === prevTo)) {
        toSelect.value = prevTo;
      } else if (state.registeredAccounts.length > 1) {
        if (fromSelect.selectedIndex === 0) {
          toSelect.selectedIndex = 1;
        }
      }
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
          <div class="bank-bal-value" style="color: ${item.latestBalance < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(item.latestBalance)}</div>
          <div class="bank-card-footer" style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.75rem;color:var(--text-3);">${item.entryCount} balance log${item.entryCount !== 1 ? 's' : ''}</span>
            <button class="btn-icon delete" onclick="deleteBankAccount('${item.account.id}')" title="Delete Account">🗑️</button>
          </div>
        </div>
      `).join('');
    }
  }

  const tbody = document.getElementById('banksTableBody');
  // Show all entries including dynamic payment deductions and refunds so the user can see the ledger!
  const visibleBanks = d.banks || [];
  if (visibleBanks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏦</div><p>No balance entries recorded</p></div></td></tr>`;
  } else {
    const sortedBanks = visibleBanks
      .map((item, originalIndex) => {
        // Find the real originalIndex in d.banks for edit/delete
        const realIndex = (d.banks || []).indexOf(item);
        return { item, originalIndex: realIndex };
      })
      .sort((a, b) => sortEntriesDesc(a.item, b.item));

    tbody.innerHTML = sortedBanks.map(({ item: b, originalIndex }, displayIdx) => {
      let effectiveType = b.type;
      if (!effectiveType && b.note) {
        if (b.note.startsWith('Paid:')) effectiveType = 'payment_deduction';
        else if (b.note.startsWith('Payment:')) effectiveType = 'bill_payment';
      }

      let badgeHtml = '';
      if (effectiveType === 'transfer_out') {
        badgeHtml = `<span class="badge-source badge-transfer-out">↔️ Outflow</span> `;
      } else if (effectiveType === 'transfer_in') {
        badgeHtml = `<span class="badge-source badge-transfer-in">↔️ Inflow</span> `;
      } else if (effectiveType === 'payment_deduction') {
        badgeHtml = `<span class="badge-source badge-transfer-out">💸 Expense</span> `;
      } else if (effectiveType === 'bill_payment') {
        badgeHtml = `<span class="badge-source badge-transfer-out">💳 Bill Paid</span> `;
      } else if (effectiveType === 'refund') {
        badgeHtml = `<span class="badge-source badge-transfer-in">↩️ Refund</span> `;
      }

      const noteContent = b.note ? `${badgeHtml}${escapeHtml(b.note)}` : (badgeHtml || '-');

      return `
      <tr>
        <td class="text-muted">${displayIdx + 1}</td>
        <td class="text-muted">${b.date || getTodayDate()}</td>
        <td><strong>${escapeHtml(b.bankName || b.name)}</strong></td>
        <td><span class="bank-acc-num-badge">${escapeHtml(formatAccountNum(b.accountNumber))}</span></td>
        <td class="amount ${Number(b.balance) >= 0 ? 'positive' : 'negative'}">${fmt(b.balance)}</td>
        <td style="font-size:0.83rem;">${noteContent}</td>
        <td>
          <div class="actions">
            <button class="btn-icon edit" onclick="openEditModal('banks', ${originalIndex})" title="Edit">✏️</button>
            <button class="btn-icon delete" onclick="deleteItem('banks', ${originalIndex})" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `}).join('');
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
              <th>Comments</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td class="text-muted">${item.date}</td>
                <td><span style="padding:2px 8px;border-radius:4px;font-size:0.72rem;font-weight:600;background:${item.category === 'Needs' ? 'rgba(163, 196, 243, 0.15);color:#a3c4f3' : 'rgba(207, 186, 240, 0.15);color:#cfbaf0'}">${item.category}</span></td>
                <td>${escapeHtml(item.name)}</td>
                <td class="text-muted">${escapeHtml(item.comment || '-')}</td>
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
        backgroundColor: values.map(v => v > 0 ? 'rgba(157, 157, 250, 0.65)' : 'rgba(255,255,255,0.03)'),
        borderColor: values.map(v => v > 0 ? 'rgba(157, 157, 250, 0.95)' : 'transparent'),
        borderWidth: 1,
        borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 2, bottomRight: 2 },
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 15, 20, 0.95)',
          titleColor: '#ffffff',
          bodyColor: 'rgba(255, 255, 255, 0.7)',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          cornerRadius: 10,
          padding: 12,
          callbacks: {
            label: (ctx) => ` ${fmt(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { size: 10, family: 'Inter', weight: '500' } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
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
    if (type.includes('FD') || type.includes('RD')) {
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
  const paymentSource = document.getElementById('savingsPaymentSourceSelect')?.value || 'cash';

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
    paymentSource,
  };

  d.savings.push(entry);
  if (inst.type.includes('FD') || inst.type.includes('RD')) {
    d.deposits.push(entry);
  }

  processPaymentSourceEffect(paymentSource, amount, `Investment: ${inst.name}`, date);

  saveToStorage();
  renderSavings();

  document.getElementById('savingsEntryAmountInput').value = '';
  showToast(`Recorded ${fmt(amount)} for ${inst.name}`, 'success');
}

window.deleteSavingsInstrument = function(instId) {
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
  renderAll();
  showToast('Savings instrument deleted', 'info');
};

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
  let allSavings = [];
  let allDeposits = [];
  Object.values(state.data).forEach(m => {
    if (m.savings && Array.isArray(m.savings)) allSavings = allSavings.concat(m.savings);
    if (m.deposits && Array.isArray(m.deposits)) allDeposits = allDeposits.concat(m.deposits);
  });
  const cumulativeSavings = getInstrumentCumulativeSavings(allSavings);

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
  const depositEntries = allDeposits.concat(allSavings.filter(s => s.type === 'FD' || s.type === 'RD'));

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

// ─── Payment Source Helpers ───────────────────
function getPaymentSourceBadge(paymentSource) {
  if (!paymentSource || paymentSource === 'cash') {
    return `<span class="badge-source badge-cash">💵 Cash</span>`;
  }
  if (paymentSource.startsWith('bank_')) {
    const accId = paymentSource.replace('bank_', '');
    const acc = (state.registeredAccounts || []).find(a => a.id === accId);
    const label = acc ? `${acc.bankName} (•••• ${acc.accountNumber.slice(-4)})` : 'Bank';
    return `<span class="badge-source badge-bank">🏦 ${escapeHtml(label)}</span>`;
  }
  if (paymentSource.startsWith('debt_')) {
    const debtId = paymentSource.replace('debt_', '');
    const debt = (state.registeredLoansAndCards || []).find(d => d.id === debtId);
    const label = debt ? debt.name : 'Credit';
    return `<span class="badge-source badge-credit">💳 ${escapeHtml(label)}</span>`;
  }
  return `<span class="badge-source badge-cash">💵 Cash</span>`;
}

function processBankAdjustment(bankId, amountChange, note, type) {
  const acc = (state.registeredAccounts || []).find(a => a.id === bankId);
  if (!acc) return;
  
  let allBankEntries = [];
  Object.values(state.data).forEach(m => {
    if (m.banks && Array.isArray(m.banks)) allBankEntries = allBankEntries.concat(m.banks);
  });
  const balancesInfo = getAccountLatestBalances(allBankEntries);
  const accInfo = balancesInfo.find(b => b.account.id === bankId);
  const curBal = accInfo ? accInfo.latestBalance : 0;
  
  const newBalance = curBal + amountChange;
  if (newBalance < 0) {
    showToast(`Warning: ${acc.bankName} balance insufficient. Set to ₹0.`, 'warning');
  }

  const d = getCurrentData();
  d.banks.push({
    id: 'bank_adj_' + Date.now() + Math.floor(Math.random() * 1000),
    createdAt: new Date().toISOString(),
    accountId: bankId,
    bankName: acc.bankName,
    accountNumber: acc.accountNumber,
    date: getTodayDate(),
    balance: Math.max(0, newBalance),
    note: note,
    type: type
  });
}

function processPaymentSourceEffect(paymentSource, amount, description, date) {
  if (!paymentSource || paymentSource === 'cash') return;
  const d = getCurrentData();

  if (paymentSource.startsWith('bank_')) {
    const accountId = paymentSource.replace('bank_', '');
    processBankAdjustment(accountId, -amount, `Paid: ${description}`, 'payment_deduction');
  } else if (paymentSource.startsWith('debt_')) {
    const debtId = paymentSource.replace('debt_', '');
    if (!d.loansAndCardsData) d.loansAndCardsData = {};
    if (!d.loansAndCardsData[debtId]) {
      const inst = (state.registeredLoansAndCards || []).find(i => i.id === debtId);
      d.loansAndCardsData[debtId] = { outstanding: inst ? (Number(inst.initialOutstanding) || 0) : 0 };
    }
    d.loansAndCardsData[debtId].outstanding = (Number(d.loansAndCardsData[debtId].outstanding) || 0) + amount;
  }
}

function renderPaymentSourceOptions() {
  const selects = document.querySelectorAll('.payment-source-select');
  selects.forEach(select => {
    const currentVal = select.value;
    let html = `<option value="cash">💵 Cash</option>`;

    if (state.registeredAccounts && state.registeredAccounts.length > 0) {
      html += `<optgroup label="🏦 Bank Accounts">`;
      state.registeredAccounts.forEach(acc => {
        html += `<option value="bank_${acc.id}">🏦 ${escapeHtml(acc.bankName)} (•••• ${acc.accountNumber.slice(-4)})</option>`;
      });
      html += `</optgroup>`;
    }

    if (state.registeredLoansAndCards && state.registeredLoansAndCards.length > 0) {
      html += `<optgroup label="💳 Loans & Credit Cards">`;
      state.registeredLoansAndCards.forEach(debt => {
        const icon = debt.type === 'credit_card' ? '💳' : '🏦';
        html += `<option value="debt_${debt.id}">${icon} ${escapeHtml(debt.name)}</option>`;
      });
      html += `</optgroup>`;
    }

    select.innerHTML = html;
    if (currentVal) select.value = currentVal;
  });
}

// ─── Loans & Credit Cards Management ──────────
function createDebtInstrument() {
  const type = document.getElementById('debtTypeInput').value;
  const name = document.getElementById('debtNameInput').value.trim();
  const lender = document.getElementById('debtLenderInput').value.trim();
  const limitOrPrincipal = Number(document.getElementById('debtLimitOrPrincipalInput').value) || 0;
  const initialOutstanding = Number(document.getElementById('debtInitialOutstandingInput').value) || 0;
  const emiAmount = Number(document.getElementById('debtEmiInput').value) || 0;

  if (!name) { showToast('Enter name/description', 'error'); return; }
  if (!lender) { showToast('Enter Bank/Lender name', 'error'); return; }

  const newDebt = {
    id: 'debt_' + Date.now(),
    type,
    name,
    lender,
    limit: type === 'credit_card' ? limitOrPrincipal : 0,
    principal: type === 'loan' ? limitOrPrincipal : 0,
    initialOutstanding,
    emiAmount: type === 'loan' ? emiAmount : 0,
    createdAt: new Date().toISOString()
  };

  if (!state.registeredLoansAndCards) state.registeredLoansAndCards = [];
  state.registeredLoansAndCards.push(newDebt);

  const d = getCurrentData();
  if (!d.loansAndCardsData) d.loansAndCardsData = {};
  d.loansAndCardsData[newDebt.id] = { outstanding: initialOutstanding, payments: [] };

  saveToStorage();
  renderAll();

  document.getElementById('debtNameInput').value = '';
  document.getElementById('debtLenderInput').value = '';
  document.getElementById('debtLimitOrPrincipalInput').value = '';
  document.getElementById('debtInitialOutstandingInput').value = '';
  document.getElementById('debtEmiInput').value = '';

  showToast(`${type === 'credit_card' ? 'Credit Card' : 'Loan'} added successfully`, 'success');
}

function renderLoansAndCards() {
  const d = getCurrentData();
  const v = getComputedValues();

  document.getElementById('totalCreditLimitVal').textContent = fmt(v.totalCreditLimit);
  document.getElementById('availCreditLimitSub').textContent = `Avail: ${fmt(v.availCreditLimit)}`;
  document.getElementById('totalCardDebtVal').textContent = fmt(v.totalCardDebt);
  document.getElementById('totalLoanDebtVal').textContent = fmt(v.totalLoanDebt);
  document.getElementById('totalMonthlyEmiVal').textContent = fmt(v.totalMonthlyEmi);

  const cardsContainer = document.getElementById('creditCardsGrid');
  const loansContainer = document.getElementById('loansGrid');
  const debtInstruments = state.registeredLoansAndCards || [];

  const cards = debtInstruments.filter(i => i.type === 'credit_card');
  const loans = debtInstruments.filter(i => i.type === 'loan');

  if (cards.length === 0) {
    cardsContainer.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">💳</div><p>No credit cards registered yet</p></div>`;
  } else {
    cardsContainer.innerHTML = cards.map(c => {
      const dData = (d.loansAndCardsData || {})[c.id] || { outstanding: c.initialOutstanding || 0 };
      const outstanding = Number(dData.outstanding) || 0;
      const limit = Number(c.limit) || 1;
      const avail = Math.max(0, limit - outstanding);
      const usedPct = Math.min(100, Math.round((outstanding / limit) * 100));

      return `
        <div class="bank-account-card">
          <div class="bank-card-header">
            <div>
              <div class="bank-card-name">💳 ${escapeHtml(c.name)}</div>
              <div class="bank-card-num">${escapeHtml(c.lender)}</div>
            </div>
            <button class="btn-icon delete" onclick="deleteDebtInstrument('${c.id}')" title="Delete Card">🗑️</button>
          </div>
          <div class="bank-card-balance text-red">${fmt(outstanding)}</div>
          <div class="bank-card-meta">
            <span>Outstanding Debt</span>
            <span>Limit: ${fmt(limit)}</span>
          </div>
          <div style="margin: 10px 0 6px; background: rgba(255,255,255,0.08); height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="width: ${usedPct}%; height: 100%; background: ${usedPct > 80 ? 'var(--red)' : 'var(--accent)'}; border-radius: 3px;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 12px;">
            <span style="font-size:0.75rem; color:var(--text-muted);">Avail: ${fmt(avail)}</span>
            <button class="btn btn-secondary" onclick="openDebtRepayModal('${c.id}', 'credit_card')" style="padding:4px 10px; font-size:0.75rem;">💳 Pay Bill</button>
          </div>
        </div>
      `;
    }).join('');
  }

  if (loans.length === 0) {
    loansContainer.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🏦</div><p>No active loans registered yet</p></div>`;
  } else {
    loansContainer.innerHTML = loans.map(l => {
      const dData = (d.loansAndCardsData || {})[l.id] || { outstanding: l.initialOutstanding || l.principal || 0 };
      const outstanding = Number(dData.outstanding) || 0;
      const original = Number(l.principal) || 1;
      const paid = Math.max(0, original - outstanding);
      const paidPct = Math.min(100, Math.round((paid / original) * 100));

      return `
        <div class="bank-account-card">
          <div class="bank-card-header">
            <div>
              <div class="bank-card-name">🏦 ${escapeHtml(l.name)}</div>
              <div class="bank-card-num">${escapeHtml(l.lender)}</div>
            </div>
            <button class="btn-icon delete" onclick="deleteDebtInstrument('${l.id}')" title="Delete Loan">🗑️</button>
          </div>
          <div class="bank-card-balance text-red">${fmt(outstanding)}</div>
          <div class="bank-card-meta">
            <span>Remaining Principal</span>
            <span>EMI: ${fmt(l.emiAmount)}</span>
          </div>
          <div style="margin: 10px 0 6px; background: rgba(255,255,255,0.08); height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="width: ${paidPct}%; height: 100%; background: var(--green); border-radius: 3px;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 12px;">
            <span style="font-size:0.75rem; color:var(--text-muted);">${paidPct}% Paid Off</span>
            <button class="btn btn-secondary" onclick="openDebtRepayModal('${l.id}', 'loan')" style="padding:4px 10px; font-size:0.75rem;">⚡ Record EMI</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.openDebtRepayModal = function(id, actionType) {
  const inst = (state.registeredLoansAndCards || []).find(i => i.id === id);
  if (!inst) return;

  const d = getCurrentData();
  const dData = (d.loansAndCardsData || {})[id] || { outstanding: inst.initialOutstanding || 0 };
  const currentOut = Number(dData.outstanding) || 0;

  document.getElementById('debtRepayInstrumentId').value = id;
  document.getElementById('debtRepayActionType').value = actionType;
  document.getElementById('debtRepayModalTitle').textContent = actionType === 'credit_card' ? `Pay ${inst.name} Bill` : `Record ${inst.name} EMI`;
  document.getElementById('debtRepayAmountInput').value = actionType === 'loan' ? (inst.emiAmount || '') : (currentOut || '');
  document.getElementById('debtRepayDateInput').value = getTodayDate();

  renderPaymentSourceOptions();
  document.getElementById('debtRepayModal').classList.add('active');
};

function processDebtRepaySubmit() {
  const id = document.getElementById('debtRepayInstrumentId').value;
  const actionType = document.getElementById('debtRepayActionType').value;
  const amount = Number(document.getElementById('debtRepayAmountInput').value) || 0;
  const source = document.getElementById('debtRepaySourceSelect').value;
  const date = document.getElementById('debtRepayDateInput').value || getTodayDate();

  if (amount <= 0) { showToast('Enter valid payment amount', 'error'); return; }

  const inst = (state.registeredLoansAndCards || []).find(i => i.id === id);
  if (!inst) return;

  const d = getCurrentData();
  if (!d.loansAndCardsData) d.loansAndCardsData = {};
  if (!d.loansAndCardsData[id]) d.loansAndCardsData[id] = { outstanding: inst.initialOutstanding || 0 };

  d.loansAndCardsData[id].outstanding = Math.max(0, (Number(d.loansAndCardsData[id].outstanding) || 0) - amount);

  if (source.startsWith('bank_')) {
    const bankAccId = source.replace('bank_', '');
    processBankAdjustment(bankAccId, -amount, `Bill Payment: ${inst.name}`, 'bill_payment');
  }

  if (actionType === 'loan') {
    d.needs.push({
      date,
      createdAt: new Date().toISOString(),
      name: `EMI: ${inst.name}`,
      paymentSource: source,
      amount
    });
  }

  saveToStorage();
  renderAll();
  document.getElementById('debtRepayModal').classList.remove('active');
  showToast(`${actionType === 'credit_card' ? 'Credit Card Bill' : 'EMI'} Payment Recorded!`, 'success');
}

window.deleteDebtInstrument = function(id) {
  state.registeredLoansAndCards = (state.registeredLoansAndCards || []).filter(i => i.id !== id);
  saveToStorage();
  renderAll();
  showToast('Instrument deleted', 'info');
}

// ─── Wants ────────────────────────────────────
function renderWants() {
  const d = getFilteredData();
  const v = getComputedValues();
  const tbody = document.getElementById('wantsTableBody');

  renderCategoryBudget('wantsBudget', 'Wants Budget', v.wantsBudget, v.wantsTotal, 'var(--accent)');

  if (!d.wants || d.wants.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🛍️</div><p>No wants expenses added yet</p></div></td></tr>`;
  } else {
    const sortedWants = d.wants
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => sortEntriesDesc(a.item, b.item));

    tbody.innerHTML = sortedWants.map(({ item: w, originalIndex }, displayIdx) => `
      <tr>
        <td class="text-muted">${displayIdx + 1}</td>
        <td class="text-muted">${w.date || getTodayDate()}</td>
        <td>${escapeHtml(w.name)}</td>
        <td>${getPaymentSourceBadge(w.paymentSource)}</td>
        <td class="text-muted">${escapeHtml(w.comment || '-')}</td>
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
  const comment = document.getElementById('wantsCommentInput') ? document.getElementById('wantsCommentInput').value.trim() : '';
  const amount = Number(document.getElementById('wantsAmountInput').value);
  const paymentSource = document.getElementById('wantsPaymentSourceSelect')?.value || 'cash';

  if (!name) { showToast('Enter expense name', 'error'); return; }
  if (isNaN(amount) || amount <= 0) { showToast('Enter valid amount', 'error'); return; }

  const d = getCurrentData();
  d.wants.push({ date, createdAt: new Date().toISOString(), name, comment, amount, paymentSource });
  processPaymentSourceEffect(paymentSource, amount, name, date);

  saveToStorage();
  renderAll();

  document.getElementById('wantsNameInput').value = '';
  if (document.getElementById('wantsCommentInput')) document.getElementById('wantsCommentInput').value = '';
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
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>No needs expenses added yet</p></div></td></tr>`;
  } else {
    const sortedNeeds = d.needs
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => sortEntriesDesc(a.item, b.item));

    tbody.innerHTML = sortedNeeds.map(({ item: n, originalIndex }, displayIdx) => `
      <tr>
        <td class="text-muted">${displayIdx + 1}</td>
        <td class="text-muted">${n.date || getTodayDate()}</td>
        <td>${escapeHtml(n.name)}</td>
        <td>${getPaymentSourceBadge(n.paymentSource)}</td>
        <td class="text-muted">${escapeHtml(n.comment || '-')}</td>
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
  const comment = document.getElementById('needsCommentInput') ? document.getElementById('needsCommentInput').value.trim() : '';
  const amount = Number(document.getElementById('needsAmountInput').value);
  const paymentSource = document.getElementById('needsPaymentSourceSelect')?.value || 'cash';

  if (!name) { showToast('Enter expense name', 'error'); return; }
  if (isNaN(amount) || amount <= 0) { showToast('Enter valid amount', 'error'); return; }

  const d = getCurrentData();
  d.needs.push({ date, createdAt: new Date().toISOString(), name, comment, amount, paymentSource });
  processPaymentSourceEffect(paymentSource, amount, name, date);

  saveToStorage();
  renderAll();

  document.getElementById('needsNameInput').value = '';
  if (document.getElementById('needsCommentInput')) document.getElementById('needsCommentInput').value = '';
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
window.deleteItem = function(type, index) {
  const d = getCurrentData();
  if (!d[type] || index < 0 || index >= d[type].length) return;
  const item = d[type][index];
  const name = item.name || item.bankName || 'item';
  if (!confirm(`Delete "${name}"?`)) return;

  // Handle Refunds for Bank / Credit Card
  if (['needs', 'wants', 'savings'].includes(type) && item.paymentSource) {
    if (item.paymentSource.startsWith('bank_')) {
      const bankId = item.paymentSource.replace('bank_', '');
      processBankAdjustment(bankId, Number(item.amount) || 0, `Refund for deleted ${type}: ${name}`, 'refund');
    } else if (item.paymentSource.startsWith('debt_')) {
      const debtId = item.paymentSource.replace('debt_', '');
      if (d.loansAndCardsData && d.loansAndCardsData[debtId]) {
        d.loansAndCardsData[debtId].outstanding = Math.max(0, (Number(d.loansAndCardsData[debtId].outstanding) || 0) - (Number(item.amount) || 0));
      }
    }
  }

  d[type].splice(index, 1);
  saveToStorage();
  renderAll();
  showToast('Deleted', 'info');
};

window.openEditModal = openEditModal;

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
        <div class="form-group mb-4">
          <label>Recorded Balance (₹)</label>
          <input type="number" id="editField2" value="${item.balance}" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label>Note / Details</label>
          <input type="text" id="editFieldNote" value="${escapeHtml(item.note || '')}">
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
        <div class="form-group mb-4">
          <label>Paid Via</label>
          <select id="editPaymentSource" class="payment-source-select">
            <option value="cash">💵 Cash</option>
          </select>
        </div>
        <div class="form-group mb-4">
          <label>Comments</label>
          <input type="text" id="editComment" value="${escapeHtml(item.comment || '')}" placeholder="Optional notes">
        </div>
        <div class="form-group">
          <label>Amount (₹)</label>
          <input type="number" id="editField2" value="${item.amount}" min="0" step="0.01">
        </div>
      `;
      break;
  }

  body.innerHTML = formHtml;
  if (type === 'wants' || type === 'needs') {
    renderPaymentSourceOptions();
    const psSelect = document.getElementById('editPaymentSource');
    if (psSelect && item.paymentSource) {
      psSelect.value = item.paymentSource;
    }
  }
  modal.classList.add('active');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
  editContext = null;
}

function saveEdit() {
  if (!editContext) return;
  const targetType = editContext.type;
  const targetIndex = editContext.index;
  const d = getCurrentData();
  const item = d[targetType] ? d[targetType][targetIndex] : null;

  if (!item) return;

  const oldItem = JSON.parse(JSON.stringify(item));

  const editDate = document.getElementById('editDate') ? document.getElementById('editDate').value : getTodayDate();
  item.date = editDate;

  switch (targetType) {
    case 'banks':
      item.bankName = document.getElementById('editField1').value.trim();
      item.accountNumber = document.getElementById('editFieldAcc').value.trim();
      item.balance = Number(document.getElementById('editField2').value) || 0;
      if (document.getElementById('editFieldNote')) {
        item.note = document.getElementById('editFieldNote').value.trim();
      }
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
      if (document.getElementById('editComment')) {
        item.comment = document.getElementById('editComment').value.trim();
      }
      item.amount = Number(document.getElementById('editField2').value) || 0;
      if (document.getElementById('editPaymentSource')) {
        item.paymentSource = document.getElementById('editPaymentSource').value;
      }
      break;
  }

  // Handle Bank/Debt Adjustments for Needs/Wants/Savings
  if (['needs', 'wants', 'savings'].includes(targetType) && (oldItem.paymentSource || item.paymentSource)) {
    // 1. Revert old item
    if (oldItem.paymentSource && oldItem.paymentSource.startsWith('bank_')) {
      const bankId = oldItem.paymentSource.replace('bank_', '');
      processBankAdjustment(bankId, Number(oldItem.amount) || 0, `Refund: Edit ${oldItem.name}`, 'refund');
    } else if (oldItem.paymentSource && oldItem.paymentSource.startsWith('debt_')) {
      const debtId = oldItem.paymentSource.replace('debt_', '');
      if (d.loansAndCardsData && d.loansAndCardsData[debtId]) {
        d.loansAndCardsData[debtId].outstanding = Math.max(0, (Number(d.loansAndCardsData[debtId].outstanding) || 0) - (Number(oldItem.amount) || 0));
      }
    }

    // 2. Apply new item
    if (item.paymentSource && item.paymentSource.startsWith('bank_')) {
      const bankId = item.paymentSource.replace('bank_', '');
      processBankAdjustment(bankId, -(Number(item.amount) || 0), `Paid: ${item.name}`, 'payment_deduction');
    } else if (item.paymentSource && item.paymentSource.startsWith('debt_')) {
      const debtId = item.paymentSource.replace('debt_', '');
      if (d.loansAndCardsData && d.loansAndCardsData[debtId]) {
        d.loansAndCardsData[debtId].outstanding = (Number(d.loansAndCardsData[debtId].outstanding) || 0) + (Number(item.amount) || 0);
      }
    }
  }

  saveToStorage();
  closeEditModal();
  renderAll();
  showToast('Changes saved', 'success');
}

// ─── CSV Export / Import ──────────────────────
function exportCSV() {
  const rows = [['Date', 'Month', 'Category', 'Type', 'Particulars/Name', 'Account Number/Paid Via', 'Comments/Notes', 'Amount/Balance']];

  Object.keys(state.data || {}).forEach(month => {
    const d = state.data[month];
    if (!d) return;

    // Export Income Entries
    if (d.income && Array.isArray(d.income.entries)) {
      d.income.entries.forEach(item => {
        rows.push([item.date || getTodayDate(), month, 'Income', 'Income', item.source || item.name || 'Income', item.paymentSource || '', item.comment || '', item.amount || 0]);
      });
    }

    // Export Needs
    (d.needs || []).forEach(item => {
      rows.push([item.date || getTodayDate(), month, 'Needs', 'Expense', item.name || '', item.paymentSource || '', item.comment || '', item.amount || 0]);
    });

    // Export Wants
    (d.wants || []).forEach(item => {
      rows.push([item.date || getTodayDate(), month, 'Wants', 'Expense', item.name || '', item.paymentSource || '', item.comment || '', item.amount || 0]);
    });

    // Export Savings
    (d.savings || []).forEach(item => {
      rows.push([item.date || getTodayDate(), month, 'Savings', item.type || 'Savings', item.name || '', item.accountNumber || item.paymentSource || '', item.comment || '', item.amount || 0]);
    });

    // Export Deposits
    (d.deposits || []).forEach(item => {
      rows.push([item.date || getTodayDate(), month, 'Deposits', item.type || 'FD', item.name || '', item.accountNumber || '', item.comment || '', item.amount || 0]);
    });

    // Export Bank Accounts
    (d.banks || []).forEach(item => {
      rows.push([item.date || getTodayDate(), month, 'Banks', item.type || 'Account', item.bankName || item.name || '', item.accountNumber || '', item.note || item.comment || '', item.balance || 0]);
    });
  });

  const csvContent = rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kanakku_Book_${(state.currentMonth || 'Export').replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV Exported', 'success');
}

function importCSV(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const text = e.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length <= 1) {
        showToast('Empty or invalid CSV', 'error');
        if (callback) callback(false);
        return;
      }

      const d = getCurrentData();
      let importedCount = 0;

      if (!d.needs) d.needs = [];
      if (!d.wants) d.wants = [];
      if (!d.savings) d.savings = [];
      if (!d.income) d.income = { total: 0, entries: [], needsPct: 50, savingsPct: 20, wantsPct: 10 };
      if (!d.income.entries) d.income.entries = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        if (parts.length >= 4) {
          const cleanParts = parts.map(p => p.replace(/^"|"$/g, '').trim());
          
          let date = cleanParts[0] || getTodayDate();
          let month = '';
          let category = '';
          let type = '';
          let name = '';
          let accNum = '';
          let comment = '';
          let amount = 0;

          if (cleanParts.length >= 8) {
            month = cleanParts[1];
            category = (cleanParts[2] || '').toLowerCase();
            type = cleanParts[3] || '';
            name = cleanParts[4] || 'Imported Entry';
            accNum = cleanParts[5] || '';
            comment = cleanParts[6] || '';
            amount = Number(cleanParts[7]) || 0;
          } else {
            category = (cleanParts[1] || '').toLowerCase();
            type = cleanParts[2] || '';
            name = cleanParts[3] || 'Imported Entry';
            accNum = cleanParts[4] || '';
            comment = cleanParts[5] || '';
            amount = Number(cleanParts[6] || cleanParts[5] || cleanParts[4]) || 0;
          }

          if (category.includes('income') || category.includes('inc')) {
            if (!d.income) d.income = { total: 0, entries: [], needsPct: 50, savingsPct: 20, wantsPct: 10 };
            if (!d.income.entries) d.income.entries = [];
            d.income.entries.push({
              id: 'inc_' + Date.now() + Math.random().toString(36).substr(2, 4),
              date,
              source: name,
              amount,
              comment
            });
            d.income.total = d.income.entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
          } else if (category.includes('need')) {
            if (!d.needs) d.needs = [];
            d.needs.push({ id: 'need_' + Date.now() + Math.random().toString(36).substr(2, 4), date, name, amount, comment, paymentSource: accNum || 'cash' });
          } else if (category.includes('want')) {
            if (!d.wants) d.wants = [];
            d.wants.push({ id: 'want_' + Date.now() + Math.random().toString(36).substr(2, 4), date, name, amount, comment, paymentSource: accNum || 'cash' });
          } else if (category.includes('sav')) {
            if (!d.savings) d.savings = [];
            d.savings.push({ id: 'sav_' + Date.now() + Math.random().toString(36).substr(2, 4), date, type: type || 'Savings', name, accountNumber: accNum, amount, comment });
          } else if (category.includes('dep')) {
            if (!d.deposits) d.deposits = [];
            d.deposits.push({ id: 'dep_' + Date.now() + Math.random().toString(36).substr(2, 4), date, type: type === 'RD' ? 'RD' : 'FD', name, accountNumber: accNum, amount, comment });
          } else if (category.includes('bank')) {
            if (!d.banks) d.banks = [];
            let acc = state.registeredAccounts.find(a => a.accountNumber === accNum || a.bankName.toLowerCase() === name.toLowerCase());
            if (!acc) {
              acc = { id: 'acc_' + Date.now() + Math.random().toString(36).substr(2, 4), bankName: name, accountNumber: accNum || 'ACC' + Math.floor(Math.random()*1000) };
              state.registeredAccounts.push(acc);
            }
            d.banks.push({ id: 'bnk_' + Date.now() + Math.random().toString(36).substr(2, 4), date, accountId: acc.id, bankName: acc.bankName, accountNumber: acc.accountNumber, balance: amount });
          } else {
            if (!d.wants) d.wants = [];
            d.wants.push({ id: 'want_' + Date.now() + Math.random().toString(36).substr(2, 4), date, name, amount, comment });
          }
          importedCount++;
        }
      }

      saveToStorage(true);
      renderAll();
      showToast('Imported successfully', 'success');
      if (callback) callback(true);
    } catch (err) {
      console.error('CSV import error:', err);
      showToast('Error parsing CSV', 'error');
      if (callback) callback(false);
    }
  };
  reader.readAsText(file);
}

// ─── Full JSON Backup / Restore ───────────────
function exportJSONBackup() {
  const jsonStr = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kanakku_Book_Full_Backup_${getTodayDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Full JSON Backup exported!', 'success');
}

function importJSONBackup(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (!importedData || typeof importedData !== 'object') {
        showToast('Invalid JSON backup file format.', 'error');
        if (callback) callback(false);
        return;
      }

      if (importedData.data && typeof importedData.data === 'object') {
        // Full state backup
        state = { ...state, ...importedData };
      } else if (importedData.income || importedData.needs || importedData.wants || importedData.savings) {
        // Single month object
        const currentM = state.currentMonth || getCurrentMonthName();
        state.data[currentM] = { ...createDefaultMonthData(), ...importedData };
      } else {
        // Object containing month maps (e.g. { "Aug 2026": { ... } })
        let monthFound = false;
        Object.keys(importedData).forEach(k => {
          if (importedData[k] && typeof importedData[k] === 'object' && (importedData[k].needs || importedData[k].wants || importedData[k].income || importedData[k].savings || importedData[k].banks)) {
            state.data[k] = { ...createDefaultMonthData(), ...importedData[k] };
            monthFound = true;
          }
        });
        if (!monthFound) {
          showToast('No valid financial entries found in JSON file.', 'error');
          if (callback) callback(false);
          return;
        }
      }

      // Sanitize every month to make sure income and all fields exist
      Object.keys(state.data || {}).forEach(m => {
        const monthObj = state.data[m];
        if (!monthObj) return;
        if (!monthObj.income) monthObj.income = { total: 0, entries: [], needsPct: 50, savingsPct: 20, wantsPct: 10 };
        if (!monthObj.income.entries) monthObj.income.entries = [];
        monthObj.income.total = monthObj.income.entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
        if (!monthObj.needs) monthObj.needs = [];
        if (!monthObj.wants) monthObj.wants = [];
        if (!monthObj.savings) monthObj.savings = [];
        if (!monthObj.deposits) monthObj.deposits = [];
        if (!monthObj.banks) monthObj.banks = [];
        if (!monthObj.dailyExpenses) monthObj.dailyExpenses = {};
        if (!monthObj.loansAndCardsData) monthObj.loansAndCardsData = {};
      });

      if (!Array.isArray(state.registeredAccounts)) state.registeredAccounts = [];
      if (!Array.isArray(state.registeredSavingsInstruments)) state.registeredSavingsInstruments = [];

      // If active month has 0 entries, automatically switch currentMonth to the first month with entries
      const monthsWithData = Object.keys(state.data || {}).filter(m => getEntriesCount({ data: { [m]: state.data[m] } }) > 0);
      if (monthsWithData.length > 0 && getEntriesCount({ data: { [state.currentMonth]: state.data[state.currentMonth] } }) === 0) {
        state.currentMonth = monthsWithData[0];
      }

      saveToStorage(true);
      renderAll();
      showToast('Imported successfully', 'success');
      if (callback) callback(true);
    } catch (err) {
      console.error('JSON import error:', err);
      showToast('Error reading JSON backup file.', 'error');
      if (callback) callback(false);
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
  const transferFundsBtn = document.getElementById('transferFundsBtn');
  if (transferFundsBtn) transferFundsBtn.addEventListener('click', transferBankFunds);

  // Savings Forms
  document.getElementById('createSavingsInstrumentBtn').addEventListener('click', createSavingsInstrument);
  document.getElementById('recordSavingsEntryBtn').addEventListener('click', recordSavingsEntry);

  // Loans & Credit Cards Forms & Modals
  const createDebtBtn = document.getElementById('createDebtBtn');
  if (createDebtBtn) createDebtBtn.addEventListener('click', createDebtInstrument);

  const debtRepayModalClose = document.getElementById('debtRepayModalClose');
  if (debtRepayModalClose) debtRepayModalClose.addEventListener('click', () => document.getElementById('debtRepayModal').classList.remove('active'));
  
  const debtRepayModalCancel = document.getElementById('debtRepayModalCancel');
  if (debtRepayModalCancel) debtRepayModalCancel.addEventListener('click', () => document.getElementById('debtRepayModal').classList.remove('active'));

  const debtRepayModalSubmit = document.getElementById('debtRepayModalSubmit');
  if (debtRepayModalSubmit) debtRepayModalSubmit.addEventListener('click', processDebtRepaySubmit);

  const debtTypeInput = document.getElementById('debtTypeInput');
  if (debtTypeInput) {
    debtTypeInput.addEventListener('change', (e) => {
      const isCard = e.target.value === 'credit_card';
      document.getElementById('debtLimitOrPrincipalLabel').textContent = isCard ? 'Total Credit Limit (₹)' : 'Total Principal Amount (₹)';
      document.getElementById('debtEmiGroup').style.display = isCard ? 'none' : 'flex';
    });
  }

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

  // ─── Export As Dropdown Event Handlers ───
  const exportAsBtn = document.getElementById('exportAsBtn');
  const exportDropdownMenu = document.getElementById('exportDropdownMenu');
  if (exportAsBtn && exportDropdownMenu) {
    exportAsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdownMenu.classList.toggle('active');
    });
    document.addEventListener('click', () => {
      exportDropdownMenu.classList.remove('active');
    });
  }

  const exportCsvOption = document.getElementById('exportCsvOption');
  if (exportCsvOption) {
    exportCsvOption.addEventListener('click', () => {
      if (exportDropdownMenu) exportDropdownMenu.classList.remove('active');
      exportCSV();
    });
  }

  const exportJsonOption = document.getElementById('exportJsonOption');
  if (exportJsonOption) {
    exportJsonOption.addEventListener('click', () => {
      if (exportDropdownMenu) exportDropdownMenu.classList.remove('active');
      exportJSONBackup();
    });
  }

  // ─── Universal Import Modal Popup & File Handlers ───
  let pendingImportFile = null;

  function openImportModal() {
    pendingImportFile = null;
    const badge = document.getElementById('selectedFileBadge');
    const content = document.getElementById('dropzoneContent');
    const input = document.getElementById('universalFileInput');
    const btn = document.getElementById('confirmImportBtn');
    const banner = document.getElementById('importModalErrorBanner');
    
    if (badge) badge.style.display = 'none';
    if (content) content.style.display = 'block';
    if (input) input.value = '';
    if (btn) btn.disabled = true;
    if (banner) banner.style.display = 'none';

    const modal = document.getElementById('importModal');
    if (modal) modal.classList.add('active');
  }

  function closeImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) modal.classList.remove('active');
    pendingImportFile = null;
  }

  function handleImportFileSelect(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'json') {
      const errBanner = document.getElementById('importModalErrorBanner');
      if (errBanner) {
        errBanner.style.display = 'flex';
        errBanner.innerHTML = '<span>⚠️ Invalid file format. Please select a .csv or .json file.</span>';
      }
      return;
    }

    pendingImportFile = file;
    const banner = document.getElementById('importModalErrorBanner');
    const content = document.getElementById('dropzoneContent');
    const badge = document.getElementById('selectedFileBadge');
    const icon = document.getElementById('selectedFileIcon');
    const nameEl = document.getElementById('selectedFileName');
    const sizeEl = document.getElementById('selectedFileSize');
    const btn = document.getElementById('confirmImportBtn');

    if (banner) banner.style.display = 'none';
    if (content) content.style.display = 'none';
    if (badge) badge.style.display = 'flex';
    if (icon) icon.textContent = ext === 'json' ? '💾' : '📄';
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    if (btn) btn.disabled = false;
  }

  const openImportModalBtn = document.getElementById('openImportModalBtn');
  if (openImportModalBtn) openImportModalBtn.addEventListener('click', openImportModal);

  const importModalClose = document.getElementById('importModalClose');
  if (importModalClose) importModalClose.addEventListener('click', closeImportModal);

  const importModalCancel = document.getElementById('importModalCancel');
  if (importModalCancel) importModalCancel.addEventListener('click', closeImportModal);

  const importDropzone = document.getElementById('importDropzone');
  const universalFileInput = document.getElementById('universalFileInput');

  if (importDropzone && universalFileInput) {
    importDropzone.addEventListener('click', (e) => {
      if (e.target.closest('#removeSelectedFileBtn')) return;
      universalFileInput.click();
    });

    universalFileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handleImportFileSelect(e.target.files[0]);
    });

    importDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      importDropzone.classList.add('dragover');
    });

    importDropzone.addEventListener('dragleave', () => {
      importDropzone.classList.remove('dragover');
    });

    importDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      importDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleImportFileSelect(e.dataTransfer.files[0]);
      }
    });
  }

  const removeSelectedFileBtn = document.getElementById('removeSelectedFileBtn');
  if (removeSelectedFileBtn) {
    removeSelectedFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingImportFile = null;
      document.getElementById('selectedFileBadge').style.display = 'none';
      document.getElementById('dropzoneContent').style.display = 'block';
      document.getElementById('universalFileInput').value = '';
      document.getElementById('confirmImportBtn').disabled = true;
    });
  }

  const confirmImportBtn = document.getElementById('confirmImportBtn');
  if (confirmImportBtn) {
    confirmImportBtn.addEventListener('click', () => {
      if (!pendingImportFile) return;
      const ext = pendingImportFile.name.split('.').pop().toLowerCase();
      if (ext === 'csv') {
        importCSV(pendingImportFile, (success) => {
          if (success) closeImportModal();
        });
      } else if (ext === 'json') {
        importJSONBackup(pendingImportFile, (success) => {
          if (success) closeImportModal();
        });
      }
    });
  }

  document.getElementById('hamburgerBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);

  // AI Assistant Event Bindings
  const aiFabBtn = document.getElementById('aiFabBtn');
  if (aiFabBtn) aiFabBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleAIDrawer(); });

  const aiMinimizeDrawerBtn = document.getElementById('aiMinimizeDrawerBtn');
  if (aiMinimizeDrawerBtn) aiMinimizeDrawerBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleAIDrawer(false); });

  const aiOpenSettingsBtn = document.getElementById('aiOpenSettingsBtn');
  if (aiOpenSettingsBtn) aiOpenSettingsBtn.addEventListener('click', (e) => { e.stopPropagation(); openAISettingsModal(); });

  const openAIGuideBtn = document.getElementById('openAIGuideBtn');
  if (openAIGuideBtn) openAIGuideBtn.addEventListener('click', (e) => { e.stopPropagation(); openAIGuideModal(); });

  const aiGuideModalClose = document.getElementById('aiGuideModalClose');
  if (aiGuideModalClose) aiGuideModalClose.addEventListener('click', (e) => { e.stopPropagation(); closeAIGuideModal(); });

  const aiGuideModalOk = document.getElementById('aiGuideModalOk');
  if (aiGuideModalOk) aiGuideModalOk.addEventListener('click', (e) => { e.stopPropagation(); closeAIGuideModal(); });

  const aiSettingsModalClose = document.getElementById('aiSettingsModalClose');
  if (aiSettingsModalClose) aiSettingsModalClose.addEventListener('click', (e) => { e.stopPropagation(); closeAISettingsModal(); });

  const aiSettingsModalCancel = document.getElementById('aiSettingsModalCancel');
  if (aiSettingsModalCancel) aiSettingsModalCancel.addEventListener('click', (e) => { e.stopPropagation(); closeAISettingsModal(); });

  const aiSettingsModalSave = document.getElementById('aiSettingsModalSave');
  if (aiSettingsModalSave) aiSettingsModalSave.addEventListener('click', (e) => { e.stopPropagation(); handleSaveAISettings(); });

  const aiTestConnectionBtn = document.getElementById('aiTestConnectionBtn');
  if (aiTestConnectionBtn) aiTestConnectionBtn.addEventListener('click', (e) => { e.stopPropagation(); testAIConnection(); });

  const aiProviderSelect = document.getElementById('aiProviderSelect');
  if (aiProviderSelect) aiProviderSelect.addEventListener('change', (e) => toggleAIProviderFields(e.target.value));

  const aiChatForm = document.getElementById('aiChatForm');
  if (aiChatForm) aiChatForm.addEventListener('submit', (e) => { e.preventDefault(); handleAIChatSubmit(); });

  const aiClearChatBtn = document.getElementById('aiClearChatBtn');
  if (aiClearChatBtn) {
    aiClearChatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      aiChatHistory = [];
      const msgContainer = document.getElementById('aiChatMessages');
      if (msgContainer) {
        msgContainer.innerHTML = `
          <div class="ai-msg assistant">
            <div class="ai-msg-bubble">
              👋 Chat cleared! How can I assist you with your budget today?
            </div>
          </div>
        `;
      }
      showToast('Chat history cleared', 'info');
    });
  }

  const openStmtBtn = document.getElementById('openStatementUploadBtn');
  if (openStmtBtn) {
    openStmtBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openStatementUploadModal();
    });
  }

  const stmtDropzone = document.getElementById('statementDropzone');
  const stmtFileInput = document.getElementById('statementFileInput');
  if (stmtDropzone && stmtFileInput) {
    stmtDropzone.addEventListener('click', (e) => {
      if (e.target.closest('#removeStmtFileBtn')) return;
      stmtFileInput.click();
    });

    stmtFileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handleStatementFileSelect(e.target.files[0]);
    });

    stmtDropzone.addEventListener('dragover', (e) => { e.preventDefault(); stmtDropzone.classList.add('dragover'); });
    stmtDropzone.addEventListener('dragleave', () => stmtDropzone.classList.remove('dragover'));
    stmtDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      stmtDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleStatementFileSelect(e.dataTransfer.files[0]);
    });
  }

  const removeStmtFileBtn = document.getElementById('removeStmtFileBtn');
  if (removeStmtFileBtn) {
    removeStmtFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingStatementFile = null;
      document.getElementById('stmtSelectedFileBadge').style.display = 'none';
      document.getElementById('stmtDropzoneContent').style.display = 'block';
      document.getElementById('statementFileInput').value = '';
      document.getElementById('confirmStmtExtractBtn').disabled = true;
    });
  }

  const confirmStmtExtractBtn = document.getElementById('confirmStmtExtractBtn');
  if (confirmStmtExtractBtn) confirmStmtExtractBtn.addEventListener('click', extractStatementTransactions);

  const statementUploadClose = document.getElementById('statementUploadClose');
  if (statementUploadClose) statementUploadClose.addEventListener('click', closeStatementUploadModal);
  const statementUploadCancel = document.getElementById('statementUploadCancel');
  if (statementUploadCancel) statementUploadCancel.addEventListener('click', closeStatementUploadModal);

  // Wizard Listeners
  const statementWizardClose = document.getElementById('statementWizardClose');
  if (statementWizardClose) statementWizardClose.addEventListener('click', closeWizardModal);
  const wizardCancelBtn = document.getElementById('wizardCancelBtn');
  if (wizardCancelBtn) wizardCancelBtn.addEventListener('click', closeWizardModal);
  const wizardPrevBtn = document.getElementById('wizardPrevBtn');
  if (wizardPrevBtn) wizardPrevBtn.addEventListener('click', () => navigateWizardStep(-1));
  const wizardNextBtn = document.getElementById('wizardNextBtn');
  if (wizardNextBtn) wizardNextBtn.addEventListener('click', () => navigateWizardStep(1));
  const wizardSubmitBtn = document.getElementById('wizardSubmitBtn');
  if (wizardSubmitBtn) wizardSubmitBtn.addEventListener('click', submitWizardImport);
  const wizardSmartCategorizeBtn = document.getElementById('wizardSmartCategorizeBtn');
  if (wizardSmartCategorizeBtn) wizardSmartCategorizeBtn.addEventListener('click', wizardSmartCategorize);

  ['bucketNeeds', 'bucketWants', 'bucketIncome'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        el.classList.add('dragover');
      });
      el.addEventListener('dragenter', (e) => {
        e.preventDefault();
        el.classList.add('dragover');
      });
      el.addEventListener('dragleave', () => el.classList.remove('dragover'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('dragover');
        const transId = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
        const cat = el.getAttribute('data-category');
        if (transId && cat) assignTransCategory(transId, cat);
      });
    }
  });

  const quickChipsContainer = document.getElementById('aiQuickChips');
  if (quickChipsContainer) {
    quickChipsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.ai-chip');
      if (!chip || chip.id === 'openStatementUploadBtn') return;
      e.stopPropagation();
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        document.getElementById('aiChatInput').value = prompt;
        handleAIChatSubmit();
      }
    });
  }

  updateAIDrawerStatusBadge();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeAddMonthModal();
      closeDayModal();
      closeCustomTypeModal();
      closeUserSwitchModal();
      closeAISettingsModal();
      closeImportModal();
      closeStatementUploadModal();
      closeWizardModal();
      toggleAIDrawer(false);
    }
  });
}

function getAISettings() {
  const defaults = {
    provider: 'local',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    model: 'llama3.2',
    systemPrompt: 'You are an expert personal financial advisor for கணக்கு Book.'
  };
  try {
    const saved = localStorage.getItem('kanakku_ai_settings');
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  } catch (e) {
    return defaults;
  }
}

function handleSaveAISettings() {
  const settings = {
    provider: document.getElementById('aiProviderSelect').value,
    baseUrl: document.getElementById('aiBaseUrlInput').value.trim() || 'http://localhost:11434/v1',
    apiKey: document.getElementById('aiApiKeyInput').value.trim(),
    model: document.getElementById('aiModelInput').value.trim() || 'llama3.2',
    systemPrompt: document.getElementById('aiSystemPromptInput').value.trim()
  };
  saveAISettings(settings);
  closeAISettingsModal();
  showToast('AI Settings saved', 'success');
}

function saveAISettings(settings) {
  localStorage.setItem('kanakku_ai_settings', JSON.stringify(settings));
  updateAIDrawerStatusBadge();
}

function updateAIDrawerStatusBadge() {
  const s = getAISettings();
  const badge = document.getElementById('aiDrawerStatusBadge');
  if (badge) {
    const provName = s.provider === 'local' ? 'Local LLM' : s.provider.toUpperCase();
    badge.textContent = `🟢 ${provName} (${s.model || 'default'})`;
  }
}

function toggleAIDrawer(forceState = null) {
  const overlay = document.getElementById('aiModalOverlay');
  if (!overlay) return;
  if (typeof forceState === 'boolean') {
    if (forceState) overlay.classList.add('active');
    else overlay.classList.remove('active');
  } else {
    overlay.classList.toggle('active');
  }
}

function openAISettingsModal() {
  const s = getAISettings();
  document.getElementById('aiProviderSelect').value = s.provider;
  document.getElementById('aiBaseUrlInput').value = s.baseUrl || 'http://localhost:11434/v1';
  document.getElementById('aiApiKeyInput').value = s.apiKey || '';
  document.getElementById('aiModelInput').value = s.model || 'llama3.2';
  document.getElementById('aiSystemPromptInput').value = s.systemPrompt || '';
  
  toggleAIProviderFields(s.provider);
  const banner = document.getElementById('aiTestResultBanner');
  if (banner) banner.style.display = 'none';
  document.getElementById('aiSettingsModal').classList.add('active');
}

function closeAISettingsModal() {
  document.getElementById('aiSettingsModal').classList.remove('active');
}

function openAIGuideModal() {
  const modal = document.getElementById('aiGuideModal');
  if (modal) modal.classList.add('active');
}

function closeAIGuideModal() {
  const modal = document.getElementById('aiGuideModal');
  if (modal) modal.classList.remove('active');
}

function toggleAIProviderFields(provider) {
  const keyGrp = document.getElementById('aiApiKeyGroup');
  const urlGrp = document.getElementById('aiBaseUrlGroup');
  if (provider === 'local') {
    keyGrp.style.display = 'none';
    urlGrp.style.display = 'flex';
  } else {
    keyGrp.style.display = 'flex';
    urlGrp.style.display = provider === 'openai' ? 'flex' : 'none';
  }
}

function buildAIFinancialContext() {
  const d = getFilteredData();
  const v = getComputedValues();
  const activeMonth = state.currentMonth;

  const recentWants = (d.wants || []).slice(-5).map(w => `- [Wants] ${w.name}: ₹${w.amount} (${w.paymentSource || 'cash'})`).join('\n');
  const recentNeeds = (d.needs || []).slice(-5).map(n => `- [Needs] ${n.name}: ₹${n.amount} (${n.paymentSource || 'cash'})`).join('\n');

  return `
You are an AI Personal Financial Advisor for கணக்கு Book.
[FINANCIAL SNAPSHOT FOR ${activeMonth}]
- Total Net Income: ₹ ${v.income.toFixed(2)}
- Needs Spent: ₹ ${v.needsTotal.toFixed(2)} | Target Budget: ₹ ${v.needsBudget.toFixed(2)} | Leftover Balance: ₹ ${v.needsBalance.toFixed(2)}
- Wants Spent: ₹ ${v.wantsTotal.toFixed(2)} | Target Budget: ₹ ${v.wantsBudget.toFixed(2)} | Leftover Balance: ₹ ${v.wantsBalance.toFixed(2)}
- Savings Spent: ₹ ${v.savingsTotal.toFixed(2)} | Target Budget: ₹ ${v.savingsBudget.toFixed(2)} | Leftover Balance: ₹ ${v.savingsBalance.toFixed(2)}
- Net Remaining Income: ₹ ${v.netRemainingIncome.toFixed(2)}
- Total Bank Balances: ₹ ${v.banksTotal.toFixed(2)}

Recent Wants Expenses:
${recentWants || 'None logged yet'}

Recent Needs Expenses:
${recentNeeds || 'None logged yet'}

[INSTRUCTIONS]
If the user explicitly asks to add, create, or delete an expense item, reply with a valid JSON block inside triple backticks (\`\`\`json ... \`\`\`):
For ADDING an expense:
\`\`\`json
{
  "action": "ADD_EXPENSE",
  "category": "wants" | "needs",
  "name": "Expense Name",
  "amount": 900,
  "date": "YYYY-MM-DD",
  "comment": "",
  "paymentSource": "cash"
}
\`\`\`
If item name is missing, ask the user for the expense name instead of JSON.

For DELETING an expense:
\`\`\`json
{
  "action": "DELETE_ITEM",
  "category": "wants" | "needs",
  "searchKeyword": "keyword to match"
}
\`\`\`
Otherwise, reply naturally in clear, concise text.
`;
}

async function testAIConnection() {
  const banner = document.getElementById('aiTestResultBanner');
  banner.style.display = 'flex';
  banner.className = 'auth-error-banner';
  banner.innerHTML = `<span>⏳ Testing connection to provider...</span>`;

  const s = {
    provider: document.getElementById('aiProviderSelect').value,
    baseUrl: document.getElementById('aiBaseUrlInput').value.trim(),
    apiKey: document.getElementById('aiApiKeyInput').value.trim(),
    model: document.getElementById('aiModelInput').value.trim() || 'llama3.2'
  };

  try {
    const startTime = Date.now();
    await callLLMProvider([{ role: 'user', content: 'Ping test. Reply OK.' }], s);
    const latency = Date.now() - startTime;

    banner.className = 'auth-error-banner text-success';
    banner.style.borderColor = 'rgba(74, 222, 128, 0.4)';
    banner.style.background = 'rgba(74, 222, 128, 0.12)';
    banner.innerHTML = `<span>🟢 Connection Successful! Latency: ${latency}ms</span>`;
  } catch (err) {
    banner.className = 'auth-error-banner';
    banner.style.borderColor = 'rgba(240, 112, 112, 0.4)';
    banner.style.background = 'rgba(240, 112, 112, 0.12)';
    banner.innerHTML = `<span>🔴 Connection Failed: ${escapeHtml(err.message || 'Check URL, CORS settings, or API Key.')}</span>`;
  }
}

async function callLLMProvider(messages, settingsOverride = null) {
  const s = settingsOverride || getAISettings();
  const provider = s.provider;
  const baseUrl = s.baseUrl || 'http://localhost:11434/v1';
  const model = s.model || 'llama3.2';

  if (provider === 'local' || provider === 'openai') {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (s.apiKey) headers['Authorization'] = `Bearer ${s.apiKey}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        stream: false
      })
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(`Server returned HTTP ${resp.status}: ${errTxt.slice(0, 150)}`);
    }

    const data = await resp.json();
    return data.choices[0]?.message?.content || 'No response from model.';
  } else if (provider === 'gemini') {
    if (!s.apiKey) throw new Error('API Key is required for Gemini');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${s.apiKey}`;
    
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(`Gemini Error HTTP ${resp.status}: ${errTxt.slice(0, 150)}`);
    }

    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
  } else if (provider === 'claude') {
    if (!s.apiKey) throw new Error('API Key is required for Claude');
    const url = 'https://api.anthropic.com/v1/messages';
    
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const userMsgs = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content
    }));

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': s.apiKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: 1000,
        system: systemMsg,
        messages: userMsgs
      })
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(`Claude Error HTTP ${resp.status}: ${errTxt.slice(0, 150)}`);
    }

    const data = await resp.json();
    return data.content?.[0]?.text || 'No response from Claude.';
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

let aiChatHistory = [];

async function handleAIChatSubmit() {
  const inputEl = document.getElementById('aiChatInput');
  const userText = inputEl.value.trim();
  if (!userText) return;

  inputEl.value = '';
  appendChatMessage('user', userText);

  const msgContainer = document.getElementById('aiChatMessages');
  const loadingId = 'ai_loading_' + Date.now();
  const loadingBubble = document.createElement('div');
  loadingBubble.id = loadingId;
  loadingBubble.className = 'ai-msg assistant';
  loadingBubble.innerHTML = `<div class="ai-msg-bubble"><span>💬 Thinking...</span></div>`;
  msgContainer.appendChild(loadingBubble);
  msgContainer.scrollTop = msgContainer.scrollHeight;

  try {
    const contextPrompt = buildAIFinancialContext();
    const systemMsg = { role: 'system', content: contextPrompt };
    
    aiChatHistory.push({ role: 'user', content: userText });
    if (aiChatHistory.length > 10) aiChatHistory = aiChatHistory.slice(-10);

    const messagesPayload = [systemMsg, ...aiChatHistory];
    const aiResponseText = await callLLMProvider(messagesPayload);

    document.getElementById(loadingId)?.remove();

    aiChatHistory.push({ role: 'assistant', content: aiResponseText });

    const jsonMatch = aiResponseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const actionData = JSON.parse(jsonMatch[1]);
        processAIActionPayload(actionData, aiResponseText);
        return;
      } catch (e) {
        console.warn('JSON action parse failed:', e);
      }
    }

    appendChatMessage('assistant', aiResponseText);
  } catch (err) {
    document.getElementById(loadingId)?.remove();
    appendChatMessage('assistant', `⚠️ **Connection Error**: ${escapeHtml(err.message || 'Failed to reach LLM provider.')}`);
  }
}

function appendChatMessage(role, text) {
  const container = document.getElementById('aiChatMessages');
  const msgEl = document.createElement('div');
  msgEl.className = `ai-msg ${role}`;
  
  const formattedText = escapeHtml(text)
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  msgEl.innerHTML = `<div class="ai-msg-bubble">${formattedText}</div>`;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

function processAIActionPayload(actionData, fullText) {
  const container = document.getElementById('aiChatMessages');
  const d = getCurrentData();

  if (actionData.action === 'ADD_EXPENSE') {
    const cat = actionData.category === 'needs' ? 'needs' : 'wants';
    const name = actionData.name || 'Expense';
    const amount = Number(actionData.amount) || 0;
    const date = actionData.date || getTodayDate();
    const comment = actionData.comment || 'Added via AI Assistant';
    const paymentSource = actionData.paymentSource || 'cash';

    if (isNaN(amount) || amount <= 0) {
      appendChatMessage('assistant', 'Please provide a valid amount for the expense.');
      return;
    }

    d[cat].push({ date, createdAt: new Date().toISOString(), name, comment, amount, paymentSource });
    processPaymentSourceEffect(paymentSource, amount, name, date);

    saveToStorage();
    renderAll();

    const msgEl = document.createElement('div');
    msgEl.className = 'ai-msg assistant';
    msgEl.innerHTML = `
      <div class="ai-msg-bubble">
        ✅ <strong>Expense Added Successfully!</strong><br>
        Added <strong>${escapeHtml(name)}</strong> (₹${fmt(amount)}) to <strong>${cat.toUpperCase()}</strong>.
      </div>
    `;
    container.appendChild(msgEl);
    showToast(`${name} added via AI`, 'success');
  } else if (actionData.action === 'DELETE_ITEM') {
    const cat = actionData.category === 'needs' ? 'needs' : 'wants';
    const keyword = (actionData.searchKeyword || '').toLowerCase();

    const targetIdx = (d[cat] || []).findIndex(i => i.name.toLowerCase().includes(keyword));

    if (targetIdx === -1) {
      appendChatMessage('assistant', `Could not find any item matching "${escapeHtml(actionData.searchKeyword)}" in ${cat.toUpperCase()}.`);
      return;
    }

    const item = d[cat][targetIdx];

    const msgEl = document.createElement('div');
    msgEl.className = 'ai-msg assistant';
    msgEl.innerHTML = `
      <div class="ai-msg-bubble">
        <div class="ai-action-card warning">
          <div class="action-title">⚠️ Confirm Deletion</div>
          <div style="font-size:0.8rem;color:var(--text-2);">
            Are you sure you want to delete <strong>"${escapeHtml(item.name)}"</strong> (₹${fmt(item.amount)}) from ${cat.toUpperCase()}?
          </div>
          <div class="action-btns">
            <button class="btn btn-primary" style="background:var(--red-soft);border-color:rgba(240,112,112,0.3);color:var(--red);padding:4px 10px;font-size:0.75rem;" onclick="confirmAIDelete('${cat}', ${targetIdx}, this)">Confirm Delete</button>
            <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75rem;" onclick="this.closest('.ai-msg').remove()">Cancel</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(msgEl);
  } else {
    appendChatMessage('assistant', fullText);
  }

  container.scrollTop = container.scrollHeight;
}

window.confirmAIDelete = function(cat, idx, btnEl) {
  const d = getCurrentData();
  if (!d[cat] || !d[cat][idx]) return;
  const item = d[cat][idx];

  if (['needs', 'wants', 'savings'].includes(cat) && item.paymentSource) {
    if (item.paymentSource.startsWith('bank_')) {
      const bankId = item.paymentSource.replace('bank_', '');
      processBankAdjustment(bankId, Number(item.amount) || 0, `Refund for AI-deleted ${cat}: ${item.name || 'item'}`, 'refund');
    } else if (item.paymentSource.startsWith('debt_')) {
      const debtId = item.paymentSource.replace('debt_', '');
      if (d.loansAndCardsData && d.loansAndCardsData[debtId]) {
        d.loansAndCardsData[debtId].outstanding = Math.max(0, (Number(d.loansAndCardsData[debtId].outstanding) || 0) - (Number(item.amount) || 0));
      }
    }
  }

  d[cat].splice(idx, 1);
  saveToStorage();
  renderAll();

  const bubble = btnEl.closest('.ai-msg-bubble');
  bubble.innerHTML = `🗑️ Deleted <strong>"${escapeHtml(item.name)}"</strong> from ${cat.toUpperCase()}.`;
  showToast('Item deleted via AI', 'info');
};

// ─── Statement Importer & Categorization Wizard Engine ─────────
let pendingStatementFile = null;
let wizardData = {
  currentStep: 1,
  rawItems: [],
  needs: [],
  wants: [],
  income: []
};

function openStatementUploadModal() {
  pendingStatementFile = null;
  const badge = document.getElementById('stmtSelectedFileBadge');
  const content = document.getElementById('stmtDropzoneContent');
  const input = document.getElementById('statementFileInput');
  const btn = document.getElementById('confirmStmtExtractBtn');
  const loader = document.getElementById('stmtLoadingBanner');
  const errBanner = document.getElementById('stmtErrorBanner');

  if (badge) badge.style.display = 'none';
  if (content) content.style.display = 'block';
  if (input) input.value = '';
  if (btn) btn.disabled = true;
  if (loader) loader.style.display = 'none';
  if (errBanner) errBanner.style.display = 'none';

  const modal = document.getElementById('statementUploadModal');
  if (modal) modal.classList.add('active');
}

function closeStatementUploadModal() {
  const modal = document.getElementById('statementUploadModal');
  if (modal) modal.classList.remove('active');
  pendingStatementFile = null;
}

function handleStatementFileSelect(file) {
  if (!file) return;
  pendingStatementFile = file;
  const content = document.getElementById('stmtDropzoneContent');
  const badge = document.getElementById('stmtSelectedFileBadge');
  const nameEl = document.getElementById('stmtSelectedFileName');
  const sizeEl = document.getElementById('stmtSelectedFileSize');
  const btn = document.getElementById('confirmStmtExtractBtn');

  if (content) content.style.display = 'none';
  if (badge) badge.style.display = 'flex';
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB`;
  if (btn) btn.disabled = false;
}

async function extractStatementTransactions() {
  if (!pendingStatementFile) return;

  const btn = document.getElementById('confirmStmtExtractBtn');
  const loader = document.getElementById('stmtLoadingBanner');
  const errBanner = document.getElementById('stmtErrorBanner');

  if (btn) btn.disabled = true;
  if (loader) loader.style.display = 'flex';
  if (errBanner) errBanner.style.display = 'none';

  try {
    const textContent = await readStatementFileContent(pendingStatementFile);
    
    const prompt = `
You are an expert AI financial statement parser.
Analyze the following bank/credit statement text and extract all transaction records.

Extract the transactions as a JSON array where each object has:
- "date": "YYYY-MM-DD"
- "description": "Clean Transaction / Merchant Name"
- "amount": positive number
- "type": "debit" | "credit"

STRICT REQUIREMENT: Respond ONLY with a valid JSON array enclosed in \`\`\`json ... \`\`\` code block.

Statement Text Snippet:
${textContent.slice(0, 12000)}
`;

    let extracted = [];
    try {
      const responseText = await callLLMProvider([{ role: 'user', content: prompt }]);
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        const rawJson = jsonMatch[1] || jsonMatch[0];
        extracted = JSON.parse(rawJson);
      }
    } catch (e) {
      console.warn('LLM extraction failed, using fallback parser:', e);
    }

    if (!Array.isArray(extracted) || extracted.length === 0) {
      extracted = fallbackParseStatementText(textContent);
    }

    if (!Array.isArray(extracted) || extracted.length === 0) {
      throw new Error('No transactions could be extracted from this file. Please ensure it is a valid bank statement.');
    }

    const formatted = extracted.map((item, idx) => ({
      id: 'st_tr_' + Date.now() + '_' + idx,
      date: item.date || getTodayDate(),
      description: item.description || item.name || 'Statement Item',
      amount: Number(item.amount) || 0,
      type: (item.type || 'debit').toLowerCase(),
      category: 'unassigned',
      comment: ''
    })).filter(item => item.amount > 0);

    closeStatementUploadModal();
    openWizard(formatted);
  } catch (err) {
    if (loader) loader.style.display = 'none';
    if (btn) btn.disabled = false;
    if (errBanner) {
      errBanner.style.display = 'flex';
      errBanner.innerHTML = `<span>⚠️ ${escapeHtml(err.message || 'Error processing statement file.')}</span>`;
    }
  }
}

async function readStatementFileContent(file) {
  const ext = (file.name || '').split('.').pop().toLowerCase();
  
  if (ext === 'pdf') {
    try {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        if (fullText.trim().length > 10) {
          return fullText;
        }
      }
    } catch (err) {
      console.warn('PDF.js text extraction failed:', err);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result || '');
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

function fallbackParseStatementText(text) {
  // Strip raw PDF binary metadata if present
  if (text.includes('%PDF') || text.includes('endobj') || text.includes('ColorSpace')) {
    text = text.replace(/%PDF[\s\S]*?stream/gi, '')
               .replace(/<<[\s\S]*?>>/g, '')
               .replace(/endobj|xref|trailer|startxref|ColorSpace|Subtype|Catalog/gi, '');
  }

  const lines = text.split('\n');
  const items = [];
  const today = getTodayDate();

  lines.forEach((line, idx) => {
    const clean = line.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
    if (!clean || clean.length < 4) return;
    if (/^%PDF|obj$|<<|>>|endobj|ColorSpace|Subtype|Font|Catalog|stream/i.test(clean)) return;

    // Extract Date (DD.MM.YYYY, DD/MM/YYYY, or DD-MM-YYYY)
    const dateMatch = clean.match(/(\d{2})[.\/-](\d{2})[.\/-](\d{4})/);
    let itemDate = today;
    if (dateMatch) {
      const day = dateMatch[1];
      const month = dateMatch[2];
      const year = dateMatch[3];
      itemDate = `${year}-${month}-${day}`;
    }

    const numMatch = clean.match(/(?:₹|\$|INR)?\s*([0-9,]+\.[0-9]{2}|[1-9][0-9,]{2,})/i);
    if (numMatch) {
      const amtStr = numMatch[1].replace(/,/g, '');
      const amt = Number(amtStr);
      if (amt > 0 && amt < 1000000) {
        let desc = clean.replace(numMatch[0], '');
        if (dateMatch) desc = desc.replace(dateMatch[0], '');
        desc = desc.replace(/[0-9\/-]+/g, ' ').replace(/\s+/g, ' ').trim();
        desc = desc.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        if (desc.length > 2 && !/PDF|obj|stream|Catalog|ColorSpace/i.test(desc)) {
          const isCredit = /credit|salary|refund|deposit|cr\b/i.test(clean);
          items.push({
            date: itemDate,
            description: desc,
            amount: amt,
            type: isCredit ? 'credit' : 'debit'
          });
        }
      }
    }
  });

  return items.slice(0, 50);
}

// ─── Wizard Multi-Step Categorization Engine ─────────────
function openWizard(items) {
  // Initially keep all extracted transactions untagged (category = 'unassigned')
  const unassignedItems = items.map(item => ({
    ...item,
    category: 'unassigned'
  }));

  wizardData = {
    currentStep: 1,
    rawItems: unassignedItems,
    needs: [],
    wants: [],
    income: []
  };

  const modal = document.getElementById('statementWizardModal');
  if (modal) modal.classList.add('active');

  setWizardStep(1);
}

function closeWizardModal() {
  const modal = document.getElementById('statementWizardModal');
  if (modal) modal.classList.remove('active');
}

function wizardSmartCategorize() {
  let count = 0;
  wizardData.rawItems.forEach(item => {
    if (item.category !== 'unassigned') return;
    const desc = item.description.toLowerCase();
    let cat = 'wants'; // Default for debit spends

    if (item.type === 'credit' || desc.includes('salary') || desc.includes('interest') || desc.includes('refund') || desc.includes('deposit') || desc.includes('cr')) {
      cat = 'income';
    } else if (desc.includes('rent') || desc.includes('fuel') || desc.includes('grocery') || desc.includes('pharmacy') || desc.includes('milk') || desc.includes('electric') || desc.includes('bill') || desc.includes('recharge') || desc.includes('auto')) {
      cat = 'needs';
    }

    item.category = cat;
    wizardData[cat].push(item);
    count++;
  });

  renderWizardStep1();
  if (count > 0) showToast(`Smart Categorized ${count} transactions!`, 'success');
  else showToast('All transactions are already categorized.', 'info');
}

function setWizardStep(step) {
  wizardData.currentStep = step;

  document.querySelectorAll('.wizard-step-item').forEach(el => {
    const s = Number(el.getAttribute('data-step'));
    el.classList.remove('active', 'completed');
    if (s === step) el.classList.add('active');
    else if (s < step) el.classList.add('completed');
  });

  document.querySelectorAll('.wizard-panel').forEach(panel => panel.classList.remove('active'));
  const targetPanel = document.getElementById(`wizardStep${step}`);
  if (targetPanel) targetPanel.classList.add('active');

  if (step === 1) renderWizardStep1();
  else if (step === 2) renderWizardStep2();
  else if (step === 3) renderWizardStep3();
  else if (step === 4) renderWizardStep4();
  else if (step === 5) renderWizardStep5();

  const prevBtn = document.getElementById('wizardPrevBtn');
  const nextBtn = document.getElementById('wizardNextBtn');
  const submitBtn = document.getElementById('wizardSubmitBtn');

  if (prevBtn) prevBtn.disabled = step === 1;

  if (step < 5) {
    if (nextBtn) {
      nextBtn.style.display = 'inline-flex';
      const labels = { 1: 'Next: Review Needs →', 2: 'Next: Review Wants →', 3: 'Next: Review Income →', 4: 'Next: Final Confirm →' };
      nextBtn.textContent = labels[step] || 'Next →';
    }
    if (submitBtn) submitBtn.style.display = 'none';
  } else {
    if (nextBtn) nextBtn.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'inline-flex';
  }
}

function navigateWizardStep(delta) {
  const newStep = Math.min(5, Math.max(1, wizardData.currentStep + delta));
  setWizardStep(newStep);
}

function renderWizardStep1() {
  const listEl = document.getElementById('extractedTransList');
  const badge = document.getElementById('extractedCountBadge');
  
  const unassignedItems = wizardData.rawItems.filter(i => i.category === 'unassigned');

  if (badge) badge.textContent = `${unassignedItems.length} Left`;

  if (listEl) {
    if (unassignedItems.length === 0) {
      listEl.innerHTML = `
        <div class="empty-unassigned-card">
          🎉 <strong>All transactions categorized!</strong>
          <br>
          <span style="font-size:0.82rem;color:var(--text-3);margin-top:6px;display:inline-block;">
            Click <strong>"Next: Review Needs →"</strong> below to verify & add comments.
          </span>
        </div>
      `;
    } else {
      listEl.innerHTML = unassignedItems.map(item => `
        <div class="trans-card" id="card_${item.id}" draggable="true">
          <div class="trans-card-header">
            <span class="trans-card-desc">${escapeHtml(item.description)}</span>
            <span class="trans-card-amt ${item.type}">₹${fmt(item.amount)}</span>
          </div>
          <div class="trans-card-sub">
            <span>📅 ${item.date}</span>
            <span style="text-transform:uppercase;font-weight:700;color:var(--text-3);">UNASSIGNED</span>
          </div>
          <div class="trans-assign-btns">
            <button type="button" class="btn-assign" onclick="assignTransCategory('${item.id}', 'needs')">📋 Needs</button>
            <button type="button" class="btn-assign" onclick="assignTransCategory('${item.id}', 'wants')">🛍️ Wants</button>
            <button type="button" class="btn-assign" onclick="assignTransCategory('${item.id}', 'income')">💵 Income</button>
          </div>
        </div>
      `).join('');

      // Attach Drag Events to cards
      unassignedItems.forEach(item => {
        const cardEl = document.getElementById(`card_${item.id}`);
        if (cardEl) {
          cardEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.id);
            cardEl.classList.add('dragging');
          });
          cardEl.addEventListener('dragend', () => {
            cardEl.classList.remove('dragging');
          });
        }
      });
    }
  }

  updateBucketCounts();
}

function updateBucketCounts() {
  document.getElementById('bucketNeedsCount').textContent = wizardData.needs.length;
  document.getElementById('bucketWantsCount').textContent = wizardData.wants.length;
  document.getElementById('bucketIncomeCount').textContent = wizardData.income.length;

  ['needs', 'wants', 'income'].forEach(cat => {
    const container = document.getElementById(`bucket${cat.charAt(0).toUpperCase() + cat.slice(1)}Items`);
    if (container) {
      container.innerHTML = wizardData[cat].map(item => `
        <span class="bucket-chip">
          ${escapeHtml(item.description)} (₹${fmt(item.amount)})
          <span class="bucket-chip-remove" onclick="removeTransFromCat('${item.id}', '${cat}')">✕</span>
        </span>
      `).join('');
    }
  });
}

window.assignTransCategory = function(transId, category) {
  const item = wizardData.rawItems.find(i => i.id === transId);
  if (!item) return;

  wizardData.needs = wizardData.needs.filter(i => i.id !== transId);
  wizardData.wants = wizardData.wants.filter(i => i.id !== transId);
  wizardData.income = wizardData.income.filter(i => i.id !== transId);

  item.category = category;
  wizardData[category].push(item);

  renderWizardStep1();
};

window.removeTransFromCat = function(transId, category) {
  wizardData[category] = wizardData[category].filter(i => i.id !== transId);
  const item = wizardData.rawItems.find(i => i.id === transId);
  if (item) item.category = 'unassigned';
  renderWizardStep1();
};

function renderWizardStep2() {
  const tbody = document.getElementById('wizardNeedsTableBody');
  if (!tbody) return;
  if (wizardData.needs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:20px;">No Needs expenses categorized yet.</td></tr>`;
  } else {
    tbody.innerHTML = wizardData.needs.map((item, idx) => `
      <tr>
        <td><input type="date" value="${item.date}" onchange="wizardData.needs[${idx}].date=this.value"></td>
        <td><input type="text" value="${escapeHtml(item.description)}" onchange="wizardData.needs[${idx}].description=this.value"></td>
        <td><input type="number" value="${item.amount}" style="width:90px;" onchange="wizardData.needs[${idx}].amount=Number(this.value)"></td>
        <td><span class="text-muted">cash</span></td>
        <td><input type="text" placeholder="Add comment..." value="${escapeHtml(item.comment || '')}" onchange="wizardData.needs[${idx}].comment=this.value"></td>
        <td><button class="btn-icon delete" onclick="removeWizardItem('needs', ${idx})">🗑️</button></td>
      </tr>
    `).join('');
  }
}

function renderWizardStep3() {
  const tbody = document.getElementById('wizardWantsTableBody');
  if (!tbody) return;
  if (wizardData.wants.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:20px;">No Wants expenses categorized yet.</td></tr>`;
  } else {
    tbody.innerHTML = wizardData.wants.map((item, idx) => `
      <tr>
        <td><input type="date" value="${item.date}" onchange="wizardData.wants[${idx}].date=this.value"></td>
        <td><input type="text" value="${escapeHtml(item.description)}" onchange="wizardData.wants[${idx}].description=this.value"></td>
        <td><input type="number" value="${item.amount}" style="width:90px;" onchange="wizardData.wants[${idx}].amount=Number(this.value)"></td>
        <td><span class="text-muted">cash</span></td>
        <td><input type="text" placeholder="Add comment..." value="${escapeHtml(item.comment || '')}" onchange="wizardData.wants[${idx}].comment=this.value"></td>
        <td><button class="btn-icon delete" onclick="removeWizardItem('wants', ${idx})">🗑️</button></td>
      </tr>
    `).join('');
  }
}

function renderWizardStep4() {
  const tbody = document.getElementById('wizardIncomeTableBody');
  if (!tbody) return;
  if (wizardData.income.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:20px;">No Income entries categorized yet.</td></tr>`;
  } else {
    tbody.innerHTML = wizardData.income.map((item, idx) => `
      <tr>
        <td><input type="date" value="${item.date}" onchange="wizardData.income[${idx}].date=this.value"></td>
        <td><input type="text" value="${escapeHtml(item.description)}" onchange="wizardData.income[${idx}].description=this.value"></td>
        <td><input type="number" value="${item.amount}" style="width:90px;" onchange="wizardData.income[${idx}].amount=Number(this.value)"></td>
        <td><input type="text" placeholder="Add comment..." value="${escapeHtml(item.comment || '')}" onchange="wizardData.income[${idx}].comment=this.value"></td>
        <td><button class="btn-icon delete" onclick="removeWizardItem('income', ${idx})">🗑️</button></td>
      </tr>
    `).join('');
  }
}

function renderWizardStep5() {
  const monthEl = document.getElementById('wizardTargetMonth');
  if (monthEl) monthEl.textContent = state.currentMonth || getCurrentMonthName();

  const needsTot = wizardData.needs.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const wantsTot = wizardData.wants.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const incTot = wizardData.income.reduce((sum, i) => sum + Number(i.amount || 0), 0);

  document.getElementById('summaryNeedsVal').textContent = fmt(needsTot);
  document.getElementById('summaryNeedsCount').textContent = `${wizardData.needs.length} entries`;

  document.getElementById('summaryWantsVal').textContent = fmt(wantsTot);
  document.getElementById('summaryWantsCount').textContent = `${wizardData.wants.length} entries`;

  document.getElementById('summaryIncomeVal').textContent = fmt(incTot);
  document.getElementById('summaryIncomeCount').textContent = `${wizardData.income.length} entries`;
}

window.removeWizardItem = function(cat, idx) {
  if (wizardData[cat]) wizardData[cat].splice(idx, 1);
  if (wizardData.currentStep === 2) renderWizardStep2();
  else if (wizardData.currentStep === 3) renderWizardStep3();
  else if (wizardData.currentStep === 4) renderWizardStep4();
};

function submitWizardImport() {
  const d = getCurrentData();

  if (!d.needs) d.needs = [];
  if (!d.wants) d.wants = [];
  if (!d.income) d.income = { total: 0, entries: [], needsPct: 50, savingsPct: 20, wantsPct: 10 };
  if (!d.income.entries) d.income.entries = [];

  // Add-on / append Statement Wizard entries to existing data
  wizardData.needs.forEach(item => {
    d.needs.push({
      id: 'need_' + Date.now() + Math.random().toString(36).substr(2, 4),
      date: item.date || getTodayDate(),
      name: item.description || 'Needs Item',
      amount: Number(item.amount) || 0,
      comment: item.comment || 'Imported via Statement Wizard',
      paymentSource: 'cash'
    });
  });

  wizardData.wants.forEach(item => {
    d.wants.push({
      id: 'want_' + Date.now() + Math.random().toString(36).substr(2, 4),
      date: item.date || getTodayDate(),
      name: item.description || 'Wants Item',
      amount: Number(item.amount) || 0,
      comment: item.comment || 'Imported via Statement Wizard',
      paymentSource: 'cash'
    });
  });

  wizardData.income.forEach(item => {
    d.income.entries.push({
      id: 'inc_' + Date.now() + Math.random().toString(36).substr(2, 4),
      date: item.date || getTodayDate(),
      source: item.description || 'Income Entry',
      amount: Number(item.amount) || 0,
      comment: item.comment || 'Imported via Statement Wizard'
    });
  });

  if (d.income && Array.isArray(d.income.entries)) {
    d.income.total = d.income.entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }

  saveToStorage(true);
  renderAll();
  closeWizardModal();
  showToast('Statement entries added to active month!', 'success');
}

document.addEventListener('DOMContentLoaded', init);

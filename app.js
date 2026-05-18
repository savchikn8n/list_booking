const TABLES = [
  { label: 'Бар', ps5: false },
  { label: '1 PS5', ps5: true },
  { label: '2', ps5: false },
  { label: '3', ps5: false },
  { label: '4', ps5: false },
  { label: '5', ps5: false },
  { label: '6', ps5: false },
  { label: '7', ps5: false },
  { label: '8', ps5: false },
  { label: '9', ps5: false },
  { label: '10', ps5: false },
  { label: '11 PS5', ps5: true },
  { label: '12 PS5', ps5: true },
  { label: '13', ps5: false },
  { label: '14', ps5: false },
  { label: '15', ps5: false }
];
const TABLE_DISPLAY_ORDER = TABLES.map((_, index) => index).slice(1).concat(0);

const THEMES = {
  yellow: { accent: '#f8c9a1', accentDeep: '#f2b27f' },
  blue: { accent: '#b8d7f4', accentDeep: '#8fbce8' },
  purple: { accent: '#d9c2ef', accentDeep: '#bc9bdd' },
  green: { accent: '#cce8bf', accentDeep: '#a6d48f' }
};

const START_MINUTES = 12 * 60;
const REGULAR_END_MINUTES = 25 * 60;
const WEEKEND_END_MINUTES = 26 * 60;
const STEP_MINUTES = 30;
const DEFAULT_DURATION_SLOTS = 4;
const MIN_DURATION_SLOTS = 1;
const MOBILE_BOARD_BREAKPOINT = 767;
const MOBILE_TIME_COLUMN_WIDTH = 64;
const MOBILE_TABLE_COLUMN_WIDTH = 92;
const MOBILE_HEADER_ROW_HEIGHT = 44;
const MOBILE_SLOT_ROW_HEIGHT = 42;
const KALININGRAD_TIMEZONE = 'Europe/Kaliningrad';

const board = document.getElementById('booking-board');
const bookingsView = document.getElementById('bookings-view');
const waitlistView = document.getElementById('waitlist-view');
const debugView = document.getElementById('debug-view');
const viewMenu = document.getElementById('view-menu');
const bookingsViewBtn = document.getElementById('bookings-view-btn');
const waitlistViewBtn = document.getElementById('waitlist-view-btn');
const debugViewBtn = document.getElementById('debug-view-btn');
const pageTitleLabel = document.getElementById('page-title-label');
const nowIndicator = document.getElementById('now-indicator');
const nowLine = document.getElementById('now-line');
const nowBeacon = document.getElementById('now-beacon');
const modal = document.getElementById('booking-modal');
const form = document.getElementById('booking-form');
const modalTitle = document.getElementById('modal-title');
const selectedSlotText = document.getElementById('selected-slot');
const syncStatus = document.getElementById('sync-status');
const syncBanner = document.getElementById('sync-banner');

const cancelBtn = document.getElementById('cancel-btn');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const transferBtn = document.getElementById('transfer-btn');
const transferBox = document.getElementById('transfer-box');
const transferConfirmBtn = document.getElementById('transfer-confirm');
const transferTableSelect = document.getElementById('transfer-table');
const arrivalBox = document.getElementById('arrival-box');
const arrivalToggleBtn = document.getElementById('arrival-toggle-btn');
const extendModeBtn = document.getElementById('extend-mode-btn');

const bookingDateInput = document.getElementById('booking-date');
const startTimeSelect = document.getElementById('start-time');

const guestNameInput = document.getElementById('guest-name');
const guestPhoneInput = document.getElementById('guest-phone');
const guestCommentInput = document.getElementById('guest-comment');

const guestsMinusBtn = document.getElementById('guests-minus');
const guestsPlusBtn = document.getElementById('guests-plus');
const guestsCountOutput = document.getElementById('guests-count');

const durationMinusBtn = document.getElementById('duration-minus');
const durationPlusBtn = document.getElementById('duration-plus');
const durationCountOutput = document.getElementById('duration-count');

const waitlistForm = document.getElementById('waitlist-form');
const waitlistNameInput = document.getElementById('waitlist-name');
const waitlistPhoneInput = document.getElementById('waitlist-phone');
const waitlistCommentInput = document.getElementById('waitlist-comment');
const waitlistItems = document.getElementById('waitlist-items');
const debugLocalQueue = document.getElementById('debug-local-queue');
const debugDeletedBookings = document.getElementById('debug-deleted-bookings');
const debugEvents = document.getElementById('debug-events');
const debugSyncRetryBtn = document.getElementById('debug-sync-retry');

const paletteButtons = Array.from(document.querySelectorAll('.palette-btn'));

const bookingsByDate = new Map();
const SUPABASE_SETTINGS = window.BOOKING_SUPABASE_CONFIG || {};
const BOOKINGS_TABLE = SUPABASE_SETTINGS.bookingsTable || 'booking_sheet_bookings';
const WAITLIST_TABLE = SUPABASE_SETTINGS.waitlistTable || 'booking_sheet_waitlist';
const META_TABLE = SUPABASE_SETTINGS.metaTable || 'booking_sheet_meta';
const EVENTS_TABLE = 'booking_sheet_events';
const DEVICE_STATE_TABLE = 'booking_sheet_device_state';
const SNAPSHOT_STORAGE_PREFIX = 'booking_snapshot:';
const OPS_QUEUE_STORAGE_KEY = 'booking_ops_queue';
const SYNC_META_STORAGE_KEY = 'booking_sync_meta';
const DEVICE_ID_STORAGE_KEY = 'booking_device_id';
const DEVICE_ROLE_STORAGE_KEY = 'booking_device_role';
const DEVICE_SEQUENCE_STORAGE_KEY = 'booking_device_sequence';
const bookingDatabase = createBookingDatabaseClient();
const bookingCardLayoutApi = window.bookingCardLayout || {};
const bookingSyncStateApi = window.bookingSyncState || {};
const bookingSyncIndicatorApi = window.bookingSyncIndicator || {};
const bookingExtensionApi = window.bookingExtension || {};
const bookingVisualStateApi = window.bookingVisualState || {};
const bookingLocalStorageApi = window.bookingLocalStorage || {};
const bookingLocalStore =
  typeof bookingLocalStorageApi.createDefaultBookingLocalStorage === 'function'
    ? bookingLocalStorageApi.createDefaultBookingLocalStorage(window)
    : null;
const BOOKING_SYNC_RETRY_INTERVAL_MS = 5000;
const BOOKING_RESTORE_THROTTLE_MS = 1500;
const BOOKING_DEVICE_HEARTBEAT_INTERVAL_MS = 30000;
const BOOKING_RPC_TIMEOUT_MS = 15000;
const BOOKING_APP_VERSION = '2026-05-18-sync-hardening';
const IS_DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === '1';
const INITIAL_VIEW =
  IS_DEBUG_MODE && new URLSearchParams(window.location.search).get('view') === 'debug'
    ? 'debug'
    : 'bookings';

let selectedDate = getLocalISODate();
let scheduleEndMinutes = getScheduleEndMinutes(selectedDate);
let timeSlots = buildTimeSlots(scheduleEndMinutes);
let currentTheme = 'yellow';
let currentView = INITIAL_VIEW;

let modalMode = 'create';
let editingBookingId = null;
let activeSlot = null;
let guestCount = 1;
let durationSlots = DEFAULT_DURATION_SLOTS;
let transferModeActive = false;
let draggedBookingId = null;
let suppressNextCellClick = false;
let bookingsChannel = null;
let lastRealtimeEventAt = null;
let isFlushingBookingOpsQueue = false;
let isExtendMode = false;
let selectedExtendBookingId = null;
let lastLifecycleRestoreAt = 0;
let hasRealtimeConnectionError = false;
let debugDeletedBookingsCache = [];
let debugEventsCache = [];

const waitlistByDate = new Map();

function getDisplayTableIndices() {
  return TABLE_DISPLAY_ORDER;
}

function getTableLabel(tableIndex) {
  return TABLES[tableIndex] ? TABLES[tableIndex].label : '';
}

function createBookingDatabaseClient() {
  const url = SUPABASE_SETTINGS.url?.trim() || '';
  const anonKey = SUPABASE_SETTINGS.anonKey?.trim() || '';
  const hasConfig =
    url.startsWith('https://') &&
    anonKey.length > 20 &&
    !url.includes('YOUR_PROJECT_ID') &&
    !anonKey.includes('YOUR_SUPABASE_ANON_KEY');

  if (!hasConfig || typeof window.supabase?.createClient !== 'function') {
    return null;
  }

  return window.supabase.createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function setSyncStatus(text, state) {
  const lastEventLabel = lastRealtimeEventAt
    ? ` | event ${lastRealtimeEventAt.toLocaleTimeString('ru-RU', { hour12: false })}`
    : '';
  const statusText = `${text}${lastEventLabel}`;

  syncStatus.title = statusText;
  syncStatus.setAttribute('aria-label', statusText);
  syncStatus.classList.remove('is-waiting', 'is-live', 'is-error');
  syncStatus.classList.add(`is-${state}`);
}

function getIndicatorState({ hasConnectionError, hasQueueIssues, isBusy }) {
  if (typeof bookingSyncIndicatorApi.getIndicatorState === 'function') {
    return bookingSyncIndicatorApi.getIndicatorState({
      hasConnectionError,
      hasQueueIssues,
      isBusy
    });
  }

  if (hasConnectionError) return 'error';
  if (hasQueueIssues || isBusy) return 'waiting';
  return 'live';
}

function updateSyncIndicator(text, options = {}) {
  const queue = getOpsQueue();
  const state = getIndicatorState({
    hasConnectionError: Boolean(options.hasConnectionError ?? hasRealtimeConnectionError),
    hasQueueIssues: queue.some((entry) => entry.status === 'failed'),
    isBusy: Boolean(options.isBusy)
  });
  setSyncStatus(text, state);
}

function getLocalISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateObjectFromISO(dateISO) {
  const [year, month, day] = dateISO.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getScheduleEndMinutes(dateISO) {
  const dayOfWeek = getDateObjectFromISO(dateISO).getDay();
  return dayOfWeek === 5 || dayOfWeek === 6 ? WEEKEND_END_MINUTES : REGULAR_END_MINUTES;
}

function buildTimeSlots(endMinutesLimit) {
  const slots = [];
  for (let minutes = START_MINUTES; minutes <= endMinutesLimit; minutes += STEP_MINUTES) {
    slots.push(minutes);
  }
  return slots;
}

function syncScheduleForSelectedDate() {
  scheduleEndMinutes = getScheduleEndMinutes(selectedDate);
  timeSlots = buildTimeSlots(scheduleEndMinutes);
}

function getKaliningradMinutesNow() {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: KALININGRAD_TIMEZONE
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function getKaliningradTimeLabel() {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: KALININGRAD_TIMEZONE
  }).format(new Date());
}

function getKaliningradBusinessTimelinePosition() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: KALININGRAD_TIMEZONE
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  const todayISO = `${year}-${month}-${day}`;
  const nowMinutes = hour * 60 + minute;

  if (selectedDate === todayISO) {
    return nowMinutes;
  }

  const tomorrowDate = getDateObjectFromISO(selectedDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  if (
    getLocalISODate(tomorrowDate) === todayISO &&
    nowMinutes < scheduleEndMinutes - 24 * 60
  ) {
    return nowMinutes + 24 * 60;
  }

  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function minutesToLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h)}:${String(m).padStart(2, '0')}`;
}

function formatDurationFromSlots(slots) {
  const totalMinutes = slots * STEP_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}ч` : `${hours}ч ${minutes}м`;
}

function getStartTimeIndex() {
  return Number(startTimeSelect.value);
}

function getMaxSlotsFromStart(startTimeIndex) {
  const startMinutes = timeSlots[startTimeIndex];
  if (Number.isNaN(startMinutes)) return 0;
  return Math.floor((scheduleEndMinutes - startMinutes) / STEP_MINUTES);
}

function getMinDurationSlots(startTimeIndex = getStartTimeIndex()) {
  if (transferModeActive) return 1;

  const maxSlots = getMaxSlotsFromStart(startTimeIndex);
  if (maxSlots < 1) return 0;

  return Math.min(MIN_DURATION_SLOTS, maxSlots);
}

function getDefaultDurationSlots(startTimeIndex = getStartTimeIndex()) {
  const maxSlots = getMaxSlotsFromStart(startTimeIndex);
  if (maxSlots < 1) return 0;

  return Math.min(DEFAULT_DURATION_SLOTS, maxSlots);
}

function setCounter(output, value) {
  output.textContent = value;
}

function readJsonStorage(key, fallbackValue) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch (error) {
    console.error('Storage read error:', key, error);
    return fallbackValue;
  }
}

function writeJsonStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Storage write error:', key, error);
    return false;
  }
}

function getDeviceId() {
  const storedDeviceId = readJsonStorage(DEVICE_ID_STORAGE_KEY, '');
  if (storedDeviceId) return storedDeviceId;

  const nextDeviceId = crypto.randomUUID();
  writeJsonStorage(DEVICE_ID_STORAGE_KEY, nextDeviceId);
  return nextDeviceId;
}

function getDeviceRole() {
  const searchParams = new URLSearchParams(window.location.search);
  const roleFromUrl = searchParams.get('deviceRole');
  if (roleFromUrl) {
    writeJsonStorage(DEVICE_ROLE_STORAGE_KEY, roleFromUrl);
    return roleFromUrl;
  }

  return readJsonStorage(DEVICE_ROLE_STORAGE_KEY, 'primary_tablet');
}

function getNextClientSequence() {
  const currentSequence = Number(readJsonStorage(DEVICE_SEQUENCE_STORAGE_KEY, 0)) || 0;
  const nextSequence = currentSequence + 1;
  writeJsonStorage(DEVICE_SEQUENCE_STORAGE_KEY, nextSequence);
  return nextSequence;
}

function getSnapshotStorageKey(date) {
  return `${SNAPSHOT_STORAGE_PREFIX}${date}`;
}

async function initializeBookingLocalStore() {
  if (bookingLocalStore && typeof bookingLocalStore.init === 'function') {
    await bookingLocalStore.init();
  }
}

function flushBookingLocalStore() {
  if (bookingLocalStore && typeof bookingLocalStore.flush === 'function') {
    void bookingLocalStore.flush();
  }
}

function getBookingsForSelectedDate() {
  if (!bookingsByDate.has(selectedDate)) {
    bookingsByDate.set(selectedDate, new Map());
  }
  return bookingsByDate.get(selectedDate);
}

function getBookingsForDate(bookingDate) {
  if (!bookingsByDate.has(bookingDate)) {
    bookingsByDate.set(bookingDate, new Map());
  }
  return bookingsByDate.get(bookingDate);
}

function cacheBooking(booking) {
  getBookingsForDate(booking.date).set(booking.id, booking);
}

function removeBookingFromCache(bookingId, bookingDate = null) {
  if (bookingDate && bookingsByDate.has(bookingDate)) {
    bookingsByDate.get(bookingDate).delete(bookingId);
    return;
  }

  bookingsByDate.forEach((dayBookings) => {
    dayBookings.delete(bookingId);
  });
}
function getStoredSnapshot(date) {
  if (bookingLocalStore && typeof bookingLocalStore.getSnapshot === 'function') {
    return bookingLocalStore.getSnapshot(date);
  }

  return readJsonStorage(getSnapshotStorageKey(date), null);
}

function storeSnapshot(date) {
  const bookings = Array.from(getBookingsForDate(date).values());
  const snapshot = {
    date,
    bookings,
    lastFetchedAt: new Date().toISOString(),
    lastMutationAt: new Date().toISOString()
  };

  if (bookingLocalStore && typeof bookingLocalStore.setSnapshot === 'function') {
    return bookingLocalStore.setSnapshot(date, snapshot);
  }

  return writeJsonStorage(getSnapshotStorageKey(date), snapshot);
}

function restoreSnapshot(date) {
  const snapshot = getStoredSnapshot(date);
  if (!snapshot || !Array.isArray(snapshot.bookings)) return false;

  const restoredBookings = new Map();
  snapshot.bookings.forEach((booking) => {
    if (booking && booking.id) {
      restoredBookings.set(booking.id, booking);
    }
  });

  bookingsByDate.set(date, restoredBookings);
  return true;
}

function getOpsQueue() {
  if (bookingLocalStore && typeof bookingLocalStore.getQueue === 'function') {
    return bookingLocalStore.getQueue();
  }

  return readJsonStorage(OPS_QUEUE_STORAGE_KEY, []);
}

function setOpsQueue(queue) {
  if (bookingLocalStore && typeof bookingLocalStore.setQueue === 'function') {
    return bookingLocalStore.setQueue(queue);
  }

  return writeJsonStorage(OPS_QUEUE_STORAGE_KEY, queue);
}

function normalizeOpsQueue({ forcePending = false } = {}) {
  const queue = getOpsQueue();
  const normalizedQueue =
    typeof bookingSyncStateApi.normalizeQueueOperations === 'function'
      ? bookingSyncStateApi.normalizeQueueOperations(queue)
      : queue.map((entry, index) => {
          const bookingId = entry.bookingId || entry.payload?.id || `unknown-${index}`;
          const operationType = entry.type || 'upsert';
          return {
            ...entry,
            opId: entry.opId || `${bookingId}:${operationType}:legacy:${index}:${entry.updatedAt || Date.now()}`,
            type: operationType,
            bookingId,
            date: entry.date || entry.payload?.date || entry.payload?.booking_date || '',
            status: entry.status === 'syncing' ? 'pending' : entry.status || 'pending',
            retryCount: Number(entry.retryCount) || 0,
            updatedAt: entry.updatedAt || new Date().toISOString()
          };
        });
  const nextQueue = forcePending
    ? normalizedQueue.map((entry) => ({
        ...entry,
        status: entry.status === 'syncing' || entry.status === 'failed' ? 'pending' : entry.status,
        lastError: entry.status === 'failed' ? '' : entry.lastError
      }))
    : normalizedQueue;
  const didChange = JSON.stringify(queue) !== JSON.stringify(nextQueue);

  if (didChange) {
    setOpsQueue(nextQueue);
  }

  return nextQueue;
}

function enqueueBookingOperation(type, booking) {
  const queue = getOpsQueue();
  queue.push({
    opId: `${booking.id}:${type}:${Date.now()}`,
    eventId: crypto.randomUUID(),
    type,
    bookingId: booking.id,
    date: booking.date,
    payload: booking,
    deviceId: getDeviceId(),
    deviceRole: getDeviceRole(),
    clientSequence: getNextClientSequence(),
    clientCreatedAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
    updatedAt: new Date().toISOString()
  });
  setOpsQueue(queue);
  updateSyncBanner();
}

function createImmediateBookingOperation(type, booking) {
  return {
    opId: `${booking.id}:${type}:${Date.now()}`,
    eventId: crypto.randomUUID(),
    type,
    bookingId: booking.id,
    date: booking.date,
    payload: booking,
    deviceId: getDeviceId(),
    deviceRole: getDeviceRole(),
    clientSequence: getNextClientSequence(),
    clientCreatedAt: new Date().toISOString(),
    status: 'syncing',
    retryCount: 0,
    updatedAt: new Date().toISOString()
  };
}

function withSyncState(booking, syncState) {
  return {
    ...booking,
    syncState
  };
}

function getPendingBookingIds(date = null) {
  const queue = getOpsQueue();
  if (typeof bookingSyncStateApi.getBlockingBookingIds === 'function' && date) {
    return new Set(bookingSyncStateApi.getBlockingBookingIds(queue, date));
  }

  return new Set(
    queue
      .filter(
        (entry) =>
          (!date || entry.date === date) &&
          (entry.status === 'pending' || entry.status === 'syncing')
      )
      .map((entry) => entry.bookingId)
  );
}

function getPrimaryArrivalToggleOffset(durationSlots) {
  if (typeof bookingCardLayoutApi.getPrimaryArrivalToggleOffset === 'function') {
    return bookingCardLayoutApi.getPrimaryArrivalToggleOffset(durationSlots);
  }
  return Number(durationSlots) >= 2 ? 1 : 0;
}

function updateSyncBanner() {
  syncBanner.classList.add('hidden');
  syncBanner.textContent = '';
}

function updateArrivalToggleButton(booking) {
  if (!booking || modalMode !== 'view') {
    arrivalBox.classList.add('hidden');
    arrivalToggleBtn.classList.remove('is-active');
    arrivalToggleBtn.setAttribute('aria-checked', 'false');
    arrivalToggleBtn.setAttribute('aria-label', 'Отметить как пришедшего');
    arrivalToggleBtn.title = 'Отметить как пришедшего';
    return;
  }

  arrivalBox.classList.remove('hidden');
  const isActive = booking.arrivalStatus === 'active';
  arrivalToggleBtn.classList.toggle('is-active', isActive);
  arrivalToggleBtn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  arrivalToggleBtn.setAttribute(
    'aria-label',
    isActive ? 'Гость пришёл' : 'Отметить как пришедшего'
  );
  arrivalToggleBtn.title = isActive ? 'Гость пришёл' : 'Отметить как пришедшего';
}

function updateSyncMeta(metaPatch) {
  if (bookingLocalStore && typeof bookingLocalStore.patchMeta === 'function') {
    bookingLocalStore.patchMeta(metaPatch);
    return;
  }

  const currentMeta = readJsonStorage(SYNC_META_STORAGE_KEY, {});
  writeJsonStorage(SYNC_META_STORAGE_KEY, {
    ...currentMeta,
    ...metaPatch
  });
}

function persistAllBookingSnapshots() {
  bookingsByDate.forEach((_, bookingDate) => {
    storeSnapshot(bookingDate);
  });
  updateSyncMeta({ activeDate: selectedDate, lastPersistedAt: new Date().toISOString() });
  flushBookingLocalStore();
}

function recoverOpsQueueFromAllSnapshots() {
  const queue = getOpsQueue();
  let nextQueue = queue;

  bookingsByDate.forEach((dayBookings, bookingDate) => {
    const bookings = Array.from(dayBookings.values());
    if (typeof bookingSyncStateApi.recoverQueueFromSnapshot === 'function') {
      nextQueue = bookingSyncStateApi.recoverQueueFromSnapshot({
        date: bookingDate,
        bookings,
        queue: nextQueue
      });
      return;
    }

    bookings.forEach((booking) => {
      if (!booking || !booking.id || booking.syncState === 'synced') return;
      if (nextQueue.some((entry) => entry.bookingId === booking.id)) return;
      nextQueue.push({
        opId: `${booking.id}:recovered`,
        type: 'upsert',
        bookingId: booking.id,
        date: bookingDate,
        payload: booking,
        status: booking.syncState === 'syncing' ? 'syncing' : 'pending',
        retryCount: 0,
        updatedAt: new Date().toISOString()
      });
    });
  });

  if (nextQueue !== queue || nextQueue.length !== queue.length) {
    setOpsQueue(nextQueue);
    updateSyncBanner();
  }
}

function removeBookingOperation(opId) {
  const queue =
    typeof bookingSyncStateApi.removeQueueOperation === 'function'
      ? bookingSyncStateApi.removeQueueOperation(getOpsQueue(), opId)
      : getOpsQueue().filter((entry) => entry.opId !== opId);
  setOpsQueue(queue);
  updateSyncBanner();
}

function updateBookingOperation(opId, operationPatch) {
  const queue =
    typeof bookingSyncStateApi.updateQueueOperation === 'function'
      ? bookingSyncStateApi.updateQueueOperation(getOpsQueue(), opId, operationPatch)
      : getOpsQueue().map((entry) => {
          if (entry.opId !== opId) return entry;
          return {
            ...entry,
            ...operationPatch
          };
        });
  setOpsQueue(queue);
  updateSyncBanner();
}

function hasBookingOperation(opId) {
  const queue = getOpsQueue();
  if (typeof bookingSyncStateApi.hasQueueOperation === 'function') {
    return bookingSyncStateApi.hasQueueOperation(queue, opId);
  }

  return queue.some((entry) => entry.opId === opId);
}

function getErrorMessage(error) {
  if (!error) return 'Неизвестная ошибка';
  if (typeof error === 'string') return error;
  return error.message || error.details || error.hint || JSON.stringify(error);
}

function getQueueHealth() {
  const queue = getOpsQueue();
  const pendingEntries = queue.filter((entry) =>
    ['pending', 'syncing', 'failed'].includes(entry.status)
  );
  const oldestPendingEntry = pendingEntries
    .slice()
    .sort((left, right) => String(left.updatedAt).localeCompare(String(right.updatedAt)))[0];

  return {
    pendingCount: pendingEntries.length,
    oldestPendingAt: oldestPendingEntry?.updatedAt || null
  };
}

function ensureBookingOperationEvent(entry) {
  if (
    entry.eventId &&
    entry.deviceId &&
    entry.deviceRole &&
    Number.isFinite(Number(entry.clientSequence)) &&
    entry.clientCreatedAt
  ) {
    return entry;
  }

  const patchedEntry = {
    ...entry,
    opId: entry.opId || `${entry.bookingId || entry.payload?.id || 'unknown'}:${entry.type || 'upsert'}:${Date.now()}`,
    eventId: entry.eventId || crypto.randomUUID(),
    deviceId: entry.deviceId || getDeviceId(),
    deviceRole: entry.deviceRole || getDeviceRole(),
    clientSequence: Number.isFinite(Number(entry.clientSequence))
      ? Number(entry.clientSequence)
      : getNextClientSequence(),
    clientCreatedAt: entry.clientCreatedAt || new Date().toISOString()
  };

  updateBookingOperation(entry.opId, patchedEntry);
  return patchedEntry;
}
function getWaitlistForSelectedDate() {
  if (!waitlistByDate.has(selectedDate)) {
    waitlistByDate.set(selectedDate, new Map());
  }
  return waitlistByDate.get(selectedDate);
}

function getWaitlistForDate(waitlistDate) {
  if (!waitlistByDate.has(waitlistDate)) {
    waitlistByDate.set(waitlistDate, new Map());
  }
  return waitlistByDate.get(waitlistDate);
}

function cacheWaitlistEntry(entry) {
  getWaitlistForDate(entry.date).set(entry.id, entry);
}

function removeWaitlistEntryFromCache(entryId, entryDate = null) {
  if (entryDate && waitlistByDate.has(entryDate)) {
    waitlistByDate.get(entryDate).delete(entryId);
    return;
  }

  waitlistByDate.forEach((dayEntries) => {
    dayEntries.delete(entryId);
  });
}

function normalizeBookingRow(row) {
  if (!row?.id) return null;

  return {
    id: row.id,
    tableIndex: Number(row.table_index),
    timeIndex: Number(row.time_index),
    startMinutes: Number(row.start_minutes),
    durationSlots: Number(row.duration_slots),
    name: row.guest_name || '',
    phone: row.guest_phone || '',
    comment: row.guest_comment || '',
    guests: Number(row.guests) || 1,
    date: row.booking_date,
    colorTheme: row.color_theme || 'yellow',
    arrivalStatus: row.arrival_status === 'active' ? 'active' : 'pending',
    arrivalMarkedAt: row.arrival_marked_at || null
  };
}

function normalizeDeletedBookingRow(row) {
  const booking = normalizeBookingRow(row);
  if (!booking) return null;

  return {
    ...booking,
    deletedAt: row.deleted_at || null,
    deletedByDeviceId: row.deleted_by_device_id || '',
    deletedByEventId: row.deleted_by_event_id || ''
  };
}

function serializeBookingForDatabase(booking) {
  return {
    id: booking.id,
    booking_date: booking.date,
    table_index: booking.tableIndex,
    time_index: booking.timeIndex,
    start_minutes: booking.startMinutes,
    duration_slots: booking.durationSlots,
    guest_name: booking.name,
    guest_phone: booking.phone,
    guest_comment: booking.comment,
    guests: booking.guests,
    color_theme: booking.colorTheme,
    arrival_status: booking.arrivalStatus || 'pending',
    arrival_marked_at: booking.arrivalMarkedAt || null
  };
}

function getBookingThemeTokens() {
  const theme = THEMES[currentTheme] || THEMES.yellow;
  return {
    accent: theme.accent,
    accentDeep: theme.accentDeep
  };
}

function getBookingVisualState(booking, nowTimelineMinutes) {
  if (typeof bookingVisualStateApi.getBookingVisualState === 'function') {
    return bookingVisualStateApi.getBookingVisualState({
      booking,
      nowTimelineMinutes
    });
  }

  if (booking.arrivalStatus === 'active') return 'active';
  if (!Number.isFinite(nowTimelineMinutes)) return 'neutral';
  if (nowTimelineMinutes >= booking.startMinutes + 10) return 'overdue';
  if (booking.startMinutes > nowTimelineMinutes) return 'upcoming';
  return 'pending';
}

async function toggleBookingArrivalStatus(bookingId) {
  const booking = getBookingsForSelectedDate().get(bookingId);
  if (!booking) return;

  const updatedBooking =
    booking.arrivalStatus === 'active'
      ? {
          ...booking,
          arrivalStatus: 'pending',
          arrivalMarkedAt: null
        }
      : {
          ...booking,
          arrivalStatus: 'active',
          arrivalMarkedAt: new Date().toISOString()
        };

  await saveBookingToDatabase(updatedBooking);
}

function setExtendMode(isActive) {
  isExtendMode = Boolean(isActive);
  if (!isExtendMode) {
    selectedExtendBookingId = null;
  }
  extendModeBtn.classList.toggle('active', isExtendMode);
  extendModeBtn.setAttribute('aria-pressed', isExtendMode ? 'true' : 'false');
  paintBookings();
}

function getExtendedDurationSlots(booking, targetTableIndex, targetTimeIndex) {
  const totalInteractiveSlots = Math.max(0, timeSlots.length - 1);
  if (typeof bookingExtensionApi.getExtendedDurationSlots === 'function') {
    return bookingExtensionApi.getExtendedDurationSlots({
      booking,
      targetTableIndex,
      targetTimeIndex,
      totalInteractiveSlots,
      bookings: Array.from(getBookingsForSelectedDate().values())
    });
  }

  if (!booking || targetTableIndex !== booking.tableIndex) return null;
  if (targetTimeIndex < booking.timeIndex + booking.durationSlots) return null;
  if (targetTimeIndex >= totalInteractiveSlots) return null;

  const nextDurationSlots = targetTimeIndex - booking.timeIndex + 1;
  return isTimeRangeFree(booking.tableIndex, booking.timeIndex, nextDurationSlots, booking.id)
    ? nextDurationSlots
    : null;
}

async function tryExtendSelectedBooking(targetTableIndex, targetTimeIndex) {
  const booking = selectedExtendBookingId
    ? getBookingsForSelectedDate().get(selectedExtendBookingId)
    : null;
  if (!booking) {
    selectedExtendBookingId = null;
    paintBookings();
    return;
  }

  const nextDurationSlots = getExtendedDurationSlots(booking, targetTableIndex, targetTimeIndex);
  if (!nextDurationSlots) return;

  const updatedBooking = {
    ...booking,
    durationSlots: nextDurationSlots,
    colorTheme: currentTheme
  };

  const saved = await saveBookingToDatabase(updatedBooking);
  if (saved) {
    selectedExtendBookingId = null;
    paintBookings();
  }
}

function normalizeWaitlistRow(row) {
  if (!row?.id) return null;

  return {
    id: row.id,
    date: row.waitlist_date,
    name: row.guest_name || '',
    phone: row.guest_phone || '',
    comment: row.guest_comment || '',
    createdAt: row.created_at || ''
  };
}

function serializeWaitlistForDatabase(entry) {
  return {
    id: entry.id,
    waitlist_date: entry.date,
    guest_name: entry.name,
    guest_phone: entry.phone,
    guest_comment: entry.comment
  };
}

async function loadBookingsFromDatabase(date = selectedDate) {
  if (!bookingDatabase) {
    setSyncStatus('Supabase не настроен', 'error');
    if (date === selectedDate) {
      paintBookings();
    }
    return;
  }

  updateSyncIndicator('Загрузка броней...', { isBusy: true });

  const { data, error } = await bookingDatabase
    .from(BOOKINGS_TABLE)
    .select(
      'id, booking_date, table_index, time_index, start_minutes, duration_slots, guest_name, guest_phone, guest_comment, guests, color_theme, arrival_status, arrival_marked_at'
    )
    .eq('booking_date', date)
    .is('deleted_at', null)
    .order('table_index', { ascending: true })
    .order('time_index', { ascending: true });

  if (error) {
    console.error('Supabase load error:', error);
    hasRealtimeConnectionError = true;
    updateSyncIndicator('Ошибка загрузки', { hasConnectionError: true });
    return;
  }

  const normalizedBookings = [];
  (data || []).forEach((row) => {
    const booking = normalizeBookingRow(row);
    if (booking) normalizedBookings.push(withSyncState(booking, 'synced'));
  });

  reconcileBookingsForDate(date, normalizedBookings);
  if (date === selectedDate) {
    paintBookings();
  }
  hasRealtimeConnectionError = false;
  updateSyncIndicator('Онлайн');
}

async function loadWaitlistFromDatabase() {
  if (!bookingDatabase) {
    renderWaitlist();
    return;
  }

  const { data, error } = await bookingDatabase
    .from(WAITLIST_TABLE)
    .select('id, waitlist_date, guest_name, guest_phone, guest_comment, created_at')
    .order('waitlist_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase waitlist load error:', error);
    updateSyncIndicator('Ошибка загрузки листа ожидания');
    return;
  }

  waitlistByDate.clear();
  (data || []).forEach((row) => {
    const entry = normalizeWaitlistRow(row);
    if (entry) cacheWaitlistEntry(entry);
  });

  renderWaitlist();
}

async function loadDebugDataFromDatabase(date = selectedDate) {
  if (!IS_DEBUG_MODE || !bookingDatabase) {
    renderDebugView();
    return;
  }

  const [eventsResult, deletedResult] = await Promise.all([
    bookingDatabase
      .from(EVENTS_TABLE)
      .select(
        'event_id, booking_id, booking_date, event_type, payload, device_id, device_role, client_sequence, client_created_at, server_created_at, apply_status'
      )
      .eq('booking_date', date)
      .order('server_created_at', { ascending: false })
      .limit(80),
    bookingDatabase
      .from(BOOKINGS_TABLE)
      .select(
        'id, booking_date, table_index, time_index, start_minutes, duration_slots, guest_name, guest_phone, guest_comment, guests, color_theme, arrival_status, arrival_marked_at, deleted_at, deleted_by_device_id, deleted_by_event_id'
      )
      .eq('booking_date', date)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
  ]);

  if (eventsResult.error) {
    console.error('Supabase debug events load error:', eventsResult.error);
  } else {
    debugEventsCache = eventsResult.data || [];
  }

  if (deletedResult.error) {
    console.error('Supabase debug deleted bookings load error:', deletedResult.error);
  } else {
    debugDeletedBookingsCache = (deletedResult.data || [])
      .map(normalizeDeletedBookingRow)
      .filter(Boolean);
  }

  renderDebugView();
}

async function restoreDeletedBookingFromDebug(bookingId) {
  if (!IS_DEBUG_MODE || !bookingDatabase) return;

  const booking = debugDeletedBookingsCache.find((entry) => entry.id === bookingId);
  if (!booking) return;

  const restoredBooking = {
    id: booking.id,
    tableIndex: booking.tableIndex,
    timeIndex: booking.timeIndex,
    startMinutes: booking.startMinutes,
    durationSlots: booking.durationSlots,
    name: booking.name,
    phone: booking.phone,
    comment: booking.comment,
    guests: booking.guests,
    date: booking.date,
    colorTheme: booking.colorTheme,
    arrivalStatus: booking.arrivalStatus || 'pending',
    arrivalMarkedAt: booking.arrivalMarkedAt || null
  };

  const result = await applyBookingOperationOnServer(
    createImmediateBookingOperation('restore', restoredBooking)
  );

  if (!result.ok) {
    console.error('Supabase booking restore error:', result.error);
    updateSyncIndicator('Ошибка восстановления');
    return;
  }

  cacheBooking(withSyncState(restoredBooking, 'synced'));
  storeSnapshot(restoredBooking.date);
  await loadBookingsFromDatabase(restoredBooking.date);
  await loadDebugDataFromDatabase(restoredBooking.date);
  updateSyncIndicator('Онлайн');
}

async function loadThemeFromDatabase() {
  if (!bookingDatabase) return;

  const { data, error } = await bookingDatabase
    .from(META_TABLE)
    .select('value')
    .eq('key', 'current_theme')
    .maybeSingle();

  if (error) {
    console.error('Supabase theme load error:', error);
    return;
  }

  if (data?.value && THEMES[data.value]) {
    applyTheme(data.value);
  }
}

async function upsertBookingOnServer(booking) {
  if (!bookingDatabase) {
    return { ok: false, error: new Error('Supabase unavailable') };
  }
  const { error } = await bookingDatabase
    .from(BOOKINGS_TABLE)
    .upsert(serializeBookingForDatabase(booking), { onConflict: 'id' });
  return { ok: !error, error };
}

async function applyBookingOperationOnServer(entry) {
  if (!bookingDatabase) {
    return { ok: false, error: new Error('Supabase unavailable') };
  }

  const syncedEntry = ensureBookingOperationEvent(entry);
  const eventPayload =
    typeof bookingSyncStateApi.createBookingEventPayload === 'function'
      ? bookingSyncStateApi.createBookingEventPayload({
          entry: syncedEntry,
          deviceId: syncedEntry.deviceId,
          deviceRole: syncedEntry.deviceRole,
          clientSequence: syncedEntry.clientSequence,
          clientCreatedAt: syncedEntry.clientCreatedAt
        })
      : null;

  if (!eventPayload) {
    return { ok: false, error: new Error('Booking event payload unavailable') };
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, BOOKING_RPC_TIMEOUT_MS);

  try {
    const rpcRequest = bookingDatabase.rpc('booking_sheet_apply_event', {
      event_payload: eventPayload
    });
    const requestWithTimeout =
      typeof rpcRequest.abortSignal === 'function'
        ? rpcRequest.abortSignal(timeoutController.signal)
        : Promise.race([
            rpcRequest,
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Supabase RPC timeout')), BOOKING_RPC_TIMEOUT_MS);
            })
          ]);
    const { error } = await requestWithTimeout;

    return { ok: !error, error };
  } catch (error) {
    return { ok: false, error };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function saveThemeToDatabase(themeName) {
  if (!bookingDatabase || !THEMES[themeName]) return;

  const { error } = await bookingDatabase
    .from(META_TABLE)
    .upsert({ key: 'current_theme', value: themeName }, { onConflict: 'key' });

  if (error) {
    console.error('Supabase theme save error:', error);
    updateSyncIndicator('Ошибка сохранения темы');
  }
}

async function saveDeviceStateToDatabase() {
  if (!bookingDatabase) return;

  const queueHealth = getQueueHealth();
  const { error } = await bookingDatabase.from(DEVICE_STATE_TABLE).upsert(
    {
      device_id: getDeviceId(),
      device_role: getDeviceRole(),
      selected_date: selectedDate,
      last_seen_at: new Date().toISOString(),
      local_pending_count: queueHealth.pendingCount,
      oldest_pending_at: queueHealth.oldestPendingAt,
      last_successful_sync_at:
        queueHealth.pendingCount === 0 ? new Date().toISOString() : null,
      app_version: BOOKING_APP_VERSION,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'device_id' }
  );

  if (error) {
    console.error('Supabase device state save error:', error);
  }
}

async function saveWaitlistEntryToDatabase(entry) {
  if (!bookingDatabase) {
    cacheWaitlistEntry(entry);
    renderWaitlist();
    updateSyncIndicator('Локальный режим', { isBusy: true });
    return true;
  }

  const { error } = await bookingDatabase
    .from(WAITLIST_TABLE)
    .upsert(serializeWaitlistForDatabase(entry), { onConflict: 'id' });

  if (error) {
    console.error('Supabase waitlist save error:', error);
    updateSyncIndicator('Ошибка сохранения листа ожидания');
    return false;
  }

  cacheWaitlistEntry(entry);
  renderWaitlist();
  updateSyncIndicator('Онлайн');
  return true;
}

async function deleteWaitlistEntryFromDatabase(entry) {
  if (!bookingDatabase) {
    removeWaitlistEntryFromCache(entry.id, entry.date);
    renderWaitlist();
    updateSyncIndicator('Локальный режим', { isBusy: true });
    return true;
  }

  const { error } = await bookingDatabase.from(WAITLIST_TABLE).delete().eq('id', entry.id);

  if (error) {
    console.error('Supabase waitlist delete error:', error);
    updateSyncIndicator('Ошибка удаления из листа ожидания');
    return false;
  }

  removeWaitlistEntryFromCache(entry.id, entry.date);
  renderWaitlist();
  updateSyncIndicator('Онлайн');
  return true;
}

function applyLocalBookingUpsert(booking, syncState) {
  const localBooking = withSyncState(booking, syncState);
  removeBookingFromCache(localBooking.id);
  cacheBooking(localBooking);
  storeSnapshot(localBooking.date);
  paintBookings();
}

function applyLocalBookingDelete(booking) {
  removeBookingFromCache(booking.id, booking.date);
  storeSnapshot(booking.date);
  paintBookings();
}

function reconcileBookingsForDate(date, serverBookings) {
  const localBookings = getBookingsForDate(date);
  const pendingIds = getPendingBookingIds(date);
  const unsyncedLocalIds =
    typeof bookingSyncStateApi.getUnsyncedBookingIds === 'function'
      ? new Set(bookingSyncStateApi.getUnsyncedBookingIds(Array.from(localBookings.values())))
      : new Set(
          Array.from(localBookings.values())
            .filter((booking) => booking.syncState && booking.syncState !== 'synced')
            .map((booking) => booking.id)
        );
  const reconciled = new Map();

  serverBookings.forEach((booking) => {
    if (!pendingIds.has(booking.id)) {
      reconciled.set(booking.id, withSyncState(booking, 'synced'));
    }
  });

  localBookings.forEach((booking, bookingId) => {
    if (pendingIds.has(bookingId) || unsyncedLocalIds.has(bookingId)) {
      reconciled.set(bookingId, booking);
    }
  });

  bookingsByDate.set(date, reconciled);
  storeSnapshot(date);
}

async function flushBookingOpsQueue() {
  if (isFlushingBookingOpsQueue) return;
  isFlushingBookingOpsQueue = true;
  let shouldFlushAgain = false;

  try {
    const queue = normalizeOpsQueue();
    const flushableQueue =
      typeof bookingSyncStateApi.getFlushableQueueOperations === 'function'
        ? bookingSyncStateApi.getFlushableQueueOperations(queue)
        : queue.filter((entry) => entry.status !== 'failed');
    if (!flushableQueue.length) {
      updateSyncBanner();
      return;
    }

    for (const entry of flushableQueue) {
      updateBookingOperation(entry.opId, {
        status: 'syncing',
        lastError: '',
        updatedAt: new Date().toISOString()
      });

      const applyResult = await applyBookingOperationOnServer(entry);
      if (!applyResult.ok) {
        console.error('Supabase booking event apply error:', applyResult.error);
        if (hasBookingOperation(entry.opId)) {
          if (entry.type !== 'delete') {
            applyLocalBookingUpsert(entry.payload, 'failed');
          }
          updateBookingOperation(entry.opId, {
            status: 'failed',
            retryCount: (Number(entry.retryCount) || 0) + 1,
            lastError: getErrorMessage(applyResult.error),
            updatedAt: new Date().toISOString()
          });
        }
        continue;
      }

      if (hasBookingOperation(entry.opId)) {
        if (entry.type !== 'delete') {
          applyLocalBookingUpsert(entry.payload, 'synced');
        }
        removeBookingOperation(entry.opId);
      }
    }

    updateSyncMeta({ lastGlobalSyncAt: new Date().toISOString() });
    updateSyncBanner();
    const remainingQueue = getOpsQueue();
    if (remainingQueue.length) {
      updateSyncIndicator('Есть несинхронизированные изменения');
    } else {
      updateSyncIndicator('Онлайн');
    }

    shouldFlushAgain = remainingQueue.some((entry) => entry.status === 'pending');
    void saveDeviceStateToDatabase();
  } catch (error) {
    console.error('Booking queue flush error:', error);
    normalizeOpsQueue({ forcePending: true });
    updateSyncIndicator('Есть несинхронизированные изменения');
  } finally {
    isFlushingBookingOpsQueue = false;
    if (IS_DEBUG_MODE && currentView === 'debug') {
      renderDebugView();
    }
    if (shouldFlushAgain) {
      void flushBookingOpsQueue();
    }
  }
}

function hydrateSelectedDateFromStorage() {
  const restored = restoreSnapshot(selectedDate);
  if (restored) {
    paintBookings();
  }
}

function restoreSelectedDateFromLocalState() {
  const now = Date.now();
  if (now - lastLifecycleRestoreAt < BOOKING_RESTORE_THROTTLE_MS) return;
  lastLifecycleRestoreAt = now;

  const restored = restoreSnapshot(selectedDate);
  if (restored) {
    renderGrid();
    renderWaitlist();
    setCurrentView(currentView);
  }

  recoverOpsQueueFromAllSnapshots();
  void flushBookingOpsQueue();
  void loadBookingsFromDatabase(selectedDate);
}

async function saveBookingToDatabase(booking) {
  applyLocalBookingUpsert(booking, 'pending');
  enqueueBookingOperation('upsert', booking);
  updateSyncIndicator('Сохраняем локально', { isBusy: true });
  void flushBookingOpsQueue();
  return true;
}

async function deleteBookingFromDatabase(booking) {
  applyLocalBookingDelete(booking);
  enqueueBookingOperation('delete', booking);
  updateSyncIndicator('Удаление в очереди', { isBusy: true });
  void flushBookingOpsQueue();
  return true;
}

async function refreshSelectedDateData() {
  const date = selectedDate;
  hydrateSelectedDateFromStorage();
  renderGrid();
  renderWaitlist();
  setCurrentView(currentView);
  updateSyncMeta({ activeDate: date });
  await flushBookingOpsQueue();
  await loadBookingsFromDatabase(date);
}

async function retryDebugSyncNow() {
  if (!IS_DEBUG_MODE) return;

  isFlushingBookingOpsQueue = false;
  normalizeOpsQueue({ forcePending: true });
  renderDebugView();
  debugSyncRetryBtn.disabled = true;
  debugSyncRetryBtn.textContent = 'Жму...';
  try {
    recoverOpsQueueFromAllSnapshots();
    await flushBookingOpsQueue();
    await loadBookingsFromDatabase(selectedDate);
    await loadDebugDataFromDatabase(selectedDate);
    renderDebugView();
  } finally {
    debugSyncRetryBtn.disabled = false;
    debugSyncRetryBtn.textContent = 'Дожать';
  }
}

function applyBookingRealtimePayload(payload) {
  lastRealtimeEventAt = new Date();
  console.info('Supabase bookings realtime payload:', payload);

  const bookingId = payload.eventType === 'DELETE' ? payload.old?.id : payload.new?.id;
  const bookingDate =
    payload.eventType === 'DELETE' ? payload.old?.booking_date || null : payload.new?.booking_date || null;
  const isDeletedBooking =
    payload.eventType === 'DELETE' || Boolean(payload.new?.deleted_at);

  if (bookingId && getPendingBookingIds(bookingDate).has(bookingId)) {
    updateSyncIndicator('Онлайн');
    return;
  }

  if (isDeletedBooking) {
    if (bookingId) {
      removeBookingFromCache(bookingId, bookingDate);

      if (editingBookingId === bookingId && modal.open) {
        closeModalAndReset();
      }
    }
  } else {
    const booking = normalizeBookingRow(payload.new);
    if (booking) {
      cacheBooking(withSyncState(booking, 'synced'));
    }
  }

  if (bookingDate) {
    storeSnapshot(bookingDate);
  }
  if (bookingDate === selectedDate) {
    paintBookings();
  }
  if (IS_DEBUG_MODE && currentView === 'debug') {
    void loadDebugDataFromDatabase(bookingDate || selectedDate);
  }
  updateSyncIndicator('Онлайн');
}

function applyEventRealtimePayload(payload) {
  lastRealtimeEventAt = new Date();
  console.info('Supabase booking event realtime payload:', payload);

  if (IS_DEBUG_MODE && currentView === 'debug') {
    void loadDebugDataFromDatabase(payload.new?.booking_date || selectedDate);
  }

  updateSyncIndicator('Онлайн');
}

function applyMetaRealtimePayload(payload) {
  lastRealtimeEventAt = new Date();
  console.info('Supabase meta realtime payload:', payload);

  if (payload.new?.key === 'current_theme' && THEMES[payload.new.value]) {
    applyTheme(payload.new.value);
  }

  updateSyncIndicator('Онлайн');
}

function applyWaitlistRealtimePayload(payload) {
  lastRealtimeEventAt = new Date();
  console.info('Supabase waitlist realtime payload:', payload);

  if (payload.eventType === 'DELETE') {
    const entryId = payload.old?.id;
    const entryDate = payload.old?.waitlist_date || null;
    if (entryId) {
      removeWaitlistEntryFromCache(entryId, entryDate);
    }
  } else {
    const entry = normalizeWaitlistRow(payload.new);
    if (entry) cacheWaitlistEntry(entry);
  }

  renderWaitlist();
  updateSyncIndicator('Онлайн');
}

function subscribeToBookingChanges() {
  if (!bookingDatabase || bookingsChannel) return;

  updateSyncIndicator('Подключение realtime...', { isBusy: true });
  console.info('Supabase realtime subscribe start:', BOOKINGS_TABLE);

  bookingsChannel = bookingDatabase
    .channel('booking-sheet-bookings')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: BOOKINGS_TABLE },
      applyBookingRealtimePayload
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: WAITLIST_TABLE },
      applyWaitlistRealtimePayload
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: META_TABLE },
      applyMetaRealtimePayload
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: EVENTS_TABLE },
      applyEventRealtimePayload
    )
    .subscribe((status, error) => {
      console.info('Supabase realtime status:', status, error || '');

      if (status === 'SUBSCRIBED') {
        hasRealtimeConnectionError = false;
        updateSyncIndicator('Realtime подключен');
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        hasRealtimeConnectionError = true;
        updateSyncIndicator('Realtime недоступен', { hasConnectionError: true });
      }
    });
}

async function bootstrapBookingsSync() {
  subscribeToBookingChanges();
  hydrateSelectedDateFromStorage();
  recoverOpsQueueFromAllSnapshots();
  updateSyncBanner();
  updateSyncMeta({ activeDate: selectedDate });
  await loadThemeFromDatabase();
  await flushBookingOpsQueue();
  await loadBookingsFromDatabase();
  await loadWaitlistFromDatabase();
  setCurrentView(currentView);
  void saveDeviceStateToDatabase();
}

function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES.yellow;
  currentTheme = THEMES[themeName] ? themeName : 'yellow';

  document.documentElement.style.setProperty('--accent', theme.accent);
  document.documentElement.style.setProperty('--accent-deep', theme.accentDeep);

  paletteButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === currentTheme);
  });

  if (board.childElementCount) {
    paintBookings();
  }
}

function fitBoardToViewport() {
  const wrapRect = board.parentElement.getBoundingClientRect();
  const fullWidth = Math.max(wrapRect.width, 320);
  const fullHeight = Math.max(wrapRect.height, 320);
  const isMobileLayout = window.innerWidth <= MOBILE_BOARD_BREAKPOINT;
  const displayTableCount = getDisplayTableIndices().length;

  if (isMobileLayout) {
    const totalBoardWidth =
      MOBILE_TIME_COLUMN_WIDTH + MOBILE_TABLE_COLUMN_WIDTH * displayTableCount;
    const slotRowHeight = clamp(
      Math.floor((fullHeight - MOBILE_HEADER_ROW_HEIGHT) / timeSlots.length),
      14,
      MOBILE_SLOT_ROW_HEIGHT
    );
    const usedMobileHeight = MOBILE_HEADER_ROW_HEIGHT + slotRowHeight * timeSlots.length;
    const lastMobileSlotRowHeight = slotRowHeight + Math.max(0, Math.floor(fullHeight - usedMobileHeight));

    board.style.width = `${totalBoardWidth}px`;
    board.style.height = '100%';
    board.style.gridTemplateColumns = `${MOBILE_TIME_COLUMN_WIDTH}px repeat(${displayTableCount}, ${MOBILE_TABLE_COLUMN_WIDTH}px)`;
    board.style.gridTemplateRows = `${MOBILE_HEADER_ROW_HEIGHT}px repeat(${timeSlots.length - 1}, ${slotRowHeight}px) ${lastMobileSlotRowHeight}px`;
    return;
  }

  board.style.width = '100%';
  board.style.height = '100%';

  const firstColumnWidth = clamp(Math.floor(fullWidth * 0.07), 52, 86);
  const baseTableColumnWidth = clamp(
    Math.floor((fullWidth - firstColumnWidth) / displayTableCount),
    42,
    120
  );
  const headerRowHeight = clamp(Math.floor(fullHeight * 0.06), 30, 52);
  const baseSlotRowHeight = clamp(
    Math.floor((fullHeight - headerRowHeight) / timeSlots.length),
    18,
    42
  );

  const usedWidth = firstColumnWidth + baseTableColumnWidth * displayTableCount;
  const extraWidth = Math.max(0, Math.floor(fullWidth - usedWidth));
  const lastTableColumnWidth = baseTableColumnWidth + extraWidth;

  const usedHeight = headerRowHeight + baseSlotRowHeight * timeSlots.length;
  const extraHeight = Math.max(0, Math.floor(fullHeight - usedHeight));
  const lastSlotRowHeight = baseSlotRowHeight + extraHeight;

  board.style.gridTemplateColumns = `${firstColumnWidth}px repeat(${displayTableCount - 1}, ${baseTableColumnWidth}px) ${lastTableColumnWidth}px`;
  board.style.gridTemplateRows = `${headerRowHeight}px repeat(${timeSlots.length - 1}, ${baseSlotRowHeight}px) ${lastSlotRowHeight}px`;
}

function updateNowIndicatorPosition() {
  const firstVisibleTableIndex = getDisplayTableIndices()[0];
  const firstSlotCell = document.querySelector(
    `.slot-cell[data-table-index="${firstVisibleTableIndex}"][data-time-index="0"]`
  );
  const lastSlotCell = document.querySelector(
    `.slot-cell[data-table-index="${firstVisibleTableIndex}"][data-time-index="${timeSlots.length - 1}"]`
  );

  if (!firstSlotCell || !lastSlotCell) {
    nowIndicator.classList.add('hidden');
    return;
  }

  const nowMinutes = getKaliningradBusinessTimelinePosition();
  const nowLabel = getKaliningradTimeLabel();
  nowBeacon.dataset.nowTime = `Сейчас: ${nowLabel}`;
  nowBeacon.title = `Калининград: ${nowLabel}`;

  if (nowMinutes === null || nowMinutes < START_MINUTES || nowMinutes > scheduleEndMinutes) {
    nowIndicator.classList.add('hidden');
    return;
  }

  const slotsTop = firstSlotCell.offsetTop;
  const slotsBottom = lastSlotCell.offsetTop + lastSlotCell.offsetHeight;
  const slotsHeight = slotsBottom - slotsTop;
  const ratio = (nowMinutes - START_MINUTES) / (scheduleEndMinutes - START_MINUTES);
  const y = slotsTop + slotsHeight * ratio;
  const tableStartX = firstSlotCell.offsetLeft;
  const indicatorWidth = board.scrollWidth;
  const tableWidth = indicatorWidth - tableStartX;

  nowIndicator.classList.remove('hidden');
  nowIndicator.style.width = `${indicatorWidth}px`;
  nowIndicator.style.top = `${y}px`;

  nowBeacon.style.left = '0';
  nowBeacon.style.width = `${tableStartX}px`;

  nowLine.style.left = `${tableStartX}px`;
  nowLine.style.width = `${tableWidth}px`;
}

function populateTimeSelect() {
  startTimeSelect.innerHTML = '';
  timeSlots.slice(0, -1).forEach((minutes, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = minutesToLabel(minutes);
    startTimeSelect.append(option);
  });
}

function populateTransferTables(currentTableIndex = -1) {
  transferTableSelect.innerHTML = '';
  getDisplayTableIndices().forEach((index) => {
    if (index === currentTableIndex) return;

    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = getTableLabel(index);
    transferTableSelect.append(option);
  });
}

function updateSlotInfo() {
  const startIndex = getStartTimeIndex();
  if (Number.isNaN(startIndex)) return;

  const startMinutes = timeSlots[startIndex];
  const endMinutes = startMinutes + durationSlots * STEP_MINUTES;

  selectedSlotText.textContent = `${selectedDate} | ${minutesToLabel(startMinutes)} - ${minutesToLabel(endMinutes)} (${formatDurationFromSlots(durationSlots)})`;
  setCounter(durationCountOutput, formatDurationFromSlots(durationSlots));

  if (modalMode === 'view' && editingBookingId) {
    updateArrivalToggleButton(getBookingsForSelectedDate().get(editingBookingId) || null);
  }
}

function setModalMode(mode) {
  modalMode = mode;
  const viewMode = mode === 'view';
  transferModeActive = false;

  deleteBtn.classList.toggle('hidden', !viewMode);
  transferBtn.classList.toggle('hidden', !viewMode);
  transferBox.classList.add('hidden');
  startTimeSelect.disabled = false;
  arrivalBox.classList.toggle('hidden', !viewMode);

  saveBtn.textContent = viewMode ? 'Сохранить изменения' : 'Сохранить бронь';
  cancelBtn.textContent = viewMode ? 'Закрыть' : 'Отмена';
}

function openCreateModal(slot) {
  const maxSlots = getMaxSlotsFromStart(slot.timeIndex);
  if (maxSlots < 1) return;

  setModalMode('create');
  editingBookingId = null;
  activeSlot = slot;

  modalTitle.textContent = `Бронь: стол ${getTableLabel(slot.tableIndex)}`;

  guestNameInput.value = '';
  guestPhoneInput.value = '';
  guestCommentInput.value = '';
  guestCount = 1;
  durationSlots = getDefaultDurationSlots(slot.timeIndex);

  setCounter(guestsCountOutput, String(guestCount));
  startTimeSelect.value = String(slot.timeIndex);
  updateSlotInfo();
  updateArrivalToggleButton(null);

  modal.showModal();
}

function openViewModal(booking) {
  setModalMode('view');
  editingBookingId = booking.id;
  activeSlot = { tableIndex: booking.tableIndex, timeIndex: booking.timeIndex };

  modalTitle.textContent = `Бронь: стол ${getTableLabel(booking.tableIndex)}`;

  guestNameInput.value = booking.name;
  guestPhoneInput.value = booking.phone;
  guestCommentInput.value = booking.comment;
  guestCount = booking.guests;
  durationSlots = booking.durationSlots;

  setCounter(guestsCountOutput, String(guestCount));
  startTimeSelect.value = String(booking.timeIndex);
  populateTransferTables(booking.tableIndex);
  updateSlotInfo();
  updateArrivalToggleButton(booking);

  modal.showModal();
}

function onCellClick(event) {
  const toggle = event.target.closest('.booking-arrival-toggle');
  if (toggle?.dataset.bookingId) {
    event.preventDefault();
    event.stopPropagation();
    void toggleBookingArrivalStatus(toggle.dataset.bookingId);
    return;
  }

  if (suppressNextCellClick) {
    suppressNextCellClick = false;
    return;
  }

  const cell = event.currentTarget;

  if (isExtendMode) {
    if (cell.dataset.bookingId) {
      selectedExtendBookingId =
        selectedExtendBookingId === cell.dataset.bookingId ? null : cell.dataset.bookingId;
      paintBookings();
      return;
    }

    if (selectedExtendBookingId) {
      void tryExtendSelectedBooking(
        Number(cell.dataset.tableIndex),
        Number(cell.dataset.timeIndex)
      );
    }
    return;
  }

  if (cell.dataset.bookingId) {
    const booking = getBookingsForSelectedDate().get(cell.dataset.bookingId);
    if (booking) {
      openViewModal(booking);
    }
    return;
  }

  openCreateModal({
    tableIndex: Number(cell.dataset.tableIndex),
    timeIndex: Number(cell.dataset.timeIndex)
  });
}

function clearDropHints() {
  document.querySelectorAll('.slot-cell.drop-allowed, .slot-cell.drop-denied').forEach((cell) => {
    cell.classList.remove('drop-allowed', 'drop-denied');
  });
}

function onCellDragStart(event) {
  if (isExtendMode) {
    event.preventDefault();
    return;
  }

  const cell = event.currentTarget;
  const bookingId = cell.dataset.bookingId;
  if (!bookingId) {
    event.preventDefault();
    return;
  }

  draggedBookingId = bookingId;
  cell.classList.add('dragging');

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', bookingId);
  }
}

function onCellDragEnd() {
  draggedBookingId = null;
  clearDropHints();
  document.querySelectorAll('.slot-cell.dragging').forEach((cell) => cell.classList.remove('dragging'));
}

function onCellDragOver(event) {
  const cell = event.currentTarget;
  if (!draggedBookingId) return;

  const booking = getBookingsForSelectedDate().get(draggedBookingId);
  if (!booking) return;

  event.preventDefault();
  const targetTableIndex = Number(cell.dataset.tableIndex);
  const targetTimeIndex = Number(cell.dataset.timeIndex);
  const canDrop = isTimeRangeFree(
    targetTableIndex,
    targetTimeIndex,
    booking.durationSlots,
    draggedBookingId
  );

  clearDropHints();
  cell.classList.add(canDrop ? 'drop-allowed' : 'drop-denied');

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = canDrop ? 'move' : 'none';
  }
}

async function onCellDrop(event) {
  const cell = event.currentTarget;
  if (!draggedBookingId) return;

  event.preventDefault();
  clearDropHints();

  const bookings = getBookingsForSelectedDate();
  const booking = bookings.get(draggedBookingId);
  if (!booking) return;

  const targetTableIndex = Number(cell.dataset.tableIndex);
  const targetTimeIndex = Number(cell.dataset.timeIndex);

  if (
    !isTimeRangeFree(targetTableIndex, targetTimeIndex, booking.durationSlots, draggedBookingId)
  ) {
    return;
  }

  const movedBooking = {
    ...booking,
    tableIndex: targetTableIndex,
    timeIndex: targetTimeIndex,
    startMinutes: timeSlots[targetTimeIndex]
  };

  // Prevent accidental click-open right after mouse release from drag.
  suppressNextCellClick = true;
  setTimeout(() => {
    suppressNextCellClick = false;
  }, 0);

  await saveBookingToDatabase(movedBooking);
}

function renderGrid() {
  board.innerHTML = '';
  fitBoardToViewport();
  const displayTableIndices = getDisplayTableIndices();

  const corner = document.createElement('div');
  corner.className = 'cell head-cell time-cell corner-cell';
  corner.textContent = 'Стол / время';
  board.appendChild(corner);

  displayTableIndices.forEach((tableIndex, displayIndex) => {
    const head = document.createElement('div');
    head.className = 'cell head-cell';
    if (displayIndex === displayTableIndices.length - 1) head.classList.add('last-col');
    head.textContent = getTableLabel(tableIndex);
    board.appendChild(head);
  });

  timeSlots.forEach((minutes, rowIndex) => {
    const isClosingRow = rowIndex === timeSlots.length - 1;
    const timeCell = document.createElement('div');
    timeCell.className = 'cell time-cell';
    if (isClosingRow) timeCell.classList.add('last-row', 'closing-row');
    timeCell.textContent = minutesToLabel(minutes);
    board.appendChild(timeCell);

    displayTableIndices.forEach((tableIndex, displayIndex) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell slot-cell';
      cell.draggable = false;
      if (displayIndex === displayTableIndices.length - 1) cell.classList.add('last-col');
      if (isClosingRow) {
        cell.classList.add('last-row', 'closing-row', 'closing-slot');
        cell.disabled = true;
      }
      cell.dataset.tableIndex = String(tableIndex);
      cell.dataset.timeIndex = String(rowIndex);
      cell.addEventListener('click', onCellClick);
      cell.addEventListener('dragstart', onCellDragStart);
      cell.addEventListener('dragend', onCellDragEnd);
      cell.addEventListener('dragover', onCellDragOver);
      cell.addEventListener('drop', onCellDrop);
      board.appendChild(cell);
    });
  });

  paintBookings();
  updateNowIndicatorPosition();
}

function isTimeRangeFree(tableIndex, startTimeIndex, slotsCount, ignoreBookingId = null) {
  if (slotsCount < 1) return false;

  const maxSlots = getMaxSlotsFromStart(startTimeIndex);
  if (slotsCount > maxSlots) return false;

  const endTimeIndex = startTimeIndex + slotsCount;

  for (const booking of getBookingsForSelectedDate().values()) {
    if (booking.tableIndex !== tableIndex) continue;
    if (ignoreBookingId && booking.id === ignoreBookingId) continue;

    const bookingStart = booking.timeIndex;
    const bookingEnd = bookingStart + booking.durationSlots;
    const intersects = startTimeIndex < bookingEnd && endTimeIndex > bookingStart;

    if (intersects) return false;
  }

  return true;
}

function paintBookings() {
  const nowTimelineMinutes = getKaliningradBusinessTimelinePosition();

  document.querySelectorAll('.slot-cell').forEach((cell) => {
    cell.classList.remove('booked', 'booked-top', 'booked-bottom', 'dragging');
    cell.textContent = '';
    cell.removeAttribute('title');
    cell.draggable = false;
    cell.style.removeProperty('--booking-accent');
    cell.style.removeProperty('--booking-accent-deep');
    cell.removeAttribute('data-arrival-state');
    cell.classList.remove('extend-selected');
    delete cell.dataset.bookingId;
  });

  for (const booking of getBookingsForSelectedDate().values()) {
    const visualState = getBookingVisualState(booking, nowTimelineMinutes);
    const themeTokens = getBookingThemeTokens();
    const primaryToggleOffset = getPrimaryArrivalToggleOffset(booking.durationSlots);

    for (let i = 0; i < booking.durationSlots; i += 1) {
      const timeIndex = booking.timeIndex + i;
      const cell = document.querySelector(
        `.slot-cell[data-table-index="${booking.tableIndex}"][data-time-index="${timeIndex}"]`
      );
      if (!cell) continue;

      cell.classList.add('booked');
      cell.dataset.bookingId = booking.id;
      cell.draggable = !isExtendMode;
      cell.dataset.arrivalState = visualState;
      cell.style.setProperty('--booking-accent', themeTokens.accent);
      cell.style.setProperty('--booking-accent-deep', themeTokens.accentDeep);
      if (isExtendMode && booking.id === selectedExtendBookingId) {
        cell.classList.add('extend-selected');
      }

      if (i === 0) {
        cell.classList.add('booked-top');

        const header = document.createElement('span');
        header.className = 'booking-card-header';

        const text = document.createElement('span');
        text.className = 'booking-text';
        text.textContent = `${booking.name} (${booking.guests})`;

        const controls = document.createElement('span');
        controls.className = 'booking-card-controls';

        if (visualState === 'overdue') {
          const badge = document.createElement('span');
          badge.className = 'booking-alert-badge';
          badge.textContent = '!';
          badge.title = 'Гость не отмечен через 10 минут после начала брони';
          controls.append(badge);
        }

        header.append(text, controls);
        cell.append(header);

        if (booking.phone) {
          const note = document.createElement('span');
          note.className = 'booking-note';
          note.textContent = booking.phone;
          cell.append(note);
        }
      }

      if (i === primaryToggleOffset) {
        const centeredToggle = document.createElement('span');
        centeredToggle.className = 'booking-arrival-toggle booking-arrival-toggle-main';
        centeredToggle.dataset.bookingId = booking.id;
        centeredToggle.setAttribute('role', 'checkbox');
        centeredToggle.setAttribute('aria-checked', booking.arrivalStatus === 'active' ? 'true' : 'false');
        centeredToggle.title = booking.arrivalStatus === 'active' ? 'Гость активен' : 'Отметить гостя как пришедшего';
        cell.append(centeredToggle);
      }

      if (i === booking.durationSlots - 1) {
        cell.classList.add('booked-bottom');
      }

      const endMinutes = booking.startMinutes + booking.durationSlots * STEP_MINUTES;
      const phoneLine = booking.phone ? `${booking.phone}\n` : '';
      cell.title = `${booking.name}\n${phoneLine}Гостей: ${booking.guests}\nКомментарий: ${booking.comment || '-'}\n${minutesToLabel(booking.startMinutes)}-${minutesToLabel(endMinutes)}`;
    }
  }
}

function renderWaitlist() {
  waitlistItems.innerHTML = '';
  const entries = Array.from(getWaitlistForSelectedDate().values()).sort((left, right) => {
    return String(left.createdAt).localeCompare(String(right.createdAt));
  });

  if (entries.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'waitlist-empty';
    emptyState.textContent = 'На эту дату лист ожидания пуст.';
    waitlistItems.append(emptyState);
    return;
  }

  entries.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'waitlist-card';

    const content = document.createElement('div');

    const name = document.createElement('div');
    name.className = 'waitlist-name';
    name.textContent = entry.name;
    content.append(name);

    if (entry.phone) {
      const phone = document.createElement('div');
      phone.className = 'waitlist-phone';
      phone.textContent = entry.phone;
      content.append(phone);
    }

    if (entry.comment) {
      const comment = document.createElement('div');
      comment.className = 'waitlist-comment';
      comment.textContent = entry.comment;
      content.append(comment);
    }

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'waitlist-delete-btn';
    deleteButton.textContent = 'Удалить';
    deleteButton.addEventListener('click', () => {
      void deleteWaitlistEntryFromDatabase(entry);
    });

    card.append(content, deleteButton);
    waitlistItems.append(card);
  });
}

function formatDebugDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function getDebugEventLabel(eventType) {
  const labels = {
    booking_created: 'Создание',
    booking_updated: 'Обновление',
    booking_deleted: 'Удаление',
    booking_restored: 'Восстановление',
    arrival_toggled: 'Статус гостя',
    waitlist_created: 'Лист ожидания',
    waitlist_updated: 'Лист ожидания',
    waitlist_deleted: 'Лист ожидания'
  };
  return labels[eventType] || eventType || 'Событие';
}

function renderDebugView() {
  if (!IS_DEBUG_MODE) return;

  debugLocalQueue.innerHTML = '';
  debugDeletedBookings.innerHTML = '';
  debugEvents.innerHTML = '';
  const queue = getOpsQueue();
  const snapshot = getStoredSnapshot(selectedDate);

  if (queue.length === 0) {
    const emptyQueue = document.createElement('div');
    emptyQueue.className = 'debug-empty';
    emptyQueue.textContent = snapshot?.bookings?.length
      ? `Очередь пуста. Локальный слепок: ${snapshot.bookings.length} броней.`
      : 'Очередь пуста. Локального слепка на эту дату нет.';
    debugLocalQueue.append(emptyQueue);
  } else {
    queue.forEach((entry) => {
      const card = document.createElement('article');
      card.className = 'debug-card';

      const content = document.createElement('div');

      const title = document.createElement('div');
      title.className = 'debug-title';
      title.textContent = `${entry.type || 'operation'} · ${entry.status || 'pending'}`;
      content.append(title);

      const meta = document.createElement('div');
      meta.className = 'debug-meta';
      meta.textContent = [
        entry.date || '-',
        entry.payload?.name || entry.payload?.guest_name || entry.bookingId || '-',
        `retry ${Number(entry.retryCount) || 0}`
      ].join(' · ');
      content.append(meta);

      const comment = document.createElement('div');
      comment.className = 'debug-comment';
      comment.textContent = [
        entry.updatedAt ? `updated ${formatDebugDateTime(entry.updatedAt)}` : '',
        entry.eventId ? `event ${entry.eventId}` : 'legacy event',
        entry.lastError ? `error ${entry.lastError}` : ''
      ]
        .filter(Boolean)
        .join(' · ');
      content.append(comment);

      card.append(content);
      debugLocalQueue.append(card);
    });
  }

  if (debugDeletedBookingsCache.length === 0) {
    const emptyDeleted = document.createElement('div');
    emptyDeleted.className = 'debug-empty';
    emptyDeleted.textContent = 'Удаленных броней на эту дату нет.';
    debugDeletedBookings.append(emptyDeleted);
  } else {
    debugDeletedBookingsCache.forEach((booking) => {
      const card = document.createElement('article');
      card.className = 'debug-card';

      const content = document.createElement('div');

      const title = document.createElement('div');
      title.className = 'debug-title';
      title.textContent = `${booking.name || 'Без имени'} · стол ${getTableLabel(booking.tableIndex)}`;
      content.append(title);

      const meta = document.createElement('div');
      meta.className = 'debug-meta';
      meta.textContent = `${minutesToLabel(booking.startMinutes)} · ${booking.guests} гост. · удалено ${formatDebugDateTime(booking.deletedAt)}`;
      content.append(meta);

      if (booking.phone || booking.comment) {
        const comment = document.createElement('div');
        comment.className = 'debug-comment';
        comment.textContent = [booking.phone, booking.comment].filter(Boolean).join(' · ');
        content.append(comment);
      }

      const restoreButton = document.createElement('button');
      restoreButton.type = 'button';
      restoreButton.className = 'debug-restore-btn';
      restoreButton.textContent = 'Вернуть';
      restoreButton.addEventListener('click', () => {
        void restoreDeletedBookingFromDebug(booking.id);
      });

      card.append(content, restoreButton);
      debugDeletedBookings.append(card);
    });
  }

  if (debugEventsCache.length === 0) {
    const emptyEvents = document.createElement('div');
    emptyEvents.className = 'debug-empty';
    emptyEvents.textContent = 'Событий на эту дату пока нет.';
    debugEvents.append(emptyEvents);
    return;
  }

  debugEventsCache.forEach((eventRow) => {
    const card = document.createElement('article');
    card.className = 'debug-card';

    const content = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'debug-title';
    title.textContent = getDebugEventLabel(eventRow.event_type);
    content.append(title);

    const meta = document.createElement('div');
    meta.className = 'debug-meta';
    meta.textContent = [
      formatDebugDateTime(eventRow.server_created_at),
      eventRow.device_role || 'unknown',
      eventRow.apply_status || 'applied'
    ].join(' · ');
    content.append(meta);

    const payload = eventRow.payload || {};
    const payloadSummary = [payload.guest_name, payload.guest_phone, payload.guest_comment]
      .filter(Boolean)
      .join(' · ');
    if (payloadSummary) {
      const comment = document.createElement('div');
      comment.className = 'debug-comment';
      comment.textContent = payloadSummary;
      content.append(comment);
    }

    card.append(content);
    debugEvents.append(card);
  });
}

function setCurrentView(viewName) {
  currentView =
    viewName === 'debug' && IS_DEBUG_MODE
      ? 'debug'
      : viewName === 'waitlist'
        ? 'waitlist'
        : 'bookings';
  const isWaitlist = currentView === 'waitlist';
  const isDebug = currentView === 'debug';

  bookingsView.classList.toggle('hidden', isWaitlist || isDebug);
  waitlistView.classList.toggle('hidden', !isWaitlist);
  debugView.classList.toggle('hidden', !isDebug);
  bookingsViewBtn.classList.toggle('active', currentView === 'bookings');
  waitlistViewBtn.classList.toggle('active', isWaitlist);
  debugViewBtn.classList.toggle('active', isDebug);
  pageTitleLabel.textContent = isDebug
    ? 'История на'
    : isWaitlist
      ? 'Лист ожидания на'
      : 'Лист броней на';
  viewMenu.removeAttribute('open');

  if (isWaitlist) {
    setExtendMode(false);
    renderWaitlist();
  } else if (isDebug) {
    setExtendMode(false);
    renderDebugView();
    void loadDebugDataFromDatabase();
  } else {
    fitBoardToViewport();
    paintBookings();
    updateNowIndicatorPosition();
  }
}

function createBookingPayload(tableIndex, startTimeIndex, slotsCount, baseId = null) {
  return {
    id: baseId || crypto.randomUUID(),
    tableIndex,
    timeIndex: startTimeIndex,
    startMinutes: timeSlots[startTimeIndex],
    durationSlots: slotsCount,
    name: guestNameInput.value.trim(),
    phone: guestPhoneInput.value.trim(),
    comment: guestCommentInput.value.trim(),
    guests: guestCount,
    date: selectedDate,
    colorTheme: currentTheme,
    arrivalStatus: 'pending',
    arrivalMarkedAt: null
  };
}

function closeModalAndReset() {
  modal.close();
}

function resetModalState() {
  setModalMode('create');
  editingBookingId = null;
  activeSlot = null;
  guestCount = 1;
  durationSlots = getDefaultDurationSlots(0) || DEFAULT_DURATION_SLOTS;

  guestNameInput.value = '';
  guestPhoneInput.value = '';
  guestCommentInput.value = '';
  setCounter(guestsCountOutput, String(guestCount));
  setCounter(durationCountOutput, formatDurationFromSlots(durationSlots));
  selectedSlotText.textContent = '';
  updateArrivalToggleButton(null);
}

function initEvents() {
  applyTheme(currentTheme);
  debugViewBtn.classList.toggle('hidden', !IS_DEBUG_MODE);

  bookingDateInput.value = selectedDate;
  bookingDateInput.addEventListener('change', () => {
    selectedDate = bookingDateInput.value || getLocalISODate();
    selectedExtendBookingId = null;
    syncScheduleForSelectedDate();
    populateTimeSelect();
    void refreshSelectedDateData();
  });

  startTimeSelect.addEventListener('change', () => {
    const maxSlots = getMaxSlotsFromStart(getStartTimeIndex());
    const minSlots = getMinDurationSlots();
    durationSlots = clamp(durationSlots, minSlots, Math.max(maxSlots, minSlots));
    updateSlotInfo();
  });

  guestsMinusBtn.addEventListener('click', () => {
    guestCount = Math.max(1, guestCount - 1);
    setCounter(guestsCountOutput, String(guestCount));
  });

  guestsPlusBtn.addEventListener('click', () => {
    guestCount += 1;
    setCounter(guestsCountOutput, String(guestCount));
  });

  durationMinusBtn.addEventListener('click', () => {
    durationSlots = Math.max(getMinDurationSlots(), durationSlots - 1);
    updateSlotInfo();
  });

  durationPlusBtn.addEventListener('click', () => {
    const maxSlots = getMaxSlotsFromStart(getStartTimeIndex());
    const minSlots = getMinDurationSlots();
    if (maxSlots < minSlots) {
      selectedSlotText.textContent = transferModeActive
        ? 'Для переноса на это время недостаточно слотов.'
        : 'Для этого старта недостаточно времени до закрытия.';
      return;
    }
    durationSlots = Math.min(maxSlots, durationSlots + 1);
    updateSlotInfo();
  });

  paletteButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme);
      void saveThemeToDatabase(btn.dataset.theme);
    });
  });

  extendModeBtn.addEventListener('click', () => {
    setExtendMode(!isExtendMode);
  });

  bookingsViewBtn.addEventListener('click', () => {
    setCurrentView('bookings');
  });

  waitlistViewBtn.addEventListener('click', () => {
    setCurrentView('waitlist');
  });

  debugViewBtn.addEventListener('click', () => {
    setCurrentView('debug');
  });

  debugSyncRetryBtn.addEventListener('click', () => {
    void retryDebugSyncNow();
  });

  waitlistForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = waitlistNameInput.value.trim();
    if (!name) return;

    const entry = {
      id: crypto.randomUUID(),
      date: selectedDate,
      name,
      phone: waitlistPhoneInput.value.trim(),
      comment: waitlistCommentInput.value.trim(),
      createdAt: new Date().toISOString()
    };

    const saved = await saveWaitlistEntryToDatabase(entry);
    if (saved) waitlistForm.reset();
  });

  cancelBtn.addEventListener('click', closeModalAndReset);

  arrivalToggleBtn.addEventListener('click', async () => {
    if (modalMode !== 'view' || !editingBookingId) return;
    await toggleBookingArrivalStatus(editingBookingId);
    updateArrivalToggleButton(getBookingsForSelectedDate().get(editingBookingId) || null);
  });

  deleteBtn.addEventListener('click', async () => {
    if (modalMode !== 'view' || !editingBookingId) return;

    const booking = getBookingsForSelectedDate().get(editingBookingId);
    if (!booking) return;

    const deleted = await deleteBookingFromDatabase(booking);
    if (deleted) closeModalAndReset();
  });

  transferBtn.addEventListener('click', () => {
    if (modalMode !== 'view' || !activeSlot) return;

    populateTransferTables(activeSlot.tableIndex);
    transferModeActive = !transferModeActive;
    transferBox.classList.toggle('hidden', !transferModeActive);

    if (!transferModeActive) {
      const currentBooking = getBookingsForSelectedDate().get(editingBookingId);
      startTimeSelect.disabled = false;
      if (currentBooking) {
        startTimeSelect.value = String(currentBooking.timeIndex);
        durationSlots = currentBooking.durationSlots;
      }
      updateSlotInfo();
      return;
    }

    const currentBooking = getBookingsForSelectedDate().get(editingBookingId);
    if (!currentBooking) return;

    const transferStartIndex = currentBooking.timeIndex + currentBooking.durationSlots;
    if (transferStartIndex >= timeSlots.length - 1) {
      transferModeActive = false;
      transferBox.classList.add('hidden');
      selectedSlotText.textContent = 'Перенос невозможен: текущая бронь заканчивается в конце рабочего дня.';
      return;
    }

    startTimeSelect.value = String(transferStartIndex);
    startTimeSelect.disabled = true;
    durationSlots = 1;
    updateSlotInfo();
  });

  transferConfirmBtn.addEventListener('click', async () => {
    if (modalMode !== 'view' || !editingBookingId) return;

    const bookings = getBookingsForSelectedDate();
    const currentBooking = bookings.get(editingBookingId);
    if (!currentBooking) return;

    const targetTableIndex = Number(transferTableSelect.value);
    const targetStartIndex = currentBooking.timeIndex + currentBooking.durationSlots;
    const minTransferSlots = 1;

    if (!isTimeRangeFree(targetTableIndex, targetStartIndex, durationSlots)) {
      selectedSlotText.textContent = 'Нельзя перенести: новый стол занят или время выходит за сетку.';
      return;
    }

    if (durationSlots < minTransferSlots) {
      selectedSlotText.textContent = 'Минимальная длительность переноса: 30 минут.';
      return;
    }

    const transferred = {
      ...currentBooking,
      id: crypto.randomUUID(),
      tableIndex: targetTableIndex,
      timeIndex: targetStartIndex,
      startMinutes: timeSlots[targetStartIndex],
      durationSlots
    };

    const saved = await saveBookingToDatabase(transferred);
    if (saved) closeModalAndReset();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = guestNameInput.value.trim();
    const startTimeIndex = getStartTimeIndex();

    if (!name) return;

    const bookings = getBookingsForSelectedDate();

    if (modalMode === 'create') {
      if (!activeSlot) return;

      if (!isTimeRangeFree(activeSlot.tableIndex, startTimeIndex, durationSlots)) {
        selectedSlotText.textContent = 'Нельзя поставить бронь: интервал пересекается или выходит за время работы.';
        return;
      }

      const booking = createBookingPayload(activeSlot.tableIndex, startTimeIndex, durationSlots);
      const saved = await saveBookingToDatabase(booking);
      if (saved) closeModalAndReset();
      return;
    }

    if (modalMode === 'view' && editingBookingId) {
      const currentBooking = bookings.get(editingBookingId);
      if (!currentBooking) return;

      if (!isTimeRangeFree(currentBooking.tableIndex, startTimeIndex, durationSlots, editingBookingId)) {
        selectedSlotText.textContent = 'Нельзя обновить бронь: интервал пересекается или выходит за время работы.';
        return;
      }

      const updated = createBookingPayload(
        currentBooking.tableIndex,
        startTimeIndex,
        durationSlots,
        editingBookingId
      );
      updated.arrivalStatus = currentBooking.arrivalStatus || 'pending';
      updated.arrivalMarkedAt = currentBooking.arrivalMarkedAt || null;
      const saved = await saveBookingToDatabase(updated);
      if (saved) closeModalAndReset();
    }
  });

  modal.addEventListener('close', resetModalState);

  modal.addEventListener('click', (event) => {
    const modalContent = form.getBoundingClientRect();
    const clickedInside =
      event.clientX >= modalContent.left &&
      event.clientX <= modalContent.right &&
      event.clientY >= modalContent.top &&
      event.clientY <= modalContent.bottom;

    if (!clickedInside) {
      closeModalAndReset();
    }
  });

  window.addEventListener('resize', () => {
    fitBoardToViewport();
    updateNowIndicatorPosition();
  });

  window.addEventListener('online', () => {
    void flushBookingOpsQueue();
  });

  window.addEventListener('pagehide', persistAllBookingSnapshots);
  window.addEventListener('beforeunload', persistAllBookingSnapshots);
  window.addEventListener('pageshow', restoreSelectedDateFromLocalState);
  window.addEventListener('focus', restoreSelectedDateFromLocalState);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistAllBookingSnapshots();
      return;
    }
    restoreSelectedDateFromLocalState();
  });

  setInterval(() => {
    void flushBookingOpsQueue();
  }, BOOKING_SYNC_RETRY_INTERVAL_MS);

  setInterval(() => {
    void saveDeviceStateToDatabase();
  }, BOOKING_DEVICE_HEARTBEAT_INTERVAL_MS);

  setInterval(() => {
    paintBookings();
    updateNowIndicatorPosition();
  }, 30000);
}

async function startApp() {
  await initializeBookingLocalStore();
  populateTimeSelect();
  renderGrid();
  initEvents();
  await bootstrapBookingsSync();
}

void startApp();

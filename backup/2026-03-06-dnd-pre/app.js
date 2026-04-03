const TABLES = [
  { label: '1(6) PS5', ps5: true },
  { label: '2(5)', ps5: false },
  { label: '3(8) PS4', ps5: false },
  { label: '4(8) PS5', ps5: true },
  { label: '5(4)', ps5: false },
  { label: '6(6)', ps5: false },
  { label: '7(5)', ps5: false },
  { label: '8(5)', ps5: false },
  { label: '9(4)', ps5: false },
  { label: '10(2)', ps5: false },
  { label: '11(8)', ps5: false },
  { label: '12(3)', ps5: false },
  { label: '13(4)', ps5: false },
  { label: '14(6) PS5', ps5: true },
  { label: '15(4)', ps5: false }
];

const THEMES = {
  yellow: { accent: '#f8c9a1', accentDeep: '#f2b27f' },
  blue: { accent: '#b8d7f4', accentDeep: '#8fbce8' },
  purple: { accent: '#d9c2ef', accentDeep: '#bc9bdd' },
  green: { accent: '#cce8bf', accentDeep: '#a6d48f' }
};

const START_MINUTES = 12 * 60;
const END_MINUTES = 24 * 60;
const STEP_MINUTES = 30;
const MIN_DURATION_SLOTS = 4;
const KALININGRAD_TIMEZONE = 'Europe/Kaliningrad';

const board = document.getElementById('booking-board');
const nowIndicator = document.getElementById('now-indicator');
const nowLine = document.getElementById('now-line');
const nowBeacon = document.getElementById('now-beacon');
const modal = document.getElementById('booking-modal');
const form = document.getElementById('booking-form');
const modalTitle = document.getElementById('modal-title');
const selectedSlotText = document.getElementById('selected-slot');

const cancelBtn = document.getElementById('cancel-btn');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const transferBtn = document.getElementById('transfer-btn');
const transferBox = document.getElementById('transfer-box');
const transferConfirmBtn = document.getElementById('transfer-confirm');
const transferTableSelect = document.getElementById('transfer-table');

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

const paletteButtons = Array.from(document.querySelectorAll('.palette-btn'));

const timeSlots = [];
for (let minutes = START_MINUTES; minutes <= END_MINUTES; minutes += STEP_MINUTES) {
  timeSlots.push(minutes);
}

const bookingsByDate = new Map();

let selectedDate = getLocalISODate();
let currentTheme = 'yellow';

let modalMode = 'create';
let editingBookingId = null;
let activeSlot = null;
let guestCount = 1;
let durationSlots = MIN_DURATION_SLOTS;
let transferModeActive = false;

function getLocalISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  return Math.floor((END_MINUTES - startMinutes) / STEP_MINUTES);
}

function getMinDurationSlots() {
  return transferModeActive ? 1 : MIN_DURATION_SLOTS;
}

function setCounter(output, value) {
  output.textContent = value;
}

function getBookingsForSelectedDate() {
  if (!bookingsByDate.has(selectedDate)) {
    bookingsByDate.set(selectedDate, new Map());
  }
  return bookingsByDate.get(selectedDate);
}

function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES.yellow;
  currentTheme = THEMES[themeName] ? themeName : 'yellow';

  document.documentElement.style.setProperty('--accent', theme.accent);
  document.documentElement.style.setProperty('--accent-deep', theme.accentDeep);

  paletteButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === currentTheme);
  });
}

function fitBoardToViewport() {
  const wrapRect = board.parentElement.getBoundingClientRect();
  const fullWidth = Math.max(wrapRect.width, 320);
  const fullHeight = Math.max(wrapRect.height, 320);

  const firstColumnWidth = clamp(Math.floor(fullWidth * 0.07), 52, 86);
  const baseTableColumnWidth = clamp(
    Math.floor((fullWidth - firstColumnWidth) / TABLES.length),
    42,
    120
  );
  const headerRowHeight = clamp(Math.floor(fullHeight * 0.06), 30, 52);
  const baseSlotRowHeight = clamp(
    Math.floor((fullHeight - headerRowHeight) / timeSlots.length),
    14,
    36
  );

  const usedWidth = firstColumnWidth + baseTableColumnWidth * TABLES.length;
  const extraWidth = Math.max(0, Math.floor(fullWidth - usedWidth));
  const lastTableColumnWidth = baseTableColumnWidth + extraWidth;

  const usedHeight = headerRowHeight + baseSlotRowHeight * timeSlots.length;
  const extraHeight = Math.max(0, Math.floor(fullHeight - usedHeight));
  const lastSlotRowHeight = baseSlotRowHeight + extraHeight;

  board.style.gridTemplateColumns = `${firstColumnWidth}px repeat(${TABLES.length - 1}, ${baseTableColumnWidth}px) ${lastTableColumnWidth}px`;
  board.style.gridTemplateRows = `${headerRowHeight}px repeat(${timeSlots.length - 1}, ${baseSlotRowHeight}px) ${lastSlotRowHeight}px`;
}

function updateNowIndicatorPosition() {
  const firstSlotCell = document.querySelector('.slot-cell[data-table-index="0"][data-time-index="0"]');
  const lastSlotCell = document.querySelector(
    `.slot-cell[data-table-index="0"][data-time-index="${timeSlots.length - 1}"]`
  );

  if (!firstSlotCell || !lastSlotCell) {
    nowIndicator.classList.add('hidden');
    return;
  }

  const nowMinutes = getKaliningradMinutesNow();
  const nowLabel = getKaliningradTimeLabel();
  nowBeacon.dataset.nowTime = `Сейчас: ${nowLabel}`;
  nowBeacon.title = `Калининград: ${nowLabel}`;

  if (nowMinutes < START_MINUTES || nowMinutes > END_MINUTES) {
    nowIndicator.classList.add('hidden');
    return;
  }

  const slotsTop = firstSlotCell.offsetTop;
  const slotsBottom = lastSlotCell.offsetTop + lastSlotCell.offsetHeight;
  const slotsHeight = slotsBottom - slotsTop;
  const ratio = (nowMinutes - START_MINUTES) / (END_MINUTES - START_MINUTES);
  const y = slotsTop + slotsHeight * ratio;
  const tableStartX = firstSlotCell.offsetLeft;
  const tableWidth = board.clientWidth - tableStartX;

  nowIndicator.classList.remove('hidden');
  nowIndicator.style.top = `${y}px`;

  nowBeacon.style.left = '0';
  nowBeacon.style.width = `${tableStartX}px`;

  nowLine.style.left = `${tableStartX}px`;
  nowLine.style.width = `${tableWidth}px`;
}

function populateTimeSelect() {
  startTimeSelect.innerHTML = '';
  timeSlots.forEach((minutes, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = minutesToLabel(minutes);
    startTimeSelect.append(option);
  });
}

function populateTransferTables(currentTableIndex = -1) {
  transferTableSelect.innerHTML = '';
  TABLES.forEach((table, index) => {
    if (index === currentTableIndex) return;

    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = table.label;
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
}

function setModalMode(mode) {
  modalMode = mode;
  const viewMode = mode === 'view';
  transferModeActive = false;

  deleteBtn.classList.toggle('hidden', !viewMode);
  transferBtn.classList.toggle('hidden', !viewMode);
  transferBox.classList.add('hidden');
  startTimeSelect.disabled = false;

  saveBtn.textContent = viewMode ? 'Сохранить изменения' : 'Сохранить бронь';
  cancelBtn.textContent = viewMode ? 'Закрыть' : 'Отмена';
}

function openCreateModal(slot) {
  setModalMode('create');
  editingBookingId = null;
  activeSlot = slot;

  modalTitle.textContent = `Бронь: стол ${TABLES[slot.tableIndex].label}`;

  guestNameInput.value = '';
  guestPhoneInput.value = '';
  guestCommentInput.value = '';
  guestCount = 1;
  durationSlots = MIN_DURATION_SLOTS;

  setCounter(guestsCountOutput, String(guestCount));
  startTimeSelect.value = String(slot.timeIndex);
  updateSlotInfo();

  modal.showModal();
}

function openViewModal(booking) {
  setModalMode('view');
  editingBookingId = booking.id;
  activeSlot = { tableIndex: booking.tableIndex, timeIndex: booking.timeIndex };

  modalTitle.textContent = `Бронь: стол ${TABLES[booking.tableIndex].label}`;

  guestNameInput.value = booking.name;
  guestPhoneInput.value = booking.phone;
  guestCommentInput.value = booking.comment;
  guestCount = booking.guests;
  durationSlots = booking.durationSlots;

  setCounter(guestsCountOutput, String(guestCount));
  startTimeSelect.value = String(booking.timeIndex);
  populateTransferTables(booking.tableIndex);
  updateSlotInfo();

  modal.showModal();
}

function onCellClick(event) {
  const cell = event.currentTarget;

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

function renderGrid() {
  board.innerHTML = '';
  fitBoardToViewport();

  const corner = document.createElement('div');
  corner.className = 'cell head-cell time-cell corner-cell';
  corner.textContent = 'Стол / время';
  board.appendChild(corner);

  TABLES.forEach((table, index) => {
    const head = document.createElement('div');
    head.className = 'cell head-cell';
    if (index === TABLES.length - 1) head.classList.add('last-col');
    head.textContent = table.label;
    board.appendChild(head);
  });

  timeSlots.forEach((minutes, rowIndex) => {
    const timeCell = document.createElement('div');
    timeCell.className = 'cell time-cell';
    if (rowIndex === timeSlots.length - 1) timeCell.classList.add('last-row');
    timeCell.textContent = minutesToLabel(minutes);
    board.appendChild(timeCell);

    TABLES.forEach((_, tableIndex) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell slot-cell';
      if (tableIndex === TABLES.length - 1) cell.classList.add('last-col');
      if (rowIndex === timeSlots.length - 1) cell.classList.add('last-row');
      cell.dataset.tableIndex = String(tableIndex);
      cell.dataset.timeIndex = String(rowIndex);
      cell.addEventListener('click', onCellClick);
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
  document.querySelectorAll('.slot-cell').forEach((cell) => {
    cell.classList.remove('booked', 'booked-top', 'booked-bottom');
    cell.textContent = '';
    cell.removeAttribute('title');
    delete cell.dataset.bookingId;
  });

  for (const booking of getBookingsForSelectedDate().values()) {
    for (let i = 0; i < booking.durationSlots; i += 1) {
      const timeIndex = booking.timeIndex + i;
      const cell = document.querySelector(
        `.slot-cell[data-table-index="${booking.tableIndex}"][data-time-index="${timeIndex}"]`
      );
      if (!cell) continue;

      cell.classList.add('booked');
      cell.dataset.bookingId = booking.id;

      if (i === 0) {
        cell.classList.add('booked-top');

        const text = document.createElement('span');
        text.className = 'booking-text';
        text.textContent = `${booking.name} (${booking.guests})`;

        const note = document.createElement('span');
        note.className = 'booking-note';
        note.textContent = booking.phone;

        cell.append(text, note);
      }

      if (i === booking.durationSlots - 1) {
        cell.classList.add('booked-bottom');
      }

      const endMinutes = booking.startMinutes + booking.durationSlots * STEP_MINUTES;
      cell.title = `${booking.name}\n${booking.phone}\nГостей: ${booking.guests}\nКомментарий: ${booking.comment || '-'}\n${minutesToLabel(booking.startMinutes)}-${minutesToLabel(endMinutes)}`;
    }
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
    colorTheme: currentTheme
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
  durationSlots = MIN_DURATION_SLOTS;

  guestNameInput.value = '';
  guestPhoneInput.value = '';
  guestCommentInput.value = '';
  setCounter(guestsCountOutput, String(guestCount));
  setCounter(durationCountOutput, formatDurationFromSlots(durationSlots));
  selectedSlotText.textContent = '';
}

function initEvents() {
  applyTheme(currentTheme);

  bookingDateInput.value = selectedDate;
  bookingDateInput.addEventListener('change', () => {
    selectedDate = bookingDateInput.value || getLocalISODate();
    paintBookings();
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
        : 'Для этого старта недостаточно времени до закрытия (минимум 2 часа).';
      return;
    }
    durationSlots = Math.min(maxSlots, durationSlots + 1);
    updateSlotInfo();
  });

  paletteButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme);
      paintBookings();
    });
  });

  cancelBtn.addEventListener('click', closeModalAndReset);

  deleteBtn.addEventListener('click', () => {
    if (modalMode !== 'view' || !editingBookingId) return;

    getBookingsForSelectedDate().delete(editingBookingId);
    paintBookings();
    closeModalAndReset();
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
    if (transferStartIndex >= timeSlots.length) {
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

  transferConfirmBtn.addEventListener('click', () => {
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

    bookings.set(transferred.id, transferred);
    paintBookings();
    closeModalAndReset();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = guestNameInput.value.trim();
    const phone = guestPhoneInput.value.trim();
    const startTimeIndex = getStartTimeIndex();

    if (!name || !phone) return;

    const bookings = getBookingsForSelectedDate();

    if (modalMode === 'create') {
      if (!activeSlot) return;

      if (!isTimeRangeFree(activeSlot.tableIndex, startTimeIndex, durationSlots)) {
        selectedSlotText.textContent = 'Нельзя поставить бронь: интервал пересекается или выходит за время работы.';
        return;
      }

      const booking = createBookingPayload(activeSlot.tableIndex, startTimeIndex, durationSlots);
      bookings.set(booking.id, booking);
      paintBookings();
      closeModalAndReset();
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
      bookings.set(updated.id, updated);
      paintBookings();
      closeModalAndReset();
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

  setInterval(() => {
    updateNowIndicatorPosition();
  }, 30000);
}

populateTimeSelect();
renderGrid();
initEvents();

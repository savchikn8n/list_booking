# Booking Sync Hardening Design

## Goal

Сделать лист броней безопасным для реальной смены: все действия с планшета должны сохраняться, досинхронизироваться и оставлять восстановимую историю даже при плохой сети, быстрой посадке, быстрых create/delete, reload, sleep/wake планшета и ошибках Supabase Realtime.

Главный UX-принцип: администратор не должен думать о синхронизации. Основной интерфейс остаётся простым: создать, удалить, перенести, отредактировать бронь и сменить общий цвет дня. Никаких технических алертов, баннеров про pending/failed sync или требований “не закрывать страницу” в обычном режиме.

## User Model

- `operator/admin`: базовый пользователь зала. Работает только с бронями и листом ожидания. Не видит технических статусов синхронизации.
- `developer/admin-debug`: владелец/разработчик. Может открыть скрытую диагностику, смотреть очередь, события, расхождения, replay, device state и историю восстановления.

Планшет остаётся primary operational device: всё, что оператор ввёл на планшете, считается операционной правдой и не должно исчезнуть из-за сетевой гонки или устаревшего ответа Supabase.

Ноутбук разработчика не является read-only. Он может иметь полный доступ и admin override, но такие действия должны быть явно помечены как пришедшие с developer/admin device.

## Current Risks

### Physical Deletes Lose Evidence

Текущая модель удаляет записи из `booking_sheet_bookings`. Если бронь была создана и удалена, или удаление пришло в Supabase раньше/позже ожидаемого, за прошлый день остаётся мало доказательств того, что реально произошло.

Risk: за вчера или позавчера невозможно надёжно ответить, брони не было, она не досинхронизировалась, была удалена или была перезаписана.

### Current State Table Is Not History

`booking_sheet_bookings` хранит текущую картину дня, а не журнал действий. Для операционного инструмента этого недостаточно: важна не только итоговая сетка, но и факт каждого create/update/delete.

Risk: при ошибке порядка операций или сетевом retry можно потерять причинно-следственную историю.

### Realtime Is Not Persistence

Зелёный Realtime-индикатор означает подключение к каналу, но не доказывает, что все локальные операции планшета уже применены в Supabase.

Risk: UI может выглядеть здоровым, пока сервер отстаёт от планшета.

### Browser Lifecycle Can Delay Sync

Планшетный браузер может уйти в background, потерять сеть, перезагрузиться или задержать таймеры. Даже IndexedDB не отправляет данные сам по себе; он только надёжно хранит локальную очередь.

Risk: операция безопасно лежит на планшете, но ещё не попала на сервер.

### Waitlist Has Weaker Guarantees

Текущая durable queue была сделана для броней. Лист ожидания пока не имеет такой же модели событий, replay и восстановления.

Risk: waitlist может вести себя менее надёжно, чем основная сетка.

### RLS Is Too Open For Public Clients

Текущие Supabase policies разрешают anon-клиенту широкие insert/update/delete. Это удобно для простого статического приложения, но рискованно для публичного URL.

Risk: любой, кто получил клиентский ключ и URL проекта, потенциально может менять данные напрямую.

## Target Architecture

### Append-Only Event Log

Добавить таблицу `booking_sheet_events`. Каждое действие записывается как неизгладимое событие:

- `booking_created`
- `booking_updated`
- `booking_deleted`
- `booking_restored`
- `arrival_toggled`
- later: `waitlist_created`, `waitlist_updated`, `waitlist_deleted`

Событие содержит:

- `event_id`: UUID, создаётся на клиенте и делает retry идемпотентным.
- `booking_id`: UUID брони.
- `booking_date`: дата операционного дня.
- `event_type`: тип действия.
- `payload`: JSONB с данными действия.
- `device_id`: устойчивый id устройства.
- `device_role`: `primary_tablet`, `developer_admin`, `viewer`, etc.
- `client_created_at`: время на устройстве.
- `server_created_at`: время Supabase.
- `client_sequence`: локальный номер события на устройстве.

Приложение не удаляет строки из event log.

### Soft Delete For Bookings

`booking_sheet_bookings` становится current-state projection. Удаление брони не делает SQL `delete`; вместо этого:

- `deleted_at`
- `deleted_by_device_id`
- `deleted_by_event_id`

Основной UI фильтрует удалённые брони и не показывает их оператору. Developer/debug view может показывать удалённые записи и историю.

### Atomic Apply Function

Добавить Supabase RPC `booking_sheet_apply_event(event jsonb)`.

Один вызов должен:

1. проверить, нет ли уже `event_id`;
2. вставить событие в `booking_sheet_events`;
3. применить событие к `booking_sheet_bookings`;
4. вернуть результат применения.

Это устраняет состояние “event записался, booking не обновился” или наоборот.

### Idempotent Local Queue

IndexedDB остаётся локальным durable storage. Очередь хранит события, а не только upsert/delete текущего состояния.

Правила:

- событие не удаляется из локальной очереди до подтверждения RPC;
- retry одного `event_id` безопасен;
- более свежие события планшета не удаляются устаревшими ответами старых запросов;
- при reload очередь восстанавливается из IndexedDB и продолжает отправку.

### Silent Operator UX

Обычный пользователь не видит:

- sync failed;
- pending queue;
- server mismatch;
- Realtime unavailable;
- recovery/replay progress.

Вместо алертов система должна работать в фоне:

- сохранять событие локально мгновенно;
- продолжать retry;
- не терять действие;
- не блокировать создание следующих броней.

Техническая диагностика доступна только в скрытом developer mode, например через URL-флаг, секретный жест, dev-кнопку на ноутбуке или отдельную локальную страницу. Это не часть обычного рабочего UI.

### Background Watchdog

Watchdog не показывает обычному оператору алерты. Он пишет состояние в debug/meta storage:

- pending events count;
- oldest pending age;
- failed event count;
- last successful sync;
- server count by date;
- local count by date;
- primary tablet heartbeat.

Developer/debug mode может показывать это явно. Обычный UI может оставить маленький нейтральный sync-dot, но без сообщений и без необходимости действия со стороны оператора.

### Device State

Добавить `booking_sheet_device_state`:

- `device_id`
- `device_role`
- `selected_date`
- `last_seen_at`
- `local_pending_count`
- `oldest_pending_at`
- `last_successful_sync_at`
- `app_version`

Планшет пишет heartbeat в фоне. Ноутбук разработчика может видеть состояние планшета и понимать, есть ли локальные pending-события.

## Previous Days Recovery

Для восстановления прошлых дней использовать event log как источник доказательств.

Сценарии:

- Если current-state table за день пуста, но events есть, developer может replay/rebuild projection.
- Если бронь была удалена, developer видит `booking_deleted`, а не пустоту.
- Если событие создалось на планшете, но ещё не дошло до Supabase, оно остаётся в IndexedDB и будет отправлено при следующем запуске/сети.

Дополнительно можно добавить developer action `rebuild day from events`, который пересобирает `booking_sheet_bookings` для выбранной даты из `booking_sheet_events`.

## Sync Timing

Цель: не “пинг раз в минуту”, а “каждое действие либо применено на сервере быстро, либо надёжно лежит локально и ретраится”.

Recommended timing:

- immediate flush after every local event;
- retry pending events every 2-5 seconds while page is active;
- heartbeat every 15-30 seconds;
- background visibility/focus/pagehide hooks flush local queue;
- developer watchdog marks pending older than 60 seconds as degraded in debug state;
- pending older than 120 seconds remains queued and visible only in developer diagnostics.

Операторский UI не должен показывать эти degraded states.

## Supabase Security Direction

Current anon write policies should be replaced or narrowed after RPC migration.

Target:

- direct table writes from anon are removed or restricted;
- anon can call only controlled RPC functions needed by the app;
- event table is append-only from client perspective;
- current-state projection is changed only by RPC;
- delete is represented as soft delete.

This reduces accidental and hostile direct mutation risk.

## Migration Plan

### Phase 1: Design And Observability

- Keep current UI unchanged.
- Add this design document.
- Confirm table names and project link.
- Prepare migration files, but do not apply destructive changes.

### Phase 2: Database Hardening Foundation

- Add `booking_sheet_events`.
- Add soft-delete fields to `booking_sheet_bookings`.
- Add device metadata fields if missing.
- Add `booking_sheet_device_state`.
- Keep old columns and flows working.

### Phase 3: RPC Event Apply

- Add `booking_sheet_apply_event`.
- Support create/update/delete/arrival events.
- Make repeated `event_id` safe.
- Add SQL-level tests or verification queries.

### Phase 4: Client Event Queue

- Change local queue entries from current-state operations to events.
- Keep IndexedDB as durable storage.
- Flush via RPC.
- Keep old queue migration path for existing pending upsert/delete operations.

### Phase 5: Operator-Silent Watchdog

- Record sync health in local debug state and `booking_sheet_device_state`.
- Do not show operator alerts.
- Add hidden developer diagnostics.

### Phase 6: Recovery Tools

- Add developer-only history view.
- Add rebuild selected day from event log.
- Add restore deleted booking from event history.

### Phase 7: Waitlist Parity

- Move waitlist to the same event-log and soft-delete model.

## Success Criteria

- Creating, editing, moving, extending and deleting bookings works the same for the operator.
- Fast create/delete creates durable local events and eventually applies both to Supabase in correct order.
- No booking disappears without a corresponding event in `booking_sheet_events`.
- Deleted bookings remain recoverable by developer tools.
- Previous days can be audited from event history.
- Normal admin UI remains simple and free of technical sync messages.
- Developer can inspect sync health when needed.

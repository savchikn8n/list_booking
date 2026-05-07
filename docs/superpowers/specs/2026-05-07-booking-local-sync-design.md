# Booking Local Sync Design

## Goal

Убрать ситуацию, когда бронь уже записана в Supabase, но после reload пользователь временно видит пустой или устаревший лист. Интерфейс должен вести себя как автономное веб-приложение: мгновенно показывать изменения, переживать reload и досинхронизироваться с сервером без потери введённых данных.

Этот проход касается только `booking_sheet_bookings`. `waitlist` остаётся как есть.

## Recommended Approach

Использовать `optimistic UI + durable local queue`:

- после `create/update/delete` сразу менять UI
- сразу сохранять локальный snapshot выбранной даты
- сразу класть операцию в очередь синка
- отдельно отправлять операцию в Supabase
- после reload сначала восстанавливать локальный snapshot, потом запускать reconcile с сервером

Это даёт быстрый UX под плохую сеть и убирает зависимость UI от скорости `select/realtime`.

## Local Persistence Model

Хранилище: `localStorage`.

Ключи:

- `booking_snapshot:<date>`
- `booking_ops_queue`
- `booking_sync_meta`

`booking_snapshot:<date>` содержит:

- `date`
- `bookings`
- `lastFetchedAt`
- `lastMutationAt`

`booking_ops_queue` содержит массив операций:

- `opId`
- `type` = `create | update | delete`
- `bookingId`
- `date`
- `payload`
- `status` = `pending | syncing | failed`
- `retryCount`
- `updatedAt`

`booking_sync_meta` содержит:

- `activeDate`
- `lastGlobalSyncAt`

## Runtime Behavior

### Save Flow

При любом изменении брони:

1. применить изменение к локальному snapshot дня
2. перерисовать UI немедленно
3. записать snapshot в `localStorage`
4. добавить или обновить операцию в `booking_ops_queue`
5. отправить операцию в Supabase

### Success Path

После успешного ответа Supabase:

1. удалить операцию из очереди
2. отметить бронь как `synced`
3. обновить `lastSyncedAt/lastGlobalSyncAt`
4. сохранить новый snapshot

### Failure Path

Если запрос в Supabase не удался:

1. бронь остаётся на экране
2. операция остаётся в очереди как `failed` или `pending`
3. UI показывает ненавязчивый статус о несинхронизированных изменениях
4. повторная отправка запускается:
   - при старте страницы
   - при смене даты
   - по таймеру
   - по событию `online`

## Reload Behavior

При загрузке страницы:

1. восстановить snapshot выбранной даты из `localStorage`
2. сразу отрисовать его
3. поднять `booking_ops_queue`
4. попытаться повторно отправить pending/failed операции
5. запросить актуальные данные дня из Supabase
6. выполнить reconcile

Ключевое правило:

`пустой fetch не должен затирать локальные pending записи`

## Reconcile Rules

- серверная запись заменяет локальную, если локально нет pending-операций для этого `bookingId`
- локальная pending-запись не затирается обычным fetch-ответом, пока операция не подтверждена или явно не отклонена
- если сервер удалил бронь и локально нет pending-операции, бронь удаляется из snapshot
- если локально есть pending `create`, а сервер её ещё не вернул, запись остаётся видимой как `pending`

Базовое правило: `server wins`, кроме локальных `pending`.

## UI States

Для броней добавить локальный sync-state:

- `synced`
- `pending`
- `failed`

Для экрана добавить общий индикатор:

- есть несинхронизированные изменения
- идёт повторная отправка

Индикатор должен быть информативным, но не блокирующим ввод.

## Architecture Boundaries

Нужно выделить отдельный локальный слой синка, а не размазывать логику по обработчикам формы:

- snapshot storage
- operations queue
- reconcile logic
- sync scheduler/retry

Текущий `app.js` можно сначала расширить этими модулями в том же файле, но границы должны быть выделены функциями с понятными интерфейсами. Если код станет слишком большим, следующим шагом вынести их в отдельные файлы.

## Testing

Минимум проверки:

- create/update/delete видны сразу без ожидания сервера
- после reload snapshot восстанавливается до завершения fetch
- pending операции не пропадают после reload
- успешный sync очищает queue
- failed sync не удаляет бронь с экрана
- reconcile не затирает pending локальные изменения пустым серверным ответом

## Scope

Входит:

- локальный snapshot для броней
- очередь операций для броней
- reconcile при startup/reload
- retry механика
- UI-индикатор pending sync

Не входит:

- offline-first для `waitlist`
- IndexedDB
- гостевая база и autocomplete
- переработка Supabase-схемы сверх нужного для броней

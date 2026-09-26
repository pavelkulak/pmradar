# PM Chat Inbox

Внутренний дашборд, который показывает непросмотренные сообщения в выбранных рабочих чатах Telegram и MAX. Приложение хранит только идентификаторы событий и временные метки. Тексты, вложения и сведения об отправителях не записываются. Дашборд не отправляет сообщения и не меняет read/unread в мессенджерах.

Стек: Next.js 16, TypeScript, PostgreSQL, Prisma, Docker Compose и Caddy.

## Быстрый запуск для разработки

1. Установите Node.js 22 и PostgreSQL 17.
2. Скопируйте `.env.example` в `.env` и задайте `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL` и секреты webhook. `SESSION_SECRET` должен содержать не менее 32 символов.
3. Установите зависимости и примените миграцию:

   ```sh
   npm ci
   npm run db:generate
   npm run db:migrate:dev
   npm run create-admin
   npm run dev
   ```

4. Откройте `http://localhost:3000`.

`create-admin` интерактивно спрашивает email и пароль, не показывает пароль при вводе и хранит только bcrypt-хэш.

## Production на чистом VPS

На VPS установите Docker Engine и Docker Compose plugin, затем:

1. Создайте A/AAAA DNS-запись домена, например `pm.example.com`, указывающую на VPS. Убедитесь, что порты 80 и 443 доступны снаружи.
2. Клонируйте репозиторий и перейдите в его каталог.
3. Создайте `.env` на основе `.env.example`. Укажите один и тот же hostname в `APP_DOMAIN` и `APP_URL`, например `APP_DOMAIN=pm.example.com` и `APP_URL=https://pm.example.com`. Используйте пароль БД, состоящий из URL-безопасных символов, например hex-строку. Сгенерируйте секрет с помощью `openssl rand -hex 32`; задайте Telegram/MAX токены и webhook secrets. Секрет MAX должен содержать от 5 до 256 символов из `A-Z`, `a-z`, цифр, `_` и `-`.
4. Запустите сервисы:

   ```sh
   docker compose up -d --build
   docker compose ps
   ```

   Compose запускает PostgreSQL, применяет Prisma migrations перед стартом приложения и поднимает Caddy. Снаружи опубликованы только 80/443; PostgreSQL и Next.js доступны только во внутренней сети Compose. Данные PostgreSQL и сертификаты Caddy хранятся в persistent volumes.

5. Создайте admin учётную запись без передачи пароля в аргументах командной строки:

   ```sh
   docker compose exec app node scripts/create-admin.mjs
   ```

   Или запустите `npm run create-admin` из локального клона с тем же `DATABASE_URL`.

6. Зарегистрируйте webhook-и:

   ```sh
   docker compose exec app node scripts/setup-telegram.mjs
   docker compose exec app node scripts/setup-max.mjs
   ```

   Скрипты проверяют итоговую подписку и не печатают bot token. Telegram бот должен получать обычные сообщения из группы: отключите Group Privacy у BotFather или назначьте бота администратором группы. В MAX добавьте бота в рабочие чаты через MAX UI. Приложение не добавляет ботов в чаты.

7. Проверьте `https://pm.example.com/health` — успешный ответ: `{"status":"ok"}`. Добавьте Telegram-бота и MAX-бота в тестовые рабочие чаты, отправьте новое сообщение и убедитесь, что карточки появились в разделе «Требуют внимания».
8. Откройте чат в мессенджере и нажмите «Ознакомился»; следующее сообщение должно снова пометить чат как непросмотренный.

Если пароль `POSTGRES_PASSWORD` изменяется после первого запуска, обновите пароль пользователя также в существующей базе: переменная Postgres применяется только при первоначальной инициализации volume.

## Webhook и API

- `POST /webhooks/telegram` — проверяет `X-Telegram-Bot-Api-Secret-Token`, принимает новые group/supergroup `message` updates.
- `POST /webhooks/max` — проверяет `X-Max-Bot-Api-Secret`, принимает `message_created`.
- `GET /health` — проверяет процесс и соединение PostgreSQL, не требует авторизации.
- `GET /api/chats` — список включённых чатов и число событий после `acknowledgedThroughSeq`.
- `POST /api/chats/:id/acknowledge` — принимает `{ "throughSeq": "100" }` и не может подтвердить события выше переданной последовательности.

Дубликаты блокируются уникальным индексом по `(platform, platformEventId)`. Подтверждение обновляет `acknowledgedThroughSeq` транзакционно, а счётчик unread считается по журналу `MessageEvent`. Telegram использует `update_id`; MAX — пару chat/message ID. Тело webhook обрабатывается в памяти и не логируется.

Приложение опрашивает список чатов каждые 15 секунд и при возврате вкладки в фокус. Bot API вызываются только на сервере. Секреты не попадают в браузер, базу данных или application logs.

## Регистрация интеграций вручную

Скрипты можно запускать на хосте после настройки `.env`:

```sh
npm run setup:telegram
npm run setup:max
```

Telegram регистрируется через `setWebhook` с `allowed_updates: ["message", "my_chat_member"]`. MAX использует `https://platform-api2.max.ru/subscriptions` и события `message_created`, `bot_added`, `bot_removed`, `bot_admin_permissions_changed`.

`setup-telegram.mjs` устанавливает webhook через `setWebhook` и проверяет его через `getWebhookInfo`. `setup-max.mjs` регистрирует и проверяет подписку MAX.

## Резервное копирование PostgreSQL

На VPS из каталога Compose настройте ежедневный запуск (например, cron) команды:

```sh
mkdir -p backups
docker compose exec -T postgres pg_dump -U pm_inbox -Fc pm_inbox > "backups/pm-inbox-$(date +%F).dump"
find backups -type f -name 'pm-inbox-*.dump' -printf '%T@ %p\n' | sort -rn | tail -n +8 | cut -d' ' -f2- | xargs -r rm -f
```

Храните семь последних ежедневных файлов и копируйте их за пределы VPS. Восстановление из выбранного файла:

```sh
cat backups/pm-inbox-YYYY-MM-DD.dump | docker compose exec -T postgres pg_restore --clean --if-exists -U pm_inbox -d pm_inbox
```

## Проверки

```sh
npm test
npm run typecheck
npm run build
```

Обычный запуск `npm test` проверяет предметную логику и пропускает PostgreSQL acceptance suite. Чтобы выполнить database-backed сценарии A–I, задайте `RUN_DB_INTEGRATION=1` и `DATABASE_URL` для отдельной тестовой БД, примените migrations, затем запустите `npm test`. Для живой проверки доставки нужны реальные Telegram/MAX bot tokens и тестовые чаты; тестовые секреты и сообщения используйте только в staging.

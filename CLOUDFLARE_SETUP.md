# Инструкция по переходу на Cloudflare Pages

Мы подготовили ваш проект для работы на Cloudflare Pages. Теперь вам нужно настроить деплой на сайте Cloudflare.

## Шаг 1: Подготовка GitHub
1. Убедитесь, что все последние изменения (включая папку `functions`, которую мы только что создали) отправлены в ваш репозиторий на GitHub.

## Шаг 2: Настройка на Cloudflare
1. Зайдите на [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. В меню слева выберите **Workers & Pages**.
3. Нажмите кнопку **Create application** (или **Create**).
4. Перейдите на вкладку **Pages**.
5. Нажмите **Connect to Git**.
6. Выберите ваш репозиторий `animestream` (или как он у вас называется).
7. Нажмите **Begin setup**.

## Шаг 3: Настройка сборки (Build Settings)
Cloudflare обычно автоматически определяет настройки, но проверьте их:

*   **Project name:** `animestream` (или любое другое)
*   **Production branch:** `main` (или ваша основная ветка)
*   **Framework preset:** `Vite` (выберите из списка)
*   **Build command:** `npm run build` (или `vite build`)
*   **Build output directory:** `dist`

## Шаг 4: Переменные окружения (Environment Variables)
Если вы используете какие-то секретные ключи (например, для Supabase), добавьте их в разделе **Environment variables**.
*   На данный момент в коде нет явных `process.env` секретов для прокси, но если они появятся, добавьте их здесь.

## Шаг 5: Завершение
1. Нажмите **Save and Deploy**.
2. Дождитесь окончания сборки.
3. После успешного деплоя вы получите URL вида `https://animestream.pages.dev`.

## Проверка
После деплоя проверьте:
1.  Открывается ли сайт.
2.  Работает ли каталог (запросы к Shikimori идут через `/api/shikimori`).
3.  Работает ли плеер (запросы к Kodik идут через `/kodik-proxy`).
4.  Открывается ли `/sitemap.xml`.

## Важно
Файл `server.ts` и папка `api/` теперь используются **только для локальной разработки** (`npm run dev`). На Cloudflare Pages работает папка `functions/`.

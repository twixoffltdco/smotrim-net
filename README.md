# Smotrim.net — Онлайн ТВ платформа

## 📁 Структура файлов

```
smotrim-net/
├── index.html              ← Главная страница
├── about.html              ← О проекте (SEO)
├── 404.html                ← Страница ошибки
├── sitemap.xml             ← Sitemap-индекс для поисковиков
├── sitemap-main.xml        ← Статические страницы
├── sitemap-generator.html  ← Авто-генератор sitemap по каналам
├── robots.txt              ← Инструкции для поисковых роботов
├── manifest.json           ← PWA манифест
├── favicon.svg             ← Иконка сайта
├── .htaccess               ← Apache: URL-роутинг, кэш, безопасность
├── css/
│   └── style.css           ← Все стили
├── js/
│   └── app.js              ← Логика: API, плеер, пагинация, SEO
└── pages/
    ├── watch.html          ← Страница канала (с SEO на каждый канал)
    └── iptv-player.html    ← IPTV PlayerJS плеер для IPTV.org потоков
```

## 🚀 Деплой

### Авто-подстановка домена для SEO файлов
Чтобы `robots.txt`, `sitemap.xml` и `sitemap-main.xml` автоматически подхватывали новый домен без ручной правки, запускайте генератор перед деплоем:

```bash
SITE_ORIGIN="https://ваш-домен.tld" node scripts/generate-seo-files.mjs
```

Если `SITE_ORIGIN` не передан, скрипт пытается взять домен из переменных `URL`, `DEPLOY_PRIME_URL`, `VERCEL_URL`.

### На хостинг с Apache (.htaccess поддержка):
1. Загрузите все файлы на хостинг через FTP/SFTP или панель управления
2. Убедитесь что `mod_rewrite` включён в Apache
3. Настройте SSL сертификат (Let's Encrypt)
4. Измените домен `smotrim.net` на ваш во всех файлах

### На Nginx:
Добавьте в конфиг:
```nginx
server {
    listen 443 ssl;
    server_name smotrim.net www.smotrim.net;
    root /var/www/smotrim-net;
    index index.html;

    location /watch/ {
        try_files $uri $uri/ /pages/watch.html;
    }

    location ~ ^/(tv|radio|iptv)$ {
        try_files $uri $uri/ /index.html;
    }

    location / {
        try_files $uri $uri.html $uri/ =404;
    }
}
```

### Vercel / Netlify:
Добавьте файл `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/watch/:slug", "destination": "/pages/watch.html" },
    { "source": "/tv", "destination": "/index.html" },
    { "source": "/radio", "destination": "/index.html" },
    { "source": "/iptv", "destination": "/index.html" }
  ]
}
```

## 🔍 SEO — что сделано

- **robots.txt** — разрешён весь сайт, запрещены API-эндпоинты
- **sitemap.xml** — индекс всех карт сайта
- **sitemap-main.xml** — статические страницы
- **sitemap-generator.html** — открой в браузере → нажми кнопку → скачает sitemap с каналами
- **Schema.org** — разметка BroadcastEvent, WebSite, SearchAction
- **Open Graph + Twitter Card** — превью в соцсетях
- **Canonical URLs** — нет дублей
- **Уникальные title/description** для каждого канала
- **Хлебные крошки** на страницах каналов
- **PWA манифест** — сайт устанавливается как приложение

## 🔄 Автообновление каналов

Каналы обновляются через 5 минут в `app.js`:
```js
CONFIG.refreshInterval: 5 * 60 * 1000
```

Только каналы от: `oinktech`, `Twixoff`, `ТВКАНАЛЫ`

## 📡 API источники

- **StreamLiveTV**: `https://aqeleulwobgamdffkfri.supabase.co/functions/v1/public-channels`
- **Embed**: `https://stlivetv.tatnet.app/embed/{id}`
- **IPTV.org**: `https://iptv-org.github.io/api/streams.json` + `channels.json` (склейка метаданных)
- **IPTV Player**: `/pages/iptv-player.html` (PlayerJS на базе OinkTechLtd/cdnplayerjs)

## 🔧 Кастомизация

Домен — замените `smotrim.net` на свой во всех файлах:
```bash
grep -r "smotrim.net" . --include="*.html" --include="*.xml" --include="*.txt"
```

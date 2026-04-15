# Добрые дела — обновлённый дизайн

В этой версии:
- публичная страница открывается сразу на `/dela/`;
- на публичной части нет упоминаний об админке;
- админка вынесена отдельно в `/admin/`;
- дизайн переделан в стиле ленты историй: крупная форма, карточки как у story/community сайтов, более чистая подача.

## Структура

- `/` — редирект на `/dela/`
- `/dela/` — публичная страница
- `/admin/` — закрытая страница модерации

## Что заполнить

Откройте `config.js` в корне проекта и вставьте:

```js
export const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_PUBLISHABLE_KEY';
export const ADMIN_EMAIL = 'admin@example.com';
```

## Что уже должно быть в Supabase

Нужны:
- таблица `deeds`
- таблица `deed_likes`
- таблица `admin_users`
- функция `like_deed(uuid, text)`
- функция `is_admin()`

Если вы уже выполняли `supabase.sql`, то структура подходит.

## Запуск локально

### Через VS Code
- Откройте папку проекта.
- Установите расширение Live Server.
- Запустите `dela/index.html` или корневой `index.html`.

### Через Python

```bash
python -m http.server 5500
```

Потом откройте:

- `http://localhost:5500/`
- `http://localhost:5500/dela/`
- `http://localhost:5500/admin/`

## Публикация на GitHub Pages

В корень репозитория должны быть загружены именно файлы проекта, а не папка с проектом.

Правильно:

```text
index.html
config.js
config.example.js
.nojekyll
assets/
dela/
admin/
supabase.sql
README.md
```

После загрузки:
- GitHub → Settings → Pages
- Source → Deploy from a branch
- Branch → `main`
- Folder → `/ (root)`

Ссылки будут такими:
- `https://USERNAME.github.io/REPO/`
- `https://USERNAME.github.io/REPO/dela/`
- `https://USERNAME.github.io/REPO/admin/`

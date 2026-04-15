import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL } from '../config.js';

export const configReady =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  Boolean(ADMIN_EMAIL) &&
  !SUPABASE_URL.includes('PASTE_YOUR_SUPABASE_URL_HERE') &&
  !SUPABASE_ANON_KEY.includes('PASTE_YOUR_SUPABASE_ANON_KEY_HERE') &&
  !ADMIN_EMAIL.includes('PASTE_YOUR_ADMIN_EMAIL_HERE');

export function ensureConfigOrRender() {
  if (configReady) return true;

  document.body.innerHTML = `
    <div style="max-width:720px;margin:48px auto;padding:24px;font-family:Inter,system-ui,sans-serif;line-height:1.7;">
      <h1 style="margin:0 0 12px;">Нужно заполнить config.js</h1>
      <p style="margin:0 0 8px;">Откройте файл <strong>config.js</strong> в корне проекта и вставьте туда:</p>
      <ul>
        <li>SUPABASE_URL</li>
        <li>SUPABASE_ANON_KEY</li>
        <li>ADMIN_EMAIL</li>
      </ul>
      <p style="margin:10px 0 0;">Пароль администратора в коде не хранится.</p>
    </div>
  `;
  return false;
}

export const supabase = configReady
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export { ADMIN_EMAIL };

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function getLikerToken() {
  const key = 'good_deeds_liker_token';
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }
  return token;
}

export function getLikedMap() {
  try {
    return JSON.parse(localStorage.getItem('good_deeds_liked_map') || '{}');
  } catch {
    return {};
  }
}

export function setLikedMap(map) {
  localStorage.setItem('good_deeds_liked_map', JSON.stringify(map));
}

export function setMessage(element, text, tone = 'muted') {
  if (!element) return;
  element.textContent = text;
  element.className = `message message-${tone}`;
}

export function createTag(text, className = 'tag-soft') {
  const el = document.createElement('span');
  el.className = `tag ${className}`;
  el.textContent = text;
  return el;
}

export function slugifyTitle(text = '') {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) return 'Доброе дело';
  const short = normalized.length > 74 ? `${normalized.slice(0, 74).trim()}…` : normalized;
  return short;
}

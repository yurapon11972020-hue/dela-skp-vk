import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_PROJECT') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR_PUBLIC_ANON_KEY')) {
  console.warn('Сначала заполните файл config.js своими данными Supabase.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function formatDate(dateString) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export function getBrowserLikeToken() {
  const key = 'good_deeds_like_token';
  let token = localStorage.getItem(key);

  if (!token) {
    token = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `token_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(key, token);
  }

  return token;
}

export function getLikedIds() {
  try {
    return JSON.parse(localStorage.getItem('good_deeds_liked_ids') || '[]');
  } catch {
    return [];
  }
}

export function markAsLiked(postId) {
  const likedIds = new Set(getLikedIds());
  likedIds.add(postId);
  localStorage.setItem('good_deeds_liked_ids', JSON.stringify([...likedIds]));
}

export function wasLiked(postId) {
  return getLikedIds().includes(postId);
}

export function setMessage(element, text, type = 'info') {
  if (!element) return;
  element.textContent = text;
  element.className = `message ${type}`;
  element.classList.remove('hidden');
}

export function hideMessage(element) {
  if (!element) return;
  element.textContent = '';
  element.className = 'message hidden';
}

export function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

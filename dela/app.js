import {
  supabase,
  formatDate,
  getBrowserLikeToken,
  markAsLiked,
  setMessage,
  hideMessage,
  escapeHtml,
  wasLiked,
} from '../assets/shared.js';

const form = document.getElementById('deed-form');
const messageBox = document.getElementById('form-message');
const feed = document.getElementById('feed');
const feedEmpty = document.getElementById('feed-empty');
const reloadBtn = document.getElementById('reload-feed');

form?.addEventListener('submit', onSubmit);
reloadBtn?.addEventListener('click', loadFeed);
feed?.addEventListener('click', onFeedClick);

document.addEventListener('DOMContentLoaded', loadFeed);

async function onSubmit(event) {
  event.preventDefault();
  hideMessage(messageBox);

  const authorInput = document.getElementById('author_name');
  const deedInput = document.getElementById('deed_text');

  const author_name = authorInput.value.trim();
  const deed_text = deedInput.value.trim();

  if (author_name.length < 2 || deed_text.length < 3) {
    setMessage(messageBox, 'Заполните оба поля. Имя — минимум 2 символа, описание — минимум 3 символа.', 'error');
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const { error } = await supabase.rpc('submit_good_deed', {
      p_author_name: author_name,
      p_deed_text: deed_text,
    });

    if (error) throw error;

    form.reset();
    setMessage(messageBox, 'Спасибо! Ваше доброе дело отправлено администратору на рассмотрение.', 'success');
  } catch (error) {
    console.error(error);
    setMessage(messageBox, error.message || 'Не удалось отправить запись.', 'error');
  } finally {
    submitButton.disabled = false;
  }
}

async function loadFeed() {
  feed.innerHTML = '<div class="empty-state">Загрузка...</div>';
  feedEmpty.classList.add('hidden');

  const { data, error } = await supabase
    .from('good_deeds')
    .select('id, author_name, deed_text, likes_count, is_pinned, display_order, created_at')
    .eq('status', 'approved')
    .order('is_pinned', { ascending: false })
    .order('display_order', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    feed.innerHTML = '';
    feedEmpty.textContent = 'Не удалось загрузить ленту.';
    feedEmpty.classList.remove('hidden');
    return;
  }

  renderFeed(data || []);
}

function renderFeed(items) {
  feed.innerHTML = '';

  if (!items.length) {
    feedEmpty.textContent = 'Пока ещё нет одобренных добрых дел.';
    feedEmpty.classList.remove('hidden');
    return;
  }

  feedEmpty.classList.add('hidden');

  items.forEach((item) => {
    const alreadyLiked = wasLiked(item.id);
    const card = document.createElement('article');
    card.className = 'feed-item';
    card.innerHTML = `
      <div class="feed-top">
        <div>
          <div class="feed-author">От кого: ${escapeHtml(item.author_name)}</div>
          <div class="small-text">${formatDate(item.created_at)}</div>
        </div>
        <div>
          ${item.is_pinned ? '<span class="pin-badge">📌 Закреплено</span>' : ''}
        </div>
      </div>
      <p class="feed-text">${escapeHtml(item.deed_text)}</p>
      <div class="meta-row">
        <div class="small-text">Лайков: <strong data-like-count="${item.id}">${item.likes_count}</strong></div>
        <button class="btn btn-secondary like-btn" data-like-id="${item.id}" ${alreadyLiked ? 'disabled' : ''}>
          ${alreadyLiked ? '❤️ Уже лайкнуто' : '❤️ Поставить лайк'}
        </button>
      </div>
    `;
    feed.appendChild(card);
  });
}

async function onFeedClick(event) {
  const button = event.target.closest('[data-like-id]');
  if (!button) return;

  const postId = button.dataset.likeId;
  button.disabled = true;

  try {
    const { data, error } = await supabase.rpc('increment_good_deed_like', {
      p_deed_id: postId,
      p_liker_token: getBrowserLikeToken(),
    });

    if (error) throw error;

    markAsLiked(postId);
    const counter = document.querySelector(`[data-like-count="${postId}"]`);
    if (counter && Number.isFinite(Number(data))) {
      counter.textContent = String(data);
    }
    button.textContent = '❤️ Уже лайкнуто';
  } catch (error) {
    console.error(error);
    button.disabled = false;
    alert(error.message || 'Не удалось поставить лайк.');
  }
}

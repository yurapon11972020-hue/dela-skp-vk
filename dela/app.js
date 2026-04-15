import {
  ensureConfigOrRender,
  supabase,
  formatDate,
  getLikedMap,
  getLikerToken,
  setLikedMap,
  setMessage,
  createTag,
} from '../assets/common.js';

if (!ensureConfigOrRender()) {
  throw new Error('Config missing');
}

const deedForm = document.getElementById('deedForm');
const authorInput = document.getElementById('authorInput');
const contentInput = document.getElementById('contentInput');
const submitMessage = document.getElementById('submitMessage');
const feedList = document.getElementById('feedList');
const emptyState = document.getElementById('emptyState');
const storyTemplate = document.getElementById('storyTemplate');
const refreshBtn = document.getElementById('refreshBtn');
const sortRecentBtn = document.getElementById('sortRecentBtn');
const sortTopBtn = document.getElementById('sortTopBtn');

let sortMode = 'recent';

function applySortButtonState() {
  sortRecentBtn.style.background = sortMode === 'recent' ? 'var(--accent-soft)' : '';
  sortRecentBtn.style.color = sortMode === 'recent' ? 'var(--accent)' : '';
  sortTopBtn.style.background = sortMode === 'top' ? 'var(--accent-soft)' : '';
  sortTopBtn.style.color = sortMode === 'top' ? 'var(--accent)' : '';
}

async function loadFeed() {
  const orderField = sortMode === 'top' ? 'likes_count' : 'created_at';
  const { data, error } = await supabase
    .from('deeds')
    .select('id, author_name, content, likes_count, pinned, created_at')
    .eq('status', 'approved')
    .order('pinned', { ascending: false })
    .order(orderField, { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    feedList.innerHTML = `<div class="empty-state"><h3 class="empty-title">Не удалось загрузить ленту</h3><p class="empty-copy">${error.message}</p></div>`;
    emptyState.classList.add('hidden');
    return;
  }

  feedList.innerHTML = '';
  const likedMap = getLikedMap();

  if (!data.length) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  data.forEach((item) => {
    const node = storyTemplate.content.firstElementChild.cloneNode(true);
    const meta = node.querySelector('.feed-meta');
    const author = node.querySelector('.story-author');
    const date = node.querySelector('.story-date');
    const text = node.querySelector('.story-text');
    const voteCount = node.querySelector('.vote-count');
    const likeBtn = node.querySelector('.like-btn');
    const postActions = node.querySelector('.post-actions');

    if (item.pinned) meta.appendChild(createTag('Закреплено', 'tag-pinned'));
    meta.appendChild(createTag('Опубликовано', 'tag-approved'));

    author.textContent = item.author_name?.trim() || 'Анонимно';
    date.textContent = formatDate(item.created_at);
    text.textContent = item.content;
    voteCount.textContent = item.likes_count ?? 0;
    postActions.appendChild(createTag(`${item.likes_count ?? 0} лайков`, 'tag-soft'));

    if (likedMap[item.id]) {
      likeBtn.classList.add('is-liked');
      likeBtn.disabled = true;
      likeBtn.title = 'Вы уже ставили лайк';
    }

    likeBtn.addEventListener('click', async () => {
      likeBtn.disabled = true;
      const { error: likeError } = await supabase.rpc('like_deed', {
        p_deed_id: item.id,
        p_liker_token: getLikerToken(),
      });

      if (likeError) {
        const already = likeError.message?.toLowerCase().includes('уже');
        alert(already ? 'Вы уже ставили лайк этой истории.' : `Не удалось поставить лайк: ${likeError.message}`);
        likeBtn.disabled = Boolean(likedMap[item.id]);
        return;
      }

      const map = getLikedMap();
      map[item.id] = true;
      setLikedMap(map);
      await loadFeed();
    });

    feedList.appendChild(node);
  });
}

async function submitDeed(event) {
  event.preventDefault();
  const authorName = authorInput.value.trim() || 'Анонимно';
  const content = contentInput.value.trim();

  if (content.length < 3) {
    setMessage(submitMessage, 'Напишите чуть подробнее: минимум 3 символа.', 'error');
    return;
  }

  const { error } = await supabase.from('deeds').insert({
    author_name: authorName,
    content,
    status: 'pending',
    pinned: false,
    likes_count: 0,
  });

  if (error) {
    setMessage(submitMessage, `Ошибка отправки: ${error.message}`, 'error');
    return;
  }

  deedForm.reset();
  setMessage(submitMessage, 'История отправлена. После модерации она появится в ленте.', 'success');
}

deedForm.addEventListener('submit', submitDeed);
refreshBtn.addEventListener('click', loadFeed);
sortRecentBtn.addEventListener('click', async () => {
  sortMode = 'recent';
  applySortButtonState();
  await loadFeed();
});
sortTopBtn.addEventListener('click', async () => {
  sortMode = 'top';
  applySortButtonState();
  await loadFeed();
});

applySortButtonState();
await loadFeed();

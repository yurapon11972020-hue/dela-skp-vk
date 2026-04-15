import {
  ensureConfigOrRender,
  supabase,
  ADMIN_EMAIL,
  formatDate,
  setMessage,
  createTag,
  slugifyTitle,
} from '../assets/common.js';

if (!ensureConfigOrRender()) {
  throw new Error('Config missing');
}

const loginBox = document.getElementById('loginBox');
const sessionBox = document.getElementById('sessionBox');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginMessage = document.getElementById('loginMessage');
const adminIdentity = document.getElementById('adminIdentity');
const queueList = document.getElementById('queueList');
const queueEmpty = document.getElementById('queueEmpty');
const refreshAdminBtn = document.getElementById('refreshAdminBtn');
const pendingCount = document.getElementById('pendingCount');
const approvedCount = document.getElementById('approvedCount');
const rejectedCount = document.getElementById('rejectedCount');
const template = document.getElementById('adminCardTemplate');
const tabButtons = Array.from(document.querySelectorAll('[data-tab]'));

let currentTab = 'pending';
let currentUser = null;
let currentUserIsAdmin = false;

function updateTabButtons() {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tab === currentTab);
  });
}

function renderAuthState() {
  loginBox.classList.toggle('hidden', currentUserIsAdmin);
  sessionBox.classList.toggle('hidden', !currentUserIsAdmin);
  if (currentUserIsAdmin) {
    adminIdentity.textContent = currentUser?.email || ADMIN_EMAIL;
  }
}

async function checkAdmin(user) {
  if (!user) {
    currentUser = null;
    currentUserIsAdmin = false;
    renderAuthState();
    queueList.innerHTML = '';
    return false;
  }

  const { data, error } = await supabase.rpc('is_admin');
  currentUser = user;
  currentUserIsAdmin = !error && data === true;
  renderAuthState();

  if (!currentUserIsAdmin) {
    queueList.innerHTML = '';
  }

  return currentUserIsAdmin;
}

async function fetchCounts() {
  const { data, error } = await supabase
    .from('deeds')
    .select('status', { count: 'exact' });

  if (error || !data) {
    pendingCount.textContent = '—';
    approvedCount.textContent = '—';
    rejectedCount.textContent = '—';
    return;
  }

  const counts = { pending: 0, approved: 0, rejected: 0 };
  data.forEach((item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
  });

  pendingCount.textContent = counts.pending;
  approvedCount.textContent = counts.approved;
  rejectedCount.textContent = counts.rejected;
}

async function loadQueue() {
  if (!currentUserIsAdmin) {
    queueList.innerHTML = '';
    queueEmpty.classList.add('hidden');
    return;
  }

  await fetchCounts();

  const orderField = currentTab === 'approved' ? 'likes_count' : 'created_at';
  const { data, error } = await supabase
    .from('deeds')
    .select('*')
    .eq('status', currentTab)
    .order('pinned', { ascending: false })
    .order(orderField, { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    queueList.innerHTML = `<div class="empty-state"><h3 class="empty-title">Ошибка загрузки</h3><p class="empty-copy">${error.message}</p></div>`;
    queueEmpty.classList.add('hidden');
    return;
  }

  queueList.innerHTML = '';

  if (!data.length) {
    queueEmpty.classList.remove('hidden');
    return;
  }

  queueEmpty.classList.add('hidden');

  data.forEach((item) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const badges = node.querySelector('.admin-badges');
    const title = node.querySelector('.admin-card-title');
    const date = node.querySelector('.admin-date');
    const author = node.querySelector('.admin-author');
    const content = node.querySelector('.admin-content');
    const likes = node.querySelector('.admin-likes');
    const pinned = node.querySelector('.admin-pinned');
    const saveBtn = node.querySelector('.saveBtn');
    const approveBtn = node.querySelector('.approveBtn');
    const rejectBtn = node.querySelector('.rejectBtn');
    const deleteBtn = node.querySelector('.deleteBtn');
    const note = node.querySelector('.admin-note');

    badges.appendChild(createTag(item.status === 'pending' ? 'На модерации' : item.status === 'approved' ? 'Опубликовано' : 'Отклонено', item.status === 'pending' ? 'tag-pending' : item.status === 'approved' ? 'tag-approved' : 'tag-rejected'));
    if (item.pinned) badges.appendChild(createTag('Закреплено', 'tag-pinned'));
    badges.appendChild(createTag(`${item.likes_count ?? 0} лайков`, 'tag-soft'));

    title.textContent = slugifyTitle(item.content);
    date.textContent = formatDate(item.created_at);
    author.value = item.author_name || 'Анонимно';
    content.value = item.content || '';
    likes.value = item.likes_count ?? 0;
    pinned.value = String(Boolean(item.pinned));
    note.textContent = currentTab === 'approved'
      ? 'Опубликованные истории можно редактировать, закреплять и менять лайки.'
      : currentTab === 'pending'
        ? 'Можно поправить текст, а затем одобрить или отклонить.'
        : 'Отклонённые истории можно вернуть и опубликовать.';

    const saveChanges = async (overrides = {}) => {
      const payload = {
        author_name: author.value.trim() || 'Анонимно',
        content: content.value.trim(),
        likes_count: Math.max(0, Number(likes.value || 0)),
        pinned: pinned.value === 'true',
        ...overrides,
      };

      if (!payload.content || payload.content.length < 3) {
        alert('Текст истории должен быть не короче 3 символов.');
        return false;
      }

      const { error: updateError } = await supabase
        .from('deeds')
        .update(payload)
        .eq('id', item.id);

      if (updateError) {
        alert(`Не удалось сохранить: ${updateError.message}`);
        return false;
      }

      return true;
    };

    saveBtn.addEventListener('click', async () => {
      const ok = await saveChanges();
      if (ok) await loadQueue();
    });

    approveBtn.addEventListener('click', async () => {
      const ok = await saveChanges({ status: 'approved' });
      if (ok) await loadQueue();
    });

    rejectBtn.addEventListener('click', async () => {
      const ok = await saveChanges({ status: 'rejected' });
      if (ok) await loadQueue();
    });

    deleteBtn.addEventListener('click', async () => {
      const confirmed = confirm('Удалить эту запись безвозвратно?');
      if (!confirmed) return;

      const { error: deleteError } = await supabase
        .from('deeds')
        .delete()
        .eq('id', item.id);

      if (deleteError) {
        alert(`Не удалось удалить: ${deleteError.message}`);
        return;
      }

      await loadQueue();
    });

    queueList.appendChild(node);
  });
}

async function loginAdmin() {
  setMessage(loginMessage, '', 'muted');
  const password = passwordInput.value;

  if (!password) {
    setMessage(loginMessage, 'Введите пароль администратора.', 'error');
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password,
  });

  if (error) {
    setMessage(loginMessage, `Ошибка входа: ${error.message}`, 'error');
    return;
  }

  const ok = await checkAdmin(data.user);
  if (!ok) {
    await supabase.auth.signOut();
    setMessage(loginMessage, 'Этот пользователь не добавлен в таблицу admin_users.', 'error');
    return;
  }

  passwordInput.value = '';
  setMessage(loginMessage, 'Вход выполнен.', 'success');
  await loadQueue();
}

async function logoutAdmin() {
  await supabase.auth.signOut();
  currentUser = null;
  currentUserIsAdmin = false;
  renderAuthState();
  queueList.innerHTML = '';
  await fetchCounts();
}

loginBtn.addEventListener('click', loginAdmin);
logoutBtn.addEventListener('click', logoutAdmin);
passwordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') loginAdmin();
});
refreshAdminBtn.addEventListener('click', loadQueue);

tabButtons.forEach((btn) => {
  btn.addEventListener('click', async () => {
    currentTab = btn.dataset.tab;
    updateTabButtons();
    await loadQueue();
  });
});

const { data: sessionData } = await supabase.auth.getSession();
await checkAdmin(sessionData.session?.user || null);
updateTabButtons();
await fetchCounts();
if (currentUserIsAdmin) await loadQueue();

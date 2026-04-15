import {
  supabase,
  formatDate,
  setMessage,
  hideMessage,
  escapeHtml,
} from '../assets/shared.js';

const authCard = document.getElementById('auth-card');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const authMessage = document.getElementById('auth-message');
const adminMessage = document.getElementById('admin-message');
const adminList = document.getElementById('admin-list');
const adminEmpty = document.getElementById('admin-empty');
const statusFilter = document.getElementById('status-filter');
const refreshButton = document.getElementById('refresh-admin');
const logoutButton = document.getElementById('logout-btn');

loginForm?.addEventListener('submit', onLogin);
statusFilter?.addEventListener('change', loadAdminItems);
refreshButton?.addEventListener('click', loadAdminItems);
logoutButton?.addEventListener('click', onLogout);
adminList?.addEventListener('click', onAdminClick);
adminList?.addEventListener('submit', onAdminSave);

document.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;

  if (!session) {
    showLogin();
    return;
  }

  const allowed = await checkAdminAccess();
  if (!allowed) {
    await supabase.auth.signOut();
    showLogin();
    setMessage(authMessage, 'Этот аккаунт не имеет прав администратора.', 'error');
    return;
  }

  showAdmin();
  await loadAdminItems();
}

async function onLogin(event) {
  event.preventDefault();
  hideMessage(authMessage);

  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const allowed = await checkAdminAccess();
    if (!allowed) {
      await supabase.auth.signOut();
      throw new Error('Аккаунт вошёл в систему, но не имеет прав администратора.');
    }

    loginForm.reset();
    showAdmin();
    await loadAdminItems();
  } catch (error) {
    console.error(error);
    setMessage(authMessage, error.message || 'Не удалось войти.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function onLogout() {
  await supabase.auth.signOut();
  showLogin();
  setMessage(authMessage, 'Вы вышли из админки.', 'info');
}

async function checkAdminAccess() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.error(error);
    return false;
  }
  return Boolean(data);
}

function showLogin() {
  adminPanel.classList.add('hidden');
  authCard.classList.remove('hidden');
}

function showAdmin() {
  authCard.classList.add('hidden');
  adminPanel.classList.remove('hidden');
  hideMessage(authMessage);
}

async function loadAdminItems() {
  adminList.innerHTML = '<div class="empty-state">Загрузка...</div>';
  adminEmpty.classList.add('hidden');
  hideMessage(adminMessage);

  let query = supabase
    .from('good_deeds')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('display_order', { ascending: false })
    .order('created_at', { ascending: false });

  const filterValue = statusFilter.value;
  if (filterValue !== 'all') {
    query = query.eq('status', filterValue);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    adminList.innerHTML = '';
    adminEmpty.textContent = 'Не удалось загрузить записи.';
    adminEmpty.classList.remove('hidden');
    return;
  }

  renderAdminItems(data || []);
}

function renderAdminItems(items) {
  adminList.innerHTML = '';

  if (!items.length) {
    adminEmpty.classList.remove('hidden');
    return;
  }

  adminEmpty.classList.add('hidden');

  items.forEach((item) => {
    const wrapper = document.createElement('article');
    wrapper.className = 'admin-item';
    wrapper.dataset.id = item.id;
    wrapper.innerHTML = `
      <div class="admin-top">
        <div>
          <div class="admin-meta-title">Заявка от ${escapeHtml(item.author_name || 'Без имени')}</div>
          <div class="small-text">Создано: ${formatDate(item.created_at)}</div>
          <div class="small-text">ID: ${escapeHtml(item.id)}</div>
        </div>
        <div class="quick-actions">
          <span class="status-badge status-${escapeHtml(item.status)}">${statusLabel(item.status)}</span>
          ${item.is_pinned ? '<span class="pin-badge">📌 Закреплено</span>' : ''}
        </div>
      </div>

      <form class="admin-edit-form">
        <div class="admin-grid">
          <div class="admin-side">
            <label>
              <span>Статус</span>
              <select name="status">
                <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>На рассмотрении</option>
                <option value="approved" ${item.status === 'approved' ? 'selected' : ''}>Одобрено</option>
                <option value="rejected" ${item.status === 'rejected' ? 'selected' : ''}>Отклонено</option>
              </select>
            </label>

            <label>
              <span>Лайки</span>
              <input name="likes_count" type="number" min="0" value="${item.likes_count}" />
            </label>

            <label>
              <span>Порядок закрепления</span>
              <input name="display_order" type="number" value="${item.display_order || 0}" />
            </label>

            <label class="checkbox-row">
              <input name="is_pinned" type="checkbox" ${item.is_pinned ? 'checked' : ''} />
              <span>Закрепить запись</span>
            </label>
          </div>

          <div class="admin-main">
            <label>
              <span>От кого</span>
              <input name="author_name" maxlength="80" value="${escapeHtml(item.author_name || '')}" />
            </label>

            <label>
              <span>Текст доброго дела</span>
              <textarea name="deed_text" maxlength="1000">${escapeHtml(item.deed_text || '')}</textarea>
            </label>

            <label>
              <span>Заметка администратора</span>
              <textarea name="admin_note" rows="3" maxlength="1000">${escapeHtml(item.admin_note || '')}</textarea>
            </label>
          </div>
        </div>

        <div class="card-actions">
          <button class="btn btn-primary" type="submit">Сохранить</button>
          <button class="btn btn-secondary" type="button" data-action="approve">Одобрить</button>
          <button class="btn btn-secondary" type="button" data-action="reject">Отклонить</button>
          <button class="btn btn-danger" type="button" data-action="delete">Удалить</button>
        </div>
      </form>
    `;

    adminList.appendChild(wrapper);
  });
}

function statusLabel(status) {
  if (status === 'approved') return 'Одобрено';
  if (status === 'rejected') return 'Отклонено';
  return 'На рассмотрении';
}

async function onAdminSave(event) {
  const form = event.target.closest('.admin-edit-form');
  if (!form) return;

  event.preventDefault();
  hideMessage(adminMessage);

  const item = form.closest('.admin-item');
  const id = item.dataset.id;
  const formData = new FormData(form);

  const payload = {
    author_name: String(formData.get('author_name') || '').trim(),
    deed_text: String(formData.get('deed_text') || '').trim(),
    admin_note: String(formData.get('admin_note') || '').trim() || null,
    status: String(formData.get('status') || 'pending'),
    likes_count: Math.max(0, Number(formData.get('likes_count') || 0)),
    display_order: Number(formData.get('display_order') || 0),
    is_pinned: formData.get('is_pinned') === 'on',
  };

  if (payload.author_name.length < 2 || payload.deed_text.length < 3) {
    setMessage(adminMessage, 'Имя должно быть не короче 2 символов, а текст — не короче 3 символов.', 'error');
    return;
  }

  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.disabled = true;

  try {
    const updatePayload = {
      ...payload,
      approved_at: payload.status === 'approved' ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from('good_deeds').update(updatePayload).eq('id', id);
    if (error) throw error;

    setMessage(adminMessage, 'Изменения сохранены.', 'success');
    await loadAdminItems();
  } catch (error) {
    console.error(error);
    setMessage(adminMessage, error.message || 'Не удалось сохранить изменения.', 'error');
  } finally {
    saveButton.disabled = false;
  }
}

async function onAdminClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const item = button.closest('.admin-item');
  const id = item.dataset.id;
  const action = button.dataset.action;
  hideMessage(adminMessage);

  button.disabled = true;

  try {
    if (action === 'approve') {
      const { error } = await supabase
        .from('good_deeds')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setMessage(adminMessage, 'Запись одобрена.', 'success');
    }

    if (action === 'reject') {
      const { error } = await supabase
        .from('good_deeds')
        .update({ status: 'rejected', approved_at: null })
        .eq('id', id);
      if (error) throw error;
      setMessage(adminMessage, 'Запись отклонена.', 'success');
    }

    if (action === 'delete') {
      const confirmed = confirm('Удалить эту запись?');
      if (!confirmed) {
        button.disabled = false;
        return;
      }
      const { error } = await supabase.from('good_deeds').delete().eq('id', id);
      if (error) throw error;
      setMessage(adminMessage, 'Запись удалена.', 'success');
    }

    await loadAdminItems();
  } catch (error) {
    console.error(error);
    setMessage(adminMessage, error.message || 'Операция не выполнена.', 'error');
  } finally {
    button.disabled = false;
  }
}

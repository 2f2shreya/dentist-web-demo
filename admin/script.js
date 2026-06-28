const API_BASE = window.location.origin + '/api';
let authToken = localStorage.getItem('dentacare_token');
let currentUser = null;
let currentPage = 'overview';
let appointmentFilters = { status: 'all', search: '', page: 1 };
let patientFilters = { search: '', page: 1 };
let messageFilters = { is_read: '', page: 1 };
async function api(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        const data = await res.json();

        if (res.status === 401) {
            logout();
            return null;
        }

        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    } catch (err) {
        console.error('API Error:', err);
        throw err;
    }
}
async function checkAuth() {
    if (!authToken) { showLogin(); return; }
    try {
        const data = await api('/admin/me');
        if (data && data.success) {
            currentUser = data.user;
            showDashboard();
        } else {
            showLogin();
        }
    } catch {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.displayName;
        document.getElementById('userAvatar').textContent = currentUser.displayName.charAt(0).toUpperCase();
        document.getElementById('settingsUsername').textContent = currentUser.username;
        document.getElementById('settingsDisplayName').textContent = currentUser.displayName;
        document.getElementById('settingsRole').textContent = currentUser.role;
    }

    loadPage('overview');
}

function logout() {
    if (authToken) {
        api('/admin/logout', { method: 'POST' }).catch(() => {});
    }
    authToken = null;
    currentUser = null;
    localStorage.removeItem('dentacare_token');
    showLogin();
}
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginBtn = document.getElementById('loginBtn');
    const errorEl = document.getElementById('loginError');
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    loginBtn.querySelector('.btn-text').style.display = 'none';
    loginBtn.querySelector('.btn-loader').style.display = 'inline-flex';
    loginBtn.disabled = true;
    errorEl.textContent = '';

    try {
        const data = await api('/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (data && data.success) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('dentacare_token', authToken);
            showDashboard();
        }
    } catch (err) {
        errorEl.textContent = err.message || 'Login failed';
    } finally {
        loginBtn.querySelector('.btn-text').style.display = 'inline';
        loginBtn.querySelector('.btn-loader').style.display = 'none';
        loginBtn.disabled = false;
    }
});

document.getElementById('logoutBtn').addEventListener('click', logout);
function loadPage(pageName) {
    currentPage = pageName;
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageName);
    });
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });
    const titles = { overview: 'Overview', appointments: 'Appointments', patients: 'Patients', messages: 'Messages', settings: 'Settings' };
    document.getElementById('pageTitle').textContent = titles[pageName] || pageName;
    switch (pageName) {
        case 'overview': loadOverview(); break;
        case 'appointments': loadAppointments(); break;
        case 'patients': loadPatients(); break;
        case 'messages': loadMessages(); break;
    }
}

document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        loadPage(link.dataset.page);
        document.getElementById('sidebar').classList.remove('open');
    });
});

document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        loadPage(el.dataset.goto);
    });
});
document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});
async function loadOverview() {
    try {
        const data = await api('/admin/dashboard');
        if (!data) return;

        const { stats, recentAppointments, serviceStats } = data;

        document.getElementById('statTotal').textContent = stats.totalAppointments;
        document.getElementById('statPending').textContent = stats.pendingAppointments;
        document.getElementById('statConfirmed').textContent = stats.confirmedAppointments;
        document.getElementById('statPatients').textContent = stats.totalPatients;
        const pendingBadge = document.getElementById('pendingBadge');
        if (stats.pendingAppointments > 0) {
            pendingBadge.textContent = stats.pendingAppointments;
            pendingBadge.classList.add('show');
        } else {
            pendingBadge.classList.remove('show');
        }
        const messageBadge = document.getElementById('messageBadge');
        if (stats.unreadMessages > 0) {
            messageBadge.textContent = stats.unreadMessages;
            messageBadge.classList.add('show');
        } else {
            messageBadge.classList.remove('show');
        }
        const recentList = document.getElementById('recentAppointmentsList');
        if (recentAppointments.length === 0) {
            recentList.innerHTML = '<div class="empty-state"><p>No appointments yet</p></div>';
        } else {
            recentList.innerHTML = recentAppointments.map(a => `
                <div class="recent-item">
                    <div class="recent-avatar">${a.name.charAt(0).toUpperCase()}</div>
                    <div class="recent-info">
                        <span class="recent-name">${escapeHtml(a.name)}</span>
                        <span class="recent-service">${escapeHtml(a.serviceLabel)}</span>
                    </div>
                    <span class="status status-${a.status}">${a.status}</span>
                    <span class="recent-date">${formatDate(a.date)}</span>
                </div>
            `).join('');
        }
        const serviceList = document.getElementById('serviceStatsList');
        if (serviceStats.length === 0) {
            serviceList.innerHTML = '<div class="empty-state"><p>No data yet</p></div>';
        } else {
            const maxCount = Math.max(...serviceStats.map(s => s.count));
            serviceList.innerHTML = serviceStats.map(s => `
                <div class="service-bar-item">
                    <div class="service-bar-label">
                        <span class="service-bar-name">${escapeHtml(s.serviceLabel)}</span>
                        <span class="service-bar-count">${s.count}</span>
                    </div>
                    <div class="service-bar-track">
                        <div class="service-bar-fill" style="width: ${(s.count / maxCount) * 100}%"></div>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load overview:', err);
    }
}
async function loadAppointments() {
    const tableWrapper = document.getElementById('appointmentsTable');
    tableWrapper.innerHTML = '<div class="loading-placeholder">Loading...</div>';

    try {
        const params = new URLSearchParams({
            status: appointmentFilters.status,
            search: appointmentFilters.search,
            page: appointmentFilters.page,
            limit: 15
        });

        const data = await api(`/admin/appointments?${params}`);
        if (!data) return;

        const { appointments, pagination } = data;

        if (appointments.length === 0) {
            tableWrapper.innerHTML = '<div class="empty-state"><p>No appointments found</p></div>';
            document.getElementById('appointmentsPagination').innerHTML = '';
            return;
        }

        tableWrapper.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Patient</th>
                        <th>Service</th>
                        <th>Date</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${appointments.map(a => `
                        <tr>
                            <td>
                                <strong>${escapeHtml(a.name)}</strong><br>
                                <span style="font-size:0.75rem;color:var(--text-light)">${escapeHtml(a.email)}</span>
                            </td>
                            <td>${escapeHtml(a.serviceLabel)}</td>
                            <td>${formatDate(a.date)}</td>
                            <td>${escapeHtml(a.phone)}</td>
                            <td><span class="status status-${a.status}">${a.status}</span></td>
                            <td>
                                <div class="table-actions">
                                    <button class="table-btn" title="View Details" onclick="viewAppointment(${a.id})">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    </button>
                                    <button class="table-btn danger" title="Delete" onclick="deleteAppointment(${a.id})">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        renderPagination('appointmentsPagination', pagination, (page) => {
            appointmentFilters.page = page;
            loadAppointments();
        });
    } catch (err) {
        tableWrapper.innerHTML = '<div class="empty-state"><p>Failed to load appointments</p></div>';
    }
}
document.querySelectorAll('#page-appointments .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('#page-appointments .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        appointmentFilters.status = tab.dataset.status;
        appointmentFilters.page = 1;
        loadAppointments();
    });
});
let searchTimeout;
document.getElementById('appointmentSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        appointmentFilters.search = e.target.value;
        appointmentFilters.page = 1;
        loadAppointments();
    }, 300);
});
async function viewAppointment(id) {
    try {
        const data = await api(`/admin/appointments/${id}`);
        if (!data) return;

        const a = data.appointment;
        const modalBody = document.getElementById('modalBody');

        modalBody.innerHTML = `
            <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${escapeHtml(a.name)}</span></div>
            <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${escapeHtml(a.email)}</span></div>
            <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${escapeHtml(a.phone)}</span></div>
            <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${escapeHtml(a.serviceLabel)}</span></div>
            <div class="detail-row"><span class="detail-label">Preferred Date</span><span class="detail-value">${formatDate(a.date)}</span></div>
            <div class="detail-row"><span class="detail-label">Message</span><span class="detail-value">${escapeHtml(a.message || '—')}</span></div>
            <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="status status-${a.status}">${a.status}</span></span></div>
            <div class="detail-row"><span class="detail-label">Booked On</span><span class="detail-value">${formatDateTime(a.created_at)}</span></div>
            <div class="modal-actions">
                ${a.status !== 'confirmed' ? `<button class="btn btn-primary btn-sm" onclick="updateAppointmentStatus(${a.id}, 'confirmed')">Confirm</button>` : ''}
                ${a.status !== 'completed' ? `<button class="btn btn-outline btn-sm" onclick="updateAppointmentStatus(${a.id}, 'completed')">Complete</button>` : ''}
                ${a.status !== 'cancelled' ? `<button class="btn btn-danger btn-sm" onclick="updateAppointmentStatus(${a.id}, 'cancelled')">Cancel</button>` : ''}
            </div>
        `;

        document.getElementById('modalTitle').textContent = 'Appointment Details';
        document.getElementById('modalOverlay').classList.add('show');
    } catch (err) {
        console.error('Failed to load appointment:', err);
    }
}

async function updateAppointmentStatus(id, status) {
    try {
        await api(`/admin/appointments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        closeModal();
        loadAppointments();
        if (currentPage === 'overview') loadOverview();
    } catch (err) {
        alert('Failed to update: ' + err.message);
    }
}

async function deleteAppointment(id) {
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    try {
        await api(`/admin/appointments/${id}`, { method: 'DELETE' });
        loadAppointments();
        if (currentPage === 'overview') loadOverview();
    } catch (err) {
        alert('Failed to delete: ' + err.message);
    }
}
async function loadPatients() {
    const tableWrapper = document.getElementById('patientsTable');
    tableWrapper.innerHTML = '<div class="loading-placeholder">Loading...</div>';

    try {
        const params = new URLSearchParams({
            search: patientFilters.search,
            page: patientFilters.page,
            limit: 15
        });

        const data = await api(`/admin/patients?${params}`);
        if (!data) return;

        const { patients, pagination } = data;

        if (patients.length === 0) {
            tableWrapper.innerHTML = '<div class="empty-state"><p>No patients found</p></div>';
            document.getElementById('patientsPagination').innerHTML = '';
            return;
        }

        tableWrapper.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Patient</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Total Visits</th>
                        <th>Last Visit</th>
                    </tr>
                </thead>
                <tbody>
                    ${patients.map(p => `
                        <tr>
                            <td><strong>${escapeHtml(p.name)}</strong></td>
                            <td>${escapeHtml(p.phone)}</td>
                            <td>${escapeHtml(p.email)}</td>
                            <td>${p.total_visits}</td>
                            <td>${formatDateTime(p.last_visit)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        renderPagination('patientsPagination', pagination, (page) => {
            patientFilters.page = page;
            loadPatients();
        });
    } catch (err) {
        tableWrapper.innerHTML = '<div class="empty-state"><p>Failed to load patients</p></div>';
    }
}

document.getElementById('patientSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        patientFilters.search = e.target.value;
        patientFilters.page = 1;
        loadPatients();
    }, 300);
});
async function loadMessages() {
    const messagesList = document.getElementById('messagesList');
    messagesList.innerHTML = '<div class="loading-placeholder">Loading...</div>';

    try {
        const params = new URLSearchParams({
            page: messageFilters.page,
            limit: 15
        });
        if (messageFilters.is_read !== '') params.append('is_read', messageFilters.is_read);

        const data = await api(`/admin/messages?${params}`);
        if (!data) return;

        const { messages, pagination } = data;

        if (messages.length === 0) {
            messagesList.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
            document.getElementById('messagesPagination').innerHTML = '';
            return;
        }

        messagesList.innerHTML = messages.map(m => `
            <div class="message-item ${m.is_read ? '' : 'unread'}" onclick="markMessageRead(${m.id}, this)">
                <div class="message-header">
                    <span class="message-sender">${escapeHtml(m.name)}</span>
                    <span class="message-date">${formatDateTime(m.created_at)}</span>
                </div>
                <div class="message-email">${escapeHtml(m.email)}</div>
                ${m.subject ? `<div style="font-weight:600;margin-bottom:0.25rem;">${escapeHtml(m.subject)}</div>` : ''}
                <div class="message-text">${escapeHtml(m.message)}</div>
                <div class="message-actions">
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); deleteMessage(${m.id})">Delete</button>
                </div>
            </div>
        `).join('');

        renderPagination('messagesPagination', pagination, (page) => {
            messageFilters.page = page;
            loadMessages();
        });
    } catch (err) {
        messagesList.innerHTML = '<div class="empty-state"><p>Failed to load messages</p></div>';
    }
}

document.querySelectorAll('#page-messages .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('#page-messages .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.dataset.filter;
        messageFilters.is_read = filter === 'unread' ? '0' : filter === 'read' ? '1' : '';
        messageFilters.page = 1;
        loadMessages();
    });
});

async function markMessageRead(id, el) {
    try {
        await api(`/admin/messages/${id}/read`, { method: 'PATCH' });
        el.classList.remove('unread');
        loadOverview(); // Update badge
    } catch (err) { }
}

async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return;
    try {
        await api(`/admin/messages/${id}`, { method: 'DELETE' });
        loadMessages();
        loadOverview();
    } catch (err) {
        alert('Failed to delete');
    }
}
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('passwordMessage');
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        msgEl.className = 'settings-message error';
        msgEl.textContent = 'New passwords do not match';
        return;
    }

    try {
        const data = await api('/admin/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (data && data.success) {
            msgEl.className = 'settings-message success';
            msgEl.textContent = 'Password updated successfully!';
            document.getElementById('passwordForm').reset();
        }
    } catch (err) {
        msgEl.className = 'settings-message error';
        msgEl.textContent = err.message || 'Failed to change password';
    }
});
function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
function renderPagination(containerId, pagination, onPageChange) {
    const container = document.getElementById(containerId);
    if (pagination.totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    html += `<button class="page-btn" ${pagination.page <= 1 ? 'disabled' : ''} onclick="return false;">‹</button>`;

    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === 1 || i === pagination.totalPages || Math.abs(i - pagination.page) <= 2) {
            html += `<button class="page-btn ${i === pagination.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        } else if (Math.abs(i - pagination.page) === 3) {
            html += `<span style="padding:0 0.25rem;color:var(--text-light)">…</span>`;
        }
    }

    html += `<button class="page-btn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="return false;">›</button>`;

    container.innerHTML = html;

    container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => onPageChange(parseInt(btn.dataset.page)));
    });
    const buttons = container.querySelectorAll('.page-btn:not([data-page])');
    if (buttons[0]) buttons[0].addEventListener('click', () => { if (pagination.page > 1) onPageChange(pagination.page - 1); });
    if (buttons[1]) buttons[1].addEventListener('click', () => { if (pagination.page < pagination.totalPages) onPageChange(pagination.page + 1); });
}
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

function formatDateTime(dtStr) {
    if (!dtStr) return '—';
    try {
        const d = new Date(dtStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + 
               ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return dtStr;
    }
}
checkAuth();

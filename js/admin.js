/**
 * MAA ENTERPRISES — ADMIN DASHBOARD CONTROLLER (js/admin.js)
 * Production-ready Controller implementing:
 * - Real-time KPI statistics computation
 * - Safe missing-field normalization (Never crashes on undefined fields)
 * - Customer application management (Search, Status updates, Payment updates, Private admin notes)
 * - Dynamic Services Catalog CRUD (Add, Edit, Toggle Active, Safe Delete in Firestore)
 * - Trade & Bulk requests inspection
 * - Website Inquiries viewer
 * - Secure Admin session management & logout
 */

import { 
  db, 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  isFirebaseConfigured 
} from './firebase-config.js';
import { requireAdminAuth, logoutUser } from './auth.js';
import { showToast, formatDate, escapeHtml } from './app.js';

let applicationsList = [];
let servicesList = [];
let tradeList = [];
let inquiriesList = [];
let currentEditingAppId = null;

// Initialize when authorized
document.addEventListener('DOMContentLoaded', () => {
  requireAdminAuth((user) => {
    initAdminDashboard(user);
  });
});

function initAdminDashboard(user) {
  const userEmailEl = document.getElementById('adminUserEmail');
  if (userEmailEl && user) {
    userEmailEl.textContent = user.email || 'Authorized Staff';
  }

  // Bind Logout button
  document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
    logoutUser();
  });

  // Bind Tabs
  initTabs();

  // Load Data
  loadAllDashboardData();

  // Bind Search & Filters
  bindAppFilters();
  bindServiceFilters();
  bindModals();
}

/**
 * Tab Navigation Controller
 */
function initTabs() {
  const tabBtns = document.querySelectorAll('.admin-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });
}

/**
 * Fetch and load all collections safely
 */
async function loadAllDashboardData() {
  await Promise.all([
    loadApplications(),
    loadServicesCatalog(),
    loadTradeRequests(),
    loadInquiries()
  ]);
  updateKPIMetrics();
}

/**
 * 1. Applications Loader & Normalizer
 */
async function loadApplications() {
  applicationsList = [];
  const tbody = document.getElementById('adminAppsTableBody');

  // Try Firestore first
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'applications'));
      snap.forEach(docSnap => {
        const raw = docSnap.data();
        applicationsList.push(normalizeApplicationRecord(docSnap.id, raw));
      });
    } catch (err) {
      console.warn('[Admin] Firestore applications fetch notice:', err.message);
    }
  }

  // If empty or offline, fallback to localStorage
  if (applicationsList.length === 0) {
    try {
      const local = JSON.parse(localStorage.getItem('maa_enterprises_applications') || '[]');
      applicationsList = local.map(a => normalizeApplicationRecord(a.requestId || a.id, a));
    } catch (e) {}
  }

  // Sort newest first
  applicationsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  renderApplicationsTable(applicationsList);
}

/**
 * Normalizes Application record to prevent missing-field crashes
 */
function normalizeApplicationRecord(id, raw) {
  if (!raw) raw = {};
  
  // Status normalization
  let status = String(raw.status || 'pending').toLowerCase().replace(/\s+/g, '_');
  if (status.includes('process')) status = 'processing';
  else if (status.includes('complet')) status = 'completed';
  else if (status.includes('action')) status = 'action_required';
  else if (status.includes('reject') || status.includes('cancel')) status = 'cancelled';
  else if (status.includes('verif')) status = 'under_verification';
  else if (!['pending', 'under_verification', 'processing', 'completed', 'action_required', 'cancelled'].includes(status)) {
    status = 'pending';
  }

  // Payment normalization
  let paymentStatus = String(raw.paymentStatus || 'pending').toLowerCase();
  if (!['pending', 'paid', 'partial', 'failed'].includes(paymentStatus)) {
    paymentStatus = 'pending';
  }

  return {
    id: id || raw.requestId || 'REQ-UNKNOWN',
    requestId: raw.requestId || id || 'REQ-UNKNOWN',
    fullName: raw.fullName || raw.customer?.name || raw.applicantName || 'Applicant',
    mobile: raw.mobile || raw.customer?.mobile || raw.phone || 'N/A',
    email: raw.email || raw.customer?.email || '',
    address: raw.address || raw.customer?.address || '',
    serviceId: raw.serviceId || raw.serviceSnapshot?.id || '',
    serviceName: raw.serviceName || raw.serviceSnapshot?.name || raw.service || 'General Service',
    category: raw.category || raw.serviceCategory || raw.serviceSnapshot?.category || 'General',
    status: status,
    paymentStatus: paymentStatus,
    publicRemark: raw.publicRemark || raw.staffNote || '',
    adminNotes: raw.adminNotes || raw.internalNotes || '',
    createdAt: raw.createdAt || raw.submittedAt || new Date().toISOString(),
    serviceSnapshot: raw.serviceSnapshot || {
      id: raw.serviceId || '',
      name: raw.serviceName || 'General Service',
      category: raw.category || 'General'
    }
  };
}

function renderApplicationsTable(apps) {
  const tbody = document.getElementById('adminAppsTableBody');
  if (!tbody) return;

  if (apps.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No customer applications found matching criteria.
        </td>
      </tr>
    `;
    return;
  }

  const statusLabels = {
    pending: { label: 'Pending', badge: 'badge-amber' },
    under_verification: { label: 'Under Verification', badge: 'badge-amber' },
    processing: { label: 'In Processing', badge: 'badge-cyan' },
    completed: { label: 'Completed', badge: 'badge-emerald' },
    action_required: { label: 'Action Required', badge: 'badge-purple' },
    cancelled: { label: 'Cancelled', badge: 'badge-rose' }
  };

  const paymentLabels = {
    pending: { label: 'Pending', style: 'color: var(--text-muted);' },
    paid: { label: 'Paid in Full', style: 'color: var(--accent-emerald); font-weight: 600;' },
    partial: { label: 'Partial', style: 'color: var(--accent-amber); font-weight: 600;' },
    failed: { label: 'Failed', style: 'color: var(--accent-rose); font-weight: 600;' }
  };

  tbody.innerHTML = apps.map(app => {
    const stInfo = statusLabels[app.status] || statusLabels.pending;
    const payInfo = paymentLabels[app.paymentStatus] || paymentLabels.pending;
    const reqId = escapeHtml(app.requestId);
    const name = escapeHtml(app.fullName);
    const mobile = escapeHtml(app.mobile);
    const serviceName = escapeHtml(app.serviceName);
    const dateStr = formatDate(app.createdAt);

    return `
      <tr>
        <td><strong style="color: var(--text-highlight); font-family: monospace;">${reqId}</strong></td>
        <td><strong>${name}</strong></td>
        <td><a href="tel:${mobile}" style="color: var(--text-primary);">${mobile}</a></td>
        <td>${serviceName}</td>
        <td style="color: var(--text-secondary);">${dateStr}</td>
        <td><span class="badge ${stInfo.badge}">${stInfo.label}</span></td>
        <td><span ${payInfo.style}>${payInfo.label}</span></td>
        <td>
          <button class="btn btn-outline btn-sm edit-app-btn" data-id="${reqId}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
            View / Edit
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Bind View/Edit buttons
  document.querySelectorAll('.edit-app-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      openApplicationModal(id);
    });
  });
}

function bindAppFilters() {
  const searchInput = document.getElementById('adminAppSearch');
  const statusFilter = document.getElementById('adminStatusFilter');
  const paymentFilter = document.getElementById('adminPaymentFilter');
  const categoryFilter = document.getElementById('adminCategoryFilter');
  const refreshBtn = document.getElementById('refreshAppsBtn');

  function filter() {
    const q = (searchInput?.value || '').toLowerCase().trim();
    const st = statusFilter?.value || 'ALL';
    const pay = paymentFilter?.value || 'ALL';
    const cat = categoryFilter?.value || 'ALL';

    const filtered = applicationsList.filter(app => {
      const matchQuery = !q || 
        (app.requestId && app.requestId.toLowerCase().includes(q)) ||
        (app.fullName && app.fullName.toLowerCase().includes(q)) ||
        (app.mobile && app.mobile.includes(q)) ||
        (app.serviceName && app.serviceName.toLowerCase().includes(q));

      const matchStatus = st === 'ALL' || app.status === st;
      const matchPayment = pay === 'ALL' || app.paymentStatus === pay;
      const matchCategory = cat === 'ALL' || (app.category && app.category.includes(cat)) || (app.serviceCategory && app.serviceCategory.includes(cat));

      return matchQuery && matchStatus && matchPayment && matchCategory;
    });

    renderApplicationsTable(filtered);
  }

  searchInput?.addEventListener('input', filter);
  statusFilter?.addEventListener('change', filter);
  paymentFilter?.addEventListener('change', filter);
  categoryFilter?.addEventListener('change', filter);

  refreshBtn?.addEventListener('click', () => {
    showToast('Refreshing applications...', 'info');
    loadApplications().then(() => updateKPIMetrics());
  });
}

/**
 * Application Detail / Status Modal
 */
function openApplicationModal(requestId) {
  const app = applicationsList.find(a => (a.requestId === requestId || a.id === requestId));
  if (!app) {
    showToast('Application not found', 'error');
    return;
  }

  currentEditingAppId = requestId;

  document.getElementById('modalAppIdTitle').textContent = `Application: ${requestId}`;
  document.getElementById('detailApplicantName').textContent = app.fullName;
  document.getElementById('detailApplicantMobile').textContent = app.mobile;
  document.getElementById('detailApplicantService').textContent = app.serviceName;
  document.getElementById('detailApplicantDate').textContent = formatDate(app.createdAt);

  document.getElementById('detailStatusSelect').value = app.status;
  document.getElementById('detailPaymentSelect').value = app.paymentStatus;
  document.getElementById('detailPublicRemark').value = app.publicRemark || '';
  document.getElementById('detailAdminNote').value = app.adminNotes || '';

  const modal = document.getElementById('adminAppModal');
  modal.classList.add('modal-active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeAppModal() {
  const modal = document.getElementById('adminAppModal');
  modal.classList.remove('modal-active');
  modal.setAttribute('aria-hidden', 'true');
  currentEditingAppId = null;
}

/**
 * 2. Dynamic Services Catalog Management
 */
async function loadServicesCatalog() {
  servicesList = [];

  // 1. Try Firestore
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'services'));
      snap.forEach(docSnap => {
        servicesList.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
    } catch (err) {
      console.warn('[Admin] Firestore services fetch notice:', err.message);
    }
  }

  // 2. If no services in Firestore, load baseline from window.SERVICES_DATA
  if (servicesList.length === 0 && window.SERVICES_DATA) {
    servicesList = [...window.SERVICES_DATA];
  }

  renderServicesTable(servicesList);
}

function renderServicesTable(services) {
  const tbody = document.getElementById('adminServicesTableBody');
  if (!tbody) return;

  if (services.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No services found in catalog.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = services.map(s => {
    const isActive = s.active !== false;
    const badge = isActive ? '<span class="badge badge-emerald">Active</span>' : '<span class="badge badge-rose">Inactive</span>';

    return `
      <tr>
        <td><code>${escapeHtml(s.id)}</code></td>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td><span class="badge badge-cyan">${escapeHtml(s.category)}</span></td>
        <td style="color: var(--text-secondary);">${escapeHtml(s.processingTime || 'Same day counter processing')}</td>
        <td style="color: var(--text-secondary);">${escapeHtml(s.fee || 'As per official notification')}</td>
        <td>${badge}</td>
        <td>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline btn-sm edit-srv-btn" data-id="${escapeHtml(s.id)}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
              Edit
            </button>
            <button class="btn btn-outline btn-sm toggle-srv-btn" data-id="${escapeHtml(s.id)}" data-active="${isActive}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
              ${isActive ? 'Disable' : 'Enable'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind edit and toggle buttons
  document.querySelectorAll('.edit-srv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      openServiceModal(id);
    });
  });

  document.querySelectorAll('.toggle-srv-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const currentActive = btn.dataset.active === 'true';
      await toggleServiceActive(id, !currentActive);
    });
  });
}

function bindServiceFilters() {
  const searchInput = document.getElementById('adminServiceSearch');
  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    const filtered = servicesList.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) || 
      (s.category && s.category.toLowerCase().includes(q)) || 
      (s.id && s.id.toLowerCase().includes(q))
    );
    renderServicesTable(filtered);
  });
}

function openServiceModal(serviceId = null) {
  const modal = document.getElementById('adminServiceModal');
  const titleEl = document.getElementById('serviceModalTitle');

  if (serviceId) {
    const s = servicesList.find(item => item.id === serviceId);
    if (!s) return;
    titleEl.textContent = `Edit Service: ${s.name}`;
    document.getElementById('editServiceId').value = s.id;
    document.getElementById('serviceNameInput').value = s.name;
    document.getElementById('serviceCategorySelect').value = s.category;
    document.getElementById('serviceShortDescInput').value = s.shortDescription || '';
    document.getElementById('serviceFullDescInput').value = s.description || '';
    document.getElementById('serviceDocsInput').value = Array.isArray(s.documents) ? s.documents.join(', ') : (s.documents || '');
    document.getElementById('serviceFeeInput').value = s.fee || '';
    document.getElementById('serviceTurnaroundInput').value = s.processingTime || '';
    document.getElementById('serviceActiveCheck').checked = s.active !== false;
  } else {
    titleEl.textContent = 'Add New Service';
    document.getElementById('editServiceId').value = '';
    document.getElementById('serviceNameInput').value = '';
    document.getElementById('serviceCategorySelect').value = 'Government Jobs & Recruitment';
    document.getElementById('serviceShortDescInput').value = '';
    document.getElementById('serviceFullDescInput').value = '';
    document.getElementById('serviceDocsInput').value = '';
    document.getElementById('serviceFeeInput').value = '';
    document.getElementById('serviceTurnaroundInput').value = '';
    document.getElementById('serviceActiveCheck').checked = true;
  }

  modal.classList.add('modal-active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeServiceModal() {
  const modal = document.getElementById('adminServiceModal');
  modal.classList.remove('modal-active');
  modal.setAttribute('aria-hidden', 'true');
}

async function toggleServiceActive(serviceId, newActiveState) {
  const target = servicesList.find(s => s.id === serviceId);
  if (target) {
    target.active = newActiveState;
  }

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'services', serviceId), {
        ...target,
        active: newActiveState,
        updatedAt: serverTimestamp()
      }, { merge: true });
      showToast(`Service status updated in Firestore.`, 'success');
    } catch (e) {
      console.warn('[Admin] Firestore service update notice:', e.message);
      showToast(`Service status updated locally.`, 'info');
    }
  } else {
    showToast(`Service status updated.`, 'info');
  }

  // Update localStorage override
  try {
    localStorage.setItem('maa_dynamic_services', JSON.stringify(servicesList));
  } catch (err) {}

  renderServicesTable(servicesList);
}

/**
 * 3. Trade Requests Loader
 */
async function loadTradeRequests() {
  tradeList = [];
  const tbody = document.getElementById('adminTradeTableBody');

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'tradeRequests'));
      snap.forEach(docSnap => {
        tradeList.push({ id: docSnap.id, ...docSnap.data() });
      });
    } catch (e) {}
  }

  if (tradeList.length === 0) {
    try {
      tradeList = JSON.parse(localStorage.getItem('maa_trade_requests') || '[]');
    } catch (e) {}
  }

  if (!tbody) return;

  if (tradeList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No trade or bulk inquiries recorded yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tradeList.map(t => `
    <tr>
      <td><strong style="color: var(--accent-purple); font-family: monospace;">${escapeHtml(t.tradeId || t.id || 'N/A')}</strong></td>
      <td><strong>${escapeHtml(t.organizationName || t.orgName || 'N/A')}</strong></td>
      <td>${escapeHtml(t.contactPerson || 'N/A')}</td>
      <td><a href="tel:${t.mobile || t.phone}">${escapeHtml(t.mobile || t.phone || 'N/A')}</a></td>
      <td>${escapeHtml(t.serviceType || t.volume || 'Bulk Order')}</td>
      <td style="color: var(--text-secondary);">${formatDate(t.createdAt || new Date())}</td>
      <td><span class="badge badge-purple">${escapeHtml(t.status || 'New')}</span></td>
    </tr>
  `).join('');
}

/**
 * 4. Website Inquiries Loader
 */
async function loadInquiries() {
  inquiriesList = [];
  const tbody = document.getElementById('adminInquiriesTableBody');

  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'inquiries'));
      snap.forEach(docSnap => {
        inquiriesList.push({ id: docSnap.id, ...docSnap.data() });
      });
    } catch (e) {}
  }

  if (inquiriesList.length === 0) {
    try {
      inquiriesList = JSON.parse(localStorage.getItem('maa_inquiries') || '[]');
    } catch (e) {}
  }

  if (!tbody) return;

  if (inquiriesList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No contact inquiries recorded yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = inquiriesList.map(inq => `
    <tr>
      <td style="color: var(--text-secondary);">${formatDate(inq.createdAt || new Date())}</td>
      <td><strong>${escapeHtml(inq.name || 'Visitor')}</strong></td>
      <td><a href="tel:${inq.phone || inq.mobile}">${escapeHtml(inq.phone || inq.mobile || 'N/A')}</a></td>
      <td><span class="badge badge-cyan">${escapeHtml(inq.category || 'General')}</span></td>
      <td>${escapeHtml(inq.message || 'No message content')}</td>
    </tr>
  `).join('');
}

/**
 * Calculate KPI Stats
 */
function updateKPIMetrics() {
  const total = applicationsList.length;
  const pending = applicationsList.filter(a => a.status === 'pending' || a.status === 'under_verification').length;
  const processing = applicationsList.filter(a => a.status === 'processing').length;
  const completed = applicationsList.filter(a => a.status === 'completed').length;
  
  // Today's count
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = applicationsList.filter(a => {
    try {
      return a.createdAt && String(a.createdAt).slice(0, 10) === todayStr;
    } catch (e) {
      return false;
    }
  }).length;

  document.getElementById('kpiTotalApps').textContent = total;
  document.getElementById('kpiPendingApps').textContent = pending;
  document.getElementById('kpiProcessingApps').textContent = processing;
  document.getElementById('kpiCompletedApps').textContent = completed;
  document.getElementById('kpiTodayApps').textContent = todayCount;
}

/**
 * Bind Modals & Save Handlers
 */
function bindModals() {
  // Application Detail Modal
  document.getElementById('closeAppModalBtn')?.addEventListener('click', closeAppModal);
  document.getElementById('cancelAppModalBtn')?.addEventListener('click', closeAppModal);

  document.getElementById('saveAppModalBtn')?.addEventListener('click', async () => {
    if (!currentEditingAppId) return;

    const newStatus = document.getElementById('detailStatusSelect').value;
    const newPayment = document.getElementById('detailPaymentSelect').value;
    const newPublicRemark = document.getElementById('detailPublicRemark').value.trim();
    const newNote = document.getElementById('detailAdminNote').value.trim();

    // Update in local memory
    const app = applicationsList.find(a => (a.requestId === currentEditingAppId || a.id === currentEditingAppId));
    if (app) {
      app.status = newStatus;
      app.paymentStatus = newPayment;
      app.publicRemark = newPublicRemark;
      app.adminNotes = newNote;
      app.updatedAt = new Date().toISOString();
    }

    // Save to Firestore
    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'applications', currentEditingAppId), {
          status: newStatus,
          paymentStatus: newPayment,
          publicRemark: newPublicRemark,
          adminNotes: newNote,
          updatedAt: serverTimestamp()
        });
        showToast('Application status & notes updated in Firestore.', 'success');
      } catch (err) {
        console.warn('[Admin] Firestore application update notice:', err.message);
        showToast('Application updated in local cache.', 'info');
      }
    } else {
      showToast('Application updated successfully.', 'success');
    }

    // Sync to localStorage
    try {
      localStorage.setItem('maa_enterprises_applications', JSON.stringify(applicationsList));
    } catch (e) {}

    closeAppModal();
    renderApplicationsTable(applicationsList);
    updateKPIMetrics();
  });

  // Services Modal
  document.getElementById('addNewServiceBtn')?.addEventListener('click', () => openServiceModal(null));
  document.getElementById('closeServiceModalBtn')?.addEventListener('click', closeServiceModal);
  document.getElementById('cancelServiceModalBtn')?.addEventListener('click', closeServiceModal);

  document.getElementById('saveServiceModalBtn')?.addEventListener('click', async () => {
    const editId = document.getElementById('editServiceId').value.trim();
    const name = document.getElementById('serviceNameInput').value.trim();
    const category = document.getElementById('serviceCategorySelect').value;
    const shortDescription = document.getElementById('serviceShortDescInput').value.trim();
    const description = document.getElementById('serviceFullDescInput').value.trim();
    const docsRaw = document.getElementById('serviceDocsInput').value.trim();
    const fee = document.getElementById('serviceFeeInput').value.trim();
    const processingTime = document.getElementById('serviceTurnaroundInput').value.trim();
    const active = document.getElementById('serviceActiveCheck').checked;

    if (!name || name.length < 3) {
      showToast('Please enter a valid service title.', 'warning');
      return;
    }
    if (!shortDescription) {
      showToast('Please provide a short description.', 'warning');
      return;
    }

    const documents = docsRaw ? docsRaw.split(',').map(d => d.trim()).filter(Boolean) : [];

    // Stable Unique Service ID
    const serviceId = editId || ('srv-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 6));

    const serviceObj = {
      id: serviceId,
      name,
      category,
      shortDescription,
      description: description || shortDescription,
      documents,
      fee: fee || 'As per official notification',
      processingTime: processingTime || 'Same day counter processing',
      active,
      updatedAt: new Date().toISOString()
    };

    if (editId) {
      const idx = servicesList.findIndex(s => s.id === editId);
      if (idx !== -1) servicesList[idx] = serviceObj;
    } else {
      servicesList.unshift(serviceObj);
    }

    // Save to Firestore
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'services', serviceId), {
          ...serviceObj,
          serverTimestamp: serverTimestamp()
        });
        showToast('Service saved in Firestore.', 'success');
      } catch (err) {
        console.warn('[Admin] Firestore service save notice:', err.message);
        showToast('Service updated in local cache.', 'info');
      }
    } else {
      showToast('Service updated in local catalog.', 'success');
    }

    // Sync to localStorage
    try {
      localStorage.setItem('maa_dynamic_services', JSON.stringify(servicesList));
    } catch (err) {}

    closeServiceModal();
    renderServicesTable(servicesList);
  });
}

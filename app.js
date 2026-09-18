/**
 * CampusFindIt - Next Gen Frontend Application Logic
 * Integrates with Python / Node SQLite REST API
 */

// Application State
const state = {
    items: [],
    selectedType: '',
    selectedStatus: '',
    selectedCategory: 'All',
    searchQuery: '',
    currentItemId: null
};

// Category Unsplash Cover Presets
const categoryDefaultImages = {
    "Electronics": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80",
    "ID & Wallet": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&q=80",
    "Keys": "https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600&q=80",
    "Books": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80",
    "Apparel": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80",
    "Other": "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=600&q=80"
};

// DOM References
const elements = {
    statTotal: document.getElementById('stat-total'),
    statLost: document.getElementById('stat-lost'),
    statFound: document.getElementById('stat-found'),
    statReunited: document.getElementById('stat-reunited'),
    
    searchInput: document.getElementById('search-input'),
    statusTabsGroup: document.getElementById('status-tabs-group'),
    categorySelect: document.getElementById('category-select'),
    categoryQuickbar: document.getElementById('category-quickbar'),
    
    sectionHeading: document.getElementById('section-heading'),
    countBadgePill: document.getElementById('count-badge-pill'),
    cardsGrid: document.getElementById('cards-grid'),
    emptyStateBox: document.getElementById('empty-state-box'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    
    reportModal: document.getElementById('report-modal'),
    btnOpenReportModal: document.getElementById('btn-open-report-modal'),
    fabReportBtn: document.getElementById('fab-report-btn'),
    btnCloseReport: document.getElementById('btn-close-report'),
    btnCancelReport: document.getElementById('btn-cancel-report'),
    reportForm: document.getElementById('report-form'),
    formDate: document.getElementById('form_date'),
    
    detailsModal: document.getElementById('details-modal'),
    btnCloseDetails: document.getElementById('btn-close-details'),
    detailTypeBadge: document.getElementById('detail-type-badge'),
    detailImg: document.getElementById('detail-img'),
    detailTitle: document.getElementById('detail-title'),
    detailCategory: document.getElementById('detail-category'),
    detailLocation: document.getElementById('detail-location'),
    detailDate: document.getElementById('detail-date'),
    detailDesc: document.getElementById('detail-desc'),
    detailContactPerson: document.getElementById('detail-contact-person'),
    detailContactInfo: document.getElementById('detail-contact-info'),
    btnMarkReunited: document.getElementById('btn-mark-reunited'),
    btnDeleteItem: document.getElementById('btn-delete-item'),
    
    toastStack: document.getElementById('toast-stack')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    if (elements.formDate) {
        elements.formDate.value = new Date().toISOString().split('T')[0];
    }
    
    setupEventListeners();
    fetchStats();
    fetchItems();
});

function setupEventListeners() {
    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        fetchItems();
    });

    // Ctrl + K shortcut
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            elements.searchInput.focus();
        }
    });

    // Quick category pills bar
    elements.categoryQuickbar.querySelectorAll('.cat-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            elements.categoryQuickbar.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            
            const cat = target.getAttribute('data-cat');
            state.selectedCategory = cat;
            elements.categorySelect.value = cat;
            fetchItems();
        });
    });

    // Category dropdown
    elements.categorySelect.addEventListener('change', (e) => {
        const cat = e.target.value;
        state.selectedCategory = cat;
        
        elements.categoryQuickbar.querySelectorAll('.cat-pill').forEach(pill => {
            pill.classList.toggle('active', pill.getAttribute('data-cat') === cat);
        });
        
        fetchItems();
    });

    // Status filter tabs
    elements.statusTabsGroup.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.statusTabsGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            
            state.selectedType = target.getAttribute('data-type') || '';
            state.selectedStatus = target.getAttribute('data-status') || '';
            fetchItems();
        });
    });

    // Reset filters
    elements.btnResetFilters.addEventListener('click', () => {
        state.searchQuery = '';
        state.selectedType = '';
        state.selectedStatus = '';
        state.selectedCategory = 'All';
        
        elements.searchInput.value = '';
        elements.categorySelect.value = 'All';
        
        elements.categoryQuickbar.querySelectorAll('.cat-pill').forEach((p, idx) => p.classList.toggle('active', idx === 0));
        elements.statusTabsGroup.querySelectorAll('.tab-btn').forEach((b, idx) => b.classList.toggle('active', idx === 0));
        
        fetchItems();
    });

    // Report modal handlers
    const openReport = () => elements.reportModal.classList.remove('hidden');
    const closeReport = () => {
        elements.reportModal.classList.add('hidden');
        elements.reportForm.reset();
        if (elements.formDate) elements.formDate.value = new Date().toISOString().split('T')[0];
    };

    elements.btnOpenReportModal.addEventListener('click', openReport);
    if (elements.fabReportBtn) elements.fabReportBtn.addEventListener('click', openReport);
    elements.btnCloseReport.addEventListener('click', closeReport);
    elements.btnCancelReport.addEventListener('click', closeReport);
    elements.reportForm.addEventListener('submit', handleReportSubmit);

    // Details modal handlers
    elements.btnCloseDetails.addEventListener('click', () => elements.detailsModal.classList.add('hidden'));
    elements.btnMarkReunited.addEventListener('click', handleMarkReunited);
    elements.btnDeleteItem.addEventListener('click', handleDeleteItem);

    // Background click dismiss
    window.addEventListener('click', (e) => {
        if (e.target === elements.reportModal) closeReport();
        if (e.target === elements.detailsModal) elements.detailsModal.classList.add('hidden');
    });
}

// Fetch Stats from API
async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) return;
        const data = await res.json();
        
        animateCounter(elements.statTotal, data.total || 0);
        animateCounter(elements.statLost, data.lost || 0);
        animateCounter(elements.statFound, data.found || 0);
        animateCounter(elements.statReunited, data.reunited || 0);
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

// Animated Counter Effect
function animateCounter(el, targetVal) {
    if (!el) return;
    const startVal = parseInt(el.textContent) || 0;
    const duration = 600;
    const steps = 20;
    const increment = (targetVal - startVal) / steps;
    let current = startVal;
    let stepCount = 0;

    const timer = setInterval(() => {
        stepCount++;
        current += increment;
        el.textContent = Math.round(current);
        if (stepCount >= steps) {
            el.textContent = targetVal;
            clearInterval(timer);
        }
    }, duration / steps);
}

// Fetch Items with Filters
async function fetchItems() {
    try {
        const params = new URLSearchParams();
        if (state.selectedType) params.append('type', state.selectedType);
        if (state.selectedStatus) params.append('status', state.selectedStatus);
        if (state.selectedCategory && state.selectedCategory !== 'All') params.append('category', state.selectedCategory);
        if (state.searchQuery) params.append('search', state.searchQuery);

        const res = await fetch(`/api/items?${params.toString()}`);
        if (!res.ok) throw new Error('API fetch failed');
        const items = await res.json();

        state.items = items;
        renderItems(items);
    } catch (err) {
        console.error('Fetch items error:', err);
        elements.cardsGrid.innerHTML = `
            <div class="empty-box">
                <div class="empty-icon-circle"><i class="fa-solid fa-triangle-exclamation" style="color: var(--lost-color);"></i></div>
                <h3>Unable to connect to Backend Server</h3>
                <p style="color: var(--text-muted);">Ensure python server.py is running on http://localhost:5000</p>
            </div>
        `;
    }
}

// Render Item Cards
function renderItems(items) {
    elements.countBadgePill.textContent = `Showing ${items.length} ${items.length === 1 ? 'item' : 'items'}`;
    
    if (items.length === 0) {
        elements.cardsGrid.innerHTML = '';
        elements.emptyStateBox.classList.remove('hidden');
        return;
    }

    elements.emptyStateBox.classList.add('hidden');
    elements.cardsGrid.innerHTML = items.map(item => {
        const statusClass = item.status === 'REUNITED' ? 'reunited' : item.type.toLowerCase();
        const statusLabel = item.status === 'REUNITED' ? 'REUNITED' : item.type;
        const fallbackImg = categoryDefaultImages[item.category] || categoryDefaultImages['Other'];
        const displayImg = item.image_url && item.image_url.trim() !== '' ? item.image_url : fallbackImg;
        
        return `
            <div class="item-card" onclick="openDetailsModal(${item.id})">
                <div class="card-img-wrapper">
                    <img src="${displayImg}" alt="${escapeHtml(item.title)}" onerror="this.src='${fallbackImg}'">
                    <span class="badge-status ${statusClass}">${statusLabel}</span>
                    <span class="badge-cat">${escapeHtml(item.category)}</span>
                </div>
                <div class="card-content">
                    <h3 class="card-item-title">${escapeHtml(item.title)}</h3>
                    <div class="card-location-tag">
                        <i class="fa-solid fa-location-dot"></i> ${escapeHtml(item.location)}
                    </div>
                    <p class="card-description">${escapeHtml(item.description)}</p>
                    <div class="card-bottom-bar">
                        <span class="card-date"><i class="fa-solid fa-calendar-day"></i> ${escapeHtml(item.date_reported)}</span>
                        <button class="btn-view-details">Details <i class="fa-solid fa-arrow-right"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// View Details Modal
function openDetailsModal(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;

    state.currentItemId = id;
    
    const statusClass = item.status === 'REUNITED' ? 'reunited' : item.type.toLowerCase();
    elements.detailTypeBadge.className = `badge-status ${statusClass}`;
    elements.detailTypeBadge.textContent = item.status === 'REUNITED' ? 'REUNITED / CLAIMED' : item.type;
    
    const fallbackImg = categoryDefaultImages[item.category] || categoryDefaultImages['Other'];
    elements.detailImg.src = item.image_url && item.image_url.trim() !== '' ? item.image_url : fallbackImg;
    elements.detailImg.onerror = () => { elements.detailImg.src = fallbackImg; };
    
    elements.detailTitle.textContent = item.title;
    elements.detailCategory.textContent = item.category;
    elements.detailLocation.textContent = item.location;
    elements.detailDate.textContent = item.date_reported;
    elements.detailDesc.textContent = item.description;
    elements.detailContactPerson.textContent = item.contact_name;
    elements.detailContactInfo.textContent = item.contact_info;

    elements.btnMarkReunited.style.display = item.status === 'REUNITED' ? 'none' : 'inline-flex';
    elements.detailsModal.classList.remove('hidden');
}

// Form Submit Handler
async function handleReportSubmit(e) {
    e.preventDefault();
    
    const payload = {
        type: document.querySelector('input[name="form_type"]:checked').value,
        title: document.getElementById('form_title').value.trim(),
        category: document.getElementById('form_category').value,
        date_reported: document.getElementById('form_date').value,
        location: document.getElementById('form_location').value.trim(),
        description: document.getElementById('form_description').value.trim(),
        contact_name: document.getElementById('form_contact_name').value.trim(),
        contact_info: document.getElementById('form_contact_info').value.trim(),
        image_url: document.getElementById('form_image_url').value.trim()
    };

    try {
        const res = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Submission failed');
        
        showToast('Item report published successfully!', 'success');
        elements.reportModal.classList.add('hidden');
        elements.reportForm.reset();
        
        fetchStats();
        fetchItems();
    } catch (err) {
        showToast('Error publishing report. Try again.', 'error');
    }
}

// Mark Reunited
async function handleMarkReunited() {
    if (!state.currentItemId) return;

    try {
        const res = await fetch(`/api/items/${state.currentItemId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'REUNITED' })
        });

        if (!res.ok) throw new Error('Status update failed');

        showToast('Item marked as Reunited!', 'success');
        elements.detailsModal.classList.add('hidden');
        
        fetchStats();
        fetchItems();
    } catch (err) {
        showToast('Failed to update status.', 'error');
    }
}

// Delete Item
async function handleDeleteItem() {
    if (!state.currentItemId) return;
    
    if (!confirm('Are you sure you want to remove this record from the database?')) {
        return;
    }

    try {
        const res = await fetch(`/api/items/${state.currentItemId}`, {
            method: 'DELETE'
        });

        if (!res.ok) throw new Error('Delete failed');

        showToast('Listing deleted successfully.', 'success');
        elements.detailsModal.classList.add('hidden');
        
        fetchStats();
        fetchItems();
    } catch (err) {
        showToast('Failed to delete item.', 'error');
    }
}

// Toast System
function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(msg)}</span>`;
    
    elements.toastStack.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

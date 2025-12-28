// Meisner FFE Clipper - Popup Script v1.2.0

// Environment Configuration
const ENVIRONMENT = 'production'; // Change to 'local' for development

// Extension Version
const EXTENSION_VERSION = '1.2.1';

// Configuration
const CONFIG = {
  API_URLS: {
    local: 'http://localhost:3000',
    production: 'https://app.meisnerinteriors.com'
  },
  get API_BASE_URL() {
    return this.API_URLS[ENVIRONMENT] || this.API_URLS.local;
  },
  ENDPOINTS: {
    AUTH: '/api/extension/auth',
    PROJECTS: '/api/extension/projects',
    ROOMS: '/api/extension/rooms',
    SECTIONS: '/api/extension/sections',
    CLIP: '/api/extension/clip',
    SMART_FILL: '/api/extension/smart-fill',
    PENDING_ITEMS: '/api/extension/pending-items',
    SUPPLIERS: '/api/extension/suppliers',
    SIMILAR_ITEMS: '/api/extension/similar-items',
    VERSION: '/api/extension/version'
  }
};

// State
let state = {
  isAuthenticated: false,
  user: null,
  apiKey: null,
  projects: [],
  rooms: [],
  sections: [],
  ffeItems: [], // FFE items in selected section for linking
  similarItems: [], // Similar items across project for multi-linking
  selectedSimilarItems: [], // IDs of similar items selected for linking
  suppliers: [], // Suppliers from phonebook
  categories: [], // Product categories for library
  destination: 'room', // 'room', 'library', or 'both'
  selectedProject: null,
  selectedRoom: null,
  selectedSection: null,
  selectedCategory: null,
  selectedFfeItems: [], // FFE items to link to (multi-select)
  createNewItem: true, // Whether to create a new item (default) or link to existing
  selectedSupplier: null, // Selected supplier from phonebook
  clippedData: {
    images: [],
    attachments: [],
    productName: '',
    productDescription: '',
    brand: '',
    productWebsite: '',
    docCode: '',
    sku: '',
    colour: '',
    finish: '',
    material: '',
    width: '',
    height: '',
    depth: '',
    length: '',
    quantity: 1,
    rrp: '',
    tradePrice: '',
    leadTime: '',
    notes: ''
  },
  activePickerField: null
};

// DOM Elements
const elements = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  initEventListeners();
  await checkAuth();
  await getCurrentPageUrl();
  await loadPendingImages();
  await loadFormState();
  
  // Check for updates (non-blocking)
  checkForUpdates();
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
      if (changes.pickerResult?.newValue) {
        const stored = await chrome.storage.local.get(['pickerResult', 'pickerField']);
        const pickerResult = stored.pickerResult;
        const pickerField = stored.pickerField;
        
        if (pickerResult && pickerField) {
          state.clippedData[pickerField] = pickerResult;
          const input = document.getElementById(pickerField);
          if (input) input.value = pickerResult;
          showToast(`Text captured for ${formatFieldLabel(pickerField)}!`, 'success');
          chrome.storage.local.remove(['pickerResult', 'pickerField', 'pickerFieldName']);
        }
      }
      
      if (changes.pendingImages?.newValue?.length > 0) {
        loadPendingImages();
      }
    }
  });
});

// Check for extension updates
async function checkForUpdates() {
  try {
    const response = await apiRequest('GET', CONFIG.ENDPOINTS.VERSION);
    
    if (response.ok && response.data?.latestVersion) {
      const latestVersion = response.data.latestVersion;
      
      if (isNewerVersion(latestVersion, EXTENSION_VERSION)) {
        showUpdateAvailable(latestVersion, response.data.downloadUrl);
      }
    }
  } catch (error) {
    // Silently fail - version check is non-critical
    console.log('Version check skipped:', error.message);
  }
}

// Compare version strings (returns true if v1 > v2)
function isNewerVersion(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return true;
    if (p1 < p2) return false;
  }
  return false;
}

// Show update available notification
function showUpdateAvailable(newVersion, downloadUrl) {
  const versionEl = document.querySelector('.version');
  if (versionEl) {
    versionEl.innerHTML = `
      <div class="update-available">
        <span>🎉 Update available: v${newVersion}</span>
        <a href="${downloadUrl || CONFIG.API_BASE_URL + '/settings'}" target="_blank" class="update-link">Download</a>
      </div>
      <span class="current-version">Current: v${EXTENSION_VERSION}</span>
    `;
    versionEl.classList.add('has-update');
  }
}

// Initialize DOM elements
function initElements() {
  elements.authSection = document.getElementById('authSection');
  elements.mainSection = document.getElementById('mainSection');
  elements.loginBtn = document.getElementById('loginBtn');
  elements.projectSelect = document.getElementById('projectSelect');
  elements.roomSelect = document.getElementById('roomSelect');
  elements.sectionSelect = document.getElementById('sectionSelect');
  elements.ffeItemsList = document.getElementById('ffeItemsList');
  elements.supplierSelect = document.getElementById('supplierSelect');
  elements.smartFillBtn = document.getElementById('smartFillBtn');
  elements.clipBtn = document.getElementById('clipBtn');
  elements.clearBtn = document.getElementById('clearBtn');
  elements.loadingOverlay = document.getElementById('loadingOverlay');
  elements.loadingText = document.getElementById('loadingText');
  elements.toast = document.getElementById('toast');
  elements.toastMessage = document.getElementById('toastMessage');
  elements.imagesContainer = document.getElementById('imagesContainer');
  elements.locationSelectors = document.getElementById('locationSelectors');
  // Breadcrumb
  elements.locationBreadcrumb = document.getElementById('locationBreadcrumb');
  elements.breadcrumbTags = document.getElementById('breadcrumbTags');
  // Cascade steps
  elements.projectStep = document.getElementById('projectStep');
  elements.roomStep = document.getElementById('roomStep');
  elements.sectionStep = document.getElementById('sectionStep');
  elements.ffeItemStep = document.getElementById('ffeItemStep');
  // Similar items
  elements.linkSimilarSection = document.getElementById('linkSimilarSection');
  elements.linkSimilarBtn = document.getElementById('linkSimilarBtn');
  elements.similarItemsPanel = document.getElementById('similarItemsPanel');
  elements.similarItemsList = document.getElementById('similarItemsList');
  elements.closeSimilarPanel = document.getElementById('closeSimilarPanel');
  elements.confirmLinkSimilar = document.getElementById('confirmLinkSimilar');
}

// Initialize event listeners
function initEventListeners() {
  elements.loginBtn?.addEventListener('click', handleLogin);

  // Destination buttons
  document.querySelectorAll('.dest-btn').forEach(btn => {
    btn.addEventListener('click', (e) => handleDestinationChange(e.currentTarget.dataset.dest));
  });

  // Category selection (for library)
  document.getElementById('categorySelect')?.addEventListener('change', handleCategoryChange);

  // Project selection
  elements.projectSelect?.addEventListener('change', handleProjectChange);

  // Room selection
  elements.roomSelect?.addEventListener('change', handleRoomChange);

  // Section selection
  elements.sectionSelect?.addEventListener('change', handleSectionChange);

  // Supplier selection
  elements.supplierSelect?.addEventListener('change', handleSupplierChange);
  document.getElementById('addSupplierBtn')?.addEventListener('click', handleAddSupplier);

  // Smart fill button
  elements.smartFillBtn?.addEventListener('click', handleSmartFill);

  // Clip button
  elements.clipBtn?.addEventListener('click', handleClip);

  // Clear button
  elements.clearBtn?.addEventListener('click', handleClear);

  // Clear location button
  document.getElementById('clearLocationBtn')?.addEventListener('click', clearLocationSelection);

  // Crop tool button
  document.getElementById('cropImageBtn')?.addEventListener('click', handleCropTool);
  
  // Find attachments button
  document.getElementById('findAttachmentsBtn')?.addEventListener('click', handleAttachmentCapture);

  // Add buttons (for manual text selection)
  document.querySelectorAll('.add-btn[data-field]').forEach(btn => {
    btn.addEventListener('click', (e) => handleAddButtonClick(e, btn.dataset.field));
  });

  // Sync all text inputs to state when user types (fixes smart fill edit persistence issue)
  const textInputFields = [
    'productName', 'productDescription', 'brand', 'sku', 'docCode',
    'rrp', 'tradePrice', 'material', 'colour', 'finish',
    'width', 'height', 'depth', 'length', 'leadTime', 'quantity', 'notes', 'productWebsite'
  ];
  textInputFields.forEach(fieldId => {
    const input = document.getElementById(fieldId);
    if (input) {
      input.addEventListener('input', (e) => {
        state.clippedData[fieldId] = e.target.value;
      });
    }
  });

  // Close button
  document.getElementById('closeBtn')?.addEventListener('click', () => window.close());

  // Similar items functionality
  elements.linkSimilarBtn?.addEventListener('click', handleLinkSimilarClick);
  elements.closeSimilarPanel?.addEventListener('click', closeSimilarPanel);
  elements.confirmLinkSimilar?.addEventListener('click', confirmLinkSimilarItems);

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Check authentication status
async function checkAuth() {
  showLoading('Checking authentication...');
  
  try {
    const stored = await chrome.storage.local.get(['apiKey', 'user']);
    
    if (stored.apiKey) {
      state.apiKey = stored.apiKey;
      state.user = stored.user;
      
      const response = await apiRequest('GET', CONFIG.ENDPOINTS.AUTH);
      
      if (response.ok) {
        state.isAuthenticated = true;
        state.user = response.data.user;
        showMainSection();
        await Promise.all([loadProjects(), loadSuppliers()]);
      } else {
        await chrome.storage.local.remove(['apiKey', 'user']);
        showAuthSection();
      }
    } else {
      showAuthSection();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showAuthSection();
  }
  
  hideLoading();
}

// Handle login
async function handleLogin() {
  const loginUrl = `${CONFIG.API_BASE_URL}/extension-auth`;
  const tab = await chrome.tabs.create({ url: loginUrl });
  
  showLoading('Waiting for sign in...');
  
  let attempts = 0;
  const maxAttempts = 120;
  
  const pollInterval = setInterval(async () => {
    attempts++;
    
    const stored = await chrome.storage.local.get(['apiKey', 'user']);
    
    if (stored.apiKey) {
      clearInterval(pollInterval);
      state.apiKey = stored.apiKey;
      state.user = stored.user;
      state.isAuthenticated = true;
      
      try { await chrome.tabs.remove(tab.id); } catch (e) {}
      
      hideLoading();
      showMainSection();
      showToast('Signed in successfully!', 'success');
      await Promise.all([loadProjects(), loadSuppliers()]);
      return;
    }
    
    try {
      await chrome.tabs.get(tab.id);
    } catch (e) {
      const finalCheck = await chrome.storage.local.get(['apiKey', 'user']);
      if (finalCheck.apiKey) {
        clearInterval(pollInterval);
        state.apiKey = finalCheck.apiKey;
        state.user = finalCheck.user;
        state.isAuthenticated = true;
        hideLoading();
        showMainSection();
        showToast('Signed in successfully!', 'success');
        await Promise.all([loadProjects(), loadSuppliers()]);
        return;
      }
      
      clearInterval(pollInterval);
      hideLoading();
      showAuthSection();
      return;
    }
    
    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      hideLoading();
      showAuthSection();
      showToast('Sign in timed out', 'error');
    }
  }, 1000);
}

// Load suppliers from phonebook
async function loadSuppliers() {
  try {
    const response = await apiRequest('GET', CONFIG.ENDPOINTS.SUPPLIERS);
    
    if (response.ok && response.data.suppliers) {
      state.suppliers = response.data.suppliers;
      renderSupplierSelect();
    }
  } catch (error) {
    console.error('Failed to load suppliers:', error);
  }
}

// Render supplier select options
function renderSupplierSelect() {
  if (!elements.supplierSelect) return;
  
  elements.supplierSelect.innerHTML = '<option value="">Select supplier or type name...</option>';
  
  state.suppliers.forEach(supplier => {
    const option = document.createElement('option');
    option.value = supplier.id;
    option.textContent = supplier.name;
    if (supplier.website) {
      option.dataset.website = supplier.website;
    }
    elements.supplierSelect.appendChild(option);
  });
  
  // Add "Add new" option
  const addNewOption = document.createElement('option');
  addNewOption.value = '_add_new';
  addNewOption.textContent = '➕ Add new supplier...';
  elements.supplierSelect.appendChild(addNewOption);
  
  // Show hint
  const hint = document.getElementById('supplierHint');
  if (hint && state.suppliers.length > 0) {
    hint.textContent = `${state.suppliers.length} suppliers in phonebook`;
    hint.style.color = '#6b7280';
  }
}

// Handle supplier selection
function handleSupplierChange(e) {
  const value = e.target.value;
  
  if (value === '_add_new') {
    handleAddSupplier();
    e.target.value = '';
    return;
  }
  
  state.selectedSupplier = value || null;
  
  // If supplier selected, get their website
  if (value) {
    const supplier = state.suppliers.find(s => s.id === value);
    if (supplier?.website && !state.clippedData.productWebsite) {
      // Optionally auto-fill supplier website
    }
  }
}

// Handle add new supplier
function handleAddSupplier() {
  const name = prompt('Enter supplier name:');
  if (!name) return;
  
  // For now, just add as a custom option - in future could create via API
  const option = document.createElement('option');
  option.value = `_custom_${name}`;
  option.textContent = name;
  option.selected = true;
  elements.supplierSelect.insertBefore(option, elements.supplierSelect.lastElementChild);
  
  state.selectedSupplier = `_custom_${name}`;
  showToast(`Supplier "${name}" added`, 'success');
}

// Handle project change
async function handleProjectChange(e) {
  const projectId = e.target.value;
  state.selectedProject = projectId;
  state.selectedRoom = null;
  state.selectedSection = null;
  state.selectedFfeItems = [];
  state.createNewItem = true;
  state.selectedSimilarItems = [];

  // Reset downstream selects
  elements.roomSelect.innerHTML = '<option value="">Select Room...</option>';
  elements.sectionSelect.innerHTML = '<option value="">Select Category...</option>';
  if (elements.ffeItemsList) elements.ffeItemsList.innerHTML = '';
  
  // Hide all steps and similar panel
  elements.projectStep?.classList.add('hidden');
  elements.roomStep?.classList.add('hidden');
  elements.sectionStep?.classList.add('hidden');
  elements.ffeItemStep?.classList.add('hidden');
  elements.linkSimilarSection?.classList.add('hidden');
  closeSimilarPanel();
  
  updateClipButton();

  if (projectId) {
    await loadRooms(projectId);
    // Show room step (project step is now hidden, shown in breadcrumb)
    elements.roomStep?.classList.remove('hidden');
    updateBreadcrumb();
  } else {
    // If cleared, show project step again
    elements.projectStep?.classList.remove('hidden');
    hideBreadcrumb();
  }
}

// Handle room change
async function handleRoomChange(e) {
  const roomId = e.target.value;
  state.selectedRoom = roomId;
  state.selectedSection = null;
  state.selectedFfeItems = [];
  state.createNewItem = true;
  state.selectedSimilarItems = [];

  elements.sectionSelect.innerHTML = '<option value="">Select Category...</option>';
  if (elements.ffeItemsList) elements.ffeItemsList.innerHTML = '';
  
  // Hide room step and downstream steps
  elements.roomStep?.classList.add('hidden');
  elements.sectionStep?.classList.add('hidden');
  elements.ffeItemStep?.classList.add('hidden');
  elements.linkSimilarSection?.classList.add('hidden');
  closeSimilarPanel();

  if (roomId) {
    await loadSections(roomId);
    // Show section step (room step is now hidden, shown in breadcrumb)
    elements.sectionStep?.classList.remove('hidden');
    updateBreadcrumb();
  } else {
    // If cleared, show room step again
    elements.roomStep?.classList.remove('hidden');
  }

  updateClipButton();
}

// Handle section change
async function handleSectionChange(e) {
  const sectionId = e.target.value;
  state.selectedSection = sectionId;
  state.selectedFfeItems = [];
  state.createNewItem = true;
  state.selectedSimilarItems = [];

  if (elements.ffeItemsList) elements.ffeItemsList.innerHTML = '';
  
  // Hide section step and downstream
  elements.sectionStep?.classList.add('hidden');
  elements.ffeItemStep?.classList.add('hidden');
  elements.linkSimilarSection?.classList.add('hidden');
  closeSimilarPanel();

  if (sectionId) {
    await loadFfeItems(state.selectedRoom, sectionId);
    // Show FFE items step (section step is now hidden, shown in breadcrumb)
    elements.ffeItemStep?.classList.remove('hidden');
    updateBreadcrumb();
  } else {
    // If cleared, show section step again
    elements.sectionStep?.classList.remove('hidden');
  }

  updateClipButton();
}

// Handle FFE item selection (card click) - supports multi-select
function handleFfeItemSelect(itemId, itemName, isCreateNew = false) {
  if (isCreateNew) {
    // User wants to create a new item
    state.createNewItem = true;
    state.selectedFfeItems = [];
  } else if (itemId) {
    // Toggle selection of existing item
    state.createNewItem = false;
    const index = state.selectedFfeItems.findIndex(i => i.id === itemId);
    if (index >= 0) {
      // Deselect
      state.selectedFfeItems.splice(index, 1);
      // If no items selected, default back to create new
      if (state.selectedFfeItems.length === 0) {
        state.createNewItem = true;
      }
    } else {
      // Select
      state.selectedFfeItems.push({ id: itemId, name: itemName });
    }
  }
  
  state.selectedSimilarItems = [];
  closeSimilarPanel();
  
  // Update card selection state
  renderFfeItemCards();
  
  // Hide the link similar button (no longer needed with multi-select)
  elements.linkSimilarSection?.classList.add('hidden');
  
  // Update breadcrumb with item if selected
  updateBreadcrumb();
  updateClipButton();
}

// Load FFE items for a section
async function loadFfeItems(roomId, sectionId) {
  try {
    const response = await apiRequest('GET', `${CONFIG.ENDPOINTS.PENDING_ITEMS}?roomId=${roomId}`);
    
    // apiRequest wraps API response in { ok, status, data, error }
    // API returns { ok: true, items: [...], stats: {...} }
    const items = response.data?.items || [];
    
    console.log('[FFE Clipper] Loaded items from API:', items.length, 'items');
    console.log('[FFE Clipper] Full response:', response);
    console.log('[FFE Clipper] Looking for sectionId:', sectionId);
    console.log('[FFE Clipper] Available sectionIds in items:', [...new Set(items.map(i => i.sectionId))]);
    
    if (response.ok && items.length >= 0) {
      // Filter items by section - also match by section NAME for flexibility
      const selectedSection = state.sections.find(s => s.id === sectionId);
      const sectionName = selectedSection?.name?.toLowerCase() || '';
      
      let sectionItems = items.filter(item => item.sectionId === sectionId);
      
      // If no exact match, try matching by section name
      if (sectionItems.length === 0 && sectionName) {
        sectionItems = items.filter(item => 
          item.sectionName?.toLowerCase() === sectionName
        );
        console.log('[FFE Clipper] Matched by name instead:', sectionItems.length, 'items');
      }
      
      console.log('[FFE Clipper] Filtered items for section:', sectionItems.length);
      state.ffeItems = sectionItems;
      
      // Render items as cards
      renderFfeItemCards();
      
      // Update hint
      const hint = document.getElementById('ffeItemHint');
      const needsSpec = sectionItems.filter(i => i.needsSpec);
      if (hint) {
        if (sectionItems.length > 0) {
          hint.textContent = `${sectionItems.length} item${sectionItems.length > 1 ? 's' : ''} in this category`;
          hint.style.color = '#6b7280';
        } else if (items.length > 0) {
          hint.textContent = `No items in this category (${items.length} in other categories)`;
          hint.style.color = '#6b7280';
        } else {
          hint.textContent = 'No items yet - select "Create new item"';
          hint.style.color = '#6b7280';
        }
      }
    } else {
      // No items or error, still show the create new option
      console.log('[FFE Clipper] No items or error:', response.error);
      state.ffeItems = [];
      renderFfeItemCards();
    }
  } catch (error) {
    console.error('[FFE Clipper] Failed to load FFE items:', error);
    state.ffeItems = [];
    renderFfeItemCards();
  }
}

// Render FFE items as clickable cards with multi-select
// Shows ALL items - both those that need specs and those that already have some
function renderFfeItemCards() {
  if (!elements.ffeItemsList) return;
  
  elements.ffeItemsList.innerHTML = '';
  
  // Add "Create new item" card first
  const createNewCard = document.createElement('div');
  const isCreateNewSelected = state.createNewItem && state.selectedFfeItems.length === 0;
  createNewCard.className = `ffe-item-card create-new ${isCreateNewSelected ? 'selected' : ''}`;
  createNewCard.innerHTML = `
    <span class="item-icon">➕</span>
    <div class="item-info">
      <div class="item-name">Create new item</div>
      <div class="item-status">Add a new FFE item to this category</div>
    </div>
    <div class="item-check">${isCreateNewSelected ? '✓' : ''}</div>
  `;
  createNewCard.onclick = () => handleFfeItemSelect(null, null, true);
  elements.ffeItemsList.appendChild(createNewCard);
  
  // Show ALL items (not just those that need specs)
  const allItems = state.ffeItems;
  
  // Show hint if there are items to select
  if (allItems.length > 0) {
    const hint = document.createElement('div');
    hint.className = 'multi-select-hint';
    hint.innerHTML = '<small>💡 Select items to link this product to them</small>';
    hint.style.cssText = 'padding: 4px 8px; color: #6b7280; font-size: 11px; text-align: center;';
    elements.ffeItemsList.appendChild(hint);
  }
  
  // Add item cards with checkbox style (show ALL items)
  allItems.forEach(item => {
    const card = document.createElement('div');
    const isSelected = state.selectedFfeItems.some(i => i.id === item.id);
    
    // Use different styling for items that need specs vs those that have specs
    const statusClass = item.needsSpec ? 'needs-spec' : 'has-spec';
    card.className = `ffe-item-card ${statusClass} ${isSelected ? 'selected' : ''}`;
    
    const statusText = item.needsSpec ? 'Needs product' : 'Has product linked';
    const statusIcon = item.needsSpec ? '📦' : '✅';
    
    card.innerHTML = `
      <div class="item-checkbox-wrapper">
        <input type="checkbox" class="item-checkbox" ${isSelected ? 'checked' : ''} />
      </div>
      <span class="item-icon">${statusIcon}</span>
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-status">${statusText}</div>
      </div>
    `;
    
    // Handle click on card - toggle selection
    card.addEventListener('click', (e) => {
      // Don't prevent default - let the checkbox update visually
      handleFfeItemSelect(item.id, item.name, false);
    });
    
    elements.ffeItemsList.appendChild(card);
  });
}

// Helper to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle click on "Link to similar items" button (legacy - no longer used with multi-select)
async function handleLinkSimilarClick() {
  if (!state.selectedProject || state.selectedFfeItems.length === 0) {
    showToast('Please select an FFE item first', 'error');
    return;
  }
  
  const firstSelectedItem = state.selectedFfeItems[0];
  
  // Show the panel with loading state
  elements.similarItemsPanel?.classList.remove('hidden');
  elements.similarItemsList.innerHTML = `
    <div class="panel-loading">
      <div class="spinner-small"></div>
      <span>Finding similar items...</span>
    </div>
  `;
  
  try {
    // Fetch similar items from API
    const excludeIds = state.selectedFfeItems.map(i => i.id).join(',');
    const response = await apiRequest('GET', 
      `${CONFIG.ENDPOINTS.SIMILAR_ITEMS}?projectId=${state.selectedProject}&searchTerm=${encodeURIComponent(firstSelectedItem.name)}&excludeItemId=${excludeIds}`
    );
    
    // API may return similarItems directly or in data
    const similarItems = response.similarItems || response.data?.similarItems || [];
    
    if (response.ok && similarItems.length > 0) {
      state.similarItems = similarItems;
      renderSimilarItems();
    } else {
      elements.similarItemsList.innerHTML = `
        <div class="no-similar-items">
          No similar items found in other rooms
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to find similar items:', error);
    elements.similarItemsList.innerHTML = `
      <div class="no-similar-items">
        Failed to search for similar items
      </div>
    `;
  }
}

// Render similar items in the panel
function renderSimilarItems() {
  if (!elements.similarItemsList) return;
  
  if (state.similarItems.length === 0) {
    elements.similarItemsList.innerHTML = `
      <div class="no-similar-items">
        No similar items found in other rooms.<br>
        Items with similar names will appear here.
      </div>
    `;
    return;
  }
  
  elements.similarItemsList.innerHTML = '';
  
  state.similarItems.forEach(item => {
    const div = document.createElement('div');
    const isChecked = state.selectedSimilarItems.includes(item.id);
    
    div.className = `similar-item ${isChecked ? 'selected' : ''}`;
    div.innerHTML = `
      <input type="checkbox" ${isChecked ? 'checked' : ''} data-item-id="${item.id}">
      <div class="similar-item-info">
        <div class="similar-item-name">${escapeHtml(item.name)}</div>
        <div class="similar-item-location">${escapeHtml(item.roomName)} → ${escapeHtml(item.sectionName)}</div>
      </div>
      <span class="similar-item-status ${item.hasSpec ? 'has-spec' : 'needs-spec'}">
        ${item.hasSpec ? 'Has spec' : 'Needs spec'}
      </span>
    `;
    
    // Handle checkbox toggle
    const checkbox = div.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!state.selectedSimilarItems.includes(item.id)) {
          state.selectedSimilarItems.push(item.id);
        }
        div.classList.add('selected');
      } else {
        state.selectedSimilarItems = state.selectedSimilarItems.filter(id => id !== item.id);
        div.classList.remove('selected');
      }
    });
    
    // Click on the row toggles the checkbox
    div.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        checkbox.click();
      }
    });
    
    elements.similarItemsList.appendChild(div);
  });
}

// Close similar items panel
function closeSimilarPanel() {
  elements.similarItemsPanel?.classList.add('hidden');
  state.similarItems = [];
  state.selectedSimilarItems = [];
}

// Confirm linking to similar items
function confirmLinkSimilarItems() {
  if (state.selectedSimilarItems.length === 0) {
    showToast('Please select at least one item to link', 'error');
    return;
  }
  
  // Close the panel - the selected items will be used during clip
  closeSimilarPanel();
  
  // Keep the selection for the clip action
  const count = state.selectedSimilarItems.length;
  showToast(`${count} additional item${count > 1 ? 's' : ''} will be linked`, 'success');
  
  updateClipButton();
}

// Update breadcrumb display with selected items as tags
function updateBreadcrumb() {
  if (!elements.breadcrumbTags) return;
  
  const tags = [];
  
  // Project tag
  if (state.selectedProject) {
    const project = state.projects.find(p => p.id === state.selectedProject);
    if (project) {
      tags.push({ type: 'project', label: project.name, icon: '📁' });
    }
  }
  
  // Room tag
  if (state.selectedRoom) {
    const room = state.rooms.find(r => r.id === state.selectedRoom);
    if (room) {
      tags.push({ type: 'room', label: room.name || room.type, icon: '🏠' });
    }
  }
  
  // Section tag
  if (state.selectedSection) {
    const section = state.sections.find(s => s.id === state.selectedSection);
    if (section) {
      tags.push({ type: 'section', label: section.name, icon: '📦' });
    }
  }
  
  // FFE Item tag(s)
  if (state.selectedFfeItems.length > 0) {
    if (state.selectedFfeItems.length === 1) {
      tags.push({ type: 'item', label: state.selectedFfeItems[0].name, icon: '🔗' });
    } else {
      tags.push({ type: 'item', label: `${state.selectedFfeItems.length} items selected`, icon: '🔗' });
    }
  }
  
  if (tags.length > 0) {
    elements.breadcrumbTags.innerHTML = tags.map((tag, index) => `
      <div class="breadcrumb-tag" data-type="${tag.type}">
        <span class="tag-icon">${tag.icon}</span>
        <span class="tag-label">${escapeHtml(tag.label)}</span>
        ${index === tags.length - 1 ? `<button class="tag-back" data-step="${tag.type}" title="Go back">✕</button>` : ''}
      </div>
      ${index < tags.length - 1 ? '<span class="breadcrumb-arrow">→</span>' : ''}
    `).join('');
    
    // Add click handlers for back buttons
    elements.breadcrumbTags.querySelectorAll('.tag-back').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleBreadcrumbBack(btn.dataset.step);
      });
    });
    
    elements.locationBreadcrumb?.classList.remove('hidden');
  } else {
    hideBreadcrumb();
  }
}

// Handle clicking back on a breadcrumb tag
function handleBreadcrumbBack(step) {
  switch (step) {
    case 'project':
      // Clear project and reset to project selection
      state.selectedProject = null;
      state.selectedRoom = null;
      state.selectedSection = null;
      state.selectedFfeItems = [];
      state.createNewItem = true;
      elements.projectSelect.value = '';
      elements.roomSelect.innerHTML = '<option value="">Select Room...</option>';
      elements.sectionSelect.innerHTML = '<option value="">Select Category...</option>';
      if (elements.ffeItemsList) elements.ffeItemsList.innerHTML = '';
      // Show project step
      elements.projectStep?.classList.remove('hidden');
      elements.roomStep?.classList.add('hidden');
      elements.sectionStep?.classList.add('hidden');
      elements.ffeItemStep?.classList.add('hidden');
      hideBreadcrumb();
      break;
      
    case 'room':
      // Go back to room selection
      state.selectedRoom = null;
      state.selectedSection = null;
      state.selectedFfeItems = [];
      state.createNewItem = true;
      elements.roomSelect.value = '';
      elements.sectionSelect.innerHTML = '<option value="">Select Category...</option>';
      if (elements.ffeItemsList) elements.ffeItemsList.innerHTML = '';
      // Show room step
      elements.roomStep?.classList.remove('hidden');
      elements.sectionStep?.classList.add('hidden');
      elements.ffeItemStep?.classList.add('hidden');
      updateBreadcrumb();
      break;
      
    case 'section':
      // Go back to section selection
      state.selectedSection = null;
      state.selectedFfeItems = [];
      state.createNewItem = true;
      elements.sectionSelect.value = '';
      if (elements.ffeItemsList) elements.ffeItemsList.innerHTML = '';
      // Show section step
      elements.sectionStep?.classList.remove('hidden');
      elements.ffeItemStep?.classList.add('hidden');
      updateBreadcrumb();
      break;
      
    case 'item':
      // Go back to item selection
      state.selectedFfeItems = [];
      state.createNewItem = true;
      state.selectedSimilarItems = [];
      // Keep showing items step, just deselect
      renderFfeItemCards();
      updateBreadcrumb();
      break;
  }
  
  elements.linkSimilarSection?.classList.add('hidden');
  closeSimilarPanel();
  updateClipButton();
}

// Hide breadcrumb display
function hideBreadcrumb() {
  elements.locationBreadcrumb?.classList.add('hidden');
}

// Clear location selection (start over)
function clearLocationSelection() {
  state.selectedProject = null;
  state.selectedRoom = null;
  state.selectedSection = null;
  state.selectedFfeItems = [];
  state.createNewItem = true;
  state.selectedSimilarItems = [];
  state.similarItems = [];
  
  elements.projectSelect.value = '';
  elements.roomSelect.innerHTML = '<option value="">Select Room...</option>';
  elements.sectionSelect.innerHTML = '<option value="">Select Category...</option>';
  if (elements.ffeItemsList) elements.ffeItemsList.innerHTML = '';
  
  // Show project step, hide all others
  elements.projectStep?.classList.remove('hidden');
  elements.roomStep?.classList.add('hidden');
  elements.sectionStep?.classList.add('hidden');
  elements.ffeItemStep?.classList.add('hidden');
  elements.linkSimilarSection?.classList.add('hidden');
  closeSimilarPanel();
  
  hideBreadcrumb();
  updateClipButton();
}

// Handle destination change
function handleDestinationChange(dest) {
  state.destination = dest;
  
  document.querySelectorAll('.dest-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dest === dest);
  });
  
  const locationSection = document.getElementById('locationSection');
  const categorySelector = document.getElementById('categorySelector');
  
  if (dest === 'library') {
    locationSection?.classList.add('hidden');
    categorySelector?.classList.remove('hidden');
    loadCategories();
  } else if (dest === 'both') {
    locationSection?.classList.remove('hidden');
    categorySelector?.classList.remove('hidden');
    loadCategories();
  } else {
    locationSection?.classList.remove('hidden');
    categorySelector?.classList.add('hidden');
  }
  
  updateClipButton();
}

// Handle category change
function handleCategoryChange(e) {
  state.selectedCategory = e.target.value || null;
  updateClipButton();
}

// Load categories for library
async function loadCategories() {
  if (state.categories.length > 0) return;
  
  try {
    const response = await apiRequest('GET', '/api/products/categories');
    
    if (response.ok && response.data?.categories) {
      const allCategories = [];
      response.data.categories.forEach(parent => {
        allCategories.push(parent);
        if (parent.children?.length > 0) {
          parent.children.forEach(child => {
            allCategories.push({ ...child, parentId: parent.id });
          });
        }
      });
      state.categories = allCategories;
      
      const select = document.getElementById('categorySelect');
      if (select) {
        select.innerHTML = '<option value="">Select Category (optional)...</option>';
        
        response.data.categories.forEach(parent => {
          const optgroup = document.createElement('optgroup');
          optgroup.label = parent.name;
          
          const parentOpt = document.createElement('option');
          parentOpt.value = parent.id;
          parentOpt.textContent = `${parent.name} (General)`;
          optgroup.appendChild(parentOpt);
          
          if (parent.children?.length > 0) {
            parent.children.forEach(child => {
              const opt = document.createElement('option');
              opt.value = child.id;
              opt.textContent = child.name;
              optgroup.appendChild(opt);
            });
          }
          
          select.appendChild(optgroup);
        });
      }
    }
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

// Update clip button state
function updateClipButton() {
  let isReady = false;
  let buttonText = 'Select location first';
  
  if (state.destination === 'library') {
    isReady = true;
    buttonText = state.selectedCategory ? 'Save to Library' : 'Save to Library (uncategorized)';
  } else if (state.destination === 'both') {
    isReady = state.selectedProject && state.selectedRoom && state.selectedSection;
    buttonText = isReady ? 'Save to Room & Library' : 'Select room first';
  } else {
    isReady = state.selectedProject && state.selectedRoom && state.selectedSection;
    if (isReady && state.selectedFfeItems.length > 0) {
      // Items selected for linking
      const totalCount = state.selectedFfeItems.length + state.selectedSimilarItems.length;
      if (totalCount > 1) {
        buttonText = `Link Product to ${totalCount} Items`;
      } else {
        buttonText = 'Link Product to FFE Item';
      }
    } else if (isReady) {
      buttonText = 'Clip to Room';
    }
  }
  
  if (elements.clipBtn) {
    elements.clipBtn.disabled = !isReady;
    elements.clipBtn.textContent = buttonText;
  }
}

// Get current page URL
async function getCurrentPageUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      // Check if URL changed from what we had before
      const previousUrl = state.clippedData.productWebsite;
      const newUrl = tab.url;
      
      // If URL changed significantly (different page), clear attachments
      if (previousUrl && newUrl) {
        try {
          const prevOrigin = new URL(previousUrl).origin + new URL(previousUrl).pathname;
          const newOrigin = new URL(newUrl).origin + new URL(newUrl).pathname;
          if (prevOrigin !== newOrigin) {
            // Different page - clear attachments as they were from the old page
            state.clippedData.attachments = [];
            renderAttachments();
          }
        } catch (e) {
          // URL parsing failed, just update
        }
      }
      
      state.clippedData.productWebsite = tab.url;
      document.getElementById('productWebsite').value = tab.url;
    }
  } catch (error) {
    console.error('Failed to get page URL:', error);
  }
}

// Handle smart fill
async function handleSmartFill() {
  showLoading('AI is analyzing the page...');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    let pageData = null;
    
    try {
      pageData = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'extractPageData' }, (response) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(response?.data);
        });
      });
    } catch (e) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      await new Promise(r => setTimeout(r, 200));
      
      pageData = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'extractPageData' }, (response) => {
          resolve(response?.data || null);
        });
      });
    }
    
    let pageContent = '';
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText
      });
      pageContent = results[0]?.result || '';
    } catch (e) {}
    
    const response = await apiRequest('POST', CONFIG.ENDPOINTS.SMART_FILL, {
      url: tab.url,
      title: tab.title,
      pageContent: pageContent.substring(0, 12000),
      images: pageData?.images || [],
      mainImage: pageData?.mainImage || null,
      specSheets: pageData?.specSheets || [],
      pdfLinks: pageData?.pdfLinks || []
    });
    
    if (response.ok && response.data?.success && response.data?.data) {
      processSmartFillData(response.data.data);
      showToast('AI extracted product information!', 'success');
    } else if (pageData) {
      processSmartFillData(pageData);
      showToast('Basic extraction completed', 'success');
    } else {
      showToast(response.data?.error || 'Could not extract data', 'error');
    }
  } catch (error) {
    console.error('Smart fill failed:', error);
    showToast('Smart fill failed: ' + (error.message || 'Unknown error'), 'error');
  }
  
  hideLoading();
}

// Process smart fill data
function processSmartFillData(data) {
  const fieldMappings = {
    productName: 'productName',
    // productDescription is intentionally NOT auto-filled - the item will use the FFE linked item name
    // User can manually add a description if needed
    brand: 'brand',
    sku: 'sku',
    docCode: 'docCode',
    rrp: 'rrp',
    tradePrice: 'tradePrice',
    material: 'material',
    colour: 'colour',
    color: 'colour',
    finish: 'finish',
    width: 'width',
    height: 'height',
    depth: 'depth',
    length: 'length',
    leadTime: 'leadTime',
    // Notes are intentionally NOT included - we don't want to auto-fill notes
    productWebsite: 'productWebsite',
    title: 'productName',
    name: 'productName',
    // description mapping removed - leave empty for FFE linked item name
    price: 'rrp',
    url: 'productWebsite'
  };
  
  for (const [key, fieldId] of Object.entries(fieldMappings)) {
    if (data[key] && !state.clippedData[fieldId]) {
      const value = data[key];
      state.clippedData[fieldId] = value;
      const input = document.getElementById(fieldId);
      if (input) input.value = value;
    }
  }
  
  if (data.images?.length > 0) {
    const existingUrls = new Set(state.clippedData.images);
    for (const img of data.images) {
      if (!existingUrls.has(img)) {
        state.clippedData.images.push(img);
      }
    }
    renderImages();
  }
  
  // Smart fill should NOT auto-add any attachments
  // User can manually add attachments using the + button if needed
}

// Handle clip button
async function handleClip() {
  if (!state.clippedData.productName) {
    showToast('Please add a product name', 'error');
    return;
  }
  
  const needsRoom = state.destination === 'room' || state.destination === 'both';
  
  if (needsRoom) {
    if (!state.selectedProject) {
      showToast('Please select a project', 'error');
      return;
    }
    if (!state.selectedRoom) {
      showToast('Please select a room', 'error');
      return;
    }
    if (!state.selectedSection) {
      showToast('Please select a category', 'error');
      return;
    }
  }
  
  // Build list of all items to link (selected items + similar items)
  const allLinkItemIds = [];
  if (state.selectedFfeItems.length > 0) {
    allLinkItemIds.push(...state.selectedFfeItems.map(i => i.id));
  }
  if (state.selectedSimilarItems.length > 0) {
    allLinkItemIds.push(...state.selectedSimilarItems);
  }
  
  const loadingMsg = state.destination === 'library' 
    ? 'Adding to library...' 
    : state.destination === 'both' 
      ? 'Saving to room & library...' 
      : allLinkItemIds.length > 1
        ? `Linking to ${allLinkItemIds.length} items...`
        : 'Saving item...';
  showLoading(loadingMsg);
  
  try {
    // Get supplier name from selection
    let supplierName = null;
    let supplierId = null;
    if (state.selectedSupplier) {
      if (state.selectedSupplier.startsWith('_custom_')) {
        supplierName = state.selectedSupplier.replace('_custom_', '');
      } else {
        const supplier = state.suppliers.find(s => s.id === state.selectedSupplier);
        if (supplier) {
          supplierName = supplier.name;
          supplierId = supplier.id;
        }
      }
    }
    
    // Prepare the data with proper field mapping
    const clipData = {
      destination: state.destination,
      categoryId: state.selectedCategory || null,
      roomId: needsRoom ? state.selectedRoom : null,
      sectionId: needsRoom ? state.selectedSection : null,
      linkItemId: allLinkItemIds.length > 0 ? allLinkItemIds[0] : null,
      // Array of additional item IDs to link the same product to
      additionalLinkItemIds: allLinkItemIds.length > 1 ? allLinkItemIds.slice(1) : null,
      item: {
        name: state.clippedData.productName,
        description: state.clippedData.productDescription,
        brand: state.clippedData.brand,
        sku: state.clippedData.sku,
        docCode: state.clippedData.docCode,
        supplierName: supplierName,
        supplierId: supplierId,
        supplierLink: state.clippedData.productWebsite,
        colour: state.clippedData.colour,
        finish: state.clippedData.finish,
        material: state.clippedData.material,
        width: state.clippedData.width,
        height: state.clippedData.height,
        depth: state.clippedData.depth,
        length: state.clippedData.length,
        quantity: parseInt(state.clippedData.quantity) || 1,
        rrp: parsePrice(state.clippedData.rrp),
        tradePrice: parsePrice(state.clippedData.tradePrice),
        leadTime: state.clippedData.leadTime,
        notes: state.clippedData.notes,
        images: state.clippedData.images,
        attachments: state.clippedData.attachments
      }
    };
    
    const response = await apiRequest('POST', CONFIG.ENDPOINTS.CLIP, clipData);
    
    if (response.ok) {
      let successMsg = '';
      if (state.destination === 'library') {
        successMsg = `"${state.clippedData.productName}" added to library!`;
      } else if (state.destination === 'both') {
        successMsg = `"${state.clippedData.productName}" saved to room & library!`;
      } else if (allLinkItemIds.length > 1) {
        successMsg = `Product linked to ${allLinkItemIds.length} items!`;
      } else {
        const action = allLinkItemIds.length > 0 ? 'linked' : 'saved';
        successMsg = `Item ${action} successfully!`;
      }
      showToast(successMsg, 'success');
      
      // Close the extension after a brief delay to show the success message
      hideLoading();
      setTimeout(() => {
        window.close();
      }, 1500);
      return;
    } else {
      showToast(response.error || 'Failed to save item', 'error');
    }
  } catch (error) {
    console.error('Clip failed:', error);
    showToast('Failed to save item', 'error');
  }
  
  hideLoading();
}

// Handle clear
function handleClear() {
  state.clippedData = {
    images: [],
    attachments: [],
    productName: '',
    productDescription: '',
    brand: '',
    productWebsite: state.clippedData.productWebsite,
    docCode: '',
    sku: '',
    colour: '',
    finish: '',
    material: '',
    width: '',
    height: '',
    depth: '',
    length: '',
    quantity: 1,
    rrp: '',
    tradePrice: '',
    leadTime: '',
    notes: ''
  };
  
  state.selectedFfeItems = [];
  state.createNewItem = true;
  state.selectedSupplier = null;
  state.selectedSimilarItems = [];
  state.similarItems = [];
  
  document.querySelectorAll('.field-input input, .field-input textarea').forEach(input => {
    if (input.id !== 'productWebsite') {
      input.value = input.type === 'number' ? '1' : '';
    }
  });
  
  if (elements.supplierSelect) elements.supplierSelect.value = '';
  
  // Re-render FFE items to clear selection
  renderFfeItemCards();
  
  // Hide similar items section
  elements.linkSimilarSection?.classList.add('hidden');
  closeSimilarPanel();
  
  renderImages();
  renderAttachments();
  
  showToast('Form cleared', 'info');
}

// Load projects
async function loadProjects() {
  showLoading('Loading projects...');
  
  try {
    const response = await apiRequest('GET', CONFIG.ENDPOINTS.PROJECTS);
    
    if (response.ok && response.data.projects) {
      state.projects = response.data.projects;
      
      elements.projectSelect.innerHTML = '<option value="">Select Project...</option>';
      state.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        elements.projectSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Failed to load projects:', error);
    showToast('Failed to load projects', 'error');
  }
  
  hideLoading();
}

// Load rooms for a project
async function loadRooms(projectId) {
  showLoading('Loading rooms...');

  try {
    const response = await apiRequest('GET', `${CONFIG.ENDPOINTS.ROOMS}?projectId=${projectId}`);

    if (response.ok && response.data.rooms) {
      state.rooms = response.data.rooms;

      elements.roomSelect.innerHTML = '<option value="">Select Room...</option>';
      state.rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.id;
        option.textContent = room.name || room.type;
        elements.roomSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Failed to load rooms:', error);
    showToast('Failed to load rooms', 'error');
  }

  hideLoading();
}

// Load sections for a room
async function loadSections(roomId) {
  showLoading('Loading categories...');

  try {
    const response = await apiRequest('GET', `${CONFIG.ENDPOINTS.SECTIONS}?roomId=${roomId}`);

    if (response.ok && response.data.sections) {
      state.sections = response.data.sections;

      elements.sectionSelect.innerHTML = '<option value="">Select Category...</option>';
      state.sections.forEach(section => {
        const option = document.createElement('option');
        option.value = section.id;
        option.textContent = section.name;
        elements.sectionSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Failed to load sections:', error);
    showToast('Failed to load categories', 'error');
  }

  hideLoading();
}

// Render images
function renderImages() {
  if (!elements.imagesContainer) return;
  
  elements.imagesContainer.innerHTML = '';
  
  if (state.clippedData.images.length === 0) {
    elements.imagesContainer.innerHTML = `
      <div class="image-placeholder">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span style="font-size:10px;color:#999;margin-top:4px;">No images</span>
      </div>
    `;
    return;
  }
  
  state.clippedData.images.forEach((imgUrl, index) => {
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'image-wrapper';
    imgWrapper.draggable = true;
    imgWrapper.dataset.index = index;
    
    if (index === 0) {
      const badge = document.createElement('span');
      badge.className = 'main-image-badge';
      badge.textContent = 'Main';
      imgWrapper.appendChild(badge);
    }
    
    const img = document.createElement('img');
    img.src = imgUrl;
    img.className = 'clipped-image';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'image-delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      state.clippedData.images.splice(index, 1);
      renderImages();
    };
    
    imgWrapper.appendChild(img);
    imgWrapper.appendChild(deleteBtn);
    
    imgWrapper.addEventListener('dragstart', handleDragStart);
    imgWrapper.addEventListener('dragover', handleDragOver);
    imgWrapper.addEventListener('drop', handleDrop);
    imgWrapper.addEventListener('dragend', handleDragEnd);
    
    elements.imagesContainer.appendChild(imgWrapper);
  });
}

// Drag handlers
let draggedImageIndex = null;

function handleDragStart(e) {
  draggedImageIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  const targetIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.remove('drag-over');
  
  if (draggedImageIndex !== null && draggedImageIndex !== targetIndex) {
    const images = [...state.clippedData.images];
    const [draggedImage] = images.splice(draggedImageIndex, 1);
    images.splice(targetIndex, 0, draggedImage);
    state.clippedData.images = images;
    renderImages();
  }
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  draggedImageIndex = null;
}

// Render attachments
function renderAttachments() {
  const container = document.getElementById('attachmentsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (state.clippedData.attachments.length === 0) {
    container.innerHTML = '<p class="helper-text-attachments">Click + to find PDFs and downloads on this page</p>';
    return;
  }
  
  state.clippedData.attachments.forEach((att, index) => {
    const item = document.createElement('div');
    const isPdf = att.type === 'PDF' || att.url?.toLowerCase().includes('.pdf');
    
    let className = 'attachment-item';
    if (att.isSpec) className += ' spec-sheet';
    else if (isPdf) className += ' pdf';
    
    item.className = className;
    
    const icon = isPdf 
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
         </svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
         </svg>`;
    
    const displayName = att.name?.length > 40 ? att.name.substring(0, 37) + '...' : att.name;
    
    // Create link
    const link = document.createElement('a');
    link.href = att.url;
    link.target = '_blank';
    link.title = att.name;
    link.textContent = displayName;
    
    // Create type badge
    const typeBadge = document.createElement('span');
    typeBadge.className = 'attachment-type';
    typeBadge.textContent = att.isSpec ? 'SPEC' : att.type || 'FILE';
    
    // Create delete button with proper event listener
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'attachment-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.type = 'button';
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeAttachment(index);
    });
    
    // Build the item
    item.innerHTML = icon;
    item.appendChild(link);
    item.appendChild(typeBadge);
    item.appendChild(deleteBtn);
    
    container.appendChild(item);
  });
}

// Remove attachment by index
function removeAttachment(index) {
  state.clippedData.attachments.splice(index, 1);
  renderAttachments();
}

// Load pending images
async function loadPendingImages() {
  try {
    const stored = await chrome.storage.local.get(['pendingImages']);
    
    if (stored.pendingImages?.length > 0) {
      let addedCount = 0;
      for (const imageUrl of stored.pendingImages) {
        if (!state.clippedData.images.includes(imageUrl)) {
          state.clippedData.images.push(imageUrl);
          addedCount++;
        }
      }
      
      await chrome.storage.local.remove(['pendingImages']);
      chrome.runtime.sendMessage({ action: 'clearBadge' }).catch(() => {});
      
      if (addedCount > 0) {
        renderImages();
        showToast(`Added ${addedCount} clipped image(s)!`, 'success');
      }
    }
  } catch (error) {
    console.error('Failed to load pending images:', error);
  }
}

// Handle crop tool
async function handleCropTool() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: initCropTool
    });
    
    showToast('Draw a rectangle to capture an area', 'info');
  } catch (error) {
    console.error('Failed to start crop tool:', error);
    showToast('Could not start crop tool on this page', 'error');
  }
}

function initCropTool() {
  document.getElementById('ffe-crop-overlay')?.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'ffe-crop-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.3); cursor: crosshair; z-index: 2147483647;
  `;
  
  const selection = document.createElement('div');
  selection.style.cssText = `
    position: absolute; border: 2px dashed #4361ee;
    background: rgba(67, 97, 238, 0.1); display: none;
  `;
  overlay.appendChild(selection);
  
  let startX, startY, isDrawing = false;
  
  overlay.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    isDrawing = true;
    selection.style.display = 'block';
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
    selection.style.width = '0';
    selection.style.height = '0';
  });
  
  overlay.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    selection.style.left = Math.min(startX, e.clientX) + 'px';
    selection.style.top = Math.min(startY, e.clientY) + 'px';
    selection.style.width = Math.abs(e.clientX - startX) + 'px';
    selection.style.height = Math.abs(e.clientY - startY) + 'px';
  });
  
  overlay.addEventListener('mouseup', async () => {
    if (!isDrawing) return;
    isDrawing = false;
    
    const rect = selection.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      overlay.remove();
      return;
    }
    
    overlay.style.display = 'none';
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'captureVisibleTab' });
      
      if (response?.dataUrl) {
        const canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        
        const img = new Image();
        img.onload = () => {
          const dpr = window.devicePixelRatio || 1;
          ctx.drawImage(img, 
            rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr,
            0, 0, rect.width, rect.height
          );
          const croppedDataUrl = canvas.toDataURL('image/png');
          
          chrome.storage.local.get(['pendingImages'], (result) => {
            const pendingImages = result.pendingImages || [];
            pendingImages.push(croppedDataUrl);
            chrome.storage.local.set({ pendingImages });
          });
        };
        img.src = response.dataUrl;
      }
    } catch (err) {
      console.error('Failed to capture:', err);
    }
    
    overlay.remove();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.remove();
  }, { once: true });
  
  document.body.appendChild(overlay);
}

// Handle attachment capture
async function handleAttachmentCapture() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: 'findDownloads' }, (response) => {
      if (response?.downloads?.length > 0) {
        response.downloads.forEach(dl => {
          if (!state.clippedData.attachments.some(a => a.url === dl.url)) {
            state.clippedData.attachments.push({ name: dl.name, url: dl.url, type: dl.type });
          }
        });
        renderAttachments();
        showToast(`Found ${response.downloads.length} downloadable file(s)`, 'success');
      } else {
        showToast('No downloadable files found on this page', 'info');
      }
    });
  } catch (error) {
    console.error('Failed to find downloads:', error);
    showToast('Could not scan page for downloads', 'error');
  }
}

// Handle add button click
async function handleAddButtonClick(e, fieldId) {
  e.preventDefault();
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || ''
    });
    
    const selectedText = results[0]?.result?.trim();
    
    if (selectedText) {
      state.clippedData[fieldId] = selectedText;
      const input = document.getElementById(fieldId);
      if (input) input.value = selectedText;
      showToast(`Added to ${formatFieldLabel(fieldId)}`, 'success');
    } else {
      await saveFormState();
      await chrome.storage.local.set({ pickerField: fieldId, pickerFieldName: formatFieldLabel(fieldId) });
      
      try {
        chrome.tabs.sendMessage(tab.id, { action: 'startPicker', field: fieldId }, (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            }).then(() => {
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'startPicker', field: fieldId });
              }, 100);
            });
          }
        });
      } catch (err) {
        showToast('Could not access this page', 'error');
      }
      
      showToast('Click on text in the page to capture it', 'info');
    }
  } catch (error) {
    console.error('Failed to start picker:', error);
    showToast('Could not access page', 'error');
  }
}

// Save form state
async function saveFormState() {
  await chrome.storage.local.set({
    savedFormState: {
      clippedData: state.clippedData,
      selectedProject: state.selectedProject,
      selectedRoom: state.selectedRoom,
      selectedSection: state.selectedSection
    }
  });
}

// Load form state
async function loadFormState() {
  try {
    const stored = await chrome.storage.local.get(['savedFormState', 'pickerResult', 'pickerField']);
    const { savedFormState, pickerResult, pickerField } = stored;

    if (pickerResult && pickerField) {
      state.clippedData[pickerField] = pickerResult;
      setTimeout(() => {
        const input = document.getElementById(pickerField);
        if (input) input.value = pickerResult;
      }, 100);
      showToast(`Text captured for ${formatFieldLabel(pickerField)}!`, 'success');
      await chrome.storage.local.remove(['pickerResult', 'pickerField', 'pickerFieldName']);
    }

    if (savedFormState) {
      if (savedFormState.clippedData) {
        state.clippedData = { ...state.clippedData, ...savedFormState.clippedData };
      }
      state.selectedProject = savedFormState.selectedProject;
      state.selectedRoom = savedFormState.selectedRoom;
      state.selectedSection = savedFormState.selectedSection;

      populateFormFromState();

      if (state.selectedProject && elements.projectSelect) {
        elements.projectSelect.value = state.selectedProject;
        await loadRooms(state.selectedProject);

        if (state.selectedRoom && elements.roomSelect) {
          elements.roomSelect.value = state.selectedRoom;
          elements.roomStep?.classList.remove('hidden');
          await loadSections(state.selectedRoom);

          if (state.selectedSection && elements.sectionSelect) {
            elements.sectionSelect.value = state.selectedSection;
            elements.sectionStep?.classList.remove('hidden');
            await loadFfeItems(state.selectedRoom, state.selectedSection);
            elements.ffeItemStep?.classList.remove('hidden');
          }
        }
      }
      
      await chrome.storage.local.remove(['savedFormState']);
    }

    updateClipButton();
  } catch (error) {
    console.error('Failed to load form state:', error);
  }
}

// Format field label
function formatFieldLabel(field) {
  const labels = {
    productName: 'Product Name',
    productDescription: 'Description',
    brand: 'Brand',
    productWebsite: 'Website',
    docCode: 'Doc Code',
    sku: 'SKU',
    colour: 'Colour',
    finish: 'Finish',
    material: 'Material',
    width: 'Width',
    length: 'Length',
    height: 'Height',
    depth: 'Depth',
    quantity: 'Quantity',
    rrp: 'RRP',
    tradePrice: 'Trade Price',
    leadTime: 'Lead Time',
    notes: 'Notes'
  };
  return labels[field] || field;
}

// Populate form from state
function populateFormFromState() {
  const fields = [
    'productName', 'productDescription', 'brand', 'productWebsite', 'docCode', 
    'sku', 'colour', 'finish', 'material', 'width', 'length', 'height', 'depth', 
    'quantity', 'rrp', 'tradePrice', 'leadTime', 'notes'
  ];
  
  fields.forEach(field => {
    const input = document.getElementById(field);
    if (input && state.clippedData[field]) {
      input.value = state.clippedData[field];
    }
  });
  
  renderImages();
  renderAttachments();
}

// Handle messages
function handleMessage(message, sender, sendResponse) {
  switch (message.action) {
    case 'textSelected':
      const field = message.field || state.activePickerField;
      if (field && message.text) {
        state.clippedData[field] = message.text;
        const input = document.getElementById(field);
        if (input) input.value = message.text;
        showToast(`Text captured for ${formatFieldLabel(field)}!`, 'success');
        chrome.storage.local.remove(['pickerResult', 'pickerField', 'pickerFieldName']);
      }
      sendResponse({ ok: true });
      break;
      
    case 'imageClipped':
      if (message.imageUrl) {
        state.clippedData.images.push(message.imageUrl);
        renderImages();
        showToast('Image captured!', 'success');
      }
      sendResponse({ ok: true });
      break;
      
    case 'authComplete':
      if (message.apiKey && message.user) {
        chrome.storage.local.set({ apiKey: message.apiKey, user: message.user });
        state.apiKey = message.apiKey;
        state.user = message.user;
        state.isAuthenticated = true;
        showMainSection();
        Promise.all([loadProjects(), loadSuppliers()]);
        showToast('Logged in successfully!', 'success');
      }
      sendResponse({ ok: true });
      break;
  }
  
  return true;
}

// API request helper
async function apiRequest(method, endpoint, body = null) {
  const url = `${CONFIG.API_BASE_URL}${endpoint}`;
  
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (state.apiKey) {
    options.headers['X-Extension-Key'] = state.apiKey;
  }
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    return { ok: response.ok, status: response.status, data, error: data.error };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error.message };
  }
}

// Parse price
function parsePrice(priceStr) {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

// UI Helpers
function showAuthSection() {
  elements.authSection?.classList.remove('hidden');
  elements.mainSection?.classList.add('hidden');
}

function showMainSection() {
  elements.authSection?.classList.add('hidden');
  elements.mainSection?.classList.remove('hidden');
  updateClipButton();
}

function showLoading(message = 'Loading...') {
  elements.loadingText.textContent = message;
  elements.loadingOverlay?.classList.remove('hidden');
}

function hideLoading() {
  elements.loadingOverlay?.classList.add('hidden');
}

function showToast(message, type = 'info') {
  elements.toast.className = `toast ${type}`;
  elements.toastMessage.textContent = message;
  elements.toast.classList.remove('hidden');
  
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3000);
}


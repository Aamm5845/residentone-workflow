// Meisner FFE Clipper - Popup Script

// Environment Configuration
// Set to 'local' for development, 'production' for live site
const ENVIRONMENT = 'production'; // Change to 'local' for development

// Configuration
const CONFIG = {
  // API URLs for different environments
  API_URLS: {
    local: 'http://localhost:3000',
    production: 'https://app.meisnerinteriors.com'
  },
  // Current API URL based on environment
  get API_BASE_URL() {
    return this.API_URLS[ENVIRONMENT] || this.API_URLS.local;
  },
  // API endpoints
  ENDPOINTS: {
    AUTH: '/api/extension/auth',
    PROJECTS: '/api/extension/projects',
    ROOMS: '/api/extension/rooms',
    SECTIONS: '/api/extension/sections',
    CLIP: '/api/extension/clip',
    SMART_FILL: '/api/extension/smart-fill'
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
  selectedProject: null,
  selectedRoom: null,
  selectedSection: null,
  clippedData: {
    images: [],
    attachments: [],
    productDescription: '',
    productDetails: '',
    productName: '',
    brand: '',
    productWebsite: '',
    docCode: '',
    sku: '',
    colour: '',
    finish: '',
    material: '',
    width: '',
    length: '',
    height: '',
    depth: '',
    quantity: 1,
    rrp: '',
    tradePrice: '',
    leadTime: '',
    notes: ''
  },
  activePickerField: null
};

// DOM Elements
const elements = {
  authSection: null,
  mainSection: null,
  loginBtn: null,
  projectSelect: null,
  roomSelect: null,
  sectionSelect: null,
  smartFillBtn: null,
  clipBtn: null,
  clearBtn: null,
  loadingOverlay: null,
  loadingText: null,
  toast: null,
  toastMessage: null,
  imagesContainer: null
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  initEventListeners();
  await checkAuth();
  await getCurrentPageUrl();
  await loadPendingImages();
  await loadFormState();
  
  // Listen for storage changes (for picker updates)
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
      // Check if picker result was updated
      if (changes.pickerResult?.newValue) {
        // Get both values from storage to be sure
        const stored = await chrome.storage.local.get(['pickerResult', 'pickerField']);
        const pickerResult = stored.pickerResult;
        const pickerField = stored.pickerField;
        
        if (pickerResult && pickerField) {
          console.log('Picker update received:', pickerField, pickerResult.substring(0, 50));
          
          // Update state
          state.clippedData[pickerField] = pickerResult;
          
          // Update input field
          const input = document.getElementById(pickerField);
          if (input) {
            input.value = pickerResult;
            console.log('Updated input field:', pickerField);
          }
          
          showToast(`Text captured for ${formatFieldLabel(pickerField)}!`, 'success');
          
          // Clear the picker result from storage
          chrome.storage.local.remove(['pickerResult', 'pickerField', 'pickerFieldName']);
        }
      }
      
      // Check if pending images were updated
      if (changes.pendingImages?.newValue?.length > 0) {
        loadPendingImages();
      }
    }
  });
});

// Initialize DOM elements
function initElements() {
  elements.authSection = document.getElementById('authSection');
  elements.mainSection = document.getElementById('mainSection');
  elements.loginBtn = document.getElementById('loginBtn');
  elements.projectSelect = document.getElementById('projectSelect');
  elements.roomSelect = document.getElementById('roomSelect');
  elements.sectionSelect = document.getElementById('sectionSelect');
  elements.smartFillBtn = document.getElementById('smartFillBtn');
  elements.clipBtn = document.getElementById('clipBtn');
  elements.clearBtn = document.getElementById('clearBtn');
  elements.loadingOverlay = document.getElementById('loadingOverlay');
  elements.loadingText = document.getElementById('loadingText');
  elements.toast = document.getElementById('toast');
  elements.toastMessage = document.getElementById('toastMessage');
  elements.imagesContainer = document.getElementById('imagesContainer');
}

// Initialize event listeners
function initEventListeners() {
  // Login button
  elements.loginBtn?.addEventListener('click', handleLogin);

  // Project selection
  elements.projectSelect?.addEventListener('change', handleProjectChange);

  // Room selection
  elements.roomSelect?.addEventListener('change', handleRoomChange);

  // Section selection
  elements.sectionSelect?.addEventListener('change', handleSectionChange);

  // Smart fill button
  elements.smartFillBtn?.addEventListener('click', handleSmartFill);

  // Clip button - directly saves the item
  elements.clipBtn?.addEventListener('click', handleClip);

  // Clear button
  elements.clearBtn?.addEventListener('click', handleClear);

  // Crop tool button
  document.getElementById('cropImageBtn')?.addEventListener('click', handleCropTool);
  
  // Find attachments button
  document.getElementById('findAttachmentsBtn')?.addEventListener('click', handleAttachmentCapture);

  // Add buttons (for manual text selection)
  document.querySelectorAll('.add-btn[data-field]').forEach(btn => {
    btn.addEventListener('click', (e) => handleAddButtonClick(e, btn.dataset.field));
  });

  // Close button
  document.getElementById('closeBtn')?.addEventListener('click', () => window.close());

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Check authentication status
async function checkAuth() {
  showLoading('Checking authentication...');
  
  try {
    // Try to get stored API key
    const stored = await chrome.storage.local.get(['apiKey', 'user']);
    
    if (stored.apiKey) {
      state.apiKey = stored.apiKey;
      state.user = stored.user;
      
      // Verify the key is still valid
      const response = await apiRequest('GET', CONFIG.ENDPOINTS.AUTH);
      
      if (response.ok) {
        state.isAuthenticated = true;
        state.user = response.data.user;
        showMainSection();
        await loadProjects();
      } else {
        // Key is invalid, clear it
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

// Handle login - opens sign in page and polls for result
async function handleLogin() {
  // Open the login page in a new tab
  const loginUrl = `${CONFIG.API_BASE_URL}/extension-auth`;
  const tab = await chrome.tabs.create({ url: loginUrl });
  
  showLoading('Waiting for sign in...');
  
  // Poll for auth completion
  let attempts = 0;
  const maxAttempts = 120; // 2 minutes max
  
  const pollInterval = setInterval(async () => {
    attempts++;
    
    // Check if we got the auth key
    const stored = await chrome.storage.local.get(['apiKey', 'user']);
    
    if (stored.apiKey) {
      clearInterval(pollInterval);
      state.apiKey = stored.apiKey;
      state.user = stored.user;
      state.isAuthenticated = true;
      
      hideLoading();
      showMainSection();
      showToast('Signed in successfully!', 'success');
      await loadProjects();
      return;
    }
    
    // Check if tab was closed
    try {
      await chrome.tabs.get(tab.id);
    } catch (e) {
      // Tab was closed
      clearInterval(pollInterval);
      hideLoading();
      showAuthSection();
      return;
    }
    
    // Timeout
    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      hideLoading();
      showAuthSection();
      showToast('Sign in timed out', 'error');
    }
  }, 1000);
}

// Handle project change
async function handleProjectChange(e) {
  const projectId = e.target.value;
  state.selectedProject = projectId;
  state.selectedRoom = null;
  state.selectedSection = null;

  // Reset and hide room and section selects
  elements.roomSelect.innerHTML = '<option value="">Select Room...</option>';
  elements.sectionSelect.innerHTML = '<option value="">Select Section...</option>';
  
  // Hide room and section groups
  document.getElementById('roomGroup')?.classList.add('hidden');
  document.getElementById('sectionGroup')?.classList.add('hidden');

  updateClipButton();

  if (projectId) {
    await loadRooms(projectId);
    // Show room group after loading
    document.getElementById('roomGroup')?.classList.remove('hidden');
  }
}

// Handle room change
async function handleRoomChange(e) {
  const roomId = e.target.value;
  state.selectedRoom = roomId;
  state.selectedSection = null;

  // Reset and hide section select
  elements.sectionSelect.innerHTML = '<option value="">Select Section...</option>';
  document.getElementById('sectionGroup')?.classList.add('hidden');

  if (roomId) {
    await loadSections(roomId);
    // Show section group after loading
    document.getElementById('sectionGroup')?.classList.remove('hidden');
  }

  updateClipButton();
}

// Handle section change
function handleSectionChange(e) {
  state.selectedSection = e.target.value;
  updateClipButton();
}

// Update clip button state - enabled only when location is fully selected
function updateClipButton() {
  const isReady = state.selectedProject && state.selectedRoom && state.selectedSection;
  if (elements.clipBtn) {
    elements.clipBtn.disabled = !isReady;
    elements.clipBtn.textContent = isReady ? 'Clip' : 'Select location first';
  }
}

// Get current page URL
async function getCurrentPageUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      state.clippedData.productWebsite = tab.url;
      document.getElementById('productWebsite').value = tab.url;
    }
  } catch (error) {
    console.error('Failed to get page URL:', error);
  }
}

// Handle crop tool - allows user to screenshot/crop part of page
async function handleCropTool() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Inject crop tool into page
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

// Crop tool function to inject into page
function initCropTool() {
  // Remove any existing crop tool
  document.getElementById('ffe-crop-overlay')?.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'ffe-crop-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.3);
    cursor: crosshair;
    z-index: 2147483647;
  `;
  
  const selection = document.createElement('div');
  selection.style.cssText = `
    position: absolute;
    border: 2px dashed #4361ee;
    background: rgba(67, 97, 238, 0.1);
    display: none;
  `;
  overlay.appendChild(selection);
  
  const instructions = document.createElement('div');
  instructions.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #4361ee;
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
  `;
  instructions.textContent = 'Click and drag to select area (ESC to cancel)';
  overlay.appendChild(instructions);
  
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
    const currentX = e.clientX;
    const currentY = e.clientY;
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    selection.style.left = Math.min(startX, currentX) + 'px';
    selection.style.top = Math.min(startY, currentY) + 'px';
    selection.style.width = width + 'px';
    selection.style.height = height + 'px';
  });
  
  overlay.addEventListener('mouseup', async (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    
    const rect = selection.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      overlay.remove();
      return;
    }
    
    // Capture the area
    overlay.style.display = 'none';
    
    try {
      // Use html2canvas or capture visible tab
      const canvas = document.createElement('canvas');
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      
      // Create a screenshot using the Offscreen API or capture
      const response = await chrome.runtime.sendMessage({
        action: 'captureVisibleTab'
      });
      
      if (response?.dataUrl) {
        const img = new Image();
        img.onload = () => {
          // Account for device pixel ratio
          const dpr = window.devicePixelRatio || 1;
          ctx.drawImage(img, 
            rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr,
            0, 0, rect.width, rect.height
          );
          const croppedDataUrl = canvas.toDataURL('image/png');
          
          // Send to extension
          chrome.runtime.sendMessage({
            action: 'imageClipped',
            imageUrl: croppedDataUrl
          });
          
          // Store in pending images
          chrome.storage.local.get(['pendingImages'], (result) => {
            const pendingImages = result.pendingImages || [];
            pendingImages.push(croppedDataUrl);
            chrome.storage.local.set({ pendingImages });
          });
          
          // Show feedback
          const feedback = document.createElement('div');
          feedback.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            z-index: 2147483647;
          `;
          feedback.textContent = '✓ Area captured! Open extension to see it.';
          document.body.appendChild(feedback);
          setTimeout(() => feedback.remove(), 2000);
        };
        img.src = response.dataUrl;
      }
    } catch (err) {
      console.error('Failed to capture:', err);
    }
    
    overlay.remove();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
    }
  }, { once: true });
  
  document.body.appendChild(overlay);
}

// Handle attachment download capture
async function handleAttachmentCapture() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send message to content script to find downloadable files
    chrome.tabs.sendMessage(tab.id, { action: 'findDownloads' }, (response) => {
      if (response?.downloads && response.downloads.length > 0) {
        // Add downloads to attachments
        response.downloads.forEach(dl => {
          if (!state.clippedData.attachments.some(a => a.url === dl.url)) {
            state.clippedData.attachments.push({
              name: dl.name,
              url: dl.url,
              type: dl.type
            });
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

// Render attachments
function renderAttachments() {
  const container = document.getElementById('attachmentsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (state.clippedData.attachments.length === 0) {
    return;
  }
  
  state.clippedData.attachments.forEach((att, index) => {
    const item = document.createElement('div');
    item.className = 'attachment-item';
    item.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      <span title="${att.url}">${att.name}</span>
      <button class="attachment-delete" onclick="removeAttachment(${index})">×</button>
    `;
    container.appendChild(item);
  });
}

// Remove attachment (make global for onclick)
window.removeAttachment = function(index) {
  state.clippedData.attachments.splice(index, 1);
  renderAttachments();
}

// Handle smart fill - uses AI to extract product information
async function handleSmartFill() {
  showLoading('AI is analyzing the page...');
  
  try {
    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // First, extract raw page content via content script
    let pageData = null;
    
    try {
      // Try to get page content from content script
      pageData = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'extractPageData' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response?.data);
          }
        });
      });
    } catch (e) {
      // Content script might not be loaded, inject it
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Wait a bit and try again
      await new Promise(r => setTimeout(r, 200));
      
      pageData = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'extractPageData' }, (response) => {
          resolve(response?.data || null);
        });
      });
    }
    
    // Get page text content
    let pageContent = '';
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText
      });
      pageContent = results[0]?.result || '';
    } catch (e) {
      console.log('Could not get page content:', e);
    }
    
    // Send to AI endpoint
    const response = await apiRequest('POST', CONFIG.ENDPOINTS.SMART_FILL, {
      url: tab.url,
      title: tab.title,
      pageContent: pageContent.substring(0, 10000), // Limit content size
      images: pageData?.images || []
    });
    
    // Check the response - API returns { success: true, data: {...} }
    if (response.ok && response.data?.success && response.data?.data) {
      processSmartFillData(response.data.data);
      showToast('AI extracted product information!', 'success');
    } else {
      // Fallback to basic extraction if AI fails
      if (pageData) {
        processSmartFillData(pageData);
        showToast('Basic extraction completed', 'success');
      } else {
        showToast(response.data?.error || response.error || 'Could not extract data', 'error');
      }
    }
  } catch (error) {
    console.error('Smart fill failed:', error);
    showToast('Smart fill failed: ' + (error.message || 'Unknown error'), 'error');
  }
  
  hideLoading();
}

// Process smart fill data (from AI or basic extraction)
function processSmartFillData(data) {
  // Field mappings - maps various source keys to our field IDs
  const fieldMappings = {
    // AI endpoint fields
    productName: 'productName',
    productDescription: 'productDescription',
    brand: 'brand',
    sku: 'sku',
    rrp: 'rrp',
    tradePrice: 'tradePrice',
    material: 'material',
    colour: 'colour',
    finish: 'finish',
    width: 'width',
    height: 'height',
    depth: 'depth',
    length: 'length',
    leadTime: 'leadTime',
    notes: 'notes',
    productWebsite: 'productWebsite',
    // Basic extraction fields
    title: 'productName',
    name: 'productName',
    description: 'productDescription',
    price: 'rrp',
    color: 'colour',
    url: 'productWebsite'
  };
  
  for (const [key, fieldId] of Object.entries(fieldMappings)) {
    if (data[key] && !state.clippedData[fieldId]) {
      state.clippedData[fieldId] = data[key];
      const input = document.getElementById(fieldId);
      if (input) {
        if (input.tagName === 'TEXTAREA') {
          input.value = data[key];
        } else {
          input.value = data[key];
        }
      }
    }
  }
  
  // Handle images
  if (data.images && data.images.length > 0) {
    // Merge with existing images, avoid duplicates
    const existingUrls = new Set(state.clippedData.images);
    for (const img of data.images) {
      if (!existingUrls.has(img)) {
        state.clippedData.images.push(img);
      }
    }
    renderImages();
  }
}

// Load any pending images from right-click clips
async function loadPendingImages() {
  try {
    // First, check storage directly for pending images
    const stored = await chrome.storage.local.get(['pendingImages']);
    
    if (stored.pendingImages && stored.pendingImages.length > 0) {
      let addedCount = 0;
      for (const imageUrl of stored.pendingImages) {
        if (!state.clippedData.images.includes(imageUrl)) {
          state.clippedData.images.push(imageUrl);
          addedCount++;
        }
      }
      
      // Clear pending images from storage
      await chrome.storage.local.remove(['pendingImages']);
      
      // Clear badge
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

// Render clipped images with drag-to-reorder
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
    
    // First image indicator
    if (index === 0) {
      const badge = document.createElement('span');
      badge.className = 'main-image-badge';
      badge.textContent = 'Main';
      imgWrapper.appendChild(badge);
    }
    
    const img = document.createElement('img');
    img.src = imgUrl;
    img.className = 'clipped-image';
    img.title = 'Click to remove, drag to reorder';
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'image-delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      removeImage(index);
    };
    
    imgWrapper.appendChild(img);
    imgWrapper.appendChild(deleteBtn);
    
    // Drag events
    imgWrapper.addEventListener('dragstart', handleDragStart);
    imgWrapper.addEventListener('dragover', handleDragOver);
    imgWrapper.addEventListener('drop', handleDrop);
    imgWrapper.addEventListener('dragend', handleDragEnd);
    
    elements.imagesContainer.appendChild(imgWrapper);
  });
}

// Drag and drop handlers for image reordering
let draggedImageIndex = null;

function handleDragStart(e) {
  draggedImageIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const wrapper = e.currentTarget;
  wrapper.classList.add('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  const targetIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.remove('drag-over');
  
  if (draggedImageIndex !== null && draggedImageIndex !== targetIndex) {
    // Reorder images
    const images = [...state.clippedData.images];
    const [draggedImage] = images.splice(draggedImageIndex, 1);
    images.splice(targetIndex, 0, draggedImage);
    state.clippedData.images = images;
    renderImages();
    showToast('Images reordered', 'success');
  }
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  draggedImageIndex = null;
}

// Remove image
function removeImage(index) {
  state.clippedData.images.splice(index, 1);
  renderImages();
}

// Handle + button click - start picker mode on page
async function handleAddButtonClick(e, fieldId) {
  e.preventDefault();
  
  const fieldNames = {
    productDescription: 'Product Description',
    productDetails: 'Product Details',
    productName: 'Product Name',
    brand: 'Brand',
    productWebsite: 'Product Website',
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
  
  try {
    // First, check if there's already selected text on the page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || ''
    });
    
    const selectedText = results[0]?.result?.trim();
    
    if (selectedText) {
      // Use selected text directly
      state.clippedData[fieldId] = selectedText;
      const input = document.getElementById(fieldId);
      if (input) input.value = selectedText;
      showToast(`Added to ${fieldNames[fieldId] || fieldId}`, 'success');
    } else {
      // No selection - save current state and start picker mode
      await saveFormState();
      
      // Store which field we're picking for
      await chrome.storage.local.set({ 
        pickerField: fieldId,
        pickerFieldName: fieldNames[fieldId] || fieldId
      });
      
      // Try to start picker mode on the page
      try {
        // First try to send message to existing content script
        chrome.tabs.sendMessage(tab.id, { action: 'startPicker', field: fieldId }, (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            console.log('Content script not ready, injecting...');
            // Content script not loaded - inject it first
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            }).then(() => {
              // Wait a moment for script to initialize
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'startPicker', field: fieldId });
              }, 100);
            }).catch(err => {
              console.error('Failed to inject content script:', err);
              showToast('Could not access this page', 'error');
            });
          }
        });
      } catch (err) {
        console.error('Failed to start picker:', err);
        showToast('Could not access this page', 'error');
      }
      
      // Show instruction toast
      showToast('Click on text in the page to capture it', 'info');
    }
  } catch (error) {
    console.error('Failed to start picker:', error);
    showToast('Could not access page. Try refreshing.', 'error');
  }
}

// Save current form state to storage
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

// Load saved form state from storage
async function loadFormState() {
  try {
    const stored = await chrome.storage.local.get([
      'savedFormState',
      'pickerResult',
      'pickerField'
    ]);
    
    const { savedFormState, pickerResult, pickerField } = stored;
    
    console.log('Loading form state:', { savedFormState: !!savedFormState, pickerResult, pickerField });

    // First, check if there's a picker result to apply (higher priority)
    if (pickerResult && pickerField) {
      console.log(`Applying picker result to field: ${pickerField}`);
      state.clippedData[pickerField] = pickerResult;
      
      // Wait a moment for DOM to be ready
      setTimeout(() => {
        const input = document.getElementById(pickerField);
        if (input) {
          input.value = pickerResult;
          console.log(`Set value for ${pickerField}:`, pickerResult.substring(0, 50));
        } else {
          console.log(`Input not found: ${pickerField}`);
        }
      }, 100);
      
      showToast(`Text captured for ${formatFieldLabel(pickerField)}!`, 'success');

      // Clear the picker result
      await chrome.storage.local.remove(['pickerResult', 'pickerField', 'pickerFieldName']);
    }

    // Restore form state if exists
    if (savedFormState) {
      // Merge clipped data
      if (savedFormState.clippedData) {
        state.clippedData = { ...state.clippedData, ...savedFormState.clippedData };
      }
      state.selectedProject = savedFormState.selectedProject;
      state.selectedRoom = savedFormState.selectedRoom;
      state.selectedSection = savedFormState.selectedSection;

      // Update form fields
      populateFormFromState();

      // Restore selectors
      if (state.selectedProject && elements.projectSelect) {
        elements.projectSelect.value = state.selectedProject;
        await loadRooms(state.selectedProject);

        if (state.selectedRoom && elements.roomSelect) {
          elements.roomSelect.value = state.selectedRoom;
          document.getElementById('roomGroup')?.classList.remove('hidden');
          await loadSections(state.selectedRoom);

          if (state.selectedSection && elements.sectionSelect) {
            elements.sectionSelect.value = state.selectedSection;
            document.getElementById('sectionGroup')?.classList.remove('hidden');
          }
        }
      }
      
      // Clear saved state after restoring
      await chrome.storage.local.remove(['savedFormState']);
    }

    updateClipButton();
  } catch (error) {
    console.error('Failed to load form state:', error);
  }
}

// Format field label for display
function formatFieldLabel(field) {
  const labels = {
    productDescription: 'Product Description',
    productDetails: 'Product Details',
    productName: 'Product Name',
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

// Populate form fields from state
function populateFormFromState() {
  const fields = [
    'productDescription', 'productDetails', 'productName', 'brand', 
    'productWebsite', 'docCode', 'sku', 'colour', 'finish', 'material',
    'width', 'length', 'height', 'depth', 'quantity', 'rrp', 
    'tradePrice', 'leadTime', 'notes'
  ];
  
  fields.forEach(field => {
    const input = document.getElementById(field);
    if (input && state.clippedData[field]) {
      input.value = state.clippedData[field];
    }
  });
  
  // Render images
  renderImages();
}

// Handle clip button - directly saves the item
async function handleClip() {
  // Validate required fields
  if (!state.clippedData.productName) {
    showToast('Please add a product name', 'error');
    return;
  }
  
  if (!state.selectedProject) {
    showToast('Please select a project', 'error');
    return;
  }
  
  if (!state.selectedRoom) {
    showToast('Please select a room', 'error');
    return;
  }
  
  if (!state.selectedSection) {
    showToast('Please select a section', 'error');
    return;
  }
  
  showLoading('Saving item...');
  
  try {
    // Prepare the data
    const clipData = {
      roomId: state.selectedRoom,
      sectionId: state.selectedSection,
      item: {
        name: state.clippedData.productName,
        description: state.clippedData.productDescription,
        supplierName: state.clippedData.brand,
        supplierLink: state.clippedData.productWebsite,
        modelNumber: state.clippedData.sku,
        quantity: parseInt(state.clippedData.quantity) || 1,
        unitCost: parsePrice(state.clippedData.rrp),
        notes: state.clippedData.notes,
        customFields: {
          productDetails: state.clippedData.productDetails,
          docCode: state.clippedData.docCode,
          colour: state.clippedData.colour,
          finish: state.clippedData.finish,
          material: state.clippedData.material,
          width: state.clippedData.width,
          length: state.clippedData.length,
          height: state.clippedData.height,
          depth: state.clippedData.depth,
          tradePrice: state.clippedData.tradePrice,
          leadTime: state.clippedData.leadTime
        },
        attachments: {
          images: state.clippedData.images,
          files: state.clippedData.attachments
        }
      }
    };
    
    const response = await apiRequest('POST', CONFIG.ENDPOINTS.CLIP, clipData);
    
    if (response.ok) {
      showToast('Item saved successfully!', 'success');
      handleClear();
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
  // Reset clipped data
  state.clippedData = {
    images: [],
    attachments: [],
    productDescription: '',
    productDetails: '',
    productName: '',
    brand: '',
    productWebsite: state.clippedData.productWebsite, // Keep the URL
    docCode: '',
    sku: '',
    colour: '',
    finish: '',
    material: '',
    width: '',
    length: '',
    height: '',
    depth: '',
    quantity: 1,
    rrp: '',
    tradePrice: '',
    leadTime: '',
    notes: ''
  };
  
  // Clear all input fields
  document.querySelectorAll('.field-input input, .field-input textarea').forEach(input => {
    if (input.id !== 'productWebsite') {
      input.value = input.type === 'number' ? '1' : '';
    }
  });
  
  // Clear images
  renderImages();
  
  showToast('Form cleared', 'info');
}

// Handle messages from content script
function handleMessage(message, sender, sendResponse) {
  switch (message.action) {
    case 'textSelected':
      // Use field from message or from state
      const field = message.field || state.activePickerField;
      if (field && message.text) {
        console.log('Received textSelected message:', field, message.text.substring(0, 50));
        state.clippedData[field] = message.text;
        const input = document.getElementById(field);
        if (input) {
          input.value = message.text;
        }

        // Deactivate picker
        document.querySelectorAll('.add-btn').forEach(b => b.classList.remove('active'));
        state.activePickerField = null;
        showToast(`Text captured for ${formatFieldLabel(field)}!`, 'success');
        
        // Clear picker data from storage
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
        loadProjects();
        showToast('Logged in successfully!', 'success');
      }
      sendResponse({ ok: true });
      break;
  }
  
  return true; // Keep the message channel open for async response
}

// Load projects
async function loadProjects() {
  showLoading('Loading projects...');
  
  try {
    const response = await apiRequest('GET', CONFIG.ENDPOINTS.PROJECTS);
    
    if (response.ok && response.data.projects) {
      state.projects = response.data.projects;
      
      // Populate project select
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

      // Populate room select
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
  showLoading('Loading sections...');

  try {
    const response = await apiRequest('GET', `${CONFIG.ENDPOINTS.SECTIONS}?roomId=${roomId}`);

    if (response.ok && response.data.sections) {
      state.sections = response.data.sections;

      // Populate section select
      elements.sectionSelect.innerHTML = '<option value="">Select Section...</option>';
      state.sections.forEach(section => {
        const option = document.createElement('option');
        option.value = section.id;
        option.textContent = section.name;
        elements.sectionSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Failed to load sections:', error);
    showToast('Failed to load sections', 'error');
  }

  hideLoading();
}

// API request helper
async function apiRequest(method, endpoint, body = null) {
  const url = `${CONFIG.API_BASE_URL}${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
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
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      error: data.error
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error.message
    };
  }
}

// Send message to content script
async function sendToContentScript(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    console.error('Failed to send message to content script:', error);
  }
}

// Parse price string to number
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

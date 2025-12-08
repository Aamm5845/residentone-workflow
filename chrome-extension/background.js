// Meisner FFE Clipper - Background Service Worker

// Environment Configuration
// Set to 'local' for development, 'production' for live site
const ENVIRONMENT = 'production'; // Change to 'local' for development

// Configuration
const CONFIG = {
  API_URLS: {
    local: 'http://localhost:3000',
    production: 'https://app.meisnerinteriors.com'
  },
  get API_BASE_URL() {
    return this.API_URLS[ENVIRONMENT] || this.API_URLS.local;
  }
};

// Create context menu for image clipping
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu item for images
  chrome.contextMenus.create({
    id: 'clipImage',
    title: 'Clip Image to StudioFlow',
    contexts: ['image']
  });
  
  // Enable side panel to open on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  
  console.log('Meisner FFE Clipper installed');
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'clipImage') {
    // Send message to popup with the image URL
    chrome.runtime.sendMessage({
      action: 'imageClipped',
      imageUrl: info.srcUrl
    }).catch(() => {
      // Popup might not be open, store the image for later
      chrome.storage.local.get(['pendingImages'], (result) => {
        const pendingImages = result.pendingImages || [];
        pendingImages.push(info.srcUrl);
        chrome.storage.local.set({ pendingImages });
        
        // Show notification
        chrome.action.setBadgeText({ text: pendingImages.length.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#4361ee' });
      });
    });
  }
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getApiBaseUrl':
      sendResponse({ url: CONFIG.API_BASE_URL });
      break;
      
    case 'imageRightClicked':
      // Store the image URL temporarily for context menu
      chrome.storage.local.set({ lastRightClickedImage: message.imageUrl });
      sendResponse({ ok: true });
      break;
      
    case 'clearBadge':
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ ok: true });
      break;
      
    case 'getPendingImages':
      chrome.storage.local.get(['pendingImages'], (result) => {
        sendResponse({ images: result.pendingImages || [] });
        // Clear pending images
        chrome.storage.local.remove(['pendingImages']);
        chrome.action.setBadgeText({ text: '' });
      });
      return true; // Async response
    
    case 'captureVisibleTab':
      // Capture visible tab for crop tool
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Capture failed:', chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ dataUrl });
        }
      });
      return true; // Async response
    
    case 'imageClipped':
      // Store clipped image
      if (message.imageUrl) {
        chrome.storage.local.get(['pendingImages'], (result) => {
          const pendingImages = result.pendingImages || [];
          pendingImages.push(message.imageUrl);
          chrome.storage.local.set({ pendingImages });
          chrome.action.setBadgeText({ text: pendingImages.length.toString() });
          chrome.action.setBadgeBackgroundColor({ color: '#4361ee' });
        });
      }
      sendResponse({ ok: true });
      break;
    
    case 'authComplete':
      // Store auth credentials when received from auth page
      if (message.apiKey) {
        chrome.storage.local.set({ 
          apiKey: message.apiKey, 
          user: message.user 
        });
        console.log('Extension authenticated successfully');
      }
      sendResponse({ ok: true });
      break;
      
    default:
      sendResponse({ ok: false, error: 'Unknown action' });
  }
  
  return true;
});

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // Content script is automatically injected via manifest
  }
});

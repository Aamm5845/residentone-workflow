// Meisner FFE Clipper - Content Script
// This script runs on every page to enable text/image selection and auth sync

(function() {
  'use strict';
  
  // Helper to safely send messages (handles extension context invalidation)
  function safeSendMessage(message) {
    return new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          console.log('Extension context invalidated, please refresh the page');
          resolve(null);
          return;
        }
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Message send failed:', chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        console.log('Extension context error:', e.message);
        resolve(null);
      }
    });
  }
  
  // Check if we're on the extension-auth page
  if (window.location.pathname === '/extension-auth') {
    // Monitor localStorage for auth data
    const checkAuth = () => {
      const authData = localStorage.getItem('extension_auth');
      if (authData) {
        try {
          const { apiKey, user } = JSON.parse(authData);
          if (apiKey) {
            // Send to extension background
            safeSendMessage({
              action: 'authComplete',
              apiKey,
              user
            });
            // Clear the localStorage item
            localStorage.removeItem('extension_auth');
            console.log('Auth synced to extension');
          }
        } catch (e) {
          console.error('Failed to parse auth data:', e);
        }
      }
    };
    
    // Check immediately and set up interval
    checkAuth();
    const authInterval = setInterval(checkAuth, 500);
    
    // Clean up after 2 minutes
    setTimeout(() => clearInterval(authInterval), 120000);
  }
  
  // State
  let isPickerActive = false;
  let activeField = null;
  let highlightedElement = null;
  let overlay = null;
  
  // Styles for highlighting
  const HIGHLIGHT_STYLE = {
    outline: '2px solid #4361ee',
    outlineOffset: '2px',
    cursor: 'crosshair'
  };
  
  // Initialize
  init();
  
  function init() {
    // Check if extension context is valid
    try {
      if (!chrome.runtime?.id) {
        console.log('Extension not available - page refresh may be needed');
        return;
      }
      
      console.log('FFE Clipper content script initialized');
      
      // Listen for messages from popup/side panel
      chrome.runtime.onMessage.addListener(handleMessage);
      
      // Set up context menu for image clipping
      setupImageContextMenu();
    } catch (e) {
      console.log('Extension initialization failed:', e.message);
    }
  }
  
  // Handle messages from popup/side panel
  function handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'startPicker':
          startPicker(message.field);
          sendResponse({ ok: true });
          break;
          
        case 'stopPicker':
          stopPicker();
          sendResponse({ ok: true });
          break;
          
        case 'extractPageData':
          const data = extractPageData();
          sendResponse({ data });
          break;
          
        case 'findDownloads':
          const downloads = findDownloadableFiles();
          sendResponse({ downloads });
          break;
          
        default:
          sendResponse({ ok: false, error: 'Unknown action' });
      }
    } catch (e) {
      console.log('Message handling error:', e.message);
      sendResponse({ ok: false, error: e.message });
    }
    
    return true; // Keep message channel open
  }
  
  // Find downloadable files on the page (PDFs, images, docs)
  function findDownloadableFiles() {
    const downloads = [];
    const seen = new Set();
    
    // Find all links to downloadable files
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.href.toLowerCase();
      const text = link.textContent.trim() || link.title || 'Download';
      
      // Check for common download file extensions
      const downloadExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.dwg', '.dxf', '.skp', '.3ds', '.obj'];
      
      for (const ext of downloadExtensions) {
        if (href.includes(ext) && !seen.has(link.href)) {
          seen.add(link.href);
          downloads.push({
            name: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            url: link.href,
            type: ext.replace('.', '').toUpperCase()
          });
          break;
        }
      }
      
      // Check for download attribute
      if (link.hasAttribute('download') && !seen.has(link.href)) {
        seen.add(link.href);
        const filename = link.getAttribute('download') || text;
        downloads.push({
          name: filename.substring(0, 100),
          url: link.href,
          type: 'FILE'
        });
      }
    });
    
    // Find buttons/elements that trigger downloads
    const downloadButtons = document.querySelectorAll('[class*="download"], [id*="download"], [data-download]');
    downloadButtons.forEach(btn => {
      const href = btn.href || btn.dataset.href || btn.dataset.url;
      if (href && !seen.has(href)) {
        seen.add(href);
        downloads.push({
          name: btn.textContent.trim() || 'Download',
          url: href,
          type: 'FILE'
        });
      }
    });
    
    return downloads.slice(0, 20); // Limit results
  }
  
  // Start text picker mode
  function startPicker(field) {
    isPickerActive = true;
    activeField = field;
    
    // Create overlay
    createOverlay();
    
    // Add event listeners
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    
    // Change cursor
    document.body.style.cursor = 'crosshair';
  }
  
  // Stop text picker mode
  function stopPicker() {
    isPickerActive = false;
    activeField = null;
    
    // Remove overlay
    removeOverlay();
    
    // Remove event listeners
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('mouseout', handleMouseOut, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    
    // Reset cursor
    document.body.style.cursor = '';
    
    // Remove highlight from any element
    if (highlightedElement) {
      removeHighlight(highlightedElement);
      highlightedElement = null;
    }
  }
  
  // Create semi-transparent overlay to indicate picker mode
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'ro-clipper-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(67, 97, 238, 0.05);
      z-index: 2147483646;
      pointer-events: none;
    `;
    
    // Add instruction banner
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #4361ee;
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      pointer-events: none;
    `;
    banner.textContent = `Click on text to capture for: ${formatFieldName(activeField)} (Press ESC to cancel)`;
    overlay.appendChild(banner);
    
    document.body.appendChild(overlay);
  }
  
  // Remove overlay
  function removeOverlay() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }
  
  // Format field name for display
  function formatFieldName(field) {
    const names = {
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
    return names[field] || field;
  }
  
  // Handle mouse over
  function handleMouseOver(e) {
    if (!isPickerActive) return;
    
    try {
      const target = e.target;
      if (!target) return;
      
      // Skip our own overlay elements
      if (target.id === 'ro-clipper-overlay' || target.closest?.('#ro-clipper-overlay')) {
        return;
      }
      
      // Only highlight text-containing elements
      if (hasTextContent(target)) {
        if (highlightedElement && highlightedElement !== target) {
          removeHighlight(highlightedElement);
        }
        
        addHighlight(target);
        highlightedElement = target;
      }
    } catch (e) {
      // Ignore errors during mouse over
    }
  }
  
  // Handle mouse out
  function handleMouseOut(e) {
    if (!isPickerActive) return;
    
    try {
      const target = e.target;
      
      if (target === highlightedElement) {
        removeHighlight(target);
        highlightedElement = null;
      }
    } catch (e) {
      // Ignore errors during mouse out
    }
  }
  
  // Handle click
  function handleClick(e) {
    if (!isPickerActive) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target;

    // Skip our own overlay elements
    if (target.id === 'ro-clipper-overlay' || target.closest('#ro-clipper-overlay')) {
      return;
    }

    // Get text content
    const text = getTextContent(target);
    const currentField = activeField; // Save before stopping

    if (text && currentField) {
      const trimmedText = text.trim();
      
      console.log('Picker captured:', currentField, trimmedText.substring(0, 50));

      // Save to storage - this will trigger the storage change listener in popup
      try {
        chrome.storage.local.set({
          pickerResult: trimmedText,
          pickerField: currentField
        }, () => {
          if (chrome.runtime.lastError) {
            console.log('Storage save error:', chrome.runtime.lastError.message);
          } else {
            console.log('Picker result saved to storage');
          }
        });
      } catch (e) {
        console.log('Could not save to storage:', e.message);
      }

      // Also try to send to popup directly
      safeSendMessage({
        action: 'textSelected',
        text: trimmedText,
        field: currentField
      });

      // Show feedback
      showPickerFeedback(trimmedText);
    } else {
      console.log('No text or field:', { text: !!text, currentField });
    }

    stopPicker();
  }
  
  // Show feedback when text is picked
  function showPickerFeedback(text) {
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 300px;
      text-align: center;
    `;
    feedback.innerHTML = `✓ Captured! <br><small>Open the extension to see it.</small>`;
    document.body.appendChild(feedback);
    
    setTimeout(() => feedback.remove(), 2000);
  }
  
  // Handle key down
  function handleKeyDown(e) {
    if (!isPickerActive) return;
    
    if (e.key === 'Escape') {
      e.preventDefault();
      stopPicker();
    }
  }
  
  // Add highlight to element
  function addHighlight(element) {
    if (!element || !element.style || !element.dataset) return;
    
    try {
      element.dataset.roOriginalOutline = element.style.outline;
      element.dataset.roOriginalOutlineOffset = element.style.outlineOffset;
      element.dataset.roOriginalCursor = element.style.cursor;
      
      element.style.outline = HIGHLIGHT_STYLE.outline;
      element.style.outlineOffset = HIGHLIGHT_STYLE.outlineOffset;
      element.style.cursor = HIGHLIGHT_STYLE.cursor;
    } catch (e) {
      // Element might be removed or inaccessible
    }
  }
  
  // Remove highlight from element
  function removeHighlight(element) {
    if (!element || !element.style || !element.dataset) return;
    
    try {
      element.style.outline = element.dataset.roOriginalOutline || '';
      element.style.outlineOffset = element.dataset.roOriginalOutlineOffset || '';
      element.style.cursor = element.dataset.roOriginalCursor || '';
      
      delete element.dataset.roOriginalOutline;
      delete element.dataset.roOriginalOutlineOffset;
      delete element.dataset.roOriginalCursor;
    } catch (e) {
      // Element might be removed or inaccessible
    }
  }
  
  // Check if element has text content
  function hasTextContent(element) {
    // Safety check
    if (!element || !element.tagName) return false;
    
    // Skip certain elements
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'IMG', 'VIDEO', 'AUDIO'];
    if (skipTags.includes(element.tagName)) return false;
    
    // Check for direct text content
    if (element.childNodes) {
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim()) {
          return true;
        }
      }
    }
    
    // Or if it's an input/textarea with value
    if ((element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') && element.value) {
      return true;
    }
    
    return false;
  }
  
  // Get text content from element
  function getTextContent(element) {
    // Safety check
    if (!element) return '';
    
    // For inputs and textareas, get value
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      return element.value || '';
    }
    
    // For other elements, get text content
    // Try to get just the direct text first
    let text = '';
    if (element.childNodes) {
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent || '';
        }
      }
    }
    
    // If no direct text, fall back to innerText
    if (!text.trim() && element.innerText) {
      text = element.innerText;
    }
    
    return text;
  }
  
  // Set up context menu for image clipping
  function setupImageContextMenu() {
    // Listen for right-click on images
    document.addEventListener('contextmenu', (e) => {
      const target = e.target;
      
      if (target && target.tagName === 'IMG') {
        // Store the image URL for the context menu handler
        safeSendMessage({
          action: 'imageRightClicked',
          imageUrl: target.src
        });
      }
    }, true);
  }
  
  // Extract page data for smart fill
  function extractPageData() {
    const data = {
      url: window.location.href,
      title: document.title,
      images: []
    };
    
    // Try to extract structured data (JSON-LD)
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const json = JSON.parse(script.textContent);
        if (json['@type'] === 'Product' || (Array.isArray(json) && json.some(item => item['@type'] === 'Product'))) {
          const product = json['@type'] === 'Product' ? json : json.find(item => item['@type'] === 'Product');
          if (product) {
            data.name = product.name;
            data.description = product.description;
            data.brand = product.brand?.name || product.brand;
            data.sku = product.sku || product.mpn;
            if (product.offers) {
              const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
              data.price = offer.price || offer.lowPrice;
            }
            if (product.image) {
              const images = Array.isArray(product.image) ? product.image : [product.image];
              data.images = images.filter(img => typeof img === 'string');
            }
          }
        }
      } catch (e) {
        // JSON parse error, skip
      }
    }
    
    // Try to extract from Open Graph meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogImage = document.querySelector('meta[property="og:image"]');
    
    if (!data.name && ogTitle) data.name = ogTitle.content;
    if (!data.description && ogDescription) data.description = ogDescription.content;
    if (ogImage && !data.images.includes(ogImage.content)) {
      data.images.unshift(ogImage.content);
    }
    
    // Try to extract from common HTML patterns
    if (!data.name) {
      // Look for product title
      const titleSelectors = [
        'h1.product-title',
        'h1.product-name',
        'h1[itemprop="name"]',
        '[data-testid="product-title"]',
        '.product-title h1',
        '.product-name',
        'h1'
      ];
      
      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          data.name = el.textContent.trim();
          break;
        }
      }
    }
    
    if (!data.description) {
      const descSelectors = [
        '[itemprop="description"]',
        '.product-description',
        '.product-details',
        '#product-description'
      ];
      
      for (const selector of descSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          data.description = el.textContent.trim().substring(0, 500);
          break;
        }
      }
    }
    
    if (!data.brand) {
      const brandSelectors = [
        '[itemprop="brand"]',
        '.product-brand',
        '.brand',
        '[data-testid="brand"]'
      ];
      
      for (const selector of brandSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          data.brand = el.textContent.trim();
          break;
        }
      }
    }
    
    if (!data.price) {
      const priceSelectors = [
        '[itemprop="price"]',
        '.product-price',
        '.price',
        '[data-testid="price"]',
        '.current-price'
      ];
      
      for (const selector of priceSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const priceText = el.textContent.trim();
          const priceMatch = priceText.match(/[\d,.]+/);
          if (priceMatch) {
            data.price = priceMatch[0];
            break;
          }
        }
      }
    }
    
    if (!data.sku) {
      const skuSelectors = [
        '[itemprop="sku"]',
        '.product-sku',
        '.sku',
        '[data-testid="sku"]'
      ];
      
      for (const selector of skuSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          data.sku = el.textContent.trim();
          break;
        }
      }
    }
    
    // Helper to check if image is likely a product image
    const isProductImage = (img) => {
      if (!img || !img.src) return false;
      const src = img.src.toLowerCase();
      
      // Skip data URIs, tiny images, logos, icons
      if (src.includes('data:')) return false;
      if (src.includes('logo')) return false;
      if (src.includes('icon')) return false;
      if (src.includes('favicon')) return false;
      if (src.includes('sprite')) return false;
      if (src.includes('avatar')) return false;
      if (src.includes('placeholder')) return false;
      if (src.includes('loading')) return false;
      if (src.includes('banner')) return false;
      if (src.includes('social')) return false;
      if (src.includes('payment')) return false;
      if (src.includes('badge')) return false;
      if (src.includes('1x1')) return false;
      if (src.includes('pixel')) return false;
      
      // Check image dimensions if available
      if (img.naturalWidth && img.naturalWidth < 100) return false;
      if (img.naturalHeight && img.naturalHeight < 100) return false;
      
      return true;
    };

    // Extract images if not found in structured data
    if (data.images.length === 0) {
      // Priority selectors for product images
      const imageSelectors = [
        '.product-image img',
        '.product-gallery img',
        '.product-images img',
        '[data-testid="product-image"] img',
        'img[itemprop="image"]',
        '.gallery img',
        '.swiper-slide img',
        '.carousel img',
        '[class*="product"] img',
        'main img'
      ];
      
      for (const selector of imageSelectors) {
        try {
          const imgs = document.querySelectorAll(selector);
          imgs.forEach(img => {
            if (isProductImage(img) && !data.images.includes(img.src)) {
              data.images.push(img.src);
            }
          });
        } catch (e) {
          // Selector might be invalid, skip
        }
        
        if (data.images.length >= 10) break;
      }
    }
    
    // Try to extract dimensions
    const dimensionPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:x|×|X)\s*(\d+(?:\.\d+)?)\s*(?:x|×|X)\s*(\d+(?:\.\d+)?)/i, // WxLxH
      /width[:\s]*(\d+(?:\.\d+)?)/i,
      /length[:\s]*(\d+(?:\.\d+)?)/i,
      /height[:\s]*(\d+(?:\.\d+)?)/i,
      /depth[:\s]*(\d+(?:\.\d+)?)/i
    ];
    
    const bodyText = document.body.innerText;
    
    // Look for material
    const materialMatch = bodyText.match(/material[:\s]*([\w\s]+)/i);
    if (materialMatch) data.material = materialMatch[1].trim();
    
    // Look for color
    const colorMatch = bodyText.match(/colou?r[:\s]*([\w\s,]+)/i);
    if (colorMatch) data.colour = colorMatch[1].trim();
    
    // Look for finish
    const finishMatch = bodyText.match(/finish[:\s]*([\w\s]+)/i);
    if (finishMatch) data.finish = finishMatch[1].trim();
    
    // Look for lead time
    const leadTimeMatch = bodyText.match(/lead\s*time[:\s]*([\w\s\d-]+)/i);
    if (leadTimeMatch) data.leadTime = leadTimeMatch[1].trim();
    
    return data;
  }
})();

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
  
  // Check if we're on the extension-auth page (more flexible matching)
  if (window.location.pathname.startsWith('/extension-auth')) {
    console.log('[FFE Clipper] Auth page detected, starting auth sync...');
    
    // Monitor localStorage for auth data
    const checkAuth = async () => {
      const authData = localStorage.getItem('extension_auth');
      console.log('[FFE Clipper] Checking for auth data:', !!authData);
      
      if (authData) {
        try {
          const { apiKey, user } = JSON.parse(authData);
          if (apiKey) {
            console.log('[FFE Clipper] Found API key, sending to extension...');
            
            // Send to extension background
            const result = await safeSendMessage({
              action: 'authComplete',
              apiKey,
              user
            });
            console.log('[FFE Clipper] Message send result:', result);
            
            // Also store directly in chrome.storage as backup
            try {
              await chrome.storage.local.set({ apiKey, user });
              console.log('[FFE Clipper] Stored directly in chrome.storage');
            } catch (e) {
              console.log('[FFE Clipper] Direct storage failed:', e.message);
            }
            
            // Clear the localStorage item
            localStorage.removeItem('extension_auth');
            console.log('[FFE Clipper] Auth synced to extension successfully!');
          }
        } catch (e) {
          console.error('[FFE Clipper] Failed to parse auth data:', e);
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
      images: [],
      pdfLinks: [],
      specSheets: []
    };
    
    // Helper to check if element is visible on page
    function isElementVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
      if (style.opacity === '0') return false;
      const rect = el.getBoundingClientRect();
      // Check if has actual dimensions
      if (rect.width < 10 || rect.height < 10) return false;
      return true;
    }

    // Helper to score how likely an image is the main product image
    function scoreProductImage(img, index) {
      let score = 100 - index; // Earlier images get higher base score
      const src = (img.src || '').toLowerCase();
      const alt = (img.alt || '').toLowerCase();
      const className = (img.className || '').toLowerCase();
      const parent = img.closest('[class]');
      const parentClass = parent ? (parent.className || '').toLowerCase() : '';

      // CRITICAL: Check if image is actually visible on the page
      if (!isElementVisible(img)) {
        return -1000; // Hidden images get very low score
      }

      // Get actual displayed size on page (not natural size)
      const rect = img.getBoundingClientRect();
      const displayedWidth = rect.width;
      const displayedHeight = rect.height;

      // Big boost for large displayed images (the main product image is usually big on screen)
      if (displayedWidth >= 400 && displayedHeight >= 400) score += 100;
      else if (displayedWidth >= 300 && displayedHeight >= 300) score += 70;
      else if (displayedWidth >= 200 && displayedHeight >= 200) score += 40;
      else if (displayedWidth < 100 || displayedHeight < 100) score -= 50;

      // Boost for images in the viewport (visible without scrolling)
      if (rect.top >= 0 && rect.top < window.innerHeight && rect.left >= 0 && rect.left < window.innerWidth) {
        score += 50;
      }

      // Boost for product-related classes/attributes
      if (className.includes('product') || className.includes('main') || className.includes('hero')) score += 50;
      if (parentClass.includes('product') || parentClass.includes('gallery') || parentClass.includes('main')) score += 40;
      if (alt && alt.length > 10) score += 20; // Has meaningful alt text
      if (src.includes('product') || src.includes('main')) score += 30;

      // Boost for larger natural images
      if (img.naturalWidth >= 500 || img.width >= 500) score += 30;
      if (img.naturalWidth >= 800 || img.width >= 800) score += 20;

      // Check if image is in a gallery/carousel (likely product image)
      if (img.closest('.swiper, .carousel, .gallery, .slider, [data-gallery]')) score += 35;

      // Penalize for non-product patterns
      if (src.includes('logo')) score -= 100;
      if (src.includes('icon')) score -= 100;
      if (src.includes('banner')) score -= 50;
      if (src.includes('avatar')) score -= 100;
      if (src.includes('placeholder')) score -= 80;
      if (src.includes('loading')) score -= 80;
      if (src.includes('social')) score -= 100;
      if (src.includes('payment')) score -= 100;
      if (src.includes('badge')) score -= 80;
      if (src.includes('flag')) score -= 100;
      if (src.includes('thumbnail') && displayedWidth < 150) score -= 60;
      if (src.includes('thumb') && displayedWidth < 150) score -= 60;
      if (className.includes('logo')) score -= 100;
      if (className.includes('icon')) score -= 100;
      if (className.includes('thumb') && displayedWidth < 150) score -= 50;

      // Skip tiny images
      if (img.naturalWidth && img.naturalWidth < 100) score -= 200;
      if (img.naturalHeight && img.naturalHeight < 100) score -= 200;

      return score;
    }
    
    // Find PDF spec sheets and documents
    function findSpecSheets() {
      const pdfs = [];
      const seen = new Set();
      
      // Keywords that suggest spec sheets
      const specKeywords = ['spec', 'specification', 'datasheet', 'data sheet', 'technical', 'brochure', 
                            'catalog', 'catalogue', 'download', 'pdf', 'manual', 'guide', 'instruction',
                            'dimensions', 'drawing', 'cad', 'dwg', '2d', '3d'];
      
      // Find all links
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.href.toLowerCase();
        const text = (link.textContent || link.title || '').toLowerCase();
        
        if (seen.has(link.href)) return;
        
        // Check if it's a PDF link
        const isPdf = href.endsWith('.pdf') || href.includes('.pdf?') || href.includes('/pdf/');
        
        // Check if text/href suggests it's a spec sheet
        const isSpecRelated = specKeywords.some(kw => text.includes(kw) || href.includes(kw));
        
        if (isPdf || isSpecRelated) {
          seen.add(link.href);
          pdfs.push({
            url: link.href,
            name: link.textContent?.trim() || link.title || 'Download',
            type: isPdf ? 'PDF' : 'LINK',
            isSpec: isSpecRelated
          });
        }
      });
      
      // Also check for buttons that might trigger downloads
      document.querySelectorAll('button, [role="button"]').forEach(btn => {
        const text = (btn.textContent || btn.title || '').toLowerCase();
        const onClick = btn.getAttribute('onclick') || '';
        const dataUrl = btn.dataset.url || btn.dataset.href || '';
        
        if (specKeywords.some(kw => text.includes(kw))) {
          // Try to extract URL from data attributes or onclick
          let url = dataUrl;
          if (!url && onClick.includes('.pdf')) {
            // Simple extraction - look for URL in onclick
            const pdfMatch = onClick.match(/https?:\/\/[^\s'"]+\.pdf[^\s'"]*/i);
            if (pdfMatch) url = pdfMatch[0];
          }
          if (url && !seen.has(url)) {
            seen.add(url);
            pdfs.push({
              url: url,
              name: btn.textContent?.trim() || 'Download',
              type: 'PDF',
              isSpec: true
            });
          }
        }
      });
      
      return pdfs;
    }
    
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
    
    // Extract and score images to find best product images
    if (data.images.length === 0) {
      const allImages = [];
      const seen = new Set();
      
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
        'main img',
        'article img',
        '.content img'
      ];
      
      // Collect all candidate images
      for (const selector of imageSelectors) {
        try {
          const imgs = document.querySelectorAll(selector);
          imgs.forEach((img, idx) => {
            if (!img.src || seen.has(img.src)) return;
            if (img.src.includes('data:') && img.src.length < 100) return; // Skip tiny data URIs

            seen.add(img.src);
            const score = scoreProductImage(img, idx);
            // Only include images with positive score (visible and reasonably sized)
            if (score > 50) {
              allImages.push({ src: img.src, score, alt: img.alt });
            }
          });
        } catch (e) {
          // Selector might be invalid, skip
        }
      }

      // Sort by score and take top images (only those with good scores)
      allImages.sort((a, b) => b.score - a.score);
      // Filter to only include images with decent scores
      const goodImages = allImages.filter(img => img.score > 100);
      data.images = (goodImages.length > 0 ? goodImages : allImages).slice(0, 10).map(img => img.src);
      
      // Store the best image info separately
      if (allImages.length > 0) {
        data.mainImage = allImages[0].src;
        data.mainImageAlt = allImages[0].alt;
      }
    }
    
    // Find spec sheets and PDFs
    data.specSheets = findSpecSheets();
    data.pdfLinks = data.specSheets.filter(s => s.type === 'PDF').map(s => s.url);
    
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

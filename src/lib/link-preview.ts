/**
 * Fetch Open Graph and metadata from a URL for link previews
 */
export interface LinkPreviewData {
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  favicon?: string;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  try {
    // Validate URL
    const urlObj = new URL(url);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DesignWorkflow/1.0; +https://meisnerinteriors.com)',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Link Preview] Failed to fetch ${url}: ${response.status}`);
      return {};
    }

    const html = await response.text();

    // Extract Open Graph and standard meta tags
    const preview: LinkPreviewData = {};

    // Open Graph image
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImage) {
      preview.imageUrl = resolveUrl(ogImage[1], urlObj);
    }

    // Twitter image as fallback
    if (!preview.imageUrl) {
      const twitterImage = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
      if (twitterImage) {
        preview.imageUrl = resolveUrl(twitterImage[1], urlObj);
      }
    }

    // Open Graph title
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (ogTitle) {
      preview.title = decodeHtml(ogTitle[1]);
    }

    // Fallback to page title
    if (!preview.title) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        preview.title = decodeHtml(titleMatch[1]);
      }
    }

    // Open Graph description
    const ogDescription = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    if (ogDescription) {
      preview.description = decodeHtml(ogDescription[1]);
    }

    // Fallback to meta description
    if (!preview.description) {
      const metaDescription = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      if (metaDescription) {
        preview.description = decodeHtml(metaDescription[1]);
      }
    }

    // Open Graph site name
    const ogSiteName = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
    if (ogSiteName) {
      preview.siteName = decodeHtml(ogSiteName[1]);
    }

    // Fallback to domain name
    if (!preview.siteName) {
      preview.siteName = urlObj.hostname.replace(/^www\./, '');
    }

    // Favicon
    const faviconLink = html.match(/<link\s+[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
    if (faviconLink) {
      preview.favicon = resolveUrl(faviconLink[1], urlObj);
    } else {
      // Default favicon location
      preview.favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
    }

    return preview;
  } catch (error) {
    console.error('[Link Preview] Error fetching preview:', error);
    // Return partial data or empty object on error
    return {};
  }
}

/**
 * Resolve relative URLs to absolute URLs
 */
function resolveUrl(urlString: string, baseUrl: URL): string {
  try {
    // If already absolute, return as is
    if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
      return urlString;
    }
    
    // Handle protocol-relative URLs
    if (urlString.startsWith('//')) {
      return `${baseUrl.protocol}${urlString}`;
    }
    
    // Handle absolute paths
    if (urlString.startsWith('/')) {
      return `${baseUrl.protocol}//${baseUrl.host}${urlString}`;
    }
    
    // Handle relative paths
    return new URL(urlString, baseUrl.href).href;
  } catch (error) {
    console.error('[Link Preview] Error resolving URL:', error);
    return urlString;
  }
}

/**
 * Decode HTML entities
 */
function decodeHtml(html: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
  };
  
  return html.replace(/&[#\w]+;/g, (entity) => {
    return entities[entity] || entity;
  });
}

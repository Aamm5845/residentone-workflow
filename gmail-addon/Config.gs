/**
 * Configuration for StudioFlow Gmail Add-on
 *
 * API_BASE_URL: Your Vercel deployment URL (no trailing slash)
 * API key is stored per-user in PropertiesService.getUserProperties()
 */

// ---- CHANGE THIS to your Vercel deployment URL ----
var API_BASE_URL = 'https://app.meisnerinteriors.com';

/**
 * Get the saved API key for the current user
 */
function getApiKey() {
  return PropertiesService.getUserProperties().getProperty('STUDIOFLOW_API_KEY');
}

/**
 * Save an API key for the current user
 */
function setApiKey(key) {
  PropertiesService.getUserProperties().setProperty('STUDIOFLOW_API_KEY', key);
}

/**
 * Remove the saved API key
 */
function clearApiKey() {
  PropertiesService.getUserProperties().deleteProperty('STUDIOFLOW_API_KEY');
}

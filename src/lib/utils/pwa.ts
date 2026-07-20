/**
 * Utility functions for PWA (Progressive Web App) detection and installation
 */

/**
 * Checks if the app is running as a PWA (installed to home screen)
 * @returns boolean indicating if app is running in PWA mode
 */
export function isRunningAsPWA(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for various PWA indicators
  const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const isFullscreen = window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches;
  const isMinimalUi = window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches;
  
  // Safari specific check
  const isSafariStandalone = (navigator as any).standalone === true;
  
  // Check for URL bar (less reliable but helpful)
  const hasNoUrlBar = window.innerHeight === screen.availHeight;
  
  return isStandalone || isFullscreen || isMinimalUi || isSafariStandalone || hasNoUrlBar;
}

/**
 * Checks if browser supports PWA installation
 * @returns boolean indicating if PWA installation is supported
 */
export function supportsPWAInstallation(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for beforeinstallprompt event support
  return 'onbeforeinstallprompt' in window;
}

/**
 * Gets instructions for installing as PWA based on browser/device
 * @returns Installation instructions string
 */
export function getPWAInstallInstructions(): string {
  if (typeof navigator === 'undefined') return '';
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Chrome/Edge on Android
  if (userAgent.includes('android') && (userAgent.includes('chrome') || userAgent.includes('edg'))) {
    return 'Tap the menu (⋮) and select "Add to Home screen" or "Install app"';
  }
  
  // Safari on iOS
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
    return 'Tap the share button (📤) and select "Add to Home Screen"';
  }
  
  // Desktop browsers
  if (userAgent.includes('chrome') || userAgent.includes('firefox') || userAgent.includes('safari')) {
    return 'Click the install icon in the address bar or use the browser menu';
  }
  
  // Generic fallback
  return 'Use your browser\'s menu to "Add to Home screen" or "Install app"';
}

/**
 * Checks if push notifications are available in current context
 * Push notifications typically work better in PWA mode
 * @returns boolean indicating if push notifications should be available
 */
export function shouldPushNotificationsWork(): boolean {
  // Push notifications work best in PWA mode
  // They may have limited functionality in regular browser tabs
  return isRunningAsPWA();
}
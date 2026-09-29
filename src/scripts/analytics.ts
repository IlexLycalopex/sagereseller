// GA4 with Google Consent Mode v2. Nothing loads from Google until the visitor accepts.
declare global {
  interface Window { dataLayer: unknown[]; gtag?: (...args: unknown[]) => void }
}

const GA_ID = import.meta.env.PUBLIC_GA4_ID as string | undefined;
const KEY = 'sbg-consent';
let loaded = false;

window.dataLayer = window.dataLayer || [];
function gtag(..._args: unknown[]) {
  // gtag.js expects the arguments object itself.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}
window.gtag = gtag;
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});

export function getConsent(): 'granted' | 'denied' | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(v: 'granted' | 'denied') {
  try { localStorage.setItem(KEY, v); } catch { /* private mode */ }
  gtag('consent', 'update', { analytics_storage: v });
  if (v === 'granted') loadGa();
}

function loadGa() {
  if (loaded || !GA_ID) return;
  loaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
  gtag('js', new Date());
  gtag('config', GA_ID);
}

/** Queue an event. It only leaves the browser if consent was granted. */
export function track(event: string, params: Record<string, unknown> = {}) {
  if (getConsent() !== 'granted') return;
  gtag('event', event, params);
}

if (getConsent() === 'granted') {
  gtag('consent', 'update', { analytics_storage: 'granted' });
  loadGa();
}

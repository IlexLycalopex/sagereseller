import { getConsent, setConsent, track } from './analytics';

// Mobile menu
const header = document.querySelector<HTMLElement>('[data-header]');
const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
toggle?.addEventListener('click', () => {
  const open = header?.classList.toggle('open') ?? false;
  toggle.setAttribute('aria-expanded', String(open));
});

// Cookie banner
const banner = document.querySelector<HTMLElement>('[data-cookie-banner]');
const detail = document.querySelector<HTMLElement>('[data-cookie-detail]');
const analyticsBox = document.querySelector<HTMLInputElement>('[data-cookie-analytics]');
const showBanner = () => {
  if (!banner) return;
  banner.hidden = false;
  if (analyticsBox) analyticsBox.checked = getConsent() === 'granted';
};
if (getConsent() === null) showBanner();
banner?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cookie]');
  if (!btn) return;
  const action = btn.dataset.cookie;
  if (action === 'settings') {
    if (detail?.hidden) {
      detail.hidden = false;
      btn.textContent = 'Save settings';
      btn.setAttribute('aria-expanded', 'true');
      return;
    }
    setConsent(analyticsBox?.checked ? 'granted' : 'denied');
  } else {
    setConsent(action === 'accept' ? 'granted' : 'denied');
  }
  banner.hidden = true;
});
document.querySelectorAll('[data-cookie-settings]').forEach((b) =>
  b.addEventListener('click', () => {
    showBanner();
    if (detail) detail.hidden = false;
  }),
);

// Outbound tracking
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-mysoft], a[data-marketplace]');
  if (!a) return;
  if (a.dataset.mysoft) track('outbound_mysoft', { destination_key: a.dataset.mysoft, link_position: a.dataset.position });
  if (a.dataset.marketplace) track('outbound_marketplace', { listing: a.dataset.marketplace });
});

// FAQ opens
document.querySelectorAll<HTMLDetailsElement>('.faq-list details').forEach((d, i) =>
  d.addEventListener('toggle', () => {
    if (d.open) track('faq_open', { page: location.pathname, question_index: i + 1 });
  }),
);

// Comparison table views
const tables = document.querySelectorAll<HTMLElement>('[data-track-table]');
if (tables.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      track('comparison_table_view', { slug: (en.target as HTMLElement).dataset.trackTable });
      io.unobserve(en.target);
    }
  }, { threshold: 0.4 });
  tables.forEach((t) => io.observe(t));
}

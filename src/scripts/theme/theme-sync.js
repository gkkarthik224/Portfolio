(() => {
  if (window.PortfolioTheme) return;
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const valid = value => value === 'light' || value === 'dark';
  const read = () => { try { return localStorage.getItem('portfolio-theme'); } catch { return null; } };
  let saved = read();
  let theme = valid(saved) ? saved : system.matches ? 'dark' : 'light';
  const tokens = {
    '62d5ebd4-5867-40fc-ba4d-ed46a167a079': ['#fff', '#000'],
    '5fde730a-8086-4528-a317-d71b3bf4efde': ['#000', '#fff'],
    '4ad2450b-089e-49a2-b079-884bae7e4c6d': ['#00000005', '#ffffff0f'],
    'efbe759a-c6fd-4186-bb39-f926ba3e6290': ['#0000000a', '#ffffff0a'],
    'bc0dc324-3347-4f8c-8b15-0992ca3d8bd7': ['#0000000a', '#ffffff0a'],
    '46fcdfa9-54c0-493b-b93f-fa8d2ec6c393': ['#0000007a', '#ffffff7a'],
    '3633f5d4-b3f9-4387-bf26-367a735dd616': ['#0000003d', '#ffffff3d'],
    'cce8dd83-3970-42e1-a1b4-fa8f1ad36a75': ['#7ecc00', '#ccf500'],
    'ca1e8363-88d0-40f1-abb8-1f9ce6252271': ['#fff', '#fff'],
    '2d8dd10f-093d-46af-a75a-ef4a30e3ffdc': ['#fff', '#fff']
  };
  function apply() {
    const dark = theme === 'dark';
    for (const element of [root, document.body].filter(Boolean)) {
      if (element.getAttribute('framestack-theme') !== theme) element.setAttribute('framestack-theme', theme);
      for (const [token, colors] of Object.entries(tokens)) {
        const property = `--token-${token}`;
        const value = colors[dark ? 1 : 0];
        if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
      }
    }
    root.style.colorScheme = theme;
    root.style.backgroundColor = dark ? '#000' : '#fff';
    document.querySelectorAll('nav [data-framer-name="Theme"]').forEach(control => {
      control.setAttribute('role', 'switch');
      control.setAttribute('tabindex', '0');
      control.setAttribute('aria-label', 'Dark mode');
      control.setAttribute('aria-checked', String(dark));
    });
    document.querySelectorAll('.theme-toggle').forEach(control => {
      control.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
      control.setAttribute('aria-pressed', String(dark));
    });
  }
  function set(value, persist = true) {
    if (!valid(value)) return;
    theme = value;
    if (persist) { saved = value; try { localStorage.setItem('portfolio-theme', value); } catch {} }
    apply();
    window.dispatchEvent(new CustomEvent('portfolio-theme-change', {detail: theme}));
  }
  window.PortfolioTheme = {get: () => theme, set};
  const toggle = target => target instanceof Element && target.closest('nav [data-framer-name="Theme"], .theme-toggle');
  window.addEventListener('click', event => {
    if (!toggle(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    set(theme === 'dark' ? 'light' : 'dark');
  }, true);
  window.addEventListener('keydown', event => {
    const control = toggle(event.target);
    if (!control || control.tagName === 'BUTTON' || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    set(theme === 'dark' ? 'light' : 'dark');
  }, true);
  new MutationObserver(records => {
    if (records.some(record => record.type === 'childList' || record.target.getAttribute('framestack-theme') !== theme)) apply();
  }).observe(root, {attributes: true, attributeFilter: ['framestack-theme'], subtree: true, childList: true});
  system.addEventListener('change', () => { if (!valid(saved)) set(system.matches ? 'dark' : 'light', false); });
  window.addEventListener('storage', event => { if (event.key === 'portfolio-theme' && valid(event.newValue)) { saved = event.newValue; set(saved, false); } });
  window.addEventListener('pageshow', () => { const latest = read(); if (valid(latest)) theme = saved = latest; apply(); });
  apply();
})();

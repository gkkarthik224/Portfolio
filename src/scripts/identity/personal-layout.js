(() => {
  const observedTitles = new WeakSet();
  function sizeProjectTitle(viewport) {
    const text = viewport.querySelector('.framer-mfxw34');
    if (!text) return;
    // Keep one complete title in the sliding window, including wrapped lines.
    viewport.style.setProperty('--project-title-height', `${text.offsetHeight}px`);
    // A skewed copy extends above its box by half its width * tan(12deg).
    // Leave that space between copies so the hidden one cannot peek through.
    viewport.style.setProperty('--project-title-gap', `${Math.ceil(viewport.clientWidth * 0.12 + 16)}px`);
    const card = viewport.closest('.framer-Xr4Z8');
    const footer = viewport.closest('.framer-1hv5ckr');
    if (card && footer) {
      card.style.setProperty('--project-footer-height', `${footer.offsetHeight}px`);
    }
  }
  const projectTitleResize = new ResizeObserver(entries => {
    for (const entry of entries) {
      const viewport = entry.target.closest('.framer-9w8kt3');
      if (viewport) sizeProjectTitle(viewport);
    }
  });

  function updateLayout() {
    document.querySelectorAll('h1,h2').forEach(heading => {
      if (heading.textContent.trim() === 'Karthik Krishna') heading.setAttribute('data-personal-name', '');
    });
    document.querySelectorAll('nav p').forEach(role => {
      if (role.textContent.includes('AI Engineer')) role.setAttribute('data-personal-role', '');
    });
    document.querySelectorAll('nav .framer-snsv5m').forEach(brand => {
      if (brand.textContent.includes('Karthik Krishna')) brand.setAttribute('data-personal-brand', '');
    });
    document.querySelectorAll('.framer-Xr4Z8 .framer-9w8kt3').forEach(viewport => {
      if (observedTitles.has(viewport)) return;
      observedTitles.add(viewport);
      projectTitleResize.observe(viewport);
      const text = viewport.querySelector('.framer-mfxw34');
      if (text) projectTitleResize.observe(text);
      sizeProjectTitle(viewport);
    });
    document.querySelectorAll('form').forEach(form => {
      form.removeAttribute('action');
      if (form.hasAttribute('data-portfolio-email-draft')) return;
      form.querySelectorAll('[type="submit"]').forEach(button => { button.disabled = true; });
    });
  }
  document.addEventListener('submit', event => {
    if (event.target.hasAttribute('data-portfolio-email-draft')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  new MutationObserver(updateLayout).observe(document.documentElement, {subtree:true,childList:true});
  updateLayout();
})();

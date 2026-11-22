(() => {
  const arrow = '<svg viewBox="0 0 18 16" focusable="false"><path d="M 0.667 7 L 14.958 7 L 8.833 0.875 L 9.603 0 L 17.187 7.583 L 9.603 15.167 L 8.833 14.292 L 14.958 8.167 L 0.667 8.167 Z" fill="currentColor"/></svg>';
  function enhance() {
    document.querySelectorAll('.framer-TlDBu .framer-qtc6gu-container .framer-qHF7D').forEach(card => {
      card.removeAttribute('href');
      card.removeAttribute('target');
      card.removeAttribute('tabindex');
      card.setAttribute('aria-disabled', 'true');
      card.setAttribute('aria-label', 'Resume currently unavailable');
      if (!card.querySelector('.home-resume-status')) {
        const status = document.createElement('span');
        status.className = 'home-resume-status';
        status.textContent = 'Unavailable';
        card.appendChild(status);
      }
    });
    document.querySelectorAll('.framer-TlDBu a.framer-qHF7D[href]').forEach(card => {
      card.setAttribute('data-home-cell-link', '');
      if (card.querySelector('.home-cell-arrow')) return;
      const icon = document.createElement('span');
      icon.className = 'skills-cell-arrow home-cell-arrow';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = arrow;
      card.appendChild(icon);
    });
    document.querySelectorAll('.framer-naoazj-container > .framer-DOfiF').forEach(card => {
      if (card.querySelector('[data-skills-link]')) return;
      // Keep the moving logo ticker and Framer's large hover title intact.
      const link = document.createElement('a');
      link.href = './skills.html';
      link.setAttribute('data-skills-link', '');
      link.setAttribute('data-home-cell-link', '');
      link.setAttribute('aria-label', 'Explore skills');
      link.innerHTML = '<span class="home-cell-title"><span>Skills</span><span aria-hidden="true">Skills</span></span><span class="skills-cell-arrow" aria-hidden="true">' + arrow + '</span>';
      card.appendChild(link);
    });
  }
  function start() {
    enhance();
    new MutationObserver(enhance).observe(document.body, {subtree: true, childList: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();

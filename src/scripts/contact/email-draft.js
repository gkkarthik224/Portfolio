// Open a completed contact message in the visitor's email app in one step.
(() => {
  const forms = new WeakSet();
  const recipient = 'gkrishankarthik2004@gmail.com';
  const sendEmail = (subject, body) => location.assign(`mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);

  function mount() {
    if (document.querySelector('script[src*="/runtime/script_main"]') && !document.documentElement.hasAttribute('data-runtime-ready')) return;
    document.querySelectorAll('form').forEach(form => {
      const name = form.querySelector('[name="Name"]');
      const email = form.querySelector('[name="Email"]');
      const details = form.querySelector('[name="Details"]');
      const submit = form.querySelector('[type="submit"]');
      if (!name || !email || !details || !submit) return;

      form.setAttribute('data-portfolio-email-draft', '');
      form.removeAttribute('action');
      details.required = true;
      name.required = true;
      email.required = true;
      submit.disabled = false;
      submit.setAttribute('aria-label', 'Send');
      const caption = submit.querySelector('p');
      if (caption && caption.textContent !== 'Send') caption.textContent = 'Send';
      if (forms.has(form)) return;
      forms.add(form);

      form.addEventListener('submit', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!form.reportValidity()) return;
        const sender = name.value.trim();
        const replyTo = email.value.trim();
        const message = details.value.trim();
        if (!sender || !message) {
          (sender ? details : name).setCustomValidity('Please enter a value, not only spaces.');
          form.reportValidity();
          return;
        }
        const subject = `Portfolio enquiry from ${sender}`;
        const body = `Name: ${sender}\nReply email: ${replyTo}\n\n${message}`;
        sendEmail(subject, body);
      }, true);
      for (const field of [name, details]) field.addEventListener('input', () => field.setCustomValidity(''));
    });
  }
  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('portfolio-runtime-ready', mount);
  mount();

  const tabList = document.querySelector('.contact-tabs');
  if (!tabList) return;

  const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));
  const demoForm = document.getElementById('contact-demo-form');
  const project = document.getElementById('contact-demo-project');
  const reply = document.getElementById('contact-demo-reply');
  reply.addEventListener('input', () => {
    reply.setCustomValidity('');
  });
  demoForm.addEventListener('submit', event => {
    event.preventDefault();
    const contact = reply.value.trim();
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const digits = contact.replace(/\D/g, '');
    const phone = /^\+?[\d ().-]+$/.test(contact) && digits.length >= 7 && digits.length <= 15;
    if (!email && !phone) {
      reply.setCustomValidity('Enter a valid email address or phone number.');
      reply.reportValidity();
      return;
    }

    const title = project.selectedOptions[0].textContent.trim();
    const body = `Hi Karthik,\n\nI'd like to request a demo of ${title}.\n\n${email ? 'My email' : 'My phone number'}: ${contact}`;
    sendEmail(`Demo request: ${title}`, body);
  });
  demoForm.setAttribute('data-portfolio-email-draft', '');
  demoForm.querySelector('[type="submit"]').disabled = false;

  function selectTab(selectedTab) {
    for (const tab of tabs) {
      const active = tab === selectedTab;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      switch (event.key) {
        case 'ArrowRight': next = tabs[(index + 1) % tabs.length]; break;
        case 'ArrowLeft': next = tabs[(index + tabs.length - 1) % tabs.length]; break;
        case 'Home': next = tabs[0]; break;
        case 'End': next = tabs.at(-1); break;
        default: return;
      }
      event.preventDefault();
      selectTab(next);
      next.focus();
    });
  });
  tabList.hidden = false;
})();

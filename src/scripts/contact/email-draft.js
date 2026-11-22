// Deliver contact and demo requests without opening the visitor's email app.
(() => {
  const forms = new WeakSet();
  const pending = new WeakSet();
  const recipient = 'gkrishnakarthik2004@gmail.com';
  const endpoint = `https://formsubmit.co/ajax/${recipient}`;

  function delivery(form, submit) {
    const caption = submit.querySelector('p') || submit;
    const status = document.createElement('p');
    status.className = 'contact-form-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    form.appendChild(status);
    // Keep the existing marker so the shared form guard permits submission.
    form.setAttribute('data-portfolio-email-draft', '');
    form.removeAttribute('action');
    submit.disabled = false;
    const show = (state, message) => {
      status.hidden = false;
      status.setAttribute('data-state', state);
      status.textContent = message;
    };
    form.addEventListener('input', () => { if (!pending.has(form)) status.hidden = true; });
    return async (subject, fields, successMessage) => {
      if (pending.has(form)) return;
      const honey = form.querySelector('[name="website"]')?.value.trim() || '';
      if (honey) return;
      pending.add(form);
      submit.disabled = true;
      form.setAttribute('aria-busy', 'true');
      caption.textContent = 'Sending…';
      show('sending', 'Sending your message…');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {'Content-Type': 'application/json', Accept: 'application/json'},
          signal: controller.signal,
          body: JSON.stringify({...fields, _subject: subject, _template: 'table',
            _url: `${location.origin}/contact/`, _honey: honey})
        });
        const result = await response.json();
        // FormSubmit can return HTTP 200 with success: "false".
        if (!response.ok || !(result.success === true || result.success === 'true')) throw new Error('Submission rejected');
        form.reset();
        show('success', successMessage);
      } catch {
        show('error', `We couldn’t confirm your message. Try again or email ${recipient} directly.`);
      } finally {
        clearTimeout(timeout);
        pending.delete(form);
        form.removeAttribute('aria-busy');
        submit.disabled = false;
        caption.textContent = 'Send';
      }
    };
  }

  function mount() {
    if (document.querySelector('script[src*="/runtime/script_main"]') && !document.documentElement.hasAttribute('data-runtime-ready')) return;
    document.querySelectorAll('form').forEach(form => {
      const name = form.querySelector('[name="Name"]');
      const email = form.querySelector('[name="Email"]');
      const details = form.querySelector('[name="Details"]');
      const submit = form.querySelector('[type="submit"]');
      if (!name || !email || !details || !submit) return;
      if (forms.has(form)) return;
      forms.add(form);

      const send = delivery(form, submit);
      details.required = true;
      name.required = true;
      email.required = true;
      name.maxLength = 120;
      email.maxLength = 254;
      details.maxLength = 5000;
      submit.setAttribute('aria-label', 'Send');
      const caption = submit.querySelector('p');
      if (caption && caption.textContent !== 'Send') caption.textContent = 'Send';

      form.addEventListener('submit', async event => {
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
        await send(subject, {name: sender, email: replyTo, message},
          'Message sent. I’ll reply by email.');
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
  const sendDemo = delivery(demoForm, demoForm.querySelector('[type="submit"]'));
  reply.addEventListener('input', () => {
    reply.setCustomValidity('');
  });
  demoForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!demoForm.reportValidity()) return;
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
    await sendDemo(`Demo request: ${title}`, {
      project: title, ...(email ? {email: contact} : {phone: contact}),
      message: `I would like to request a demo of ${title}.`
    }, 'Demo request sent. I’ll contact you soon.');
  });

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

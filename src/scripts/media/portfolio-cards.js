(() => {
  // Edit project content here. Optional role, tools, year, demoUrl and sourceUrl
  // fields appear only when supplied; no HTML changes are needed.
  const projects = [
    {
      id: 'travel-easy',
      title: 'Script Change Management',
      organization: 'Ideabytes · Sanitized employer work',
      category: 'AI & Automation',
      summary: 'AI-assisted test-script maintenance for application UI and logic changes across regression cycles.',
      description: 'Backend orchestration and pipeline development using custom Python and LangChain, connected to defect-management signals. LangSmith and OpenTelemetry support tracing and observability.',
      tags: ['AI-assisted maintenance', 'Synchronous orchestration'],
      status: 'In development · Internal system',
      role: 'Backend developer · Orchestration and pipelines',
      tools: ['Python', 'LangChain', 'LangSmith', 'OpenTelemetry'],
      evidenceNote: 'Sanitized overview. Employer code and internal artifacts are confidential under NDA.',
      caseStudyUrl: '/portfolio/script-change-management'
    },
    {
      id: 'gamma',
      title: 'Smart Procurement ERP Logging System',
      organization: 'Self-employed · Independent prototype',
      category: 'Enterprise Software',
      summary: 'A document-to-ERP workflow for bills, receipts and invoices, with confidence-based human review.',
      description: 'PaddleOCR and an 8-bit quantized 8B VLM extract document structure. A FastAPI backend, Temporal workflows and a ProcurementERP adapter connect ingestion, review and ERP integration tested against Odoo references.',
      tags: ['Document intelligence', 'ERP integration'],
      status: 'Functional prototype · Development completed',
      role: 'Independent prototype development',
      tools: ['FastAPI', 'PaddleOCR', '8B VLM · 8-bit', 'PostgreSQL', 'Temporal'],
      evidenceNote: 'Reference-tested prototype. Public code, demo and performance benchmarks are not linked yet.',
      caseStudyUrl: '/portfolio/procurement-erp'
    },
    {
      id: 'stream-ai',
      title: 'Auto Defect Management System',
      organization: 'Ideabytes · Sanitized employer work',
      category: 'Workflow Automation',
      summary: 'Connects automated-test failure evidence with duplicate checks and structured Jira reporting.',
      description: 'Captures Eggplant execution failures, gathers diagnostics and checks existing Jira tickets before structuring a new issue. My contribution covers evidence collection, duplicate-checking logic and the healing/logging framework.',
      tags: ['Failure evidence', 'Jira integration'],
      status: 'Deployed',
      role: 'Developer · Evidence collection and duplicate checks',
      tools: ['PostgreSQL', 'Vector DB', 'Transformers', 'Webhook', 'FastAPI'],
      evidenceNote: 'Sanitized overview. Ticket examples, employer code and internal test artifacts are confidential under NDA.',
      caseStudyUrl: '/portfolio/defect-management'
    },
    {
      id: 'foome',
      title: 'FRP Material Strength Analyser',
      organization: 'IIT Bombay (Intern)',
      category: 'Engineering Software',
      certificate: {image: 'iit-bombay-internship-certificate.jpeg'},
      summary: 'Software for exploring and analysing the strength of fibre-reinforced polymer materials.',
      description: 'An engineering software project focused on fibre-reinforced polymer (FRP) material strength. It brings material analysis into a dedicated software interface.',
      tags: ['Material analysis', 'Engineering'],
      role: 'Intern',
      evidenceNote: 'Academic work under NDA. Only the broad project area is described publicly.'
    },
    {
      id: 'edbost',
      title: 'UAV Crack Detection System',
      organization: 'IIT Bombay (Intern)',
      category: 'Inspection Technology',
      certificate: {image: 'iit-bombay-internship-certificate.jpeg'},
      summary: 'Exploring UAV-based crack detection for structural inspection workflows.',
      description: 'A project focused on detecting cracks using UAV imagery. It connects aerial inspection with software-assisted analysis of visible structural defects.',
      tags: ['UAV inspection', 'Crack detection'],
      role: 'Intern',
      evidenceNote: 'Academic work under NDA. Only the broad project area is described publicly.'
    }
  ];
  const assetRoot = new URL('project-images/', document.currentScript.src);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const section = el('section', 'portfolio-projects');
  section.id = 'portfolio-projects';
  section.setAttribute('aria-labelledby', 'portfolio-projects-heading');
  const intro = el('header', 'portfolio-projects-intro');
  const headline = el('h1');
  let wordIndex = 0;
  function appendWords(parent, text) {
    for (const token of text.split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) parent.append(document.createTextNode(token));
      else {
        const word = el('span', 'skills-text-word', token);
        word.style.setProperty('--word-index', wordIndex++);
        parent.append(word);
      }
    }
  }
  appendWords(headline, 'Applied AI, workflow orchestration, and backend systems—from prototype to ');
  const highlight = el('span', 'portfolio-title-glow');
  appendWords(highlight, 'Production Grade');
  headline.append(highlight);
  intro.append(headline, el('p', '', 'Test automation, document processing and engineering software.'));
  const header = el('div', 'portfolio-projects-header');
  header.append(el('h2', '', 'Selected work'), el('span', 'portfolio-projects-count', `${projects.length} projects`));
  header.firstChild.id = 'portfolio-projects-heading';
  const grid = el('div', 'portfolio-project-grid');
  projects.forEach(project => {
    const card = el('article', 'portfolio-project-card');
    card.setAttribute('aria-labelledby', `project-title-${project.id}`);
    const content = el('div', 'portfolio-project-content');
    const introduction = el('div', 'portfolio-project-introduction');
    const title = el('h3', '', project.title);
    title.id = `project-title-${project.id}`;
    const context = el('div', 'portfolio-project-context');
    if (project.organization) context.append(el('p', 'portfolio-project-organization', project.organization));
    const tags = el('ul', 'portfolio-project-tags');
    tags.setAttribute('aria-label', 'Project focus areas');
    project.tags.forEach(tag => tags.append(el('li', '', tag)));
    introduction.append(el('p', 'portfolio-project-category', project.category), title, context,
      el('p', 'portfolio-project-summary', project.summary), tags);
    const details = el('div', 'portfolio-project-details');
    const overview = el('div', 'portfolio-project-overview');
    overview.append(el('p', '', project.description));
    const metadata = el('dl', 'portfolio-project-metadata');
    [['Role', project.role], ['Status', project.status], ['Tools', project.tools], ['Year', project.year]].forEach(([label, value]) => {
      if (!value || (Array.isArray(value) && !value.length)) return;
      const row = el('div');
      row.append(el('dt', '', label), el('dd', '', Array.isArray(value) ? value.join(', ') : value));
      metadata.append(row);
    });
    if (metadata.childElementCount) overview.append(metadata);
    if (project.evidenceNote) overview.append(el('p', 'portfolio-project-evidence', project.evidenceNote));
    const links = el('div', 'portfolio-project-links');
    [['View case study', project.caseStudyUrl], ['Live demo', project.demoUrl], ['Source code', project.sourceUrl]].forEach(([label, url]) => {
      if (!url) return;
      const link = el('a', '', label);
      link.href = url;
      links.append(link);
    });
    if (links.childElementCount) introduction.append(links);
    details.append(overview);
    content.append(introduction, details);
    if (project.certificate) {
      const certificate = el('details', 'portfolio-project-certificate');
      certificate.id = `project-certificate-${project.id}`;
      certificate.append(el('summary', 'portfolio-certificate-button', 'Certificate'));
      const panel = el('div', 'portfolio-certificate-panel');
      if (project.certificate.image) {
        const image = el('img');
        image.src = new URL(project.certificate.image, assetRoot).href;
        image.alt = `${project.title} certificate`;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => panel.replaceChildren(el('p', '', 'Certificate could not be loaded.')), {once: true});
        panel.append(image);
      } else panel.append(el('p', '', 'Certificate not added yet.'));
      certificate.append(panel);
      content.append(certificate);
    }
    card.append(content);
    grid.append(card);
  });
  section.append(intro, header, grid);
  function mount() {
    const original = document.querySelector('.framer-frKGA section.framer-pbdbj7');
    if (!original || section.previousElementSibling === original) return;
    original.after(section);
  }
  // Keep the editable cards in place when the imported page hydrates.
  new MutationObserver(mount).observe(document.documentElement, {subtree: true, childList: true});
  mount();
})();

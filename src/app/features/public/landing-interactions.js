/**
 * INXHINIE CONSTRUCCIONES - High-End Motion & Interaction Architecture
 * Engineered with IntersectionObserver, Kinetic Physics, and WhatsApp Bridge
 */

window.initializeLandingInteractions = () => {
  
  // 1. Viewport Entry Animation Engine (IntersectionObserver)
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.15
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealElements.forEach(el => revealObserver.observe(el));

  // 2. Hamburger Morph & Screen-Filling Mobile Menu
  const hamburgerBtn = document.getElementById('nav-hamburger');
  const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
  const mobileMenuClose = document.getElementById('mobile-menu-close');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');

  if (hamburgerBtn && mobileMenuOverlay) {
    const setMenuState = (isActive) => {
      mobileMenuOverlay.classList.toggle('active', isActive);
      hamburgerBtn.classList.toggle('open', isActive);
      hamburgerBtn.setAttribute('aria-expanded', String(isActive));
      const bars = hamburgerBtn.querySelectorAll('.ham-bar');
      if (bars.length === 2) {
        bars[0].style.transform = isActive ? 'rotate(45deg) translate(4px, 4px)' : 'none';
        bars[1].style.transform = isActive ? 'rotate(-45deg) translate(4px, -4px)' : 'none';
      }
      document.body.style.overflow = isActive ? 'hidden' : 'auto';
    };

    hamburgerBtn.addEventListener('click', () => {
      setMenuState(!mobileMenuOverlay.classList.contains('active'));
    });

    mobileLinks.forEach(link => {
      link.addEventListener('click', () => setMenuState(false));
    });

    mobileMenuClose?.addEventListener('click', () => setMenuState(false));
    mobileMenuOverlay.addEventListener('click', (event) => {
      if (event.target === mobileMenuOverlay) setMenuState(false);
    });
  }

  // 3. Active Navigation State Tracking
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.nav-item');

  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navItems.forEach(item => {
          if (item.getAttribute('href') === `#${id}`) {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
          }
        });
      }
    });
  }, { rootMargin: '-40% 0px -40% 0px' });

  sections.forEach(sec => navObserver.observe(sec));

  // 4. Portfolio Filter Pills
  const filterPills = document.querySelectorAll('.filter-pill');
  const portfolioCards = document.querySelectorAll('.portfolio-card-shell');

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filterVal = pill.getAttribute('data-filter');

      portfolioCards.forEach(card => {
        const categories = card.getAttribute('data-category');
        if (filterVal === 'all' || (categories && categories.includes(filterVal))) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // 5. Lightbox Modal Engine
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxBackdrop = document.getElementById('lightbox-backdrop');
  const zoomButtons = document.querySelectorAll('.port-btn-zoom');

  function openLightbox(src, title) {
    if (!lightboxModal || !lightboxImage) return;
    lightboxImage.src = src;
    if (lightboxCaption) lightboxCaption.textContent = title || 'Proyecto INXHINIE';
    lightboxModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxModal) return;
    lightboxModal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }

  zoomButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const src = btn.getAttribute('data-src');
      const title = btn.getAttribute('data-title');
      openLightbox(src, title);
    });
  });

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
  const onKeyDown = (e) => {
    if (e.key === 'Escape' && lightboxModal && lightboxModal.classList.contains('active')) {
      closeLightbox();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // 6. Bento Service Action Bridge to Calculator
  const openQuoteButtons = document.querySelectorAll('.open-quote-btn');
  const calcServiceSelect = document.getElementById('calc-service');
  const quoteSection = document.getElementById('cotizador');

  openQuoteButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const serviceTarget = (btn.getAttribute('data-service') || '').toLowerCase();
      if (calcServiceSelect) {
        for (let i = 0; i < calcServiceSelect.options.length; i++) {
          const val = calcServiceSelect.options[i].value.toLowerCase();
          const text = calcServiceSelect.options[i].text.toLowerCase();
          
          if (
            (serviceTarget.includes('pérgola') && (val.includes('pérgola') || text.includes('pérgola'))) ||
            (serviceTarget.includes('estructura') && (val.includes('estructura') || text.includes('estructura'))) ||
            (serviceTarget.includes('domo') && (val.includes('domo') || text.includes('domo'))) ||
            (serviceTarget.includes('madera') && (val.includes('madera') || text.includes('madera') || text.includes('deck') || text.includes('lambrín')))
          ) {
            calcServiceSelect.selectedIndex = i;
            calcServiceSelect.dispatchEvent(new Event('change', { bubbles: true }));
            calcServiceSelect.focus();
            break;
          }
        }
      }
      if (quoteSection) {
        quoteSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // 7. On-page estimate and WhatsApp Quote Form Generator
  const quoteForm = document.getElementById('quote-interactive-form');
  const estimateValue = document.getElementById('estimate-value');
  const estimateInputs = ['calc-service', 'calc-material', 'calc-dimensions', 'calc-quality', 'calc-additional']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  function getEstimate() {
    const service = document.getElementById('calc-service')?.value || '';
    const area = Number(document.getElementById('calc-dimensions')?.value || 0);
    const quality = document.getElementById('calc-quality')?.value || 'standard';
    const additional = document.getElementById('calc-additional')?.value || 'none';
    const catalog = window.quoteCatalog;
    const rate = catalog?.services.find(item => item.name === service)?.rate;
    const qualityMultiplier = catalog?.qualities.find(item => item.key === quality)?.multiplier ?? 1;
    const additionalRate = catalog?.addons.find(item => item.key === additional)?.rate ?? 0;

    if (!area || !rate) return null;
    const total = (area * rate * qualityMultiplier) + (area * additionalRate);
    return { low: Math.round(total * (catalog?.varianceLow ?? .9)), high: Math.round(total * (catalog?.varianceHigh ?? 1.12)) };
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0
    }).format(amount);
  }

  function updateEstimate() {
    if (!estimateValue) return;
    const estimate = getEstimate();
    estimateValue.textContent = estimate
      ? `${formatCurrency(estimate.low)} - ${formatCurrency(estimate.high)} MXN`
      : 'Completa la especialidad y superficie para calcular';
  }

  estimateInputs.forEach(input => input.addEventListener('input', updateEstimate));
  updateEstimate();

  if (quoteForm) {
    quoteForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const service = document.getElementById('calc-service')?.value || 'No especificado';
      const material = document.getElementById('calc-material')?.value || 'No especificado';
      const dimensions = document.getElementById('calc-dimensions')?.value || 'No especificado';
      const property = document.getElementById('calc-property')?.value || 'No especificado';
      const name = document.getElementById('calc-name')?.value || 'Cliente';
      const phone = document.getElementById('calc-phone')?.value || 'No especificado';
      const location = document.getElementById('calc-location')?.value || 'No especificado';
      const quality = document.getElementById('calc-quality')?.options[document.getElementById('calc-quality')?.selectedIndex]?.text || 'No especificado';
      const additional = document.getElementById('calc-additional')?.options[document.getElementById('calc-additional')?.selectedIndex]?.text || 'Sin adicionales';
      const notes = document.getElementById('calc-notes')?.value || '';
      const estimate = getEstimate();

      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts.shift() || 'Cliente';
      const lastName = nameParts.join(' ');
      const description = `${property}. Material o cubierta: ${material}. Nivel de materiales: ${quality}. Servicio adicional: ${additional}. ${notes || 'Solicitud generada desde el cotizador web.'}`;
      const officialPhone = '526183677341';

      // Clean, professional WhatsApp Message
      let msg = `*SOLICITUD DE COTIZACIÓN - INXHINIE CONSTRUCCIONES*\n\n`;
      msg += `*Cliente:* ${name}\n`;
      msg += `*Teléfono:* ${phone}\n`;
      msg += `*Ubicación:* ${location}\n`;
      msg += `*Inmueble:* ${property}\n`;
      msg += `*Especialidad:* ${service}\n`;
      msg += `*Superficie:* ${dimensions} m²\n`;
      msg += `*Material / Cubierta:* ${material}\n`;
      msg += `*Nivel de materiales:* ${quality}\n`;
      msg += `*Adicional:* ${additional}\n`;
      if (estimate) msg += `*Estimación inicial:* ${formatCurrency(estimate.low)} - ${formatCurrency(estimate.high)} MXN\n`;
      if (notes.trim()) {
        msg += `*Requerimientos:* ${notes}\n\n`;
      } else {
        msg += `\n`;
      }
      msg += `_Hola, generé esta solicitud desde su sitio web y deseo recibir asesoría personalizada y cotización._`;

      const encoded = encodeURIComponent(msg);
      const url = `https://wa.me/${officialPhone}?text=${encoded}`;

      window.dispatchEvent(new CustomEvent('inxhinie:quote-submit', {
        detail: {
          input: {
            firstName,
            lastName,
            phone,
            email: '',
            city: location,
            service,
            area: Number(dimensions) || null,
            budget: estimate ? `${formatCurrency(estimate.low)} - ${formatCurrency(estimate.high)} MXN` : '',
            startDate: '',
            description,
            estimateLow: estimate?.low ?? null,
            estimateHigh: estimate?.high ?? null,
          },
          whatsappUrl: url,
        },
      }));
    });
  }

  // 8. Auto-Year Update
  const yearHolder = document.getElementById('year-holder');
  if (yearHolder) {
    yearHolder.textContent = new Date().getFullYear();
  }
  return () => {
    revealObserver.disconnect();
    navObserver.disconnect();
    document.removeEventListener('keydown', onKeyDown);
    document.body.style.overflow = '';
  };
};

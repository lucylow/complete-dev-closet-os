/**
 * CLOSET.OS – main.js  |  v2.1  |  Built on Complete.dev
 * ─────────────────────────────────────────────────────────
 * Features:
 *  - Scroll progress bar
 *  - Navbar scroll state
 *  - Scroll-reveal animations (IntersectionObserver)
 *  - Animated number counters
 *  - FAQ accordion
 *  - Mobile nav drawer
 *  - Smooth waitlist form with toast notification
 *  - UTM parameter capture & persistence (T-001-4)
 *  - Analytics event tracking (page views, CTAs, form, sections)
 */

(function () {
  'use strict';

  /* ── UTM Tracking ───────────────────────────────────────────── */
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const UTM_STORE_KEY = 'closetos_utms';

  /**
   * Parse UTM params from the current URL and persist to sessionStorage.
   * If the URL has no UTMs, restore any previously captured ones.
   * Returns the active UTM object.
   */
  function captureUTMs() {
    const params = new URLSearchParams(window.location.search);
    const fresh  = {};
    UTM_KEYS.forEach(k => { if (params.has(k)) fresh[k] = params.get(k); });

    if (Object.keys(fresh).length > 0) {
      // New UTMs found — overwrite stored ones and clean the URL (no reload)
      sessionStorage.setItem(UTM_STORE_KEY, JSON.stringify(fresh));
      try {
        const cleanUrl = window.location.pathname + (params.toString() ? '' : '');
        const leftover = new URLSearchParams(params);
        UTM_KEYS.forEach(k => leftover.delete(k));
        const qs = leftover.toString();
        history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
      } catch (_) {}
      return fresh;
    }

    // Restore from storage
    try {
      return JSON.parse(sessionStorage.getItem(UTM_STORE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  const activeUTMs = captureUTMs();

  /* ── Analytics Event Tracker ────────────────────────────────── */
  /**
   * Lightweight event dispatcher.
   * Fires window.gtag if Google Analytics is present,
   * and also dispatches a CustomEvent for any custom listener (e.g. Segment, Mixpanel).
   *
   * Usage: trackEvent('cta_click', { label: 'hero_get_early_access' })
   */
  function trackEvent(eventName, params = {}) {
    const payload = Object.assign({}, params, activeUTMs);

    // Google Analytics 4
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, payload);
    }

    // Custom event bus (hook in any other analytics tool here)
    try {
      window.dispatchEvent(new CustomEvent('closetos:track', {
        detail: { event: eventName, params: payload }
      }));
    } catch (_) {}

    // Dev mode log
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.debug('[CLOSET.OS Analytics]', eventName, payload);
    }
  }

  // Page view on load
  trackEvent('page_view', {
    page_title:    document.title,
    page_location: window.location.href,
    referrer:      document.referrer || '(direct)'
  });

  /* ── CTA Click Tracking ─────────────────────────────────────── */
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', () => {
      trackEvent('cta_click', {
        label:    btn.textContent.trim().slice(0, 60),
        href:     btn.getAttribute('href') || '',
        section:  btn.closest('section, header')?.id || btn.closest('nav') ? 'navbar' : 'unknown'
      });
    });
  });

  /* ── Section View Tracking (IntersectionObserver) ───────────── */
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.id) {
          trackEvent('section_view', { section_id: entry.target.id });
        }
      });
    },
    { threshold: 0.4 }
  );
  document.querySelectorAll('section[id]').forEach(s => sectionObserver.observe(s));

  /* ── DOM References ─────────────────────────────────────────── */
  const scrollBar     = document.getElementById('scroll-progress');
  const navbar        = document.getElementById('navbar');
  const mobileBtn     = document.getElementById('mobile-menu-btn');
  const drawer        = document.getElementById('mobile-drawer');
  const drawerClose   = document.getElementById('drawer-close');
  const overlay       = document.getElementById('drawer-overlay');
  const drawerLinks   = document.querySelectorAll('.drawer-link, .drawer-cta');
  const waitlistForm  = document.getElementById('waitlist-form');
  const emailInput    = document.getElementById('waitlist-email');
  const formError     = document.getElementById('form-error');
  const toast         = document.getElementById('toast');
  const toastMsg      = document.getElementById('toast-msg');
  const revealEls     = document.querySelectorAll('.reveal');
  const faqItems      = document.querySelectorAll('.faq-item');
  const statValues    = document.querySelectorAll('.stat-value[data-count]');
  const navLinks      = document.querySelectorAll('.nav-link');

  /* ── Scroll Progress Bar ────────────────────────────────────── */
  function updateScrollBar() {
    const scrollTop    = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress     = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    if (scrollBar) scrollBar.style.width = progress + '%';
  }

  /* ── Navbar Scroll State ────────────────────────────────────── */
  function updateNavbar() {
    if (!navbar) return;
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  /* ── Active Nav Link Highlight ──────────────────────────────── */
  function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id], header[id]');
    let currentId = '';
    sections.forEach(sec => {
      const top = sec.getBoundingClientRect().top;
      if (top <= 120) currentId = sec.id;
    });
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + currentId);
    });
  }

  window.addEventListener('scroll', () => {
    updateScrollBar();
    updateNavbar();
    updateActiveNavLink();
  }, { passive: true });

  /* ── Scroll Reveal (IntersectionObserver) ───────────────────── */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger delay for sibling elements
          const siblings = Array.from(entry.target.parentElement.children)
            .filter(el => el.classList.contains('reveal'));
          const idx = siblings.indexOf(entry.target);
          entry.target.style.transitionDelay = Math.min(idx * 80, 400) + 'ms';
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  revealEls.forEach(el => revealObserver.observe(el));

  /* ── Animated Number Counter ────────────────────────────────── */
  function animateCounter(el) {
    const target   = parseInt(el.getAttribute('data-count'), 10);
    const duration = 1800;
    const step     = 16;
    const steps    = duration / step;
    let   current  = 0;

    const increment = target / steps;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.textContent = Math.round(current).toLocaleString();
    }, step);
  }

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  statValues.forEach(el => counterObserver.observe(el));

  /* ── FAQ Accordion ──────────────────────────────────────────── */
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close all open items
      faqItems.forEach(fi => {
        fi.classList.remove('open');
        const q = fi.querySelector('.faq-question');
        if (q) q.setAttribute('aria-expanded', 'false');
      });

      // Toggle clicked item
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ── Mobile Drawer ──────────────────────────────────────────── */
  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('active');
    mobileBtn.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('active');
    mobileBtn.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (mobileBtn) mobileBtn.addEventListener('click', () => {
    drawer.classList.contains('open') ? closeDrawer() : openDrawer();
  });
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  drawerLinks.forEach(link => link.addEventListener('click', closeDrawer));

  // Close drawer on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  /* ── Toast Notification ─────────────────────────────────────── */
  let toastTimer;
  function showToast(message, duration = 4000) {
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  /* ── Email Validation ───────────────────────────────────────── */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  /* ── Waitlist Form ──────────────────────────────────────────── */
  if (waitlistForm) {
    const btnText    = waitlistForm.querySelector('.btn-text');
    const btnSpinner = waitlistForm.querySelector('.btn-spinner');
    const submitBtn  = waitlistForm.querySelector('button[type="submit"]');

    waitlistForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput ? emailInput.value.trim() : '';

      // Client-side validation
      if (!isValidEmail(email)) {
        if (formError) { formError.hidden = false; }
        if (emailInput) emailInput.focus();
        return;
      }

      if (formError) formError.hidden = true;

      // Loading state
      if (btnText)    btnText.textContent = 'Joining…';
      if (btnSpinner) btnSpinner.hidden = false;
      if (submitBtn)  submitBtn.disabled = true;

      try {
        // Build submission payload — includes UTM attribution
        const payload = Object.assign({ email }, activeUTMs, {
          submitted_at: new Date().toISOString(),
          referrer:     document.referrer || '(direct)',
          page:         window.location.pathname
        });

        // Simulated API call — replace with real endpoint
        // e.g. await fetch('/api/waitlist', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Track successful submission with full UTM context
        trackEvent('waitlist_signup', { email_domain: email.split('@')[1] || '', ...activeUTMs });

        // Success
        waitlistForm.reset();
        showToast('🎉 You\'re on the waitlist! We\'ll be in touch soon.');

      } catch (err) {
        trackEvent('waitlist_error', { error: String(err) });
        showToast('⚠️ Something went wrong. Please try again.');
      } finally {
        if (btnText)    btnText.textContent = 'Join Waitlist';
        if (btnSpinner) btnSpinner.hidden = true;
        if (submitBtn)  submitBtn.disabled = false;
      }
    });

    // Clear error on input
    if (emailInput) {
      emailInput.addEventListener('input', () => {
        if (formError) formError.hidden = true;
      });
    }
  }

  /* ── Smooth Scroll for nav links ────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const offset = 80; // navbar height
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ── App Mockup Outfit Cycler ───────────────────────────────── */
  const MOCKUP_OUTFITS = [
    { pieces: [['👔','linear-gradient(135deg,#6366f1,#8b5cf6)'],['👖','linear-gradient(135deg,#1e293b,#334155)'],['👟','linear-gradient(135deg,#f59e0b,#f97316)']], label: 'Business Casual · 22°C · Client Meeting' },
    { pieces: [['🧥','linear-gradient(135deg,#64748b,#475569)'],['👗','linear-gradient(135deg,#ec4899,#f43f5e)'],['👢','linear-gradient(135deg,#92400e,#78350f)']], label: 'Smart Evening · 14°C · Dinner Date' },
    { pieces: [['🩱','linear-gradient(135deg,#0ea5e9,#6366f1)'],['👖','linear-gradient(135deg,#1e293b,#334155)'],['👟','linear-gradient(135deg,#e2e8f0,#cbd5e1)']], label: 'Weekend Casual · 20°C · Free Day ☀️' },
  ];
  let mockupIdx = 0;
  const mockupItems = document.getElementById('mockup-outfit-items');
  const mockupLabel = document.getElementById('mockup-outfit-label');
  const outfitDots  = document.querySelectorAll('.odot');

  function cycleMockupOutfit() {
    if (!mockupItems || !mockupLabel) return;
    mockupIdx = (mockupIdx + 1) % MOCKUP_OUTFITS.length;
    const o = MOCKUP_OUTFITS[mockupIdx];

    mockupItems.style.opacity = '0';
    setTimeout(() => {
      mockupItems.innerHTML = o.pieces.map(([e, bg]) =>
        `<div class="outfit-piece" style="background:${bg};">${e}</div>`
      ).join('');
      mockupLabel.textContent = o.label;
      mockupItems.style.opacity = '1';
      outfitDots.forEach((d, i) => d.classList.toggle('active', i === mockupIdx));
    }, 300);
  }
  if (mockupItems) {
    mockupItems.style.transition = 'opacity 0.3s ease';
    setInterval(cycleMockupOutfit, 3500);
  }

  /* ── Interactive Agent Demo ─────────────────────────────────── */
  const AGENT_DATA = {
    '👔': {
      vision:         { tags: ['Dress Shirt','White','Solid','100% Cotton','Formal'], confidence: 97, duration: 900 },
      weather:        { line: '22°C · Partly cloudy · 10am Client meeting indoors', duration: 700 },
      stylist:        { pieces: [['👔','#6366f1'],['👖','#1e293b'],['👞','#92400e']], note: '"Classic power look. Slim trousers and Oxford shoes project confidence for the client meeting."', duration: 1100 },
      gap:            { item: 'Slim-fit charcoal trousers', reason: 'Would unlock 12 more business outfits', duration: 600 },
      sustainability: { wearScore: 8, co2: '0.4 kg CO₂', tip: 'Well utilized — worn 8×/month on average.', duration: 500 }
    },
    '👗': {
      vision:         { tags: ['Midi Dress','Multi-floral','Floral print','Chiffon','Casual'], confidence: 94, duration: 850 },
      weather:        { line: '24°C · Sunny ☀️ · No events — free day', duration: 700 },
      stylist:        { pieces: [['👗','#ec4899'],['👡','#92400e'],['🕶️','#0f172a']], note: '"Light and breezy for a warm day. The sunglasses add a polished finishing touch."', duration: 1100 },
      gap:            { item: 'White denim jacket', reason: 'Creates 5 new outfit combos for cooler evenings', duration: 600 },
      sustainability: { wearScore: 3, co2: '0.2 kg CO₂', tip: 'Underused item — try restyling it with a belt!', duration: 500 }
    },
    '🧥': {
      vision:         { tags: ['Trench Coat','Beige','Solid','Cotton blend','Smart casual'], confidence: 98, duration: 900 },
      weather:        { line: '12°C · Overcast 🌥️ · 7pm Dinner reservation', duration: 700 },
      stylist:        { pieces: [['🧥','#78350f'],['👗','#f43f5e'],['👢','#1e293b']], note: '"Timeless trench over a fitted dress. Perfect for the dinner reservation — effortlessly polished."', duration: 1100 },
      gap:            { item: 'Cashmere turtleneck', reason: 'Ideal base layer — unlocks 9 autumn combinations', duration: 600 },
      sustainability: { wearScore: 12, co2: '1.2 kg CO₂', tip: '🏆 Most-worn item this month! High value piece.', duration: 500 }
    },
    '👖': {
      vision:         { tags: ['Slim Jeans','Indigo blue','Solid','98% Denim','Casual'], confidence: 96, duration: 850 },
      weather:        { line: '20°C · Light breeze 🌬️ · 2pm Team standup (remote)', duration: 700 },
      stylist:        { pieces: [['👖','#1e293b'],['👔','#e2e8f0'],['👟','#f1f5f9']], note: '"Versatile base for any occasion. White shirt keeps it crisp for the video call."', duration: 1100 },
      gap:            { item: 'White Oxford shirt', reason: 'Unlocks 14 more smart-casual combinations', duration: 600 },
      sustainability: { wearScore: 21, co2: '0.8 kg CO₂', tip: 'Wash cold to save energy — your most worn item!', duration: 500 }
    },
    '👟': {
      vision:         { tags: ['Low-top Sneaker','White','Solid','Leather','Casual–smart'], confidence: 92, duration: 800 },
      weather:        { line: '16°C · Clear 🌤️ · Weekend — no events', duration: 700 },
      stylist:        { pieces: [['👟','#e2e8f0'],['👖','#334155'],['🩱','#0ea5e9']], note: '"Your styling MVP. Clean white leather works with virtually everything in your wardrobe."', duration: 1100 },
      gap:            { item: 'White ankle socks (3-pack)', reason: 'Comfort upgrade — low priority but recommended', duration: 600 },
      sustainability: { wearScore: 18, co2: '0.3 kg CO₂', tip: 'Clean with eco-friendly products to extend lifespan 🌿', duration: 500 }
    },
    '👜': {
      vision:         { tags: ['Tote Bag','Tan brown','Solid','Full-grain leather','Business'], confidence: 91, duration: 850 },
      weather:        { line: '19°C · Mild & clear · 9am Investor presentation', duration: 700 },
      stylist:        { pieces: [['👜','#92400e'],['👔','#e2e8f0'],['👖','#1e293b']], note: '"Professional and grounded. Full-grain leather signals quality — perfect for the presentation."', duration: 1100 },
      gap:            { item: 'Slim card holder wallet', reason: 'Completes the minimalist professional look', duration: 600 },
      sustainability: { wearScore: 6, co2: '0.1 kg CO₂', tip: 'Leather lasts decades — condition it monthly 🌱', duration: 500 }
    }
  };

  // Piece background colors per emoji for result display
  const PIECE_BG = {
    '👔':'#6366f1','👗':'#ec4899','🧥':'#64748b','👖':'#1e293b',
    '👟':'#f1f5f9','👜':'#92400e','👡':'#a16207','👢':'#78350f',
    '👞':'#92400e','🩱':'#0ea5e9','🕶️':'#0f172a','👔':'#6366f1'
  };

  let demoRunning = false;

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function setAgentStatus(agentName, status) {
    const el = document.querySelector(`.pipeline-agent[data-agent="${agentName}"]`);
    if (!el) return;
    const statusEl = el.querySelector('.pa-status');
    if (statusEl) {
      statusEl.setAttribute('data-status', status);
      statusEl.textContent = status === 'idle' ? 'Idle' : status === 'processing' ? 'Processing…' : 'Done ✓';
    }
    el.classList.remove('processing', 'done');
    if (status === 'processing') el.classList.add('processing');
    if (status === 'done')       el.classList.add('done');
  }

  function animateBar(barId, durationMs) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    const steps = 30;
    const interval = durationMs / steps;
    let pct = 0;
    const timer = setInterval(() => {
      pct = Math.min(pct + (100 / steps), 100);
      bar.style.width = pct + '%';
      if (pct >= 100) clearInterval(timer);
    }, interval);
  }

  function showOutput(outputId, html) {
    const el = document.getElementById(outputId);
    if (!el) return;
    el.innerHTML = html;
    el.classList.add('visible');
  }

  function resetDemo() {
    const agents = ['vision','weather','stylist','gap','sustainability'];
    agents.forEach(a => {
      setAgentStatus(a, 'idle');
      const bar = document.getElementById(`pa-bar-${a}`);
      const out = document.getElementById(`pa-output-${a}`);
      if (bar) bar.style.width = '0%';
      if (out) { out.innerHTML = ''; out.classList.remove('visible'); }
    });
    const resultOutfit = document.getElementById('result-outfit');
    const resultPH     = document.getElementById('result-placeholder');
    const resultCard   = document.getElementById('demo-result-card');
    const resetBtn     = document.getElementById('demo-reset');
    if (resultOutfit) resultOutfit.style.display = 'none';
    if (resultPH)     resultPH.style.display = 'flex';
    if (resultCard)   resultCard.classList.remove('ready');
    if (resetBtn)     resetBtn.style.display = 'none';
    document.querySelectorAll('.garment-btn').forEach(b => b.classList.remove('selected', 'disabled'));
    demoRunning = false;
  }

  async function runDemo(emoji, data) {
    if (demoRunning) return;
    demoRunning = true;

    // Mark selected garment
    document.querySelectorAll('.garment-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.emoji === emoji);
      b.classList.toggle('disabled', b.dataset.emoji !== emoji);
    });

    // --- Agent 1: Vision ---
    setAgentStatus('vision', 'processing');
    animateBar('pa-bar-vision', data.vision.duration);
    await sleep(data.vision.duration);
    setAgentStatus('vision', 'done');
    showOutput('pa-output-vision',
      data.vision.tags.map(t => `<span class="tag">${t}</span>`).join('') +
      `<span class="tag-green tag">Confidence: ${data.vision.confidence}%</span>`
    );
    await sleep(150);

    // --- Agent 2: Weather ---
    setAgentStatus('weather', 'processing');
    animateBar('pa-bar-weather', data.weather.duration);
    await sleep(data.weather.duration);
    setAgentStatus('weather', 'done');
    showOutput('pa-output-weather', data.weather.line);
    await sleep(150);

    // --- Agent 3: Stylist ---
    setAgentStatus('stylist', 'processing');
    animateBar('pa-bar-stylist', data.stylist.duration);
    await sleep(data.stylist.duration);
    setAgentStatus('stylist', 'done');
    showOutput('pa-output-stylist', '3 outfit options generated ✓');
    await sleep(150);

    // --- Agent 4: Gap ---
    setAgentStatus('gap', 'processing');
    animateBar('pa-bar-gap', data.gap.duration);
    await sleep(data.gap.duration);
    setAgentStatus('gap', 'done');
    showOutput('pa-output-gap', `<span class="tag">Gap: ${data.gap.item}</span><br>${data.gap.reason}`);
    await sleep(150);

    // --- Agent 5: Sustainability ---
    setAgentStatus('sustainability', 'processing');
    animateBar('pa-bar-sustainability', data.sustainability.duration);
    await sleep(data.sustainability.duration);
    setAgentStatus('sustainability', 'done');
    showOutput('pa-output-sustainability',
      `<span class="tag-green tag">Worn ${data.sustainability.wearScore}× this month</span> · ${data.sustainability.co2}<br>${data.sustainability.tip}`
    );

    await sleep(400);

    // --- Show result ---
    const resultPH     = document.getElementById('result-placeholder');
    const resultOutfit = document.getElementById('result-outfit');
    const resultPieces = document.getElementById('result-pieces');
    const resultNote   = document.getElementById('result-note');
    const resultBadges = document.getElementById('result-badges');
    const resultCard   = document.getElementById('demo-result-card');
    const resetBtn     = document.getElementById('demo-reset');

    if (resultPH)     resultPH.style.display = 'none';
    if (resultOutfit) resultOutfit.style.display = 'block';
    if (resultCard)   resultCard.classList.add('ready');

    if (resultPieces) {
      resultPieces.innerHTML = data.stylist.pieces.map(([e, bg], i) =>
        `<div class="result-piece" style="background:${bg};animation-delay:${i * 100}ms;">${e}</div>`
      ).join('');
    }
    if (resultNote)   resultNote.textContent = data.stylist.note;
    if (resultBadges) {
      resultBadges.innerHTML = [
        `<span class="result-badge rb-purple">👁 Auto-tagged</span>`,
        `<span class="result-badge rb-green">🌱 ${data.sustainability.wearScore}× worn</span>`,
        `<span class="result-badge rb-amber">🛍 1 gap found</span>`
      ].join('');
    }
    if (resetBtn) resetBtn.style.display = 'flex';

    trackEvent('demo_complete', { garment: emoji });
  }

  // Wire up garment buttons
  document.querySelectorAll('.garment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (demoRunning) return;
      const emoji = btn.dataset.emoji;
      const data  = AGENT_DATA[emoji];
      if (!data) return;
      resetDemo();
      setTimeout(() => runDemo(emoji, data), 80);
      trackEvent('demo_garment_pick', { garment: emoji });
    });
  });

  const demoResetBtn = document.getElementById('demo-reset');
  if (demoResetBtn) demoResetBtn.addEventListener('click', resetDemo);

  /* ── Init ───────────────────────────────────────────────────── */
  updateScrollBar();
  updateNavbar();
  updateActiveNavLink();

})();

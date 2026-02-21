/* ═══════════════════════════════════════════
   JARVIS VED EXPERT — Interactive JS
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── AOS (Animate On Scroll) ── */
  const aosEls = document.querySelectorAll('[data-aos]');
  const aosObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.aosDelay || 0);
        setTimeout(() => entry.target.classList.add('aos-animate'), delay);
        aosObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  aosEls.forEach(el => aosObserver.observe(el));


  /* ── Sticky CTA ── */
  const stickyCta = document.getElementById('stickyCta');
  const heroSection = document.getElementById('hero');
  const stickyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        stickyCta.classList.add('visible');
      } else {
        stickyCta.classList.remove('visible');
      }
    });
  }, { threshold: 0.1 });
  if (heroSection) stickyObserver.observe(heroSection);


  /* ── Counter Animation ── */
  function animateCounter(el, target, duration = 2000, prefix = '', suffix = '') {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { start = target; clearInterval(timer); }
      el.textContent = prefix + Math.floor(start).toLocaleString('ru-RU') + suffix;
    }, 16);
  }

  // Hero trust badge counter
  const heroCounter = document.querySelector('.counter[data-target]');
  if (heroCounter) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(heroCounter, parseInt(heroCounter.dataset.target));
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counterObserver.observe(heroCounter);
  }


  /* ── Live Counter (Social Proof) ── */
  const liveCounter = document.getElementById('liveCounter');
  if (liveCounter) {
    let base = 48320;
    const updateLive = () => {
      base += Math.floor(Math.random() * 800 + 200);
      liveCounter.textContent = '₽ ' + base.toLocaleString('ru-RU');
    };
    setInterval(updateLive, 8000);
  }


  /* ── FAQ Accordion ── */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-q');
    const answer = item.querySelector('.faq-a');
    if (!btn || !answer) return;

    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      // Close all
      faqItems.forEach(other => {
        const otherBtn = other.querySelector('.faq-q');
        const otherAns = other.querySelector('.faq-a');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        if (otherAns) otherAns.classList.remove('open');
      });

      // Toggle current
      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        answer.classList.add('open');
      }
    });
  });


  /* ── Billing Toggle (Monthly / Yearly) ── */
  const billingToggle = document.getElementById('billingToggle');
  const priceNums = document.querySelectorAll('.price-num');

  if (billingToggle) {
    billingToggle.addEventListener('change', () => {
      const isYearly = billingToggle.checked;
      priceNums.forEach(el => {
        const monthly = el.dataset.month;
        const yearly  = el.dataset.year;
        if (isYearly && yearly !== undefined) {
          el.textContent = yearly !== '0' ? yearly : '0 ₽';
        } else {
          el.textContent = monthly !== undefined ? (monthly !== '0' ? monthly : '0 ₽') : el.textContent;
        }
      });
    });
  }


  /* ── Lead Magnet Form ── */
  const leadInput = document.getElementById('leadInput');
  const leadBtn   = document.getElementById('leadBtn');
  if (leadInput && leadBtn) {
    leadInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        leadBtn.click();
      }
    });
  }


  /* ── Circuit Background (Canvas) ── */
  const circuitBg = document.querySelector('.circuit-bg');
  if (circuitBg) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0.35;';
    circuitBg.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let W, H;

    function resize() {
      W = canvas.width  = circuitBg.offsetWidth;
      H = canvas.height = circuitBg.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Draw subtle circuit lines
    function drawCircuit() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.lineWidth = 1;

      const lines = [
        { x1: 0.1, y1: 0.2, x2: 0.4, y2: 0.2 },
        { x1: 0.4, y1: 0.2, x2: 0.4, y2: 0.5 },
        { x1: 0.4, y1: 0.5, x2: 0.7, y2: 0.5 },
        { x1: 0.7, y1: 0.1, x2: 0.7, y2: 0.5 },
        { x1: 0.7, y1: 0.1, x2: 0.95, y2: 0.1 },
        { x1: 0.2, y1: 0.7, x2: 0.2, y2: 0.9 },
        { x1: 0.2, y1: 0.9, x2: 0.55, y2: 0.9 },
        { x1: 0.55, y1: 0.6, x2: 0.55, y2: 0.9 },
        { x1: 0.55, y1: 0.6, x2: 0.85, y2: 0.6 },
        { x1: 0.85, y1: 0.3, x2: 0.85, y2: 0.6 },
      ];

      lines.forEach(l => {
        ctx.beginPath();
        ctx.moveTo(l.x1 * W, l.y1 * H);
        ctx.lineTo(l.x2 * W, l.y2 * H);
        ctx.stroke();
        // Node dots
        ctx.fillStyle = 'rgba(0, 229, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(l.x2 * W, l.y2 * H, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    drawCircuit();
    window.addEventListener('resize', drawCircuit);
  }


  /* ── Smooth scroll for nav links ── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });


  /* ── Hover glow on pain cards ── */
  document.querySelectorAll('.pain-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 0 40px rgba(0,229,255,0.18), 0 8px 40px rgba(0,0,0,0.4)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '';
    });
  });

});

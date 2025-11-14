// Copyright year and header state
document.addEventListener('DOMContentLoaded', () => {
  const y = document.querySelector('#y');
  if (y) y.textContent = new Date().getFullYear();

  const header = document.querySelector('.header');
  if (header) {
    const toggle = () => {
      const shouldStick = window.scrollY > 24;
      header.classList.toggle('is-scrolled', shouldStick);
    };
    toggle();
    window.addEventListener('scroll', toggle, { passive: true });

    const menuToggle = header.querySelector('.menu-toggle');
    const nav = header.querySelector('#site-menu');
    if (menuToggle && nav) {
      const closeMenu = () => {
        header.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      };

      const toggleMenu = () => {
        const open = !header.classList.contains('is-open');
        if (open) {
          header.classList.add('is-open');
          menuToggle.setAttribute('aria-expanded', 'true');
        } else {
          closeMenu();
        }
      };

      menuToggle.addEventListener('click', toggleMenu);
      menuToggle.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleMenu();
        }
      });

      nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          if (header.classList.contains('is-open')) closeMenu();
        });
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && header.classList.contains('is-open')) {
          closeMenu();
          menuToggle.focus();
        }
      });
    }
  }
});

/* ================================
   BUY PAGE — MULTI-OPEN ACCORDION
   ================================ */
(() => {
    const steps = Array.from(document.querySelectorAll('.steps-accordion details.step'));
    if (!steps.length) return;

    // Open from #hash on load (without scrolling)
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el && el.tagName.toLowerCase() === 'details') el.setAttribute('open', '');
    }
  
    // Preserve scroll position when a summary is toggled
    let preserveY = 0;
    steps.forEach(d => {
      const s = d.querySelector('summary');
      if (!s) return;
  
      // Record scroll position right before the browser might move it
      s.addEventListener('pointerdown', () => { preserveY = window.scrollY; }, { capture: true });
  
      d.addEventListener('toggle', () => {
        // Restore scroll after the toggle completes (prevents jump)
        requestAnimationFrame(() => window.scrollTo(0, preserveY));
      });
    });
  })();
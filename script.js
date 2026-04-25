// ── 1. Mobile Menu Toggle ─────────────────────────────
const mobileToggle = document.getElementById('mobile-toggle');
const navMenu = document.getElementById('nav-menu');

if (mobileToggle && navMenu) {
  mobileToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    const icon = mobileToggle.querySelector('i');
    const isOpen = navMenu.classList.contains('active');
    icon.classList.toggle('fa-bars', !isOpen);
    icon.classList.toggle('fa-xmark', isOpen);
  });

  // Close menu when a link is clicked
  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
      const icon = mobileToggle.querySelector('i');
      icon.classList.replace('fa-xmark', 'fa-bars');
    });
  });
}

// ── 2. Navbar scroll state ────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

// ── 3. Smooth scroll ──────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  });
});

// ── 4. Card Spotlight Effect ──────────────────────────
function handleMouseMove(e) {
  const { currentTarget: target } = e;
  const rect = target.getBoundingClientRect();
  target.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
  target.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
}

document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('mousemove', handleMouseMove);
});

// ── 5. Scroll Reveal (Intersection Observer) ──────────
const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('active');
    obs.unobserve(entry.target);
  });
}, {
  threshold: 0.08,
  rootMargin: '0px 0px -40px 0px'
});

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── 6. Category Filter ────────────────────────────────
const filterPills = document.querySelectorAll('.filter-pill');
const allCards = document.querySelectorAll('.card[data-category]');

filterPills.forEach(pill => {
  pill.addEventListener('click', () => {
    // Update active pill
    filterPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');

    const filter = pill.dataset.filter;

    allCards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      if (match) {
        card.style.opacity = '1';
        card.style.transform = '';
        card.style.pointerEvents = '';
        card.style.display = '';
      } else {
        card.style.opacity = '0.15';
        card.style.transform = 'scale(0.97)';
        card.style.pointerEvents = 'none';
      }
    });
  });
});

// ── 7. Animated counter for hero stats ───────────────
function animateCounter(el, target, duration = 1200) {
  const isInfinity = el.textContent.trim() === '∞';
  if (isInfinity) return;

  const suffix = el.textContent.replace(/[0-9]/g, '');
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target) + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

const statsObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const nums = entry.target.querySelectorAll('.stat-number');
    nums.forEach(el => {
      const raw = parseInt(el.textContent);
      if (!isNaN(raw)) animateCounter(el, raw);
    });
    obs.unobserve(entry.target);
  });
}, { threshold: 0.5 });

const statsRow = document.querySelector('.hero-stats');
if (statsRow) statsObserver.observe(statsRow);

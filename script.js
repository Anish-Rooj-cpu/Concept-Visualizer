// 1. Mobile Menu Toggle
const mobileToggle = document.getElementById('mobile-toggle');
const navMenu = document.getElementById('nav-menu');

mobileToggle.addEventListener('click', () => {
          navMenu.classList.toggle('active');
          const icon = mobileToggle.querySelector('i');
          if (navMenu.classList.contains('active')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-xmark');
          } else {
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
          }
});

// 2. Smooth scroll for navigation links
document.querySelectorAll('nav a[href^="#"], .cta-button').forEach(anchor => {
          anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    navMenu.classList.remove('active'); // Close mobile menu if open
                    mobileToggle.querySelector('i').classList.replace('fa-xmark', 'fa-bars');

                    document.querySelector(this.getAttribute('href')).scrollIntoView({
                              behavior: 'smooth'
                    });
          });
});

// 3. Modern Spotlight Hover Effect for Cards
const handleOnMouseMove = e => {
          const { currentTarget: target } = e;

          const rect = target.getBoundingClientRect(),
                    x = e.clientX - rect.left,
                    y = e.clientY - rect.top;

          target.style.setProperty("--mouse-x", `${x}px`);
          target.style.setProperty("--mouse-y", `${y}px`);
};

for (const card of document.querySelectorAll(".card")) {
          card.onmousemove = e => handleOnMouseMove(e);
}

// 4. High-Performance Scroll Reveal (Intersection Observer)
const revealElements = document.querySelectorAll('.card, .section-header');
revealElements.forEach(el => el.classList.add('reveal')); // Add base class

const revealOptions = {
          threshold: 0.1, // Trigger when 10% of element is visible
          rootMargin: "0px 0px -50px 0px"
};

const revealOnScroll = new IntersectionObserver(function (entries, observer) {
          entries.forEach(entry => {
                    if (!entry.isIntersecting) {
                              return;
                    } else {
                              entry.target.classList.add('active');
                              observer.unobserve(entry.target); // Stop observing once revealed
                    }
          });
}, revealOptions);

revealElements.forEach(el => {
          revealOnScroll.observe(el);
});
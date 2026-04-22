// Smooth scroll for navigation
document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
          anchor.addEventListener('click', function (e) {
                    e.preventDefault();

                    document.querySelector(this.getAttribute('href'))
                              .scrollIntoView({
                                        behavior: 'smooth'
                              });
          });
});

// Optional: simple fade-in effect on scroll (basic version)
const cards = document.querySelectorAll('.card');

window.addEventListener('scroll', () => {
          cards.forEach(card => {
                    const rect = card.getBoundingClientRect();
                    if (rect.top < window.innerHeight - 50) {
                              card.style.opacity = 1;
                              card.style.transform = "translateY(0)";
                    }
          });
});

// Initial state
cards.forEach(card => {
          card.style.opacity = 0;
          card.style.transform = "translateY(20px)";
          card.style.transition = "all 0.6s ease";
});
// Toggle language and direction for About page to match saved preference
(function(){
  try {
    const lang = (localStorage.getItem('lang') || 'he').toLowerCase();
    const html = document.documentElement;
    const t = {
      he: {
        title: 'אודות',
        nav: {
          index: 'מחשבון חיתוך אופטימלי',
          plans: 'תוכניות בנייה להורדה',
          about: 'אודות',
          contact: 'צור קשר'
        }
      },
      en: {
        title: 'About',
        nav: {
          index: 'Cut Optimizer',
          plans: 'Downloadable Plans',
          about: 'About',
          contact: 'Contact'
        }
      }
    };

    const isHe = lang === 'he';
    html.lang = isHe ? 'he' : 'en';
    html.dir = isHe ? 'rtl' : 'ltr';

    // Toggle bilingual content blocks
    document.querySelectorAll('.lang-he').forEach(el=> el.style.display = isHe ? '' : 'none');
    document.querySelectorAll('.lang-en').forEach(el=> el.style.display = isHe ? 'none' : '');

    // Update page title text inside header and document title
    const siteTitle = document.querySelector('.topbar .site-title');
    if (siteTitle) siteTitle.textContent = t[lang].title;
    document.title = t[lang].title;

    // Localize nav links text
    const links = Array.from(document.querySelectorAll('.main-nav .nav-wrap a'));
    links.forEach(a => {
      const href = (a.getAttribute('href') || '').split('?')[0];
      if (href.endsWith('index.html')) a.textContent = t[lang].nav.index;
      else if (href.endsWith('plans.html')) a.textContent = t[lang].nav.plans;
      else if (href.endsWith('about.html')) a.textContent = t[lang].nav.about;
      else if (href.endsWith('contact.html')) a.textContent = t[lang].nav.contact;
    });
  } catch(e){}
})();

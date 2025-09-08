## Project Pages

Pages included in this project:

- `index.html` – main application / calculator
- `pricing.html` – legacy pricing comparison table
- `subscription.html` – new subscription management layout (plans + billing toggle)
- `plans.html` – downloadable plans catalog
- `articles.html` / `article.html` – articles listing & detail
- `about.html` – about page
- `contact.html` – contact form
- `checkout.html` – checkout flow (query param plan=)

Supporting scripts and styles are in the root (`styles.css`, `app.js`, etc.).

The new `subscription.html` page reads and writes `currentPlan` in localStorage and supports a monthly/annual toggle (annual shows 2 months free by pricing the year as 10× the monthly rate).

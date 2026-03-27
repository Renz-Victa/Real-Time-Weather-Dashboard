# Real-Time Weather Dashboard
 
A production-ready weather dashboard built with vanilla HTML, CSS and JavaScript. Search any city in the world for live weather conditions, hourly updates and a 5-day forecast.
 
**Live demo:** [renz-victa.github.io/Real-Time-Weather-Dashboard](https://renz-victa.github.io/Real-Time-Weather-Dashboard/)
 
---
 
## Features
 
- Current temperature, humidity, wind speed, and conditions
- Daily temperatures and weather descriptions
- One-click weather for your current location
- Switch between Celsius and Fahrenheit instantly
- Dark / Light Theme
- Smooth loading state while data fetches
- User-friendly messages for invalid cities and network failures
- Screen reader support, ARIA attributes throughout the project
- Jest tests covering all core functions
 
---
 
## Tech Stack
 
| Layer | Technology |
|---|---|
| Markup | Semantic HTML5 |
| Styling | Custom CSS with CSS variables (dark/light themes) |
| Logic | Vanilla JavaScript (ES6+) |
| Weather API | [Open-Meteo](https://open-meteo.com/) — free, no key required |
| Geocoding API | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) |
| Testing | Jest + jest-environment-jsdom |
| Deployment | GitHub Pages & Vercel | 
 
---
 
## Getting Started
 
### 1. Clone the repository
 
```bash
git clone https://github.com/Renz-Victa/Real-Time-Weather-Dashboard.git
cd Real-Time-Weather-Dashboard
```
 
### 2. Open in browser
 
No build step required. Open `index.html` directly in your browser, or use a local server:
 
```bash
npx serve .
```
 
### 3. Install dependencies (for running tests only)
 
```bash
npm install
```
 
---
 
## Running Tests
 
```bash
npx jest script.test.js
```
 
The test suite covers:
 
- `showError()` : error banner visibility and content
- `updateUnitButton()` : label and ARIA state for metric/imperial toggle
- `applyTheme()` : dark/light theme, body styles, localStorage, ARIA attributes
- `getWmoCondition()` : WMO weather code mapping to descriptions and icons
- `showSkeleton()` / `hideSkeleton()` : loading state and `aria-busy` toggling
- `getWeather()` : geocoding API calls, weather API calls, DOM rendering, error handling, localStorage persistence
 
---
 
## Project Structure
 
```
Real-Time-Weather-Dashboard/
├── index.html          # Semantic HTML, ARIA landmarks, skip link, accessible structure
├── style.css           # Design system with CSS variables, dark/light themes, animations
├── script.js           # All app logic — API calls, rendering, theme, unit toggle, tests
├── script.test.js      # Standalone Jest test suite
└── package.json        # Jest configuration
```
 
---
 
## How the API Works
 
Open-Meteo is used in two steps since the weather API only accepts coordinates:
 
1. The city name is sent to `geocoding-api.open-meteo.com`, which returns latitude, longitude and country
2. The coordinates are sent to `api.open-meteo.com`, which returns current conditions and a 5-day daily forecast
 
Both APIs are completely free with no account or API key required.
 
---
 
## Key Engineering Decisions
 
**`AbortController`** : every new search cancels the previous in-flight request so stale results never overwrite fresh ones.
 
**`Promise.all`** : where multiple fetches are independent they run in parallel rather than sequentially, cutting load time.
 
**Debounced input** : search fires 500ms after the user stops typing, reducing unnecessary API calls.
 
**WMO weather codes** : Open-Meteo uses the international WMO standard (numeric codes) instead of text descriptions.
 
**Inline theme styles** : the theme toggle writes `backgroundColor` and `color` directly onto `document.body` as inline styles, ensuring the theme works even when a CSS framework would otherwise override CSS variables in the cascade.
 
---
 
## Accessibility
 
This project targets WCAG 2.1 AA compliance:
 
- Keyboard users bypass the navbar and jump directly to search
- **`role="search"`** landmark wraps the search section
- **`aria-live="assertive"`** on the error banner — announced immediately by screen readers
- **`aria-live="polite"`** on a status region, announces loaded weather data
- **`aria-busy`** on `<main>` : signals to screen readers when content is loading
- **`aria-pressed`** on toggle buttons : reflects current dark/light and °C/°F state
- **`<dl><dt><dd>`** for weather stat pairs : semantically correct for label/value data
- **`<ul><li>`** for forecast cards : correct list semantics
- **`:focus-visible`** : visible keyboard focus ring
- **`aria-label`** on all icon-only buttons
 
---
 
## What I Learned
 
- Structuring a vanilla JS project with clear separation of concerns without a framework
- Working with external REST APIs, handling errors gracefully, and managing concurrent requests with AbortController
- Writing semantic HTML that works for keyboard and screen reader users, not just mouse users
- Setting up Jest with jsdom to test DOM-dependent JavaScript
- Deploying a static site to GitHub Pages
 
---
 
## License
 
MIT — free to use, modify, and distribute.
 
---
 
*Built by [Renz Victa](https://github.com/Renz-Victa)*
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

// Open-Meteo uses WMO weather condition codes (0–99).
// This maps each code to a human-readable description and an
// OpenWeatherMap-compatible icon code so the existing icon <img>
// keeps working without any HTML changes.
const WMO_CODES = {
    0: { description: 'clear sky', icon: '01d' },
    1: { description: 'mainly clear', icon: '01d' },
    2: { description: 'partly cloudy', icon: '02d' },
    3: { description: 'overcast', icon: '04d' },
    45: { description: 'foggy', icon: '50d' },
    48: { description: 'icy fog', icon: '50d' },
    51: { description: 'light drizzle', icon: '09d' },
    53: { description: 'moderate drizzle', icon: '09d' },
    55: { description: 'heavy drizzle', icon: '09d' },
    61: { description: 'light rain', icon: '10d' },
    63: { description: 'moderate rain', icon: '10d' },
    65: { description: 'heavy rain', icon: '10d' },
    66: { description: 'light freezing rain', icon: '13d' },
    67: { description: 'heavy freezing rain', icon: '13d' },
    71: { description: 'light snow', icon: '13d' },
    73: { description: 'moderate snow', icon: '13d' },
    75: { description: 'heavy snow', icon: '13d' },
    77: { description: 'snow grains', icon: '13d' },
    80: { description: 'light showers', icon: '09d' },
    81: { description: 'moderate showers', icon: '09d' },
    82: { description: 'violent showers', icon: '09d' },
    85: { description: 'light snow showers', icon: '13d' },
    86: { description: 'heavy snow showers', icon: '13d' },
    95: { description: 'thunderstorm', icon: '11d' },
    96: { description: 'thunderstorm with hail', 'icon': '11d' },
    99: { description: 'thunderstorm with heavy hail', 'icon': '11d' },
};

function getWmoCondition(code) {
    return WMO_CODES[code] || { description: 'unknown', icon: '01d' };
}

// ─── DOM refs ─────────────────────────────────────────────────────
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const errorMessage = document.getElementById('error-message');
const currentWeatherSection = document.getElementById('current-weather');
const forecastSection = document.getElementById('forecast-section');
const forecastGrid = document.getElementById('forecast-grid');
const unitToggle = document.getElementById('unitToggle');
const toggleBtn = document.getElementById('themeToggle');

// ─── State ────────────────────────────────────────────────────────
let unit = localStorage.getItem('unit') || 'metric';
let currentController = null;
let debounceTimer;

// ─── Init ─────────────────────────────────────────────────────────
updateUnitButton();

const THEMES = {
    dark: { bg: '#0f172a', color: '#e5e7eb' },
    light: { bg: '#f5f7fa', color: '#111111' },
};

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.style.backgroundColor = THEMES[theme].bg;
    document.body.style.color = THEMES[theme].color;
    localStorage.setItem('theme', theme);
    toggleBtn.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    // A11Y: keep aria-pressed and aria-label in sync with visual state
    toggleBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    toggleBtn.setAttribute('aria-label',
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
}

applyTheme(localStorage.getItem('theme') || 'light');

window.addEventListener('load', () => {
    const lastCity = localStorage.getItem('lastCity');
    if (lastCity) getWeather(lastCity);
});

// ─── Event listeners ──────────────────────────────────────────────
searchBtn.addEventListener('click', () => getWeather(cityInput.value));

cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        clearTimeout(debounceTimer);
        getWeather(cityInput.value);
    }
});

cityInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => getWeather(cityInput.value), 500);
});

document.getElementById('location-btn').addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
        showError('Geolocation is not supported by your browser.');
        return;
    }
    const btn = document.getElementById('location-btn');
    btn.setAttribute('aria-disabled', 'true');

    navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
            btn.removeAttribute('aria-disabled');
            await getWeatherByCoords(coords.latitude, coords.longitude);
        },
        () => {
            btn.removeAttribute('aria-disabled');
            showError('Unable to get your location. Please search by city name.');
        },
        { timeout: 10000 }
    );
});

toggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
});

unitToggle.addEventListener('click', () => {
    unit = unit === 'metric' ? 'imperial' : 'metric';
    localStorage.setItem('unit', unit);
    updateUnitButton();
    const city = localStorage.getItem('lastCity');
    if (city) getWeather(city);
});

// ─── Geocoding ────────────────────────────────────────────────────
// Open-Meteo geocoding converts a city name to coordinates.
// Returns { name, country, latitude, longitude } or throws.
async function geocodeCity(city, signal) {
    const url = `${GEO_URL}?name=${encodeURIComponent(city.trim())}&count=1&language=en&format=json`;
    const res = await fetch(url, { signal });

    if (!res.ok) throw new Error('Could not reach the geocoding service. Please try again.');

    const data = await res.json();

    if (!data.results || data.results.length === 0) {
        throw new Error(`City "${city}" not found. Check the spelling and try again.`);
    }

    const { name, country, latitude, longitude } = data.results[0];
    return { name, country, latitude, longitude };
}

// ─── Weather fetch ────────────────────────────────────────────────
// Open-Meteo returns temperature in Celsius by default.
// Pass temperature_unit=fahrenheit for imperial.
// Wind speed unit: ms (metres/sec) or mph.
function buildWeatherUrl(lat, lon) {
    const tempUnit = unit === 'imperial' ? 'fahrenheit' : 'celsius';
    const windUnit = unit === 'imperial' ? 'mph' : 'ms';

    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: [
            'temperature_2m',
            'relative_humidity_2m',
            'apparent_temperature',
            'weather_code',
            'wind_speed_10m',
        ].join(','),
        daily: [
            'weather_code',
            'temperature_2m_max',
            'temperature_2m_min',
        ].join(','),
        temperature_unit: tempUnit,
        wind_speed_unit: windUnit,
        timezone: 'auto',       // auto-detect timezone from coordinates
        forecast_days: 6,
    });

    return `${WEATHER_URL}?${params}`;
}

// ─── Core fetch flow ──────────────────────────────────────────────
async function getWeather(city) {
    if (!city.trim()) return;

    if (currentController) currentController.abort();
    currentController = new AbortController();
    const { signal } = currentController;

    showSkeleton();
    errorMessage.classList.add('hidden');

    try {
        // Step 1: city name → coordinates
        const location = await geocodeCity(city, signal);

        // Step 2: coordinates → weather data
        const weatherRes = await fetch(buildWeatherUrl(location.latitude, location.longitude), { signal });
        if (!weatherRes.ok) throw new Error('Could not load weather data. Please try again.');
        const weatherData = await weatherRes.json();

        updateCurrentWeather(weatherData, location);
        updateForecast(weatherData);

        localStorage.setItem('lastCity', city);

    } catch (error) {
        if (error.name === 'AbortError') return;
        showError(error.message);
    } finally {
        hideSkeleton();
    }
}

// Coordinates path — used by the geolocation button.
// Reverse-geocodes coords back to a city name for the display.
async function getWeatherByCoords(lat, lon) {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    const { signal } = currentController;

    showSkeleton();
    errorMessage.classList.add('hidden');

    try {
        // Reverse geocode: coords → city name + country
        const geoUrl = `${GEO_URL}?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`;
        const geoRes = await fetch(geoUrl, { signal });
        const geoData = await geoRes.json();

        const location = geoData.results?.[0]
            ? { name: geoData.results[0].name, country: geoData.results[0].country, latitude: lat, longitude: lon }
            : { name: 'Your location', country: '', latitude: lat, longitude: lon };

        const weatherRes = await fetch(buildWeatherUrl(lat, lon), { signal });
        if (!weatherRes.ok) throw new Error('Could not load weather data. Please try again.');
        const weatherData = await weatherRes.json();

        updateCurrentWeather(weatherData, location);
        updateForecast(weatherData);

    } catch (error) {
        if (error.name === 'AbortError') return;
        showError(error.message);
    } finally {
        hideSkeleton();
    }
}

// ─── Render: current weather ──────────────────────────────────────
// Open-Meteo response shape (relevant fields):
// {
//   current: {
//     temperature_2m, relative_humidity_2m, apparent_temperature,
//     weather_code, wind_speed_10m
//   },
//   daily: {
//     time[],           // ISO date strings
//     weather_code[],
//     temperature_2m_max[],
//     temperature_2m_min[]
//   }
// }
function updateCurrentWeather(data, location) {
    currentWeatherSection.classList.remove('hidden');
    forecastSection.classList.remove('hidden');

    const current = data.current;
    const unitLabel = unit === 'metric' ? '°C' : '°F';
    const windUnit = unit === 'metric' ? 'm/s' : 'mph';
    const condition = getWmoCondition(current.weather_code);
    const temp = Math.round(current.temperature_2m);
    const cityCountry = location.country
        ? `${location.name}, ${location.country}`
        : location.name;

    document.getElementById('city-name').textContent = cityCountry;
    document.getElementById('date').textContent = new Date().toLocaleDateString();
    document.getElementById('temperature').textContent = `${temp}${unitLabel}`;
    document.getElementById('description').textContent = condition.description;
    document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
    document.getElementById('wind-speed').textContent = `${current.wind_speed_10m} ${windUnit}`;

    // A11Y: alt set to real condition description for screen readers
    const icon = document.getElementById('weather-icon');
    icon.src = `https://openweathermap.org/img/wn/${condition.icon}@2x.png`;
    icon.alt = condition.description;

    // A11Y: announce full summary to screen reader users
    announceToScreenReader(
        `Weather loaded for ${cityCountry}. ` +
        `${temp}${unitLabel}, ${condition.description}. ` +
        `Humidity ${current.relative_humidity_2m}%, ` +
        `wind ${current.wind_speed_10m} ${windUnit}.`
    );
}

// ─── Render: 5-day forecast ───────────────────────────────────────
function updateForecast(data) {
    forecastGrid.innerHTML = '';

    const unitLabel = unit === 'metric' ? '°C' : '°F';
    const daily = data.daily;

    // Skip index 0 (today) — show the next 5 days
    for (let i = 1; i <= 5; i++) {
        if (!daily.time[i]) break;

        const date = new Date(daily.time[i] + 'T12:00:00')
            .toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
        const high = Math.round(daily.temperature_2m_max[i]);
        const low = Math.round(daily.temperature_2m_min[i]);
        const condition = getWmoCondition(daily.weather_code[i]);

        // A11Y: <li> inside <ul #forecast-grid>, with full aria-label
        const card = document.createElement('li');
        card.className = 'forecast-card';
        card.setAttribute('aria-label',
            `${date}: ${condition.description}, high ${high}${unitLabel}, low ${low}${unitLabel}`
        );

        card.innerHTML = `
            <p aria-hidden="true">${date}</p>
            <img
                src="https://openweathermap.org/img/wn/${condition.icon}.png"
                alt="${condition.description}"
                loading="lazy"
                width="40" height="40"
            >
            <p aria-hidden="true">${high}${unitLabel}</p>
            <p aria-hidden="true" style="font-size:0.78rem;opacity:0.65">${low}${unitLabel}</p>
        `;
        forecastGrid.appendChild(card);
    }
}

// ─── UI helpers ───────────────────────────────────────────────────

// A11Y: politely announces a message to screen readers without
// interrupting whatever is currently being read.
function announceToScreenReader(message) {
    const status = document.getElementById('status-message');
    if (!status) return;
    status.textContent = '';
    setTimeout(() => { status.textContent = message; }, 100);
}

function showSkeleton() {
    const skeleton = document.getElementById('skeleton-screen');
    if (skeleton) skeleton.classList.remove('hidden');
    // A11Y: aria-busy tells screen readers the region is updating
    const weatherMain = document.getElementById('weather-main');
    if (weatherMain) weatherMain.setAttribute('aria-busy', 'true');
    currentWeatherSection.classList.add('hidden');
    forecastSection.classList.add('hidden');
}

function hideSkeleton() {
    const skeleton = document.getElementById('skeleton-screen');
    if (skeleton) skeleton.classList.add('hidden');
    const weatherMain = document.getElementById('weather-main');
    if (weatherMain) weatherMain.setAttribute('aria-busy', 'false');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    currentWeatherSection.classList.add('hidden');
    forecastSection.classList.add('hidden');
}

function updateUnitButton() {
    const isMetric = unit === 'metric';
    unitToggle.textContent = isMetric ? '°F' : '°C';
    // A11Y: aria-label and aria-pressed kept in sync
    unitToggle.setAttribute('aria-label',
        isMetric ? 'Switch to Fahrenheit' : 'Switch to Celsius'
    );
    unitToggle.setAttribute('aria-pressed', String(!isMetric));
}

// ─── Tests ────────────────────────────────────────────────────────
// Run with: npx jest script.test.js
if (typeof describe !== 'undefined') {

    // ── showError ──────────────────────────────────────────────────
    describe('showError()', () => {

        beforeEach(() => {
            errorMessage.classList.add('hidden');
            errorMessage.textContent = '';
            currentWeatherSection.classList.remove('hidden');
            forecastSection.classList.remove('hidden');
        });

        it('removes hidden class from the error element', () => {
            showError('City not found.');
            expect(errorMessage.classList.contains('hidden')).toBe(false);
        });

        it('sets the correct error message text', () => {
            showError('City not found.');
            expect(errorMessage.textContent).toBe('City not found.');
        });

        it('hides the current weather section', () => {
            showError('City not found.');
            expect(currentWeatherSection.classList.contains('hidden')).toBe(true);
        });

        it('hides the forecast section', () => {
            showError('City not found.');
            expect(forecastSection.classList.contains('hidden')).toBe(true);
        });
    });

    // ── updateUnitButton ───────────────────────────────────────────
    describe('updateUnitButton()', () => {

        it('shows °F label when unit is metric', () => {
            unit = 'metric';
            updateUnitButton();
            expect(unitToggle.textContent).toBe('°F');
        });

        it('shows °C label when unit is imperial', () => {
            unit = 'imperial';
            updateUnitButton();
            expect(unitToggle.textContent).toBe('°C');
        });

        it('sets aria-label to Switch to Fahrenheit when metric', () => {
            unit = 'metric';
            updateUnitButton();
            expect(unitToggle.getAttribute('aria-label')).toBe('Switch to Fahrenheit');
        });

        it('sets aria-label to Switch to Celsius when imperial', () => {
            unit = 'imperial';
            updateUnitButton();
            expect(unitToggle.getAttribute('aria-label')).toBe('Switch to Celsius');
        });

        it('sets aria-pressed to false when metric (default)', () => {
            unit = 'metric';
            updateUnitButton();
            expect(unitToggle.getAttribute('aria-pressed')).toBe('false');
        });

        it('sets aria-pressed to true when imperial', () => {
            unit = 'imperial';
            updateUnitButton();
            expect(unitToggle.getAttribute('aria-pressed')).toBe('true');
        });
    });

    // ── applyTheme ─────────────────────────────────────────────────
    describe('applyTheme()', () => {

        it('sets data-theme to dark', () => {
            applyTheme('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('sets data-theme to light', () => {
            applyTheme('light');
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });

        it('sets dark background on body', () => {
            applyTheme('dark');
            expect(document.body.style.backgroundColor).toBe('rgb(15, 23, 42)');
        });

        it('sets light background on body', () => {
            applyTheme('light');
            expect(document.body.style.backgroundColor).toBe('rgb(245, 247, 250)');
        });

        it('updates button label to Light Mode when dark', () => {
            applyTheme('dark');
            expect(toggleBtn.textContent).toBe('Light Mode');
        });

        it('updates button label to Dark Mode when light', () => {
            applyTheme('light');
            expect(toggleBtn.textContent).toBe('Dark Mode');
        });

        it('sets aria-pressed to true when dark', () => {
            applyTheme('dark');
            expect(toggleBtn.getAttribute('aria-pressed')).toBe('true');
        });

        it('sets aria-pressed to false when light', () => {
            applyTheme('light');
            expect(toggleBtn.getAttribute('aria-pressed')).toBe('false');
        });

        it('persists theme to localStorage', () => {
            applyTheme('dark');
            expect(localStorage.getItem('theme')).toBe('dark');
        });
    });

    // ── getWmoCondition ────────────────────────────────────────────
    describe('getWmoCondition()', () => {

        it('returns clear sky for code 0', () => {
            expect(getWmoCondition(0).description).toBe('clear sky');
        });

        it('returns thunderstorm for code 95', () => {
            expect(getWmoCondition(95).description).toBe('thunderstorm');
        });

        it('returns correct icon for rain (code 61)', () => {
            expect(getWmoCondition(61).icon).toBe('10d');
        });

        it('returns unknown for an unrecognised code', () => {
            expect(getWmoCondition(999).description).toBe('unknown');
        });
    });

    // ── getWeather ─────────────────────────────────────────────────
    describe('getWeather()', () => {

        beforeEach(() => {
            jest.clearAllMocks();
            global.fetch = jest.fn();
        });

        it('does nothing when called with an empty string', async () => {
            await getWeather('   ');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('shows error when city is not found by geocoding', async () => {
            // Geocoding returns empty results
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ results: [] }),
            });

            errorMessage.classList.add('hidden');
            await getWeather('InvalidCityXYZ');

            expect(errorMessage.classList.contains('hidden')).toBe(false);
            expect(errorMessage.textContent).toMatch(/not found/i);
        });

        it('calls geocoding API with the city name', async () => {
            // First call: geocoding
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    results: [{ name: 'London', country: 'GB', latitude: 51.5, longitude: -0.1 }],
                }),
            });
            // Second call: weather
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    current: {
                        temperature_2m: 15,
                        relative_humidity_2m: 80,
                        apparent_temperature: 13,
                        weather_code: 0,
                        wind_speed_10m: 3.5,
                    },
                    daily: {
                        time: ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06'],
                        weather_code: [0, 1, 2, 3, 61, 80],
                        temperature_2m_max: [16, 17, 15, 14, 13, 12],
                        temperature_2m_min: [10, 11, 9, 8, 7, 6],
                    },
                }),
            });

            await getWeather('London');

            const geoCall = global.fetch.mock.calls[0][0];
            expect(geoCall).toContain('geocoding-api.open-meteo.com');
            expect(geoCall).toContain('London');
        });

        it('saves city to localStorage after a successful fetch', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    results: [{ name: 'Paris', country: 'FR', latitude: 48.8, longitude: 2.3 }],
                }),
            });
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    current: {
                        temperature_2m: 20,
                        relative_humidity_2m: 60,
                        apparent_temperature: 19,
                        weather_code: 1,
                        wind_speed_10m: 2.1,
                    },
                    daily: {
                        time: ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06'],
                        weather_code: [1, 2, 3, 0, 61, 80],
                        temperature_2m_max: [21, 20, 19, 22, 18, 17],
                        temperature_2m_min: [14, 13, 12, 15, 11, 10],
                    },
                }),
            });

            await getWeather('Paris');
            expect(localStorage.getItem('lastCity')).toBe('Paris');
        });
    });

}
const API_KEY = 'a2ed6acd213609ad23e86b3fb2196c02'; // Replace with your OpenWeatherMap Key
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// DOM Elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const errorMessage = document.getElementById('error-message');
const currentWeatherSection = document.getElementById('current-weather');
const forecastSection = document.getElementById('forecast-section');
const forecastGrid = document.getElementById('forecast-grid');

// Event Listeners
searchBtn.addEventListener('click', () => getWeather(cityInput.value));
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') getWeather(cityInput.value);
});

// Load last searched city on startup
window.addEventListener('load', () => {
    const lastCity = localStorage.getItem('lastCity');
    if (lastCity) getWeather(lastCity);
});

// Main Fetch Function
async function getWeather(city) {
    if (!city) return;
    
    try {
        errorMessage.classList.add('hidden');
        
        // 1. Fetch Current Weather
        const weatherRes = await fetch(`${BASE_URL}/weather?q=${city}&units=metric&appid=${API_KEY}`);
        if (!weatherRes.ok) throw new Error('City not found');
        const weatherData = await weatherRes.json();
        
        // 2. Fetch 5-Day Forecast
        const forecastRes = await fetch(`${BASE_URL}/forecast?q=${city}&units=metric&appid=${API_KEY}`);
        const forecastData = await forecastRes.json();

        // 3. Update UI
        updateCurrentWeather(weatherData);
        updateForecast(forecastData.list);
        
        // 4. Save to Local Storage
        localStorage.setItem('lastCity', city);
        
    } catch (error) {
        showError(error.message);
    }
}

function updateCurrentWeather(data) {
    // Reveal sections
    currentWeatherSection.classList.remove('hidden');
    forecastSection.classList.remove('hidden');

    document.getElementById('city-name').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('date').textContent = new Date().toLocaleDateString();
    document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}°C`;
    document.getElementById('description').textContent = data.weather[0].description;
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('wind-speed').textContent = `${data.wind.speed} m/s`;
    
    const iconCode = data.weather[0].icon;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

function updateForecast(forecastList) {
    forecastGrid.innerHTML = ''; // Clear previous data

    // Filter: OpenWeatherMap returns data every 3 hours. 
    // We want one entry per day, ideally around noon (12:00:00).
    const dailyForecasts = forecastList.filter(reading => reading.dt_txt.includes("12:00:00"));

    dailyForecasts.forEach(day => {
        const date = new Date(day.dt * 1000).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
        const temp = Math.round(day.main.temp);
        const icon = day.weather[0].icon;

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <p>${date}</p>
            <img src="https://openweathermap.org/img/wn/${icon}.png" alt="icon">
            <p>${temp}°C</p>
        `;
        forecastGrid.appendChild(card);
    });
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    currentWeatherSection.classList.add('hidden');
    forecastSection.classList.add('hidden');
}
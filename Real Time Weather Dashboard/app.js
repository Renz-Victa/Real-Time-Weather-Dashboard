const API_Key = "a2ed6acd213609ad23e86b3fb2196c02";

async function getWeather() {
    const city = document.getElementById("cityInput").value;
    if (!city) return alert ("Please enter a city");

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

    if (data.cod !== 200) {
        alert("City not found");
        return;
    }

document.getElementById("cityInput").textContent = data.name;
document.getElementById("temperature").textContent = Tempeprature =`${data.main.temp}`;
document.getElementById("description").textContent = Condition =`${data.weather[0].description}`;
document.getElementById("humidity").textContent = Humidity =`${data.main.humidity}%`;
document.getElementById("wind").textContent = WindSpeed =`${data.wind.speed}m/s`;

    
    } catch(error) {
        console.log(error);
        alert("Error fetch Weather Data");
 }
}

setInterval(getWeather, 300000);

navigator.geolocation.getCurrentPosition(position, {
    const: { latitude, longitude } = position.coords
});

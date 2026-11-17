import { useState } from 'react';
import './weather.css';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_CODES = {
  0: ['Clear sky', '☀'], 1: ['Mostly clear', '🌤'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁'],
  45: ['Fog', '🌫'], 48: ['Rime fog', '🌫'], 51: ['Light drizzle', '🌦'], 53: ['Drizzle', '🌦'], 55: ['Heavy drizzle', '🌧'],
  56: ['Freezing drizzle', '🌧'], 57: ['Freezing drizzle', '🌧'], 61: ['Light rain', '🌦'], 63: ['Rain', '🌧'], 65: ['Heavy rain', '🌧'],
  66: ['Freezing rain', '🌧'], 67: ['Freezing rain', '🌧'], 71: ['Light snow', '🌨'], 73: ['Snow', '❄'], 75: ['Heavy snow', '❄'],
  77: ['Snow grains', '❄'], 80: ['Rain showers', '🌦'], 81: ['Rain showers', '🌧'], 82: ['Heavy showers', '⛈'],
  85: ['Snow showers', '🌨'], 86: ['Heavy snow showers', '❄'], 95: ['Thunderstorm', '⛈'], 96: ['Thunderstorm with hail', '⛈'], 99: ['Thunderstorm with hail', '⛈']
};

const weatherFor = (code) => WEATHER_CODES[code] || ['Weather conditions', '🌤'];
const dayName = (date, options = { weekday: 'short' }) => new Intl.DateTimeFormat(undefined, options).format(new Date(date));
const formatTime = (date) => new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(date));

async function getForecast(place) {
  const geoResponse = await fetch(`${GEOCODING_URL}?name=${encodeURIComponent(place)}&count=1&language=en&format=json`);
  if (!geoResponse.ok) throw new Error('Could not search for that location. Please try again.');
  const geo = await geoResponse.json();
  const location = geo.results?.[0];
  if (!location) throw new Error('No matching place found. Try a city name.');

  const params = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max',
    timezone: 'auto',
    forecast_days: '7'
  });
  const forecastResponse = await fetch(`${FORECAST_URL}?${params}`);
  if (!forecastResponse.ok) throw new Error('Weather data is temporarily unavailable. Please try again.');
  return { location, forecast: await forecastResponse.json() };
}

function WeatherDashboard() {
  const [query, setQuery] = useState('');
  const [weather, setWeather] = useState(null);
  const [unit, setUnit] = useState('C');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPlace = async (place) => {
    if (!place.trim()) {
      setError('Enter a city or town to see its weather.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getForecast(place.trim());
      setWeather(result);
      setQuery(`${result.location.name}${result.location.country ? `, ${result.location.country}` : ''}`);
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong while loading weather.');
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not available in this browser. Search for a city instead.');
      return;
    }
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const params = new URLSearchParams({
          latitude: coords.latitude, longitude: coords.longitude,
          current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
          hourly: 'temperature_2m,precipitation_probability,weather_code',
          daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max',
          timezone: 'auto', forecast_days: '7'
        });
        const response = await fetch(`${FORECAST_URL}?${params}`);
        if (!response.ok) throw new Error('Weather data is temporarily unavailable.');
        const forecast = await response.json();
        setWeather({ location: { name: 'Your location', country: '' }, forecast });
        setQuery('Your location');
      } catch (requestError) {
        setError(requestError.message || 'Could not load local weather.');
      } finally {
        setLoading(false);
      }
    }, () => {
      setLoading(false);
      setError('Location permission was not granted. Search for a city instead.');
    }, { timeout: 10000 });
  };

  const convert = (value) => unit === 'C' ? Math.round(value) : Math.round((value * 9) / 5 + 32);
  const symbol = unit === 'C' ? '°C' : '°F';
  const current = weather?.forecast.current;
  const hourly = weather?.forecast.hourly;
  const daily = weather?.forecast.daily;
  const firstHour = hourly && Math.max(0, hourly.time.findIndex((time) => time >= current.time));
  const hourlyIndices = hourly ? Array.from({ length: 8 }, (_, index) => Math.min(firstHour + index * 2, hourly.time.length - 1)) : [];

  return (
    <div className="weather-app">
      <header className="weather-header">
        <a className="weather-brand" href="/" aria-label="Skycast home"><span className="weather-brand-icon">✦</span> skycast</a>
        <div className="weather-header-right"><span className="live-indicator"><i /> LIVE WEATHER</span><a className="medicine-link" href="/medicine">Medicine scanner ↗</a></div>
      </header>
      <main className="weather-main">
        <section className="weather-title-row">
          <div><p className="weather-kicker">YOUR WEATHER, AT A GLANCE</p><h1>Forecast for wherever.</h1><p className="weather-subtitle">Current conditions and the days ahead, all in one place.</p></div>
          <div className="unit-switch" aria-label="Temperature unit"><button className={unit === 'C' ? 'selected' : ''} onClick={() => setUnit('C')} aria-pressed={unit === 'C'}>°C</button><button className={unit === 'F' ? 'selected' : ''} onClick={() => setUnit('F')} aria-pressed={unit === 'F'}>°F</button></div>
        </section>
        <form className="weather-search" onSubmit={(event) => { event.preventDefault(); loadPlace(query); }}>
          <span className="search-icon">⌕</span><input aria-label="Search city" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a city or town…" /><button className="location-button" type="button" onClick={useMyLocation} title="Use my location" aria-label="Use my location">◎</button><button className="weather-search-submit" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Search'}</button>
        </form>
        {error && <div className="weather-error" role="alert">{error}</div>}

        {!weather ? <section className="weather-empty"><div className="empty-weather-art">☀</div><h2>Find your forecast</h2><p>Search for a place or use your location to get current conditions and a 7-day outlook.</p><div className="suggestion-row"><button onClick={() => loadPlace('London')}>London</button><button onClick={() => loadPlace('New York')}>New York</button><button onClick={() => loadPlace('Tokyo')}>Tokyo</button></div></section> : <>
          <section className="current-weather">
            <div className="current-weather-copy"><div className="place-line"><span className="place-pin">⌖</span><div><h2>{weather.location.name}</h2><p>{weather.location.admin1 ? `${weather.location.admin1}, ` : ''}{weather.location.country || 'Local forecast'}</p></div></div><p className="current-date">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(current.time))}</p><div className="temp-line"><span>{convert(current.temperature_2m)}°</span><span className="temp-unit">{symbol}</span></div><p className="condition-line">{weatherFor(current.weather_code)[0]} <span>·</span> Feels like {convert(current.apparent_temperature)}{symbol}</p></div>
            <div className="current-weather-art"><span className="weather-big-icon" aria-hidden="true">{weatherFor(current.weather_code)[1]}</span><div className="sun-glow" /></div>
            <div className="weather-metrics"><div className="metric"><span className="metric-icon">💧</span><div><small>Humidity</small><b>{current.relative_humidity_2m}%</b></div></div><div className="metric"><span className="metric-icon">🌬</span><div><small>Wind speed</small><b>{Math.round(current.wind_speed_10m)} km/h</b></div></div><div className="metric"><span className="metric-icon">☔</span><div><small>Precipitation</small><b>{current.precipitation} mm</b></div></div><div className="metric"><span className="metric-icon">☀</span><div><small>UV index</small><b>{daily.uv_index_max[0]}</b></div></div></div>
          </section>
          <section className="forecast-section"><div className="section-heading"><div><p className="weather-kicker">PLAN YOUR DAY</p><h2>Today, by the hour</h2></div><span className="section-caption">Next 16 hours</span></div><div className="hourly-list">{hourlyIndices.map((index) => <article className="hour-item" key={hourly.time[index]}><span className="hour-time">{index === firstHour ? 'Now' : formatTime(hourly.time[index])}</span><span className="hour-icon">{weatherFor(hourly.weather_code[index])[1]}</span><b>{convert(hourly.temperature_2m[index])}°</b><small>☂ {hourly.precipitation_probability[index]}%</small></article>)}</div></section>
          <section className="forecast-section weekly-section"><div className="section-heading"><div><p className="weather-kicker">THE WEEK AHEAD</p><h2>7-day forecast</h2></div><span className="section-caption">Daily outlook</span></div><div className="daily-list">{daily.time.map((date, index) => <article className="day-row" key={date}><span className="day-name">{index === 0 ? 'Today' : dayName(date)}</span><span className="day-icon">{weatherFor(daily.weather_code[index])[1]}</span><span className="day-description">{weatherFor(daily.weather_code[index])[0]}</span><span className="day-low">{convert(daily.temperature_2m_min[index])}°</span><div className="temp-range"><i style={{ left: `${Math.min(100, Math.max(0, (daily.temperature_2m_min[index] + 10) * 2))}%`, width: `${Math.max(14, Math.min(72, (daily.temperature_2m_max[index] - daily.temperature_2m_min[index]) * 2.5))}%` }} /></div><b className="day-high">{convert(daily.temperature_2m_max[index])}°</b><span className="day-rain">☂ {Math.round(hourly.precipitation_probability.slice(index * 24, (index + 1) * 24).reduce((max, value) => Math.max(max, value || 0), 0))}%</span></article>)}</div></section>
        </>}
      </main>
      <footer className="weather-footer"><span>Skycast weather dashboard</span><span>Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Free public API, no API key needed</span></footer>
    </div>
  );
}

export default WeatherDashboard;

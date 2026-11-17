# Skycast Weather Dashboard

A responsive weather dashboard built with React and Vite. The default route (`/`) searches for a city or uses the browser's optional location permission, then displays current conditions, an 8-point hourly outlook, and a 7-day forecast.

Weather data is fetched live from the public [Open-Meteo geocoding and forecast APIs](https://open-meteo.com/), with no API key required. The dashboard includes Celsius/Fahrenheit conversion, precipitation chances, humidity, wind, UV index, loading and error states, and a mobile-friendly layout. The existing medicine-scanner prototype remains available at `/medicine`.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production build with `npm run build`.

## Deploy to Netlify

- Build command: `npm run build`
- Publish directory: `dist`

## Data and privacy

City searches are sent to Open-Meteo to find coordinates, then coordinates are used to fetch forecast data. Using the location button asks the browser for permission and sends the coordinates to Open-Meteo. The app does not store a location profile. Forecasts are informational and may be delayed or incomplete; check local official weather alerts for safety-critical decisions.

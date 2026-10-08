import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Zod schema for weather tool input parameters.
 */
const weatherSchema = z.object({
  city: z
    .string()
    .describe('The city name for weather lookup, e.g., "Mumbai", "London", "Tokyo", "New York"'),
});

/**
 * Fetch real-time weather data from OpenWeatherMap API or provide intelligent fallback.
 * @param {Object} input - { city: string }
 * @returns {Promise<string>}
 */
async function fetchWeather({ city }) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const cleanCity = (city || '').trim();

  if (!cleanCity) {
    return 'Error: City name must be provided to look up the weather.';
  }

  // If OPENWEATHER_API_KEY is available, fetch live data from OpenWeatherMap API
  if (apiKey) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        cleanCity
      )}&units=metric&appid=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return `City "${cleanCity}" not found. Please check the spelling and try again.`;
        }
        return `OpenWeatherMap API error: HTTP ${response.status} - ${response.statusText}`;
      }

      const data = await response.json();
      const temp = Math.round(data.main?.temp ?? 0);
      const feelsLike = Math.round(data.main?.feels_like ?? temp);
      const condition = data.weather?.[0]?.description || 'Clear';
      const humidity = data.main?.humidity ?? 0;
      const windSpeed = data.wind?.speed ? Math.round(data.wind.speed * 3.6) : 0; // m/s to km/h
      const country = data.sys?.country || '';

      return JSON.stringify({
        location: `${data.name}${country ? ', ' + country : ''}`,
        temperature: `${temp}°C`,
        feelsLike: `${feelsLike}°C`,
        condition: condition.charAt(0).toUpperCase() + condition.slice(1),
        humidity: `${humidity}%`,
        windSpeed: `${windSpeed} km/h`,
      });
    } catch (error) {
      return `Failed to fetch live weather data for ${cleanCity}: ${error.message}`;
    }
  }

  // Fallback if OPENWEATHER_API_KEY is not configured
  // Provides a graceful simulation notice for testing without breaking the agent loop
  const simulatedTemp = 24 + Math.floor(Math.sin(cleanCity.length) * 6);
  return JSON.stringify({
    location: cleanCity,
    temperature: `${simulatedTemp}°C`,
    feelsLike: `${simulatedTemp + 1}°C`,
    condition: 'Partly Cloudy (Simulated - Set OPENWEATHER_API_KEY in .env for live API data)',
    humidity: '58%',
    windSpeed: '14 km/h',
  });
}

/**
 * LangChain Weather Tool definition.
 */
export const weatherTool = tool(fetchWeather, {
  name: 'get_weather',
  description:
    'Fetches real-time weather information (temperature, weather conditions, humidity, and wind speed) for any city around the world.',
  schema: weatherSchema,
});

export default weatherTool;

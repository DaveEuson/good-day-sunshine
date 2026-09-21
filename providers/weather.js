// Open-Meteo: no key. Location from cfg.lat/lon, cfg.city (geocoded), or IP fallback.
export const meta = { title: "Weather", icon: "☀" };

const WMO = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Thunderstorm, hail", 99: "Thunderstorm, hail" };

let loc = null;
async function locate(cfg) {
  if (cfg.lat != null && cfg.lon != null) return { lat: cfg.lat, lon: cfg.lon, name: cfg.label ?? `${cfg.lat},${cfg.lon}` };
  if (loc) return loc;
  if (cfg.city) {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cfg.city)}&count=1`);
    const g = (await r.json()).results?.[0];
    if (!g) throw new Error(`City "${cfg.city}" not found`);
    return (loc = { lat: g.latitude, lon: g.longitude, name: `${g.name}, ${g.country_code}` });
  }
  const r = await fetch("http://ip-api.com/json/?fields=lat,lon,city");
  const j = await r.json();
  return (loc = { lat: j.lat, lon: j.lon, name: j.city });
}

export async function fetchData(cfg) {
  const l = await locate(cfg);
  const unit = cfg.units === "f" ? "fahrenheit" : "celsius";
  const sym = cfg.units === "f" ? "°F" : "°C";
  const q = `latitude=${l.lat}&longitude=${l.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=3&temperature_unit=${unit}`;
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!r.ok) throw new Error(`open-meteo → ${r.status}`);
  const w = await r.json();
  const c = w.current, d = w.daily;
  const day = (i) => new Date(d.time[i] + "T12:00").toLocaleDateString(undefined, { weekday: "short" });

  return {
    title: `Weather · ${l.name}`,
    stats: [
      { label: WMO[c.weather_code] ?? "—", value: `${Math.round(c.temperature_2m)}${sym}`, sub: `feels ${Math.round(c.apparent_temperature)}${sym}` },
      { label: "High / Low", value: `${Math.round(d.temperature_2m_max[0])} / ${Math.round(d.temperature_2m_min[0])}` },
      { label: "Rain chance", value: `${d.precipitation_probability_max[0]}%` },
      { label: "Wind", value: `${Math.round(c.wind_speed_10m)} km/h` },
    ],
    items: [1, 2].map((i) => ({
      text: `${day(i)} · ${WMO[d.weather_code[i]] ?? ""}`,
      badge: `${Math.round(d.temperature_2m_max[i])} / ${Math.round(d.temperature_2m_min[i])} · ${d.precipitation_probability_max[i]}%`,
    })),
  };
}

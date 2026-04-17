const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/competitors', async (req, res) => {
  const { city, brand } = req.query;
  if (!city || !brand) return res.json({ results: [] });

  try {
    // Step 1: Geocode the city to get lat/lng
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
    const geoRes = await fetch(geoUrl, { headers: { 'User-Agent': 'ViniTool/1.0' } });
    const geoData = await geoRes.json();

    if (!geoData || geoData.length === 0) {
      console.log('Geocoding failed for:', city);
      return res.json({ results: [] });
    }

    const lat = geoData[0].lat;
    const lon = geoData[0].lon;
    console.log(`City: ${city} → lat:${lat}, lon:${lon}`);

    // Step 2: Search for car dealers near that location using Overpass API
    const radius = 80000; // 80km radius
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["shop"="car"]["name"~"${brand}",i](around:${radius},${lat},${lon});
        way["shop"="car"]["name"~"${brand}",i](around:${radius},${lat},${lon});
        node["shop"="car_dealer"]["name"~"${brand}",i](around:${radius},${lat},${lon});
        way["shop"="car_dealer"]["name"~"${brand}",i](around:${radius},${lat},${lon});
      );
      out center 8;
    `;

    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const overpassRes = await fetch(overpassUrl, {
      method: 'POST',
      body: overpassQuery,
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'ViniTool/1.0' }
    });
    const overpassData = await overpassRes.json();

    console.log(`Overpass results: ${overpassData.elements ? overpassData.elements.length : 0}`);

    if (overpassData.elements && overpassData.elements.length > 0) {
      const results = overpassData.elements
        .filter(e => e.tags && e.tags.name)
        .slice(0, 6)
        .map((e, i) => ({
          name: e.tags.name,
          address: [e.tags['addr:city'], e.tags['addr:state']].filter(Boolean).join(', ') || city,
          rating: null,
          threat: i < 2 ? 'threat' : 'watch'
        }));

      if (results.length > 0) {
        console.log('Found dealers:', results.map(r => r.name).join(', '));
        return res.json({ results });
      }
    }

    // Step 3: Broader fallback — search any car dealer near city
    const fallbackQuery = `
      [out:json][timeout:25];
      (
        node["shop"="car"](around:${radius},${lat},${lon});
        way["shop"="car"](around:${radius},${lat},${lon});
        node["shop"="car_dealer"](around:${radius},${lat},${lon});
        way["shop"="car_dealer"](around:${radius},${lat},${lon});
      );
      out center 8;
    `;

    const fallbackRes = await fetch(overpassUrl, {
      method: 'POST',
      body: fallbackQuery,
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'ViniTool/1.0' }
    });
    const fallbackData = await fallbackRes.json();
    console.log(`Fallback results: ${fallbackData.elements ? fallbackData.elements.length : 0}`);

    if (fallbackData.elements && fallbackData.elements.length > 0) {
      const results = fallbackData.elements
        .filter(e => e.tags && e.tags.name)
        .slice(0, 6)
        .map((e, i) => ({
          name: e.tags.name,
          address: [e.tags['addr:city'], e.tags['addr:state']].filter(Boolean).join(', ') || city,
          rating: null,
          threat: i < 2 ? 'threat' : 'watch'
        }));

      if (results.length > 0) {
        return res.json({ results });
      }
    }

    res.json({ results: [] });
  } catch(e) {
    console.log('Error:', e.message);
    res.json({ results: [], error: e.message });
  }
});

app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('No URL');
  try {
    const response = await fetch(decodeURIComponent(url), {
      headers: { 'User-Agent': 'ViniTool/1.0' }
    });
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.body.pipe(res);
  } catch(e) {
    res.status(500).send('Image fetch failed');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`VINI Tool running on port ${PORT}`));

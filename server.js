const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const GOOGLE_KEY = process.env.GOOGLE_API_KEY;

app.get('/api/competitors', async (req, res) => {
  const { city, brand } = req.query;
  if (!city || !brand) return res.json({ results: [] });
  try {
    const query = encodeURIComponent(`${brand} dealership near ${city}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&type=car_dealer&key=${GOOGLE_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'OK' && data.results) {
      const results = data.results.slice(0, 6).map((p, i) => ({
        name: p.name,
        address: (p.formatted_address || '').split(',').slice(0, 2).join(',').trim(),
        rating: p.rating || null,
        threat: i < 2 ? 'threat' : 'watch'
      }));
      return res.json({ results });
    }
    res.json({ results: [], status: data.status });
  } catch(e) {
    res.json({ results: [], error: e.message });
  }
});

app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('No URL');
  try {
    const response = await fetch(decodeURIComponent(url));
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

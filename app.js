const express = require('express');
const ee = require('@google/earthengine');
const fs = require('fs');

const app = express();

// Load private key JSON
const privateKey = JSON.parse(fs.readFileSync('./private-key.json', 'utf8'));

// Initialize Earth Engine with the private key
ee.data.authenticateViaPrivateKey(privateKey, () => {
    console.log('Authenticated with Earth Engine');
    ee.initialize();
}, (error) => {
    console.error('Authentication failed:', error);
});

// Serve static files from the 'public' directory
app.use(express.static('public'));

app.get('/soil-moisture-data', (req, res) => {
    const { latitude, longitude } = req.query;

    // Define a point around which to display the map (latitude, longitude)
    const point = ee.Geometry.Point([parseFloat(longitude), parseFloat(latitude)]);

    // Create a region around the point (e.g., 100 km buffer)
    const region = point.buffer(100000); // 100 km buffer around the point

    const dataset = ee.ImageCollection('MODIS/061/MOD16A2GF')
                      .select('ET')
                      .filterDate('2023-09-03', '2024-10-03')
                      .mean();
                      //.clip(region);

    let stats = dataset.reduceRegion({
        reducer: ee.Reducer.minMax(), // Calculate min and max
        geometry: region,
        scale: 500, // Adjust scale as needed (in meters)
        maxPixels: 1e9 // Increase if needed
    });

    const visParams = {
        min: stats.get('ET_min'), // Minimum value of ET (in mm/day)
        max: stats.get('ET_max'), // Maximum value of ET (in mm/day) - adjust based on your data range
        palette: ['blue', 'green', 'yellow', 'orange', 'red'] // Palette for low to high ET values
    };

    // Use getMapId to obtain mapId and token
    const mapIdObject = dataset.getMapId(visParams);
    const tileUrl = mapIdObject.urlFormat;

    // Respond with the tile URL
    res.json({ url: tileUrl });
});

app.listen(3000, () => {
    console.log('App running on http://localhost:3000');
});

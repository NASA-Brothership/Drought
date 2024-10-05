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

    const start_date = '2023-10-03'
    const end_date = '2024-10-03'

    const ET = ee.ImageCollection('MODIS/061/MOD16A2GF')
                      .filterDate(start_date, end_date)
                      .select('ET')
                      .mean()
                      .clip(region);

    const precipitation = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
                      .filterDate(start_date, end_date)
                      .select('precipitation')
                      .mean()
                      .clip(region);

    // Calculate the Water Balance Index (WBI)
    let waterBalanceIndex = ET.subtract(precipitation).rename('WBI');

    let waterBalanceIndex_stats = waterBalanceIndex.reduceRegion({
        reducer: ee.Reducer.percentile([2, 98]), // Calculate min and max
        geometry: region,
        scale: 5566, // Adjust scale as needed (in meters)
        maxPixels: 1e9 // Increase if needed
    });

    const visParams = {
        min: waterBalanceIndex_stats.get('WBI_p2'), // Minimum value of WBI (in mm/day)
        max: waterBalanceIndex_stats.get('WBI_p98'), // Maximum value of WBI (in mm/day) - adjust based on your data range
        palette: ['red', 'white', 'blue'] // Palette for low to high WBI values
    };

    // Use getMapId to obtain mapId and token
    const mapIdObject = ET.getMapId(visParams);
    const tileUrl = mapIdObject.urlFormat;

    // Respond with the tile URL
    res.json({ url: tileUrl });
});

app.listen(3000, () => {
    console.log('App running on http://localhost:3000');
});

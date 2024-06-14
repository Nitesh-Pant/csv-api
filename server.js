const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const cors = require('cors');
const { parseISO, differenceInDays, addDays, format } = require('date-fns');
const app = express();
const PORT = 3001;

app.use(cors());

let data = [];

// Function to read CSV file and store data in memory
function readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                results.push(row);
            })
            .on('end', () => {
                resolve(results);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// Load CSV data into memory
readCSVFile('data.csv')
    .then((csvData) => {
        data = csvData;
        console.log('CSV file successfully processed');
    })
    .catch((error) => {
        console.error('Error reading CSV file:', error);
    });

// Define a basic route
app.get('/', (req, res) => {
    res.send('Welcome to the CSV API');
});

// API to get all data
app.get('/api/data', (req, res) => {
    res.json(data);
});

// API to get data by brand
app.get('/api/data/brand/:brand', (req, res) => {
    const brand = req.params.brand;
    const filteredData = data.filter(item => item.brand === brand);
    res.json(filteredData);
});

// API to get data by product type
app.get('/api/data/product_type/:product_type', (req, res) => {
    const productType = req.params.product_type;
    const filteredData = data.filter(item => item.product_type === productType);
    res.json(filteredData);
});

// API to get count of condition grouped by date (10-day intervals)
app.get('/api/data/condition/:condition', (req, res) => {
    const condition = req.params.condition;
    const filteredData = data.filter(item => item.condition === condition);
    const groupedData = {};

    filteredData.forEach(item => {
        const date = parseISO(item.timestamp);
        const startDate = addDays(date, -differenceInDays(date, new Date(0)) % 10);
        const formattedDate = format(startDate, 'yyyy-MM-dd');

        if (!groupedData[formattedDate]) {
            groupedData[formattedDate] = 0;
        }
        groupedData[formattedDate]++;
    });

    const labels = Object.keys(groupedData).sort();
    const values = labels.map(label => groupedData[label]);

    const response = {
        label: labels,
        val: values
    };

    res.json(response);
});


// API to get average price of condition grouped by date (10-day intervals)
app.get('/api/data/condition/average-price/:condition', (req, res) => {
    const condition = req.params.condition;
    const filteredData = data.filter(item => item.condition === condition);
    const groupedData = {};

    filteredData.forEach(item => {
        const date = parseISO(item.timestamp);
        const startDate = addDays(date, -differenceInDays(date, new Date(0)) % 10);
        const formattedDate = format(startDate, 'yyyy-MM-dd');

        if (!groupedData[formattedDate]) {
            groupedData[formattedDate] = {
                count: 0,
                totalPrice: 0
            };
        }

        groupedData[formattedDate].count++;
        groupedData[formattedDate].totalPrice += parseFloat(item.price.replace(' USD', '').replace(',', ''));
    });

    const labels = Object.keys(groupedData).sort();
    const prices = labels.map(label => {
        const averagePrice = groupedData[label].totalPrice / groupedData[label].count;
        return parseFloat(averagePrice.toFixed(2));
    });

    const response = {
        label: labels,
        avgPrice: prices
    };

    res.json(response);
});

// API to get date-wise average prices and inventory count for new condition with pagination
app.get('/api/data/avg-prices-by-date', (req, res) => {
    const { page = 1, limit = 5 } = req.query;
    const filteredData = {
        new: []
    };

    // Assuming 'data' is your dataset
    data.forEach(item => {
        const condition = item.condition.toLowerCase();
        const date = parseISO(item.timestamp);
        const formattedDate = format(date, 'yyyy-MM-dd');

        if (condition === 'new') {
            filteredData[condition].push({
                date: formattedDate,
                price: parseFloat(item.price.replace(' USD', '').replace(',', ''))
            });
        }
    });

    const dates = [...new Set(data.map(item => format(parseISO(item.timestamp), 'yyyy-MM-dd')))];
    dates.sort();

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const paginatedDates = dates.slice(startIndex, endIndex);

    const result = paginatedDates.map(date => {
        const newPrices = filteredData.new.filter(item => item.date === date).map(item => item.price);

        return {
            date: date,
            newAvgPrice: calculateAverage(newPrices),
            newInventoryCount: newPrices.length
        };
    });

    res.json(result);
});


// API to get total statistics for new, used, and cpo conditions
app.get('/api/data/total-stats', (req, res) => {
    const stats = {
        newCount: 0,
        usedCount: 0,
        cpoCount: 0,
        newMsrp: 0,
        usedMsrp: 0,
        cpoMsrp: 0
    };

    // Assuming 'data' is your dataset
    data.forEach(item => {
        const condition = item.condition.toLowerCase();
        const price = parseFloat(item.price.replace(' USD', '').replace(',', ''));

        switch (condition) {
            case 'new':
                stats.newCount++;
                stats.newMsrp += price;
                break;
            case 'used':
                stats.usedCount++;
                stats.usedMsrp += price;
                break;
            case 'cpo':
                stats.cpoCount++;
                stats.cpoMsrp += price;
                break;
            default:
                break;
        }
    });

    // Calculate average prices
    if (stats.newCount > 0) {
        stats.newMsrp /= stats.newCount;
    }
    if (stats.usedCount > 0) {
        stats.usedMsrp /= stats.usedCount;
    }
    if (stats.cpoCount > 0) {
        stats.cpoMsrp /= stats.cpoCount;
    }

    res.json(stats);
});


// Helper function to calculate average
function calculateAverage(prices) {
    if (prices.length === 0) return 0;
    const sum = prices.reduce((acc, curr) => acc + curr, 0);
    return parseFloat((sum / prices.length).toFixed(2));
}


// Helper function to calculate average
function calculateAverage(prices) {
    if (prices.length === 0) return 0;
    const sum = prices.reduce((acc, curr) => acc + curr, 0);
    return parseFloat((sum / prices.length).toFixed(2));
}


// Helper function to calculate average
function calculateAverage(prices) {
    if (prices.length === 0) return 0;
    const sum = prices.reduce((acc, curr) => acc + curr, 0);
    return parseFloat((sum / prices.length).toFixed(2));
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

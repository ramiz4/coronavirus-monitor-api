var express = require('express');
var cors = require('cors');
var https = require('https');

var app = express();
var PORT = process.env.PORT || 3000;
var url = 'https://raw.githubusercontent.com/ramiz4/coronavirus-monitor-data/master/rks.json';

app.use(cors());

app.get('/data', function (req, res) {
    https.get(url, function (resp) {
        var data = '';

        // A chunk of data has been recieved.
        resp.on('data', function (chunk) {
            data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', function () {
            res.send(data);
        });

    }).on("error", function (err) {
        console.log("Error: " + err.message);
        res.err("Error: " + err.message);
    });
});

app.get('/google-maps-data', function (req, res) {
    https.get(url, function (resp) {
        var data = '';

        // A chunk of data has been recieved.
        resp.on('data', function (chunk) {
            data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', function () {
            var stats = JSON.parse(data);

            var cityMap = [];
            var tempCityMap = {};

            stats.forEach(stat => {
                stat.confirmed.forEach(x => {
                    if (!tempCityMap.hasOwnProperty(x.city)) {
                        tempCityMap[x.city] = {};
                        tempCityMap[x.city].data = [];
                    }
                    tempCityMap[x.city].data.push(x);
                    tempCityMap[x.city].label = x.city;

                    // ex. for Ferizaj https://maps.googleapis.com/maps/api/geocode/json?address=Ferizaj&key=AIzaSyBJcXftvGs8DpYqYS87wn14gzoeRWxIczg
                    // tempCityMap[x.city].center = { lat: 42.662914, lng: 21.165503 };
                    tempCityMap[x.city].center = x.location; // await this.statsService.getGeocode(x.city).toPromise();
                    tempCityMap[x.city].confirmedTotal = tempCityMap[x.city].data.reduce((a, b) => a + (b.total || 0), 0);
                });
            });

            Object.keys(tempCityMap).forEach(key => {
                delete tempCityMap[key].data;
                cityMap.push(
                    {
                        label: tempCityMap[key].label,
                        center: tempCityMap[key].center,
                        confirmedTotal: tempCityMap[key].confirmedTotal
                    }
                );
            });

            res.send(cityMap);
        });

    }).on("error", function (err) {
        console.log("Error: " + err.message);
        res.err("Error: " + err.message);
    });
});

app.listen(PORT, function () {
    console.log(`Listening on port ${PORT}`);
});

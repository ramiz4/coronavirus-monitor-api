var express = require('express');
var cors = require('cors');
var https = require('https');

var app = express();
var PORT = process.env.PORT || 3000;
var url = 'https://raw.githubusercontent.com/ramiz4/coronavirus-monitor/master/src/assets/rks.json';

var whitelist = ['http://localhost:4200', 'http://corona-monitor.ramizloki.com/'];
var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions));

app.get('/', function (req, res) {
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

app.listen(PORT, function () {
  console.log(`Listening on port ${ PORT }`);
});

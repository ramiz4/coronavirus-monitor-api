var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var https = require('https');
var MongoClient = require('mongodb').MongoClient;
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');

var config = require('./config');
// var VerifyToken = require('./auth/VerifyToken');

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

var PORT = process.env.PORT || 3000;
var MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/corona-monitor';
var MONGO_DB = process.env.MONGODB || 'corona-monitor';

var client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

var dataCollection;
var userCollection;

client.connect()
    .then(function (client) {
        console.log('Connected to Database');
        var db = client.db(MONGO_DB);
        dataCollection = db.collection('data');
        userCollection = db.collection('user');
    })
    .catch(function (error) {
        console.log('Cannot connect to ' + MONGO_URI);
        console.error(error);
    });

function getCityMap(data) {

    var cityMap = [];
    var tempCityMap = {};

    data.forEach(function (stat) {
        stat.confirmed.forEach(function (x) {
            if (x.city) {
                if (!tempCityMap.hasOwnProperty(x.city)) {
                    tempCityMap[x.city] = {};
                    tempCityMap[x.city].data = [];
                }
                tempCityMap[x.city].data.push(x);
                tempCityMap[x.city].label = x.city;

                // ex. for Ferizaj https://maps.googleapis.com/maps/api/geocode/json?address=Ferizaj&key=AIzaSyBJcXftvGs8DpYqYS87wn14gzoeRWxIczg
                // tempCityMap[x.city].center = { lat: 42.662914, lng: 21.165503 };
                tempCityMap[x.city].center = x.location;
                tempCityMap[x.city].confirmedTotal = tempCityMap[x.city].data.reduce(function (a, b) {
                    return a + (b.total || 0);
                }, 0);
            }
        });
    });

    Object.keys(tempCityMap).forEach(function (key) {
        delete tempCityMap[key].data;
        cityMap.push(
            {
                label: tempCityMap[key].label,
                center: tempCityMap[key].center,
                confirmedTotal: tempCityMap[key].confirmedTotal
            }
        );
    });

    cityMap.sort(function (a, b) {
        var nameA = a.label.toUpperCase(); // Groß-/Kleinschreibung ignorieren
        var nameB = b.label.toUpperCase(); // Groß-/Kleinschreibung ignorieren
        if (nameA < nameB) {
            return -1;
        }
        if (nameA > nameB) {
            return 1;
        }

        // Namen müssen gleich sein
        return 0;
    });

    return cityMap;
}

app.use(function (req, res, next) {
    console.log('Time:', Date.now());
    if (!client.isConnected()) {
        return res.status(500).send({ message: 'Database is not connected.' });
    }
    next();
});

app.post('/users/register', function (req, res) {

    res.status(200).send("registration is disabled.");

    // var hashedPassword = bcrypt.hashSync(req.body.password, 8);

    // var newUser = {
    //     name: req.body.name,
    //     email: req.body.email,
    //     password: hashedPassword
    // };

    // userCollection.insert(newUser)
    //     .then(function (result) {
    //         console.log(result);
    //         var token = jwt.sign({ id: result._id }, config.secret, {
    //             expiresIn: 86400 // expires in 24 hours
    //         });
    //         res.status(200).send({ auth: true, token: token });
    //     })
    //     .catch(function (error) {
    //         console.error(error);
    //         res.status(500).send("Error: " + error.message);
    //     });
});

app.post('/users/authenticate', function (req, res) {
    userCollection.findOne({ email: req.body.email }, function (err, user) {
        if (err) return res.status(500).send('Error on the server.');
        if (!user) return res.status(404).send('No user found.');

        var passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
        if (!passwordIsValid) return res.status(401).send({ auth: false, token: null });

        var token = jwt.sign({ id: user._id }, config.secret, {
            expiresIn: 86400 // expires in 24 hours
        });

        delete user.password;
        res.status(200).send({ user: user, auth: true, token: token });
    });
});

app.get('/users/logout', function (req, res) {
    res.status(200).send({ auth: false, token: null });
});

// app.get('/users/me', VerifyToken, function (req, res, next) {
//     userCollection.findById(req.userId, { password: 0 }, function (err, user) {
//         if (err) return res.status(500).send("There was a problem finding the user.");
//         if (!user) return res.status(404).send("No user found.");
//         res.status(200).send(user);
//     });
// });

app.get('/data', function (req, res) {
    dataCollection.find().sort({ date: 1 }).toArray()
        .then(function (results) {
            console.log(results);
            var confirmedCumulated = 0;
            var recoveredCumulated = 0;
            var deathsCumulated = 0;

            results.forEach(function (result) {
                var confirmed = result.confirmed.map(x => x.total);
                if (confirmed && confirmed.length > 0) {
                    result.confirmedTotal = confirmed.reduce((a, b) => a + b);
                } else {
                    result.confirmedTotal = 0;
                }
                confirmedCumulated += result.confirmedTotal;
                result.confirmedCumulated = confirmedCumulated;

                var recovered = result.recovered.map(x => x.total);
                if (recovered && recovered.length > 0) {
                    result.recoveredTotal = recovered.reduce((a, b) => a + b);
                } else {
                    result.recoveredTotal = 0;
                }
                recoveredCumulated += result.recoveredTotal;
                result.recoveredCumulated = recoveredCumulated;

                var deaths = result.deaths.map(x => x.total);
                if (deaths && deaths.length > 0) {
                    result.deathsTotal = deaths.reduce((a, b) => a + b);
                } else {
                    result.deathsTotal = 0;
                }
                deathsCumulated += result.deathsTotal;
                result.deathsCumulated = deathsCumulated;

                result.confirmed.sort(function (a, b) { return b.total - a.total; });
                result.recovered.sort(function (a, b) { return b.total - a.total; });
                result.deaths.sort(function (a, b) { return b.total - a.total; });
            });
            res.send(results);
        })
        .catch(function (error) {
            console.error(error);
            res.status(500).send("Error: " + error.message);
        });
});

app.get('/google-maps-data', function (req, res) {
    dataCollection.find().toArray()
        .then(function (results) {
            console.log(results);
            var cityMap = getCityMap(results);
            res.send(cityMap);
        })
        .catch(function (error) {
            console.error(error);
            res.status(500).send("Error: " + error.message);
        });
});

/**
 * add on or more data
 * body as json
    {
        "date": "xxxx-xx-xx",
        "confirmed": [],
        "deaths": [],
        "recovered": []
    }
 */
app.post('/data', function (req, res) {

    var token = req.headers.authorization;

    if (!token) {
        return res.status(401).send({ auth: false, message: 'No token provided.' });
    }

    jwt.verify(token, config.secret, function (err, decoded) {
        if (err) return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });

        var insert;
        if (Array.isArray(req.body)) {
            insert = dataCollection.insertMany(req.body);
        } else {
            insert = dataCollection.insert(req.body);
        }

        insert
            .then(function (results) {
                console.log(results);
                // res.status(200).send(decoded);
                res.status(204).send();
            })
            .catch(function (error) {
                console.error(error);
                res.status(500).send("Error: " + error.message);
            });
    });

});

app.delete('/data', function (req, res) {
    res.status(200).send("delete all data is disabled.");

    // delete all documents
    // dataCollection.deleteMany()
    //     .then(function (results) {
    //         console.log(results);
    //         res.status(204).send();
    //     })
    //     .catch(function (error) {
    //         console.error(error);
    //         res.status(500).send("Error: " + error.message);
    //     });
});

app.listen(PORT, function () {
    console.log('Listening on port ' + PORT);
});

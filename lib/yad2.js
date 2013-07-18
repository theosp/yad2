var data = require('./data/data.js'),
    cities_neighborhood = data.cities_neighborhood,
    cities = Object.keys(cities_neighborhood),
    letters = data.letters;

var get_ascii_buffer = function (value) {
    var value_b = new Buffer(value, "ascii");

    for (var i = 0; i < value_b.length; i++) {
        if (value_b[i] >= 208) {
            value_b[i] += 16;
        }
    }

    return value_b;
}

var x_www_form_urlencoder = function (value) {
    var value_b = get_ascii_buffer(value);

    for (var i = 0; i < value_b.length; i++) {
        if (value_b[i] == 32) {
            // space to +
            value_b[i] = 43;
        }
    }

    var value_hex = value_b.toString("hex"),
        value_ascii = value_b.toString("ascii");

    var output = "";
    for (var i = 0; i < value_b.length; i++) {
        if (value_b[i] < 224) {
            output += value_ascii[i];
            
        } else {
            output += "%" + value_hex.slice(i * 2, i * 2 + 2);
        }
    }

    return output;
}

var ascii_decimal_encoder = function (value) {
    var value_b = get_ascii_buffer(value);

    return value_b.toJSON().map(function (i) {
            if (i === 32) {
                return "%20";
            }

            return "" + i; 
        }).join("");
}

var neighborhood_suggestor_url_generator = function (city, chars) {
    chars = ascii_decimal_encoder(chars);
    city = ascii_decimal_encoder(city);

    return "http://www.yad2.co.il/ajax/nhood_autocomplete.php?AreaID=&q=" + chars + "&City=" + city;
}

var http = require('http');
var url = require('url');
var Iconv  = require('iconv').Iconv;
var iconv = new Iconv('windows-1255', 'UTF-8');
var get_neighborhood_names_by_suggestions_api = function () {
    var names = {};
    var time_between_requests = 1000;

    for (var i = 0; i < cities.length; i++) {
        var city = cities[i];
        names[city] = {};

        (function (city, i) {
            setTimeout(function () {
                for (var j = 0; j < letters.length; j++) {
                    var letter = letters[j];

                    (function (letter, j) {
                        setTimeout(function () {
                            http.get(url.parse(neighborhood_suggestor_url_generator(city, letter)), function (res) {
                                var output = '';

                                res.on("data", function (chunk) {
                                    output += iconv.convert(chunk).toString("utf-8");
                                });

                                res.on("end", function () {
                                    output = output.replace(/<.*?>/g, "")

                                    var line_by_line = output.split("\n");

                                    for (var k = 0; k < line_by_line.length; k++) {
                                        var name = line_by_line[k].trim();
                                        
                                        if (name.length > 0) {
                                            names[city][name] = true;
                                        }
                                    }

                                    console.log(names);
                                });
                            });
                        }, j * time_between_requests);
                    })(letter, j);
                }
            }, i * time_between_requests * letters.length);
        })(city, i);
    }
}


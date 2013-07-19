var data = require('./data/data.js'),
    cities_neighborhood = data.cities_neighborhood,
    cities = Object.keys(cities_neighborhood),
    letters = data.letters,
    http = require('http'),
    zlib = require("zlib"),
    url = require('url');


var Iconv  = require('iconv').Iconv;
var iconv = new Iconv('windows-1255', 'UTF-8');

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

var jsdom = require("jsdom");
var get_rent_prices = function (city, neighborhood, from_room, to_room, home_type) {
    if (typeof home_type === 'undefined') {
        home_type = 1; // regular appartment
    }

    var user_agent="Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.71 Safari/537.36";
    var query_url = "http://www.yad2.co.il/Nadlan/sales.php?City=" + x_www_form_urlencoder(city) + "&Neighborhood=" + x_www_form_urlencoder(neighborhood) + "&HomeTypeID=" + home_type + "&fromRooms=" + from_room + "&untilRooms=" + to_room + "&fromPrice=&untilPrice=&PriceType=1&FromFloor=&ToFloor=&Info=";

    var request_options = url.parse(query_url);
    request_options.headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.8",
        "Accept-Encoding": "gzip,deflate,sdch",
        "Connection": "keep-alive",
        //"Cookie": "CLIENT_WIDTH_DIR=1905; MAIN_WIDTH_DIR=1905; SaveSearch_CustID=cjg7540132412; ZOOMAP=20130718; PHPSESSID=9pr5neikllo1qhs1tta02kc1k3; yad2upload=3523215370.20480.0000; CLIENT_WIDTH_DIR=1905; MAIN_WIDTH_DIR=1905; cnfc=tbx; pvstr=1374246593/htf; adOtr=44FbQ; __utma=143340477.59008481.1372332675.1374139983.1374245004.9; __utmb=143340477.27.10.1374245004; __utmc=143340477; __utmz=143340477.1374136899.7.2.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); PRLST=Qc; UTGv2=h44f592f0487e1429ecae248614ed7c76f32; SPSI=e7c44b3c5c2b08c121fa5584a0d6efc3",
        "Host": "www.yad2.co.il",
        "User-Agent": "Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.71 Safari/537.36"
    };
    
    http.get(request_options, function (res) {
        var buffer = [];
        var output = '';

        // pipe the response into the gunzip to decompress
        var gunzip = zlib.createGunzip();            
        res.pipe(gunzip);

        gunzip.on('data', function(data) {
            // decompression chunk ready, add it to the buffer
            buffer.push(data)
        }).on('end', function () {
            buffer = Buffer.concat(buffer);

            var output = iconv.convert(buffer).toString("utf-8");
            var jsdom = require("jsdom");
            var window = jsdom.jsdom(output).createWindow();

            jsdom.jQueryify(window, "http://code.jquery.com/jquery.js", function () {
                console.log("Found", window.$("#main_table .ActiveLink").length, "ads");

                window.$("#main_table .ActiveLink").each(function () {
                    var $el = window.$(this);
                    var ad_id = $el.attr("id").replace(/^tr_/, "");
                        address = $el.find("td:nth-child(7)").text(),
                        price = parseInt($el.find("td:nth-child(9)").text().replace(/\D/g, ""), 10),
                        rooms = parseInt($el.find("td:nth-child(11)").text(), 10),
                        floor = parseInt($el.find("td:nth-child(13)").text(), 10),
                        date = $el.find("td:nth-child(17)").text();

                    console.log(ad_id, address, price, rooms, floor, date);
                });

            });
        });
    });
}

get_rent_prices("רחובות", "נווה יהודה", 3, 5);

/*jshint node:true*/

(function () {
    "use strict";
    var riffle = require("../riffle.js"),
        fs = require("fs"),
        ls,
        path = process.argv[2] || "./";

    ls = riffle.stream(function (next, input) {
        fs.readdir(input, function (err, files) {
            var i, ii;
            for (i = 0, ii = files.length; i < ii; i++) {
              next(files[i]);
            }
        });
    }).onOutput(function (data) {
        console.log(data);
    });

    ls.invoke(path);
}());

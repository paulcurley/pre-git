'use strict';

var babel = require("babel-core");
var fs = require('fs');

var glob = require("glob")
var options = {};

glob("{bin,src}/*.js", options, function (er, files) {
	var i
	for (i = 0; i < files.length; i++) {
		babel.transformFile(files[i], { presets: ["es2015"] }, function (err, result){
			if (err) {
				return console.log(err);
			}
			var filename = result.options.filename;
			fs.writeFile(filename, result.code, function(err) {
				if(err) {
					return console.log(err);
				}
				console.log(filename + " converted");
			});

		});
	}
})

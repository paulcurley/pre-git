'use strict';

var label = 'post-merge';
var run = require('pre-git').run;
var runTask = run.bind(null, label);

runTask().done();
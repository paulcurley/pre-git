#!/usr/bin/env node --harmony
'use strict';

var label = 'post-commit';
var run = require('pre-git').run;
var runTask = run.bind(null, label);

runTask().done();
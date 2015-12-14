#!/usr/bin/env node --harmony
'use strict';

var ggit = require('ggit');
var preGit = require('pre-git');
var la = require('lazy-ass');
var check = require('check-more-types');
var log = require('debug')('pre-git');

var wizard = preGit.wizard();
if (!wizard) {
  log('no commit message wizard defined');
  process.exit(0);
}

log('found commit message wizard with name', wizard.name);

la(check.fn(wizard.validate), 'missing wizard validate method,', Object.keys(wizard));
la(check.fn(preGit.printError), 'missing preGit.printError,', Object.keys(preGit));

function checkMessage(msg) {
  var isValid = wizard.validate(msg);
  if (!isValid) {
    process.exit(-1);
  }
}

ggit.commitMessage().then(checkMessage).catch(function (err) {
  // assuming each validator printed the errors?
  console.error(err);
  process.exit(-1);
}).done();
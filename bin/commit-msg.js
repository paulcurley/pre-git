#!/usr/bin/env node --harmony

'use strict';

const ggit = require('ggit');
const preGit = require('pre-git');
const la = require('lazy-ass');
const check = require('check-more-types');
const log = require('debug')('pre-git');

const wizard = preGit.wizard();
if (!wizard) {
  log('no commit message wizard defined');
  process.exit(0);
}

log('found commit message wizard with name', wizard.name);

la(check.fn(wizard.validate),
  'missing wizard validate method,', Object.keys(wizard));
la(check.fn(preGit.printError),
  'missing preGit.printError,', Object.keys(preGit));

function checkMessage(msg) {
  const isValid = wizard.validate(msg);
  if (!isValid) {
    process.exit(-1);
  }
}

ggit.commitMessage()
  .then(checkMessage)
  .catch((err) => {
    // assuming each validator printed the errors?
    console.error(err);
    process.exit(-1);
  })
  .done();

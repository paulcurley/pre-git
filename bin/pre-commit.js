#!/usr/bin/env node --harmony
'use strict';

var log = require('debug')('pre-git');

/* jshint -W079 */
var Promise = require('bluebird');

var child = require('child_process');
var label = 'pre-commit';

function isForced() {
  log(label, 'arguments', process.argv);
  return process.argv.some(function (arg) {
    return arg === '-f' || arg === '--force';
  });
}

function errorMessage(err) {
  return err instanceof Error ? err.message : err;
}

// should we exit if there are no changes to commit?

// resolved => there are changes to commit
// rejected => might be an Error or nothing.
//   if nothing => not changes to commit
function haveChangesToCommit() {
  return new Promise(function (resolve, reject) {
    if (isForced()) {
      console.log('forcing pre-commit execution');
      return resolve();
    }

    child.exec('git status --porcelain', function changes(err, status) {
      if (err) {
        console.error(label, 'Failed to check for changes. Cannot run the tests.');
        console.error(err);
        return process.exit(1);
      }

      return status.trim().length ? resolve() : reject();
    });
  });
}

function printNothingToDo() {
  console.log('');
  console.log(label, 'No changes detected, bailing out.');
  console.log('');
}

var run = require('pre-git').run;
var runTask = run.bind(null, label);

console.log('running pre-commit script');
haveChangesToCommit().then(runTask, function (err) {
  if (err) {
    console.error(errorMessage(err));
    process.exit(-1);
  }
  printNothingToDo();
}).catch(function (err) {
  console.error(label, 'A problem');
  console.error(errorMessage(err));
  process.exit(-1);
}).done();
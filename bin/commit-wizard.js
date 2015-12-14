#!/usr/bin/env node --harmony
'use strict';

console.log('running commit-wizard in folder %s', process.cwd());
var la = require('lazy-ass');
var check = require('check-more-types');
var join = require('path').join;
var pkgPath = join(process.cwd(), 'package.json');
var pkg = require(pkgPath);
var preGit = require('pre-git');
var git = require('ggit');
var chalk = require('chalk');
var log = require('debug')('pre-git');
la(check.fn(log), 'missing debug log', log);

/* jshint -W079 */
var Promise = require('bluebird');

var label = 'pre-commit';

var config = pkg.config && pkg.config['pre-git'];

var wizard = preGit.wizard();
la(check.maybe.object(wizard), 'could not get commit message wizard', wizard);

function getPreCommitCommands(config) {
  if (!config) {
    return;
  }
  var preCommit = config[label];
  if (check.unemptyString(preCommit)) {
    return [preCommit];
  }
  return preCommit;
}

function hasPreCommitCommands(config) {
  return check.unemptyArray(getPreCommitCommands(config));
}

var start = Promise.resolve(git.hasChanges()).then(function (hasSomethingToCommit) {
  if (!hasSomethingToCommit) {
    console.log('Nothing to commit');
    process.exit(0);
  }
});

if (hasPreCommitCommands(config)) {
  console.log('package %s has pre-commit commands', pkg.name);
  console.log(getPreCommitCommands(config).join(', '));
  var run = preGit.run;
  la(check.fn(run), 'missing pre git run');
  var runLabeled = run.bind(null, label);

  start = start.then(runLabeled).then(function () {
    return console.log('finished pre-commit check');
  });
}

/* jshint -W098 */
function guideUserMock() {
  return Promise.resolve('fix(git): fixing commit wizard');
}

function guideUser() {
  if (!wizard) {
    console.error(chalk.yellow('You have not set the commit message format'));
    console.error('This wizard does not know what to ask you');
    console.error('Maybe try setting up "simple" commit message format');
    console.error('See', chalk.underline('https://github.com/bahmutov/pre-git#validating-commit-message'));
    return Promise.reject(new Error('Missing commit format name'));
  }

  var inquirer = require('inquirer');

  return new Promise(function (resolve, reject) {
    wizard.prompter(inquirer, function (message) {
      if (!message) {
        return reject(new Error('No commit message'));
      }
      return resolve(message);
    });
  });
}

function commitWithMessage(commitMessage) {
  la(check.unemptyString(commitMessage), 'missing commit message', commitMessage);
  var gitCommit = git.commit;
  return gitCommit(commitMessage).then(console.log.bind(console));
}

function errorMessage(err) {
  return err instanceof Error ? err.message : err;
}

function firstLine(str) {
  la(check.string(str), 'expected a string, got', str);
  return str.split('\n').shift();
}

function isValidMessage(message) {
  if (!wizard) {
    return message;
  }

  la(check.unemptyString(message), 'missing message');

  var first = firstLine(message);

  if (!check.unemptyString(first)) {
    return Promise.reject(new Error('missing first line'));
  }
  if (check.fn(wizard.validate)) {
    if (!wizard.validate(message)) {
      return Promise.reject(new Error('Invalid commit message\n' + message));
    }
  }
  return message;
}

function success() {
  console.log('commit wizard has finished');
}

start.then(guideUser).then(function (message) {
  return message.trim();
}).tap(function (message) {
  return console.log(message);
}).then(isValidMessage).then(commitWithMessage).then(success).catch(function (err) {
  console.error(errorMessage(err));
  process.exit(-1);
}).done();
'use strict';

var la = require('lazy-ass');
var check = require('check-more-types');

var child = require('child_process');
var path = require('path');
var fs = require('fs');

var log = require('debug')('pre-git');
/* jshint -W079 */
var Promise = require('bluebird');

var label = 'pre-commit:';

var gitPrefix = process.env.GIT_PREFIX || '';

function isAtRoot(dir) {
  return dir === '/';
}

function isPackageAmongFiles(dir) {
  var files = fs.readdirSync(dir);
  return files.indexOf('package.json') >= 0;
}

function verifyValidDirectory(dir) {
  la(check.unemptyString(dir), 'missing dir');

  var cwd = process.cwd();
  if (isAtRoot(dir)) {
    throw new Error('Could not find package.json starting from ' + cwd);
  } else if (!dir || dir === '.') {
    throw new Error('Cannot find package.json from unspecified directory via ' + cwd);
  }
}

function findPackage(dir) {
  var cwd = process.cwd();
  if (!dir) {
    dir = path.join(cwd, gitPrefix);
  }

  if (isPackageAmongFiles(dir)) {
    log('found package in folder', dir);
    return path.join(dir, 'package.json');
  }

  verifyValidDirectory(dir);

  // go to the parent folder and look there
  var parentPath = path.dirname(dir);
  if (parentPath === dir) {
    throw new Error('Cannot got up the folder to find package.json from ' + cwd);
  }
  return findPackage(parentPath);
}

function getPackage() {
  var filename = findPackage();
  la(check.unemptyString(filename), 'could not find package');
  var pkg = require(filename);
  return pkg;
}

// returns a promise
// Can we use ggit for this?
function getProjRoot() {
  return new Promise(function (resolve, reject) {
    child.exec('git rev-parse --show-toplevel', function onRoot(err, output) {
      if (err) {
        console.error('');
        console.error(label, 'Failed to find git root. Cannot run the tests.');
        console.error(err);
        console.error('');
        return reject(new Error('Failed to find git in the project root'));
      }

      var gitRoot = output.trim();
      var projRoot = path.join(gitRoot, gitPrefix);
      var pkg;
      try {
        var file = findPackage();
        pkg = require(file);
        projRoot = path.dirname(file);
      } catch (e) {
        return resolve(gitRoot);
      }

      if (pkg['pre-git-cwd']) {
        projRoot = path.resolve(path.join(gitRoot, pkg['pre-git-cwd']));
      }
      return resolve(projRoot);
    });
  });
}

/**
 * You've failed on some of the scripts, output how much you've sucked today.
 *
 * @param {Error} err The actual error.
 * @api private
 */
function failure(label, err) {
  console.error('');
  console.error(label, 'You\'ve failed to pass all the hooks.');
  console.error(label);

  var chalk = require('chalk');
  if (err instanceof Error) {
    console.error(label, 'An Error was thrown from command');
    if (err.ran) {
      console.error(chalk.supportsColor ? chalk.bold.yellow(err.ran) : err.ran);
    }

    var stack = err.stack.split('\n');
    var firstLine = stack.shift();
    console.error(chalk.supportsColor ? chalk.red(firstLine) : firstLine);
    console.error(label);
    stack.forEach(function trace(line) {
      console.error(label, '   ' + line.trim());
    });
  } else {
    console.error(label, chalk.supportsColor ? chalk.red(err) : err);
  }

  var skipOption = label === 'pre-push' ? '--no-verify' : '-n (--no-verify)';
  var skipOptionText = chalk.supportsColor ? chalk.bold(skipOption) : skipOption;
  console.error(label);
  console.error(label, 'You can skip the git hook by running with', skipOptionText);
  console.error(label);
  console.error(label, 'But this is not advised as your tests are obviously failing.');
  console.error('');

  process.exit(1);
}

function getTasks(label) {
  var packageName = 'pre-git';
  var pkg = getPackage();
  la(check.object(pkg), 'missing package', pkg);

  var run = pkg[label] || pkg.config && pkg.config[packageName] && pkg.config[packageName][label];

  if (check.string(run)) {
    run = [run];
  }
  log('tasks for label "%s" are', label, run);
  return run;
}

function runTask(root, task) {
  console.log('executing task "' + task + '"');

  var options = {
    cwd: root,
    env: process.env
  };

  return new Promise(function (resolve, reject) {
    var proc = child.exec(task, options);
    proc.stdout.on('data', process.stdout.write.bind(process.stdout));
    proc.stderr.on('data', process.stderr.write.bind(process.stderr));
    proc.on('close', function onTaskFinished(code) {
      if (code > 0) {
        var err = new Error(task + ' closed with code ' + code);
        err.ran = task;
        return reject(err);
      }
      return resolve('task "' + task + '" passed');
    });
  });
}

function checkInputs(label) {
  if (typeof label !== 'string' || !label) {
    throw new Error('Expected string label (pre-commit, pre-push)');
  }
}

function runAtRoot(root, label) {
  log('running %s at root %s', label, root);

  return new Promise(function (resolve, reject) {
    if (!root) {
      console.error('');
      console.error(label, 'Failed to find git root. Cannot run the tests.');
      console.error('');
      return reject(new Error('Failed to find git root'));
    }

    var tasks = getTasks(label);
    log('tasks for %s', label, tasks);

    if (!tasks || !tasks.length) {
      console.log('');
      console.log(label, 'Nothing the hook needs to do. Bailing out.');
      console.log('');
      return resolve('Nothing to do for ' + label);
    }

    var runTaskAt = runTask.bind(null, root);

    return resolve(Promise.each(tasks, runTaskAt));
  });
}

function run(hookLabel) {
  log('running', hookLabel);
  checkInputs(hookLabel);

  label = hookLabel;

  // TODO should the failure action be outside?
  return getProjRoot().tap(function (root) {
    return log('running', hookLabel, 'in', root);
  }).then(function (root) {
    return runAtRoot(root, hookLabel);
  }).catch(function (err) {
    return failure(hookLabel, err);
  });
}

function errorMessage(err) {
  return err instanceof Error ? err.message : err;
}

function printError(x) {
  console.error(errorMessage(x) || 'Unknown error');
}

function isBuiltInWizardName(name) {
  la(check.unemptyString(name), 'invalid name', name);
  var builtIn = {
    simple: true,
    conventional: true,
    'cz-conventional-changelog': true
  };
  return builtIn[name];
}

function loadWizard(name) {
  la(check.unemptyString(name), 'missing commit wizard name', name);
  var moduleNames = {
    simple: 'simple-commit-message',
    conventional: 'conventional-commit-message',
    'cz-conventional-changelog': 'conventional-commit-message'
  };
  var loadName = moduleNames[name];
  la(check.unemptyString(loadName), 'Unknown commit message wizard name', name);
  log('loading wizard', loadName, 'for name', name);
  return require(loadName);
}

function getWizardName() {
  var pkg = getPackage();
  var config = pkg.config && pkg.config['pre-git'];
  var defaultName = 'simple';
  log('commit message wizard name from', config);
  if (!config) {
    log('no config, using default name', defaultName);
    return defaultName;
  }
  if (config.wizard) {
    la(check.unemptyString(config.wizard), 'expected wizard name', config.wizard);
    log('using wizard name', config.wizard);
    return config.wizard;
  }
  if (check.unemptyString(config['commit-msg'])) {
    log('using config commit-msg property', config['commit-msg']);
    return config['commit-msg'];
  }
}

function pickWizard() {
  var wizardName = getWizardName();
  if (!wizardName) {
    log('no wizard name set');
    return;
  }
  log('using commit message wizard %s', wizardName);

  var wiz = isBuiltInWizardName(wizardName) ? loadWizard(wizardName) : require(wizardName);
  la(check.fn(wiz.prompter), 'missing wizard prompter', wizardName, wiz);
  return wiz;
}

module.exports = {
  run: run,
  getTasks: getTasks,
  getProjRoot: getProjRoot,
  printError: printError,
  wizard: pickWizard
};

if (!module.parent) {
  run('demo-error', function () {
    return true;
  }).then(function () {
    return log('finished all tasks');
  }).done();
}
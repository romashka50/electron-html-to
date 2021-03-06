'use strict';

exports.__esModule = true;
exports['default'] = ensureStart;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _sliced = require('sliced');

var _sliced2 = _interopRequireDefault(_sliced);

var _ipc = require('./ipc');

var _ipc2 = _interopRequireDefault(_ipc);

var _packageJson = require('../package.json');

var debugPage = _debug2['default'](_packageJson.name + ':page'),
    debugElectronLog = _debug2['default'](_packageJson.name + ':electron-log');

function listenLog(debugStrategy, worker, workerProcess) {
  var workerIpc = _ipc2['default'](workerProcess);

  debugStrategy('establishing listeners for electron logs in worker [' + worker.id + ']..');

  workerIpc.on('page-error', function (windowId, errMsg, errStack) {
    debugPage('An error has ocurred in browser window [%s]: message: %s stack: %s', windowId, errMsg, errStack);
  });

  workerIpc.on('page-log', function () {
    // eslint-disable-next-line prefer-rest-params
    var newArgs = _sliced2['default'](arguments),
        windowId = newArgs.splice(0, 1);

    newArgs.unshift('console log from browser window [' + windowId + ']:');
    debugPage.apply(debugPage, newArgs);
  });

  workerIpc.on('log', function () {
    // eslint-disable-next-line prefer-rest-params
    debugElectronLog.apply(debugElectronLog, _sliced2['default'](arguments));
  });
}

function ensureStart(debugStrategy, workers, instance, cb) {
  if (instance.started) {
    return cb();
  }

  instance.startCb.push(cb);

  if (instance.starting) {
    return;
  }

  debugStrategy('starting electron workers..');

  // eslint-disable-next-line no-param-reassign
  instance.starting = true;

  workers.on('workerProcessCreated', function (worker, workerProcess) {
    listenLog(debugStrategy, worker, workerProcess);
  });

  workers.start(function (startErr) {
    // eslint-disable-next-line no-param-reassign
    instance.starting = false;

    if (startErr) {
      instance.startCb.forEach(function (callback) {
        return callback(startErr);
      });
      return;
    }

    debugStrategy('electron workers started successfully..');

    // eslint-disable-next-line no-param-reassign
    instance.started = true;
    instance.startCb.forEach(function (callback) {
      return callback();
    });
  });
}

module.exports = exports['default'];
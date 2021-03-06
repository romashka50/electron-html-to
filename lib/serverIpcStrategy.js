'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _electronWorkers = require('electron-workers');

var _electronWorkers2 = _interopRequireDefault(_electronWorkers);

var _ensureStartWorker = require('./ensureStartWorker');

var _ensureStartWorker2 = _interopRequireDefault(_ensureStartWorker);

var _packageJson = require('../package.json');

var debugServerStrategy = _debug2['default'](_packageJson.name + ':electron-server-strategy'),
    debugIpcStrategy = _debug2['default'](_packageJson.name + ':electron-ipc-strategy');

exports['default'] = function (mode, options) {
  var debugMode = false,
      scriptPath = undefined,
      debugStrategy = undefined;

  if (mode === 'server') {
    scriptPath = _path2['default'].join(__dirname, 'scripts', 'serverScript.js');
    debugStrategy = debugServerStrategy;
  } else if (mode === 'ipc') {
    scriptPath = _path2['default'].join(__dirname, 'scripts', 'ipcScript.js');
    debugStrategy = debugIpcStrategy;
  } else {
    // defaults to server script and a no-op function
    scriptPath = _path2['default'].join(__dirname, 'scripts', 'serverScript.js');
    debugStrategy = function () {};
  }

  var workersOptions = _extends({}, options, { pathToScript: scriptPath, env: {} });

  if (mode) {
    workersOptions.connectionMode = mode;
  }

  if (process.env.ELECTRON_HTML_TO_DEBUGGING !== undefined) {
    debugMode = true;
    workersOptions.env.ELECTRON_HTML_TO_DEBUGGING = process.env.ELECTRON_HTML_TO_DEBUGGING;
  }

  if (process.env.IISNODE_VERSION !== undefined) {
    workersOptions.env.IISNODE_VERSION = process.env.IISNODE_VERSION;
  }

  workersOptions.env.chromeCommandLineSwitches = JSON.stringify(options.chromeCommandLineSwitches || {});
  workersOptions.env.allowLocalFilesAccess = JSON.stringify(options.allowLocalFilesAccess || false);

  workersOptions.stdio = [null, null, null, 'ipc'];

  if (debugMode) {
    workersOptions.stdio = [null, process.stdout, process.stderr, 'ipc'];
  }

  workersOptions.killSignal = 'SIGKILL';

  var workers = _electronWorkers2['default'](workersOptions);

  function serverIpcStrategyCall(requestOptions, converterPath, id, cb) {
    var executeOpts = {};

    if (debugMode) {
      debugStrategy('electron process debugging mode activated');
    }

    if (process.env.IISNODE_VERSION !== undefined) {
      debugStrategy('running in IISNODE..');
    }

    debugStrategy('checking if electron workers have started..');

    _ensureStartWorker2['default'](debugStrategy, workers, serverIpcStrategyCall, function (err) {
      if (err) {
        debugStrategy('electron workers could not start..');
        debugStrategy('conversion ended with error..');
        return cb(err);
      }

      debugStrategy('processing conversion..');

      if (requestOptions.timeout != null) {
        executeOpts.timeout = requestOptions.timeout;
      }

      workers.execute(_extends({}, requestOptions, { converterPath: converterPath }), executeOpts, function (executeErr, res) {
        if (executeErr) {
          debugStrategy('conversion ended with error..');

          // if the error is a timeout from electron-workers
          if (executeErr.workerTimeout) {
            // eslint-disable-next-line no-param-reassign
            executeErr.electronTimeout = true;
          }

          return cb(executeErr);
        }

        var output = res.output;

        var restData = _objectWithoutProperties(res, ['output']);

        debugStrategy('conversion ended successfully..');

        // disabling no-undef rule because eslint don't detect object rest spread correctly
        /* eslint-disable no-undef */
        cb(null, _extends({}, restData, {
          stream: _fs2['default'].createReadStream(output)
        }));
        /* eslint-enable no-undef */
      });
    });
  }

  serverIpcStrategyCall.startCb = [];

  serverIpcStrategyCall.kill = function () {
    if (!serverIpcStrategyCall.started) {
      return;
    }

    debugStrategy('killing electron workers..');

    serverIpcStrategyCall.started = false;
    serverIpcStrategyCall.startCb = [];
    workers.kill();
  };

  return serverIpcStrategyCall;
};

module.exports = exports['default'];
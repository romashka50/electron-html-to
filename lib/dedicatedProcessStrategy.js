'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _which = require('which');

var _which2 = _interopRequireDefault(_which);

var _sliced = require('sliced');

var _sliced2 = _interopRequireDefault(_sliced);

var _ipc = require('./ipc');

var _ipc2 = _interopRequireDefault(_ipc);

var _saveFile = require('./saveFile');

var _saveFile2 = _interopRequireDefault(_saveFile);

var _packageJson = require('../package.json');

var debugStrategy = _debug2['default'](_packageJson.name + ':dedicated-process-strategy'),
    debugElectronLog = _debug2['default'](_packageJson.name + ':electron-log'),
    debugPage = _debug2['default'](_packageJson.name + ':page');

var ELECTRON_PATH = undefined;

function getElectronPath() {
  var electron = undefined;

  if (ELECTRON_PATH) {
    debugStrategy('electron executable path returned from memory: %s', ELECTRON_PATH);
    return ELECTRON_PATH;
  }

  try {
    // first try to find the electron executable if it is installed from electron-prebuilt..
    // eslint-disable-next-line global-require
    electron = require('electron-prebuilt');
    debugStrategy('electron executable path returned from electron-prebuilt module: %s', electron);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      // ..if electron-prebuilt was not used try using which module
      electron = _which2['default'].sync('electron');
      debugStrategy('electron executable path returned from $PATH: %s', electron);
    } else {
      throw err;
    }
  }

  ELECTRON_PATH = electron;

  return electron;
}

exports['default'] = function (options, requestOptions, converterPath, id, cb) {
  var tmpDir = options.tmpDir;
  var timeout = options.timeout;
  var pathToElectron = options.pathToElectron;
  var allowLocalFilesAccess = options.allowLocalFilesAccess;

  var settingsFilePath = _path2['default'].resolve(_path2['default'].join(tmpDir, id + 'settings.html'));
  var settingsContent = JSON.stringify(_extends({}, requestOptions, { converterPath: converterPath, allowLocalFilesAccess: allowLocalFilesAccess }));

  debugStrategy('saving settings in temporal file..');

  _saveFile2['default'](tmpDir, settingsFilePath, settingsContent, function (saveFileErr) {
    var childArgs = [];

    var debugMode = false,
        isDone = false,
        electronPath = undefined,
        childOpts = undefined,
        child = undefined,
        childIpc = undefined,
        timeoutId = undefined;

    if (saveFileErr) {
      return cb(saveFileErr);
    }

    childArgs.push(_path2['default'].join(__dirname, 'scripts', 'standaloneScript.js'));

    childOpts = {
      env: {
        ELECTRON_WORKER_ID: id,
        ELECTRON_HTML_TO_SETTINGS_FILE_PATH: settingsFilePath
      },
      stdio: [null, null, null, 'ipc']
    };

    debugStrategy('searching electron executable path..');

    if (pathToElectron) {
      debugStrategy('using electron executable path from custom location: %s', pathToElectron);
    }

    electronPath = pathToElectron || getElectronPath();

    if (process.env.ELECTRON_HTML_TO_DEBUGGING !== undefined) {
      debugStrategy('electron process debugging mode activated');
      debugMode = true;
      childOpts.env.ELECTRON_HTML_TO_DEBUGGING = process.env.ELECTRON_HTML_TO_DEBUGGING;
    }

    if (process.env.IISNODE_VERSION !== undefined) {
      debugStrategy('running in IISNODE..');
      childOpts.env.IISNODE_VERSION = process.env.IISNODE_VERSION;
    }

    if (debugMode) {
      childOpts.stdio = [null, process.stdout, process.stderr, 'ipc'];
    }

    debugStrategy('spawing new electron process..');
    debugStrategy('processing conversion..');

    child = _child_process2['default'].spawn(electronPath, childArgs, childOpts);
    childIpc = _ipc2['default'](child);

    child.on('error', function (err) {
      if (isDone) {
        return;
      }

      isDone = true;

      debugStrategy('electron process has an error: %s', err.message);

      cb(err);
      clearTimeout(timeoutId);

      if (child.connected) {
        child.disconnect();
      }

      child.kill();
    });

    childIpc.on('page-error', function (windowId, errMsg, errStack) {
      debugPage('An error has ocurred in browser window [%s]: message: %s stack: %s', windowId, errMsg, errStack);
    });

    childIpc.on('page-log', function () {
      // eslint-disable-next-line prefer-rest-params
      var newArgs = _sliced2['default'](arguments),
          windowId = newArgs.splice(0, 1);

      newArgs.unshift('console log from browser window [' + windowId + ']:');
      debugPage.apply(debugPage, newArgs);
    });

    childIpc.on('log', function () {
      // eslint-disable-next-line prefer-rest-params
      debugElectronLog.apply(debugElectronLog, _sliced2['default'](arguments));
    });

    childIpc.once('finish', function (err, childData) {
      if (isDone) {
        return;
      }

      isDone = true;
      clearTimeout(timeoutId);

      if (err) {
        debugStrategy('conversion ended with error..');
        cb(new Error(err));
      } else {
        // disabling no-undef rule because eslint don't detect object rest spread correctly
        /* eslint-disable no-undef */
        var output = childData.output;

        var restData = _objectWithoutProperties(childData, ['output']);

        debugStrategy('conversion ended successfully..');

        cb(null, _extends({}, restData, {
          stream: _fs2['default'].createReadStream(output)
        }));
        /* eslint-enable no-undef */
      }

      // in debug mode, don't close the electron process
      if (!debugMode) {
        if (child.connected) {
          child.disconnect();
        }

        child.kill();
      }
    });

    timeoutId = setTimeout(function () {
      var timeoutErr = undefined;

      if (isDone) {
        return;
      }

      debugStrategy('conversion timeout..');

      isDone = true;
      timeoutErr = new Error('Timeout when executing in electron');
      timeoutErr.electronTimeout = true;

      cb(timeoutErr);

      if (child.connected) {
        child.disconnect();
      }

      child.kill();
    }, requestOptions.timeout || timeout);
  });
};

module.exports = exports['default'];
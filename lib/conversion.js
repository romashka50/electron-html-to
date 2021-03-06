'use strict';

exports.__esModule = true;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _objectAssign = require('object-assign');

var _objectAssign2 = _interopRequireDefault(_objectAssign);

var _packageJson = require('../package.json');

var _saveFile = require('./saveFile');

var _saveFile2 = _interopRequireDefault(_saveFile);

var _serverIpcStrategy = require('./serverIpcStrategy');

var _serverIpcStrategy2 = _interopRequireDefault(_serverIpcStrategy);

var _dedicatedProcessStrategy = require('./dedicatedProcessStrategy');

var _dedicatedProcessStrategy2 = _interopRequireDefault(_dedicatedProcessStrategy);

var debugConversion = _debug2['default'](_packageJson.name + ':conversion');

function writeHtmlFile(opt, tmpPath, type, id, cb) {
  var htmlPath = undefined;

  if (!opt[type]) {
    return cb();
  }

  htmlPath = _path2['default'].resolve(_path2['default'].join(tmpPath, id + type + '.html'));
  // eslint-disable-next-line no-param-reassign
  opt[type + 'File'] = _path2['default'].resolve(htmlPath);

  debugConversion('creating temporal html file [type: %s] in %s..', type, htmlPath);
  _saveFile2['default'](tmpPath, htmlPath, opt[type], cb);
}

function writeHtml(opt, tmpPath, id, cb) {
  debugConversion('creating temporal html files in %s..', tmpPath);

  writeHtmlFile(opt, tmpPath, 'html', id, function (htmlErr) {
    if (htmlErr) {
      return cb(htmlErr);
    }

    writeHtmlFile(opt, tmpPath, 'header', id, function (headerErr) {
      if (headerErr) {
        return cb(headerErr);
      }

      writeHtmlFile(opt, tmpPath, 'footer', id, function (footerErr) {
        if (footerErr) {
          return cb(footerErr);
        }

        cb();
      });
    });
  });
}

function createConversion(options) {
  var mode = undefined;

  if (options.strategy === 'electron-server') {
    mode = 'server';
  } else if (options.strategy === 'electron-ipc') {
    mode = 'ipc';
  }

  // each conversion instance will create a new electron-workers instance.
  var serverIpcStrategyCall = _serverIpcStrategy2['default'](mode, options);

  var conversion = function conversion(conversionOpts, cb) {
    var localOpts = conversionOpts,
        converterPath = undefined,
        id = undefined;

    var conversionOptsDefault = {
      browserWindow: {
        webPreferences: {}
      },
      waitForJSVarName: 'ELECTRON_HTML_TO_READY'
    };

    debugConversion('generating new conversion task..');

    if (typeof conversionOpts === 'string' || conversionOpts instanceof String) {
      debugConversion('normalizing local options object from a plain string parameter: %s', conversionOpts);

      localOpts = {
        html: conversionOpts
      };
    }

    localOpts = _objectAssign2['default']({}, conversionOptsDefault, localOpts);

    if (localOpts.converterPath) {
      converterPath = localOpts.converterPath;
    } else {
      converterPath = options.converterPath;
    }

    if (localOpts.waitForJS && localOpts.browserWindow.webPreferences && localOpts.browserWindow.webPreferences.javascript === false) {
      throw new Error('can\'t use waitForJS option if browserWindow["web-preferences"].javascript is not activated');
    }

    id = _uuid2['default'].v4();
    debugConversion('conversion task id: %s', id);

    writeHtml(localOpts, options.tmpDir, id, function (err) {
      if (err) {
        return cb(err);
      }

      // prefix the request in order to recognize later in electron protocol handler
      localOpts.url = localOpts.url || _url2['default'].format({
        protocol: 'file',
        pathname: localOpts.htmlFile,
        query: {
          'ELECTRON-HTML-TO-LOAD-PAGE': true
        }
      });

      localOpts.chromeCommandLineSwitches = options.chromeCommandLineSwitches;
      localOpts.extraHeaders = localOpts.extraHeaders || {};

      localOpts.output = {
        tmpDir: _path2['default'].resolve(_path2['default'].join(options.tmpDir)),
        id: id
      };

      delete localOpts.html;

      debugConversion('starting conversion task [strategy:%s][task id:%s] with options:', options.strategy, id, localOpts);

      if (options.strategy === 'electron-server' || options.strategy === 'electron-ipc') {
        return serverIpcStrategyCall(localOpts, converterPath, id, cb);
      }

      if (options.strategy === 'dedicated-process') {
        return _dedicatedProcessStrategy2['default'](options, localOpts, converterPath, id, cb);
      }

      cb(new Error('Unsupported strategy ' + options.strategy));
    });
  };

  function kill() {
    serverIpcStrategyCall.kill();
  }

  conversion.options = options;
  conversion.kill = kill;

  return conversion;
}

exports['default'] = createConversion;
module.exports = exports['default'];
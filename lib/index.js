'use strict';

exports.__esModule = true;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _objectAssign = require('object-assign');

var _objectAssign2 = _interopRequireDefault(_objectAssign);

var _packageJson = require('../package.json');

var _conversion = require('./conversion');

var _conversion2 = _interopRequireDefault(_conversion);

var debugMe = _debug2['default'](_packageJson.name);

function conversionFactory() {
  var userOptions = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var conversion = undefined;

  var optionsDefault = {
    timeout: 10000,
    numberOfWorkers: 2,
    chromeCommandLineSwitches: {},
    allowLocalFilesAccess: false,
    // namespace for tmp dir
    tmpDir: _path2['default'].join(_os2['default'].tmpDir(), _packageJson.name + '-tmp-data'),
    strategy: 'electron-ipc'
  };

  var options = _objectAssign2['default']({}, optionsDefault, userOptions);

  if (Object.keys(options.chromeCommandLineSwitches).length === 0) {
    options.chromeCommandLineSwitches['ignore-certificate-errors'] = null;
  }

  debugMe('Creating a new conversion function with options:', options);

  // always set env var names for electron-workers (don't let the user override this config)
  options.hostEnvVarName = 'ELECTRON_WORKER_HOST';
  options.portEnvVarName = 'ELECTRON_WORKER_PORT';

  conversion = _conversion2['default'](options);

  return conversion;
}

conversionFactory.converters = {};
conversionFactory.converters.PDF = _path2['default'].resolve(__dirname, './converters/pdf.js');

exports['default'] = conversionFactory;
module.exports = exports['default'];
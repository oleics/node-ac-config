
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');

var merge = require('ac-merge');
var isArray = require('ac-is-array');
var isScalar = require('is-scalar');

module.exports = Config;

function Config(props, options) {
  if(!(this instanceof Config)) return Config(props, options);

  if(props == null) props = {};
  if(options == null) options = {};

  var base;
  if(options.file) {
    // read from yaml- or json-file
    props = merge(props, _readYamlOrJsonFile(options.file));
    base = path.dirname(options.file);
  } else {
    base = '.';
  }
  base = path.resolve(base);

  // parse $ref-keys in props
  props = _parse$refKey(props, base);

  // set props
  Object.keys(props).forEach(function(key){
    this[key] = props[key];
  }, this);
}

// Statics

Config.fromJson = function(jsonStr) {
  return new Config(_parseJson(jsonStr));
};

Config.fromJsonFile = function(jsonFile) {
  return new Config({}, {
    file: jsonFile
  });
};

Config.fromYaml = function(yamlStr) {
  return new Config(_parseYaml(yamlStr));
};

Config.fromYamlFile = function(yamlFile) {
  return new Config({}, {
    file: yamlFile
  });
};

Config.fromFile = function(file) {
  return new Config({}, {
    file: file
  });
};

// yaml|json file

function _readYamlOrJsonFile(file) {
  var ext = file.split('.').slice(-1)[0];
  if(ext === 'yaml' || ext === 'yml') {
    return _readYamlFile(file);
  }
  return _readJsonFile(file);
}

// json

function _parseJson(jsonStr) {
  return JSON.parse(jsonStr);
}

function _readJsonFile(jsonFile) {
  return _parseJson(fs.readFileSync(jsonFile).toString());
}

// yaml

function _parseYaml(yamlStr) {
  return yaml.safeLoad(yamlStr);
}

function _readYamlFile(yamlFile) {
  return _parseYaml(fs.readFileSync(yamlFile).toString());
}

//

var _$refKey = '$ref';

function _parse$refKey(obj, base, overwrite) {
  if(base == null) base = '.';

  if(isScalar(obj)) return _expandFilepath(obj, base);

  obj = _parse$EnvVars(obj);

  var key, $ref, $refData, $refBase;
  if(obj[_$refKey] != null) {
    $ref = obj[_$refKey];
    if(typeof $ref === 'function') $ref = $ref(obj);
    if($ref[0] === '$') {
      $refData = _getReferencedKey($ref, obj);
      $refBase = base;
    } else {
      $ref = _resolve$refPath($ref, base);
      $refData = _readYamlOrJsonFile($ref);
      $refBase = path.dirname($ref);
    }

    if(isArray($refData)) {
      return $refData;
    } else {
      delete obj[_$refKey];
      $refData = merge($refData, obj);
      for(key in $refData) {
        if($refData.hasOwnProperty(key)) {
          obj[key] = _parse$refKey($refData[key], $refBase);
        }
      }
    }

    key = null;
    $ref = null;
    $refBase = null;
    $refData = null;
  }

  for(key in obj) {
    if(obj.hasOwnProperty(key)) {
      obj[key] = _parse$refKey(obj[key], base);
    }
  }
  key = null;

  return obj;
}

function _resolve$refPath($ref, base) {
  if(!path.isAbsolute($ref)) {
    try {
      $ref = require.resolve($ref);
    } catch(ex) {
      $ref = path.join(base, $ref);
    }
  }
  return $ref;
}

//

function _expandFilepath(p, base) {
  if(base == null) base = '.';
  if(p != null && p.slice != null) {
    if(p.slice(0, 2) === './') {
      p = path.join(base, p);
    } else if(p.slice(0, 3) === '../') {
      p = path.join(base, p);
    }
  }
  return p;
}

//

var _parse$EnvVars_Key = '$env.';

function _parse$EnvVars(obj) {
  var key;
  if(isScalar(obj)) return _expandEnvVar(obj);
  for(key in obj) {
    if(obj.hasOwnProperty(key)) {
      obj[key] = _parse$EnvVars(obj[key]);
    }
  }
  return obj;
}

function _expandEnvVar(obj) {
  if(obj != null && obj.indexOf != null) {
    if(obj.indexOf(_parse$EnvVars_Key) === 0) {
      obj = process.env[obj.slice(_parse$EnvVars_Key.length)];
    }
  }
  return obj;
}

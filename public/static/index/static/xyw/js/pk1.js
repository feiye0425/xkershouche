/*! wpa 4.1.0 2020-09-10 */
/*! LBF 0.8.0 2014-11-13 */
(function(global, undefined) {

// Avoid conflicting when `LBF.js` is loaded multiple times
if (global.LBF) {
    var lastVersion = global.LBF;    
}

var exports = global.LBF = {
  // The current version of Sea.js being used
  version: "0.8.0"
}

var data = exports.data = {}

exports.noConflict = function(){
	lastVersion && (global.LBF = lastVersion);
}
function isType(type) {
  return function(obj) {
    return {}.toString.call(obj) == "[object " + type + "]"
  }
}

var isObject = isType("Object")
var isString = isType("String")
var isArray = Array.isArray || isType("Array")
var isFunction = isType("Function")
var isNumber = isType("Number")
var isRegExp = isType("RegExp")

var _cid = 0
function cid() {
  return _cid++
}

function forEach(arr, cb, context){
    context = context || this;

    for(var i= 0, len= arr.length; i< len; i++){
        if(typeof arr[i] !== 'undefined'){
            cb.call(context, arr[i], i, arr);
        }
    }
}

var events = data.events = {}

// Bind event
exports.on = function(name, callback) {
  var list = events[name] || (events[name] = [])
  list.push(callback)
  return exports
}

// Remove event. If `callback` is undefined, remove all callbacks for the
// event. If `event` and `callback` are both undefined, remove all callbacks
// for all events
exports.off = function(name, callback) {
  // Remove *all* events
  if (!(name || callback)) {
    events = data.events = {}
    return exports
  }

  var list = events[name]
  if (list) {
    if (callback) {
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i] === callback) {
          list.splice(i, 1)
        }
      }
    }
    else {
      delete events[name]
    }
  }

  return exports
}

// Emit event, firing all bound callbacks. Callbacks receive the same
// arguments as `emit` does, apart from the event name
var emit = exports.emit = function(name, data) {
  var list = events[name], fn

  if (list) {
    // Copy callback lists to prevent modification
    list = list.slice()

    // Execute event callbacks, use index because it's the faster.
    for(var i = 0, len = list.length; i < len; i++) {
      list[i](data)
    }
  }

  return exports
}


var DIRNAME_RE = /[^?#]*\//

var DOT_RE = /\/\.\//g
var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//
var MULTI_SLASH_RE = /([^:/])\/+\//g
var EXT = /(?:js|css|less|php)$/

// Extract the directory portion of a path
// dirname("a/b/c.js?t=123#xx/zz") ==> "a/b/"
// ref: http://jsperf.com/regex-vs-split/2
function dirname(path) {
  return path.match(DIRNAME_RE)[0]
}

// Canonicalize a path
// realpath("http://test.com/a//./b/../c") ==> "http://test.com/a/c"
function realpath(path) {
  // /a/b/./c/./d ==> /a/b/c/d
  path = path.replace(DOT_RE, "/")

  /*
    @author wh1100717
    a//b/c ==> a/b/c
    a///b/////c ==> a/b/c
    DOUBLE_DOT_RE matches a/b/c//../d path correctly only if replace // with / first
  */
  path = path.replace(MULTI_SLASH_RE, "$1/")

  // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
  while (path.match(DOUBLE_DOT_RE)) {
    path = path.replace(DOUBLE_DOT_RE, "/")
  }

  return path
}

// Normalize an id
// normalize("path/to/a") ==> "path/to/a.js"
// NOTICE: substring is faster than negative slice and RegExp
function normalize(path) {
  var last = path.length - 1
  var lastC = path.charAt(last)

  // If the uri ends with `#`, just return it without '#'
  if (lastC === "#") {
    return path.substring(0, last)
  }

  // ignore file with css ext
  if(path.substring(last - 3) === '.css'){
    return path;
  }

  // add js file ext
  return (path.substring(last - 2) === ".js" ||
      path.indexOf("?") > 0 ||
      lastC === "/") ? path : path + ".js"
}


var PATHS_RE = /^([^/:]+)(\/.+)$/
var VARS_RE = /{([^{]+)}/g
var NAMESPACE_RE = /^[\w-_]*(?:\.[\w-_]+)*(\?[\w-_&=]*)?$/


function parseAlias(id) {
  var alias = data.alias
  return alias && isString(alias[id]) ? alias[id] : id
}

// a.b.c -> a/b/c.js
function parseNamespace(id) {
    var match;
    // no dot or uri with static file extension
    // eg. require('jQuery') // alias for 'lib.jQuery'
    // eg. ./mod.js // relative path
    if(id.indexOf('.') > -1 && (match = NAMESPACE_RE.exec(id))){
        var ext;

        // id = 'a.b.c?v=123&t=1'
        // ->
        // ext = '?v=123&t=1'
        if(ext = match[1]){
            // remove ext from id
            id = id.substring(0, id.lastIndexOf(ext));
        }

        ext = '.js' + (ext || '');

        // replace all '.' to '/'
        id = id.split('.').join('/') + ext;
    }

    return id
}

function parsePaths(id) {
  var paths = data.paths
  var m

  if (paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]])) {
    id = paths[m[1]] + m[2]
  }

  return id
}

function parseVars(id) {
  var vars = data.vars

  if (vars && id.indexOf("{") > -1) {
    id = id.replace(VARS_RE, function(m, key) {
      return isString(vars[key]) ? vars[key] : m
    })
  }

  return id
}

function parseMap(uri) {
  var map = data.map
  var ret = uri

  if (map) {
    for (var i = 0, len = map.length; i < len; i++) {
      var rule = map[i]

      ret = isFunction(rule) ?
          (rule(uri) || uri) :
          uri.replace(rule[0], rule[1])

      // Only apply the first matched rule
      if (ret !== uri) break
    }
  }

  return ret
}


var ABSOLUTE_RE = /^\/\/.|:\//
var ROOT_DIR_RE = /^.*?\/\/.*?\//

function addBase(id, refUri) {
  var ret
  var first = id.charAt(0)

  // Absolute
  if (ABSOLUTE_RE.test(id)) {
    ret = id
  }
  // Relative
  else if (first === ".") {
    ret = realpath((refUri ? dirname(refUri) : data.cwd) + id)
  }
  // Root
  else if (first === "/") {
    var m = data.cwd.match(ROOT_DIR_RE)
    ret = m ? m[0] + id.substring(1) : id
  }
  // Top-level
  else {
    ret = data.base + id
  }

  // Add default protocol when uri begins with "//"
  if (ret.indexOf("//") === 0) {
    ret = location.protocol + ret
  }

  return ret
}

function id2Uri(id, refUri) {
  if (!id) return ""

  id = parseAlias(id)
  id = parseNamespace(id)
  id = parseAlias(id)
  id = parsePaths(id)
  id = parseVars(id)
  id = normalize(id)

  var uri = addBase(id, refUri)
  uri = parseMap(uri)

  return uri
}


var doc = document
var cwd = (!location.href || location.href.indexOf('about:') === 0) ? '' : dirname(location.href)
var scripts = doc.scripts

// Recommend to add `LBFnode` id for the `LBF.js` script element
var loaderScript = doc.getElementById("LBFnode") ||
    scripts[scripts.length - 1]

// When `LBF.js` is inline, set loaderDir to current working directory
var loaderDir = dirname(getScriptAbsoluteSrc(loaderScript) || cwd)

function getScriptAbsoluteSrc(node) {
  return node.hasAttribute ? // non-IE6/7
      node.src :
    // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
      node.getAttribute("src", 4)
}


// For Developers
exports.resolve = id2Uri


var head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement
var baseElement = head.getElementsByTagName("base")[0]

var IS_CSS_RE = /\.css(?:\?|$)/i
var currentlyAddingScript
var interactiveScript

// `onload` event is not supported in WebKit < 535.23 and Firefox < 9.0
// ref:
//  - https://bugs.webkit.org/show_activity.cgi?id=38995
//  - https://bugzilla.mozilla.org/show_bug.cgi?id=185236
//  - https://developer.mozilla.org/en/HTML/Element/link#Stylesheet_load_events
var isOldWebKit = +navigator.userAgent
  .replace(/.*(?:AppleWebKit|AndroidWebKit)\/(\d+).*/, "$1") < 536


function request(url, callback, charset) {
  var isCSS = IS_CSS_RE.test(url)
  var node = doc.createElement(isCSS ? "link" : "script")

  if (charset) {
    var cs = isFunction(charset) ? charset(url) : charset
    if (cs) {
      node.charset = cs
    }
  }

  addOnload(node, callback, isCSS, url)

  if (isCSS) {
    node.rel = "stylesheet"
    node.href = url
  }
  else {
    node.async = true
    node.src = url
  }

  // For some cache cases in IE 6-8, the script executes IMMEDIATELY after
  // the end of the insert execution, so use `currentlyAddingScript` to
  // hold current node, for deriving url in `define` call
  currentlyAddingScript = node

  // ref: #185 & http://dev.jquery.com/ticket/2709
  baseElement ?
    head.insertBefore(node, baseElement) :
    head.appendChild(node)

  currentlyAddingScript = null

  return node

}

function addOnload(node, callback, isCSS, url) {
  var supportOnload = "onload" in node

  // for Old WebKit and Old Firefox
  if (isCSS && (isOldWebKit || !supportOnload)) {
    setTimeout(function() {
      pollCss(node, callback)
    }, 1) // Begin after node insertion
    return
  }

  if (supportOnload) {
    node.onload = onload
    node.onerror = function() {
      emit("error", { uri: url, node: node })
      onload()
    }
  }
  else {
    node.onreadystatechange = function() {
      if (/loaded|complete/.test(node.readyState)) {
        onload()
      }
    }
  }

  function onload() {
    // Ensure only run once and handle memory leak in IE
    node.onload = node.onerror = node.onreadystatechange = null

    // Remove the script to reduce memory leak
    if (!isCSS && !data.debug) {
      head.removeChild(node)
    }

    // Dereference the node
    node = null

    callback()
  }
}

function pollCss(node, callback) {
  var sheet = node.sheet
  var isLoaded

  // for WebKit < 536
  if (isOldWebKit) {
    if (sheet) {
      isLoaded = true
    }
  }
  // for Firefox < 9.0
  else if (sheet) {
    try {
      if (sheet.cssRules) {
        isLoaded = true
      }
    } catch (ex) {
      // The value of `ex.name` is changed from "NS_ERROR_DOM_SECURITY_ERR"
      // to "SecurityError" since Firefox 13.0. But Firefox is less than 9.0
      // in here, So it is ok to just rely on "NS_ERROR_DOM_SECURITY_ERR"
      if (ex.name === "NS_ERROR_DOM_SECURITY_ERR") {
        isLoaded = true
      }
    }
  }

  setTimeout(function() {
    if (isLoaded) {
      // Place callback here to give time for style rendering
      callback()
    }
    else {
      pollCss(node, callback)
    }
  }, 20)
}

function getCurrentScript() {
  if (currentlyAddingScript) {
    return currentlyAddingScript
  }

  // For IE6-9 browsers, the script onload event may not fire right
  // after the script is evaluated. Kris Zyp found that it
  // could query the script nodes and the one that is in "interactive"
  // mode indicates the current script
  // ref: http://goo.gl/JHfFW
  if (interactiveScript && interactiveScript.readyState === "interactive") {
    return interactiveScript
  }

  var scripts = head.getElementsByTagName("script")

  for (var i = scripts.length - 1; i >= 0; i--) {
    var script = scripts[i]
    if (script.readyState === "interactive") {
      interactiveScript = script
      return interactiveScript
    }
  }
}


// For Developers
exports.request = request

var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g,
    SLASH_RE = /\\\\/g,
    REQUIRE_NAME_RE = /^function[\s]*\([\s]*([^\f\n\r\t\v,\)]+)/;

function parseDependencies(code) {
    // get require function name
    // in compress code, require function name is no longer 'require'
    var requireName = REQUIRE_NAME_RE.exec(code),
        RE = REQUIRE_RE;
    if(requireName && (requireName = requireName[1]) !== 'require'){
        // reconstruct require regexp
        RE = RE
                .toString()
                // for compressed code
                // replace arg 'require' with actual name
                .replace(/require/g, requireName);

        // remove head & tail
        // '/xxxxx/g' -> 'xxxxx'
        RE = RE.slice(1, RE.length - 2);

        RE = new RegExp(RE, 'g');
    }

    // grep deps by using regexp match
    var ret = [];

    code.replace(SLASH_RE, '')
        .replace(RE, function(m, m1, m2) {
            m2 && ret.push(m2);
        });

    return ret;
}

var cachedMods = exports.cache = {}
var anonymousMeta

var fetchingList = {}
var fetchedList = {}
var callbackList = {}

var STATUS = Module.STATUS = {
  // 1 - The `module.uri` is being fetched
  FETCHING: 1,
  // 2 - The meta data has been saved to cachedMods
  SAVED: 2,
  // 3 - The `module.dependencies` are being loaded
  LOADING: 3,
  // 4 - The module are ready to execute
  LOADED: 4,
  // 5 - The module is being executed
  EXECUTING: 5,
  // 6 - The `module.exports` is available
  EXECUTED: 6
}


function Module(uri, deps) {
  this.uri = uri
  this.dependencies = deps || []
  this.exports = null
  this.status = 0

  // Who depends on me
  this._waitings = {}

  // The number of unloaded dependencies
  this._remain = 0
}

// Resolve module.dependencies
Module.prototype.resolve = function() {
  var mod = this
  var ids = mod.dependencies
  var uris = []

  for (var i = 0, len = ids.length; i < len; i++) {
    uris[i] = Module.resolve(ids[i], mod.uri)
  }
  return uris
}

// Load module.dependencies and fire onload when all done
Module.prototype.load = function() {
  var mod = this

  // If the module is being loaded, just wait it onload call
  if (mod.status >= STATUS.LOADING) {
    return
  }

  mod.status = STATUS.LOADING

  // Emit `load` event for plugins such as combo plugin
  var uris = mod.resolve()
  emit("load", uris)

  var len = mod._remain = uris.length
  var m

  // Initialize modules and register waitings
  for (var i = 0; i < len; i++) {
    m = Module.get(uris[i])

    if (m.status < STATUS.LOADED) {
      // Maybe duplicate: When module has dupliate dependency, it should be it's count, not 1
      m._waitings[mod.uri] = (m._waitings[mod.uri] || 0) + 1
    }
    else {
      mod._remain--
    }
  }

  if (mod._remain === 0) {
    mod.onload()
    return
  }

  // Begin parallel loading
  var requestCache = {}

  for (i = 0; i < len; i++) {
    m = cachedMods[uris[i]]

    if (m.status < STATUS.FETCHING) {
      m.fetch(requestCache)
    }
    else if (m.status === STATUS.SAVED) {
      m.load()
    }
  }

  // Send all requests at last to avoid cache bug in IE6-9. Issues#808
  for (var requestUri in requestCache) {
    if (requestCache.hasOwnProperty(requestUri)) {
      requestCache[requestUri]()
    }
  }
}

// Call this method when module is loaded
Module.prototype.onload = function() {
  var mod = this
  mod.status = STATUS.LOADED

  if (mod.callback) {
    mod.callback()
  }

  // Notify waiting modules to fire onload
  var waitings = mod._waitings
  var uri, m

  for (uri in waitings) {
    if (waitings.hasOwnProperty(uri)) {
      m = cachedMods[uri]
      m._remain -= waitings[uri]
      if (m._remain === 0) {
        m.onload()
      }
    }
  }

  // Reduce memory taken
  delete mod._waitings
  delete mod._remain
}

// Fetch a module
Module.prototype.fetch = function(requestCache) {
  var mod = this
  var uri = mod.uri

  mod.status = STATUS.FETCHING

  // Emit `fetch` event for plugins such as combo plugin
  var emitData = { uri: uri }
  emit("fetch", emitData)
  var requestUri = emitData.requestUri || uri

  // Empty uri or a non-CMD module
  if (!requestUri || fetchedList[requestUri]) {
    mod.load()
    return
  }

  if (fetchingList[requestUri]) {
    callbackList[requestUri].push(mod)
    return
  }

  fetchingList[requestUri] = true
  callbackList[requestUri] = [mod]

  // Emit `request` event for plugins such as text plugin
  emit("request", emitData = {
    uri: uri,
    requestUri: requestUri,
    onRequest: onRequest,
    charset: data.charset
  })

  if (!emitData.requested) {
    requestCache ?
        requestCache[emitData.requestUri] = sendRequest :
        sendRequest()
  }

  function sendRequest() {
    exports.request(emitData.requestUri, emitData.onRequest, emitData.charset)
  }

  function onRequest() {
    delete fetchingList[requestUri]
    fetchedList[requestUri] = true

    // Save meta data of anonymous module
    if (anonymousMeta) {
      Module.save(uri, anonymousMeta)
      anonymousMeta = null
    }

    // Call callbacks
    var m, mods = callbackList[requestUri]
    delete callbackList[requestUri]
    while ((m = mods.shift())) m.load()
  }
}

// Execute a module
Module.prototype.exec = function () {
  var mod = this

  // When module is executed, DO NOT execute it again. When module
  // is being executed, just return `module.exports` too, for avoiding
  // circularly calling
  if (mod.status >= STATUS.EXECUTING) {
    return mod.exports
  }

  mod.status = STATUS.EXECUTING

  // Create require
  var uri = mod.uri

  function require(id) {
    return Module.get(require.resolve(id)).exec()
  }

  require.resolve = function(id) {
    return Module.resolve(id, uri)
  }

  require.async = function(ids, callback) {
    Module.use(ids, callback, uri + "_async_" + cid())
    return require
  }

  // Exec factory
  var factory = mod.factory

  var exports = isFunction(factory) ?
      factory(require, mod.exports = {}, mod) :
      factory

  if (exports === undefined) {
    exports = mod.exports
  }

  // Reduce memory leak
  delete mod.factory

  mod.exports = exports
  mod.status = STATUS.EXECUTED

  // Emit `exec` event
  emit("exec", mod)

  return exports
}

// Resolve id to uri
Module.resolve = function(id, refUri) {
  // Emit `resolve` event for plugins such as text plugin
  var emitData = { id: id, refUri: refUri }
  emit("resolve", emitData)

  return emitData.uri || exports.resolve(emitData.id, refUri)
}

// Define a module
Module.define = function (id, deps, factory) {
  var argsLen = arguments.length

  // define(factory)
  if (argsLen === 1) {
    factory = id
    id = undefined
  }
  else if (argsLen === 2) {
    factory = deps

    // define(deps, factory)
    if (isArray(id)) {
      deps = id
      id = undefined
    }
    // define(id, factory)
    else {
      deps = undefined
    }
  }

  // Parse dependencies according to the module factory code
  if (!isArray(deps) && isFunction(factory)) {
    deps = parseDependencies(factory.toString())
  }

  var meta = {
    id: id,
    uri: Module.resolve(id),
    deps: deps,
    factory: factory
  }

  // Try to derive uri in IE6-9 for anonymous modules
  if (!meta.uri && doc.attachEvent) {
    var script = getCurrentScript()

    if (script) {
      meta.uri = script.src
    }

    // NOTE: If the id-deriving methods above is failed, then falls back
    // to use onload event to get the uri
  }

  // Emit `define` event, used in nocache plugin, exports node version etc
  emit("define", meta)

  meta.uri ? Module.save(meta.uri, meta) :
      // Save information for "saving" work in the script onload event
      anonymousMeta = meta
}

// Save meta data to cachedMods
Module.save = function(uri, meta) {
  var mod = Module.get(uri)

  // Do NOT override already saved modules
  if (mod.status < STATUS.SAVED) {
    mod.id = meta.id || uri
    mod.dependencies = meta.deps || []
    mod.factory = meta.factory
    mod.status = STATUS.SAVED

    emit("save", mod)
  }
}

// Get an existed module or create a new one
Module.get = function(uri, deps) {
  return cachedMods[uri] || (cachedMods[uri] = new Module(uri, deps))
}

// Use function is equal to load a anonymous module
Module.use = function (ids, callback, uri) {
  var mod = Module.get(uri, isArray(ids) ? ids : [ids])

  mod.callback = function() {
    var exports = []
    var uris = mod.resolve()

    for (var i = 0, len = uris.length; i < len; i++) {
      exports[i] = cachedMods[uris[i]].exec()
    }

    if (callback) {
      callback.apply(global, exports)
    }

    delete mod.callback
  }

  mod.load()
}


// Public API

exports.use = function(ids, callback) {
  Module.use(ids, callback, data.cwd + "_use_" + cid())
  return exports
}

Module.define.cmd = {}
exports.define = Module.define

// For Developers

exports.Module = Module
data.fetchedList = fetchedList
data.cid = cid

exports.require = function(id) {
  var mod = Module.get(Module.resolve(id))
  if (mod.status < STATUS.EXECUTING) {
    mod.onload()
    mod.exec()
  }
  return mod.exports
}
// The root path to use for id2uri parsing
data.base = loaderDir

// The loader directory
data.dir = loaderDir

// The current working directory
data.cwd = cwd

// The charset for requesting files
data.charset = "utf-8"

// data.alias - An object containing shorthands of module id
// data.paths - An object containing path shorthands in module id
// data.vars - The {xxx} variables in module id
// data.map - An array containing rules to map module uri
// data.debug - Debug mode. The default value is false

exports.config = function(configData) {

  for (var key in configData) {
    var curr = configData[key]
    var prev = data[key]

    // Merge object config such as alias, vars
    if (prev && isObject(prev)) {
      for (var k in curr) {
        prev[k] = curr[k]
      }
    }
    else {
      // Concat array config such as map
      if (isArray(prev)) {
        curr = prev.concat(curr)
      }
      // Make sure that `data.base` is an absolute path
      else if (key === "base") {
        // Make sure end with "/"
        if (curr.slice(-1) !== "/") {
          curr += "/"
        }
        curr = addBase(curr)
      }

      // Set config
      data[key] = curr
    }
  }

  emit("config", configData)
  return exports
}

var builtInMods = [
	['globalSettings', exports.data], 
	['lang.forEach', forEach],
	['lang.isType', isType], 
	['lang.isObject', isObject],
	['lang.isString', isString],
	['lang.isArray', isArray],
	['lang.isFunction', isFunction],
	['lang.isNumber', isNumber],
	['lang.isRegExp', isRegExp],
	['util.request', request]
];

// define modules only exist in modern browsers
global.JSON && builtInMods.push(['lang.JSON', global.JSON]);
global.jQuery && (global.jQuery.version || '').indexOf('1.7') === 0 && builtInMods.push(['lib.jQuery', global.jQuery]);

forEach(builtInMods, function(each){
    exports.define(each[0], function(require, exports, module){
        module.exports = each[1];
    });
});


/**
 * The Sea.js plugin for concatenating HTTP requests
 */
var Module = LBF.Module
var FETCHING = Module.STATUS.FETCHING

var data = LBF.data
var comboHash = data.comboHash = {}

var comboSyntax = ["c/=/", ",/"]
var comboMaxLength = 1000
var comboExcludes
var comboSuffix


LBF.on("load", setComboHash)
LBF.on("fetch", setRequestUri)

function setComboHash(uris) {
    var len = uris.length
    if (len < 2 || !data.combo) {
        return
    }

    data.comboSyntax && (comboSyntax = data.comboSyntax)
    data.comboMaxLength && (comboMaxLength = data.comboMaxLength)
    data.comboSuffix && (comboSuffix = data.comboSuffix)

    comboExcludes = data.comboExcludes
    var needComboUris = []

    for (var i = 0; i < len; i++) {
        var uri = uris[i]

        if (comboHash[uri]) {
            continue
        }

        var mod = Module.get(uri)

        // Remove fetching and fetched uris, excluded uris, combo uris
        if (mod.status < FETCHING && !isCss(uri) && !isExcluded(uri) && !isComboUri(uri)) {
            needComboUris.push(uri)
        }
    }

    if (needComboUris.length > 1) {
        uris2paths(needComboUris)
    }
}

function setRequestUri(fetchData) {
    if(!data.combo){
        return;
    }

    fetchData.requestUri = comboHash[fetchData.uri] || fetchData.uri
}


// Helpers
var COMBO_ROOT_RE = /^(\S+:\/{2,3}[^\/]+\/)/;

function uris2paths(uris) {
    var paths = [],
        root = COMBO_ROOT_RE.exec(uris[0])[1],
        rootLen = root.length;

    forEach(uris, function(uri){
        paths.push(uri.substr(rootLen));
    });

    setHash(root, paths);
}

function setHash(root, files) {
    var copy = []
    for (var i = 0, len = files.length; i < len; i++) {
        copy[i] = files[i].replace(/\?.*$/, '')
    }
    var comboPath = root + comboSyntax[0] + copy.join(comboSyntax[1])
    if(comboSuffix) {
        comboPath += comboSuffix
    }
    var exceedMax = comboPath.length > comboMaxLength

    // http://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url
    if (files.length > 1 && exceedMax) {
        var parts = splitFiles(files,
            comboMaxLength - (root + comboSyntax[0]).length)

        setHash(root, parts[0])
        setHash(root, parts[1])
    } else {
        if (exceedMax) {
            throw new Error("The combo url is too long: " + comboPath)
        }

        for (var i = 0, len = files.length; i < len; i++) {
            comboHash[root + files[i]] = comboPath
        }
    }
}

function splitFiles(files, filesMaxLength) {
    var sep = comboSyntax[1]
    var s = files[0]

    for (var i = 1, len = files.length; i < len; i++) {
        s += sep + files[i]
        if (s.length > filesMaxLength) {
            return [files.splice(0, i), files]
        }
    }
}

var CSS_EXT_RET = /\.css(?:\?.*)?$/;
function isCss(uri){
    return CSS_EXT_RET.test(uri);
}

function isExcluded(uri) {
    if (comboExcludes) {
        return comboExcludes.test ?
            comboExcludes.test(uri) :
            comboExcludes(uri)
    }
}

function isComboUri(uri) {
    var syntax = data.comboSyntax || comboSyntax
    var s1 = syntax[0]
    var s2 = syntax[1]

    return s1 && uri.indexOf(s1) > 0 || s2 && uri.indexOf(s2) > 0
}


// For test
if (data.test) {
    var test = LBF.test || (LBF.test = {})
    test.uris2paths = uris2paths
    test.paths2hash = paths2hash
}
})(this);

LBF.config({
    paths: {
    	//the comment below is very important, don't change it!!!
		/*wpa_path_to_be_versioned*/wpa: __WPA.staticBase
    },

    debug: __WPA.env,
    // support file protocol
    protocol: __WPA.protocol,

    apiBase: __WPA.apiBase,

    staticBase: __WPA.staticBase

});

/**
 * Created by amos on 14-8-9.
 * Maintained by vergil since 2015/02/01
 */
LBF.define('wpa.app', function(require, exports, module){
    var forEach = require('lang.forEach'),
        extend = require('lang.extend'),
        isFunction = require('lang.isFunction'),
        Event = require('util.Event'),
        WPA = require('wpa.proto.main'),
        api = require('wpa.api'),
        bus = require('wpa.bus'),
        globalSettings = require('globalSettings');

    module.exports = exports = __WPA;

    //wpa全局事件订阅、推送对象
    //不区分是否为灰度环境
    if (!window.__QDWPABUS) {
        window.__QDWPABUS = {};
    }
    extend(__QDWPABUS, Event);

    bus.init();

    /**
     * init wpa app
     */
    exports.init = function(){
        var app = exports;

        // as exports.on is replace with real API
        // move cached event listeners
        var evtBkt = app._evtBkt;
        for(var type in evtBkt){
            if(evtBkt.hasOwnProperty(type)){
                forEach(evtBkt[type], function(listener){
                    app.on(type, listener);
                });
            }
        }
        delete app._evtBkt;

        // create by data cached in stack
        var stk = app._stack;
        forEach(stk, function(data){
            data && app.create(data);
        });
        delete app._stack;

        /**
         * todo
         * @event load
         */
        app.trigger('load');
    };

    exports.ready = function(onReady) {
        if (isFunction(onReady)) {
            onReady();
        }
    };

    //通过该方法来传入WPA初始化参数
    exports.create = function(params){
      //创建一个WPA图标
      try {
        params._sTime = +new Date();
        new WPA(params);
      } catch (e) {
        __QDWPABUS.trigger('error', e);
      }
      
    };

    // extend app proto
    extend(exports, api, Event);
});
/** lib/lbf/lang/extend.js **/
/**
 * Created by amos on 14-8-7.
 */
LBF.define('lang.extend', function(require, exports, module){
    var isPlainObject = require('lang.isPlainObject');

    /**
     * Extend(copy) attributes from an object to another
     * @class extend
     * @namespace lang
     * @constructor
     * @param {Boolean} [isRecursive=false] Recursively extend the object
     * @param {Object} base Base object to be extended into
     * @param {Object} ext* Object to extend base object
     * @example
     *      // plain extend
     *      // returns {a: 1, b:1}
     *      extend({a: 1}, {b: 1});
     *
     *      // recursive extend
     *      var b = { x: 1};
     *      var ret = extend(true, {}, { b: b});
     *      b.x = 2;
     *      b.x !== ret.b.x;
     */
    module.exports = function(isRecursive, base, ext){
        var args = [].slice.apply(arguments),
            o = args.shift(),
            extFn = plain;

        if(typeof o === 'boolean'){
            o = args.shift();
            o && (extFn = recursive);
        }

        for(var i= 0, len= args.length; i< len; i++){
            extFn(o, args[i]);
        }

        return o;

        function plain(o, ext){
            for(var attr in ext){
                if(ext.hasOwnProperty(attr)){
                    o[attr] = ext[attr];
                }
            }
        }

        function recursive(o, ext){
            for(var attr in ext){
                if(ext.hasOwnProperty(attr)){
                    if(isPlainObject(ext[attr])){
                        o[attr] = o[attr] || {};
                        recursive(o[attr], ext[attr]);
                    } else{
                        o[attr] = ext[attr];
                    }
                }
            }
        }
    };
});
/** lib/lbf/util/Event.js **/
/**
 * Created by amos on 14-8-18.
 */
LBF.define('util.Event', function(require, exports){
    var toArray = require('lang.toArray'),
        Callbacks = require('util.Callbacks');

    var ATTR = '_EVENTS';

    /**
     * [mixable] Common event handler. Can be extended to any object that wants event handler.
     * @class Event
     * @namespace util
     * @example
     *      // mix in instance example
     *      // assume classInstance is instance of lang.Class or its sub class
     *
     *      // use class's mix method
     *      classInstance.mix(Attribute);
     *
     *      // set your attributes
     *      classInstance.set('a', 1);
     *      classInstance.get('a') // returns 1
     *
     * @example
     *      // extend a sub class example
     *
     *      // use class's extend method
     *      var SubClass = Class.extend(Attribute, {
     *          // some other methods
     *          method1: function(){
     *          },
     *
     *          method2: function(){
     *          }
     *      });
     *
     *      // initialize an instance
     *      classInstance = new SubClass;
     *
     *      // set your attributes
     *      classInstance.set('a', 1);
     *      classInstance.get('a') // returns 1
     */

    /**
     * Bind events
     * @method on
     * @param {String} eventNames Event names that to be subscribed and can be separated by a blank space
     * @param {Function} callback Callback to be invoked when the subscribed events are published
     * @chainable
     */
    exports.on = function(type, handler, one){
        var events = this[ATTR];

        if(!events){
            events = this[ATTR] = {};
        }

        var callbacks = events[type] || (events[type] = Callbacks('stopOnFalse'));

        if(one === 1){
            var origFn = handler,
                self = this;

            handler = function() {
                // Can use an empty set, since event contains the info
                self.off(type, handler);
                return origFn.apply(this, arguments);
            };
        }

        callbacks.add(handler);

        return this;
    }

    /**
     * Unbind events
     * @method off
     * @param {String} eventNames Event names that to be subscribed and can be separated by a blank space
     * @param {Function} [callback] Callback to be invoked when the subscribed events are published. Leave blank will unbind all callbacks on this event
     * @chainable
     */
    exports.off = function(type, handler){
        if(!type){
            this[ATTR] = {};
            return this;
        }

        var events = this[ATTR];
        if(!events || !events[type]){
            return this;
        }

        if(!handler){
            events[type].empty();
            return this;
        }

        events[type].remove(handler);

        return this;
    }

    /**
     * Publish an event
     * @method trigger
     * @param {String} eventName
     * @param arg* Arguments to be passed to callback function. No limit of arguments' length
     * @chainable
     */
    exports.trigger = function(){
        var args = toArray(arguments),
            type = args.shift(),
            events = this[ATTR];

        if(!events || !events[type]){
            return this;
        }

        events[type].fireWith(this, args);

        return this;
    }

    /**
     * Bind event callback to be triggered only once
     * @method one
     * @param {String} eventNames Event names that to be subscribed and can be separated by a blank space
     * @param {Function} callback Callback to be invoked when the subscribed events are published. Leave blank will unbind all callbacks on this event
     * @chainable
     */
    exports.once = function(type, handler){
        return this.on(type, handler, 1);
    }
})
/** src/proto/main.js **/
/*
 * WPA模型类
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/13
 */
LBF.define('wpa.proto.main', function(require, exports, module) {

    var extend = require('lang.extend'),
        Event = require('util.Event'),
        render = require('wpa.proto.render'),
        uiEvents = require('wpa.proto.uiEvents'),
        GUID = require('util.GUID'),
        ls = require('util.localStorage'),
        kfuinCache = require('wpa.protocol.kfuin'),
        custom = require('wpa.proto.custom'),
        conf = require('wpa.conf.config'),
        KFUINS = conf.KFUINS,
        WEB_IM = conf.WEB_IM,
        WPAS_IM_TYPE = WEB_IM.WPAS_IM_TYPE,
        win = conf.gWin,
        browser = require('lang.browser'),
        isMobile = conf.isMobile,
        GLOBAL_WPA_NAME = conf.GLOBAL_WPA,
        WPAS_BASED_ON_KFUIN = conf.WPAS_BASED_ON_KFUIN,
        //logger = require('wpa.monitor.logger'),
        Reporter = require('wpa.protocol.Reporter'),
        basicCgiCall = require('wpa.proto.basicCgiCall'),
        getRootDomain = require('wpa.util.getRootDomain'),
        ids = require('wpa.util.ids'),
        log = require('wpa.util.log'),
        Cookie = require('util.Cookie'),
        chat = require('wpa.proto.chat'),//qq接待
        phone = require('wpa.proto.phone'),//来电
        add = require('wpa.proto.add'),//加群、好友、关注
        im = require('wpa.proto.im'),//web im
        imInit = require('wpa.im.init'),
        Invite = require('wpa.invite.main'),
        socket = require('wpa.proto.socket'),
        getGdtClickId = require('wpa.proto.getGdtClickId'),//获取gdt的click id
        UnreadMsgCircle = require('wpa.proto.UnreadMsgCircle'),//未读消息红点
        pvReport = require('wpa.proto.pvReport'),
        // _S = require('wpa.util.sandbox')(),
        _S = conf.sandbox,
        //ie7、8有问题：对象不支持此操作，因为加载时序，先还原
        SandBoxObject = _S.Object,
        // SandBoxObject = Object,
        addDa = require('wpa.proto.addDa');//加boss的监控代码

    //存放全局wpa的数组
    win[GLOBAL_WPA_NAME] = win[GLOBAL_WPA_NAME] ? win[GLOBAL_WPA_NAME] : new SandBoxObject();

    //存放kfuin
    win.__WPA[KFUINS] = typeof win.__WPA[KFUINS] !== 'undefined' ? win.__WPA[KFUINS] : new SandBoxObject();

    //存放不同kfuin的wpa
    win.__WPA[WPAS_BASED_ON_KFUIN] = typeof win.__WPA[WPAS_BASED_ON_KFUIN] !== 'undefined' ? win.__WPA[WPAS_BASED_ON_KFUIN] : new SandBoxObject();

    //存放im类型的wpa
    win.__WPA[WPAS_IM_TYPE] = typeof win.__WPA[WPAS_IM_TYPE] !== 'undefined' ? win.__WPA[WPAS_IM_TYPE] : new SandBoxObject();

    module.exports = exports = function(params) {
        this.initialize(params);
    };

    var proto = exports.prototype;

    win.__WPA.IM = im;

    var randomId = function() {
        return (_S.Math.round((_S.Math.random()||0.5) * 2147483647) * (+new _S.Date())) % 10000000000;
    };

    var getPid = function() {
        var result = window.__qq_qidian_da_pid;
        if (!result || !/^QD\./.test(result)) {
            result = window.__qq_qidian_da_pid = ids.createPid(true);
        }
        return result;
    };

    var getQid = function() {
        var rootDomain = getRootDomain.getRootDomain(),
            isCookieEnabled = getRootDomain.isCookieEnabled,
            _qddaz = '';

        if (isCookieEnabled) {
            _qddaz = Cookie.get('_qddaz');
            if (!_qddaz || !/^QD\./.test(_qddaz)) {
                _qddaz = ids.createQid(true);
                Cookie.set('_qddaz', _qddaz, rootDomain, '/', 1000 * 60 * 60 * 24 * 365);
            }
        } else {
            _qddaz = window.__qq_qidian_da_qid;
            if (!_qddaz || !/^QD\./.test(_qddaz)) {
                _qddaz = window.__qq_qidian_da_qid = ids.createQid(true);
            }
        }

        return _qddaz;
    };


    var bindEvents = function() {
        //绑定需要注册的事件，如展示、点击
        this.on('render', function(params) {
            Reporter.report(params.reportType, params);
        });
        this.on('click', function(params) {
            Reporter.report(params.reportType, params);
        });
        this.on('PCChat', function() {
            //todo
        });
        this.on('mobileChat', function() {
            //todo
        });
        this.on('anonyChat', function() {
            //todo
        });
        this.on('linkChat', function() {
            //todo
        });
        //广点通上报获取click_id
        this.on('gdtReport', function(params) {
            Reporter.report(params.reportType, params);
        });
        //初始化im
        this.on('initIm', function() {
            var params = this.params,
                kfuin = params.fkfuin,
                cate = params.cate;
            //2017/04/18:放开qq类型的im能力(包含im会话和邀请)
            if (params.cate == conf.TYPES.IM || params.cate == conf.TYPES.QQ) {
                this.imInit(this.params);
                if (params.cate == conf.TYPES.IM) {
                    if (typeof win.__WPA[WPAS_IM_TYPE][kfuin] !== 'undefined') {
                        win.__WPA[WPAS_IM_TYPE][kfuin].push(this);
                    } else {
                        win.__WPA[WPAS_IM_TYPE][kfuin] = [this];
                    }
                }
                this.trigger('establishSocket');
            }
        });
        //建立长链
        this.on('establishSocket', function() {
            var params = this.params,
                kfuin = params.fkfuin,
                cate = params.cate;
            //todo:pcim
            // if (params.cate == conf.TYPES.IM && !conf.isInAdmin/* && isMobile*/) {
            this.establishSocket();
            // }
        });
    };

    //判断wpa是否是自定义的
    //cate为1且type为17或18
    //cate为5且type为21
    //cate为7且type为15或16
    //cate为8且type为20
    //就是自定义样式的wpa
    var isCustom = function(params) {
        var cate = params.cate,
            type = params.type;
        if ((cate == 1 && (type == 17 || type == 18)) ||
            (cate == 5 && (type == 21)) ||
            (cate == 7 && (type == 15 || type == 16)) ||
            (cate == 8 && (type == 20))) {
            return true;
        }
    };

    proto.initialize = function(params){

        var self = this,
            kfuin = params.fkfuin;

        self.env = new SandBoxObject();

        if (!win.__WPA[KFUINS][kfuin]) {
            win.__WPA[KFUINS][kfuin] = {
                //未读消息数
                unread: {
                    chat: 0,
                    socket: 0
                }
            };
        }

        // bindEvents.apply(this);

        //这里要判断一下cookie里是否有该guid，有就直接取
        if (ls.getItem(conf.tencentSig)) {
            params.guid = ls.getItem(conf.tencentSig);
        } else {
            var guid = ids.createRandomId();
            params.guid = guid;
            ls.setItem(conf.tencentSig, guid);
        }

        win.__WPA.visitorId = params.guid;

        params.wpa = this;
        this.params = params;

        //获取pid
        var pid = this.params.pid = getPid().substring(3);

        //获取qid
        var qid = this.params.qid = getQid().substring(3);

        this.setGlobalVisitorId({
            vid: win.__WPA.visitorId,
            pid: pid,
            qid: qid
        });

        this.pvReport({
            kfuin: kfuin
        });

        var wpaIden = this.params.fkfuin + '_' + this.params.id;
        win[GLOBAL_WPA_NAME][wpaIden] = self;

        if (!win.__WPA[WPAS_BASED_ON_KFUIN][kfuin]) {
            win.__WPA[WPAS_BASED_ON_KFUIN][kfuin] = [self];
        } else {
            win.__WPA[WPAS_BASED_ON_KFUIN][kfuin].push(self);
        }

        // 绑定事件调用后置，保证需要的全局变量初始化完成
        bindEvents.apply(this);

        //添加customEle方式
        if (isCustom(params)) {
            params.isCustom = true;
            this.custom(params)
        } else {
            self.render();
        }

        //添加boss监控脚本，上报数据
        addDa(params.fkfuin);

        //获取广点通的click id
        getGdtClickId(params);

        /*********im灰度前的代码开始*********************/
        //如果发现当前页面有网页接待类型的接触点
        //则进行im相关初始化工作
        //important!!!
        // if (params.cate == conf.TYPES.IM) {
        //     self.imInit(this.params);
        //     if (params.cate == conf.TYPES.IM) {
        //         if (typeof win.__WPA[WPAS_IM_TYPE][kfuin] !== 'undefined') {
        //             win.__WPA[WPAS_IM_TYPE][kfuin].push(self);
        //         } else {
        //             win.__WPA[WPAS_IM_TYPE][kfuin] = [self];
        //         }
        //     }
        // }
        /*********im灰度前的代码结束*********************/

        //拉取会话邀请规则
        //todo:invite
        // if (conf.isLocal && !params.isInviteForbidden && params.cate == conf.TYPES.IM) {
        //     this.Invite.getInviteConf({
        //         kfuin: kfuin,
        //         isMobile: isMobile ? 1 : 0
        //     }, function(inviteConf) {
        //         self.inviteConf = inviteConf;
        //         self.Invite.init.call(self);
        //     });
        // }

        /*********im灰度前的代码开始*********************/
        //建在线状态长链
        // if (params.cate == conf.TYPES.IM && !conf.isInAdmin && ((!conf.isLocal && isMobile) || (conf.isLocal))) {
        //     this.establishSocket();
        // }
        /*********im灰度前的代码结束*********************/

        /*********im灰度代码开始*********************/
        //todo:test
        win.__WPA.cgiCalls.getScaleInfo({
            kfuin: kfuin
        }, self);
        /*********im灰度代码结束*********************/
    };

    extend(
        proto,
        Event,
        render,
        chat,
        uiEvents,
        custom,
        phone,
        add,
        im,
        imInit,
        UnreadMsgCircle,
        socket,
        pvReport,
        {
            Invite: Invite
        }
    );
    // extend(proto, Event, render, chat, uiEvents, custom, phone, add, im, UnreadMsgCircle);



});

/** src/api.js **/
/**
 * Created by amos on 14-8-18.
 */
LBF.define('wpa.api', function(require, exports, module){
    // create wpa
    var api = exports.api = {},
        WPA = require('wpa.proto.main'),
        chatProtocol = require('wpa.protocol.chat'),
        inviteApi = require('wpa.invite.inviteApi');

    api.create = function(params){
        return new WPA(params);
    };

    api.createCustom = function(params){
        return new WPA(params);
    };


    // chat
    api.chat = function(params){

    };

    api.PCChat = function(params, onChat){
        chatProtocol.PCChat(params, onChat);
    };

    api.mobileChat = function(params, onChat){
        chatProtocol.mobileChat(params, onChat);
    };

    api.anonyChat = function(params, onChat){
        chatProtocol.anonyChat(params, onChat);
    };

    api.linkChat = function(params, onChat){
        chatProtocol.linkChat(params, onChat);
    };

    api.invite = function (params) {
        inviteApi.trigger(params)
    }
});

/** src/bus.js **/
/**
 * wpa sub/pub module
 * @author: vergilzhou
 * @version: 4.1.0
 * @date: 2017/10/03
 *
 */
LBF.define('wpa.bus', function(require, exports, module) {

	var report = require('wpa.util.badjs').badjsReport,
		inited = false,
		reportFreq = 0.9;

	exports.init = function() {

		if (inited) {
			return;
		}
		inited = true;

		//global error handler
		__QDWPABUS.on('error', function(err) {
			//这里添加下上报的频率控制
			//按照badjs同学的说法
			//先上报10%的量
			if (Math.random() > reportFreq) {
				report(err);
			}
		});

		//wpa inited event
	};

	exports.triggerError = function(err) {
		if (window.__QDWPABUS) {
			__QDWPABUS.trigger('error', err);
		}
	}

});
/** lib/lbf/lang/isPlainObject.js **/
LBF.define('lang.isPlainObject', function(require, exports, module){
    var isObject = require('lang.isObject'),
        isWindow = function(obj){
            return obj && obj === obj.window;
        };
        
    /**
     * Whether the obj is a plain object, not array or regexp etc.
     * @method isPlainObject
     * @static
     * @param {*} obj
     * @return {Boolean}
     */
    module.exports = function( obj ) {
        // Must be an Object.
        // Because of IE, we also have to check the presence of the constructor property.
        // Make sure that DOM nodes and window objects don't pass through, as well
        if ( !obj || !isObject(obj) || obj.nodeType || isWindow( obj ) ) {
            return false;
        }

        var hasOwn = Object.prototype.hasOwnProperty;

        try {
            // Not own constructor property must be Object
            if ( obj.constructor &&
                !hasOwn.call(obj, 'constructor') &&
                !hasOwn.call(obj.constructor.prototype, 'isPrototypeOf') ) {
                return false;
            }
        } catch ( e ) {
            // IE8,9 Will throw exceptions on certain host objects #9897
            return false;
        }

        // Own properties are enumerated firstly, so to speed up,
        // if last one is own, then all properties are own.

        var key;
        for ( key in obj ) {}

        return key === undefined || hasOwn.call( obj, key );
    };
});
/** lib/lbf/lang/toArray.js **/
/**
 * Created by amos on 14-8-18.
 */
LBF.define('lang.toArray', function(require, exports, module){
    /**
     * Make array like object to array
     * Usually for arguments, jQuery instance
     * @class toArray
     * @namespace lang
     * @constructor
     * @param {Object} arrayLike Array like object
     * @returns {Array}
     * @example
     *      var someFn = function(){
     *          var args = toArray(arguments);
     *      };
     */
    module.exports = function(arrayLike){
        return [].slice.call(arrayLike);
    };
});
/** lib/lbf/util/Callbacks.js **/
/**
 * Created by amos on 14-8-18.
 */
LBF.define('util.Callbacks', function(require, exports, module){
    var Class = require('lang.Class'),
        forEach = require('lang.forEach'),
        extend = require('lang.extend'),
        isFunction = require('lang.isFunction'),
        isString = require('lang.isString'),
        inArray = require('lang.inArray');


    var REG_NOT_WHITE = /\S+/g;

    // String to Object options format cache
    var optionsCache = {};

    // Convert String-formatted options into Object-formatted ones and store in cache
    var createOptions = function(options){
        var object = optionsCache[options] = {};
        forEach( options.match(REG_NOT_WHITE) || [], function( flag ) {
            object[ flag ] = true;
        });
        return object;
    };

    /**
     * Create a callback list (written in actory mode)
     * By default a callback list will act like an event callback list and can be
     * 'fired' multiple times.
     * Borrowed from jQuery.Callbacks
     * @class Callbacks
     * @namespace util
     * @constructor
     * @param {String|Object} options An optional list of space-separated options that will change how the callback list behaves or a more traditional option object
     * @param {Boolean} once Will ensure the callback list can only be fired once (like a Deferred)
     * @param {Boolean} memory Will keep track of previous values and will call any callback added after the list has been fired right away with the latest 'memorized' values (like a Deferred)
     * @param {Boolean} unique Will ensure a callback can only be added once (no duplicate in the list)
     * @param {Boolean} stopOnFalse Interrupt callings when a callback returns false
     * @example
     *  var list = Callbacks('once memory');
     */
    module.exports = function(options){
        // Convert options from String-formatted to Object-formatted if needed
        // (we check in cache first)
        options = typeof options === 'string' ?
            ( optionsCache[ options ] || createOptions( options ) ) :
            extend( {}, options );

        var // Flag to know if list is currently firing
            firing,
        // Last fire value (for non-forgettable lists)
            memory,
        // Flag to know if list was already fired
            fired,
        // End of the loop when firing
            firingLength,
        // Index of currently firing callback (modified by remove if needed)
            firingIndex,
        // First callback to fire (used internally by add and fireWith)
            firingStart,
        // Actual callback list
            list = [],
        // Stack of fire calls for repeatable lists
            stack = !options.once && [],
        // Fire callbacks
            fire = function( data ) {
                memory = options.memory && data;
                fired = true;
                firingIndex = firingStart || 0;
                firingStart = 0;
                firingLength = list.length;
                firing = true;
                for ( ; list && firingIndex < firingLength; firingIndex++ ) {
                    if ( list[ firingIndex ].apply( data[ 0 ], data[ 1 ] ) === false && options.stopOnFalse ) {
                        memory = false; // To prevent further calls using add
                        break;
                    }
                }
                firing = false;
                if ( list ) {
                    if ( stack ) {
                        if ( stack.length ) {
                            fire( stack.shift() );
                        }
                    } else if ( memory ) {
                        list = [];
                    } else {
                        self.disable();
                    }
                }
            },
        // Actual Callbacks object
            self = {
                /**
                 * Add a callback or a collection of callbacks to the list
                 * @method add
                 * @return {util.Callbacks}
                 */
                add: function() {
                    if ( list ) {
                        // First, we save the current length
                        var start = list.length;
                        (function add( args ) {
                            forEach( args, function( arg ) {
                                if ( isFunction( arg ) ) {
                                    if ( !options.unique || !self.has( arg ) ) {
                                        list.push( arg );
                                    }
                                } else if ( arg && arg.length && isString( arg ) ) {
                                    // Inspect recursively
                                    add( arg );
                                }
                            });
                        })( arguments );
                        // Do we need to add the callbacks to the
                        // current firing batch?
                        if ( firing ) {
                            firingLength = list.length;
                            // With memory, if we're not firing then
                            // we should call right away
                        } else if ( memory ) {
                            firingStart = start;
                            fire( memory );
                        }
                    }
                    return this;
                },

                /**
                 * Remove a callback from the list
                 * @method remove
                 * @return {util.Callbacks}
                 */
                remove: function() {
                    if ( list ) {
                        forEach( arguments, function( arg ) {
                            var index;
                            while( ( index = inArray( arg, list, index ) ) > -1 ) {
                                list.splice( index, 1 );
                                // Handle firing indexes
                                if ( firing ) {
                                    if ( index <= firingLength ) {
                                        firingLength--;
                                    }
                                    if ( index <= firingIndex ) {
                                        firingIndex--;
                                    }
                                }
                            }
                        });
                    }
                    return this;
                },

                /**
                 * Check if a given callback is in the list.
                 * If no argument is given, return whether or not list has callbacks attached.
                 * @method has
                 * @return {util.Callbacks}
                 */
                has: function( fn ) {
                    return fn ? inArray( fn, list ) > -1 : !!( list && list.length );
                },

                /**
                 * Remove all callbacks from the list
                 * @method empty
                 * @return {util.Callbacks}
                 */
                empty: function() {
                    list = [];
                    firingLength = 0;
                    return this;
                },

                /**
                 * Have the list do nothing anymore
                 * @method disable
                 * @return {util.Callbacks}
                 */
                disable: function() {
                    list = stack = memory = undefined;
                    return this;
                },

                /**
                 * Is it disabled?
                 * @method disabled
                 * @return {util.Callbacks}
                 */
                disabled: function() {
                    return !list;
                },

                /**
                 * Lock the list in its current state
                 * @method lock
                 * @return {util.Callbacks}
                 */
                lock: function() {
                    stack = undefined;
                    if ( !memory ) {
                        self.disable();
                    }
                    return this;
                },

                /**
                 * Is it locked?
                 * @method locked
                 * @return {Boolean}
                 */
                locked: function() {
                    return !stack;
                },

                /**
                 * Call all callbacks with the given context and arguments
                 * @method fireWith
                 * @return {util.Callbacks}
                 */
                fireWith: function( context, args ) {
                    if ( list && ( !fired || stack ) ) {
                        args = args || [];
                        args = [ context, args.slice ? args.slice() : args ];
                        if ( firing ) {
                            stack.push( args );
                        } else {
                            fire( args );
                        }
                    }
                    return this;
                },

                /**
                 * Call all the callbacks with the given arguments
                 * @method fire
                 * @return {util.Callbacks}
                 */
                fire: function() {
                    self.fireWith( this, arguments );
                    return this;
                },

                /**
                 * To know if the callbacks have already been called at least once
                 * @method fired
                 * @return {util.Callbacks}
                 */
                fired: function() {
                    return !!fired;
                }
            };

        return self;
    };
});

/** src/proto/render.js **/
/*
 * WPA模型类
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/13
 */
LBF.define('wpa.proto.render', function(require, exports, module) {

	var onIframeLoaded = require('wpa.util.onIframeLoaded'),
        tmplCompiler = require('wpa.util.tmplCompiler'),
        Style = require('wpa.util.Style'),
        extend = require('lang.extend'),
        wpaType = require('wpa.conf.wpaType'),
        insertIframe = require('wpa.util.insertIframe'),
        floatCss = require('wpa.conf.floatCss'),
        Events = require('wpa.conf.Events'),
        proxy = require('lang.proxy'),
        wpaTmplObj = require('wpa.conf.wpaTmpl'),
        inArray = require('lang.inArray'),
        domEvent = require('wpa.util.domEvent'),
        defaultConst = require('wpa.conf.defaultConst'),
        getSizeFunc = require('wpa.util.getSize'),
        conf = require('wpa.conf.config'),
        bindLogicEvents = require('wpa.util.bindLogicEvents'),
        htReport = require('wpa.util.htReport'),
        browser = require('lang.browser');

    var BOX_SHADOW = 'box-shadow:0 1px 15px rgba(0, 0, 0, 0.15);',
        IFRAME_BORDER = 'border: 1px solid #dadee7;',
        BORDER_TOP_BOTTOM = 'border-top: 1px solid #e3e3e3;border-bottom:1px solid #e3e3e3;',
        BORDER_RADIUS = 'border-radius: {borderRadius};',
        CLASS_NAME_MIDDLE = 'middle';

	var createIframe = function(params, context) {

        wpaTmplObj.init({
            ratio: params.ratio
        });

        var getSize = getSizeFunc(params.ratio);

        var cate = params.cate,
            type = params.type,
            theme = params.theme,
            self = context,         //wpa instance
            container = params.container,
            ratio = params.ratio,
            scene = params.scene,
            kfuin = params.fkfuin,
            key = params.key,
            position = params.position,
            //先传入devicePixelRatio
            //在代码完成之前并不知道移动端尺寸倍数的问题
            //所以目前的补救方法是在用wpaTmpl之前务必先调用！
            targetWpaTmpl = wpaTmplObj.get(cate, type),
            targetWpaType = wpaType[cate][type],
            borderRadius = targetWpaType.borderRadius,
            hasBoxShadow = targetWpaType.hasBoxShadow,
            iframeBorder = targetWpaType.iframeBorder,
            floatStyle = targetWpaType.floatStyle,
            needPosition = inArray('position', targetWpaType.htmlRequired || []),
            tempPosition = '',
            isPC = targetWpaType.isPC,
            isInQQ = targetWpaType.isInQQ,
            cssText = targetWpaTmpl.cssText,
            width = isPC ? targetWpaTmpl.width : getSize(targetWpaTmpl.width),
            height = isPC ? targetWpaTmpl.height : getSize(targetWpaTmpl.height),
            enableFloat = typeof params.enableFloat !== 'undefined' ? params.enableFloat : true;
        //判断是否有位置的逻辑
        //针对defaultPosition, position, isInQQ
        //才会做位置样式
        //目前不太统一
        //后续优化
        /*
            1. isInQQ为true的：因为在qq图文里，固定放在页面下方就可以，不需要设置fixed
            2. H5里的底部和一些右侧、右下方的，设置为fixed
            3. 其余情况均不设置fixed
            param.enableFloat: false//取消所有浮动设置
        */
        if (enableFloat && ((params.position != undefined || targetWpaTmpl.defaultPosition != undefined) || typeof params.location === 'object')) {
            tempPosition = floatCss.getFloatStyle({
                width: width,
                height: height,
                floatStyle: floatStyle,
                position: params.position,
                location: params.location,
                defaultPosition: targetWpaTmpl.defaultPosition
            });
        }

        tempPosition += hasBoxShadow ? BOX_SHADOW : '';
        //tempPosition += hasBorder ? IFRAME_BORDER : '';
        //当图标为白底并且有iframeBorder设置时，给iframe添加border
        if (typeof iframeBorder === 'object') {
            var iframeBorderTheme = iframeBorder.theme;
            if ((typeof iframeBorderTheme !== 'undefined' && theme == iframeBorderTheme) || typeof iframeBorderTheme === 'undefined') {
                tempPosition += 'border:' + iframeBorder.width + ' solid ' + iframeBorder.color + ';';
            }
        }

        tempPosition += typeof borderRadius !== 'undefined' ? BORDER_RADIUS.replace('{borderRadius}', borderRadius) : '';
        //scene = ['网页样式', '公众号图文样式', '手机网页样式', '链接/二维码']
        //position: 0居中，1底部
        //所以要加上下两根线的是：position为0，同时scene为1，2的接触点
        //小芳(funyu)2016/05/31 10：30左右rtx里决定的
        var isH5Middle = ((scene == 1 || scene == 2) && position == 0 && needPosition !== -1);

        //为以后其他可能的类名做扩展
        if (isH5Middle) {
            params.className = params.className + CLASS_NAME_MIDDLE + ' ';
        };
        tempPosition += isH5Middle ? BORDER_TOP_BOTTOM : '';
        //qq图文的也要加上下两根线了
        //karen2016/06/01决定的
        tempPosition += isInQQ ? BORDER_TOP_BOTTOM : '';

        var iframeId = conf.WPA_ID_PREFIX + kfuin + '_' + params.id,
            iframeClassName = 'class_qidian_wpa';

        var strIframe = '<iframe scrolling="no" class="' + iframeClassName + '" id="' + iframeId + '" frameborder="0" width="' + width + '" height="' + height + '" allowtransparency="true" src="about:blank" {style} ></iframe>';
        strIframe = tempPosition ? strIframe.replace('{style}', 'style="' + tempPosition + '"') : strIframe.replace('{style}', '');

        // ie will reject operations when parent's domain is set
        var iframe;
        try{//ie
            iframe = document.createElement(strIframe);
        } catch(e) {//none ie
            iframe = document.createElement('iframe');
            iframe.width = width;
            iframe.height = height;
            iframe.id = iframeId;
            iframe.style.cssText = tempPosition;
            iframe.setAttribute('scrolling', 'no');
            iframe.setAttribute('frameborder', 0);
            iframe.setAttribute('allowtransparency', true);
            iframe.setAttribute('src', 'about:blank');
            iframe.setAttribute('class', iframeClassName);
        }

        //container是需要插入到某一个div里的id，如果提供了，则将iframe插入指定了id的div里，否则插入到页面最后一个script标签前
        var lastScript = document.getElementById('qd' + kfuin + key) || params.scriptPosition;
        insertIframe({
            ele: iframe,
            lastScript: lastScript,
            container: container
        });

        //把模板中需要替换的变量替换掉
        //例如: btnTxt, title, subTitle, content等
        var compiledTmpl = tmplCompiler.compile({
            tpl: targetWpaTmpl.tpl,
            params: params,
            htmlRequired: targetWpaType.htmlRequired
        });

        if (browser.msie) {
            // when domain is set in parent page and blank iframe is not ready, access to it's content is denied in ie
            try{
                var accessTest = iframe.contentWindow.document;
            } catch(e){
                // Test result shows that access is denied
                // So reset iframe's document.domain to be the same as parent page
                iframe.src = 'javascript:void((function(){document.open();document.domain=\''+ document.domain + '\';document.close()})())';
            }
        }

        var loaded = function(){
            var iWin = iframe.contentWindow,
                iDoc = iframe.contentDocument || iWin.document;

            iDoc.open();
            iDoc.write([
                //'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
                '<!doctype html>',
                '<html xmlns="http://www.w3.org/1999/xhtml">',
                '<head>',
                    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
                    //todo
                    browser.msie && iframe.src !== 'about:blank' ? '<script>document.domain=\'' + document.domain + '\';</script>' : '',
                '</head>',
                '<body>',
                    compiledTmpl,
                '</body>',
                '</html>'
            ].join(''));
            iDoc.close();
            //风铃要求加上禁止touchmove事件
            //仅移动端添加
            if (browser.isIOS || browser.isAndroid) {
                try {
                    iDoc.body.addEventListener('touchmove', function (event) {
                        event.preventDefault();
                    }, false);
                } catch (e) {

                }
            }

            var styleObj = {
                self: self,
                name: 'style',
                cssText: cssText,
                doc: iDoc
            };

            Style.add(styleObj);

            //bind event
            var eventNodes = iDoc.getElementsByName(wpaTmplObj.defaultEventTagName);
            bindLogicEvents(eventNodes, context);

            //init trigger
            __WPA.trigger('inited', self.params);

            //华佗上报初始化完成
            //2019/07/29 华佗测速上报服务异常，暂时屏蔽掉上报
            // htReport(params._sTime, 31);

            //触发显示后上报轨迹功能
            //remark:因为用的是postReport，会动态添加iframe，因此会和iframe这个变量冲突，故放在此处，等iframe加载完毕后再触发
            setTimeout(function() {
                context.trigger('render', extend({
                    reportType: 'render'
                }, params));
            }, 1000);

        };

        onIframeLoaded(iframe, loaded);

        return iframe;
	};

    // var bindLogicEvents = function(eventNodes, context) {

    //     //如果传入的dom节点为空，则返回
    //     if (!eventNodes.length) {
    //         return;
    //     }

    //     for (var i = 0, len = eventNodes.length; i < len; i++) {
    //         var eventNode = eventNodes[i];
    //         var dataEventAttr = eventNode.attributes["data-event"].nodeValue;
    //         var dataEvent = dataEventAttr.split(';');
    //         var apiName = dataEvent[0];
    //         var type = dataEvent[1] || Events.defaultEventType;
    //         var api = proxy(context[apiName], context);
    //         if (api) {
    //             domEvent.addEvent(eventNode, type, api);
    //         }
    //     }
    // };

    // todo
    // 可以考虑使用 extend({}, defaults, _params);
    var getRenderParams = function(_params) {

        var dispType = _params.dispType,
            targetWpaTmpl = wpaTmpl[dispType],
            htmlRequired = wpaType[dispType].htmlRequired,
            width = targetWpaTmpl.width ? targetWpaTmpl.width : _params.width,
            height = targetWpaTmpl.height ? targetWpaTmpl.height : _params.height;

        var params = {
            params: _params,
            dispType: dispType,
            width: width,
            height: height,
            container: _params.container,
            htmlRequired: htmlRequired,
            tmplData: _params.params,
            color: _params.color,
            targetWpaTmpl: targetWpaTmpl,
            borderRadius: targetWpaTmpl.borderRadius,
            scriptPosition: _params.scriptPosition,
            guid: _params.guid,
            cssText: targetWpaTmpl.cssText
        };

        return params;
    };

    var preHandleParams = function(params) {

        params.className = '';

        //默认主题theme为1
        if (!params.theme) {
            params.theme = defaultConst.THEME;
        }

        if (typeof params.width !== 'number') {
            params.width = '100%';
        }

        if (typeof params.height !== 'number') {
            params.height = '100%';
        }

        //默认按钮颜色
        if (!params.btnBgColor) {
            params.btnBgColor = {};
        }

        if (!params.btnBgColor.value) {
            params.btnBgColor.value = defaultConst.BTN_COLOR;
        }

        //默认title
        if (!params.title) {
            params.title = defaultConst.TITLE[params.cate];
        }

        //默认signature
        if (!params.signature) {
            params.signature = defaultConst.SIGNATURE[params.cate];
        }

        //默认btnText
        if (!params.btnText) {
            params.btnText = defaultConst.BTN_TEXT[params.cate];
        }

        //获取像素比ratio
        if (!params.ratio) {
            params.ratio = window.devicePixelRatio;
        }

    };

	exports.render = function() {
        //crm3的原来代码是params
        //这里先注释掉，用this._params
        //modified
		//var params = getRenderParams(this._params);
		//this.el = createIframe(params, this);
        preHandleParams(this.params);
        this.el = createIframe(this.params, this);
	};

    exports.remove = function(){
        var el = this.el;
        el && el.parentNode && el.parentNode.removeChild(el);
    };
});

/** src/proto/uiEvents.js **/
/*
 * wpa点击后的入口
 * @author: vergilzhou
 * @version: 4.1.0
 * @date: since qidian project was established
 *
 */

LBF.define('wpa.proto.uiEvents', function(require, exports, module) {

	var extend = require('lang.extend'),
		conf = require('wpa.conf.config'),
		TP_FORM = conf.TP_FORM,
		CLICK_TYPE = conf.CLICK_TYPE,
		ROLE_KEY = conf.ROLE_KEY,
		isInAdmin = conf.isInAdmin,
		win = conf.gWin,
		ids = require('wpa.util.ids');

	// var ROLE_KEY = {
	// 	QQ: 'roleQQ',
	// 	TEL: 'roleTEL',
	// 	KFEXT: 'roleKFEXT',
	// 	GROUP: 'roleGROUP',
	// 	PUB: 'rolePUB',
	// 	IM: 'roleIM'
	// };

	//根据数据来获得上报类型
	var	CPTTP_NONE = 0,
		CPTTP_CORPWPA = 1,   //企业WPA
		CPTTP_STAFFWPA = 2,  //员工WPA
		CPTTP_FREETEL = 3,   //免费电话
		CPTTP_JOINGROUP = 4,  //加群
		CPTTP_ADDFRIEND = 5,   //加好友
		CPTTP_WXMANUAL = 6,   //WX公众号人工客服
		CPTTP_CHAT = 7,   //会话
		CPTTP_ADDATTENT = 8;   //加关注

	var addParams = function(params) {
		var key = params.roleKey || ROLE_KEY.QQ,
			targetRole = params[key] || params[ROLE_KEY.QQ] || {};
		params.roleValue = targetRole.value;
		//params.roleName = targetRole.name;
		params.roleUin = targetRole.uin;
		params.roleData = targetRole.data;
		params.clickid = ids.createClickId();
		params.tpForm = TP_FORM.ICON;
		params.isKfuin = targetRole.isKfuin || 0;

		//公众号的接待在roleQQ里还有isPub参数
		//isPub=1，表示是公众号接待，否则是个人接待
		params.isPub = targetRole.isPub;
		if (params.isPub) {
			//important:迭代10发布前再改为全量
			//2017/03/29:二灰发布前决定关闭b侧pc公众号接待功能，仅线上开放移动端接待
			if (conf.isOA || conf.isDev || conf.isLocal/* || params.wpa.env.isGray*/) {
				params.onlyMobile = false;
			} else {
				params.onlyMobile = true;
			}
			params.roleUin = targetRole.pub.uin;
			params.roleData = targetRole.data;
			params.value = targetRole.value;
		}
	};

	//点击时先通用发生的事
	var handleClickStart = function(params) {
		var r = true;
		if (!params.id) {
			r = false;
			alert('此处只提供样式预览，不支持功能预览');
		}
		return r;
	};
		
	exports.defaultEventType = 'click';

	//关闭WPA图标
	exports.callClose = function() {
		this.remove();
		this.trigger('close');
	};

	//会话
	exports.callChat = function() {

		try {
			if (!handleClickStart(this.params)) {
				return;
			}
			this.params.roleKey = ROLE_KEY.QQ;
	        addParams(this.params);
	        //复合型组件，点击的时候添加指定类型上报
			this.params._tptype = this.params.roleQQ.value ? CPTTP_CORPWPA : CPTTP_STAFFWPA;
			if (typeof win._gdtReportData === 'object') {
				win._gdtReportData.tptype = this.params._tptype;
			}
			this.params.clickType = CLICK_TYPE.QQ;
	        reportClick(this.params);
	        __WPA.trigger('clicked', this.params);
			this.chat();
		} catch (err) {
			__QDWPABUS.trigger('error', err);
		}
		
	};

	//来电
	exports.callPhone = function() {

		try {
			if (!handleClickStart(this.params)) {
				return;
			}
			this.params.roleKey = ROLE_KEY.TEL;
			addParams(this.params);
			//复合型组件，点击的时候添加指定类型上报
			this.params._tptype = CPTTP_FREETEL;
			if (typeof win._gdtReportData === 'object') {
				win._gdtReportData.tptype = this.params._tptype;
			}
			this.params.clickType = CLICK_TYPE.TEL;
			reportClick(this.params);
			__WPA.trigger('clicked', this.params);
			this.phone();
		} catch (err) {
			__QDWPABUS.trigger('error', err);
		}

	};

	//加好友
	exports.callAddPal = function() {

		try {
			if (!handleClickStart(this.params)) {
				return;
			}
			this.params.roleKey = ROLE_KEY.KFEXT;
			addParams(this.params);
			this.params.clickType = CLICK_TYPE.KFEXT;
			reportClick(this.params);
			__WPA.trigger('clicked', this.params);
			this.addPal();
		} catch (err) {
			__QDWPABUS.trigger('error', err);
		}
		
	};

	//加群
	exports.callAddGroup = function() {

		try {
			if (!handleClickStart(this.params)) {
				return;
			}
			this.params.roleKey = ROLE_KEY.GROUP;
			addParams(this.params);
			this.params.clickType = CLICK_TYPE.GROUP;
			reportClick(this.params);
			__WPA.trigger('clicked', this.params);
			this.addGroup();
		} catch (err) {
			__QDWPABUS.trigger('error', err);
		}
		
	};

	//加关注
	exports.callAddFan = function() {

		try {
			this.params.roleKey = ROLE_KEY.PUB;
			addParams(this.params);
			this.params.clickType = CLICK_TYPE.PUB;
			reportClick(this.params);
			__WPA.trigger('clicked', this.params);
			this.addFan();
		} catch (err) {
			__QDWPABUS.trigger('error', err);
		}
		if (!handleClickStart(this.params)) {
			return;
		}
		
	};

	//web im
	exports.callIm = function() {

		try {
			//todo
			//这里需要跟php商定好字段值后再打开
			this.params.roleKey = ROLE_KEY.IM;
			addParams(this.params);
			this.params.clickType = CLICK_TYPE.IM;
			reportClick(this.params);
			__WPA.trigger('clicked', this.params);
			this.im(extend({
				isClickWpa: true
			}, this.params));
		} catch (err) {
			__QDWPABUS.trigger('error', err);
		}
		if (!handleClickStart(this.params)) {
			return;
		}
		
	};

	function reportClick(params) {

		params.reportType = 'click';

        params.wpa.trigger('click', params);

	    //gdt点击上报
	    setTimeout(function(){
	        params.wpa.trigger('gdtReport', extend({
	            reportType: 'gdtReport'
	        }, win._gdtReportData));
	    }, 120);
	};
});
/** lib/lbf/util/GUID.js **/
/**
 * @fileOverview
 * @author amoschen
 * @version 1
 * Created: 13-3-17 下午3:16
 */
LBF.define('util.GUID', function(){
    function S4()
    {
        return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    }

    /**
     * Generate a GUID ( global unique identity )
     * @class GUID
     * @namespace util
     * @module util
     * @constructor
     * @return {String}
     */
    return function(){
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    };
});
/** lib/lbf/util/localStorage.js **/
/**
 * @fileOverview
 * @author amoschen
 * @version
 * Created: 13-8-27 下午7:39
 */
LBF.define('util.localStorage', function(require){
    var Cookie = require('util.Cookie'),
        trim = require('lang.trim'),
        isLSAllowed = true;

    try {
        var ls = window.localStorage;
        ls.setItem('lstest', 1);
    } catch (e) {
        isLSAllowed = false;
        if (window.localStorage) {
            window.localStorage.setItem = function() {};
        }
    }

    var COOKIE_PREFIX = 'IELS';

    // set expires to 100 years to fake permanent storage
    var EXPIRES = 3153600000000;

    var doc = document,

        commonPattern = new RegExp( '(?:^|[ ;])' + COOKIE_PREFIX + '[^=]+=([^;$])' ),

        keyPattern = function( key ){
            return COOKIE_PREFIX + key;
        },

        explore = function( callback ){
            var attributes = doc.cookie.split(';'),
                i = 0,
                length = attributes.length,
                items = [],
                match;

            if( callback ){
                for(; i<length; i++){
                    if( match = commonPattern.exec( attributes[i] ) ){
                        items.push( match[1] );
                        callback( match[1] );
                    }
                }
            } else {
                for(; i<length; i++){
                    ( match = commonPattern.exec( attributes[i] ) ) && items.push( match[1] );
                }
            }

            return items;
        };

    /**
     * LocalStorage with compatible solution for IE
     * use cookie as IE solution
     * user data in IE, because of secure concern, is limited to same dir which is not suitable for common uses
     * Cautions:
     *  Storage events haven't been add to compatible solution
     *  Non-IE browser counts on window.localStorage only, it means this tool is useless to those old non-IE browsers
     * @class localStorage
     * @namespace util.localStorage
     * @module util
     */
    return isLSAllowed ? window.localStorage : {
        /**
         * The number of key/value pairs currently present in the list associated with the localStorage.
         * @property length
         * @static
         */
        length: explore().length,

        /**
         * Get the value of the nth key in the localStorage list
         * @method key
         * @static
         * @param {Number} index Index of key
         * @return {String | Null}
         */
        key: function(index){
            return explore()[index] || null;
        },

        /**
         * Get the current value associated with the given key.
         * @method getItem
         * @static
         * @param {String} key
         * @return {String | Null}
         */
        getItem: function(key){
            return Cookie.get( keyPattern( key ) );
        },

        // *
        //  * Set ( add/update ) value of the given key
        //  * If it couldn't set the new value, the method must throw a QuotaExceededError exception.
        //  * Setting could fail if, e.g., the user has disabled storage for the site, or if the quota has been exceeded.
        //  * @method setItem
        //  * @static
        //  * @param {String} key
        //  * @param {String} value
         
        setItem: function(key, value){
            Cookie.set( keyPattern( key ), value, null, '/', EXPIRES );
            this.length = explore().length;
        },

        /**
         * Remove the key/value pair with the given key
         * @method removeItem
         * @static
         * @param {String} key
         */
        removeItem: function(key){
            Cookie.del( key );
            this.length = explore().length;
        },

        /**
         * Empty all key/value pairs
         * @method clear
         * @static
         */
        clear: function(){
            this.length = explore(function( item ){
                Cookie.del( trim( item.split('=')[0] ) );
            }).length;
        }
    };
});
/** src/protocol/kfuin.js **/
/*
 * WPA chat
 * @author: amoschen
 * @version: 0.0.1
 * @date: 2014/08/19
 */
LBF.define('wpa.protocol.kfuin', function(require, exports, module){
	var jsonp = require('util.jsonp'),
        chatConst = require('wpa.conf.chat'),
		isFunction = require('lang.isFunction');

    //previous is http
    var GET_KFUIN_URL = chatConst.WPL_B_QQ_COM_CONV;

    var kfuins = {},
        count = 0;

//    var generateCbName = function() {
//        return 'JSONP_CALLBACK_' + ++count + '_' + Math.round(Math.random() * 100);
//    };

    return {
        get: function(nameAccount, callback){
        	!isFunction(callback) && (callback = noop);

            if(!nameAccount || kfuins[nameAccount]){
                callback(kfuins[nameAccount]);
                return;
            }

            var opts = {
                num: nameAccount//,
                //cb: generateCbName()
            };

            jsonp(GET_KFUIN_URL, opts, function(rs){
                if(!rs || rs.r !== 0){
                    callback();
                    return;
                }

                var kfuin = kfuins[nameAccount] = rs.data.kfuin;
                callback(kfuin);
            });
        },

        set: function(nameAccount, kfuin){
            kfuins[nameAccount] = kfuin;
        }
    };

    function noop(){}
});
/** src/proto/custom.js **/
/*
 * 使用用户已有的元素来实现wpa图标
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/28
 *
 */
LBF.define('wpa.proto.custom', function(require, exports, module) {

	var domEvent = require('wpa.util.domEvent'),
		conf = require('wpa.conf.config'),
		log = require('wpa.util.log'),
		offset = require('wpa.util.offset'),
		htReport = require('wpa.util.htReport'),
		win = conf.gWin,
		doc = win.document,
		body = doc.body,
		extend = require('lang.extend'),
		Reporter = require('wpa.protocol.Reporter'),
		ACTIONS = {
			//会话
			callChat: 'callChat',
			//电话
			callPhone: 'callPhone',
			//加好友
			callAddPal: 'callAddPal',
			//加群
			callAddGroup: 'callAddGroup',
			//加关注
			callAddFan: 'callAddFan',
			//web im
			callIm: 'callIm'
		};

	var CUSTOM_TYPE_DOM = 1,
		CUSTOM_TYPE_IMG = 2;

	//获取自定义图片的style
	var getImgStyle = function(options) {
		var zoom = options.zoom,
			width = options.width,
			height = options.height,
			h = options.h || {},
			v = options.v || {},
			hType = h.type,
			hPx = h.px,
			vType = v.type,
			vPx = v.px,
			ratio,//缩放比例
			customImgStyle = [
				'position:fixed',
				'cursor:pointer',
				'z-index:1999999999'
			];

		//无缩放的情况
		if (zoom == 0) {
			if (hType == 1) {//水平靠左
				customImgStyle.push('left:' + hPx + 'px');
			} else if (hType == 2) {//水平居中
				customImgStyle.push('left:50%');
				customImgStyle.push('margin-left:-' + (width / 2) + 'px');
			} else {//水平靠右
				customImgStyle.push('right:' + hPx + 'px');
			}

			if (vType == 1) {//垂直靠上
				customImgStyle.push('top:' + vPx + 'px');
			} else if (vType == 2) {//垂直居中
				customImgStyle.push('top:50%');
				customImgStyle.push('margin-top:-' + (height / 2) + 'px');
			} else {//水平靠右
				customImgStyle.push('bottom:' + vPx + 'px');
			}
			customImgStyle.push('width:' + width + 'px');
			customImgStyle.push('height:' + height + 'px');
		} else if (zoom == 1) {
			//水平撑满
			//无视水平的居中情况和间距
			customImgStyle.push('width:100%');
			customImgStyle.push('left:0');
			ratio = offset.getClientWidth() / width;
			height = height * ratio;
			customImgStyle.push('height:' + height + 'px');
			if (vType == 1) {//垂直靠上
				customImgStyle.push('top:' + vPx + 'px');
			} else if (vType == 2) {//垂直居中
				customImgStyle.push('top:50%');
				customImgStyle.push('margin-top:-' + (height / 2) + 'px');
			} else {//水平靠右
				customImgStyle.push('bottom:' + vPx + 'px');
			}
		} else {
			//垂直撑满
			//无视垂直的居中情况和间距
			var clientHeight = offset.getClientHeight();
			ratio = clientHeight / height;
			width = width * ratio;
			customImgStyle.push('height:' + clientHeight + 'px');
			customImgStyle.push('width:' + width + 'px');
			customImgStyle.push('top:0');
			if (hType == 1) {//水平靠左
				customImgStyle.push('left:' + hPx + 'px');
			} else if (hType == 2) {//水平居中
				customImgStyle.push('left:50%');
				customImgStyle.push('margin-left:-' + (width / 2) + 'px');
			} else {//水平靠右
				customImgStyle.push('right:' + hPx + 'px');
			}
		}
		return customImgStyle.join(';') + ';';
	};

	var drawCustomImg = function(params, action, wpa) {
		var kfuin = params.fkfuin,
			id = params.id,
			iframeId = conf.CUSTOM_IMG_ID_PREFIX + kfuin + '_' + id,
			iframeClassName = conf.CUSTOM_IMG_CLASS_NAME,
			cImg = params.custom.customImg,
			zoom = cImg.zoom,
			url = cImg.url,
			customImgStyle = getImgStyle(cImg),
			imgParentDomId = params.imgParentDomId;

		var strImg = '<img src="' + url + '" class="' + iframeClassName + '" style="' + customImgStyle + '" />';
		var img;
		try{//ie
            img = document.createElement(strImg);
        } catch(e) {//none ie
            img = document.createElement('img');
            img.style.cssText = customImgStyle;
            img.setAttribute('src', url);
            img.setAttribute('class', iframeClassName);
        }
        img.onload = function() {
        	domEvent.addEvent(img, 'click', function() {
				wpa[action] && wpa[action]();
            });
            //2019/07/29 华佗测速上报服务异常，暂时屏蔽掉上报
			// htReport(wpa.params._sTime, 33);
        };
        if (imgParentDomId) {
        	doc.getElementById(imgParentDomId).appendChild(img);
        } else {
        	body.appendChild(img);
        }
	};

	var bindCustomDom = function(customEle, action, wpa) {

		var domIdStr = '';

		if (typeof customEle === 'string') {
			if (customEle.indexOf('#') === 0) {
				customEle = customEle.substring(1);
			}
			domIdStr = customEle;
			customEle = doc.getElementById(customEle);
		}

		if (!customEle) {
			var errorMsg = '[Custom DOM id not exist]dom id:' + domIdStr;
			throw errorMsg;
			return;
		}

		domEvent.addEvent(customEle, 'click', function() {
			wpa[action] && wpa[action]();
		});

        //2019/07/29 华佗测速上报服务异常，暂时屏蔽掉上报
		// htReport(wpa.params._sTime, 32);
	};

// {
//     id: 1,
//     cate:,
//     type:,
//     custom: {
//         customType: 1, 2(1:自定义dom，2：自定义图片)
//         domId: 'str'(dom id),
//         customImg: {
//             //缩放选项
//             zoom: 0(0:不适应，1：水平适应，2：上下适应),
//             //图片宽度
//             width: 100,
//             //图片高度
//             height: 100,
//             url: 'xxx',
//             //水平;
//             h: {
//                 type: 1,2,3(1:左,2:中,3:右)
//                 px: 123
//             },
//             //垂直
//             v: {
//                 type: 1,2,3(1:上,2:中,3:下)
//                 px: 123
//             }
//         }
//     }
// }
	exports.custom = function(params) {
		var self = this,
			//默认会话
			action = ACTIONS.callChat,
			custom = params.custom || {},
			customType = custom.customType;

		//根据cate来决定是什么action
		//目前支持QQ会话、WebIM会话、QQ加好友action
		if (params.cate == config.TYPES.IM) {
			action = ACTIONS.callIm;
		} else if (params.cate == config.TYPES.KFEXT) {
			action = ACTIONS.callAddPal;
		}

		if (customType == CUSTOM_TYPE_IMG) {
			drawCustomImg(params, action, self);
		} else {
			var customEle = custom.domId;
			bindCustomDom(customEle, action, self);
		}

		//init trigger
        __WPA.trigger('inited', self.params);

		//展示上报
		this.trigger('render', extend({
            reportType: 'render'
        }, params));
	};

});

/** src/conf/config.js **/
/*
 * 一些模块要用到的配置型常量
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/29
 *
 */
LBF.define('wpa.conf.config', function (require, exports, module) {

    // TODO
    // duplicate, see src/config.js
    //staticBase和base都已经做好了协议头的判断了
    var globalSettings = require('globalSettings'),
        staticBase = globalSettings.staticBase,							//系统默认的静态文件地址，如背景图等
        base = globalSettings.base,										//用户上传图片的地址
        protocol = globalSettings.protocol,
        browser = require('lang.browser'),
        isMobile = browser.isAndroid || browser.isIOS,
        isLocal = location.hostname.indexOf('local.qiye.qq.com') !== -1,
        // isDev = location.hostname.indexOf('devadmin.qidian.qq.com') !== -1,
        // isOA = location.hostname.indexOf('oaadmin.qidian.qq.com') !== -1,
        isSSL = location.protocol.indexOf('https') !== -1,
        host = 'admin.qidian.qq.com',
        protocolUrl = {
            common: host + '/tp/wpaCall/getProtocol',
            mp: host + '/tp/wpaCall/getMpProtocol'
        },
        getScaleInfoUrl = host + '/qbf/aBTest/getGrayLevel',
        gWin = getGlobalWin(),
        isFengLing = false;

    //为了兼容风铃的iframe嵌套问题
    //风铃的iframe src为top或parent
    function getGlobalWin() {
        var gWin = window;
        if (location.href.indexOf('qdconnect.html') !== -1 && location.search.indexOf('wp.qiye.qq.com') !== -1) {
            gWin = isMobile ? top : parent;
            isFengLing = true;
        }
        return gWin;
    }

    var win = gWin,
        doc = win.document,
        body = doc.body,
        ua = navigator.userAgent.toLowerCase(),
        isInAdmin = win.location.href.indexOf('admin.qidian.qq.com/tp/wpa') !== -1 ? true : false;

    // get env vars ready
    // Mozilla/5.0 (iPhone; CPU iPhone OS 7_1_2 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Mobile/11D257 QQ/5.3.2.424 NetType/WIFI Mem/46
    var REGEXP_IPHONE_QQ = /\bQQ\/([\d\.]+)/i,
        // Mozilla/5.0 (iPad; CPU OS 8_0 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Mobile/12A365 IPadQQ/5.3.0.0 QQ/5.6
        REGEXP_IPAD_QQ = /\bIPadQQ\/([\d\.]+).*?\bQQ\/([\d\.]+)/i,
        // Mozilla/5.0 (Linux; Android 5.0.1; Nexus 4 Build/LRX22C) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Mobile Safari/537.36 V1_AND_SQ_4.7.0_216_HDBM_T QQ/4.7.0.2385 NetType/WIFI
        REGEXP_ANDROID_QQ = /\bV1_AND_SQI?_([\d\.]+)(.*? QQ\/([\d\.]+))?/i, // 国际版的 QQ 的 ua 是 sqi
        //2017/04/26:修改了判断手q ua的正则
        // isInMobileQQ = REGEXP_IPHONE_QQ.test(ua) || REGEXP_IPAD_QQ.test(ua) || REGEXP_ANDROID_QQ.test(ua),
        isInMobileQQ = REGEXP_IPHONE_QQ.test(ua) || REGEXP_IPAD_QQ.test(ua) || REGEXP_ANDROID_QQ.test(ua) || /(ipad|iphone|ipod).*? (ipad)?qq\/([\d.]+)|\bv1_and_sqi?_([\d.]+)(.*? qq\/([\d.]+))?/i.test(ua),
        isInWX = ua.indexOf('micromessenger') !== -1,
        isIE = ua.indexOf('msie') !== -1 || !!window.ActiveXObject || 'ActiveXObject' in window;

    //解决风铃的top没有__WPA定义的问题
    if (typeof win.__WPA === 'undefined') {
        win.__WPA = window.__WPA;
    }

    var envPrefix = '',
        isDev = false,
        isOA = false;
    __WPAENV = typeof __WPAENV !== 'undefined' ? __WPAENV : 'production';
    if (__WPAENV == 'development') {
        envPrefix = 'dev';
        isDev = true;
    } else if (__WPAENV == 'test') {
        envPrefix = 'oa';
        isOA = true;
    }

    // https://devwebpage.qidian.qq.com/2/chat/pc/index.html
    // https://devwebpage.qidian.qq.com/2/chat-gray/pc/index.html

    var localImUrl = 'http://local.qiye.qq.com/mockup/socket.html',
        localSocketUrl = 'http://local.qiye.qq.com/mockup/status_socket.html',
        imUrl = 'https://' + envPrefix + 'webpage.qidian.qq.com/2/chat/h5/index.html',
        grayImUrl = 'https://' + envPrefix + 'webpage.qidian.qq.com/2/chat-gray/h5/index.html',
        pcImUrl = 'https://' + envPrefix + 'webpage.qidian.qq.com/2/chat/pc/index.html',
        grayPcImUrl = 'https://' + envPrefix + 'webpage.qidian.qq.com/2/chat-gray/pc/index.html',
        socketUrl = 'https://' + envPrefix + 'webpage.qidian.qq.com/2/chat/statusManager/index.html';
    // socketUrl = 'https://devadmin.qidian.qq.com/template/webb/statusManager/dist/html/index.html';

    //oa还没有发布到webpage
    // if (isOA) {
    // 	imUrl = 'https://' + envPrefix + 'static.qidian.qq.com/2/chat/h5/index.html';
    // 	grayImUrl = 'https://' + envPrefix + 'static.qidian.qq.com/2/chat-gray/h5/index.html';
    // 	socketUrl = 'https://' + envPrefix + 'static.qidian.qq.com/2/chat/statusManager/index.html';
    // }

    if (!isMobile) {
        imUrl = pcImUrl;
        grayImUrl = grayPcImUrl;
    }

    if (isLocal) {
        grayImUrl = localImUrl;
    }

    //判断ie版本，主要为提示im
    var ieVersion = 8;
    if (ua.indexOf('msie') > -1) {
        var msie_vers = ua.match(/msie\s\d+/),
            vers = msie_vers && msie_vers[0].match(/\d+/),
            ieVersion = vers ? Number(vers) : ieVersion;
    }

    //判断微信版本，主要是在微信呼起QQ做版本兼容
    var wxVersion = '0.0.0';
    if (ua.indexOf('micromessenger') > -1) {
        var wx_vers = ua.match(/micromessenger\/([\d\.]+)/);
        wxVersion = wx_vers && wx_vers[1] ? wx_vers[1] : wxVersion;
    }

    /***********dev测试会话邀请用************/
    // imUrl = 'https://devadmin.qidian.qq.com/template/mobile/chat/index.html';

    /***********dev测试会话邀请用************/

    module.exports = {
        imageBaseUrl: staticBase + '/images',
        customBaseUrl: base,
        isSSL: isSSL,
        tencentSig: 'tencentSig',
        cgiDomain: 'https://' + envPrefix + 'admin.qidian.qq.com',
        CGIS: {
            GET_SIGT: {
                development: protocol + '//dev' + protocolUrl.common,
                test: protocol + '//oa' + protocolUrl.common,
                production: protocol + '//' + protocolUrl.common
            },
            GET_MP_SIGT: {
                development: protocol + '//dev' + protocolUrl.mp,
                test: protocol + '//oa' + protocolUrl.mp,
                production: protocol + '//' + protocolUrl.mp
            },
            GET_SCALE_INFO: {
                development: protocol + '//dev' + getScaleInfoUrl,
                test: protocol + '//oa' + getScaleInfoUrl,
                production: protocol + '//' + getScaleInfoUrl
            },
            GET_QQ_INVITE_SIGT: 'https://' + envPrefix + 'admin.qidian.qq.com/webim/commonRequest/getProtocol',
            CLOSE_INVITE_REPORT: 'https://' + envPrefix + 'admin.qidian.qq.com/webim/commonRequest/winClose',
            PC_CHECK_CALL_QQ_STATUS: 'https://' + envPrefix + 'admin.qidian.qq.com/webim/webImLogin/getAIOStatus'
        },
        PAGES: {
            VOICE_JUMP_PAGE: 'https://' + envPrefix + 'lbs.qidian.qq.com/authorize/voiceShow'
        },
        host: host,
        ENV: typeof __WPAENV !== 'undefined' ? __WPAENV : 'production',
        TYPES: {
            //在线接待
            QQ: 1,
            //免费电话
            PHONE: 2,
            //加关注
            PUB: 3,
            //加群
            GROUP: 4,
            //加好友
            KFEXT: 5,
            //网页接待
            IM: 7
        },
        SCROLL_TOP_NAME: '__QD_SCROLL_TOP',
        //全局wpa变量名
        GLOBAL_WPA: '__qd_wpas',
        //全局kfuin
        KFUINS: 'KFUINS',
        //以kfuin为基础的wpa
        WPAS_BASED_ON_KFUIN: 'WPAS_BASED_ON_KFUIN',
        //自定义图片iframe的id前缀
        CUSTOM_IMG_ID_PREFIX: '_qidian_wpa_img_',
        //自定义图片iframe的class名称
        CUSTOM_IMG_CLASS_NAME: 'qidian_wpa_img',
        SOCKET: {
            URL: isLocal ? localSocketUrl : socketUrl,
            SOCKET_IFRAME_ID: '_QD_STATUS_MANAGE_SOCKET_IFRAME',
            ACTS: {
                //长链建好了
                'SM_READY': 'SM_READY',
                'SM_INIT': 'SM_INIT',
                'SM_UNREAD': 'SM_UNREAD',
                'SM_INVITE_CONF': 'SM_INVITE_CONF',
                //b2c的手动邀请
                'SM_MANUAL_INVITE': 'SM_MANUAL_INVITE',
                //用户对邀请框的操作要告诉给后台
                'SM_INVITE_RET': 'SM_INVITE_RET',
                //用户拒绝邀请
                'SM_REFUSE': 'SM_REFUSE',
                'SMS_SM_FORCE_CONNECT': 'SMS_SM_FORCE_CONNECT',
                //会话结束超过30分钟，触发自动邀请逻辑
                'SM_CHAT_OVER': 'SM_CHAT_OVER',
                //pc端长链来的小红点告诉im聊天框
                'UPDATE_UNREAD': 'UPDATE_UNREAD',
                //socket断了
                'DISCONNECT': 'DISCONNECT'
            }
        },
        INVITATION_TYPE: {
            OFFLINE: 3,
            AUTO: 4
        },
        UNREAD_MSG_INFO: 'UNREAD_MSG_INFO',
        INVITE_IFRAME_ID_PREFIX: '_QD_INVITE_IFRAME_ID_PREFIX_',
        KFUIN_INVITED_TIMES: 'KFUIN_INVITED_TIMES',
        WPA_ID_PREFIX: 'qidian_wpa_',
        WEB_IM: {
            WEB_IM_IFRAMES_OBJ_NAME: '_QIDIAN_WEB_IM_IFRAMES',
            WEB_IM_IFRAME_ID: '_QIDIAN_WEB_IM_IFRAME_',
            WEB_IM_IFRAMES_LOADED: '_QIDIAN_WEB_IM_IFRAMES_LOADED',
            WPAS_IM_TYPE: 'WPAS_IM_TYPE',
            POSITION_HELP_EL: '__QD_IM_POSITION_HELPER',
            //im正式url
            URL: isLocal ? localImUrl : imUrl,
            //im灰度url
            URL_SCALE: grayImUrl,
            ACTS: {
                //小红点来了
                'UNREAD': 'UNREAD',
                //点击wpa，打开im页面
                'OPEN': 'OPEN',
                //关闭im页面
                'CLOSE': 'CLOSE',
                //im wpa初始化完成
                'INIT': 'INIT',
                //呼起手q
                'LAUNCH': 'LAUNCH',
                //im页呼起了shurufa
                'INPUT': 'INPUT',
                //呼起键盘
                'FOCUS': 'FOCUS',
                //收起键盘
                'BLUR': 'BLUR',
                //pc端打开图片
                'OPEN_IMG': 'OPEN_IMG',
                //pc端显示聊天页iframe
                'SHOW': 'SHOW',
                //授权
                'AUTH': 'AUTH'
            },
            LAUNCH_TYPES: {
                'QQ': 'QQ',
                'PHONE': 'PHONE'
            }
        },
        isMobile: isMobile,
        isLocal: isLocal,
        isDev: isDev,
        isOA: isOA,
        isFengLing: isFengLing,
        //全局窗口，风铃的要求，移动端用top，pc端用parent
        gWin: gWin,
        ua: ua,
        eptype: isMobile ? 2 : 1,
        //全局邀请配置变量
        GLOBAL_INVITE_TPL_AND_CONF: 'GLOBAL_INVITE_TPL_AND_CONF',
        winWidth: body.offsetWidth,
        winHeight: body.offsetHeight,
        IM_CHAT_IFRAME_OPENING: 'IM_CHAT_IFRAME_OPENING',
        isInAdmin: isInAdmin,
        BROWSER_ENV: {
            isInMobileQQ: isInMobileQQ,
            isMqq: isInMobileQQ,
            isInWX: isInWX,
            wxVersion: wxVersion,
            isIE: isIE,
            ieVersion: ieVersion,
            isIOS: browser.isIOS,
            isAndroid: browser.isAndroid
        },
        ROLE_KEY: {
            QQ: 'roleQQ',
            TEL: 'roleTEL',
            KFEXT: 'roleKFEXT',
            GROUP: 'roleGROUP',
            PUB: 'rolePUB',
            IM: 'roleIM'
        },
        CLICK_TYPE: {
            QQ: 1,		//qq接待
            TEL: 2,		//来电
            KFEXT: 5,	//加好友
            GROUP: 4,	//加群
            PUB: 3,		//加关注
            IM: 6		//web im
        },
        TP_FORM: {
            ICON: 1,
            LINK: 2,
            QR: 3
        },
        // ATTRS: {
        // 	getProtocol: [
        // 		'kfuin',
        // 		'kfext',
        // 		'visitorId',
        // 		'fid',
        // 		'key',
        // 		'cate',
        // 		'type',
        // 		'ftype',
        // 		'tptype',
        // 		'tpform',
        // 		'roleKey',
        // 		'roleValue',
        // 		'roleUin',
        // 		'pid',
        // 		'clickid',
        // 		'qid',
        // 		'env',
        // 		'eptype',
        // 		'clickType',
        // 		'roleData',
        // 		'isKfuin'
        // 	]
        // },
        SANDBOX_ID: '__QIDIAN_SANDBOX',
        sandbox: win,
        //postMessage校验数据来源
        IM_ORIGIN: 'webpage.qidian.qq.com',
        IM_ORIGIN_REG: isLocal ? /^http(s)?:\/\/local.qiye.qq.com(\/)?$/ : /^http(s)?:\/\/(dev|oa)?webpage\.qidian\.qq.com(\/)?$/,
        //badjs上报设置项
        //random: 取值为0-1，1为100%上报。
        badjs: {
            id: 1367,
            random: 1
        },
        POST_MESSAGE_FLAG: 'QD_PM',
        POST_MESSAGE_FLAG_CONTENT: 'WPA',

        IM_LANG: {
            key: 'qidian_lang',
            defaultLang: 'zh-cn',
            availableList: ['zh-cn', 'en-us', 'zh-tw']
        },

        INSTALL_QQ_IFRAME_ID_PREFIX: '_QD_INSTALL_QQ_IFRAME_ID_PREFIX_',
        DOWNLOAD_QQ_TIMEOUT: 9000,
        DOWNLOAD_QQ_URL: {
            PC: '//im.qq.com/download/',
            Android: '//a.app.qq.com/o/simple.jsp?pkgname=com.tencent.mobileqq',
            iOS: '//itunes.apple.com/cn/app/qq-2011/id444934666?mt=8'
        }
    };
});

/** lib/lbf/lang/browser.js **/
/**
 * @fileOverview
 * @author amoschen
 * @version 1
 * Created: 12-11-27 下午7:43
 */
LBF.define('lang.browser', function(require, exports){
    var ua = navigator.userAgent.toLowerCase(),
        matched, browser;

    /**
     * Browser type and versions, see <a target="_blank" href="http://api.jquery.com/jQuery.browser/">jQuery.browser</a>
     * @class browser
     * @namespace lang
     * @module lang
     */

    // Use of jQuery.browser is frowned upon.
    // More details: http://api.jquery.com/jQuery.browser
    // uaMatch maintained for back-compat
    var match = /(chrome)[ \/]([\w.]+)/.exec( ua ) ||
        /(webkit)[ \/]([\w.]+)/.exec( ua ) ||
        /(opera)(?:.*version|)[ \/]([\w.]+)/.exec( ua ) ||
        /(msie) ([\w.]+)/.exec( ua ) ||
        ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec( ua ) ||
        [];

    // ie11 support
    // ie11 ua change: http://msdn.microsoft.com/zh-cn/library/ie/hh869301(v=vs.85).aspx
    var matchIe11;
    if(ua.indexOf('trident') > -1 && ( matchIe11 = /rv:([\d.]+)/.exec( ua ) )){        
        match[1] = 'msie';
        match[2] = matchIe11[1];        
    }

    matched = {
        browser: match[ 1 ] || "",
        version: match[ 2 ] || "0"
    };

    if ( matched.browser ) {
        exports[ matched.browser ] = true;
        exports.version = matched.version;
    }

    // Chrome is Webkit, but Webkit is also Safari.
    if ( exports.chrome ) {
        exports.webkit = true;
    } else if ( exports.webkit ) {
        exports.safari = true;
    }

    var isIE = exports.msie,
        majorVersion = parseInt(exports.version, 10);


    // Mobile detect
    var isMobile = exports.isMobile = ua.match(/(nokia|iphone|android|motorola|^mot\-|softbank|foma|docomo|kddi|up\.browser|up\.link|htc|dopod|blazer|netfront|helio|hosin|huawei|novarra|CoolPad|webos|techfaith|palmsource|blackberry|alcatel|amoi|ktouch|nexian|samsung|^sam\-|s[cg]h|^lge|ericsson|philips|sagem|wellcom|bunjalloo|maui|symbian|smartphone|midp|wap|phone|windows ce|iemobile|^spice|^bird|^zte\-|longcos|pantech|gionee|^sie\-|portalmmm|jig\s browser|hiptop|^ucweb|^benq|haier|^lct|opera\s*mobi|opera\*mini|320x320|240x320|176x220)/i);

    /**
     * Whether it's window
     * @property isWin
     */
    exports.isWin = /windows|win32/.test(ua);

    /**
     * Whether it's mac
     * @property isMac
     */
    exports.isMac = /Mac/.test(ua);

    /**
     * Whether it's iOS
     * @property isIOS
     */
    exports.isIOS = /(?:iphone|ipad|ipod)/i.test(ua);

    /**
     * Whether it's android
     * @property isAndroid
     */
    exports.isAndroid = /android/i.test(ua);

    /**
     * Browser name
     * @property browser
     */
    exports.browser = matched.browser || '';
    
    /**
     * Browser's big version, like IE 9.0.8812.1621, its big version is integer 9
     * @property majorVersion
     */
    exports.majorVersion = majorVersion;

    /**
     * Whether it's IE6 or not
     * @property isIE6
     */
    exports.isIE6 = isIE && majorVersion === 6;

    /**
     * Whether it's IE9 or not
     * @property isIE9
     */
    exports.isIE9 = isIE && majorVersion === 9;

    /**
     * Whether it's IE9 or below, including IE6, IE7, IE8
     * @property isIE9Below
     */
    exports.isIE9Below = isIE && majorVersion < 9;

    exports.isMobile = isMobile;    
});
/** src/protocol/Reporter.js **/
/*
 * 数据上报功能
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/25
 *
 */
LBF.define('wpa.protocol.Reporter', function(require, exports, module) {
	
	var reportConst = require('wpa.conf.report'),
		JSON = require('lang.JSON'),
		removeCustomProp = require('wpa.util.removeCustomProperty'),
		formReport = require('wpa.util.formReport'),
		config = require('wpa.conf.config'),
		win = config.gWin,
		ENV = config.ENV,
		jsonp = require('util.jsonp'),
		browser = require('lang.browser'),
		extend = require('lang.extend'),
		globalSettings = require('globalSettings'),
		getCPType = require('wpa.proto.getCPType');

	var env = {
			development: 'devadmin.',
			test: 'oaadmin.',
			production: 'admin.'
		},
		domainPrefix = env[globalSettings.debug] || '',
		REPORT_DOMAIN = 'https://' + domainPrefix + 'qidian.qq.com',
		reportUrls = {
			render: '/ar/ActCap/ActRpt',
			click: '/ar/ActCap/ActRpt',
			gdtReport: '/ar/actCap/gdtRpt'
		},
		EVENT_TYPE_LOAD = 1,
		EVENT_TYPE_CLICK = 2,
		cid = 0,
		CB_NAME = 'jsonp_cb_',
		COMMON_REPORT = 'commonReport',
		GDT_REPORT = 'gdtReport',
		hostname = location.hostname;

	//图文详情页里，获取taskid
	var getTaskIdInArticlePage = function() {

		var result = {},
			articleDomains = [
				'post.mp.qq.com',
				'article.mp.qq.com',
				'mp.weixin.qq.com',
				'wap.qidian.qq.com'
			].join(',');

		if (articleDomains.indexOf(hostname) !== -1) {

			//taskid
			var matchedTaskId = location.href.match(/taskid=\d+/);
			result.taskid = matchedTaskId ? matchedTaskId[0].split('=')[1] : 0;

			//sceneid
			var matchedSceneid = location.href.match(/sceneid=\d+/);
			result.sceneid = matchedSceneid ? matchedSceneid[0].split('=')[1] : 0;
		}

		return result;
	};

	var report = function(reportType, params) {

		var reportUrl = REPORT_DOMAIN + reportUrls[reportType];

		//为了给测试验证，不得不写下这段代码
		// if (location.href.indexOf('oaadmin.qidian.qq.com') !== -1 && reportType === GDT_REPORT) {
		// 	win._gdtClickId = 0;
		// 	var data = extend({
		// 		client_id: 54,//写死的，广点通标识
		// 		click_id: 0,
		// 		visitorid: params.guid,
		// 		kfuin: params.fkfuin,
		// 		ldpg: location.href
		// 	}, getCPType(params));
		// 	formReport({
		// 		action: reportUrl,
		// 		data: data
		// 	});
		// 	return;
		// }

		if (reportType === GDT_REPORT && win._gdtReportData != 0) {
			// removeCustomProp(win._gdtReportData);
			formReport({
				action: reportUrl,
				data: win._gdtReportData
			});
			return;
		}

		//判断接待工号，非wpa参数里的kfext（参数里的kfext是创建者工号）
		var actualKfext = params.fkfuin;
		switch (params.cate) {
			//qq接待
			case 1: {
				actualKfext = params.roleQQ.value == 0 ? params.roleQQ.data : actualKfext;
				break;
			}
			//电话接待
			case 2: {
				actualKfext = params.roleTEL.value == 0 ? params.roleTEL.data : actualKfext;
				break;
			}
			//加关注
			case 3: {
				actualKfext = params.rolePUB.uin;
				break;
			}
			//加群，目前还没有做
			case 4: {
				break;
			}
			//加好友
			case 5: {
				actualKfext = params.roleKFEXT.data;
				break;
			}
		}

		var	commonOptions = {
			//mid目前保留，为空字符串
			mid: '',
			//接触点id
			id: params.id,
			//接触点大类型
			cate: params.cate,
			//小类型
			type: params.type,
			//visitorId
			visitorid: params.guid,
			//同visitorid，2016/10/12晚上上线后，就不用qidianid了
			qidianid: params.guid,
			//主号
			kfuin: params.fkfuin,
			//工号
			kfext: actualKfext,
			//落地页
			ldpg: win.location.href,
			//来源页
			refurl: typeof document.referrer !== 'undefined' ? document.referrer : '',
			//浏览器信息
			ua: window.navigator.userAgent,
			//落地页标题
			title: encodeURIComponent(document.title),
			//是pc还是移动端
			eptype: browser.isMobile ? 2 : 1,
			//pid
			pid: params.pid,
			//qid
			qid: params.qid,
			//env
			env: ENV,
			//2017/06/21
			//是否主号接待，目前只有qq接待有
			isKfuin: (params.roleQQ && params.roleQQ.isKfuin) || 0
		};

		//好耶api多上报两个字段
		if (params.customEnterSwitch == 1) {
			commonOptions.qidian_src_desc = encodeURIComponent(win.qidian_src_desc) || '';
			commonOptions.qidian_track_id = win.qidian_track_id || '';
		}

		//如果是图文详情页，还要上报taskid
		//taskid放在url里:taskid=xxx
		//added on 2017/03/14
		//如果是消息助手页，还要上报qfcust的值
		//2017/03/22:qfcust改为sceneid了
		extend(commonOptions, getTaskIdInArticlePage());

		if (reportType === 'render') {
			dataObj = getVisitData(params, commonOptions);
		} else if (reportType === 'click') {
			var tptype = getCPType(params);
			params.tptype = tptype.tptype;
			dataObj = extend({
				eventtp: EVENT_TYPE_CLICK,
				clickType: params.clickType,
				clickid: params.clickid || '',
				tpForm: params.tpForm
			}, extend(commonOptions, tptype));
		} else {
			//todo
			//没有对应的report类型
			return;
		}

		// removeCustomProp(dataObj);
		formReport({
			action: reportUrl,
			data: dataObj
		});
	};

	var getVisitData = function(params, commonOptions) {

		var obj = getCPType(params);
		obj.eventtp = EVENT_TYPE_LOAD;

		return extend(obj, commonOptions);

	};

	// var getClickData = function(params) {

	// 	var obj = {};

	// 	obj['visitorId'] = params.visitorId;
	// 	obj['title'] = encodeURIComponent(document.title);
	// 	obj['url'] = win.location.href;
	// 	obj['clickId'] = params.clickId;

	// 	var tptypeObj = getCPType(params);

	// 	return extend(obj, tptypeObj);

	// };

	exports.report = report;

});
/** src/proto/basicCgiCall.js **/
/**
 * 一些基础cgi的调用函数
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/12/14
 *
 */
LBF.define('wpa.proto.basicCgiCall', function(require, exports, module) {

	var conf = require('wpa.conf.config'),
		win = conf.gWin,
		CGIS = conf.CGIS,
		ENV = conf.ENV,
		WPA = win.__WPA,
		WPAS_BASED_ON_KFUIN = conf.WPAS_BASED_ON_KFUIN,
		log = require('wpa.util.log'),
		removeCustomProp = require('wpa.util.removeCustomProperty'),
		jsonp = require('util.jsonp');

	var TIMEOUT_GAP = 1000,
		IS_GRAY = 1;

	WPA.cgiCalls = {};

	WPA.imUrls = {};

	function setImUrl(options, kfuin) {

		var result = (options && options.isGray) || 0;

		WPA.imUrls[kfuin] = conf.WEB_IM.URL;
		
		if (result == IS_GRAY) {
			conf.WEB_IM.URL = conf.WEB_IM.URL_SCALE;
			WPA.imUrls[kfuin] = conf.WEB_IM.URL_SCALE;
		}

		// 测试环境根据分支变量设置ImUrl
		if (config.isOA) {
			var branch = window.__WEBIM_BRANCH || 'chat';
			conf.WEB_IM.URL = conf.WEB_IM.URL.replace(/chat(-gray)?/, branch);
			WPA.imUrls[kfuin] = conf.WEB_IM.URL;
		}
	}

	function initWpaIm(wpa) {
		// var wpas = WPA[WPAS_BASED_ON_KFUIN];
		// for (var i in wpas) {
		// 	//初始化im，必须要初始化每个im的wpa，否则无法把im的wpa添加到全局的WPAS_IM_TYPE中
		// 	var wpa = wpas[i];
		// 	for (var j = 0, len = wpa.length; j < len; j++) {
		// 		wpa[j].trigger('initIm');
		// 	}
		// }
		wpa.trigger('initIm');
	}

	//canceled: 获取该kfuin下的灰度情况，页面加载一次，只会调用一次
	//此规则不再适用，页面上有几个wpa，就要调用几次
	// var isGrayInfoFetched = false;
		// isGrayInfoCalled = false;
	WPA.cgiCalls.getScaleInfo = exports.getScaleInfo = function(options, wpa) {

		// if (isGrayInfoCalled) {
			// return log('[getScaleInfo] is called already');
		// }
		// isGrayInfoCalled = true;

		options = options || {};

		var isGrayInfoFetched = false;

		var defaultSetting = {
			result: 0
		};

		var kfuin = options.kfuin,
			url = CGIS.GET_SCALE_INFO[ENV],
			timeout = null;

		var cb = function(r) {
			if (isGrayInfoFetched) {
				return log('[getScaleInfo][callback] is fetched already');
			}
			clearTimeout(timeout);
			isGrayInfoFetched = true;

			r = (r && r.result) || 0;

			var result = {
				isGray: r
			};

			//全局设置
			conf.isGray = wpa.env.isGray = r;

			//设置im不同页面地址
			setImUrl(result, kfuin);

			//使wpa初始化im聊天页
			initWpaIm(wpa);

		};

		//todo
		//本地测试地址
		if (conf.isLocal) {
			url = 'http://localhost:3000/isGray';
		}

		var opts = {
			kfuin: kfuin
		};

		// removeCustomProp(opts);

		jsonp(url, opts, cb);
		timeout = setTimeout(function() {
			log('[getScaleInfo]setTimeout executed');
			cb(defaultSetting);
		}, TIMEOUT_GAP);
	};

});
/** src/util/getRootDomain.js **/
/**
 * 获取当前页面的根域名
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/09/19
 *
 */
LBF.define('wpa.util.getRootDomain', function(require, exports, module) {

	var Cookie = require('util.Cookie'),
		conf = require('wpa.conf.config'),
		win = conf.gWin,
		inArray = require('lang.inArray');

	var doc = win.document,
		hostname = win.location.hostname,
		hostnameLength = hostname.length,
		domains = hostname.split('.'),
		domainLength = domains.length,
		subDomain = '',
		EXPIRES = 1000 * 60 * 60 * 24 * 365,
		ROOT_DOMAIN_NAME = '__root_domain_v',
		isCookieEnabled = win.navigator.cookieEnabled,
		rootDomain;

	//这些根域名不能种cookie
	//已知的是.qq.com
	var domainBlackList = [
		'.qq.com'
	];

	var getRootDomain = function() {

		//本来打算把已经获取的根域名存放在用户网站的cookie里的
		//但考虑到可能被恶意篡改
		//所以决定每次打开页面的时候
		//计算根域名
		// rootDomain = Cookie.get(ROOT_DOMAIN_NAME);

		// if (rootDomain) {
		// 	return rootDomain;
		// }

		for (var i = domainLength - 1; i >= 0; i--) {
			subDomain = '.' + domains[i] + subDomain;
			if (inArray(subDomain, domainBlackList) !== -1) {
				continue;
			}
			Cookie.set(ROOT_DOMAIN_NAME, subDomain, subDomain, '/', EXPIRES);
			if (Cookie.get(ROOT_DOMAIN_NAME)) {
				rootDomain = subDomain;
				break;
			}
		}
		//所有尝试都失败的情况下
		//直接返回初始值
		//代表不设置domain，直接种当前域名

		return rootDomain;
	};

	exports.getRootDomain = getRootDomain;
	exports.isCookieEnabled = isCookieEnabled;

});
/** src/util/ids.js **/
/**
 * 生成各种id
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/09/19
 */
LBF.define('wpa.util.ids', function(require, exports, module) {

    var conf = require('wpa.conf.config'),
        win = conf.gWin,
        doc = win.document,
        QID_PREFIX = 'QD.';

    var base36 = function (num) {
        return num.toString(36);
    };

    /**
     * 将字符串转换成一个数字
     * 同一个字符串的输入转换结果是固定的
     * 通常用于将随机字符串转换成数字，然后计算概率
     * @param {string} str input string.
     * @return {number} hash number.
     */
    var hash = function (str) {
        var hash = 1;
        if (str) {
            var charCode = 0;
            hash = 0;
            for (var i = str.length - 1; i >= 0; i--) {
                charCode = str.charCodeAt(i);
                hash = (hash << 6 & 268435455) + charCode + (charCode << 14);
                charCode = hash & 266338304;
                /* eslint eqeqeq: 0 */
                hash = charCode != 0 ? hash ^ charCode >> 21 : hash;
            }
        }
        return hash;
    };

    /**
     * 生成随机字符串
     * @return {number}
     */
    var random = function () {
        var random;
        // https://zh.wikipedia.org/wiki/2147483647
        // 2147483647 === 1111111111111111111111111111111
        try {
            var arr = new Uint32Array(1);
            // https://developer.mozilla.org/en-US/docs/Web/API/RandomSource/getRandomValues
            win.crypto.getRandomValues(arr);
            random = arr[0] & 2147483647;
        }
        catch (b) {
            random = Math.floor(Math.random() * 2147483648);
        }
        return random;
    };

    var createPid = function (needPrefix) {
        var uaAndCookieAndRefAndHref = win.navigator.userAgent
            + (doc.cookie ? doc.cookie : '')
            + (doc.referrer ? doc.referrer : '')
            + win.location.href;
        // 样例
        var result = base36(random() ^ hash(uaAndCookieAndRefAndHref) & 2147483647) + '.' + base36(random()) + '.' + base36(+new Date());
        return needPrefix ? QID_PREFIX + result : result;
    };

    var createClickId = createPid;

    // var createQid = function(needPrefix) {
    //     var result = base36(hash(win.location.href)) + '.' + random() + '.' + base36(+new Date());
    //     return needPrefix ? QID_PREFIX + result : result;
    // };
    var createQid = createPid;

    /**
     * 生成访客Id
     * http://tapd.oa.com/10109441/prong/stories/view/1010109441064388087
     * @return {string}
     */
    var createRandomId = function () {
        var chars = '0123456789',
            randomId = [], i;

        randomId[0] = (0 | Math.random() * 10) || 1;

        for (i = 1; i < 4; i++) {
            randomId[i] = chars[0 | Math.random() * 10];
        }

        return randomId.join('') + new Date().getTime().toString().slice(2, 13)
    }

    exports.createPid = createPid;
    exports.createClickId = createClickId;
    exports.createQid = createQid;
    exports.createRandomId = createRandomId;
});


/** src/util/log.js **/
LBF.define('wpa.util.log', function() {

	return function(str) {
		if (typeof console !== 'undefined' && typeof console.log === 'function') {
			console.log(str);
		}
	};
});
/** lib/lbf/util/Cookie.js **/
/**
 * @fileOverview
 * @author amoschen
 * @version 1
 * Created: 12-8-27 下午8:26
 */
LBF.define('util.Cookie', function(){
    var doc = document,
        isCookieAllowed = true;

    //cookie access test
    try {
        var c = doc.cookie;
    } catch (e) {
        isCookieAllowed = false;
    }

    /**
     * Cookie utilities
     * @class Cookie
     * @namespace util
     * @module util
     */
    return {
        /**
         * Set a cookie item
         * @method set
         * @static
         * @param {String} name Cookie name
         * @param {*} value Cookie value
         * @param {String} [domain=fullDomain] The domain cookie store in
         * @param {String} [path=currentPath] The path cookie store in
         * @param {Date} [expires=sessionTime] The expire time of cookie
         * @chainable
         */
        set: !isCookieAllowed ? function() {} : function(name, value, domain, path, expires){
            if(expires){
                expires = new Date(+new Date() + expires);
            }

            var tempcookie = name + '=' + escape(value) +
                ((expires) ? '; expires=' + expires.toGMTString() : '') +
                ((path) ? '; path=' + path : '') +
                ((domain) ? '; domain=' + domain : '');

            //Ensure the cookie's size is under the limitation
            if(tempcookie.length < 4096) {
                doc.cookie = tempcookie;
            }

            return this;
        },

        /**
         * Get value of a cookie item
         * @method get
         * @static
         * @param {String} name Cookie name
         * @return {String|Null}
         */
        get: !isCookieAllowed ? function() {return '';} : function(name){
            var carr = doc.cookie.match(new RegExp("(^| )" + name + "=([^;]*)(;|$)"));
            if (carr != null){
                return unescape(carr[2]);
            }

            return null;
        },

        /**
         * Delete a cookie item
         * @method del
         * @static
         * @param {String} name Cookie name
         * @param {String} [domain=fullDomain] The domain cookie store in
         * @param {String} [path=currentPath] The path cookie store in
         * @chainable
         */
        del: !isCookieAllowed ? function() {} : function(name, domain, path){
            if (this.get(name)){
                doc.cookie = name + '=' +
                    ((path) ? '; path=' + path : '') +
                    ((domain) ? '; domain=' + domain : '') +
                    ";expires=Thu, 01-Jan-1970 00:00:01 GMT";
            }

            return this;
        },

        /**
         * Find certain string in cookie with regexp
         * @method find
         * @static
         * @param {RegExp} pattern
         * @return {Array|Null} RegExp matches
         * @example
         *      // assume cookie is like below
         *      // ts_uid=5458535332; ptui_loginuin=mice530@qq.com; Hm_lvt_bb8beb2d26e5d753995874b8b827291d=1367826377,1369234241;
         *      Cookie.find(/ptui_loginuin=([\S]*);/); // returns ["ptui_loginuin=mice530@qq.com;", "mice530@qq.com"]
         */
        find: !isCookieAllowed ? function() {} : function(pattern){
            return doc.cookie.match(pattern);
        }
    };
});
/** src/proto/chat.js **/
/*
 * WPA chat
 * @author: amoschen
 * @version: 0.0.1
 * @date: 2014/08/19
 */
LBF.define('wpa.proto.chat', function(require, exports, module){
	// todo
	// check browser.isIOS ...
	var browser = require('lang.browser'),
		chatProtocol = require('wpa.protocol.chat'),
		chatConst = require('wpa.conf.chat'),
		getQQVersion = require('wpa.protocol.getQQVersion'),
		chatSelect = require('wpa.proto.chatSelect'),
        proxy = require('lang.proxy'),
        conf = require('wpa.conf.config'),
        report = require('util.report'),
        win = conf.gWin,
        log = require('wpa.util.log'),
        href = win.location.href,
        parseQS = require('wpa.util.parseQuerystring'),
        //呼起手q并跳转到指定页
        openMqqPage = require('wpa.util.openMqqPage');

    var ERROR_MSG_PC_NOT_ALLOWED = '仅支持移动端咨询，请重新使用手机QQ发起咨询',
        LAUNCH_MOBILE_QQ = chatConst.LAUNCH_MOBILE_QQ;

	/**
	 * @method chat
	 * @param {Object} params
	 * @param {}
	 */
	exports.chat = function(cb){
        var wpa = this,
            onChat = proxy(function(){
                cb && cb.apply(this, arguments);
                this.trigger('chat');
            }, this),
            isMobile = browser.isIOS || browser.isAndroid,
            onlyMobile = this.params.onlyMobile;

        var type = parseInt(this.params.chatType || chatConst.CHAT_TYPE_AUTO, 10);

        var kfuin = this.params.fkfuin,
            visitorId = this.params.guid,
            wpaId = this.params.id,
            pid = this.params.pid,
            qid = this.params.qid,
            key = this.params.key,
            clickid = this.params.clickid,
            roleValue = this.params.roleValue,
            roleData = this.params.roleData,
            env = '';

        if (conf.ENV == 'development') {
            env = 'dev';
        } else if (conf.ENV == 'test') {
            env = 'oa';
        }

        //api型wpa，视频逻辑
        if (this.params.videoSwitch == 1) {
            //目前只是在移动端执行
            if (!isMobile) {
                return;
            }
            var reportUrl = 'https://' + env + 'lbs.qidian.qq.com/videomp/openaio';
            //2017/04/20:此类型的接触点一定是在手q里打开，同时第三方url里会添加标识到qs里
            //调用cgi的时候，加这个标识为cgi的参数
            //2017/04/21:确认了之前的参数废弃，新的参数为qs里的_appid(纯数字)和code(数字和字母)
            try {
                var _appid = href.match(/_appid=\d+/)[0].split('=')[1],
                    _code = href.match(/code=[a-z0-9]+/i)[0].split('=')[1];
                reportUrl += '?appid=' + _appid + '&code=' + _code;
                report(reportUrl);
            } catch (e) {
                log('[chat.js][videoSwitch]get params error');
            }

            return;
        }

        //开放customEnterSwitch功能
        if (this.params.customEnterSwitch == 1) {

            var mediaId = this.params.mediaId,
                lbsUrl = 'https://' + env + 'lbs.qidian.qq.com/authorize/show';

            //2017/08/23:语音接触点
            //目前只开放移动端
            if (this.params.voice) {
                if (!isMobile) {
                    return alert('暂不支持PC端打开');
                }
                lbsUrl = conf.PAGES.VOICE_JUMP_PAGE;
                lbsUrl += '?id=' + wpaId + '&roleData=' + roleData + '&roleValue=' + roleValue + '&key=' + key + '&qid=' + qid + '&pid=' + pid + '&voice=1&clickid=' + clickid + '&mediaId=' + mediaId + '&visitorId=' + visitorId + '&kfuin=' + kfuin + '&_bid=2399';
                return win.location.href = LAUNCH_MOBILE_QQ + '?mqqPage=' + lbsUrl;
            }

            if (this.params.paramSwitch) {
                lbsUrl = 'https://' + env + 'lbs.qidian.qq.com/location/update';
                var qidian_track_id = window.qidian_track_id || '',
                    qidian_src_desc = window.qidian_src_desc || '',
                    qidian_ex1 = window.qidian_ex1 || '',
                    qidian_ex2 = window.qidian_ex2 || '',
                    qidian_ex3 = window.qidian_ex3 || '',
                    qidian_ex4 = window.qidian_ex4 || '',
                    qidian_ex5 = window.qidian_ex5 || '',
                    guestId = window.guestId || '';

                // lbsUrl += '?cb=lbs_cb&type=2&wpaId=' + wpaId + '&mediaId=' + mediaId + '&isMobile=' + (isMobile ? 1 : 0) +
                //         '&kfuin=' + kfuin + '&visitorId=' + visitorId +
                //         '&roleData=' + roleData + '&roleValue=' + roleValue +
                //         '&qidian_track_id=' + qidian_track_id + '&qidian_src_desc=' + qidian_src_desc + '&qidian_ex1=' + qidian_ex1 +
                //         '&qidian_ex2=' + qidian_ex2 + '&qidian_ex3=' + qidian_ex3 + '&qidian_ex4=' + qidian_ex4 + '&qidian_ex5=' + qidian_ex5 + '&clickid=' + clickid + '&wpa_type=' +
                //             (this.params.LBSswitch ? 1 : 2) + '&pid=' + pid + '&key=' + key  + '&qid=' + qid;
                // var img = new Image();
                // img.src = lbsUrl;
                // document.body.appendChild(img);
                var lbsDataStr = 'cb=lbs_cb&guestId=' + guestId + '&type=2&wpaId=' + wpaId + '&mediaId=' + mediaId + '&isMobile=' + (isMobile ? 1 : 0) +
                        '&kfuin=' + kfuin + '&visitorId=' + visitorId +
                        '&roleData=' + roleData + '&roleValue=' + roleValue +
                        '&qidian_track_id=' + qidian_track_id + '&qidian_src_desc=' + qidian_src_desc + '&qidian_ex1=' + qidian_ex1 +
                        '&qidian_ex2=' + qidian_ex2 + '&qidian_ex3=' + qidian_ex3 + '&qidian_ex4=' + qidian_ex4 + '&qidian_ex5=' + qidian_ex5 + '&clickid=' + clickid + '&wpa_type=' +
                            (this.params.LBSswitch ? 1 : 2) + '&pid=' + pid + '&key=' + key  + '&qid=' + qid,
                    lbsData = parseQS(lbsDataStr);

                chatProtocol.LBSChat(lbsData, lbsUrl);
                return;
            }

            lbsUrl += '?id=' + wpaId + '&roleData=' + roleData + '&roleValue=' + roleValue + '&key=' + key + '&qid=' + qid + '&pid=' + pid +
            '&clickid=' + this.params.clickid + '&mediaId=' + mediaId + '&visitorId=' + visitorId + '&kfuin=' + kfuin + '&_bid=2399';

            if (!isMobile) {//pc端直接跳新页面
                win.open(lbsUrl);
            } else {//移动端
                //这里先跳中间页再呼起了，而不是直接打开手q
                //openMqqPage(lbsUrl);
                win.location.href = LAUNCH_MOBILE_QQ + '?fid=' + wpaId + '&roleData=' + roleData + '&roleValue=' + roleValue + '&key=' + key + '&kfuin=' + kfuin + '&cate=1&mqqPage=' + lbsUrl;
            }

            return;
        }

        //仅允许移动端呼起的判断
        if (onlyMobile && !isMobile) {
            //公众号接待只能移动端呼起
            //跳转到二维码页面
            if (this.params.isPub) {
                var url = conf.host + '/template/blue/wpa/launch-qr-code.html?qrCodeImg=' + this.params.qrCodeImg;
                if (conf.ENV === 'development') {
                    url = 'https://dev' + url;
                } else if (conf.ENV === 'test') {
                    url = 'https://oa' + url;
                } else {
                    url = 'https://' + url;
                }
                return window.open(url);
            }
            return alert(ERROR_MSG_PC_NOT_ALLOWED);
        }

        if( isMobile ) {
            return this.mobileChat(onChat);
        }

        if(type === chatConst.CHAT_TYPE_QQ){
            return this.PCChat(onChat);
        }

        //2017/05/05:ie里判断qq是否安装的插件在不同ie下表现不同
        //很不稳定，这里去掉ie插件的判断
        return this.PCChat(onChat);

        // since QQ browser plugin is not reliable
        // always try to launch AIO chat
        // no ie browser launch without checking QQ version
        //!browser.msie && this.PCChat(onChat);
        if (!browser.msie) {
            return this.PCChat(onChat);
        }

        getQQVersion(function(version){
            if(version){
                // ie browser won't be launched unless QQ is install for sure
                // otherwise page may be redirected to schema on error case when QQ not installed
                browser.msie && wpa.PCChat(onChat);
                return;
            }

            // show selections for user when no version detected ( not sure QQ exists or not)
            new chatSelect({
                //QQ已安装，点击会话
                onAIOChat: function(){
                    wpa.PCChat(onChat);
                },

                //未安装，发起网页会话
                onAnonyChat: function(){
                    wpa.anonyChat(onChat);
                }
            });
        });
	};

	exports.PCChat = function(onChat){
        var wpa = this;
		chatProtocol.PCChat(this.params, function(){
            onChat.apply(wpa, arguments);
            wpa.trigger('PCChat');
        });
	};

	exports.mobileChat = function(onChat){
        var wpa = this;
        //todo
        //mobile device will import mqq lib
        //judge it when it is in mobile qq to ignore jumping page
        //and call mobile qq directly
		chatProtocol.mobileChat(this.params, function(){
            onChat.apply(wpa, arguments);
            wpa.trigger('mobileChat');
        });
	};

    /*************企点无匿名聊天和linkChat start*********************/
	exports.anonyChat = function(onChat){
        var wpa = this;
		chatProtocol.anonyChat(this.params, function(){
            onChat.apply(wpa, arguments);
            wpa.trigger('anonyChat');
        });
	};

    exports.linkChat = function(onChat){
        var wpa = this;
        chatProtocol.linkChat(this.params, function(){
            onChat.apply(wpa, arguments);
            wpa.trigger('linkChat');
        });
    }
    /*************企点无匿名聊天和linkChat end*********************/
});

/** src/proto/phone.js **/
/*
 * 呼起来电
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/01/21
 */
LBF.define('wpa.proto.phone', function(require, exports, module){

	var browser = require('lang.browser'),
		jsonp = require('util.jsonp'),
        isFunction = require('lang.isFunction'),
		conf = require('wpa.conf.config'),
        isInMobileQQ = conf.BROWSER_ENV.isInMobileQQ,
        win = conf.gWin;

	 /**************企点新cgi地址start**********************/
    var CGIS = conf.CGIS,
        TYPE_PC = 0,
        TYPE_MOBILE = 1,
        isMobile = browser.isMobile,
        ENV = conf.ENV,
        envMapping = {
            development: 'devadmin.',
            test: 'oaadmin.',
            production: 'admin.'
        };
    /**************企点新cgi地址end**********************/

    var ua = navigator.userAgent.toLowerCase(),

        body = document.getElementsByTagName('body')[0];

	exports.phone = function(cb) {

		var params = this.params;

		//来电目前只能在移动端有作用
		//pc端先禁止
		if (!isMobile) {
			return alert('来电仅限移动端呼起');
		}

		// var opts = {
  //               kfuin: params.fkfuin,
  //               kfext: params.fkfext,
  //               visitorId: params.guid,
  //               fid: params.id,
  //               key: params.key,
  //               cate: params.cate,
  //               type: params.type,
  //               ftype: TYPE_MOBILE,
  //               roleKey: params.roleKey,
  //               roleValue: params.roleValue,
  //               // roleName: params.roleName,
  //               roleUin: params.roleUin,
  //               roleData: params.roleData
  //           },
        var URL = 'https://' + envMapping[ENV] + 'qidian.qq.com/lighttalk/CallCheck?source=1&wpaId=' + params.id + '&id=' + params.fkfuin + '&vid=' + params.guid + '&cate=' + params.cate + '&wpa_type=' + params.type + '&pid=' + params.pid + '&clickid=' + params.clickid + '&qid=' + params.qid + '&sourceUrl=' + win.location.href + '&refurl=' + (typeof document.referrer !== 'undefined' ? document.referrer : ''),
            LANDING_URL = 'https://' + envMapping[ENV] + 'qidian.qq.com/template/blue/mp/menu/wx-jump-phone.html?url=' + encodeURIComponent(URL);

        //这里延迟跳转是为了uiEvent里的click上报
        setTimeout(function() {
            if (isInMobileQQ) {
                return win.location.href = URL;
            }
            return win.location.href = LANDING_URL;
        }, 500);
        // return win.location.href = LANDING_URL;
        return;
 
        //呼起手Q
        if (!isInMobileQQ) {//不在手Q内嵌页
            // var schema = getURL(URL);
            var schema = getURL(LANDING_URL);

            if (browser.isIOS) {
                return win.location.href = schema;
            }
            var div = document.createElement('div'),
                start = +new Date();

            div.style.visibility = 'hidden';
            div.style.width = 0;
            div.style.height = 0;


            div.innerHTML = '<iframe id="schema" src="' + schema + '" scrolling="no" width="0" height="0"></iframe>';

            body.appendChild(div);

            setTimeout(function(){
                var gap = +new Date() - start;

                // gap above 1000ms seen as manual return
                if(gap < 1000){
                    
                }

                // clean up div
                body.removeChild(div);

                isFunction(cb) && cb(params);
            }, 800);
        } else {//在手Q内嵌页
            win.location.href = URL;
        }

        function getURL(jumpURL) {
            var androidVersion = ua.match(/android\s\d\.\d\.\d/);
            androidVersion = androidVersion ? androidVersion[0].replace('android ', '') : '0.0.0';
            /*!*********************************************/
            //这里总是返回mqqapi的协议
            //测试了安卓5.0的手机，发现intent不行
            if (0 && browser.isAndroid && androidVersion > '5') {//感谢 ivanxu 提供的条件~
                //安卓 5.0 后改用 chrome 作为默认浏览器，scheme 地址有变
                return  "intent://forward/url?src_type=web&style=default&=1&version=1&url_prefix=" + btoa(jumpURL) + "#Intent;scheme=mqqapi;package=com.tencent.mobileqq;end";
            } else {
                return  'mqqapi://forward/url?src_type=web&style=default&=1&version=1&url_prefix=' + btoa(jumpURL);
            }
        }
	};
});
/** src/proto/add.js **/
/*
 * 加好友、群、关注
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/01/21
 */
LBF.define('wpa.proto.add', function(require, exports, module){

	var browser = require('lang.browser'),
		jsonp = require('util.jsonp'),
		chatConst = require('wpa.conf.chat'),
        isFunction = require('lang.isFunction'),
        serialize = require('util.serialize'),
		conf = require('wpa.conf.config'),
        CLICK_TYPE = conf.CLICK_TYPE,
        launch = require('wpa.util.launch'),
        eptype = conf.eptype,
        removeCustomProp = require('wpa.util.removeCustomProperty'),
        win = conf.gWin;

	var CGIS = conf.CGIS,
        TYPE_PC = 0,
        TYPE_MOBILE = 1,
        isMobile = browser.isMobile,
        isInMobileQQ = conf.BROWSER_ENV.isInMobileQQ,
        ENV = conf.ENV,
        envMapping = {
            development: 'devadmin.',
            test: 'oaadmin.',
            production: 'admin.'
        },
        LAUNCH_MOBILE_QQ = chatConst.LAUNCH_MOBILE_QQ;

    var ua = navigator.userAgent.toLowerCase(),
        body = document.getElementsByTagName('body')[0];

	//加好友
	exports.addPal = function(cb) {

		// pc端先禁止
		// if (!browser.isMobile && !(conf.isOA || conf.isDev || conf.isLocal)) {
		// 	return alert('加好友仅限移动端呼起');
		// }

		var params = this.params,
			opts = {
                kfuin: params.fkfuin,
                kfext: params.fkfext,
                visitorId: params.guid,
                visitorid: params.guid,
                fid: params.id,
                key: params.key,
                cate: params.cate,
                type: params.type,
                ftype: isMobile ? TYPE_MOBILE : TYPE_PC,
                pid: params.pid,
                clickid: params.clickid,
                tpForm: params.tpForm,
                qid: params.qid,
                env: ENV,
                eptype: eptype,
                tptype: params.tptype,
                clickType: params.clickType,
                roleKey: params.roleKey,
                roleValue: params.roleValue,
                // roleName: params.roleName,
                roleUin: params.roleUin,
                roleData: params.roleData
            };

        // removeCustomProp(opts);

		jsonp(CGIS.GET_SIGT[ENV], opts, function(rs){
            if(!rs || rs.r !== 0 || !rs.data){
                // todo
                // logger
                return alert(rs.data.message || ERROR_MSG_INVALID_STAFF);
            }

            var schema = rs.data.sign;
            if (isInMobileQQ) {
                return win.location.href = schema;
            }
            if (!isMobile) {
                return launch(schema, {
                    needMobileJump: true,
                    targetPage: LAUNCH_MOBILE_QQ
                });
            }
            return win.location.href = LAUNCH_MOBILE_QQ + '?kfuin=' + params.fkfuin + '&fid=' + params.id + '&key=' + params.key + '&protocol=' + schema;
        });
	};

	//加群
	exports.addGroup = function(cb) {

		var params = this.params,
			opts = {
                kfuin: params.fkfuin,
                kfext: params.fkfext,
                visitorId: params.guid,
                visitorid: params.guid,
                fid: params.id,
                key: params.key,
                cate: params.cate,
                type: params.type,
                ftype: isMobile ? TYPE_MOBILE : TYPE_PC,
                pid: params.pid,
                clickid: params.clickid,
                tpForm: params.tpForm,
                qid: params.qid,
                env: ENV,
                eptype: eptype,
                tptype: params.tptype,
                clickType: params.clickType,
                roleKey: params.roleKey,
                roleValue: params.roleValue,
                // roleName: params.roleName,
                roleUin: params.roleUin,
                roleData: params.roleData
            };

        // removeCustomProp(opts);

		jsonp(CGIS.GET_SIGT[ENV], opts, function(rs){
            if(!rs || rs.r !== 0 || !rs.data){
                // todo
                // logger
                return alert(rs.data.message || ERROR_MSG_INVALID_STAFF);
            }

            var schema = rs.data.sign;
            if (isInMobileQQ) {
                return win.location.href = schema;
            }
            if (!isMobile) {
                return launch(schema, {
                    needMobileJump: true,
                    targetPage: LAUNCH_MOBILE_QQ
                });
            }
            return win.location.href = LAUNCH_MOBILE_QQ + '?kfuin=' + params.fkfuin + '&fid=' + params.id + '&key=' + params.key + '&protocol=' + schema;
        });
	};

	//加关注
	exports.addFan = function(cb) {

		//来电目前只能在移动端有作用
		//pc端先禁止
		if (!browser.isMobile) {
			return alert('加关注仅限移动端呼起');
		}

		var params = this.params,
			opts = {
                kfuin: params.fkfuin,
                kfext: params.fkfext,
                visitorId: params.guid,
                visitorid: params.guid,
                fid: params.id,
                key: params.key,
                cate: params.cate,
                type: params.type,
                ftype: TYPE_MOBILE,
                pid: params.pid,
                clickid: params.clickid,
                tpForm: params.tpForm,
                qid: params.qid,
                env: ENV,
                eptype: eptype,
                clickType: params.clickType,
                tptype: params.tptype,
                roleKey: params.roleKey,
                roleValue: params.roleValue,
                // roleName: params.roleName,
                roleUin: params.roleUin,
                roleData: params.roleData
            };

        // removeCustomProp(opts);

		jsonp(CGIS.GET_SIGT[ENV], opts, function(rs){
            if(!rs || rs.r !== 0 || !rs.data){
                // todo
                // logger
                return alert(rs.data.message || ERROR_MSG_INVALID_STAFF);
            }

            var schema = rs.data.sign;
            if (isInMobileQQ) {
                return win.location.href = schema;
            }
            return win.location.href = LAUNCH_MOBILE_QQ + '?' + serialize(opts) + '&protocol=' + schema;
        });
	};

	function getURL(jumpURL) {
        var androidVersion = ua.match(/android\s\d\.\d\.\d/);
        androidVersion = androidVersion ? androidVersion[0].replace('android ', '') : '0.0.0';
        if (browser.isAndroid && androidVersion > '5') {//感谢 ivanxu 提供的条件~
            //安卓 5.0 后改用 chrome 作为默认浏览器，scheme 地址有变
            return  "intent://forward/url?src_type=web&style=default&=1&version=1&url_prefix=" + btoa(jumpURL) + "#Intent;scheme=mqqapi;package=com.tencent.mobileqq;end";
        } else {
            return  'mqqapi://forward/url?src_type=web&style=default&=1&version=1&url_prefix=' + btoa(jumpURL);
        }
    }

});
/** src/proto/im.js **/
/**
 * web im接待
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/09/22
 *
 * DOM型wpa在新开窗口打开webim时补上自定义参数
 * @author: oliverbi
 * @version: 1.0.1
 * @date: 2018/07/24
 *
 * webim添加设置属性方法
 * @author: oliverbi
 * @version: 1.0.2
 * @date: 2018/08/03
 *
 * 呼起webim增加语言参数
 * @author: oliverbi
 * @version: 1.0.3
 * @date: 2018/08/06
 */
LBF.define('wpa.proto.im', function(require, exports, module) {

	var conf = require('wpa.conf.config'),
		eptype = conf.eptype,
		KFUINS = conf.KFUINS,
		POST_MESSAGE_FLAG = conf.POST_MESSAGE_FLAG,
        POST_MESSAGE_FLAG_CONTENT = conf.POST_MESSAGE_FLAG_CONTENT,
		CLICK_TYPE = conf.CLICK_TYPE,
		isInAdmin = conf.isInAdmin,
		isMobile = conf.isMobile,
		localStorage = require('util.localStorage'),
		INVITATION_TYPE = conf.INVITATION_TYPE,
		extend = require('lang.extend'),
		ACTS = conf.WEB_IM.ACTS,
		SCROLL_TOP_NAME = conf.SCROLL_TOP_NAME,
		WEB_IM = conf.WEB_IM,
		WEB_IM_IFRAME_ID = WEB_IM.WEB_IM_IFRAME_ID,
		WPAS_IM_TYPE = WEB_IM.WPAS_IM_TYPE,
		GLOBAL_WPA_NAME = conf.GLOBAL_WPA,
		UNREAD_MSG_INFO = conf.UNREAD_MSG_INFO,
		POSITION_HELP_EL = conf.WEB_IM.POSITION_HELP_EL,
		GLOBAL_INVITE_TPL_AND_CONF = conf.GLOBAL_INVITE_TPL_AND_CONF,
		WEB_IM_IFRAMES_LOADED = conf.WEB_IM.WEB_IM_IFRAMES_LOADED,
		log = require('wpa.util.log'),
		offset = require('wpa.util.offset'),
		winWidth = offset.getClientWidth(),
		winHeight = offset.getClientHeight(),
		domEvent = require('wpa.util.domEvent'),
		UnreadMsgCircle = require('wpa.proto.UnreadMsgCircle'),
		Invite = require('wpa.invite.main'),
		ids = require('wpa.util.ids'),
		browser = require('lang.browser'),
		CustomParams = require('wpa.proto.CustomParams'),
		JSON = require('lang.JSON'),
        lang = require('wpa.im.lang'),
        LANG_KEY = conf.IM_LANG.key;

	var win = conf.gWin,
		doc = win.document,
		body = doc.body,
		closeStyleOffset = {
			x: 10,
			y: 10
		},
		originalTopBodyCssText;

	var QD_WPA_BODY_CLASS_NAME = 'QD_WPA_BODY_CLASS_NAME',
		QD_WPA_STYLE_NODE_ID = 'QD_WPA_STYLE_NODE';

	var preventEvent = function(e) {
		e && typeof e.preventDefault === 'function' && e.preventDefault();
	};

	win[SCROLL_TOP_NAME] = typeof win[SCROLL_TOP_NAME] !== 'undefined' ? win[SCROLL_TOP_NAME] : 0;

	var iframeSizeInPC = (function () {
		var height = 600;
		if (winHeight > 900) { // 针对PC的非链接型webim会话容口高度，做动态判断（腾讯云生态大会期间，设计、交互、产品一起决定的，且结论是这个是通用化方案）
			height = 700;
		}
		return {
			height: height
		}
	})();

	var styles = {
			mobile: {
				open: [
					'right:0;'
				].join(''),
				close: [
					// 'right:-' + (winWidth + closeStyleOffset.x) + 'px;'
					//modified by vergil on 2017/12/21
					//解决iphone的safari下切换横屏纵屏时，webim聊天框会漏出来的问题
					//强制设为5000px
					//im的init里，移动端初始的right值要跟这里的right一致
					'right:-3000px;'
				].join('')
			},
			pc: {
				open: [
					'right:10px',
					'bottom:10px',
					'width:360px',
					'height:' + iframeSizeInPC.height + 'px',
					'border-bottom-left-radius:6px',
					'border-bottom-right-radius:6px',
					'display:block'
				].join(';') + ';',
				close: [
					'width:300px',
					'height:50px',
					'bottom:0'
				].join(';') + ';'
			}
		},
		openStyle = isMobile ? styles.mobile.open : styles.pc.open,
		closeStyle = isMobile ? styles.mobile.close : styles.pc.close;

	//根据kfuin和id获取目标wpa
	var getTarget = function(options) {
		var kfuin = options.kfuin,
			// id = options.id,
			// iden = kfuin + '_' + id,
			// wpa = win[GLOBAL_WPA_NAME][iden],
			imIframe = doc.getElementById(WEB_IM_IFRAME_ID + kfuin);

		return {
			// wpa: wpa,
			imIframe: imIframe
		};

	};

	exports.openChatIframe = function(options) {

		options = options || {};

		var isClickWpa = options.isClickWpa,
			invitationType = options.invitationType,
			seq = options.seq,
			B2Ckey = options.key,
			type = options.type,
			receptionUin = options.receptionUin,
			receptionName = options.receptionName || '',
			//isDirectOpen代表手动邀请直接打开聊天框
			//不带wpa相关信息，也无法获取
			isDirectOpen = options.isDirectOpen,
			//onlyOpen表示仅弹出pc im框
			onlyOpen = options.onlyOpen,
			isB2C = options.isB2C,
			sendMsg;

		var params = (isDirectOpen || onlyOpen) ? options : (this.params || {}),
			kfuin = params.fkfuin || params.kfuin || options.kfuin,
			target = getTarget({
				kfuin: kfuin
			}),
			imIframe = target.imIframe,
			id = params.id,
			visitorid = params.guid,
			roleIM = params.roleIM || params.roleQQ || {},
			roleValue = roleIM.value,
			roleData = roleIM.data,
			wpaKey = params.key,
			clickid = options.clickid || params.clickid || ids.createClickId(),
			gvid = visitorid || localStorage.getItem(conf.tencentSig) || localStorage.getItem('tencentSig'),
			translateSwitch = params.translateSwitch || 0;

		//如果iframe没加载好，就不打开
		if (!win[WEB_IM_IFRAMES_LOADED][kfuin]) {
			return log(kfuin + ' webim iframe is still initing...');
		}

		//点击wpa图标
		if (isClickWpa) {
			var _params = this.params,
				clickWpaReportObj = {
					cate: _params.cate,
					type: _params.type,
					pid: _params.pid,
					qid: _params.qid,
					clickType: _params.clickType,
					tptype: _params.tptype,
					tpForm: _params.tpForm,
					eptype: eptype
				};
		}

		// this.removeUnreadMsgCircle(kfuin);

		//同一个kfuin的所有小红点都要移除
		if (isMobile) {
			UnreadMsgCircle.removeAllRedCircles(kfuin);
		}

		//pc端移除sm_unread来的unread.socket
		if (win.__WPA[KFUINS] && win.__WPA[KFUINS][kfuin] && win.__WPA[KFUINS][kfuin].unread) {
			win.__WPA[KFUINS][kfuin].unread.socket = 0;
		}

		Invite.clearInvitePanel({
			kfuin: kfuin
		});

		if (!imIframe || imIframe.getAttribute('data-isOpen') == 1) {
			return log('[im.js]no im iframe found');
		}

		win.__WPA.IM_CHAT_IFRAME_OPENING = 1;

		/*********打开聊天框的页面展示部分开始********/
		if (isMobile) {

			/*uc浏览器要做特殊处理
			  打开webim的iframe时隐藏第三方页面的所有元素同时背景设置为白色
			  关闭webim的iframe时再还原
			*/
			if (conf.ua.indexOf('ucbrowser') !== -1) {
				if (!doc.getElementById(QD_WPA_STYLE_NODE_ID)) {
					var hiddenOriginalBodyStyle = doc.createElement('style');
				    hiddenOriginalBodyStyle.type = 'text/css';
				    hiddenOriginalBodyStyle.id = QD_WPA_STYLE_NODE_ID;

				    var parent = doc.getElementsByTagName('body')[0];
				    parent.insertBefore(hiddenOriginalBodyStyle, parent.firstChild);

				    var hiddenOriginalBodyCssText = '.' + QD_WPA_BODY_CLASS_NAME + ' > * {visibility:hidden!important;}.' + QD_WPA_BODY_CLASS_NAME + ' {background: white!important;}';

				    if(hiddenOriginalBodyStyle.styleSheet){
				        hiddenOriginalBodyStyle.styleSheet.cssText = hiddenOriginalBodyCssText;
				    } else {
				        hiddenOriginalBodyStyle.appendChild(doc.createTextNode(hiddenOriginalBodyCssText));
				    }
				}
				body.className += ' ' + QD_WPA_BODY_CLASS_NAME;
			}


			originalTopBodyCssText = win.document.body.style.cssText;

			win[SCROLL_TOP_NAME] = offset.getNewScrollTop();
			// var p = win[POSITION_HELP_EL];
			// if (p) {
			// 	p.style.cssText += 'display: block!important;';
			// 	p.scrollIntoView();
			// }
			win.document.body.style.cssText += 'position:fixed;left:0;top:0;width:100%;';
			domEvent.addEvent(top, 'touchmove', preventEvent);

		}
		imIframe.style.cssText += openStyle;
		imIframe.setAttribute('data-isOpen', '1');
		/*********打开聊天框的页面展示部分结束********/

		if (win.wpaShowItemId) {
			options.wpaShowItemId = win.wpaShowItemId;
		}

		if (options.openUnread) {
			options.act = ACTS.OPEN;
			options.visitorid = gvid;
			options.translateSwitch = translateSwitch;
			options[POST_MESSAGE_FLAG] = POST_MESSAGE_FLAG_CONTENT;
            options[LANG_KEY] = lang.getLang();
			CustomParams.setCustomParams(options);
			sendMsg = JSON.stringify(options);
			imIframe.contentWindow.postMessage(sendMsg, '*');
			return;
		}

		if (isDirectOpen) {
			sendMsg = {
				kfuin: kfuin,
				seq: seq,
				receptionUin: receptionUin,
				receptionName: receptionName,
				key: B2Ckey,
				invitationType: type,
				onlyOpen: onlyOpen,
				clickid: clickid,
				visitorid: gvid,
				act: ACTS.OPEN,
				translateSwitch: translateSwitch
			};
			if (win.wpaShowItemId) {
				sendMsg.wpaShowItemId = win.wpaShowItemId;
			}
			sendMsg[POST_MESSAGE_FLAG] = POST_MESSAGE_FLAG_CONTENT;
            sendMsg[LANG_KEY] = lang.getLang();
			CustomParams.setCustomParams(sendMsg);
			sendMsg = JSON.stringify(sendMsg);
			imIframe.contentWindow.postMessage(sendMsg, '*');
			return;
		}

		var inviteConf = win.__WPA[GLOBAL_INVITE_TPL_AND_CONF][kfuin],
			key = inviteConf ? inviteConf.key : null,
			openParam = {
				kfuin: kfuin,
				wpaId: id,
				visitorid: gvid,
				wpaKey: wpaKey,
				roleValue: roleValue,
				roleData: roleData,
				act: ACTS.OPEN,
				onlyOpen: onlyOpen,
				clickid: clickid,
				isClickWpa: isClickWpa ? 1 : 0,
				translateSwitch: translateSwitch
			};

		if (invitationType) {
			openParam = extend(openParam, {
				invitationType: invitationType,
				key: key
			});
			openParam.reception = inviteConf.conf.autoInvited.reception;
		}

		//移动端改为小蓝条后，不能再判断是不是直接点击的wpa了
		//因为点击的是小蓝条，不是wpa
		if (win.__WPA[UNREAD_MSG_INFO][kfuin] /*&& isClickWpa*/) {
			openParam = extend(openParam, win.__WPA[UNREAD_MSG_INFO][kfuin]);
			openParam.invitationType = INVITATION_TYPE.OFFLINE;
		}
		//点击离线消息的小蓝条
		if (win.__WPA[UNREAD_MSG_INFO][kfuin] && !isClickWpa) {

		}
		win.__WPA[UNREAD_MSG_INFO][kfuin] = undefined;
		if (isB2C) {
			openParam.seq = seq;
			openParam.receptionUin = receptionUin;
			openParam.receptionName = receptionName;
			openParam.invitationType = type;
			openParam.key = B2Ckey;
		}
		//直接点击图标型web im
		if (isClickWpa) {
			openParam = extend(openParam, clickWpaReportObj);
		}
		openParam.visitorid = gvid;
		if (win.wpaShowItemId) {
			openParam.wpaShowItemId = win.wpaShowItemId;
		}
		openParam[POST_MESSAGE_FLAG] = POST_MESSAGE_FLAG_CONTENT;
        openParam[LANG_KEY] = lang.getLang();
		CustomParams.setCustomParams(openParam);
		openParam = JSON.stringify(openParam);
		imIframe.contentWindow.postMessage(openParam, '*');
	};

	exports.closeChatIframe = function(options) {

		var kfuin = options.kfuin;

		// var target = getTarget(this.params),
		var target = getTarget({
				kfuin: kfuin
			}),
			imIframe = target.imIframe;

		if (!imIframe || imIframe.getAttribute('data-isOpen') == 0) {
			return log('[im.js]no im iframe found or already closed');
		}

		// win.__WPA.trigger('startInviteTimeout', kfuin);

		win.__WPA.IM_CHAT_IFRAME_OPENING = 0;

		if (isMobile) {

			/*uc浏览器要做特殊处理
			  打开webim的iframe时隐藏第三方页面的所有元素同时背景设置为白色
			  关闭webim的iframe时再还原
			*/
			if (conf.ua.indexOf('ucbrowser') !== -1) {
				body.className = body.className.replace(QD_WPA_BODY_CLASS_NAME, '');
			}

			clearTimeout(win.__qd_keyboard_interval);
			win.document.body.style.cssText = originalTopBodyCssText;
			win.scrollTo(0, win[SCROLL_TOP_NAME] || 0);
			//modified by vergil on 2017/12/21
			// closeStyle = 'right:-' + (offset.getClientWidth() * 10) + 'px;';
			//解决iphone的safari下切换横屏纵屏时，webim聊天框会漏出来的问题
			//强制设为5000px
			//im的init里，移动端初始的right值要跟这里的right一致
			closeStyle = 'right:-3000px;';

			imIframe.style.cssText += closeStyle;

			// var p = win[POSITION_HELP_EL];
			// if (p) {
			// 	p.style.cssText += 'display: none!important;';
			// }

			domEvent.removeEvent(top, 'touchmove', preventEvent);
		} else {
			imIframe.style.cssText += imIframe._styles.close;
		}
		imIframe.setAttribute('data-isOpen', '0');


	};

	//pc端上当前页面打开一个iframe
	//内容是链接型webim聊天页
	var OPEN_TYPE_CURRENT = 1,
		OPEN_TYPE_NEW = 2,
		IM_WIDTH = 760,
		IM_HEIGHT = 640;

	var showImWin = function(params) {
		var imUrl = params.imUrl,
      customParams = CustomParams.getCustomParams(),
      customParam;
		if (imUrl.indexOf('?') !== -1) {
			imUrl += '&';
		} else {
			imUrl += '?';
		}
		imUrl += 'visitorid=' + params.guid + '&clickid=' + params.clickid;

    // 新增webim语言类型参数
    customParams[LANG_KEY] = lang.getLang();
    // DOM型wpa在新开窗口打开webim时补上自定义参数
    for (customParam in customParams) {
      imUrl += '&' + customParam + '=' + customParams[customParam]
    }

    /************** 授权页逻辑 START **********************/
    /**
     * 这里注意本地开发的域名和端口根据自己本地的实际情况处理
     * 若此处有任何变动，请同时看下webIM的相关逻辑是否需要变动
     * 本地调试授权页必须先启动stellaris项目的授权页页面
     * 在stellaris项目下使用命令 gulp -t wpa-authorization --https
     */
    var QIDIAN_WPA_CUSTOMER = window.QIDIAN_WPA_CUSTOMER || {};
    if(QIDIAN_WPA_CUSTOMER.auth == 1){
        imUrl += '&auth=1&auth_pid=' + (QIDIAN_WPA_CUSTOMER.auth_pid || '') + '&auth_paccount=' + (QIDIAN_WPA_CUSTOMER.auth_paccount || '');
    }
    /************** 授权页逻辑 END **********************/

    /************** 用户信息逻辑 START **********************/
    var QIDIAN_WPA_USERINFO = window.QIDIAN_WPA_USERINFO || null;
    var QIDIAN_WPA_AUTH = window.QIDIAN_WPA_AUTH || '';
    var qidianWpaUserinfo = '';
    if(QIDIAN_WPA_USERINFO){
        try{
            qidianWpaUserinfo = encodeURIComponent(JSON.stringify(QIDIAN_WPA_USERINFO));
        }catch(err){
            // no code
        }
    }
    if(QIDIAN_WPA_AUTH){
        try{
            imUrl += '&auth=' + QIDIAN_WPA_AUTH + '&userinfo=' + qidianWpaUserinfo;
        }catch(err){
            // no code
        }
    }
    /************** 用户信息逻辑 END **********************/

    var left = (winWidth - IM_WIDTH) / 2,
            top = (winHeight - IM_HEIGHT) / 2;
        // 这里encodeURI是因为window.open打开页面的时候会自动解码url，如果这里不encodeURI，就无法正确读取userinfo值
        var imWin = win.open(encodeURI(imUrl), '_blank','top=' + top + ', left=' + left + ', width=' + IM_WIDTH + ', height=' + IM_HEIGHT);
		//直接设置left会导致外接显示器的left失效
		//尝试用下列方法兼容，但失败了
		//在ff下，移动窗口会有明显的视觉效果，所以不能用moveBy
		// var imWin = win.open(imUrl,'_blank','width=' + IM_WIDTH + ', height=' + IM_HEIGHT);
		// var imWin = win.open(imUrl,'_blank','width=' + 0 + ', height=' + 0);

		// imWin.resizeTo(IM_WIDTH, IM_HEIGHT);
		// imWin.moveBy(left, top);
	};

	exports.im = function(params) {

		var custom = params.custom || {},
			open = custom.open || OPEN_TYPE_CURRENT;
		//pc端webim的自定义，打开新窗口条件
		if (params.isCustom && open == OPEN_TYPE_NEW && !isMobile) {
			return showImWin(params);
		}

		var isGray = this.env.isGray;

		if (isInAdmin || this.params.isImForbidden) {
			return alert('网页接待类型接待组件暂不支持功能预览');
		}

		if (conf.BROWSER_ENV.isIE && conf.BROWSER_ENV.ieVersion < 8) {
			return alert('您的浏览器版本过低，请升级');
		}

		this.openChatIframe(params);
	};

    /**
     * 通用设置webim属性方法
     * 目前支持设置webim语言类型
     * @param {String} key   属性key
     * @param {Any} value 属性value
     */
    exports.set = function(key, value) {
        if (key === conf.IM_LANG.key) {
            lang.setLang(value);
        }
    };
});

/** src/im/init.js **/
/**
 * 网页接待初始化工作
 * 引入网页聊天的iframe并隐藏
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/09/28
 */
LBF.define('wpa.im.init', function(require, exports, module) {

	var browser = require('lang.browser'),
		conf = require('wpa.conf.config'),
		POST_MESSAGE_FLAG = conf.POST_MESSAGE_FLAG,
		POST_MESSAGE_FLAG_CONTENT = conf.POST_MESSAGE_FLAG_CONTENT,
		isInMobileQQ = conf.BROWSER_ENV.isInMobileQQ,
		KFUINS = conf.KFUINS,
		ROLE_KEY = conf.ROLE_KEY,
        WPAS_BASED_ON_KFUIN = conf.WPAS_BASED_ON_KFUIN,
        LANG_KEY = conf.IM_LANG.key,
		offset = require('wpa.util.offset'),
		onIframeLoaded = require('wpa.util.onIframeLoaded'),
		isMobile = conf.isMobile,
        GLOBAL_WPA_NAME = conf.GLOBAL_WPA,
        log = require('wpa.util.log'),
        JSON = require('lang.JSON'),
        launch = require('wpa.util.launch'),
		domEvent = require('wpa.util.domEvent'),
        JSON = require('lang.JSON'),
        platformAuthorization = require('wpa.util.platformAuthorization'),
        getAuthorizationPageUrl = require('wpa.util.getAuthorizationPageUrl'),
        serialize = require('util.serialize'),
        lang = require('wpa.im.lang');

	var win = conf.gWin,
		doc = win.document,
		body = doc.body,
		WPA = win.__WPA,
		POSITION_HELP_EL = conf.WEB_IM.POSITION_HELP_EL,
		initWidth = offset.getClientWidth(),
		initHeight = offset.getClientHeight(),
		WEB_IM_URL,
		WEB_IM_IFRAME_ID = conf.WEB_IM.WEB_IM_IFRAME_ID,
		WEB_IM_IFRAMES_OBJ_NAME = conf.WEB_IM.WEB_IM_IFRAMES_OBJ_NAME,
		WEB_IM_IFRAMES_LOADED = conf.WEB_IM.WEB_IM_IFRAMES_LOADED,
		ACTS = conf.WEB_IM.ACTS,
		LAUNCH_TYPES = conf.WEB_IM.LAUNCH_TYPES,
		//用INIT来保存最初的im iframe style
		//否则如果页面有不同主号的im
		//common iframe会累积计算样式
		INIT_COMMON_WEB_IM_IFRAME_STYLE,
		COMMON_WEB_IM_IFRAME_STYLE = [
			// 'transition: all .4s;',
			'position:fixed;',
			'z-index:2000000010;'
		].join(''),
		imIframesNum = 0,
		closeStyleOffset = {
			x: 10,
			y: 10
		},
		CSS = {
			PC: {
				right: 10,
				width: 300
			}
		},
		MOBILE_WEB_IM_IFRAME_STYLE = [
			'width:100%',
			// 'height:' + initHeight + 'px',
			'height:100%',
			'border:none!important',
			'transition: all .4s;',
			//modified by vergil on 2017/12/21
			//解决iphone的safari下切换横屏纵屏时，webim聊天框会漏出来的问题
			//强制设为5000px
			//im的closeChatIframe里，移动端初始的right值要跟这里的right一致
			// 'right:-' + (initWidth + closeStyleOffset.x) + 'px',
			'right:-3000px',
			'top:0',
			'bottom:0',
			'visibility:visible!important'
		].join(';') + ';',
		PC_WEB_IM_IFRAME_STYLE = [
			'width: 300px',
			'height: 50px',
			'border:1px solid #dadee7',
			'bottom:0',
			'right:{right}',
			'box-shadow:0 1px 15px rgba(0, 0, 0, 0.15)',
			'border-top-left-radius: 6px',
			'border-top-right-radius: 6px',
			'border-bottom-left-radius: 0',
			'border-bottom-right-radius: 0'
		].join(';') + ';',
		imInitQueues = {};

	INIT_COMMON_WEB_IM_IFRAME_STYLE = COMMON_WEB_IM_IFRAME_STYLE;

	if (isMobile) {
		COMMON_WEB_IM_IFRAME_STYLE = COMMON_WEB_IM_IFRAME_STYLE + MOBILE_WEB_IM_IFRAME_STYLE;
	}

	win[WEB_IM_IFRAMES_OBJ_NAME] = win[WEB_IM_IFRAMES_OBJ_NAME] ? win[WEB_IM_IFRAMES_OBJ_NAME] : {};
	win[WEB_IM_IFRAMES_LOADED] = win[WEB_IM_IFRAMES_LOADED] ? win[WEB_IM_IFRAMES_LOADED] : {};

	//查看指定kfuin的im聊天窗口是否加载好了
	var isImIframeLoaded = exports.isImIframeLoaded = function(kfuin) {
		return (win[WEB_IM_IFRAMES_OBJ_NAME][kfuin] ? true : false);
	};

	//添加iframe
	var initIframe = exports.initIframe = function(params) {

		params = params || {};

		var kfuin = params.fkfuin,
			id = params.id,
			iframeId = WEB_IM_IFRAME_ID + kfuin,
			visitorid = params.guid,
			WEB_IM_URL = conf.WEB_IM.URL,
			// url = WEB_IM_URL + '?kfuin=' + kfuin,
			url = WPA.imUrls[kfuin],
			targetRole = params[ROLE_KEY.IM] || params[ROLE_KEY.QQ],
			roleValue = targetRole.value,
			roleData = targetRole.data,
			translateSwitch = params.translateSwitch || 0,
			initObj = {
	    		kfuin: kfuin,
	    		wpaId: id,
	    		wpaKey: params.key,
	    		act: ACTS.INIT,
	    		isMobile: isMobile,
	    		visitorid: visitorid,
	    		roleData: roleData,
	    		roleValue: roleValue,
	    		translateSwitch: translateSwitch
            };

        /************** 授权页逻辑 START **********************/
        /**
         * 这里注意本地开发的域名和端口根据自己本地的实际情况处理
         * 若此处有任何变动，请同时看下webIM的相关逻辑是否需要变动
         * 本地调试授权页必须先启动stellaris项目的授权页页面
         * 在stellaris项目下使用命令 gulp -t wpa-authorization --https
         */
        var QIDIAN_WPA_CUSTOMER = window.QIDIAN_WPA_CUSTOMER || {};
        if(QIDIAN_WPA_CUSTOMER.auth == 1){
            initObj.auth = 1;
            initObj.auth_pid = QIDIAN_WPA_CUSTOMER.auth_pid || '';
            initObj.auth_paccount = QIDIAN_WPA_CUSTOMER.auth_paccount || '';
            initObj.auth_mode = QIDIAN_WPA_CUSTOMER.auth_mode || '';
        }

        /************** 授权页逻辑 END **********************/

        /************** 用户资料逻辑 START **********************/
        /**
         * 根据用户的全局变量传递用户信息
         */
        var QIDIAN_WPA_USERINFO = window.QIDIAN_WPA_USERINFO || {};
        var QIDIAN_WPA_AUTH = window.QIDIAN_WPA_AUTH || '';
        if(QIDIAN_WPA_USERINFO){
            try{
                initObj.userInfo = encodeURIComponent(JSON.stringify(QIDIAN_WPA_USERINFO));
            }catch(err){
                // no code
            }
        }
        if(QIDIAN_WPA_AUTH){
            try{
                initObj.auth = QIDIAN_WPA_AUTH;
            }catch(err){
                // no code
            }
        }
        // prefix = url.indexOf('?') > -1 ? '&' : '?' ;
        // if(QIDIAN_WPA_USERINFO){
        //     try{
        //         initObj.userinfo = JSON.stringify(QIDIAN_WPA_USERINFO);
        //         QIDIAN_WPA_USERINFO = JSON.stringify(QIDIAN_WPA_USERINFO);
        //     }catch(err){
        //         // no code
        //     }
        // }
        // if(QIDIAN_WPA_AUTH){
        //     url = url + prefix + 'auth=' + QIDIAN_WPA_AUTH;
        //     url = url + '&' + 'userinfo=' + encodeURIComponent(QIDIAN_WPA_USERINFO);
        // }
        /************** 用户资料逻辑 END **********************/

	    imInitQueues[kfuin] = imInitQueues[kfuin] ? imInitQueues[kfuin] : [];

	    imInitQueues[kfuin].push(initObj);

	    //为了测试方便，这里通过落地页的qs来决定加载哪一个im的页面
	    //https://oawebpage.qidian.qq.com/2/chat-gray/pc/index.html
	    //仅限devadmin.qidian.qq.com和oa
	    // if (location.hostname.indexOf('devadmin.qidian.qq.com') !== -1 || location.hostname.indexOf('oaadmin.qidian.qq.com') !== -1) {
		   //  if (location.search.indexOf('_im=general') !== -1) {
		   //  	url = url.replace(/chat[^\/]*/, 'chat-general');
		   //  	params._im = 'general';
		   //  } else if (location.search.indexOf('_im=gray') !== -1) {
		   //  	url = url.replace(/chat[^\/]*/, 'chat-gray');
		   //  	params._im = 'gray';
		   //  }
	    // }


		if (!isImIframeLoaded(kfuin)) {

			//pc端的iframe要每次动态计算排列位置
			if (!isMobile) {
				var actualPcRight = (CSS.PC.width + CSS.PC.right) * (imIframesNum++) + CSS.PC.right + 'px';
				COMMON_WEB_IM_IFRAME_STYLE = INIT_COMMON_WEB_IM_IFRAME_STYLE;
				COMMON_WEB_IM_IFRAME_STYLE = COMMON_WEB_IM_IFRAME_STYLE + PC_WEB_IM_IFRAME_STYLE.replace('{right}', actualPcRight);
				var PC_CLOSE_IFRAME_STYLE = COMMON_WEB_IM_IFRAME_STYLE;
				COMMON_WEB_IM_IFRAME_STYLE += 'display:none;';
			}

			// var strIframe = '<iframe scrolling="no" id="' + iframeId + '" frameborder="0" width="' + initWidth + '" height="' + initHeight + '" allowtransparency="true" src="' + url + '" style="' + COMMON_WEB_IM_IFRAME_STYLE + '"></iframe>';
			var strIframe = '<iframe scrolling="no" id="' + iframeId + '" frameborder="0" width="100%" height="100%" allowtransparency="true" src="' + url + '" style="' + COMMON_WEB_IM_IFRAME_STYLE + '"></iframe>';

			var iframe;
	        // ie will reject operations when parent's domain is set
	        try{//ie
	            iframe = document.createElement(strIframe);
	        } catch(e) {//none ie
	            iframe = document.createElement('iframe');
	            iframe.width = initWidth;
	            iframe.height = initHeight;
	            iframe.id = iframeId;
	            iframe.style.cssText = COMMON_WEB_IM_IFRAME_STYLE;
	            iframe.setAttribute('scrolling', 'no');
	            iframe.setAttribute('frameborder', 0);
	            iframe.setAttribute('allowtransparency', true);
	            iframe.setAttribute('src', url);
	        }

	        iframe._styles = {
	        	close: PC_CLOSE_IFRAME_STYLE
	        };

	        body.appendChild(iframe);

	        if (isMobile) {
	        	var resizeGap;
	        	//use resize instead of orientationchange for compatability
				domEvent.addEvent(win, 'resize', function() {
					clearTimeout(resizeGap);
					resizeGap = setTimeout(function() {
						var w = offset.getClientWidth(),
							h = offset.getClientHeight(),
							isOpen = iframe.getAttribute('data-isOpen');
						if (isOpen == 0) {
							// iframe.style.cssText += 'width:100%;height:' + h + 'px;right:-' + (2 * w) + 'px;';
							iframe.style.cssText += 'right:-' + (10 * w) + 'px;';
						} else {
							// iframe.style.cssText += 'width:100%;height:' + h + 'px;';
							// iframe.style.cssText += 'width:100%;height:' + h + 'px;';
						}
					}, 300);
				});
			}

	        win[WEB_IM_IFRAMES_OBJ_NAME][kfuin] = true;

	        onIframeLoaded(iframe, function() {

	        	win[WEB_IM_IFRAMES_LOADED][kfuin] = true;

	        	postInitQueue(kfuin, iframe);

	        	iframe.setAttribute('data-isOpen', '0');

	        }, true);
		}

        if (win[WEB_IM_IFRAMES_LOADED][kfuin]) {
            //发生一种情况，腾讯云页面点击tab切换时会重新拉wpa的代码，又执行一次wpa逻辑，但是页面没有刷新，window.__WPA对象依然存在
            //此时逻辑到这里iframe未定义，避免iframe为undefined的时候执行postInitQueue添加一个判断
            if(iframe){
        	    postInitQueue(kfuin, iframe);
            }
        }
	};

	function postInitQueue(kfuin, iframe) {

		var imInitQueue = imInitQueues[kfuin] || [],
			iWin = iframe.contentWindow;
		while (imInitQueue.length) {
			var initObj = imInitQueue.shift();
            initObj[POST_MESSAGE_FLAG] = POST_MESSAGE_FLAG_CONTENT;
            initObj[LANG_KEY] = lang.getLang();
			initObj = JSON.stringify(initObj);
			iWin.postMessage(initObj, '*');
		}
	}

	//添加message监听事件
	var initMessageListener = function() {
		domEvent.addEvent(win, 'message', function(data) {
			if (!data || !data.data) {
				return;
			}

			var origin = data.origin || data.originalEvent.origin;
			log('[init.js]:origin is:' + origin);
			// if (origin.indexOf(conf.IM_ORIGIN) === -1) {
			if (!conf.IM_ORIGIN_REG.test(origin)) {
				return log('[init.js]origin error');
			}

			var r = data.data || {};

			if (typeof r === 'string') {
				//--bug=54874177
				//【企点服务迭代七】【WebIM】在UC浏览器中点击非链接型的网页接触点，打开了webIM的wpa后，点击左上角的返回按钮无效
				//ios里的uc会对obj类型做增加、删除字段的操作
				//这里约定如果是close
				//直接传CLOSE-kfuin
				//这样的字符串
				// if (isMobile && /close@\d+/i.test(r)) {
				// 	var kfuin = Number(r.match(/\d+/)[0]);
				// 	WPA.IM.closeChatIframe({
				// 		kfuin: kfuin
				// 	});
				// 	return;
				// }
				try {
					r = JSON.parse(r);
				} catch (e) {
					log('JSON.parse error in initMessageListener');
					log(e);
				}

			}

			var kfuin = Number(r.kfuin) || 0,
				wpaId = r.wpaId || 0,
				act = r.act,
				wpaIden = r.kfuin + '_' + r.wpaId,
				type = r.type || '',
				sign = r.sign || '',
				protocol = r.protocol || '',
				rData = r.data || {};

			if (act === ACTS.UNREAD) {//小红点来了
				var onlyOpen = r.data.onlyOpen;
				if (isMobile) {
					var targetWpa = WPA[WPAS_BASED_ON_KFUIN][kfuin] && WPA[WPAS_BASED_ON_KFUIN][kfuin][0];
					if (!targetWpa) {
						return log('no wpa with kfuin [' + kfuin + '] found');
					}
					if (r.data.number == 0) {
						return targetWpa.removeUnreadMsgCircle(kfuin);
					}
					WPA[KFUINS][kfuin].unread.chat = r.data.number;
					if (typeof onlyOpen !== 'undefined' && !onlyOpen) {
						//2017/08/02：
						//解决移动端出现未读消息小蓝条，刷新页面后，点击小蓝条的问题
						//此时是需要建立长连接的，但消息却是未读消息
						//打开webim时需要校验登录态，需要roleData和roleValue等参数
						WPA[KFUINS][kfuin].onlyOpen = onlyOpen;
						WPA[KFUINS][kfuin].onlyOpenParam = r;
						WPA[KFUINS][kfuin].onlyOpenParam.onlyOpen = false;
					}
					// win[GLOBAL_WPA_NAME][wpaIden].updateUnreadMsgCircle(r.data.number);
					targetWpa.updateUnreadMsgCircle(r.data.number);
				} else {//pc端处理onlyOpen
					if (typeof onlyOpen !== 'undefined') {
						WPA[KFUINS][kfuin].onlyOpen = onlyOpen;
					}
				}
			} else if (act === ACTS.CLOSE) {//聊天窗口关闭了
				WPA.IM.closeChatIframe({
					kfuin: kfuin
				});
			} else if (act === ACTS.LAUNCH) {
				if (isMobile) {
					if (isInMobileQQ && sign) {
						return win.location.href = sign;
					}
					//这里的protocol，不管是qq还是来电
					//已经是移动端的呼起中间页了
					win.location.href = protocol;
				} else {
					//这里的protocol是tencent://协议
					launch(protocol);
				}
			} else if (act === ACTS.FOCUS) {
				if (isMobile) {

					var adjust = rData.adjust || 80,
						delay = rData.delay || 300;

					win.__qd_keyboard_interval = setTimeout(function() {
						// body.scrollTop = window.innerHeight;
						var t = window.innerHeight + adjust;
	    				window.scrollY < t && window.scrollTo(0, t);
						clearTimeout(win.__qd_keyboard_interval);
						win.__qd_keyboard_interval = setTimeout(arguments.callee, delay);
					}, delay);
				}
			} else if (act === ACTS.BLUR) {
				if (isMobile) {
					clearTimeout(win.__qd_keyboard_interval);

					// 2019/10/11 解决iOS12+系统键盘收回后仍然占用屏幕空间的BUG
					if (rData && rData.isScrollWindow) {
						win.scrollTo(0, 0);
					}
				}
			} else if (act === ACTS.OPEN) {
				//pc端可以点击im窗口，从隐藏在右下角变为弹出状态
				if (!isMobile) {
					var openPCFlag = true;
					if (typeof WPA[KFUINS][kfuin].onlyOpen !== 'undefined') {
						openPCFlag = WPA[KFUINS][kfuin].onlyOpen;
					}
					WPA[KFUINS][kfuin].onlyOpen = undefined;
					if (WPA[KFUINS][kfuin].unread.socket > 0) {
						openPCFlag = false;
					}
					WPA.IM.openChatIframe({
						kfuin: kfuin,
						//onlyOpen表示仅弹出pc im框，不传其他除kfuin外的参数
						onlyOpen: openPCFlag
					});
				}
			} else if (act === ACTS.OPEN_IMG) {//pc端打开图片
				var imgUrl = r.data && r.data.url;
				if (!imgUrl) {
					return log('[OPEN_IMG]imgUrl error');
				}
				if (!isMobile) {
					win.open(imgUrl);
				}
			} else if (act === ACTS.SHOW) {//pc端display出im聊天iframe
				if (!isMobile) {
					var iframeId = WEB_IM_IFRAME_ID + kfuin,
						targetIframe = document.getElementById(iframeId);
					(targetIframe) && (targetIframe.style.cssText += 'display:block;');
				}
			}else if (act === ACTS.AUTH){
                var authPath = getAuthorizationPageUrl({from: 'webim'});
                if(authPath !== ''){
                    if (isMobile) {
                        var finalUrl = authPath + '&platform=h5';
                        platformAuthorization({
                            src: finalUrl,
                            id: 'wpaAuthorization',
                        })
                    }else{
                        var finalUrl = authPath + '&platform=pc&' + serialize(r.data);
                        platformAuthorization({
                            src: finalUrl,
                            id: 'wpaAuthorization',
                        });
                    }
                }

            }
		});
	};

	// var addPositionHelpEl = function() {

	// 	if (isMobile) {
	// 		var flag = win[POSITION_HELP_EL] = typeof win[POSITION_HELP_EL] !== 'undefined' ?  win[POSITION_HELP_EL] : false;
	// 		if (!flag) {
	// 			var p,
	// 				style = [
	// 					'width: 100%!important;',
	// 					'height: 1px!important;',
	// 					'display: none!important;'
	// 				].join('');
	// 				strP = '<p id="' + POSITION_HELP_EL + '" style="' + style + '"></p>';
	// 			try {
	// 				p = doc.createElement(strP);
	// 			} catch (e) {
	// 				p = doc.createElement('p');
	// 				p.id = POSITION_HELP_EL;
	// 				p.style.cssText = style;
	// 			}
	// 			body.appendChild(p);
	// 			win[POSITION_HELP_EL] = p;
	// 		}
	// 	}
	// };

	exports.imInit = function(params, cb) {

		if (params.isImForbidden) {
		// if (params.isImForbidden) {
			return;
		}

		if (!WPA.isMsgListenerAdded) {
			initMessageListener();
			WPA.isMsgListenerAdded = true;
		}

		initIframe(params);

		if (typeof cb === 'function') {
			cb();
		}
	};
});

/** src/invite/main.js **/
/**
 * 会话邀请主文件
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/10/28
 *
 */
LBF.define('wpa.invite.main', function(require, exports, module) {

	var getInviteConf = require('wpa.invite.getInviteConf'),
        conf = require('wpa.conf.config'),
        POST_MESSAGE_FLAG = conf.POST_MESSAGE_FLAG,
        POST_MESSAGE_FLAG_CONTENT = conf.POST_MESSAGE_FLAG_CONTENT,
        ACTS = conf.SOCKET.ACTS,
        WEB_IM = conf.WEB_IM,
        WPAS_BASED_ON_KFUIN = conf.WPAS_BASED_ON_KFUIN,
        INVITATION_TYPE = conf.INVITATION_TYPE,
        WEB_IM_IFRAME_ID = WEB_IM.WEB_IM_IFRAME_ID,
        WEB_IM_IFRAMES_OBJ_NAME = WEB_IM.WEB_IM_IFRAMES_OBJ_NAME,
		INVITE_IFRAME_ID_PREFIX = conf.INVITE_IFRAME_ID_PREFIX,
        WPAS_IM_TYPE = conf.WEB_IM.WPAS_IM_TYPE,
        KFUIN_INVITED_TIMES = conf.KFUIN_INVITED_TIMES,
		Style = require('wpa.util.Style'),
		offset = require('wpa.util.offset'),
		browser = require('lang.browser'),
		isMobile = browser.isAndroid || browser.isIOS,
        extend = require('lang.extend'),
        report = require('util.report'),
        launch = require('wpa.util.launch'),
        //todo:???
        //after require the following code, wpa won't get displayed on the page
        //im = require('wpa.proto.im'),
		tpl = require('wpa.invite.tpl'),
        ids = require('wpa.util.ids'),
        domEvent = require('wpa.util.domEvent'),
		onIframeLoaded = require('wpa.util.onIframeLoaded'),
		log = require('wpa.util.log'),
        jsonp = require('util.jsonp'),
        serialize = require('util.serialize'),
        JSON = require('lang.JSON'),
        chatConst = require('wpa.conf.chat'),
        CustomParams = require('wpa.proto.CustomParams'),
        SOCKET = conf.SOCKET,
        SOCKET_ACTS = SOCKET.ACTS,
        SOCKET_IFRAME_ID = SOCKET.SOCKET_IFRAME_ID,
        LAUNCH_LINK = chatConst.LAUNCH_LINK;

	var win = conf.gWin,
		doc = win.document,
		body = doc.body,
        WPA = win.__WPA,
        socketWin,
        inviteKfuinsObj = {},
        initedKfuinInvite = {},
        GLOBAL_INVITE_TPL_AND_CONF = conf.GLOBAL_INVITE_TPL_AND_CONF;

    win.__WPA[GLOBAL_INVITE_TPL_AND_CONF] = typeof win.__WPA[GLOBAL_INVITE_TPL_AND_CONF] !== 'undefined' ? win.__WPA[GLOBAL_INVITE_TPL_AND_CONF] : {};
    win.__WPA[KFUIN_INVITED_TIMES] = typeof win.__WPA[KFUIN_INVITED_TIMES] !== 'undefined' ? win.__WPA[KFUIN_INVITED_TIMES] : {};

    //点击关闭后的清除动作
    var clearInvitePanel = exports.clearInvitePanel = function(options) {
        log(options);
        var kfuin = options.kfuin,
            iframe = options.iframe || doc.getElementById(INVITE_IFRAME_ID_PREFIX + kfuin),
            $close = options.$close,
            $btn1 = options.$btn1 || {},
            $btn2 = options.$btn2 || {};
        $close = $btn1 = $btn2 = null;
        inviteKfuinsObj[kfuin] = false;
        if (iframe) {
            iframe.parentNode && iframe.parentNode.removeChild(iframe);
        }
    };

    var actions = {
        qq: function(options) {
            var param = {
                kfuin: options.kfuin,
                isCorpUin: options.isCorpUin,
                clickId: ids.createClickId(),
                visitorId: WPA.visitorId,
                ftype: conf.isMobile ? 1 : 0,
                isB2C: options.isB2C,
                receptionUin: options.receptionUin
            };
            clearInvitePanel(options);
            CustomParams.setCustomParams(param);
            setTimeout(function() {
                jsonp(conf.CGIS.GET_QQ_INVITE_SIGT, param, function(r) {
                    r = r || {};
                    var data = r.data || {},
                        sign = data.sign,
                        message = data.message || '企业接待暂时无法使用，请稍后再试';
                    //返回协议出错
                    if (r.r != 0) {
                        return alert(message);
                    }

                    launch(sign, {
                        targetPage: LAUNCH_LINK,
                        needMobileJump: true
                    });
                });
            }, 10);
        },
        phone: function() {
            alert('phone');
        },
        im: function(options, ctx) {
            var self = ctx,
                kfuin = options.kfuin,
                isB2C = options.isB2C,
                seq = options.seq,
                key = options.key,
                type = options.type,
                receptionUin = options.receptionUin,
                clickid = ids.createClickId(),
                invitationType = isB2C ? null : INVITATION_TYPE.AUTO,
                openParam = {
                    clickid: clickid,
                    invitationType: invitationType
                };
            if (isB2C) {
                openParam.isB2C = true;
                openParam.seq = seq;
                openParam.type = type;
                openParam.key = key;
                openParam.receptionUin = receptionUin;
            }
            if (win[WEB_IM_IFRAMES_OBJ_NAME][kfuin]) {
                log(kfuin + ' exists');
                ctx.openChatIframe(openParam);
            } else {
                if (isMobile) {
                    alert('mobile im invite without im iframe');
                } else {
                    alert('pc im invite without im iframe');
                }
                log(kfuin + ' doesn\'t exist');
            }
            clearInvitePanel(options);
        }
    };

    var bindBtn = function(btn, options, ctx) {
        if (!btn) {
            return;
        }
        //ctx本期是im类型的wpa
        var kfuin = options.kfuin,
            isB2C = options.isB2C,
            seq = options.seq,
            type = options.type,
            receptionUin = options.receptionUin,
            e = btn.getAttribute('data-event'),
            isCorpUin = parseInt(btn.getAttribute('data-corpuin'), 10);

        ctx = ctx || (win.__WPA[WPAS_IM_TYPE][kfuin] && win.__WPA[WPAS_IM_TYPE][kfuin][0]) || win.__WPA[WPAS_BASED_ON_KFUIN][kfuin][0];

        if (!ctx) {
            return log('no im wpa');
        }

        //todo
        //移动端里是tap
        //mobile should use tap here
        var sendMsg;
        domEvent.addEvent(btn, 'click', function() {
            log('isB2C:' + isB2C);
            if (e == 'close') {
                clearInvitePanel(options);
                //点击关闭后，开始按设置的频率弹邀请框
                win.__WPA.trigger('startInviteTimeout', kfuin);
                sendMsg = {
                    act: SOCKET_ACTS.SM_REFUSE,
                    kfuin: kfuin
                };
                sendMsg[POST_MESSAGE_FLAG] = POST_MESSAGE_FLAG_CONTENT;
                sendMsg = JSON.stringify(sendMsg);
                socketWin = socketWin ? socketWin : WPA[SOCKET_IFRAME_ID];
                // win.postMessage(sendMsg, '*');
                socketWin.postMessage(sendMsg, '*');
                var reportUrl = conf.CGIS.CLOSE_INVITE_REPORT,
                    reportObj = {
                        kfuin: kfuin,
                        visitorId: __WPA.visitorId,
                        isB2C: isB2C ? 1 :0,
                        key: options.key
                    };
                reportUrl += '?' + serialize(reportObj);
                report(reportUrl);
            } else if (e == tpl.btnTypes.qq) {
                actions.qq(extend(options, {
                    isCorpUin: isCorpUin
                }));
            } else if (e == tpl.btnTypes.phone) {
                actions.phone();
            } else if (e == tpl.btnTypes.im) {
                actions.im(options, ctx);
            }
        });
    };

    //绑定会话邀请
    var bindEvents = function(iframe, inviteConf, options) {
        var iWin = iframe.contentWindow,
            iDoc = iframe.contentDocument || iWin.document,
            kfuin = inviteConf.kfuin,
            ctx = options.ctx,
            isB2C = options.isB2C,
            type = options.type,
            receptionUin = options.receptionUin,
            key = options.key,
            seq = options.seq;

        //todo
        //如果是b2c的邀请
        //则根据kfuin获取任意一个im的wpa即可
        //但是如果是非im的wpa怎么办呢？

        inviteKfuinsObj[kfuin] = true;
        //todo:pcim
        // if ((isMobile && !conf.isLocal) || conf.isLocal) {
        if (true) {
            var $close = iDoc.getElementById('invite_close'),
                $btn1 = iDoc.getElementById('btn1'),
                $btn2 = iDoc.getElementById('btn2');

            if ($btn2 && ($btn2.getAttribute('data-event') == 'undefined')) {
                $btn2.parentNode && $btn2.parentNode.removeChild($btn2);
                setTimeout(function() {
                    $btn2 = null;
                }, 10);
            }

            bindBtn($close, {
                kfuin: kfuin,
                iframe: iframe,
                $close: $close,
                $btn1: $btn1,
                $btn2: $btn2,
                isB2C: isB2C,
                seq: seq,
                key: key
            }, ctx);

            bindBtn($btn1, extend(inviteConf, {
                kfuin: kfuin,
                iframe: iframe,
                $close: $close,
                $btn1: $btn1,
                $btn2: $btn2,
                isB2C: isB2C,
                seq: seq,
                type: type,
                key: key,
                receptionUin: receptionUin
            }), ctx);
            bindBtn($btn2, extend(inviteConf, {
                kfuin: kfuin,
                iframe: iframe,
                $close: $close,
                $btn1: $btn1,
                $btn2: $btn2,
                isB2C: isB2C,
                seq: seq,
                type: type,
                key: key,
                receptionUin: receptionUin
            }), ctx);
        }
    };

    //开始邀请
    var startInvitation = function(options, ctx, extraOptions) {
        extraOptions = extraOptions || {};
        var inviteTpl = options.inviteTpl,
            inviteConf = options.inviteConf,
            kfuin = inviteConf.kfuin,
            autoInvited = inviteConf.autoInvited || {},
            active = autoInvited.active,
            repeat = autoInvited.repeat || {},
            repeatActive = repeat.active || false,
            repeatInterval = repeat.finterval,
            repeatFrequency = Number(repeat.frequency),
            reception = autoInvited.reception || {},
            recType = reception.type,
            recCuin = reception.cuin,
            condition = autoInvited.condition || {},
            stayPeriod = condition.stayPeriod,
            //1: 移动，2：PC
            deviceType = condition.deviceType,
            isInviteApi = extraOptions.isInviteApi;

        if (typeof win.__WPA[KFUIN_INVITED_TIMES][kfuin] === 'undefined') {
            win.__WPA[KFUIN_INVITED_TIMES][kfuin] = repeatFrequency;
        }

        //开启了自动邀请，或满足了自动邀请的条件
        if (isInviteApi || active) {
            //判断弹出的条件
            if (isInviteApi || deviceType == 3 || (isMobile && deviceType == 1) || (!isMobile && deviceType == 2)) {
                if (isInviteApi || stayPeriod == 0) {
                    showInvitation({
                        inviteTpl: inviteTpl,
                        inviteConf: inviteConf
                    }, ctx);
                } else {
                    setTimeout(function() {
                        showInvitation({
                            inviteTpl: inviteTpl,
                            inviteConf: inviteConf
                        }, ctx);
                    }, stayPeriod * 1000);
                }
            }

            //如果拒绝后设置了重复弹出
            //important!!!
            if (repeatActive) {
                //会话邀请框消失后，根据频率来重复邀请
                win.__WPA.on('startInviteTimeout', function(kfuin) {
                    // if (ctx.Invite.inviteTotlTimes == 0) {
                    if (win.__WPA[KFUIN_INVITED_TIMES][kfuin] < 0) {
                        return log('auto invite reached max times');
                    }
                    win.__WPA.KFUINS[kfuin].setTimeoutInvite = setTimeout(function() {
                        // ctx.Invite.inviteTotlTimes--;
                        showInvitation({
                            inviteTpl: inviteTpl,
                            inviteConf: inviteConf
                        }, ctx);
                    }, repeatInterval * 1000);
                });
            }
        }
    };

    //停止邀请
    var stopInvitation = function() {

    };

	var showInvitation = exports.showInvitation = function(options, ctx) {

		var inviteTpl = options.inviteTpl,
            inviteConf = options.inviteConf,
            isB2C = options.isB2C,
            seq = options.seq,
            type = options.type,
            key = options.key,
            receptionUin = options.receptionUin,
            kfuin = inviteConf.kfuin,
			iframeId = INVITE_IFRAME_ID_PREFIX + kfuin,
			css = inviteTpl.css,
			iframeStyle = tpl.getIframeStyle(inviteTpl, inviteConf),
			style = iframeStyle.style,
			width = iframeStyle.width,
			height = iframeStyle.height,
            btns = inviteConf.btns || [],
            btnsNum = btns.length;

        if (win.__WPA.IM_CHAT_IFRAME_OPENING) {
            return;
        }

        if (doc.getElementById(iframeId)) {
            return log('invite iframe ' + kfuin + ' already exists');
        }

        win.__WPA[KFUIN_INVITED_TIMES][kfuin]--;

		var strIframe = '<iframe scrolling="no" id="' + iframeId + '" frameborder="0" width="' + width + '" height="' + height + '" allowtransparency="true" src="about:blank" style="{style}" ></iframe>';
		strIframe = strIframe.replace('{style}', style);

        // ie will reject operations when parent's domain is set
        var iframe;
        try{//ie
            iframe = doc.createElement(strIframe);
        } catch(e) {//none ie
            iframe = doc.createElement('iframe');
            iframe.width = width;
            iframe.height = height;
            iframe.id = iframeId;
            iframe.style.cssText = style;
            iframe.setAttribute('scrolling', 'no');
            iframe.setAttribute('frameborder', 0);
            iframe.setAttribute('allowtransparency', true);
            iframe.setAttribute('src', 'about:blank');
            if (!isMobile) {
            	iframe.width = width;
            }
        }

        body.appendChild(iframe);

        var loaded = function() {
        	var iWin = iframe.contentWindow,
                iDoc = iframe.contentDocument || iWin.document;

            iDoc.open();
            iDoc.write([
                //'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
                '<!doctype html>',
                '<html xmlns="http://www.w3.org/1999/xhtml">',
                '<head>',
                    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
                    //todo
                    browser.msie && iframe.src !== 'about:blank' ? '<script>document.domain=\'' + document.domain + '\';</script>' : '',
                '</head>',
                '<body>',
                    inviteTpl.tpl,
                '</body>',
                '</html>'
            ].join(''));
            iDoc.close();

            var styleObj = {
                name: 'style',
                cssText: css,
                doc: iDoc
            };

            Style.commonAdd(styleObj);

            bindEvents(iframe, inviteConf, {
                ctx: ctx,
                isB2C: isB2C,
                seq: seq,
                type: type,
                key: key,
                receptionUin: receptionUin
            });
        };

        onIframeLoaded(iframe, loaded);
	};

    var defaultInviteStyle = {
        "type":"1",//样式类型
        "title": "客服在线，欢迎咨询",
        "content": "您好，当前有客服在线，点击即可咨询",
        "btns": [{
          "type": "im",//("phone", "im")
          "text": "网页咨询"
        }],
        "theme": "1"//1 2 3 4 5
    };

	//根据规则开始弹邀请
	exports.init = function(options, extraOptions) {
        extraOptions = extraOptions || {};

		var self = this,
            key = options.key,
            kfuin = this.params.fkfuin,
            /*********todo:所有类型wpa都邀请开始********************/
            // kfuin = options.kfuin,
            /*********todo:所有类型wpa都邀请结束********************/
			inviteConf = options,
            invitedStyle = inviteConf.invitedStyle || defaultInviteStyle,
			inviteTpl = tpl.getTpl(invitedStyle),
            isInviteApi = extraOptions.isInviteApi;
        if (initedKfuinInvite[kfuin] && !isInviteApi) {
            return;
        }
        initedKfuinInvite[kfuin] = true;
        inviteConf.kfuin = kfuin;
        win.__WPA[GLOBAL_INVITE_TPL_AND_CONF][kfuin] = {
            tpl: inviteTpl,
            conf:inviteConf,
            key: key
        };
        startInvitation({
            inviteTpl: inviteTpl,
            inviteConf: inviteConf
        }, self, extraOptions);
	};

	exports.getInviteConf = getInviteConf;

	exports.tpl = tpl;
});

/** src/proto/socket.js **/
/**
 * 离线在线长链
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/10/27
 *
 */
LBF.define('wpa.proto.socket', function(require, exports, module) {

	var conf = require('wpa.conf.config'),
		POST_MESSAGE_FLAG = conf.POST_MESSAGE_FLAG,
        POST_MESSAGE_FLAG_CONTENT = conf.POST_MESSAGE_FLAG_CONTENT,
		KFUINS = conf.KFUINS,
		isMobile = conf.isMobile ? 1 : 0,
		WEB_IM_IFRAME_ID = conf.WEB_IM.WEB_IM_IFRAME_ID,
		WPAS_BASED_ON_KFUIN = conf.WPAS_BASED_ON_KFUIN,
		win = conf.gWin,
		doc = win.document,
		body = doc.body,
		log = require('wpa.util.log'),
		SOCKET = conf.SOCKET,
		ACTS = SOCKET.ACTS,
		URL = SOCKET.URL,
		SOCKET_IFRAME_ID = SOCKET.SOCKET_IFRAME_ID,
		INVITE_IFRAME_ID_PREFIX = conf.INVITE_IFRAME_ID_PREFIX,
		UNREAD_MSG_INFO = conf.UNREAD_MSG_INFO,
		WPAS_IM_TYPE = conf.WEB_IM.WPAS_IM_TYPE,
		Invite = require('wpa.invite.main'),
		InviteApi = require('wpa.invite.inviteApi'),
		domEvent = require('wpa.util.domEvent'),
		imInit = require('wpa.im.init'),
		UnreadMsgCircle = require('wpa.proto.UnreadMsgCircle'),
		onIframeLoaded = require('wpa.util.onIframeLoaded'),
		// _S = require('wpa.util.sandbox')(),
		_S = conf.sandbox,
		JSON = require('lang.JSON');

	var iframeStyle = [
			'width:0',
			'height:0',
			'position:fixed',
			'right:0',
			'bottom:0'
		].join(';') + ';';

	var isSocketEstablished = false,
		initObjList = [],
		//整个页面，无论有几个不同主号的wpa
		//socketWin只有1个
		socketWin;

	var referUrl = doc.referrer,
		ldpUrl = win.location.href,
		ldpTitle = doc.title;

    /**
     * 爬虫浏览器的title会有乱码的问题，这里通过ua判断是爬虫浏览器后，设置title为空
     */
    // var ua = navigator.userAgent.toLowerCase(),
    //     spiderList = ['spider'],
    //     isInSpider = false;

    // for (var i = 0; i < spiderList.length; i++) {
    //     if (ua.indexOf(spiderList[i]) > -1) {
    //         isInSpider = true;
    //     }
    // }

    // if (isInSpider) {
    //     ldpTitle = '怀疑为网络爬虫';
    // }

	win.__WPA[UNREAD_MSG_INFO] = {};

	var sendMsg;

	//在线状态长链建立好后，监听事件
	var initSocketListener = function() {
		domEvent.addEvent(win, 'message', function(e) {

			var r = e.data || {};

			var origin = e.origin || e.originalEvent.origin;
			log('[socket.js]:origin is:' + origin);
			// if (origin.indexOf(conf.IM_ORIGIN) === -1) {
			if (!conf.IM_ORIGIN_REG.test(origin)) {
				return log('[socket.js]origin error');
			}

			if (typeof r === 'string') {
				try {
					r = JSON.parse(r);
				} catch (e) {
					log('JSON.parse error in initSocketListener');
					log(e);
				}
			}

			var act = r.act,
				kfuin = r.kfuin,
				data = r.data || {};

			if (act == ACTS.SM_READY) {
				postInitQueue(socketWin);
			} else if (act == ACTS.SM_UNREAD) {
				var number = _S.Number(data.number),
					offlineMsgKey = data.offlineMsgKey,
					key = data.key,
					receptionUin = data.receptionUin,
					receptionName = data.receptionName;

				/*
					因为给皮肤的theme时，number可能为0
					所以这里只能在number > 0的时候，设置unread_msg_info
				*/
				if (number > 0) {
					win.__WPA[UNREAD_MSG_INFO][kfuin] = {
						offlineMsgKey: offlineMsgKey,
						key: key,
						receptionUin: receptionUin,
						receptionName: receptionName
					};
				}

				/*2017/10/30
					pc端打开页面有未读消息的时候
					给webim的onlyOpen不能为true
					所以这里pc端也要判断unread.socket
				*/
                if (win.__WPA[KFUINS][kfuin]) {
                    win.__WPA[KFUINS][kfuin].unread.socket = number;
                }
				if (isMobile) {
					UnreadMsgCircle.showAllRedCircles(kfuin, number);
				} else {
					var imIframeId = WEB_IM_IFRAME_ID + kfuin,
						theme = typeof data.theme !== undefined ? data.theme : 1,
						targetPCImIframe = document.getElementById(imIframeId);
					sendMsg = {
						act: ACTS.UPDATE_UNREAD,
						kfuin: kfuin,
						offlineMsgKey: offlineMsgKey,
						key: key,
						theme: theme,
						receptionUin: receptionUin,
						receptionName: receptionName,
						number: number
					};
					sendMsg[POST_MESSAGE_FLAG] = POST_MESSAGE_FLAG_CONTENT;
					sendMsg = JSON.stringify(sendMsg);
					targetPCImIframe.contentWindow.postMessage(sendMsg, '*');
				}
			} else if (act == ACTS.SM_MANUAL_INVITE) {
				log('SM_MANUAL_INVITE');
				//这里应该是弹出kfuin对应的邀请弹框
				//1. 弹邀请框
				//2. 直接打开im页面
				var type = data.type,
					seq = data.seq,
					key = data.key,
					receptionUin = data.receptionUin;
				if (type == 1) {//弹邀请框
					if (win.__WPA.GLOBAL_INVITE_TPL_AND_CONF[kfuin]) {
						//如果此时页面已经出现了邀请弹框
						//则不弹出相同主号的要情况
						var inviteRule = win.__WPA.GLOBAL_INVITE_TPL_AND_CONF[kfuin],
							inviteTpl = inviteRule.tpl,
							inviteConf = inviteRule.conf;
						if (doc.getElementById(INVITE_IFRAME_ID_PREFIX + kfuin)) {
							return log('invite panel already exists');
						}
						if (!imInit.isImIframeLoaded(kfuin)) {
							//这里是非im的wpa初始化加载im聊天窗口iframe用的
							imInit.initIframe({
								kfuin: kfuin
							});
						} else {
							Invite.showInvitation({
								inviteTpl: inviteTpl,
								inviteConf: inviteConf,
								isB2C: true,
								seq: seq,
								type: type,
								key: key,
								receptionUin: receptionUin
							}, null);
						}
					} else {
						log('invite rule with kfuin ' + kfuin + ' does not exist');
					}
				} else if (type == 2) {//弹im页
					win.__WPA.IM.openChatIframe({
						kfuin: kfuin,
						seq: seq,
						receptionUin: receptionUin,
						key: key,
						type: type,
						isDirectOpen: true
					});
				} else if (type == 5) {
					/*
						added on 2018/03/01
						type为5的时候
						透传参数给chat iframe
						同时act改为SM_MANUAL_INVITE
					*/
					var imIframeId = WEB_IM_IFRAME_ID + kfuin,
						targetImIframe = document.getElementById(imIframeId);
					sendMsg = r;
					r.act = ACTS.SM_MANUAL_INVITE;
					sendMsg[POST_MESSAGE_FLAG] = POST_MESSAGE_FLAG_CONTENT;
					sendMsg = JSON.stringify(sendMsg);
					targetImIframe.contentWindow.postMessage(sendMsg, '*');
				}

			} else if (act == ACTS.SM_INVITE_CONF) {
				log('SM_INVITE_CONF');
				var inviteRule = r.inviteRule;
				inviteRule.kfuin = kfuin;
				log(inviteRule);
				if (typeof win.__WPA.GLOBAL_INVITE_TPL_AND_CONF[kfuin] === 'undefined') {
					// if (!win.__WPA.WPAS_IM_TYPE[kfuin]) {
					// 	return log('[socket.js][on SM_INVITE_CONF]no im wpa with kfuin ' + kfuin);
					// }
					/*********todo:所有类型wpa都邀请开始********************/
					// var wpa;
					// if (win.__WPA.WPAS_IM_TYPE[kfuin]) {
					// 	wpa = win.__WPA.WPAS_IM_TYPE[kfuin][0];
					// } else if (win.__WPA[WPAS_BASED_ON_KFUIN][kfuin]) {
					// 	wpa = win.__WPA[WPAS_BASED_ON_KFUIN][kfuin][0];
					// } else {
					// 	return log('[socket.js][on SM_INVITE_CONF]no im wpa with kfuin ' + kfuin);
					// }
					// wpa.Invite.init.call(wpa, inviteRule);
					/**********所有类型wpa都邀请结束************/

					//2017/04/18:放开qq类型的im能力(包含im会话和邀请)
					//考虑同一主号在页面上挂载qq和电话wpa
					//需要找到第一个cate为1或7的wpa即可
                    if (win.__WPA[WPAS_BASED_ON_KFUIN][kfuin]) {
                        for (var i = 0, len = win.__WPA[WPAS_BASED_ON_KFUIN][kfuin].length; i < len; i++) {
                            var wpa = win.__WPA[WPAS_BASED_ON_KFUIN][kfuin][i];
                            if (wpa.params.cate == conf.TYPES.QQ || wpa.params.cate == conf.TYPES.IM) {
                                break;
                            }
                        }
                        //下面这一行代码只是放开IM类型wpa的邀请能力
                        // var wpa = win.__WPA.WPAS_IM_TYPE[kfuin][0];
                        wpa.Invite.init.call(wpa, inviteRule);
                        InviteApi.add(wpa, inviteRule);
                    }
				}
			} else if (act == ACTS.SM_REFUSE) {
				sendMsg = {
					act: ACTS.SM_REFUSE,
					kfuin: kfuin
				};
				sendMsg[POST_MESSAGE_FLAG] = POST_MESSAGE_FLAG_CONTENT;
				sendMsg = JSON.stringify(sendMsg);
				socketWin.postMessage(sendMsg, '*');
			} else if (act == ACTS.SMS_SM_FORCE_CONNECT) {
				sendMsg = {
					act: ACTS.SMS_SM_FORCE_CONNECT
				};
				sendMsg[POST_MESSAGE_FLAG] = POST_MESSAGE_FLAG_CONTENT;
				sendMsg = JSON.stringify(sendMsg);
				socketWin.postMessage(sendMsg, '*');
			} else if (act == ACTS.SM_CHAT_OVER) {
				win.__WPA.trigger('startInviteTimeout', kfuin);
			} else if (act == ACTS.DISCONNECT) {
				//逐一通知各主号聊天iframe disconnect事件
				var kfuinsObj = win.__WPA[KFUINS];
				for (var i in kfuinsObj) {
					if (kfuinsObj.hasOwnProperty(i)) {
						sendMsg = {
							act: ACTS.DISCONNECT
						};
						sendMsg[POST_MESSAGE_FLAG] = POST_MESSAGE_FLAG_CONTENT;
						sendMsg = JSON.stringify(sendMsg);
						doc.getElementById(WEB_IM_IFRAME_ID + i).contentWindow.postMessage(sendMsg, '*');
					}
				}
			}
		});
	};

	var postInitQueue = function(iWin) {
		for (var i = 0, len = initObjList.length; i < len; i++) {
			var obj = initObjList.shift();
			obj[POST_MESSAGE_FLAG] = POST_MESSAGE_FLAG_CONTENT;
			obj = JSON.stringify(obj);
			socketWin.postMessage(obj, '*');
		}
	};

	var isSocketListenerAdded = false;
	exports.establishSocket = function() {

		var self = this,
			params = self.params,
			isGray = this.env.isGray,
			kfuin = params.fkfuin,
			visitorId = params.guid,
			iframeId = SOCKET_IFRAME_ID,
			initParam = {
				kfuin: kfuin,
				visitorId: visitorId,
				isMobile: isMobile,
				act: ACTS.SM_INIT,
				referUrl: referUrl,
                ua: window.navigator.userAgent,
				ldpUrl: decodeURIComponent(ldpUrl),
				ldpTitle: decodeURIComponent(ldpTitle)
			};

		if (!isSocketListenerAdded) {
			isSocketListenerAdded = true;
			initSocketListener();
		}

		//2017/04/20添加：允许qq类型的邀请和能力im能力
        if (!((params.cate == conf.TYPES.IM || params.cate == conf.TYPES.QQ) && !conf.isInAdmin)) {
            return;
        }

		initObjList.push(initParam);

		if (!socketWin) {

			if (!isSocketEstablished) {
				isSocketEstablished = true;

				var strIframe = '<iframe scrolling="no" id="' + iframeId + '" frameborder="0" width="0" height="0" allowtransparency="true" src="' + URL + '" style="' + iframeStyle + '"></iframe>';

				var iframe;
		        // ie will reject operations when parent's domain is set
		        try{//ie
		            iframe = doc.createElement(strIframe);
		        } catch(e) {//none ie
		            iframe = doc.createElement('iframe');
		            iframe.width = 0;
		            iframe.height = 0;
		            iframe.id = iframeId;
		            iframe.style.cssText = iframeStyle;
		            iframe.setAttribute('scrolling', 'no');
		            iframe.setAttribute('frameborder', 0);
		            iframe.setAttribute('allowtransparency', true);
		            iframe.setAttribute('src', URL);
		        }

		        body.appendChild(iframe);

		        onIframeLoaded(iframe, function() {
		        	socketWin = win.__WPA[SOCKET_IFRAME_ID] = iframe.contentWindow;
		        	// initSocketListener(iWin);
		        });
			}
		}
	};
});

/** src/proto/getGdtClickId.js **/
/*
 * 获取gdt的click_id
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2016/09/14
 *
 */
LBF.define('wpa.proto.getGdtClickId', function(require, exports, module) {

	var jsonp = require('util.jsonp'),
		removeCustomProp = require('wpa.util.removeCustomProperty'),
		extend = require('lang.extend'),
		conf = require('wpa.conf.config'),
		win = conf.gWin,
		getCPType = require('wpa.proto.getCPType'),
		CB_NAME = 'jsonp_cb_',
		cid = 0;

	var url = 'https://t.gdt.qq.com/conv/web/cookies/jsonp',
		cbName = CB_NAME + cid++;

	var getGdtClickId = function(params) {

		//确保打开一个页面后，获取gdt的click_id的接口只执行一次
        if (typeof win._gdtClickId === 'undefined') {
        	var opts = {
				cb: cbName,
				callback: cbName
			};
			// removeCustomProp(opts);
            jsonp(url, opts, function(rs) {
				//获取gdt返回的click_id
				if (rs && rs.ret == 0) {
					win._gdtReportData = extend({
						client_id: 54,//写死的，广点通标识
						click_id: rs.click_id,
						visitorid: params.guid,
						kfuin: params.fkfuin,
						ldpg: win.location.href
					}, getCPType(params));
				} else {
					win._gdtReportData = 0;
				}
			});
        }
	};

	module.exports = exports = getGdtClickId;
	
});
/** src/proto/UnreadMsgCircle.js **/
/**
 * 绘制红色消息圆点,仅在移动端有效
 * 为配合移动端非im的邀请，移动端再也没有小红点了，用小蓝条代替，此改动是2017/04/17开始的
 * tapd: http://tapd.oa.com/TencentNewBiz/prong/stories/view/1010109441058960805
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/09/20
 *
 */
LBF.define('wpa.proto.UnreadMsgCircle', function(require, exports, module) {

	var browser = require('lang.browser'),
		getOffset = require('wpa.util.getOffset'),
		conf = require('wpa.conf.config'),
		WPAS_BASED_ON_KFUIN = conf.WPAS_BASED_ON_KFUIN,
		KFUINS = conf.KFUINS,
		isMobile = conf.isMobile,
		win = conf.gWin,
		CATE_WEB_IM = conf.TYPES.IM,
		CATE_QQ = conf.TYPES.QQ,
		WPAS_IM_TYPE = conf.WEB_IM.WPAS_IM_TYPE,
		Style = require('wpa.util.Style'),
		log = require('wpa.util.log'),
		wpaType = require('wpa.conf.wpaType'),
		domEvent = require('wpa.util.domEvent'),
		proxy = require('lang.proxy'),
		onIframeLoaded = require('wpa.util.onIframeLoaded'),
		mobileUnreadBar = require('wpa.proto.mobileUnreadBar');

	var CIRCLE_CLASS_NAME = 'qidian_wpa_unread_msg_circle',
		WIDTH = 20,
		HEIGHT = 20,
		WPA_ID_PREFIX = conf.WPA_ID_PREFIX,
		actualPosition = 'absolute',
		CIRCLE_ID_PREFIX = 'qidian_wpa_id_unread_msg_circle_',
		// SHOWNING_RED_CIRCLE_WPAS = '__SHOWNING_RED_CIRCLE_WPAS',
		CIRCLE_INNER_CSS_TEXT = [
			'* {margin:0;padding:0;}',
			'body {font-family:\"PingFang SC\", \"Droid Sans Fallback\";background:#ff4222;color:#fff;font-size:12px;text-align:center;height:20px;line-height:20px;}',
			'span {cursor: pointer;}'
		].join('');

	var	doc = win.document,
		body = doc.body;

	var canShowUnreadMsg = function(cate) {
		return cate == CATE_WEB_IM || cate == CATE_QQ;
	}

	exports.showAllRedCircles = function(kfuin) {

		if (!isMobile) {
			return;
		}

		var unreadNum = win.__WPA[KFUINS][kfuin].unread,
			number = unreadNum.chat + unreadNum.socket;

		if (number <= 0) {
			return;
		}

		win.__WPA[WPAS_BASED_ON_KFUIN][kfuin] && win.__WPA[WPAS_BASED_ON_KFUIN][kfuin][0].updateUnreadMsgCircle(number);
		return;

		var imWpas = win.__WPA.WPAS_IM_TYPE;
		if (imWpas[kfuin]) {
			for (var i = 0, len = imWpas[kfuin].length; i < len; i++) {
				var imWpa = imWpas[kfuin][i],
					unreadNum = win.__WPA[KFUINS][kfuin].unread,
					number = unreadNum.chat + unreadNum.socket;
				imWpa.updateUnreadMsgCircle(number);
			}
		}
	};

	var removeUnreadMsgCircle = exports.removeUnreadMsgCircle = function(kfuin) {

		if (!isMobile) {
			return;
		}

		if (!canShowUnreadMsg(this.params.cate)) {
			return;
		}

		mobileUnreadBar.removeUnreadMsgBar(kfuin);
	};

	exports.removeAllRedCircles = function(kfuin) {
		if (!isMobile) {
			return;
		}
		//清除小红点数目
		var unreadNum = win.__WPA[KFUINS][kfuin].unread;
		unreadNum.chat = unreadNum.socket = 0;

		//2017/04/18:放开qq类型的im能力(包含im会话和邀请)
		//同时移动端只有一个小蓝条提醒
		//所以这里判断wpa就不再使用win.__WPA.WPAS_IM_TYPE来判断了
		//只要是相同kfuin的wpa就行

		//以前的代码开始
		// var imWpas = win.__WPA.WPAS_IM_TYPE;
		// if (imWpas[kfuin]) {
		// 	for (var i = 0, len = imWpas[kfuin].length; i < len; i++) {
		// 		var imWpa = imWpas[kfuin][i];
		// 		imWpa.removeUnreadMsgCircle(kfuin);
		// 	}
		// }
		//以前的代码结束
		win.__WPA[WPAS_BASED_ON_KFUIN][kfuin] && win.__WPA[WPAS_BASED_ON_KFUIN][kfuin][0].removeUnreadMsgCircle(kfuin);
	};

	exports.updateUnreadMsgCircle = function() {

		if (!isMobile) {
			return;
		}

		var self = this,
			kfuin = this.params.fkfuin;

		if (!canShowUnreadMsg(this.params.cate)) {
			return;
		}

		var unreadNum = win.__WPA[KFUINS][kfuin].unread,
			number = unreadNum.chat + unreadNum.socket;

		//小蓝条取代小红点
		mobileUnreadBar.drawBar({
			kfuin: kfuin,
			number: number
		});
	};
});
/** src/proto/pvReport.js **/
/**
 * pv report based on each kfuin
 * @author: vergilzhou
 * @version: 4.1.0
 * @date: 2017/08/10
 *
 */
LBF.define('wpa.proto.pvReport', function(require, exports, module) {

	var conf = require('wpa.conf.config'),
		win = conf.gWin,
		doc = win.document,
		ENV = conf.ENV,
		extend = require('lang.extend'),
		localStorage = require('util.localStorage'),
		log = require('wpa.util.log'),
		formReport = require('wpa.util.formReport');

	var CGI_PV_REPORT = conf.cgiDomain + '/ar/ActCap/pvRpt';

	win.__QIDIAN = win.__QIDIAN ? win.__QIDIAN : {kfuins: {}};
	var globalKfuins = win.__QIDIAN.kfuins,
		pvData = {
			//mid目前保留，为空字符串
			mid: '',
			//落地页
			ldpg: win.location.href,
			//来源页
			refurl: typeof doc.referrer !== 'undefined' ? doc.referrer : '',
			//浏览器信息
			ua: win.navigator.userAgent,
			//落地页标题
			title: encodeURIComponent(doc.title),
			//是pc还是移动端
			eptype: conf.isMobile ? 2 : 1,
			//env
			env: ENV
		};

	exports.pvReport = function(data) {

		var kfuin = data.kfuin;

		if (!globalKfuins[kfuin]) {
			globalKfuins[kfuin] = true;
			// pvData.kfuin = kfuin;
			setTimeout(function() {
				formReport({
					action: CGI_PV_REPORT,
					data: extend({kfuin: kfuin}, pvData)
				});
			}, 300);
			
		}
	};

	exports.setGlobalVisitorId = function(data) {
		var vid = data.vid,
			pid = data.pid,
			qid = data.qid;
		pvData.pid = pid;
		pvData.qid = qid;
		if (!win.__QIDIAN.visitorId) {
			win.__QIDIAN.visitorId = vid;
		}
		pvData.qidianid = pvData.visitorid = win.__QIDIAN.visitorId;
	}

});
/** src/proto/addDa.js **/
/* 添加boss的i.js监控代码
 * @author: vergilzhou
 * @version: 4.0.0
 * @date: 2016/07/14
 */
LBF.define('wpa.proto.addDa', function(require, exports, module) {

	var localStorage = require('util.localStorage'),
        cookie = require('util.Cookie'),
        log = require('wpa.util.log'),
        conf = require('wpa.conf.config'),
        win = conf.gWin;

	//boss的监测代码加载变量以及标志位
    var isDaAdded = 'isDaAdded',
        isFetchingDa = 'isFetchingDa',
        SRC = 11,//企点的src为固定的11
        daList = [];

    var mqqSrc = '//open.mobile.qq.com/sdk/qqapi.js?_bid=152',
        head = document.head || document.getElementsByTagName("head")[0] || document.documentElement,
        baseElement = head.getElementsByTagName("base")[0];

	//异步添加script标签
	var fetch = function(uri, id, cb) {
        var node = document.createElement("script");

        node.charset = 'utf-8';
        node.async = true;
        node.src = uri;
        node.id = id || '';

        // For some cache cases in IE 6-8, the script executes IMMEDIATELY after
        // the end of the insert execution, so use `currentlyAddingScript` to
        // hold current node, for deriving uri in `define` call
        var currentlyAddingScript = node;
        
        node.onreadystatechange = node.onload = function() {
            if(/loaded|complete|undefined/.test(node.readyState) && typeof cb === 'function') {
                cb();
                node.onreadystatechange = node.onload = null;
            }
        };

        // ref: #185 & http://dev.jquery.com/ticket/2709
        baseElement ?
            head.insertBefore(node, baseElement) :
            head.appendChild(node);

        currentlyAddingScript = null;
    };

    var visitorId = '',
        fetchedTencentSig = false;

    var _log = log;

    var qidianDAReport = function() {
        try {
            var GLOBAL = win;
            // 这个是固定的，用于让用户自定义暴露接口的名字
            var HOOK_NAME = '__qq_qidian_da';
            // 对外接口的名字
            var EXPORT_NAME = GLOBAL[HOOK_NAME] || 'qidianDA';
            if (!EXPORT_NAME) {
                return;
            }
            var qidianDA = GLOBAL[EXPORT_NAME],
                nameAccount = daList.shift();
            if (!nameAccount) {
                return;
            }
            qidianDA('create', String(nameAccount), {
                'cid': String(visitorId),
                'src': SRC,
                'pgv_pvi':  cookie.get('pgv_pvi') || '' 
            });
            qidianDA('set', 't1', new Date());
        } catch (e) {
            _log('[WPA][qidianDAReport]:error occured');
            _log(e);
        }
    };

    var addDaScript = function(nameAccount) {

        if (!fetchedTencentSig) {
            visitorId = localStorage.getItem(conf.tencentSig) || '';
            fetchedTencentSig = true;
        }

        daList.push(nameAccount);
        if (!win[isFetchingDa]) {
            win[isFetchingDa] = true;
            fetch('//bqq.gtimg.com/da/i.js', '_da', function() {
                win[isDaAdded] = true;
                qidianDAReport();
            });
        } else {
            if (win[isDaAdded]) {
                qidianDAReport();
            }
        }
    };

    exports = module.exports = addDaScript;

});
/** src/protocol/chat.js **/
/*
 * WPA chat protocol
 * @author: amoschen
 * @version: 0.0.1
 * @date: 2014/08/19
 */
LBF.define('wpa.protocol.chat', function (require, exports) {
    var browser = require('lang.browser'),
        SpeedReport = require('monitor.SpeedReport'),
        GUID = require('util.GUID'),
        domain = require('util.domain'),
        extend = require('lang.extend'),
        // todo
        // util.request
        jsonp = require('util.jsonp'),
        onIframeLoaded = require('wpa.util.onIframeLoaded'),
        platformAuthorization = require('wpa.util.platformAuthorization'),
        getAuthorizationPageUrl = require('wpa.util.getAuthorizationPageUrl'),
        isFunction = require('lang.isFunction'),
        conf = require('wpa.conf.config'),
        CLICK_TYPE = conf.CLICK_TYPE,
        win = conf.gWin,
        eptype = conf.eptype,
        chatConst = require('wpa.conf.chat'),
        globalSettings = require('globalSettings'),
        // todo
        kfuinCache = require('wpa.protocol.kfuin'),
        getReportData = require('wpa.util.getReportData'),
        serialize = require('util.serialize'),
        removeCustomProp = require('wpa.util.removeCustomProperty'),
        launchSchema = require('wpa.util.launch'),
        CustomParams = require('wpa.proto.CustomParams'),
        compareVersion = require('wpa.util.compareVersion'),
        domEvent = require('wpa.util.domEvent'),
        getLBSLocation = require('wpa.util.getLBSLocation'),
        protocol = globalSettings.protocol;

    var CHAT_TYPE_AUTO = chatConst.CHAT_TYPE_AUTO,
        CHAT_TYPE_ANONYMOUS = chatConst.CHAT_TYPE_ANONYMOUS,
        CHAT_TYPE_QQ = chatConst.CHAT_TYPE_QQ,
        PC_QQ_SCHEMA_CGI = chatConst.PC_QQ_SCHEMA_CGI,
        LAUNCH_MOBILE_QQ = chatConst.LAUNCH_MOBILE_QQ,
        LAUNCH_LINK = chatConst.LAUNCH_LINK;

    /**************企点新cgi地址start**********************/
    var CGIS = conf.CGIS,
        TYPE_PC = 0,
        TYPE_MOBILE = 1,
        ENV = conf.ENV,
        ERROR_INVALID_STAFF = 50001,
        SUCCESS_RETURN_CODE = 0,
        ERROR_MSG_INVALID_STAFF = '抱歉，企业暂时无人接待';
    /**************企点新cgi地址end**********************/
    try {
        (function () {
            // 加载eruda调试工具；需要在地址栏后面加上?eruda=true来进行调试
            if (!/eruda=true/.test(window.location) && localStorage.getItem('active-eruda') != 'true') return;
            var head = document.getElementsByTagName('head')[0];
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.onload = function() {
                eruda.init();
            }
            script.src = '//cdn.jsdelivr.net/npm/eruda';
            head.appendChild(script);
        })();
        // get env vars ready
        var body = document.getElementsByTagName('body')[0],
            isInMobileQQ = conf.BROWSER_ENV.isInMobileQQ,
            isInWX = conf.BROWSER_ENV.isInWX,
            wxVersion = conf.BROWSER_ENV.wxVersion,
            doc = document,
            head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement,
            baseElement = head.getElementsByTagName("base")[0],
            currentlyAddingScript,
            ua = navigator.userAgent;
    
        // PC QQ chat
    
        // prepare ifram for PC QQ chat schema
        // if( !conf.isSSL ){
        //     var PCQQChatIframe = doc.createElement('iframe');
    
        //     PCQQChatIframe.style.display = 'none';
        //     body.insertBefore(PCQQChatIframe, body.firstChild);
        // }
        var fetch = function fetch(uri) {
            var node = doc.createElement("script");
            node.charset = 'utf-8';
            node.async = false;
            node.src = uri;
            node.id = 'mqqjs';
            // For some cache cases in IE 6-8, the script executes IMMEDIATELY after
            // the end of the insert execution, so use `currentlyAddingScript` to
            // hold current node, for deriving uri in `define` call
            currentlyAddingScript = node;
            baseElement ?
                head.insertBefore(node, baseElement) :
                head.appendChild(node);
            currentlyAddingScript = null;
        }
        // 加载调用手Q接口的JS文件
        if (ua.match(/QQ\/([\d.]+)/) && ua.match(/Android/)) {
            // 只有在安卓中的手Q才需要加载这样的一段代码
            fetch('//open.mobile.qq.com/sdk/qqapi.wk.js?_bid=152');
        }
    } catch(err) {
        alert('错误消息:', err.message);
    }

    exports.PCChat = function (params, onChat) {
        // 获取授权页地址
        var authPath = getAuthorizationPageUrl();

        var opts = {
            kfuin: params.fkfuin,
            kfext: params.fkfext,
            visitorId: params.guid,
            visitorid: params.guid,
            fid: params.id,
            key: params.key,
            cate: params.cate,
            type: params.type,
            ftype: TYPE_PC,
            tptype: params.tptype,
            tpForm: params.tpForm,
            roleKey: params.roleKey,
            roleValue: params.roleValue,
            // roleName: params.roleName,
            roleUin: params.roleUin,
            pid: params.pid,
            clickid: params.clickid,
            qid: params.qid,
            env: ENV,
            eptype: eptype,
            clickType: params.clickType,
            roleData: params.roleData,
            isKfuin: params.isKfuin,
            isLBS: params.isLBS, // 是否获取LBS定位，0否，1是，默认0
            isCustomEntry: params.isCustomEntry, // 是否自定义进线，0否，1是，默认0
            // reportData: getReportData(params, null, true)
        };

        if (win.wpaShowItemId) {
            opts.wpaShowItemId = win.wpaShowItemId;
        }

        var getProtocolUrl = CGIS.GET_SIGT[ENV];

        //公众号接待调用新的接口
        if (params.isPub) {
            getProtocolUrl = CGIS.GET_MP_SIGT[ENV];
        }

        CustomParams.setCustomParams(opts);

        // removeCustomProp(opts);

        /**
         * 2019/07/13
         * 新增中转页开关判断逻辑，中转开关数据格式如下：
         * middlePage: {
         *     pc: '1', // 1-跳转中间页 0-不跳转中间页
         *     mobile: '1' // 1-跳转中间页 0-不跳转中间页
         * }
         * 历史数据中不包含该字端，走默认的逻辑，PC端不跳转中间页
         */
        var isJump = false,
            jumpUrl = '',
            jumpWin = null;

        // 判断是否需要跳转中间页
        if (params.middlePage) {
            isJump = parseInt(params.middlePage.pc) ? true : false;
        }

        /**
         * 2019/07/23
         * cate=8 b2b企点接待通路wpa不需要跳中间页
         */
        if (params.cate == 8) {
            isJump = false;
        }

        // 浏览器拦截window.open的解决方案
        // 参考：https://stackoverflow.com/questions/20696041/window-openurl-blank-not-working-on-imac-safari
        var createJumpPage = function () {
            jumpWin = win.open('', '_blank');
            jumpWin.document && jumpWin.document.write('正在跳转，请稍等...');
        };

        if (isJump) {
            // 2020/06/09
            // 需要调用浏览器获取经纬度时，不在这里创建新窗口，而是等到获取经纬度成功或失败后再创建
            if (!opts.isLBS) createJumpPage();
        }

        var handleProtocol = function (rs) {
            if (!rs || rs.r !== 0 || !rs.data) {
                // todo
                // logger

                //这里是推广员失效的异常提示逻辑
                // if (rs && rs.r != SUCCESS_RETURN_CODE) {
                //     return alert(ERROR_MSG_INVALID_STAFF);
                // }

                // 报错时关闭创建的窗口
                jumpWin && jumpWin.close();

                return alert(rs.data.message || ERROR_MSG_INVALID_STAFF);
            }

            // setTimeout(function(){
            //     params.wpa.trigger('click', extend({
            //         reportType: 'click'
            //     }, params));
            //     onChat();
            // }, 1000);

            //新逻辑，跳转到中间页
            // var pcJumpUrl = '/template/blue/wpa/launch-pc-qq.html?protocol=' + rs.data.sign,
            //     env = '';
            // if (conf.ENV == 'development') {
            //     env = 'dev';
            // } else if (conf.ENV == 'test') {
            //     env = 'oa';
            // }
            // var finalJumpUrl = 'https://' + env + 'admin.qidian.qq.com' + pcJumpUrl;

            //browser will intercept the window.open
            // return window.open(finalJumpUrl);
            // var tempWin = window.open(finalJumpUrl, '');
            // tempWin.location.href = finalJumpUrl;
            // return;

            // 跳转中间页
            if (isJump) {
                jumpUrl = LAUNCH_LINK + '?' + serialize(opts) + '&rkey=' + rs.data.rkey + '&protocol=' + rs.data.sign;
                jumpWin.location.href = jumpUrl;
                return;
            }

            launchSchema(rs.data.sign, {
                checkCallQQStatus: true,
                rkey: rs.data.rkey,
                kfuin: opts.kfuin
            });

            // 不跳转中间页
            //当是pc并且不是ie，才href跳转呼起
            // if (conf.isSSL && !conf.BROWSER_ENV.isIE) {
            //     win.location.href = rs.data.sign;

            //     // report log
            //     // report('http://promreport.crm2.qq.com/wpaclick/r.gif?ty=2&kfuin=' + this.kfuin + '&version=' + globalSettings.version + '&browser=' + encodeURIComponent(navigator.userAgent) + '&bfrom=1&appointType=' + params.aty + '&appoint=' + params.a);

            //     setTimeout(function () {
            //         isFunction(onChat) && onChat(params);
            //     }, 1000);
            // } else {
            //     var PCQQChatIframe = doc.createElement('iframe');

            //     PCQQChatIframe.style.display = 'none';
            //     body.insertBefore(PCQQChatIframe, body.firstChild);
            //     PCQQChatIframe.src = rs.data.sign;

            //     var isLoaded = false,
            //         loaded = function () {

            //             var clickId = rs.data.clkID;
            //             // // todo
            //             // // use event mod to clean up main stream

            //             // // report log
            //             // sptReport.addPoint(5).send();
            //             // report('http://promreport.crm2.qq.com/wpaclick/r.gif?ty=1&kfuin=' + kfuin + '&version=' + globalSettings.version + '&browser=' + encodeURIComponent(navigator.userAgent) + '&bfrom=1&appointType=' + params.aty + '&appoint=' + params.a + '&clkID=' + clickId + '&guid=' + guid);

            //             // //inform TA
            //             // global.taClick && global.taClick(clickId, 'clickid');

            //             // delay callback because schema causes time
            //             // in case of calling back too early, delay callback for a while
            //             // todo
            //             // is 1000ms too long?
            //             // isFunction(onChat) && setTimeout(function(){
            //             //     params.wpa.trigger('click', extend({
            //             //         reportType: 'click'
            //             //     }, params));
            //             //     onChat();
            //             // }, 1000);
            //         };

            //     onIframeLoaded(PCQQChatIframe, loaded);
            // }
        }

        window.addEventListener('message', function(e){
            if(e.data && e.data.id === 'wpaAuthorization'){
                if(e.data.cmd === 'callWpaQQ'){
                    handleProtocol({
                        r: 0,
                        data: {
                            sign: e.data.sign
                        }
                    })
                }
            }
        });

        if(authPath !== ''){
            var finalUrl = authPath + '&platform=pc&' + serialize(opts);
            platformAuthorization({
                src: finalUrl,
                id: 'wpaAuthorization',
            });
            return;
        }

        // 判断是否是自定义进线需要添加LBS的位置信息
        // if (opts.isCustomEntry && opts.isLBS) {
        if (opts.isLBS) {
            getLBSLocation(function(position) {
                // 拉取位置信息成功的情况
                opts.longitude = position.coords.longitude;// 经度信息
                opts.latitude = position.coords.latitude;// 纬度信息
                opts.coord_type = position.coord_type;
                if (isJump) createJumpPage();
                jsonp(getProtocolUrl, opts, handleProtocol);
            }, function(positionError) {
                // 拉取位置信息失败的情况
                if (isJump) createJumpPage();
                jsonp(getProtocolUrl, opts, handleProtocol);
            });
        } else {
            jsonp(getProtocolUrl, opts, handleProtocol);
        }
        // report('http://promreport.crm2.qq.com/wpaclickorg/r.gif?kfuin=' + kfuin + '&version=' + globalSettings.version + '&browser=' + encodeURIComponent(navigator.userAgent) + '&bfrom=1&appointType=' + params.aty + '&appoint=' + params.a + '&guid=' + guid);
    };


    // mobile QQ chat
    exports.mobileChat = function (params, onChat) {
        // 获取授权页地址
        var authPath = getAuthorizationPageUrl();

        var dm = domain.domain,
            fkfuin = params.fkfuin,
            fkfext = params.fkfext;

        var opts = {
            kfuin: params.fkfuin,
            kfext: params.fkfext,
            visitorId: params.guid,
            visitorid: params.guid,
            fid: params.id,
            key: params.key,
            cate: params.cate,
            type: params.type,
            ftype: TYPE_MOBILE,
            pid: params.pid,
            clickid: params.clickid,
            tpForm: params.tpForm,
            qid: params.qid,
            env: ENV,
            eptype: eptype,
            clickType: params.clickType,
            tptype: params.tptype,
            roleKey: params.roleKey,
            roleValue: params.roleValue,
            // roleName: params.roleName,
            roleUin: params.roleUin,
            roleData: params.roleData,
            isKfuin: params.isKfuin,
            isLBS: params.isLBS, // 是否获取LBS定位，0否，1是，默认0
            isCustomEntry: params.isCustomEntry, // 是否自定义进线，0否，1是，默认0
        },
            getProtocolUrl = CGIS.GET_SIGT[ENV];

        if (win.wpaShowItemId) {
            opts.wpaShowItemId = win.wpaShowItemId;
        }

        //公众号接待调用新的接口
        if (params.isPub) {
            //todo
            getProtocolUrl = CGIS.GET_MP_SIGT[ENV];
        }

        CustomParams.setCustomParams(opts);

        // removeCustomProp(opts);

        /**
         * 2019/07/13
         * 新增中转页开关判断逻辑，中转开关数据格式如下：
         * middlePage: {
         *     pc: '1', // 1-跳转中间页 0-不跳转中间页
         *     mobile: '1' // 1-跳转中间页 0-不跳转中间页
         * }
         * 历史数据中不包含该字端，走默认的逻辑，移动端跳转中间页
         */
        var isJump = true;

        // 判断是否需要跳转中间页
        if (params.middlePage) {
            isJump = parseInt(params.middlePage.mobile) ? true : false;
        }

        /**
         * 2019/07/23
         * cate=8 b2b企点接待通路wpa不需要跳中间页
         */
        if (params.cate == 8) {
            isJump = false;
        }

        var handleProtocol = function (rs) {
            if (!rs || rs.r !== 0 || !rs.data) {
                // todo
                // logger

                //这里是推广员失效的异常提示逻辑
                // if (rs && rs.r =! SUCCESS_RETURN_CODE) {
                //     return alert(ERROR_MSG_INVALID_STAFF);
                // }
                return alert(rs.data.message || ERROR_MSG_INVALID_STAFF);
            }

            // setTimeout(function(){
            //     params.wpa.trigger('click', extend({
            //         reportType: 'click'
            //     }, params));
            //     onChat();
            // }, 1000);
            /*
                        var grepSigTReg = /;SigT[^;]+;/,
                            sigT = rs.data.sign.match(grepSigTReg);

                        if (sigT && sigT[0]) {
                            sigT = sigT[0].replace(/;/g, '').split('=')[1];
                        } else {
                            sigT = '';
                        }
            */
            // var crmSchema = chatConst.MQQWPA + '?sigt=' + sigT + '&chat_type=crm&uin=' + fkfuin + '&version=1&src_type=web&web_src=' + protocol + '//' + dm,
            //     schema = chatConst.MQQWPA + '?sigt=' + sigT + '&chat_type=wpa&uin=' + fkfuin + '&version=1&src_type=web&web_src=' + protocol + '//' + dm,

            // var schema = rs.data.sign,
            //     crmSchema = schema,
            //     start = +new Date(),
            //     launch = function (schema, fail) {

            //         if (isInMobileQQ || (!isInMobileQQ && browser.isIOS)) {
            //             return win.location.href = schema;
            //         }

            //         var div = doc.createElement('div');

            //         div.style.visibility = 'hidden';
            //         div.style.width = 0;
            //         div.style.height = 0;


            //         // div.innerHTML = '<iframe id="schema" src="' + schema + '" scrolling="no" width="0" height="0"></iframe>';
            //         div.innerHTML = "<iframe id='schema' src='" + schema + "' scrolling='no' width='0' height='0'></iframe>";

            //         body.appendChild(div);

            //         setTimeout(function () {
            //             var gap = +new Date() - start;

            //             // gap above 1000ms seen as manual return
            //             if (gap < 1000) {
            //                 fail && fail();
            //             }

            //             // clean up div
            //             body.removeChild(div);

            //             isFunction(onChat) && onChat(params);
            //         }, 800);
            //     },
            //     fallback = function () {
            //         // automaticlly return when no mobile QQ installed

            //         // window.open is not allowed in some android browser
            //         // window.open('http://wpd.b.qq.com/page/info.php?nameAccount=' + nameAccount, '_blank');

            //         //previous is http
            //         //--bug=49873429
            //         //这里移动端发起聊天失败的话什么都不做先
            //         //win.location.href = chatConst.WPD_B_QQ_COM_INFO + '?nameAccount=' + nameAccount;

            //         //企点添加了让用户自己选择的方案
            //         //技术问题，先注释
            //         // if (confirm('请先安装手机QQ，才能与企业会话哦~')) {
            //         //     win.location.href = browser.isIOS ? 'https://itunes.apple.com/cn/app/qq/id444934666?mt=8' : 'http://android.myapp.com/myapp/detail.htm?apkName=com.tencent.mobileqq';
            //         // }
            //     };

            // when running inside QQ web view
            // QQ version is determined
            // only one launch is enough
            // if(isMobileQQ){
            //     // QQ 4.5 use schema
            //     // otherwise use CRM schema
            //     launch(mobileQQVersion === '4.5' ? schema : crmSchema, fallback);
            //     return;
            // }

            // when running in standard browser
            // no QQ info known
            // try CRM schema
            // otherwise fallback to info page

            // @2014-08-04
            // fallback to QQ 4.5 schema is abandoned for it may cause double jumps
            /* 原逻辑是直接拉手q，现在需要先跳中转页，故先注释掉 */
            //launch(crmSchema, fallback);
            //中转页url: /template/blue/wpa/launch-mobile-qq.com

            //2017/04/21:如果是在手q内，则不跳转中间页，直接呼起
            if (isInMobileQQ) {
                return win.location.href = rs.data.sign;
            }

            // 如果在微信内，则一定要跳转中间页才能呼起QQ
            if (isInWX && compareVersion(wxVersion, '6.5.6') > 0) {
                isJump = true;
            }

            // 不跳转中间页
            if (!isJump) {
                launchSchema(rs.data.sign, {
                    needMobileJump: false,
                    checkCallQQStatus: true,
                    kfuin: opts.kfuin
                });
                return;
            }

            // 跳转中间页
            win.location.href = LAUNCH_LINK + '?' + serialize(opts) + '&protocol=' + rs.data.sign;
        }

        window.addEventListener('message', function(e){
            if(e.data && e.data.id === 'wpaAuthorization'){
                if(e.data.cmd === 'callWpaQQ'){
                    handleProtocol({
                        r: 0,
                        data: {
                            sign: e.data.sign,

                        }
                    })
                }
            }
        });

        if(authPath !== ''){
            var finalUrl = authPath + '&platform=h5&' + serialize(opts);
            platformAuthorization({
                src: finalUrl,
                id: 'wpaAuthorization',
            })
            return;
        }

        // 判断是否是自定义进线需要添加LBS的位置信息
        // if (opts.isCustomEntry && opts.isLBS) {
        if (opts.isLBS) {
            getLBSLocation(function(position) {
                // 拉取位置信息成功的情况
                opts.longitude = position.coords.longitude;// 经度信息
                opts.latitude = position.coords.latitude;// 纬度信息
                opts.coord_type = position.coord_type;
                jsonp(getProtocolUrl, opts, handleProtocol);
            }, function(positionError) {
                // 拉取位置信息失败的情况
                jsonp(getProtocolUrl, opts, handleProtocol);
            });
        } else {
            jsonp(getProtocolUrl, opts, handleProtocol);
        }
    };

    //lbs chat
    exports.LBSChat = function (data, url) {

        jsonp(url, data, function (rs) {
            if (!rs || rs.r !== 0 || !rs.data) {
                // todo
                // logger

                //这里是推广员失效的异常提示逻辑
                // if (rs && rs.r != SUCCESS_RETURN_CODE) {
                //     return alert(ERROR_MSG_INVALID_STAFF);
                // }
                return alert(rs.data.message || ERROR_MSG_INVALID_STAFF);
            }
            var schema = rs.data.sign;
            launchSchema(schema, {
                visitorId: data.visitorId,
                paramSwitch: 1
            });
        });
    };


    // Launch anonymous chat
    exports.anonyChat = function (params, onChat) {
        var // record load time of anonymous page
            // sptReport = speedReport('7818', '21', '2'),
            //previous is http
            url = chatConst.WPD_B_QQ_COM_WEBCHAT + '?nameAccount=' + params.nameAccount,
            opener = win.open(url, '_blank', 'height=516, width=598,toolbar=no,scrollbars=no,menubar=no,status=no,location=no');


        // report log
        // report('http://promreport.crm2.qq.com/wpaclick/r.gif?ty=2&kfuin=' + this.kfuin + '&version=' + globalSettings.version + '&browser=' + encodeURIComponent(navigator.userAgent) + '&bfrom=1&appointType=' + params.aty + '&appoint=' + params.a);

        opener.onload = function () {
            isFunction(onChat) && onChat(params);
            //     sptReport.addPoint(6).send();
        };
    }

    // Launch link chat
    exports.linkChat = function (params, onChat) {
        var url = chatConst.LINK_CHAT + '?nameAccount=' + params.nameAccount + '&id=' + params.id,
            opener = win.open(url, '_blank', 'height=516, width=598,toolbar=no,scrollbars=no,menubar=no,status=no,location=no');

        opener.onload = function () {
            isFunction(onChat) && onChat(params);
        };
    }
});

/** src/invite/inviteApi.js **/
LBF.define('wpa.invite.inviteApi', function (require, exports, module) {
    var conf = require('wpa.conf.config'),
        win = conf.gWin,
        WPA = win.__WPA,
        temp = [];
    WPA.inviteKfuinReadyState = []

    WPA.on('inviteApi', function (kfuins) {
        for (var i = 0; i < temp.length; i++) {
            if (!kfuins || (kfuins.indexOf(temp[i].inviteRule.kfuin) !== -1)) {
                temp[i].wpa.Invite.init.call(temp[i].wpa, temp[i].inviteRule, {isInviteApi: true});
            }
        }
    })

    var add = function (wpa, inviteRule) {
        temp.push({
            wpa: wpa,
            inviteRule: inviteRule
        })
        WPA.inviteKfuinReadyState.push(inviteRule.kfuin)
        if (typeof window.__WPAInviteReady === 'function') {
            window.__WPAInviteReady(WPA.inviteKfuinReadyState)
        }
    }

    var trigger = function (kfuins) {
        WPA.trigger('inviteApi', kfuins)
    }

    exports.add = add
    exports.trigger = trigger
})

/** src/util/badjs.js **/
/*
 * 添加修改后的badjs，取消window.onerror事件
 * @author: vergilzhou
 * @version: 4.1.0
 * @date: 2017/10/03
 *
 */
LBF.define('wpa.util.badjs', function(require, exports, module) {

	var conf = require('wpa.conf.config'),
		badjsConf = conf.badjs,
		badjsConfId = badjsConf.id,
		badjsConfRandom = badjsConf.random;

	/*!
	 * @module report
	 * @author kael, chriscai
	 * @date @DATE
	 * Copyright (c) 2014 kael, chriscai
	 * Licensed under the MIT license.
	 */
	var BJ_REPORT_FOR_WPA = (function(global) {
	    if (global.BJ_REPORT_FOR_WPA) return global.BJ_REPORT_FOR_WPA;

	    var _error = [];
	    var _config = {
	        id: 0,
	        uin: 0,
	        url: "",
	        combo: 1,
	        ext: null,
	        level: 4, // 1-debug 2-info 4-error
	        ignore: [],
	        random: 1,
	        delay: 1000,
	        submit: null
	    };

	    var _isOBJByType = function(o, type) {
	        return Object.prototype.toString.call(o) === "[object " + (type || "Object") + "]";
	    };

	    var _isOBJ = function(obj) {
	        var type = typeof obj;
	        return type === "object" && !!obj;
	    };

	    var _isEmpty = function(obj) {
	        if (obj === null) return true;
	        if (_isOBJByType(obj, 'Number')) {
	            return false;
	        }
	        return !obj;
	    };

	    // var orgError = global.onerror;
	    // // rewrite window.oerror
	    // global.onerror = function(msg, url, line, col, error) {
	    //     var newMsg = msg;

	    //     if (error && error.stack) {
	    //         newMsg = _processStackMsg(error);
	    //     }

	    //     if (_isOBJByType(newMsg, "Event")) {
	    //         newMsg += newMsg.type ? ("--" + newMsg.type + "--" + (newMsg.target ? (newMsg.target.tagName + "::" + newMsg.target.src) : "")) : "";
	    //     }

	    //     report.push({
	    //         msg: newMsg,
	    //         target: url,
	    //         rowNum: line,
	    //         colNum: col
	    //     });

	    //     _send();
	    //     orgError && orgError.apply(global, arguments);
	    // };

	    var _processError = function(errObj) {
	        try {
	            if (errObj.stack) {
	                var url = errObj.stack.match("https?://[^\n]+");
	                url = url ? url[0] : "";
	                var rowCols = url.match(":(\\d+):(\\d+)");
	                if (!rowCols) {
	                    rowCols = [0, 0, 0];
	                }

	                var stack = _processStackMsg(errObj);
	                return {
	                    msg: stack,
	                    rowNum: rowCols[1],
	                    colNum: rowCols[2],
	                    target: url.replace(rowCols[0], "")
	                };
	            } else {
	                //ie 独有 error 对象信息，try-catch 捕获到错误信息传过来，造成没有msg
	                if (errObj.name && errObj.message && errObj.description) {
	                    return {
	                        msg: JSON.stringify(errObj)
	                    };
	                }
	                return errObj;
	            }
	        } catch (err) {
	            return errObj;
	        }
	    };

	    var _processStackMsg = function(error) {
	        var stack = error.stack.replace(/\n/gi, "").split(/\bat\b/).slice(0, 5).join("@").replace(/\?[^:]+/gi, "");
	        var msg = error.toString();
	        if (stack.indexOf(msg) < 0) {
	            stack = msg + "@" + stack;
	        }
	        return stack;
	    };

	    var _error_tostring = function(error, index) {
	        var param = [];
	        var params = [];
	        var stringify = [];
	        if (_isOBJ(error)) {
	            error.level = error.level || _config.level;
	            for (var key in error) {
	                var value = error[key];
	                if (!_isEmpty(value)) {
	                    if (_isOBJ(value)) {
	                        try {
	                            value = JSON.stringify(value);
	                        } catch (err) {
	                            value = "[BJ_REPORT_FOR_WPA detect value stringify error] " + err.toString();
	                        }
	                    }
	                    stringify.push(key + ":" + value);
	                    param.push(key + "=" + encodeURIComponent(value));
	                    params.push(key + "[" + index + "]=" + encodeURIComponent(value));
	                }
	            }
	        }

	        // msg[0]=msg&target[0]=target -- combo report
	        // msg:msg,target:target -- ignore
	        // msg=msg&target=target -- report with out combo
	        return [params.join("&"), stringify.join(","), param.join("&")];
	    };

	    var _imgs = [];
	    var _submit = function(url) {
	        if (_config.submit) {
	            _config.submit(url);
	        } else {
	            var _img = new Image();
	            _imgs.push(_img);
	            _img.src = url;
	        }
	    };

	    var error_list = [];
	    var comboTimeout = 0;
	    var _send = function(isReoprtNow) {
	        if (!_config.report) return;

	        while (_error.length) {
	            var isIgnore = false;
	            var error = _error.shift();
	            var error_str = _error_tostring(error, error_list.length);
	            if (_isOBJByType(_config.ignore, "Array")) {
	                for (var i = 0, l = _config.ignore.length; i < l; i++) {
	                    var rule = _config.ignore[i];
	                    if ((_isOBJByType(rule, "RegExp") && rule.test(error_str[1])) ||
	                        (_isOBJByType(rule, "Function") && rule(error, error_str[1]))) {
	                        isIgnore = true;
	                        break;
	                    }
	                }
	            }
	            if (!isIgnore) {
	                if (_config.combo) {
	                    error_list.push(error_str[0]);
	                } else {
	                    _submit(_config.report + error_str[2] + "&_t=" + (+new Date));
	                }
	                _config.onReport && (_config.onReport(_config.id, error));
	            }
	        }

	        // 合并上报
	        var count = error_list.length;
	        if (count) {
	            var comboReport = function() {
	                clearTimeout(comboTimeout);
	                _submit(_config.report + error_list.join("&") + "&count=" + error_list.length + "&_t=" + (+new Date));
	                comboTimeout = 0;
	                error_list = [];
	            };

	            if (isReoprtNow) {
	                comboReport(); // 立即上报
	            } else if (!comboTimeout) {
	                comboTimeout = setTimeout(comboReport, _config.delay); // 延迟上报
	            }
	        }
	    };

	    var report = {
	        push: function(msg) { // 将错误推到缓存池
	            // 抽样
	            if (Math.random() >= _config.random) {
	                return report;
	            }

	            var data = _isOBJ(msg) ? _processError(msg) : {
	                msg: msg
	            };
	            // ext 有默认值, 且上报不包含 ext, 使用默认 ext
	            if (_config.ext && !data.ext) {
	                data.ext = _config.ext;
	            }
	            _error.push(data);
	            _send();
	            return report;
	        },
	        report: function(msg) { // error report
	            msg && report.push(msg);
	            _send(true);
	            return report;
	        },
	        info: function(msg) { // info report
	            if (!msg) {
	                return report;
	            }
	            if (_isOBJ(msg)) {
	                msg.level = 2;
	            } else {
	                msg = {
	                    msg: msg,
	                    level: 2
	                };
	            }
	            report.push(msg);
	            return report;
	        },
	        debug: function(msg) { // debug report
	            if (!msg) {
	                return report;
	            }
	            if (_isOBJ(msg)) {
	                msg.level = 1;
	            } else {
	                msg = {
	                    msg: msg,
	                    level: 1
	                };
	            }
	            report.push(msg);
	            return report;
	        },
	        init: function(config) { // 初始化
	            if (_isOBJ(config)) {
	                for (var key in config) {
	                    _config[key] = config[key];
	                }
	            }
	            // 没有设置id将不上报
	            var id = parseInt(_config.id, 10);
	            if (id) {
	                // set default report url and uin
	                if (/qq\.com$/gi.test(location.hostname)) {
	                    if (!_config.uin) {
	                        _config.uin = parseInt((document.cookie.match(/\buin=\D+(\d+)/) || [])[1], 10);
	                    }
	                }

                    if (!_config.url) {
                        _config.url = "//badjs2.qq.com/badjs";
                    }

	                _config.report = (_config.url || "/badjs") +
	                    "?id=" + id +
	                    "&uin=" + _config.uin +
	                    "&from=" + encodeURIComponent(location.href) +
	                    "&";
	            }
	            return report;
	        },

	        __onerror__: global.onerror
	    };

	    typeof console !== "undefined" && console.error && setTimeout(function() {
	        var err = ((location.hash || '').match(/([#&])BJ_ERROR=([^&$]+)/) || [])[2];
	        err && console.error("BJ_ERROR", decodeURIComponent(err).replace(/(:\d+:\d+)\s*/g, '$1\n'));
	    }, 0);

	    global.BJ_REPORT_FOR_WPA = report;

	    return report;

	}(window));


	//针对企点wpa的初始化工作
	BJ_REPORT_FOR_WPA.init({
		id: badjsConfId,
		random: badjsConfRandom
	});

	exports.badjsReport = BJ_REPORT_FOR_WPA.report;

});

/** lib/lbf/lang/Class.js **/
/**
 * Created by amos on 14-8-18.
 */
LBF.define('lang.Class', function(require, exports, module){
    var toArray = require('lang.toArray'),
        extend = require('lang.extend');

    /**
     * Base Class
     * @class Class
     * @namespace lang
     * @module lang
     * @constructor
     * @example
     *      // SubClass extends Class
     *      var SubClass = Class.extend({
     *          // overwritten constructor
     *          initialize: function(){
     *
     *          },
     *
     *          someMethod: function(){
     *          }
     *      });
     *
     *      // add static methods and attributes
     *      SubClass.include({
     *          staticMethod: function(){
     *          },
     *
     *          staticAttr: 'attrValue'
     *      });
     *
     *      // Extension is always available for sub class
     *      var SubSubClass = SubClass.extend({
     *          // methods to be extended
     *      });
     */
    module.exports = inherit.call(Function, {
        initialize: function(){},

        /**
         * Mix in methods and attributes. Instead of inherit from base class, mix provides a lighter way to extend object.
         * @method mixin
         * @since 0.5.2
         * @param {Object} [mixin]* The object to be mixed in
         * @chainable
         * @example
         *      var someInstance = new Class;
         *
         *      someInstance.mix({
         *          sayHello: function(){
         *              alert('hello');
         *          }
         *      });
         */
        mixin: include
    });

    function inherit(ext){
        // prepare extends
        var args = toArray(arguments);

        // constructor
        var Class = function(){
            // real constructor
            this.initialize.apply(this, arguments);
        };

        // copy Base.prototype
        var Base = function(){};
        Base.prototype = this.prototype;
        var proto = new Base();

        // correct constructor pointer
        /**
         * Instance's constructor, which initialized the instance
         * @property constructor
         * @for lang.Class
         * @type {lang.Class}
         */
        proto.constructor = Class;

        /**
         * Superclass of the instance
         * @property superclass
         * @type {lang.Class}
         */
        proto.superclass = this;

        // extends prototype
        args.unshift(proto);
        extend.apply(args, args);
        Class.prototype = proto;

        // add static methods
        extend(Class, {
            /**
             * Extend a sub Class
             * @method inherit
             * @static
             * @for lang.Class
             * @param {Object} [ext]* Prototype extension. Multiple exts are allow here.
             * @chainable
             * @example
             *     var SubClass = Class.extend(ext1);
             *
             * @example
             *      // multiple extensions are acceptable
             *      var SubClass = Class.extend(ext1, ext2, ...);
             */
            inherit: inherit,

            /**
             * Extend static attributes
             * @method include
             * @static
             * @for lang.Class
             * @param {Object} [included]* Static attributes to be extended
             * @chainable
             * @example
             *     Class.include(include1);
             *
             * @example
             *     // multiple includes are acceptable
             *     Class.include(include1, include2, ...);
             */
            include: include,

            /**
             * Inherit base class and add/overwritten some new methods or properties.
             * This is a deprecated method for it's easily misunderstood. It's just for backward compatible use and will be removed in the near future.
             * We recommend inherit for a replacement
             * @method extend
             * @static
             * @for lang.Class
             * @deprecated
             * @see inherit
             */
            extend: inherit,

            /**
             * Superclass the Class inherited from
             * @property superclass
             * @type {lang.Class}
             * @for lang.Class
             */
            superclass: this
        });

        return Class;
    };

    function include(included){
        var args = toArray(arguments);
        args.unshift(this);
        extend.apply(this, args);
        return this;
    }
});
/** lib/lbf/lang/inArray.js **/
/**
 * Created by amos on 14-8-18.
 */
LBF.define('lang.inArray', function(require, exports, module){
    /**
     * Search for a specified value within an array and return its index (or -1 if not found).
     * Borrowed from jQuery.inArray
     * @class inArray
     * @namespace lang
     * @constructor
     * @param elem Array like object
     * @returns {Array}
     * @example
     *      var someFn = function(){
     *          var args = toArray(arguments);
     *      };
     */
    module.exports =  [].indexOf ?
        function(elem, arr, i){
            return arr ? [].indexOf.call(arr, elem, i) : -1;
        } :
        function(elem, arr, i) {
            if (arr){
                var len = arr.length;

                // converts negative i to positive
                i = i ? i < 0 ? Math.max( 0, len + i ) : i : 0;

                for ( ; i < len; i++ ) {
                    // Skip accessing in sparse arrays
                    if ( i in arr && arr[ i ] === elem ) {
                        return i;
                    }
                }
            }

            return -1;
        };
});
/** src/util/onIframeLoaded.js **/
LBF.define('wpa.util.onIframeLoaded', function(){

    //excludeUndefined要设置为true，如果iframe的src指向一个实际地址
    //excludeUndefined要设置为false，如果iframe的src指向about:blank;

    return function(iframe, loaded, excludeUndefined){
        // if already loaded
        if (excludeUndefined) {
            if (/loaded|complete/.test(iframe.readyState)) {
                loaded();
            } else {
                if(iframe.attachEvent){
                    // for ie

                    var handler = function(){
                        // clear event binding
                        iframe.detachEvent('onload', handler);
                        // invoke callback
                        loaded();
                    };

                    // ie support onload only using attachEvent
                    iframe.attachEvent('onload', handler);
                } else {
                    // for non-ie

                    iframe.onload = function(){
                        // invoke callback
                        loaded();
                        // clear event binding
                        iframe.onload = null;
                    };
                }
            }
        } else {
            if (/loaded|complete|undefined/.test(iframe.readyState)) {
                loaded();
            } else {
                if(iframe.attachEvent){
                    // for ie

                    var handler = function(){
                        // clear event binding
                        iframe.detachEvent('onload', handler);
                        // invoke callback
                        loaded();
                    };

                    // ie support onload only using attachEvent
                    iframe.attachEvent('onload', handler);
                } else {
                    // for non-ie

                    iframe.onload = function(){
                        // invoke callback
                        loaded();
                        // clear event binding
                        iframe.onload = null;
                    };
                }
            }
        }
        
    };
});
/** src/util/tmplCompiler.js **/
/*
 * 将需要替换的模板内的变量替换掉
 * @author: vergilzhou
 * @date: 2014/08/14
 *
 */

LBF.define('wpa.util.tmplCompiler', function(require){

    var xssFilter = require('util.xssFilter'),
        inArray = require('lang.inArray'),
        globalSettings = require('globalSettings'),
        isSSL = globalSettings.protocol.indexOf('https') !== -1 ? true : false,
        defaultConst = require('wpa.conf.defaultConst');

    var THEME_NAMES = {
        1: 'theme-1',
        2: 'theme-2',
        3: 'theme-3',
        4: 'theme-4',
        5: 'theme-5',
        6: 'theme-6'
    };

    return {

        compile: function(options) {

            var tpl = options.tpl,
                params = options.params,
                htmlRequired = options.htmlRequired || [],
                actualTheme = params.theme,
                tempObj = {
                    theme: THEME_NAMES[actualTheme],
                    btnText: xssFilter.htmlEncode(params.btnText),
                    title: xssFilter.htmlEncode(params.title),
                    signature: xssFilter.htmlEncode(params.signature),
                    avatar: params.avatar,
                    qrcode: params.qrcode || '',
                    closable: params.closable || 'closable',
                    btnBgColor: params.btnBgColor.value
                };

                tpl = tpl.replace('{class}', params.className);

                //解决<img src="{avatar}" />贴到网页里会产生错误图片请求的问题
                if (!tempObj.avatar) {
                    tpl = tpl.replace('src="{avatar}"', 'src="javascript:void(0);" style="display:none!important;"');
                } else if (/^https?:/.test(tempObj.avatar)) {
                    tempObj.avatar = tempObj.avatar.replace(/^https?:/, '');
                }

                for (var i = 0, len = htmlRequired.length; i < len; i++) {
                    var r = htmlRequired[i],
                        reg = new RegExp('\\{' + r + '\\}', 'g');
                    tpl = tpl.replace(reg, tempObj[r]);
                }

            return tpl;

            // return tpl.replace(/\{theme\}/g, theme)
            //         .replace(/\{btnText\}/, btnText)
            //         .replace(/\{title\}/, title)
            //         .replace(/\{signature\}/, signature)
            //         .replace(/\{closable\}/, closable)
            //         .replace(/\{qrCodeImg\}/, qrCodeImg)
            //         .replace(/\{avatar\}/, avatar)
            //         .replace(/\{btnBgColor\}/, btnBgColor);
        }

    };
});

/** src/util/Style.js **/
/*
 * @author: vergilzhou
 * @date: 2014/08/14
 */

LBF.define('wpa.util.Style', function(require){

    var colors = require('wpa.conf.colors'),
        borderRadiusMixin = require('wpa.util.borderRadiusMixin'),
        inArray = require('lang.inArray'),
        getUrlBackground = require('wpa.util.urlBackground');

    var CSS = {
        ELL: ['word-break: break-all;',
            'word-wrap:break-word;',
            'text-overflow: ellipsis;',
            'white-space: nowrap;',
            'overflow: hidden;'
        ].join(''),
        WORD_BREAK: [
            'word-break: break-all;',
            'word-wrap:break-word;'
        ].join(''),
        BOX_SHADOW: [
            'box-shadow:0 1px 15px rgba(0, 0, 0, 0.15);'
        ].join(''),
        RESET: 'margin:0;padding:0;',
        TEXT_SIZE_ADJUST: [
            '-webkit-text-size-adjust:none;',
            'text-size-adjust:none;'
        ].join(''),
        TEXT_FAMILY: [
            'font-family:"PingFang SC", "Droid Sans Fallback", "microsoft yahei";'
        ].join(''),
        DIB: [
            'display: inline-block;',
            '*zoom: 1;',
            '*display: inline;'
        ].join('')
    };

    var CSS_COMMON = [
        CSS.TEXT_SIZE_ADJUST,
        CSS.TEXT_FAMILY,
        CSS.RESET
    ].join('');


    return {
        /**
         * Load css file to page
         * @param {string} name Assign a name
         * @param {string} href CSS file's link
         * @param {object} [opts] Options for loading
         * @param {object} [opts.context] Context to load css
         * @return {HTMLElement} The newly injected link
         */
        load: function(name, href, opts){
            opts = opts || {};
            var context = opts.context || document;

            // add stylesheet to context
            var style = context.createElement('link');
            style.name = name;
            style.type = 'text/css';
            style.setAttribute('rel', 'stylesheet');
            style.setAttribute('href', href);

            (function(){
                try{
                    var parent = context.getElementsByTagName('head')[0];
                    parent.insertBefore(style, parent.firstChild);
                } catch(e){
                    setTimeout(arguments.callee, 1);
                }
            })();

            return style;
        },

        /**
         * Add style tag to page P.S.class name or id cannot start with '_' in ie6 & ie7!
         * @param {string} name Assign a name
         * @param {string} cssText CSS text
         * @param {object} [opts] Options for loading
         * @param {object} [opts.context] Context to add style
         * @return {HTMLElement} The newly injected link
         */
        add: function(options){

            var name = options.name,
                self = options.self || {},
                dispType = options.dispType,
                cssText = options.cssText,
                htmlRequired = options.htmlRequired || {},
                borderRadius = options.borderRadius,
                doc = options.doc;


            var context = doc || document;

            // add stylesheet to page
            var style = context.createElement('style');
            style.type = 'text/css';
            style.name = name;

            // insert style into dom before setting cssText
            // otherwise, ie6 will not be set properly
            var parent = context.getElementsByTagName('body')[0];
            parent.insertBefore(style, parent.firstChild);

            // todo
            // 污染self了，为什么要绑定$el呢
            // self ? self.$el = parent.lastChild : null;

            //替换公用css部分
            //例如{ell}
            cssText = cssText.replace(/\{ell\}/g, CSS.ELL)
                    .replace(/\{boxShadow\}/g, CSS.BOX_SHADOW)
                    .replace(/\{wordBreak\}/g, CSS.WORD_BREAK)
                    .replace(/\{dib\}/g, CSS.DIB)
                    .replace(/\{common\}/g, CSS_COMMON);

            if(style.styleSheet){
                style.styleSheet.cssText = cssText;
            } else {
                style.appendChild(context.createTextNode(cssText));
            }

            return style;
        },

        commonAdd: function(options) {

            var name = options.name,
                self = options.self || {},
                dispType = options.dispType,
                cssText = options.cssText,
                doc = options.doc;


            var context = doc || document;

            // add stylesheet to page
            var style = context.createElement('style');
            style.type = 'text/css';
            style.name = name;

            // insert style into dom before setting cssText
            // otherwise, ie6 will not be set properly
            var parent = context.getElementsByTagName('body')[0];
            parent.insertBefore(style, parent.firstChild);

            if(style.styleSheet){
                style.styleSheet.cssText = cssText;
            } else {
                style.appendChild(context.createTextNode(cssText));
            }

            return style;
        }
    };
});
/** src/conf/wpaType.js **/
/*
 * WPA模型各字段、类型定义
 * @author: zk
 * @version: 4.0.0
 * @date: 2016/01/19
 */
LBF.define('wpa.conf.wpaType', function(require, exports, module) {

    var defaultConst = require('wpa.conf.defaultConst'),
        POSITION = defaultConst.POSITION;

	//scene = ['投放到网页', '投放到QQ公众号图文', '投放到H5'];
    /********************************
    theme:  1：白色
            2：蓝色或黑色
            3：灰色
    closable: 1为出现叉叉可关闭，0为不出现叉叉无法关闭


    *********************************/
	
	var wpaType = {
        /*************在线接待*********************/
        1: {
            1: {
                cate: 1,
                type: 1,
                scene: 0,
                isPC: 1,
                borderRadius: '2px',
                // iframeBorder: {
                //     theme: 1,
                //     width: '1px',
                //     color: '#dadee7'
                // },
                htmlRequired: ['btnText', 'theme'],
                required: ['btnText', 'theme', 'role'],
                role: ['roleQQ'],
                theme:["#fff", "#00f"]
            },
            2: {
                cate: 1,
                type: 2,
                scene: 0,
                isPC: 1,
                // iframeBorder: {
                //     theme: 1,
                //     width: '1px',
                //     color: '#dadee7'
                // },
                borderRadius: '2px',
                htmlRequired: ['btnText', 'theme'],
                theme:["#fff", "#00f"]
            },
            3: {
                cate: 1,
                type: 3,
                scene: 1,
                isPC: 1,
                // iframeBorder: {
                //     theme: 1,
                //     width: '1px',
                //     color: '#dadee7'
                // },
                borderRadius: '2px',
                htmlRequired: ['title', 'signature', 'avatar'],
                theme:["#fff", "#00f"]
            },
            4: {
                cate: 1,
                type: 4,
                isPC: 1,
                // iframeBorder: {
                //     theme: 1,
                //     width: '1px',
                //     color: '#dadee7'
                // },
                floatStyle: {
                    gap: {
                        right: '10px'
                    }
                },
                borderRadius: '2px',
                htmlRequired: ['btnText', 'theme']
            },
            5: {
                cate: 1,
                type: 5,
                isPC: 1,
                // iframeBorder: {
                //     theme: 1,
                //     width: '1px',
                //     color: '#dadee7'
                // },
                floatStyle: {
                    gap: {
                        right: '10px'
                    }
                },
                borderRadius: '2px',
                htmlRequired: ['title', 'btnBgColor', 'avatar', 'btnText']
            },
            6: {
                cate: 1,
                type: 6,
                isPC: 1,
                // iframeBorder: {
                //     theme: 1,
                //     width: '1px',
                //     color: '#dadee7'
                // },
                floatStyle: {
                    gap: {
                        right: '10px',
                        bottom: '20px'
                    }
                },
                borderRadius: '2px',
                htmlRequired: ['title', 'signature', 'btnBgColor', 'btnText', 'avatar']
            },
            7: {
                cate: 1,
                type: 7,
                floatStyle: {
                    gap: {
                        right: '15px',
                        bottom: '20px'
                    }
                }
            },
            8: {
                cate: 1,
                type: 8,
                floatStyle: {
                    gap: {
                        right: '15px',
                        bottom: '20px'
                    }
                },
                htmlRequired: ['btnText']
            },
            9: {
                cate: 1,
                type: 9,
                htmlRequired: ['closable', 'btnText', 'title', 'signature', 'theme', 'position', 'avatar'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-qq'],
                    eventList: ['callChat'],
                    fixedBtnText: '在线咨询',
                    hasBtnText: 1,
                    hasAvatar: 1
                }
            },
            10: {
                cate: 1,
                type: 10,
                htmlRequired: ['closable', 'btnText', 'title', 'signature', 'theme', 'position'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-qq'],
                    eventList: ['callChat'],
                    fixedBtnText: '在线咨询',
                    hasBtnText: 1,
                    hasAvatar: 0
                }
            },
            11: {
                cate: 1,
                type: 11,
                htmlRequired: ['closable', 'title', 'signature', 'theme', 'position'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-call', 'icon-qq'],
                    eventList: ['callPhone', 'callChat'],
                    hasBtnText: 0,
                    hasAvatar: 0
                }
            },
            12: {
                cate: 1,
                type: 12,
                htmlRequired: ['closable', 'title', 'signature', 'theme', 'position', 'avatar'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-call', 'icon-qq'],
                    eventList: ['callPhone', 'callChat'],
                    hasBtnText: 0,
                    hasAvatar: 1
                }
            },
            13: {
                cate: 1,
                type: 13,
                htmlRequired: ['title', 'signature', 'avatar', 'btnText'],
                isInQQ: 1,
                tpl: 4,
                tplOptions: {
                    iconList: ['icon-qq'],
                    eventList: ['callChat'],
                    fixedBtnText: '在线咨询',
                    hasBtnText: 1,
                    hasAvatar: 1
                }
            },
            14: {
                cate: 1,
                type: 14,
                htmlRequired: ['title', 'signature', 'avatar'],
                isInQQ: 1,
                tpl: 4,
                tplOptions: {
                    iconList: ['icon-call', 'icon-qq'],
                    eventList: ['callPhone', 'callChat'],
                    hasBtnText: 0,
                    hasAvatar: 1
                }
            },
            15: {
                cate: 1,
                type: 15,
                htmlRequired: ['title', 'signature', 'avatar', 'qrcode', 'theme'],
                isInQQ: 1,
                iframeBorder: {
                    width: '1px',
                    color: '#ebebeb'
                }
            }
        },
        /**************免费电话**********************/
		2: {
            1: {
                cate: 2,
                type: 1,
                scene: 0,
                htmlRequired: [/*'role'*/],
                floatStyle: {
                    gap: {
                        right: '15px',
                        bottom: '20px'
                    }
                },
                required: ['role'],
                role: ['roleTEL']
            },
            2: {
                cate: 2,
                type: 2,
                floatStyle: {
                    gap: {
                        right: '15px',
                        bottom: '20px'
                    }
                },
                htmlRequired: ['btnText']
            },
            3: {
                cate: 2,
                type: 3,
                htmlRequired: ['closable', 'title', 'signature', 'theme', 'btnText', 'avatar', 'position'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-call'],
                    eventList: ['callPhone'],
                    fixedBtnText: '免费电话',
                    hasBtnText: 1,
                    hasAvatar: 1
                }
            },
            4: {
                cate: 2,
                type: 4,
                htmlRequired: ['closable', 'title', 'signature', 'theme', 'btnText', 'position'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-call'],
                    eventList: ['callPhone'],
                    fixedBtnText: '免费电话',
                    hasBtnText: 1,
                    hasAvatar: 0
                }
            },
            5: {
                cate: 2,
                type: 5,
                htmlRequired: ['closable', 'title', 'signature', 'theme', 'position'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-call', 'icon-qq'],
                    eventList: ['callPhone', 'callChat'],
                    hasBtnText: 0,
                    hasAvatar: 0
                }
            },
            6: {
                cate: 2,
                type: 6,
                htmlRequired: ['closable', 'title', 'signature', 'theme', 'avatar', 'position'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-call', 'icon-qq'],
                    eventList: ['callPhone', 'callChat'],
                    hasBtnText: 0,
                    hasAvatar: 1
                }
            },
            7: {
                cate: 2,
                type: 7,
                htmlRequired: ['title', 'signature', 'avatar'],
                tpl: 4,
                isInQQ: 1,
                tplOptions: {
                    iconList: ['icon-call'],
                    eventList: ['callPhone'],
                    fixedBtnText: '免费电话',
                    hasBtnText: 1,
                    hasAvatar: 1
                }
            },
            8: {
                cate: 2,
                type: 8,
                htmlRequired: ['title', 'signature', 'avatar'],
                tpl: 4,
                isInQQ: 1,
                tplOptions: {
                    iconList: ['icon-call', 'icon-qq'],
                    eventList: ['callPhone', 'callChat'],
                    hasBtnText: 0,
                    hasAvatar: 1
                }
            }
        },
        /**************加关注**********************/
        3: {
            1: {
                cate: 3,
                type: 1,
                scene: 0,
                isPC: 1,
                htmlRequired: ['title', 'signature', 'btnBgColor', 'btnText', 'avatar'],
                required: ['title', 'signature', 'btnBgColor', 'btnText', 'avatar', 'role'],
                role: ['rolePUB'],
                hasBoxShadow: 1,
                btnBgColor: ['#006600', '#D58512', '#0067ED']
            },
            2: {
                cate: 3,
                type: 2,
                htmlRequired: ['btnText', 'title', 'signature', 'btnBgColor', 'theme', 'closable', 'avatar', 'position'],
                tpl: 6,
                tplOptions: {
                    eventList: ['callAddFan'],
                    fixedBtnText: '关注',
                    btnWithoutIconAdd: true,
                    hasAvatar: 1
                }
            },
            3: {
                cate: 3,
                type: 3,
                htmlRequired: ['btnText', 'title', 'signature', 'btnBgColor', 'theme', 'closable', 'position'],
                tpl: 6,
                tplOptions: {
                    eventList: ['callAddFan'],
                    fixedBtnText: '关注',
                    btnWithoutIconAdd: true,
                    hasAvatar: 0
                }  
            }
        },
        /**************加群**********************/
        4: {
            1: {
                cate: 4,
                type: 1,
                scene: 0,
                isPC: 1,
                htmlRequired: ['title', 'signature', 'btnBgColor', 'btnText', 'avatar'],
                required: ['title', 'signature', 'btnBgColor', 'btnText', 'avatar'],
                // hasBoxShadow: 1,
                btnBgColor: ['#006600', '#D58512', '#0067ED']
            },
            2: {
                cate: 4,
                type: 2,
                htmlRequired: ['btnText', 'title', 'signature', 'btnBgColor', 'theme', 'closable', 'position'],
                tpl: 6,
                tplOptions: {
                    eventList: ['callAddGroup'],
                    fixedBtnText: 'QQ群',
                    hasAvatar: 0
                }
            },
            3: {
                cate: 4,
                type: 3,
                htmlRequired: ['btnText', 'title', 'signature', 'btnBgColor', 'theme', 'closable', 'position', 'avatar'],
                tpl: 6,
                tplOptions: {
                    eventList: ['callAddGroup'],
                    fixedBtnText: 'QQ群',
                    hasAvatar: 1
                }
            },
            4: {
                cate: 4,
                type: 4,
                htmlRequired: ['title', 'signature', 'avatar'],
                isInQQ: 1,
                tpl: 5,
                tplOptions: {
                    eventList: ['callAddGroup'],
                    fixedBtnText: 'QQ群',
                    hasAvatar: 1
                }
            }
        },
        /**************加好友**********************/
        5: {
            1: {
                cate: 5,
                type: 1,
                scene: 0,
                isPC: 1,
                hasBoxShadow: 1,
                htmlRequired: ['title', 'signature', 'btnBgColor', 'btnText', 'avatar'],
                required: ['title', 'signature', 'btnBgColor', 'btnText', 'avatar', 'role'],
                role: ['roleKFEXT'],
                btnBgColor: ['#006600', '#D58512', '#0067ED']
            },
            2: {
                cate: 5,
                type: 2,
                htmlRequired: ['btnText', 'title', 'signature', 'btnBgColor', 'theme', 'closable', 'position'],
                tpl: 6,
                tplOptions: {
                    eventList: ['callAddPal'],
                    fixedBtnText: '好友',
                    hasAvatar: 0
                }
            },
            3: {
                cate: 5,
                type: 3,
                htmlRequired: ['btnText', 'title', 'signature', 'btnBgColor', 'theme', 'closable', 'position', 'avatar'],
                tpl: 6,
                tplOptions: {
                    eventList: ['callAddPal'],
                    fixedBtnText: '好友',
                    hasAvatar: 1
                }
            },
            4: {
                cate: 5,
                type: 4,
                htmlRequired: ['title', 'signature', 'avatar'],
                isInQQ: 1,
                tpl: 5,
                tplOptions: {
                    eventList: ['callAddPal'],
                    fixedBtnText: '好友',
                    hasAvatar: 1
                }
            }
        },
        /*********************web im************************************/
        7: {
            1: {
                cate: 7,
                type: 1,
                htmlRequired: ['theme'],
                floatStyle: {
                    gap: {
                        right: '15px',
                        bottom: '20px'
                    }
                },
                //小红点坐标偏移量
                //以wpa iframe右上角顶点为原点
                // circleOffset: {
                //     x: {
                //         key: 'right',
                //         value: -5
                //     },
                //     y: {
                //         key: 'bottom',
                //         value: 30
                //     }
                // },
                fixedCircleOffset: {
                    x: {
                        key: 'right',
                        value: -5
                    },
                    y: {
                        key: 'bottom',
                        value: 30
                    }
                }
            },
            2: {
                cate: 7,
                type: 2,
                floatStyle: {
                    gap: {
                        right: '15px',
                        bottom: '20px'
                    }
                },
                // circleOffset: {
                //     x: {
                //         key: 'right',
                //         value: -5
                //     },
                //     y: {
                //         key: 'bottom',
                //         value: 26
                //     }
                // },
                fixedCircleOffset: {
                    x: {
                        key: 'right',
                        value: -5
                    },
                    y: {
                        key: 'bottom',
                        value: 26
                    }
                },
                htmlRequired: ['btnText', 'theme']
            },
            3: {
                cate: 7,
                type: 3,
                htmlRequired: ['closable', 'btnText', 'title', 'signature', 'theme', 'position', 'avatar'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-im'],
                    eventList: ['callIm'],
                    hasBtnText: 1,
                    hasAvatar: 1
                },
                circleOffset: {
                    x: {
                        key: 'right',
                        value: -27
                    },
                    y: {
                        key: 'bottom',
                        value: 15
                    }
                },
                fixedCircleOffset: {
                    x: {
                        key: 'right',
                        value: 17
                    },
                    y: {
                        key: 'bottom',
                        value: 40
                    }
                }
            },
            4: {
                cate: 7,
                type: 4,
                htmlRequired: ['closable', 'btnText', 'title', 'signature', 'theme', 'position'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-im'],
                    eventList: ['callIm'],
                    hasBtnText: 1,
                    hasAvatar: 0
                },
                circleOffset: {
                    x: {
                        key: 'right',
                        value: -27
                    },
                    y: {
                        key: 'bottom',
                        value: 15
                    }
                },
                fixedCircleOffset: {
                    x: {
                        key: 'right',
                        value: 17
                    },
                    y: {
                        key: 'bottom',
                        value: 40
                    }
                }
            },
            5: {
                cate: 7,
                type: 5,
                htmlRequired: ['closable', 'title', 'signature', 'theme', 'position', 'avatar'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-call', 'icon-im'],
                    eventList: ['callPhone', 'callIm'],
                    hasBtnText: 0,
                    hasAvatar: 1
                },
                circleOffset: {
                    x: {
                        key: 'right',
                        value: -80
                    },
                    y: {
                        key: 'bottom',
                        value: 22
                    }
                },
                fixedCircleOffset: {
                    x: {
                        key: 'right',
                        value: 71
                    },
                    y: {
                        key: 'bottom',
                        value: 32
                    }
                }
            },
            6: {
                cate: 7,
                type: 6,
                htmlRequired: ['closable', 'title', 'signature', 'theme', 'position'],
                tpl: 3,
                tplOptions: {
                    iconList: ['icon-call', 'icon-im'],
                    eventList: ['callPhone', 'callIm'],
                    hasBtnText: 0,
                    hasAvatar: 0
                },
                circleOffset: {
                    x: {
                        key: 'right',
                        value: -80
                    },
                    y: {
                        key: 'bottom',
                        value: 22
                    }
                },
                fixedCircleOffset: {
                    x: {
                        key: 'right',
                        value: 71
                    },
                    y: {
                        key: 'bottom',
                        value: 32
                    }
                }
            },
            7: {
                cate: 7,
                type: 7,
                htmlRequired: ['title', 'signature', 'avatar', 'btnText'],
                isInQQ: 1,
                tpl: 4,
                tplOptions: {
                    iconList: ['icon-im'],
                    eventList: ['callIm'],
                    hasBtnText: 1,
                    hasAvatar: 1
                },
                circleOffset: {
                    x: {
                        key: 'right',
                        value: -15
                    },
                    y: {
                        key: 'bottom',
                        value: 15
                    }
                },
                fixedCircleOffset: {
                    x: {
                        key: 'right',
                        value: 5
                    },
                    y: {
                        key: 'bottom',
                        value: 46
                    }
                }
            },
            8: {
                cate: 7,
                type: 8,
                htmlRequired: ['title', 'signature', 'avatar'],
                isInQQ: 1,
                tpl: 4,
                tplOptions: {
                    iconList: ['icon-call', 'icon-im'],
                    eventList: ['callPhone', 'callIm'],
                    hasBtnText: 0,
                    hasAvatar: 1
                },
                circleOffset: {
                    x: {
                        key: 'right',
                        value: -72
                    },
                    y: {
                        key: 'bottom',
                        value: 22
                    }
                },
                fixedCircleOffset: {
                    x: {
                        key: 'right',
                        value: 62
                    },
                    y: {
                        key: 'bottom',
                        value: 40
                    }
                }
            },
            9: {
                cate: 7,
                type: 9,
                htmlRequired: ['title', 'signature', 'avatar', 'qrcode', 'theme'],
                isInQQ: 1,
                iframeBorder: {
                    width: '1px',
                    color: '#ebebeb'
                }
            },
            12: {
                cate: 7,
                type: 10,
                isPC: 1,
                floatStyle: {
                    gap: {
                        left: '10px',
                        bottom: '10px'
                    }
                },
                htmlRequired: ['signature', 'avatar', 'theme']
            },
            13: {
                cate: 7,
                type: 13,
                isPC: 1,
                floatStyle: {
                    gap: {
                        right: '10px'
                    }
                },
                borderRadius: '4px',
                htmlRequired: ['avatar', 'signature', 'theme']
            },
            14: {
                cate: 7,
                type: 14,
                isPC: 1,
                floatStyle: {
                    gap: {
                        right: '0'
                    }
                },
                htmlRequired: ['theme']
            }
        }
    };

    module.exports = wpaType;

});
/** src/util/insertIframe.js **/
/*
 * 插入到script标签前或者指定id的方法
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/20
 */
LBF.define('wpa.util.insertIframe', function(require, exports, module){

    var browser = require('lang.browser');
	
	var insertIframe = function(params) {

        var scripts = document.getElementsByTagName('script'),
            defaultLastScript = scripts[scripts.length - 1];

		var ele = params.ele,
			lastScript = params.lastScript ? params.lastScript : defaultLastScript,
			container = params.container;

        // var scripts = document.getElementsByTagName('script');
        // return scripts.length > 0 ? scripts[scripts.length - 1] : null;

		if (!container) {
			//将iframe插入到最后一个script标签前
            lastScript.parentNode.insertBefore(ele, lastScript);
            return;
        }

        if(typeof container === 'string') {//将iframe插入指定了id的元素里
            var targetEle = document.getElementById(container);

            if(!targetEle){
            	throw new Error('无法找到container，该container id对应元素不存在或者不在DOM中');
            }

            // ie6 or quirk mode insert into body directly
            var isQuirk = document.compatMode === 'BackCompat';
            if( (browser.msie && parseInt(browser.version, 10) < 7) || isQuirk){
                document.body.appendChild(ele);          
            } else {
                targetEle.appendChild(ele);
            }
            
            return;
        }

        if(typeof container.nodeType !== 'undefined'){
        	container.appendChild(ele);
            return;
        }

        throw new Error('无效的container，请检查container参数，以及container id对应的元素是否合法');
	};

	module.exports = insertIframe;

});
/** src/conf/floatCss.js **/
/*
 * 浮动图标的样式定义
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/20
 *
 */
LBF.define('wpa.conf.floatCss', function(require, exports) {

	var browser = require('lang.browser'),
		defaultConst = require('wpa.conf.defaultConst'),
		P = defaultConst.POSITION,
		offset = require('wpa.util.offset');

	//position: 0居中，1底部
	var POSITION_BOTTOM = 1,
		//MAX_Z_INDEX = 'z-index: 2147483647;';
		//部分用户可能需要覆盖wpa，所以这里不设置为最大的z-index
		MAX_Z_INDEX = 'z-index: 2000000000;',
		STYLE_FIXED = 'position:fixed;';

	exports.getFloatStyle = function(params) {

		var position = params.position,
			location = params.location,
			defaultPosition = params.defaultPosition,
			isWidthNum = typeof params.width === 'number' ? true : false,
			width = isWidthNum ? params.width : 0,
			height = typeof params.height === 'number' ? params.height : 0,
			gap = '0px',
			floatStyle = params.floatStyle || {},
			floatGap = floatStyle.gap || {},
			top = floatGap.top || gap,
			bottom = floatGap.bottom || gap,
			right = floatGap.right || gap,
			left = floatGap.left || gap,
			offsetY = height / 2,
			result = '';


		/*
			added by vergilzhou on 2017/11/18
			有location的优先
		*/
		if (location) {
			var h = location.h || {},
				v = location.v || {},
				hType = h.type,//1:左，2：中，3：右
				hPx = h.px || 0,
				vType = v.type,//1：上，2：中，3：下
				vPx = v.px || 0;

			//先判断水平偏移
			if (hType == 1) {//左边为基准
				result += 'left:' + hPx + 'px;';
			} else if (hType == 2) {//水平居中
				result += 'left: 50%;margin-left:-' + (width / 2) + 'px;';
			} else if (hType == 3) {//右边为基准
				result += 'right:' + hPx + 'px;';
			}

			//在判断垂直偏移
			if (vType == 1) {//上边为基准
				result += 'top:' + vPx + 'px;';
			} else if (vType == 2) {//垂直平居中
				result += 'top: 50%;margin-top:-' + (height / 2) + 'px;';
			} else if (vType == 3) {//下边为基准
				result += 'bottom:' + vPx + 'px;';
			}

			result += STYLE_FIXED + MAX_Z_INDEX;
			return result;
		}
		//defaultPosition不为空的情况优先
		//因为这是图标类型决定的
		if (defaultPosition) {
			//这里的浮动是图标本身固定的位置
			//用户无法选择位置
			switch (defaultPosition) {
				//右侧居中
				case P[6]: {
					result = 'right:' + right + ';top:50%;margin-top:-' + offsetY + 'px;';
					break;
				}
				//右下角
				case P[9]: {
					result = 'right:' + right + ';bottom:' + bottom;
					break;
				}
				//底部
				case P[8]: {
					result = 'bottom:' + gap + ';left:0;';
					break;
				}
				//左下角
				case P[7]: {
					result = 'bottom:' + bottom + ';left:' + left + ';';
					break;
				}
			}

			result += ';' + STYLE_FIXED + MAX_Z_INDEX;
		} else if (typeof position !== 'undefined') {
			//这里的浮动位置是可以在创建wpa的时候
			//让用户选择的，比如目前的底部浮动或者不浮动

			//这里不用switch是因为传来的position可能为字符串类型
			//而switch是精确比较
			if (position == POSITION_BOTTOM) {
				result = STYLE_FIXED + 'bottom:' + gap;
				//底部浮动并且宽度为100%的元素，添加left：0
				//防止有些网页会给body一个margin
				//导致iframe无法居中显示
				if (!isWidthNum & params.width == '100%') {
					result += ';left: 0';
				}
			}

			result += ';' + MAX_Z_INDEX;
		}

		return result;

	};

});

/** src/conf/Events.js **/
/*
 * WPA事件绑定配置文件
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/21
 *
 */
LBF.define('wpa.conf.Events', function(require, exports, module) {

	var Events = {
		defaultEventType : 'click'
	};

	return Events;

});
/** lib/lbf/lang/proxy.js **/
/**
 * Created by amos on 14-8-18.
 */
LBF.define('lang.proxy', function(require, exports, module){
    /**
     * Proxy function with assigned context.
     * By proxy function's context, inner function will get the assigned context instead of the invoking one
     * @class proxy
     * @namespace lang
     * @constructor
     * @param {Function} fn
     * @param {Object} context
     * @returns {Function}
     * @example
     *      var a = {
     *          x: 1,
     *          fn: function(){
     *              alert(this.x);
     *          }
     *      };
     *
     *      // this point to a
     *      a.fn(); // alert 1
     *
     *      var b = { x: 2};
     *      a.fn = proxy(a.fn, b);
     *
     *      // this point to b
     *      a.fn(); // alert 2
     */
    module.exports = function(fn, context){
        return function(){
            return fn.apply(context, arguments);
        };
    };
});
/** src/conf/wpaTmpl.js **/
/*
 * 图标模板
 * @author: vergilzhou
 * @version: 4.1.0
 * @date: 2016/06/08
 * 2016/06/08群里讨论funyu决定：移动端的按钮文字都固定
 */
LBF.define('wpa.conf.wpaTmpl', function(require, exports, module) {

	// var baseUrl = 'http://local.qiye.qq.com/static_proxy/themes/wpa/images/';
	var config = require('wpa.conf.config'),
		imageBaseUrl = config.imageBaseUrl,
        TYPES = config.TYPES,
        extend = require('lang.extend'),
		browser = require('lang.browser'),
		defaultConst = require('wpa.conf.defaultConst'),
		defaultEventTagName = defaultConst.defaultEventTagName,
		wpaType = require('wpa.conf.wpaType'),
        replaceImg3X = require('wpa.util.replaceImg3X'),
		getTpl = require('wpa.conf.tpl');

    var isAndroid = browser.isAndroid,
        isIOS = browser.isIOS,
        isMobile = isAndroid || isIOS;

    var COLORS = {
        2: '#12b7f5',
        3: '#0067ed',
        4: '#ff9232',
        5: '#ee685d',
        6: '#25cd98'
    };

	//默认位置常量
	var POSITION = defaultConst.POSITION,
        ratio,
        tpls,
        tmpls;

    var getSizeFunc = require('wpa.util.getSize');

	//一些公用的模板
	/*
		1: 'callChat',
		2: 'callPhone',
		3: 'callAddPal',
		4: 'callAddGroup',
		5: 'callAddFan'
	*/
	

	// todo
	// mockup page and grunt build?
	module.exports = exports = {
        init: function(options) {

            options = options || {};

            var ratio = options.ratio || 1,
                opts = {
                    ratio: ratio
                },
                getSize = getSizeFunc(options.ratio);
            tpls = {
                /*
                    投放到H5页面
                    有头像的模板
                    见文档加关注大类第2小类
                */
                1: getTpl(1, extend({
                    hasAvatar: 1
                }, opts)),
                /*
                    右下角对话框类
                    可以指定接触点行为
                    见文档加关注大类第1小类
                */
                2: getTpl(2, opts),
                /*
                    投放到H5页面
                    没有头像的模板
                    见文档加关注大类第3小类
                */
                3: getTpl(1, opts),
                //类似1_9这种标识的模板，1为大类，9为小类
                //对应文档来看
                '1_9': getTpl(wpaType[TYPES.QQ][9].tpl, extend(wpaType[TYPES.QQ][9].tplOptions, opts)),
                '1_10': getTpl(wpaType[TYPES.QQ][10].tpl, extend(wpaType[TYPES.QQ][10].tplOptions, opts)),
                '1_11': getTpl(wpaType[TYPES.QQ][11].tpl, extend(wpaType[TYPES.QQ][11].tplOptions, opts)),
                '1_12': getTpl(wpaType[TYPES.QQ][12].tpl, extend(wpaType[TYPES.QQ][12].tplOptions, opts)),
                '1_13': getTpl(wpaType[TYPES.QQ][13].tpl, extend(wpaType[TYPES.QQ][13].tplOptions, opts)),
                '1_14': getTpl(wpaType[TYPES.QQ][14].tpl, extend(wpaType[TYPES.QQ][14].tplOptions, opts)),
                '2_3': getTpl(wpaType[TYPES.PHONE][3].tpl, extend(wpaType[TYPES.PHONE][3].tplOptions, opts)),
                '2_4': getTpl(wpaType[TYPES.PHONE][4].tpl, extend(wpaType[TYPES.PHONE][4].tplOptions, opts)),
                '2_5': getTpl(wpaType[TYPES.PHONE][5].tpl, extend(wpaType[TYPES.PHONE][5].tplOptions, opts)),
                '2_6': getTpl(wpaType[TYPES.PHONE][6].tpl, extend(wpaType[TYPES.PHONE][6].tplOptions, opts)),
                '2_7': getTpl(wpaType[TYPES.PHONE][7].tpl, extend(wpaType[TYPES.PHONE][7].tplOptions, opts)),
                '2_8': getTpl(wpaType[TYPES.PHONE][8].tpl, extend(wpaType[TYPES.PHONE][8].tplOptions, opts)),
                '3_2': getTpl(wpaType[TYPES.PUB][2].tpl, extend(wpaType[TYPES.PUB][2].tplOptions, opts)),
                '3_3': getTpl(wpaType[TYPES.PUB][3].tpl, extend(wpaType[TYPES.PUB][3].tplOptions, opts)),
                '4_2': getTpl(wpaType[TYPES.GROUP][2].tpl, extend(wpaType[TYPES.GROUP][2].tplOptions, opts)),
                '4_3': getTpl(wpaType[TYPES.GROUP][3].tpl, extend(wpaType[TYPES.GROUP][3].tplOptions, opts)),
                '4_4': getTpl(wpaType[TYPES.GROUP][4].tpl, extend(wpaType[TYPES.GROUP][4].tplOptions, opts)),
                '5_2': getTpl(wpaType[TYPES.KFEXT][2].tpl, extend(wpaType[TYPES.KFEXT][2].tplOptions, opts)),
                '5_3': getTpl(wpaType[TYPES.KFEXT][3].tpl, extend(wpaType[TYPES.KFEXT][3].tplOptions, opts)),
                '5_4': getTpl(wpaType[TYPES.KFEXT][4].tpl, extend(wpaType[TYPES.KFEXT][4].tplOptions, opts)),
                '7_3': getTpl(wpaType[TYPES.IM][3].tpl, extend(wpaType[TYPES.IM][3].tplOptions, opts)),
                '7_4': getTpl(wpaType[TYPES.IM][4].tpl, extend(wpaType[TYPES.IM][4].tplOptions, opts)),
                '7_5': getTpl(wpaType[TYPES.IM][5].tpl, extend(wpaType[TYPES.IM][5].tplOptions, opts)),
                '7_6': getTpl(wpaType[TYPES.IM][6].tpl, extend(wpaType[TYPES.IM][6].tplOptions, opts)),
                '7_7': getTpl(wpaType[TYPES.IM][7].tpl, extend(wpaType[TYPES.IM][7].tplOptions, opts)),
                '7_8': getTpl(wpaType[TYPES.IM][8].tpl, extend(wpaType[TYPES.IM][8].tplOptions, opts))
                
            },
            tmpls = {
                defaultEventTagName : defaultEventTagName,
                /*************在线接待*********************/
                1: {
                    //图标类型1
                    1: {
                        width: 96,
                        height: 30,
                        accurateSize: 1,
                        tpl: ['<a href="javascript:void(0);" name="' + defaultEventTagName + '" class="wpa-container {theme}" data-event="callChat">',
                                '<span class="icon-qq"></span>',
                                '<span class="btn-text">{btnText}</span>',
                            '</a>'].join(''),
                        cssText: ['* {{common}}',
                            '.wpa-container {text-align: center;{dib}width: 94px;height: 28px;line-height:28px;text-decoration: none;border:1px solid #dadee7;border-radius: 2px; font-size: 14px;font-family:"microsoft yahei";}',
                            '.icon-qq {{dib}vertical-align: middle;width: 18px;height: 18px;margin-right: 3px;margin-top:-3px;}',
                            '.theme-1 {background: #fff;color: #1e2330;}',
                            '.theme-1 .icon-qq {background: url("' + imageBaseUrl + '/1_1_1.png") no-repeat;}',
                            '.theme-2 {background: #12b7f5;color: #fff;border-color: #12b7f5;}',
                            '.icon-qq {background: url("' + imageBaseUrl + '/1_1_2.png") no-repeat;}',
                            '.theme-3 {background: #0067ed;color: #fff;border-color: #0067ed;}',
                            '.theme-4 {background: #ff9232;color: #fff;border-color: #ff9232;}',
                            '.theme-5 {background: #ee685d;color: #fff;border-color: #ee685d;}',
                            '.theme-6 {background: #33cc99;color: #fff;border-color: #33cc99;}',
                            '.btn-text {{dib}vertical-align: middle;font-size: 14px;height: 28px;line-height: 28px;margin-top:-3px;{ell}}'].join('')
                    },
                    //图标类型2
                    2: {
                        width: 150,
                        height: 45,
                        accurateSize: 1,
                        tpl: ['<a href="javascript:void(0);" name="' + defaultEventTagName + '" class="wpa-container {theme}" data-event="callChat">',
                                '<span class="icon-qq"></span>',
                                '<span class="btn-text">{btnText}</span>',
                            '</a>'].join(''),
                        cssText: ['* {{common}}',
                            '.wpa-container {text-align: center;{dib}width: 148px;height: 43px;line-height:42px;text-decoration: none;border-radius: 2px; border:1px solid #dadee7;font-size: 14px;font-family:"microsoft yahei";}',
                            '.icon-qq {{dib}vertical-align: middle;width: 26px;height: 26px;margin-right: 10px;}',
                            '.theme-1 {background: #fff;color: #1e2330;}',
                            '.theme-1 .icon-qq {background: url("' + imageBaseUrl + '/1_2_1.png") no-repeat;}',
                            '.theme-2 {background: #12b7f5;color: #fff;border-color: #12b7f5;}',
                            '.icon-qq {background: url("' + imageBaseUrl + '/1_2_2.png") no-repeat;}',
                            '.theme-3 {background: #0067ed;color: #fff;border-color: #0067ed;}',
                            '.theme-4 {background: #ff9232;color: #fff;border-color: #ff9232;}',
                            '.theme-5 {background: #ee685d;color: #fff;border-color: #ee685d;}',
                            '.theme-6 {background: #33cc99;color: #fff;border-color: #33cc99;}',
                            '.btn-text {{dib}vertical-align: middle;font-size: 16px;height: 45px;line-height: 45px;position:relative;top:-2px;{ell}}'].join('')
                    },
                    3: {
                        width: 255,
                        height: 85,
                        accurateSize: 1,
                        defaultPosition: POSITION[6],
                        tpl: [
                            '<a class="wpa-container" data-event="callChat" name="' + defaultEventTagName + '">',
                                '<img class="avatar" src="{avatar}" />',
                                '<span class="icon-qq"></span>',
                                '<span class="title">{title}</span>',
                                '<span class="signature">{signature}</span>',
                            '</a>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {{dib}width: 253px;height: 83px;border-radius: 2px;position: relative;font-family:"microsoft yahei";font-size: 14px;background: #fff;border: 1px solid #dadee7;box-shadow:0 1px 3px rgba(30, 36, 49, 0.15);cursor: pointer;}',
                            '.avatar {width: 85px;height: 83px;position: absolute;left:0;top: 0;}',
                            '.icon-qq {{dib}width: 22px;height: 22px;background: url("' + imageBaseUrl + '/1_4.png") no-repeat;position: absolute;left: 97px;top: 18px;}',
                            '.title {{dib}{ell}max-width: 125px;font-size: 20px;position: absolute;left: 126px;top: 16px;color:#1e2330;}',
                            '.signature {{dib}{ell}max-width: 150px;position: absolute;left: 97px;top: 50px;text-align: left;}'
                        ].join('')
                    },
                    4: {
                        width: 70,
                        height: 70,
                        accurateSize: 1,
                        defaultPosition: POSITION[6],
                        tpl: ['<a class="wpa-container {theme}" data-event="callChat" name="' + defaultEventTagName + '">',
                                '<span class="icon-qq"></span>',
                                '<span class="btn-text">{btnText}</span>',
                            '</a>'].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {cursor:pointer;{dib}width: 68px;height: 68px;border-radius: 2px;border:1px solid #dadee7;position: relative;font-family:"microsoft yahei";font-size: 12px;text-align: center;top:0;}',
                            '.theme-1 {background: #fff;}',
                            '.theme-1 .btn-text {color:#1e2330;}',
                            '.theme-2 {background: #12b7f5;color:#fff;border-color: #12b7f5;}',
                            '.icon-qq {{dib}width: 26px;height: 26px;position: absolute;top: 13px;left: 22px;}',
                            '.theme-1 .icon-qq {background: url("' + imageBaseUrl + '/1_2_1.png") no-repeat;}',
                            '.icon-qq {background: url("' + imageBaseUrl + '/1_2_2.png") no-repeat;}',
                            '.theme-3 {background: #0067ed;color: #fff;border-color: #0067ed;}',
                            '.theme-4 {background: #ff9232;color: #fff;border-color: #ff9232;}',
                            '.theme-5 {background: #ee685d;color: #fff;border-color: #ee685d;}',
                            '.theme-6 {background: #33cc99;color: #fff;border-color: #33cc99;}',
                            '.btn-text {{ell}max-width: 70px;color:#fff;display: block;position: relative;top: 43px;}'
                        ].join('')
                    },
                    5: {
                        width: 106,
                        height:165,
                        accurateSize: 1,
                        defaultPosition: POSITION[6],
                        tpl: [
                            '<a class="wpa-container" data-event="callChat" name="' + defaultEventTagName + '">',
                                '<span class="title">{title}</span>',
                                '<img class="avatar" src="{avatar}" />',
                                '<span class="btn-area" style="background: {btnBgColor}">',
                                    '<span class="icon-qq"></span>',
                                    '<span class="btn-text">{btnText}</span>',
                                '</span>',
                            '</a>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {{dib}{boxShadow}width: 104px;height: 165px;border-radius: 2px;position: relative;font-family:"microsoft yahei";font-size: 14px;background: #fff;border: 1px solid #dadee7;{boxShadow}cursor: pointer;text-align: center;}',
                            '.title {{dib}color: #000;margin-top: 9px;color:#1e2330;}',
                            '.avatar {width: 80px;height: 80px;border-radius: 50%;margin-top: 9px;}',
                            '.btn-area {{dib}width: 106px;height: 35px;line-height: 35px;position: absolute;bottom: -1px;left: -1px;text-align: center;margin-right: 6px;border-bottom-left-radius: 2px;border-bottom-right-radius: 2px;}',
                            '.icon-qq {{dib}width: 22px;height: 22px;vertical-align: middle;background: url("' + imageBaseUrl + '/1_1_2.png") no-repeat;margin-top:1px;}',
                            '.btn-text {{ell}color: #fff;max-width: 100px;}'
                        ].join('')
                    },
                    6: {
                        width: 404,
                        height: 200,
                        accurateSize: 1,
                        defaultPosition: POSITION[9],
                        tpl: [
                            '<div class="wpa-container">',
                                '<a class="close" data-event="callClose" name="' + defaultEventTagName + '" href="javascript:void(0);"></a>',
                                '<img class="avatar" src="{avatar}" />',
                                '<div class="content">',
                                    '<p class="title">{title}</p>',
                                    '<p class="signature">{signature}</p>',
                                '</div>',
                                '<a class="btn-area" data-event="callChat" name="' + defaultEventTagName + '" style="background: {btnBgColor}">',
                                    '<span class="icon-qq"></span>',
                                    '<span class="btn-text">{btnText}</span>',
                                '</a>',
                            '</div>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {{dib}width: 402px;height: 198px;border-radius: 2px;position: relative;border:1px solid #dadee7;background: #fff;/*border: 1px solid #ebedf2;*/font-family:"microsoft yahei";font-size: 14px;{boxShadow}}',
                            '.close {position: absolute;top: 15px;right: 15px;{dib}width: 14px;height: 14px;background: url(' + imageBaseUrl + '/icon-close.png) no-repeat;}',
                            '.avatar {position: absolute;top: 0;left: 0;width: 150px;height: 198px;}',
                            '.content {position: absolute;top: 30px;left: 170px;}',
                            '.title {{ell}font-size: 22px;color:#1e2330;}',
                            '.icon-qq {{dib}width: 22px;height: 22px;margin-left: 1px;margin-top:1px;vertical-align: middle;background: url("' + imageBaseUrl + '/1_1_2.png") no-repeat;}',
                            '.signature {color: #777;line-height: 24px;margin-top: 10px;width: 215px;}',
                            '.btn-area {{ell}text-decoration: none;color: #fff;position: absolute;right: 15px;bottom: 15px;width: 100px;border-radius: 2px;text-align: center;height: 35px;line-height: 35px;cursor:pointer;}'
                        ].join('')
                    },
                    7: {
                        width: 88,
                        height: 90,
                        accurateSize: 1,
                        defaultPosition: POSITION[9],
                        tpl: [
                            '<a class="wpa-container" data-event="callChat" name="' + defaultEventTagName + '">',
                                '<span class="icon-qq"></span>',
                            '</a>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {{dib}line-height:1;width: ' + getSize(84) + 'px;height: ' + getSize(84) + 'px;border-radius: 50%;background: #fff;border: 1px solid #dadee7;cursor: pointer;text-align: center;}',
                            '.icon-qq {{dib}position:relative;top:' + getSize(20) + 'px;width: ' + getSize(37) + 'px;height: ' + getSize(44) + 'px;vertical-align: middle;background: url(' + imageBaseUrl + replaceImg3X('/icon-qq-44-2x.png', ratio) + ') no-repeat;background-size: ' + getSize(37) + 'px ' + getSize(44) + 'px;}'
                        ].join('')
                    },
                    8: {
                        width: 250,
                        height: 78,
                        accurateSize: 1,
                        defaultPosition: POSITION[9],
                        tpl: [
                            '<a class="wpa-container" data-event="callChat" name="' + defaultEventTagName + '">',
                                '<span class="v"></span>',
                                '<span class="icon-qq"></span>',
                                // '<span class="btnText">{btnText}</span>',
                                '<span class="btnText">在线咨询</span>',
                            '</a>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {{dib}font-size:0;-webkit-text-size-adjust:none;width: ' + getSize(246) + 'px;height: ' + getSize(74) + 'px;border-radius: ' + getSize(100) + 'px;background: #fff;border: 1px solid #dadee7;cursor: pointer;text-align: center;position:relative;}',
                            '.v {{dib}vertical-align:middle;line-height:' + getSize(74) + 'px;width:1px;height:' + getSize(74) + 'px;}',
                            '.icon-qq {{dib}vertical-align:middle;width: ' + getSize(37) + 'px;height: ' + getSize(44) + 'px;background: url(' + imageBaseUrl + replaceImg3X('/icon-qq-44-2x.png', ratio) + ') no-repeat;background-size: ' + getSize(37) + 'px ' + getSize(44) + 'px;margin-right:8px;}',
                            '.btnText {{dib}{ell}vertical-align:middle;font-size: ' + getSize(34) + 'px;max-width: ' + getSize(140) + 'px;color: #1e2330;line-height:1;}'
                            //'.btnText {{dib}{ell}font-size: ' + getSize(26) + 'px;max-width: ' + getSize(110) + 'px;color: #666;vertical-align:middle;position:relative;left:8px;top:0px;}'
                        ].join('')
                    },
                    9: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['1_9']().tpl,
                        cssText: tpls['1_9']().cssText
                    },
                    10: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['1_10']().tpl,
                        cssText: tpls['1_10']().cssText
                    },
                    11: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['1_11']().tpl,
                        cssText: tpls['1_11']().cssText
                    },
                    12: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['1_12']().tpl,
                        cssText: tpls['1_12']().cssText
                    },
                    13: {
                        width: '100%',
                        height: 140,
                        accurateSize: 0,
                        tpl: tpls['1_13']().tpl,
                        cssText: tpls['1_13']().cssText
                    },
                    14: {
                        width: '100%',
                        height: 140,
                        accurateSize: 0,
                        tpl: tpls['1_14']().tpl,
                        cssText: tpls['1_14']().cssText
                    },
                    15: {
                        width: '100%',
                        height: 270,
                        accurateSize: 0,
                        tpl: [
                            '<div class="wpa-container theme-1">',
                                '<div class="qr-code">',
                                    '<img src="{qrcode}" class="qr-code-img"/>',
                                    '<img src="{avatar}" class="avatar-in-qr-code" />',
                                '</div>',
                                '<div class="info">',
                                    '<div class="avatar">',
                                        //'<img src="{avatar}" class="img-avatar"/>',
                                        '<span class="title">{title}</span>',
                                    '</div>',
                                    '<div class="signature">',
                                        '{signature}',
                                    '</div>',
                                '</div>',
                            '</div>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {{dib}position: relative;width: 100%;height: ' + getSize(230) + 'px;padding: ' + getSize(20) + 'px;}',
                            '.theme-1 {background: #fff;box-shadow: 0 0 0 1px #bbb;}',
                            '.theme-2 {background: #19212e;}',
                            '.theme-3 {background: #00a5e0;}',
                            '.theme-4 {background: #ff9232;}',
                            '.theme-5 {background: #ee685d;}',
                            '.theme-6 {background: #33cc99;}',
                            '.qr-code, .info, .title {{dib}}',
                            '.img-avatar {display: none;}',
                            '.qr-code {padding: ' + getSize(15) + 'px; background: #fff; position:relative; width: ' + getSize(200) + 'px; height: ' + getSize(200) + 'px;}',
                            '.qr-code-img {width: ' + getSize(200) + 'px;height: ' + getSize(200) + 'px;}',
                            '.theme-1 .qr-code {padding: 0; width: ' + getSize(230) + 'px; height: ' + getSize(230) + 'px;}',
                            '.theme-1 .qr-code-img {width: ' + getSize(230) + 'px;height: ' + getSize(230) + 'px;}',
                            '.avatar-in-qr-code {width: ' + getSize(50) + 'px; height: ' + getSize(50) + 'px; position:absolute;top: ' + getSize(90) + 'px;left: ' + getSize(90) + 'px;display:none;}',
                            '.info {position: absolute;left: ' + getSize(270) + 'px;top: ' + getSize(63) + 'px;}',
                            '.avatar img {border-radius: 50%;width: ' + getSize(80) + 'px;height: ' + getSize(80) + 'px;vertical-align: middle;}',
                            '.title {font-size: ' + getSize(36) + 'px;vertical-align: middle;margin-left: ' + getSize(/*15有头像的时候用15*/0) + 'px;color: #fff;{ell}}',
                            '.signature {line-height: 1.6em;font-size: ' + getSize(26) + 'px;max-width: 85%;margin-top: ' + getSize(16) + 'px;color: #fff;{wordBreak}}',
                            '.theme-1 .signature {color: #999;}',
                            '.theme-1 .title {color: #000;}'
                        ].join('')
                    }
                },
                /*************免费电话*********************/
                2: {
                    1: {
                        width: 88,
                        height: 88,
                        accurateSize: 1,
                        defaultPosition: POSITION[9],
                        tpl: ['<a href="javascript:void(0);" class="wpa-container" name="' + defaultEventTagName + '" data-event="callPhone">',
                                '<img class="icon-call" src="' + imageBaseUrl + '/icon-call-44-2x.png" srcset="' + imageBaseUrl + '/icon-call-44-2x.png 1x, ' + imageBaseUrl + '/icon-call-44-3x.png 2x" />',
                            '</a>'].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {{dib}width: ' + getSize(84) + 'px;height: ' + getSize(84) + 'px;text-decoration: none;text-align: center;border-radius: 100%;border: 1px solid #dadee7;background:#fff;line-height: ' + getSize(78) + 'px;}',
                            '.wpa-container img {vertical-align: middle; width: ' + getSize(42) + 'px; height: ' + getSize(42) + 'px;}'
                        ].join('')
                    },
                    2: {
                        width: 250,
                        height: 78,
                        accurateSize: 1,
                        defaultPosition: POSITION[9],
                        tpl: [
                            '<a class="wpa-container" data-event="callPhone" name="' + defaultEventTagName + '">',
                                '<span class="v"></span>',
                                '<span class="icon-call"></span>',
                                // '<span class="btnText">{btnText}</span>',
                                '<span class="btnText">免费电话</span>',
                            '</a>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {{dib}font-size:0;-webkit-text-size-adjust:none;width: ' + getSize(246) + 'px;height: ' + getSize(74) + 'px;border-radius: ' + getSize(100) + 'px;background: #fff;border: 1px solid #dadee7;cursor: pointer;text-align: center;position:relative;}',
                            '.v {{dib}vertical-align:middle;line-height:' + getSize(74) + 'px;width:1px;height:' + getSize(74) + 'px;}',
                            '.icon-call {{dib}vertical-align:middle;width: ' + getSize(37) + 'px;height: ' + getSize(44) + 'px;background: url(' + imageBaseUrl + replaceImg3X('/icon-call-30-2x.png', ratio) + ') no-repeat;background-size: ' + getSize(37) + 'px ' + getSize(44) + 'px;margin-right:8px;}',
                            '.btnText {{dib}{ell}vertical-align:middle;font-size: ' + getSize(34) + 'px;max-width: ' + getSize(140) + 'px;color: #1e2330;line-height:' + (isAndroid ? '41px' : '1') + ';}'
                            //'.btnText {{dib}{ell}font-size: ' + getSize(26) + 'px;max-width: ' + getSize(110) + 'px;color: #666;vertical-align:middle;position:relative;left:8px;top:0px;}'
                        ].join('')
                    },
                    3: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['2_3']().tpl,
                        cssText: tpls['2_3']().cssText
                    },
                    4: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['2_4']().tpl,
                        cssText: tpls['2_4']().cssText
                    },
                    5: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['2_5']().tpl,
                        cssText: tpls['2_5']().cssText
                    },
                    6: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['2_6']().tpl,
                        cssText: tpls['2_6']().cssText
                    },
                    7: {
                        width: '100%',
                        height: 140,
                        accurateSize: 0,
                        tpl: tpls['2_7']().tpl,
                        cssText: tpls['2_7']().cssText
                    },
                    8: {
                        width: '100%',
                        height: 140,
                        accurateSize: 0,
                        tpl: tpls['2_8']().tpl,
                        cssText: tpls['2_8']().cssText
                    }
                },
                /*************加关注*********************/
                3: {
                    1: {
                        width: 404,
                        height: 200,
                        accurateSize: 1,
                        defaultPosition: POSITION[9],
                        tpl: tpls[2]({event: 5}).tpl,
                        cssText: tpls[2]({event: 5}).cssText
                    },
                    2: {
                        width: '100%',
                        // height: 130,
                        height: 140,
                        accurateSize: 0,
                        //defaultPosition: POSITION[8],
                        // tpl: tpls[1]({event: 5}).tpl,
                        // cssText: tpls[1]({event: 5}).cssText
                        tpl: tpls['3_2']().tpl,
                        cssText: tpls['3_2']().cssText
                    },
                    3: {
                        width: '100%',
                        // height: 130,
                        height: 140,
                        accurateSize: 0,
                        // tpl: tpls[3]({event: 5}).tpl,
                        // cssText: tpls[3]({event: 5}).cssText
                        tpl: tpls['3_3']().tpl,
                        cssText: tpls['3_3']().cssText
                    }
                },
                /*************加群*********************/
                4: {
                    1: {
                        width: 404,
                        height: 200,
                        accurateSize: 1,
                        defaultPosition: POSITION[9],
                        tpl: tpls[2]({event: 4}).tpl,
                        cssText: tpls[2]({event: 4}).cssText
                    },
                    2: {
                        width: '100%',
                        // height: 130,
                        height: 140,
                        accurateSize: 0,
                        //defaultPosition: POSITION[8],
                        // tpl: tpls[3]({event: 4}).tpl,
                        // cssText: tpls[3]({event: 4}).cssText
                        tpl: tpls['4_2']().tpl,
                        cssText: tpls['4_2']().cssText
                    },
                    3: {
                        width: '100%',
                        // height: 130,
                        height: 140,
                        accurateSize: 0,
                        // tpl: tpls[1]({event: 4}).tpl,
                        // cssText: tpls[1]({event: 4}).cssText
                        tpl: tpls['4_3']().tpl,
                        cssText: tpls['4_3']().cssText
                    },
                    4: {
                        width: '100%',
                        height: 140,
                        accurateSize: 0,
                        tpl: tpls['4_4']().tpl,
                        cssText: tpls['4_4']().cssText
                    }
                },
                /*************加好友*********************/
                5: {
                    1: {
                        width: 404,
                        height: 200,
                        accurateSize: 1,
                        defaultPosition: POSITION[9],
                        tpl: [
                            '<div class="wpa-container">',
                                '<a class="close" data-event="callClose" name="' + defaultEventTagName + '" href="javascript:void(0);"></a>',
                                '<img class="avatar" src="{avatar}" />',
                                '<div class="content">',
                                    '<p class="title">{title}</p>',
                                    '<p class="signature">{signature}</p>',
                                '</div>',
                                '<a class="btn" style="background:{btnBgColor};" href="javascript:void(0);" name="' + defaultEventTagName + '" data-event="callAddPal">{btnText}</a>',
                            '</div>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {{dib}width: 404px;height: 200px;border-radius: 2px;position: relative;background: #fff;/*border: 1px solid #ebedf2;*/font-family:"microsoft yahei";font-size: 14px;{boxShadow}}',
                            '.close {position: absolute;top: 15px;right: 15px;{dib}width: 14px;height: 14px;background: url(' + imageBaseUrl + '/icon-close.png) no-repeat;}',
                            '.avatar {position: absolute;top: 0;left: 0;width: 150px;height: 200px;}',
                            '.content {position: absolute;top: 30px;left: 170px;}',
                            '.title {{ell}font-size: 18px;}',
                            '.signature {color: #777;line-height: 24px;margin-top: 10px;width: 215px;}',
                            '.btn {{ell}text-decoration: none;color: #fff;position: absolute;right: 15px;bottom: 15px;width: 100px;border-radius: 2px;text-align: center;height: 35px;line-height: 35px;}'
                        ].join('')
                    },
                    2: {
                        width: '100%',
                        // height: 130,
                        height: 140,
                        accurateSize: 0,
                        //defaultPosition: POSITION[8],
                        // tpl: tpls[3]({event: 3}).tpl,
                        // cssText: tpls[3]({event: 3}).cssText
                        tpl: tpls['5_2']().tpl,
                        cssText: tpls['5_2']().cssText
                    },
                    3: {
                        width: '100%',
                        // height: 130,
                        height: 140,
                        accurateSize: 0,
                        // tpl: tpls[1]({event: 3}).tpl,
                        // cssText: tpls[1]({event: 3}).cssText
                        tpl: tpls['5_3']().tpl,
                        cssText: tpls['5_3']().cssText
                    },
                    4: {
                        width: '100%',
                        height: 140,
                        accurateSize: 0,
                        tpl: tpls['5_4']().tpl,
                        cssText: tpls['5_4']().cssText
                    }
                },
                //网页接待
                7: {
                    1: {
                        width: 88,
                        height: 90,
                        accurateSize: 1,
                        defaultPosition: POSITION[9],
                        tpl: [
                            '<a class="wpa-container {theme}" data-event="callIm" name="' + defaultEventTagName + '">',
                                '<span class="icon-im"></span>',
                            '</a>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {{dib}line-height:1;width: ' + getSize(84) + 'px;height: ' + getSize(84) + 'px;border-radius: 50%;border: 1px solid #dadee7;cursor: pointer;text-align: center;}',
                            '.icon-im {{dib}position:relative;top:' + getSize(20) + 'px;width: ' + getSize(44) + 'px;height: ' + getSize(44) + 'px;vertical-align: middle;background: url(' + imageBaseUrl + replaceImg3X('/icon-im-44-white-2x.png', ratio) + ') no-repeat;background-size: ' + getSize(44) + 'px ' + getSize(44) + 'px;}',
                            '.theme-1 {background: #fff;}',
                            '.theme-1 .icon-im {background: url(' + imageBaseUrl + replaceImg3X('/icon-im-44-blue-2x.png', ratio) + ') no-repeat;background-size: ' + getSize(44) + 'px ' + getSize(44) + 'px;}',
                            '.theme-2 {background: #12b7f5;border-color: #12b7f5;}',
                            '.theme-3 {background: #0067ed;border-color: #0067ed;}',
                            '.theme-4 {background: #ff9232;border-color: #ff9232;}',
                            '.theme-5 {background: #ee685d;border-color: #ee685d;}',
                            '.theme-6 {background: #25cd98;border-color: #25cd98;}'
                        ].join('')
                    },
                    2: {
                        width: 250,
                        height: 78,
                        accurateSize: 1,
                        defaultPosition: POSITION[9],
                        tpl: [
                            '<a class="wpa-container {theme}" data-event="callIm" name="' + defaultEventTagName + '">',
                                '<span class="v"></span>',
                                '<span class="icon-im"></span>',
                                '<span class="btnText">{btnText}</span>',
                            '</a>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {{dib}font-size:0;-webkit-text-size-adjust:none;width: ' + getSize(246) + 'px;height: ' + getSize(74) + 'px;border-radius: ' + getSize(100) + 'px;background: #fff;border: 1px solid #dadee7;cursor: pointer;text-align: center;position:relative;}',
                            '.v {{dib}vertical-align:middle;line-height:' + getSize(74) + 'px;width:1px;height:' + getSize(74) + 'px;}',
                            '.icon-im {{dib}vertical-align:middle;width: ' + getSize(44) + 'px;height: ' + getSize(44) + 'px;background: url(' + imageBaseUrl + replaceImg3X('/icon-im-44-white-2x.png', ratio) + ') no-repeat;background-size: ' + getSize(44) + 'px ' + getSize(44) + 'px;margin-right:8px;}',
                            '.btnText {{dib}{ell}vertical-align:middle;font-size: ' + getSize(34) + 'px;max-width: ' + getSize(140) + 'px;color: #fff;line-height:1;}',
                            '.theme-1 {background:#fff;}',
                            '.theme-1 .icon-im {background: url(' + imageBaseUrl + replaceImg3X('/icon-im-44-blue-2x.png', ratio) + ') no-repeat;background-size: ' + getSize(44) + 'px ' + getSize(44) + 'px;}',
                            '.theme-1 .btnText {color: #1e2330;}',
                            '.theme-2 {background: #12b7f5;border-color: #12b7f5;}',
                            '.theme-3 {background: #0067ed;border-color: #0067ed;}',
                            '.theme-4 {background: #ff9232;border-color: #ff9232;}',
                            '.theme-5 {background: #ee685d;border-color: #ee685d;}',
                            '.theme-6 {background: #25cd98;border-color: #25cd98;}'
                            //'.btnText {{dib}{ell}font-size: ' + getSize(26) + 'px;max-width: ' + getSize(110) + 'px;color: #666;vertical-align:middle;position:relative;left:8px;top:0px;}'
                        ].join('')
                    },
                    3: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['7_3']().tpl,
                        cssText: tpls['7_3']().cssText
                    },
                    4: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['7_4']().tpl,
                        cssText: tpls['7_4']().cssText
                    },
                    5: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['7_5']().tpl,
                        cssText: tpls['7_5']().cssText
                    },
                    6: {
                        width: '100%',
                        height: 130,
                        accurateSize: 0,
                        tpl: tpls['7_6']().tpl,
                        cssText: tpls['7_6']().cssText
                    },
                    7: {
                        width: '100%',
                        height: 140,
                        accurateSize: 0,
                        tpl: tpls['7_7']().tpl,
                        cssText: tpls['7_7']().cssText
                    },
                    8: {
                        width: '100%',
                        height: 140,
                        accurateSize: 0,
                        tpl: tpls['7_8']().tpl,
                        cssText: tpls['7_8']().cssText
                    },
                    9: {
                        width: '100%',
                        height: 270,
                        accurateSize: 0,
                        tpl: [
                            '<div class="wpa-container theme-1">',
                                '<div class="qr-code">',
                                    '<img src="{qrcode}" class="qr-code-img"/>',
                                    '<img src="{avatar}" class="avatar-in-qr-code" />',
                                '</div>',
                                '<div class="info">',
                                    '<div class="avatar">',
                                        //'<img src="{avatar}" class="img-avatar"/>',
                                        '<span class="title">{title}</span>',
                                    '</div>',
                                    '<div class="signature">',
                                        '{signature}',
                                    '</div>',
                                '</div>',
                            '</div>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {z-index:1;{dib}position: relative;width: 100%;height: ' + getSize(230) + 'px;padding: ' + getSize(20) + 'px;}',
                            '.theme-1 {background: #fff;box-shadow: 0 0 0 1px #bbb;}',
                            '.theme-2 {background: #19212e;}',
                            '.theme-3 {background: #00a5e0;}',
                            '.theme-4 {background: #ff9232;}',
                            '.theme-5 {background: #ee685d;}',
                            '.theme-6 {background: #33cc99;}',
                            '.qr-code, .info, .title {{dib}}',
                            '.img-avatar {display: none;}',
                            '.qr-code {padding: ' + getSize(15) + 'px; background: #fff; position:relative; width: ' + getSize(200) + 'px; height: ' + getSize(200) + 'px;}',
                            '.qr-code-img {width: ' + getSize(200) + 'px;height: ' + getSize(200) + 'px;}',
                            '.theme-1 .qr-code {padding: 0; width: ' + getSize(230) + 'px; height: ' + getSize(230) + 'px;}',
                            '.theme-1 .qr-code-img {width: ' + getSize(230) + 'px;height: ' + getSize(230) + 'px;}',
                            '.avatar-in-qr-code {width: ' + getSize(50) + 'px; height: ' + getSize(50) + 'px; position:absolute;top: ' + getSize(90) + 'px;left: ' + getSize(90) + 'px;display:none;}',
                            '.info {position: absolute;left: ' + getSize(270) + 'px;top: ' + getSize(63) + 'px;}',
                            '.avatar img {border-radius: 50%;width: ' + getSize(80) + 'px;height: ' + getSize(80) + 'px;vertical-align: middle;}',
                            '.title {font-size: ' + getSize(36) + 'px;vertical-align: middle;margin-left: ' + getSize(/*15有头像的时候用15*/0) + 'px;color: #fff;{ell}}',
                            '.signature {line-height: 1.6em;font-size: ' + getSize(26) + 'px;max-width: 85%;margin-top: ' + getSize(16) + 'px;color: #fff;{wordBreak}}',
                            '.theme-1 .signature {color: #999;}',
                            '.theme-1 .title {color: #000;}'
                        ].join('')
                    },
                    12: {
                        width: 350,
                        height: 70,
                        accurateSize: 1,
                        defaultPosition: POSITION[7],
                        tpl: [
                            '<a class="wpa-container {theme}" data-event="callIm" name="' + defaultEventTagName + '">',
                                '<span style="z-index:9999;" class="icon-im" ></span>',
                                '<img class="avatar" src="{avatar}" />',
                                '<div class="chat-bubble">',
                                    '<span class="triangle-back"></span>',
                                    '<span class="triangle-front"></span>',
                                    '<span class="vm"></span>',
                                    '<p class="content">{signature}</p>',
                                '</div>',
                            '</a>'
                        ].join(''),
                        cssText: [
                            '* {{common}background: transparent;}',
                            '.wpa-container {z-index:1;display:block;cursor:pointer;width: 350px;height: 70px;position: relative;line-height: 70px;}',
                            '.avatar {width: 60px;height: 60px;border-radius: 50%;position: relative;top: 5px;left: 0;z-index:0;}',
                            '.icon-im {display: inline-block;width: 25px;height: 25px;position: absolute;left: 46px;top: 0;background-repeat:no-repeat;z-index:10;}',
                            '.chat-bubble {display:table-cell;vertical-align:middle;border-radius: 6px;border: 1px solid #dadee7;width: 270px;height: 63px;position: absolute;left:75px;top: 3px;font-size: 14px;color: #fff;white-space:nowrap;}',
                            //old style
                            // '.content {padding-left: 15px; padding-right: 12px;line-height: 20px;display: inline-block;vertical-align: middle;position: relative;top: -3px;}',
                            '.vm {display:inline-block;vertical-align:middle;}',
                            '.content {max-width:240px;padding-left: 15px; white-space: normal;padding-right: 12px;line-height: 20px;display: inline-block;vertical-align: middle;position: relative;top: -3px;}',
                            '.theme-1 .chat-bubble {background: #fff;color: #1e2330;}',
                            '.theme-2 .chat-bubble {background: ' + COLORS[2] + ';border-color: ' + COLORS[2] + ';}',
                            '.theme-3 .chat-bubble {background: ' + COLORS[3] + ';border-color: ' + COLORS[3] + ';}',
                            '.theme-4 .chat-bubble {background: ' + COLORS[4] + ';border-color: ' + COLORS[4] + ';}',
                            '.theme-5 .chat-bubble {background: ' + COLORS[5] + ';border-color: ' + COLORS[5] + ';}',
                            '.theme-6 .chat-bubble {background: ' + COLORS[6] + ';border-color: ' + COLORS[6] + ';}',
                            '.triangle-back {display: inline-block;width: 0;height: 0;border: 8px solid transparent;position: absolute;left: -16px;top: 24px;z-index: 10;}',
                            '.triangle-front {display: none;width: 0;height: 0;border: 8px solid transparent;position: absolute;left: -14px;top: 24px;z-index: 11;}',
                            '.theme-1 .triangle-back {border-right-color: #dadee7;}',
                            '.theme-1 .triangle-front {border-right-color: #fff;display: inline-block;}',
                            '.theme-2 .triangle-back {border-right-color: ' + COLORS[2] + ';}',
                            '.theme-3 .triangle-back {border-right-color: ' + COLORS[3] + ';}',
                            '.theme-4 .triangle-back {border-right-color: ' + COLORS[4] + ';}',
                            '.theme-5 .triangle-back {border-right-color: ' + COLORS[5] + ';}',
                            '.theme-6 .triangle-back {border-right-color: ' + COLORS[6] + ';}',
                            '.theme-1 .icon-im {background-image:url(' + imageBaseUrl + '/im-bubble-pc-theme2.png);}',
                            '.theme-2 .icon-im {background-image:url(' + imageBaseUrl + '/im-bubble-pc-theme2.png);}',
                            '.theme-3 .icon-im {background-image:url(' + imageBaseUrl + '/im-bubble-pc-theme3.png);}',
                            '.theme-4 .icon-im {background-image:url(' + imageBaseUrl + '/im-bubble-pc-theme4.png);}',
                            '.theme-5 .icon-im {background-image:url(' + imageBaseUrl + '/im-bubble-pc-theme5.png);}',
                            '.theme-6 .icon-im {background-image:url(' + imageBaseUrl + '/im-bubble-pc-theme6.png);}'
                        ].join('')
                    },
                    13: {
                        width: 106,
                        height:140,
                        accurateSize: 1,
                        defaultPosition: POSITION[6],
                        tpl: [
                            '<a class="wpa-container {theme}" data-event="callIm" name="' + defaultEventTagName + '">',
                                '<img src="{avatar}" class="avatar" />',
                                '<span style="z-index:9999;" class="icon-im"></span>',
                                '<p class="signature">{signature}</p>',
                            '</a>'
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {display:block;cursor:pointer;width: 104px;height: 138px;position: relative;text-align: center;font-size: 14px;color: #1e2330;border: 1px solid #dadee7;border-radius: 4px;background: #fff;}',
                            '.avatar {width: 80px;height: 80px;border-radius: 50%;display: inline-block;position:absolute;left:12px;top: 16px;z-index:0;}',
                            '.signature {position: relative;top:109px;}',
                            '.icon-im {display: inline-block;width: 25px;height: 25px;background-repeat: no-repeat;position: absolute;top: 14px;right: 4px;z-index: 10;}',
                            '.theme-2 .icon-im {background-image:url(' + imageBaseUrl + '/im-bubble-pc-theme2.png);}',
                            '.theme-3 .icon-im {background-image:url(' + imageBaseUrl + '/im-bubble-pc-theme3.png);}',
                            '.theme-4 .icon-im {background-image:url(' + imageBaseUrl + '/im-bubble-pc-theme4.png);}',
                            '.theme-5 .icon-im {background-image:url(' + imageBaseUrl + '/im-bubble-pc-theme5.png);}',
                            '.theme-6 .icon-im {background-image:url(' + imageBaseUrl + '/im-bubble-pc-theme6.png);}'
                        ].join('')
                    },
                    14: {
                        width: 80,
                        height:160,
                        accurateSize: 1,
                        defaultPosition: POSITION[6],
                        tpl: [
                            '<div class="wpa-container {theme}">',
                                '<a class="btn-qq btn" data-event="callChat" name="' + defaultEventTagName + '">',
                                    '<span class="icon-qq btn-icon"></span><br/>',
                                    '<span class="btn-text">QQ</span>',
                                '</a>',
                                '<span class="spliter"></span>',
                                '<a class="btn-im btn" data-event="callIm" name="' + defaultEventTagName + '">',
                                    '<span class="icon-im btn-icon"></span><br/>',
                                    '<span class="btn-text">咨询</span>',
                                '</a>',
                            '</div>'                      
                        ].join(''),
                        cssText: [
                            '* {{common}}',
                            '.wpa-container {width: 80px;height: 160px;position: relative;text-align: center;font-size: 16px;color: #fff;border-top-left-radius: 4px;border-bottom-left-radius: 4px;}',
                            '.theme-2 {background: ' + COLORS[2] + ';}',
                            '.theme-3 {background: ' + COLORS[3] + ';}',
                            '.theme-4 {background: ' + COLORS[4] + ';}',
                            '.theme-5 {background: ' + COLORS[5] + ';}',
                            '.theme-6 {background: ' + COLORS[6] + ';}',
                            '.btn {display:block;text-align: center;position: relative;width: 100%;height: 80px;top: 17px;cursor: pointer;}',
                            '.spliter {display: inline-block;width: 100%;height: 1px;background: #fff;position: absolute;top: 50%;left: 0;}',
                            '.icon-qq {display: inline-block;width: 22px;height: 26px;background: url(' + imageBaseUrl + '/icon-qq-white-small.png) no-repeat;}',
                            '.icon-im {display: inline-block;width: 25px;height: 25px;background: url(' + imageBaseUrl + '/im-bubble-pc-white.png) no-repeat;}'
                        ].join('')
                    }
                }
            };
        },
        get: function(cate, type) {
            return tmpls[cate][type];
        },
        defaultEventTagName: defaultEventTagName
    };
});
/** src/util/domEvent.js **/
LBF.define('wpa.util.domEvent', function(require, exports){

    /**
     * Bind event to node
     * @public
     * @param {HTMLElement} node The node to be bound
     * @param {string} type The event type
     * @param {function} event Event's handler
     * @return {HTMLElement} The node itself
     */
    exports.addEvent = window.addEventListener ? function(node, type, event){
            node.addEventListener(type, event);
            return node;
        } : function(node, type, event){
            node.attachEvent('on' + type, event);
            return node;
        };

    /**
     * Unbind event from node
     * @param {HTMLElement} node The node to be unbound
     * @param {string} type The event type
     * @param {function} event Event's handler
     * @return {HTMLElement} The node itself
     */
    exports.removeEvent = window.removeEventListener ? function(node, type, event){
            node.removeEventListener(type, event);
            return node;
        } : function(node, type, event){
            node.detachEvent('on' + type, event);
            return node;
        };
});
/** src/conf/defaultConst.js **/
/*
 * wpa一些字段的默认值
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/27
 *
 */
LBF.define('wpa.conf.defaultConst', function(require, exports, module) {

	var config = require('wpa.conf.config');
	
	module.exports = {

		THEME: 1,

		TITLE: ['', '在线咨询', '免费电话', '关注', '加群', '好友', '', '网页咨询'],

		SIGNATURE: ['', '在线咨询', '免费电话', '关注', '加群', '好友', '', '网页咨询'],

		BTN_TEXT: ['', '在线咨询', '免费电话', '关注', 'QQ群', '好友', '', '网页咨询'],

		BTN_COLOR: '#12b7f5',

		//默认位置常量
		POSITION: {
			//位置示意图
			/******************
	        	1 	2 	3
	        	4 	5 	6
	        	7 	8 	9
			*******************/
			1: 1,
			2: 2,
			3: 3,
			4: 4,
			5: 5,
			6: 6,
			7: 7,
			8: 8,
			9: 9
		},

		defaultEventTagName: 'e'
	};

});
/** src/util/getSize.js **/
/*
 * 根据参数的ratio来计算实际的尺寸
 * 不能直接取window.devicePixelRatio是因为在pc上要模拟移动端的比例
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/05/26
 */
LBF.define('wpa.util.getSize', function(require, exports, module) {
	module.exports = exports = function(ratio) {
		return function(size) {
			if (typeof size !== 'number') {
				return size;
			}
			var r = Math.ceil(size / 2);
			return r;
		}
	};
});

/** src/util/bindLogicEvents.js **/
/*
 * WPA事件绑定
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/21
 *
 */
LBF.define('wpa.util.bindLogicEvents', function(require, exports, module) {

	var Events = require('wpa.conf.Events'),
		proxy = require('lang.proxy'),
		domEvent = require('wpa.util.domEvent');
	
	module.exports = function(eventNodes, context) {

		//如果传入的dom节点为空，则返回
		if (!eventNodes.length) {
			return;
		}

		for (var i = 0, len = eventNodes.length; i < len; i++) {
			var eventNode = eventNodes[i];
			var dataEventAttr = eventNode.attributes["data-event"].nodeValue;
			var dataEvent = dataEventAttr.split(';');
			var apiName = dataEvent[0];
			var type = dataEvent[1] || Events.defaultEventType;
			var api = proxy(context[apiName], context);

			if (api) {
				domEvent.addEvent(eventNode, type, api);
			}
		}
	};

});
/** src/util/htReport.js **/
/**
 * 华佗测速上报接口
 * @author: vergilzhou
 * @version: 4.1.0
 * @date: 2017/10/20
 */
LBF.define('wpa.util.htReport', function(require, exports, module) {

	var conf = require('wpa.conf.config'),
		BROWSER_ENV = conf.BROWSER_ENV,
		isIOS = BROWSER_ENV.isIOS,
		isAndroid = BROWSER_ENV.isAndroid;

	var flags = {
			iconInit: 31,
			customDOMInit: 32,
			customImgInit: 33
		},
		platform = 'pc';

	//speed report
    var flag1 = 21848,
        flag2 = 1,
        flag3 = 1,
        reportCgi = 'https://report.huatuo.qq.com/report.cgi';

	if (isIOS) {
		platform = 'ios';
	} else if (isAndroid) {
		platform = 'android';
	}

	module.exports = exports = function(sTime, flag) {

		var eTime = +new Date(),
			timeCost = eTime - sTime,
        	r = new Image(),
            params = 'flag1=' + flag1 + '&flag2=' + flag2 + '&flag3=' + flag3 + '&' + flag + '=' + timeCost;
        r.src = reportCgi + '?platform=' + platform + '&appid=20282&speedparams=' + encodeURIComponent(params);

	};

});
/** lib/lbf/lang/trim.js **/
/**
 * Created by amos on 14-8-18.
 */
LBF.define('lang.trim', function(require, exports, module){
    var trimReg = /(^[\s\xA0]+)|([\s\xA0]+$)/g;

    /**
     * Trim blanks
     * @class trim
     * @namespace lang
     * @module lang
     * @constructor
     * @param {String} text
     * @return {String}
     */
    module.exports = String.prototype.trim ?
        function( text ) {
            return String.prototype.trim.call( text || '' );
        } :

        // Otherwise use our own trimming functionality
        function( text ) {
            return ( text || '' ).toString().replace( trimReg, '' );
        };
});
/** lib/lbf/util/jsonp.js **/
/**
 * @fileOverview
 * @author amoschen
 * @version
 * Created: 12-8-4 下午3:58
 */

//maintained by vergil since 2017/02/01
//this module is only used for qidian's wpa
//do not use this module in other project
LBF.define('util.jsonp', function(require, exports, module){
    var request = require('util.request'),
        serialize = require('util.serialize'),
        dateTool = require('lang.dateTool');

    var cid = 0;

    var CGI_TIMEOUT = 1000 * 5,
        TIMEOUT = CGI_TIMEOUT + 1000 * 2,
        setTimeoutObj = {},
        hasQDWPABUS;

    module.exports = function(url, options, cb, charset){

        var cbName = options.cb || 'JSONP_CB_' + ++cid,
            script;

        cbName += '_' + (+new Date()) + '_' + Math.round(Math.random() * 1000);
        options.cb = options.callback = cbName;

        hasQDWPABUS = window.__QDWPABUS ? true : false;

        url += url.indexOf('?') === -1 ? '?' : '&';
        url += serialize(options);

        (function(cbName) {

            if (hasQDWPABUS) {
                setTimeoutObj[cbName] = setTimeout(function() {
                    var date = dateTool.format('Y-m-d H:i:s', new Date()),
                        e = new Error('[CGI NOT REACHED ERROR][' + date + ']cgi: ' + url);
                    __QDWPABUS.trigger('error', e);
                }, TIMEOUT);
            }

            window[cbName] = function(json){

                clearTimeout(setTimeoutObj[cbName]);

                cb(json);

                setTimeout(function(){
                    // set window.cbName when inside JSONP callback will cause error
                    window[cbName] = null;

                    // clean up script tag
                    if (script.parentNode) {
                        script.parentNode.removeChild(script);
                    }
                }, 1);
            };

            return script = request(url, noop, charset);

        })(cbName);
        
    };

    function noop(){}
});
/** src/conf/chat.js **/
/*
 * chat事件相关常量
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/21
 *
 */
LBF.define('wpa.conf.chat', function (require, exports, module) {
    var globalSettings = require('globalSettings'),
        apiBase = globalSettings.apiBase;

    //env is undefined
    //so use apiBase to determine env instead
    var env = '';
    if (apiBase.indexOf('dev') !== -1) {
        env = 'dev';
    } else if (apiBase.indexOf('oa') !== -1) {
        env = 'oa';
    }
    var host = 'https://{env}admin.qidian.qq.com'.replace('{env}', env);

    return {
        CHAT_TYPE_AUTO: 1,
        CHAT_TYPE_ANONYMOUS: 2,
        CHAT_TYPE_QQ: 3,

        PC_QQ_SCHEMA_CGI: apiBase + '/wpaInfo/TS',
        WPL_B_QQ_COM_CONV: apiBase + '/wpaInfo/numberInfo',
        MQQWPA: 'mqqwpa://im/chat',
        // as open webchat & info page with new window,
        // only http supported
        WPD_B_QQ_COM_INFO: 'http://wpd.b.qq.com/page/info.php',
        WPD_B_QQ_COM_WEBCHAT: 'http://wpd.b.qq.com/page/webchat.html',
        // link chat use http only
        // https has problem in call tecent protocol
        LINK_CHAT: apiBase.replace('https:', 'http:') + '/wpaCall/sslCall',

        //呼起手q的中间页
        // LAUNCH_MOBILE_QQ: host + '/template/blue/wpa/launch-mobile-qq.html',
        LAUNCH_MOBILE_QQ: host + '/template/blue/wpa/link.html',

        //2017/08/11
        //能自动打开webim的呼起QQ中间页
        //移动端wpa和pc链接型wpa专用
        //目前只有cate=1的qq接待类型wpa才用这个页面

        //2019/07/13
        //移动端和PC端wpa新增跳转中转页开关
        //图标型和DOM型wpa都会使用这个页面
        LAUNCH_LINK: host + '/template/blue/wpa/link.html'
    };

});

/** src/util/offset.js **/
LBF.define('wpa.util.offset', function(require, exports){
    // var doc = document,
    var conf = require('wpa.conf.config'),
        win = conf.gWin,
        doc = win.document,
        isStandardMode = doc.compatMode === "CSS1Compat",
        docElem = doc.documentElement,
        body = doc.body;
     
    /**
     * 获取对象getScrollTop值
     */
    exports.getScrollTop = function(){
        return Math.max(docElem.scrollTop, body.scrollTop);
    };

    /**
     * 获取对象的可视区域高度
     */
    exports.getClientWidth = isStandardMode ? 
        function(){
            return docElem.clientWidth;
        } : 
        function(){
            return body.clientWidth;
        };

    /**
     * 获取对象的可视区域高度
     */
    exports.getClientHeight = isStandardMode ? 
        function(){
            return docElem.clientHeight;
        } : 
        function(){
            return body.clientHeight;
        };

    exports.getNewScrollTop = function() {
        var top = doc.documentElement.scrollTop || win.pageYOffset || doc.body.scrollTop;
        return top;
    };
});
/** src/conf/report.js **/
/*
 * 数据上报功能常量
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2014/08/25
 *
 */
LBF.define('wpa.conf.report', function(require, exports, module) {

	var reportBase = require('globalSettings').apiBase + '/wpaReport';

	module.exports = {

		render: reportBase + '/track',

		click: reportBase + '/click'

	};

});
/** lib/lbf/lang/JSON.js **/
/**
 * @fileOverview
 * @author amoschen
 * @version 1
 * Created: 13-3-1 下午8:35
 */

/**
 * Standard JSON methods like parse, stringify. See <a target="_blank" href="http://www.JSON.org/js.html">JSON</a>
 * @class JSON
 * @module lang
 * @namespace lang
 */

/** @ignore */
LBF.define('lang.JSON', function(){
    /*
     json2.js
     2012-10-08

     Public Domain.

     NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

     See http://www.JSON.org/js.html


     This code should be minified before deployment.
     See http://javascript.crockford.com/jsmin.html

     USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
     NOT CONTROL.


     This file creates a global JSON object containing two methods: stringify
     and parse.

     JSON.stringify(value, replacer, space)
     value       any JavaScript value, usually an object or array.

     replacer    an optional parameter that determines how object
     values are stringified for objects. It can be a
     function or an array of strings.

     space       an optional parameter that specifies the indentation
     of nested structures. If it is omitted, the text will
     be packed without extra whitespace. If it is a number,
     it will specify the number of spaces to indent at each
     level. If it is a string (such as '\t' or '&nbsp;'),
     it contains the characters used to indent at each level.

     This method produces a JSON text from a JavaScript value.

     When an object value is found, if the object contains a toJSON
     method, its toJSON method will be called and the result will be
     stringified. A toJSON method does not serialize: it returns the
     value represented by the name/value pair that should be serialized,
     or undefined if nothing should be serialized. The toJSON method
     will be passed the key associated with the value, and this will be
     bound to the value

     For example, this would serialize Dates as ISO strings.

     Date.prototype.toJSON = function (key) {
     function f(n) {
     // Format integers to have at least two digits.
     return n < 10 ? '0' + n : n;
     }

     return this.getUTCFullYear()   + '-' +
     f(this.getUTCMonth() + 1) + '-' +
     f(this.getUTCDate())      + 'T' +
     f(this.getUTCHours())     + ':' +
     f(this.getUTCMinutes())   + ':' +
     f(this.getUTCSeconds())   + 'Z';
     };

     You can provide an optional replacer method. It will be passed the
     key and value of each member, with this bound to the containing
     object. The value that is returned from your method will be
     serialized. If your method returns undefined, then the member will
     be excluded from the serialization.

     If the replacer parameter is an array of strings, then it will be
     used to select the members to be serialized. It filters the results
     such that only members with keys listed in the replacer array are
     stringified.

     Values that do not have JSON representations, such as undefined or
     functions, will not be serialized. Such values in objects will be
     dropped; in arrays they will be replaced with null. You can use
     a replacer function to replace those with JSON values.
     JSON.stringify(undefined) returns undefined.

     The optional space parameter produces a stringification of the
     value that is filled with line breaks and indentation to make it
     easier to read.

     If the space parameter is a non-empty string, then that string will
     be used for indentation. If the space parameter is a number, then
     the indentation will be that many spaces.

     Example:

     text = JSON.stringify(['e', {pluribus: 'unum'}]);
     // text is '["e",{"pluribus":"unum"}]'


     text = JSON.stringify(['e', {pluribus: 'unum'}], null, '\t');
     // text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

     text = JSON.stringify([new Date()], function (key, value) {
     return this[key] instanceof Date ?
     'Date(' + this[key] + ')' : value;
     });
     // text is '["Date(---current time---)"]'


     JSON.parse(text, reviver)
     This method parses a JSON text to produce an object or array.
     It can throw a SyntaxError exception.

     The optional reviver parameter is a function that can filter and
     transform the results. It receives each of the keys and values,
     and its return value is used instead of the original value.
     If it returns what it received, then the structure is not modified.
     If it returns undefined then the member is deleted.

     Example:

     // Parse the text. Values that look like ISO date strings will
     // be converted to Date objects.

     myData = JSON.parse(text, function (key, value) {
     var a;
     if (typeof value === 'string') {
     a =
     /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
     if (a) {
     return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
     +a[5], +a[6]));
     }
     }
     return value;
     });

     myData = JSON.parse('["Date(09/09/2001)"]', function (key, value) {
     var d;
     if (typeof value === 'string' &&
     value.slice(0, 5) === 'Date(' &&
     value.slice(-1) === ')') {
     d = new Date(value.slice(5, -1));
     if (d) {
     return d;
     }
     }
     return value;
     });


     This is a reference implementation. You are free to copy, modify, or
     redistribute.
     */

    /*jslint evil: true, regexp: true */

    /*members "", "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
     call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
     getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
     lastIndex, length, parse, prototype, push, replace, slice, stringify,
     test, toJSON, toString, valueOf
     */


// Create a JSON object only if one does not already exist. We create the
// methods in a closure to avoid creating global variables.

    if (typeof JSON !== 'object') {
        JSON = {};
    }

    (function () {
        'use strict';

        function f(n) {
            // Format integers to have at least two digits.
            return n < 10 ? '0' + n : n;
        }

        if (typeof Date.prototype.toJSON !== 'function') {

            Date.prototype.toJSON = function (key) {

                return isFinite(this.valueOf())
                    ? this.getUTCFullYear()     + '-' +
                    f(this.getUTCMonth() + 1) + '-' +
                    f(this.getUTCDate())      + 'T' +
                    f(this.getUTCHours())     + ':' +
                    f(this.getUTCMinutes())   + ':' +
                    f(this.getUTCSeconds())   + 'Z'
                    : null;
            };

            String.prototype.toJSON      =
                Number.prototype.toJSON  =
                    Boolean.prototype.toJSON = function (key) {
                        return this.valueOf();
                    };
        }

        var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
            escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
            gap,
            indent,
            meta = {    // table of character substitutions
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"' : '\\"',
                '\\': '\\\\'
            },
            rep;


        function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

            escapable.lastIndex = 0;
            return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
                var c = meta[a];
                return typeof c === 'string'
                    ? c
                    : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' : '"' + string + '"';
        }


        function str(key, holder) {

// Produce a string from holder[key].

            var i,          // The loop counter.
                k,          // The member key.
                v,          // The member value.
                length,
                mind = gap,
                partial,
                value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

            if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
                value = value.toJSON(key);
            }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

            if (typeof rep === 'function') {
                value = rep.call(holder, key, value);
            }

// What happens next depends on the value's type.

            switch (typeof value) {
                case 'string':
                    return quote(value);

                case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

                    return isFinite(value) ? String(value) : 'null';

                case 'boolean':
                case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

                    return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

                case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

                    if (!value) {
                        return 'null';
                    }

// Make an array to hold the partial results of stringifying this object value.

                    gap += indent;
                    partial = [];

// Is the value an array?

                    if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                        length = value.length;
                        for (i = 0; i < length; i += 1) {
                            partial[i] = str(i, value) || 'null';
                        }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

                        v = partial.length === 0
                            ? '[]'
                            : gap
                            ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
                            : '[' + partial.join(',') + ']';
                        gap = mind;
                        return v;
                    }

// If the replacer is an array, use it to select the members to be stringified.

                    if (rep && typeof rep === 'object') {
                        length = rep.length;
                        for (i = 0; i < length; i += 1) {
                            if (typeof rep[i] === 'string') {
                                k = rep[i];
                                v = str(k, value);
                                if (v) {
                                    partial.push(quote(k) + (gap ? ': ' : ':') + v);
                                }
                            }
                        }
                    } else {

// Otherwise, iterate through all of the keys in the object.

                        for (k in value) {
                            if (Object.prototype.hasOwnProperty.call(value, k)) {
                                v = str(k, value);
                                if (v) {
                                    partial.push(quote(k) + (gap ? ': ' : ':') + v);
                                }
                            }
                        }
                    }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

                    v = partial.length === 0
                        ? '{}'
                        : gap
                        ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
                        : '{' + partial.join(',') + '}';
                    gap = mind;
                    return v;
            }
        }

// If the JSON object does not yet have a stringify method, give it one.

        if (typeof JSON.stringify !== 'function') {
            JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

                var i;
                gap = '';
                indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

                if (typeof space === 'number') {
                    for (i = 0; i < space; i += 1) {
                        indent += ' ';
                    }

// If the space parameter is a string, it will be used as the indent string.

                } else if (typeof space === 'string') {
                    indent = space;
                }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

                rep = replacer;
                if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                        typeof replacer.length !== 'number')) {
                    throw new Error('JSON.stringify');
                }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

                return str('', {'': value});
            };
        }


// If the JSON object does not yet have a parse method, give it one.

        if (typeof JSON.parse !== 'function') {
            JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

                var j;

                function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

                    var k, v, value = holder[key];
                    if (value && typeof value === 'object') {
                        for (k in value) {
                            if (Object.prototype.hasOwnProperty.call(value, k)) {
                                v = walk(value, k);
                                if (v !== undefined) {
                                    value[k] = v;
                                } else {
                                    delete value[k];
                                }
                            }
                        }
                    }
                    return reviver.call(holder, key, value);
                }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

                text = String(text);
                cx.lastIndex = 0;
                if (cx.test(text)) {
                    text = text.replace(cx, function (a) {
                        return '\\u' +
                            ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                    });
                }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with '()' and 'new'
// because they can cause invocation, and '=' because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

                if (/^[\],:{}\s]*$/
                    .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                    .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                    .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                    j = eval('(' + text + ')');

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

                    return typeof reviver === 'function'
                        ? walk({'': j}, '')
                        : j;
                }

// If the text is not JSON parseable, then a SyntaxError is thrown.

                throw new SyntaxError('JSON.parse');
            };
        }
    }());

    return JSON;
});
/** src/util/removeCustomProperty.js **/
/**
 * 有些用户的js修改了prototype导致jsonp的url过长
 * 该js是屏蔽特定的prototype属性
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2017/03/31
 *
 */
LBF.define('wpa.util.removeCustomProperty', function(require, exports, module) {

	//需要移除的自定义属性
	var props = ["toJSONString"];

	var removeCustomProperty = function(obj) {

		for (var i = 0, len = props.length; i < len; i++) {
			var p = props[i];
			obj[p] = null;
		}
	};

	module.exports = exports = removeCustomProperty;

});
/** src/util/formReport.js **/
LBF.define('wpa.util.formReport', function(require, exports, module) {

	var //data,
		form,
		fixedFormId = '__post_form',
		fixedIframeName = '__post_iframe',
		_formId,
		_iframeName,
		isIE = !!(window.ActiveXObject || window.msIsStaticHTML),
		cid = 1,
		iframe,
		_formList = window._formList = [],
		_iframeList = window._iframeList = [];


	var cb = function() {
		//原来通过函数参数传入form和iframe的方式
		//在页面存在多个的时候
		//有时候能完全移除，有时候不行
		//改为队列实现
		setTimeout(function() {

			var form = _formList.shift(),
				iframe = _iframeList.shift();
		
			try {
				if (form) {
					document.body.removeChild(form);
				}

				if (iframe) {
					document.body.removeChild(iframe);
				}
			} catch (e) {
				//form and iframe are removed already here
			}
		 }, 1000);
	};

	var preSend = function(form, iframe, data) {

		var inputEle,
			docFragment = document.createDocumentFragment();
		try {//ie
			for (var i in data) {
				inputEle = document.createElement('<input name="' + i + '"/>');
				inputEle.value = data[i];
				inputEle.type = 'hidden';
				docFragment.appendChild(inputEle);
			}
		} catch (e) {//none ie
			for (var i in data) {
				inputEle = document.createElement('input');
				inputEle.type = 'hidden';
				inputEle.name = i;
				inputEle.value = data[i];
				docFragment.appendChild(inputEle);
			}
		}

		form.appendChild(docFragment);
        form.submit();

        
    	cb();
       
	};

	module.exports = exports = function(options) {

		if (!options.action) {
			return;
		}

		_formId = fixedFormId + cid;
		_iframeName = fixedIframeName + cid;
		cid++;
	
		var cForm = document.getElementById(_formId),
			cIframe = document.getElementById(_iframeName);

		var action = options.action;
		var data = options.data || {};

		try {//ie
			form = document.createElement('<form id="' + _formId + '" method="post" action="' + action + '" target="' + _iframeName + '"></form>');
			iframe = document.createElement('<iframe name="' + _iframeName + '" id="' + _iframeName + '" src="javascript:false;"></iframe>');
		} catch (e) {//none ie
			form = document.createElement('form');
			form.id = _formId;
			form.method = 'post';
			form.action = action;
			form.target = _iframeName;
			iframe = document.createElement('iframe');
			iframe.name = _iframeName;
			iframe.id = _iframeName;
		}

		iframe.style.cssText = 'width:1px;height:0;display:none;';

		document.body.appendChild(iframe);
		document.body.appendChild(form);

		//此push不能放在setTimeout里
		_formList.push(form);
        _iframeList.push(iframe);

		// setTimeout(function() {
			// console.log(form);
			//奇怪的问题：这里如果用setTimeout的话
			//同一页面极短时间内的多次上报
			//会导致每一次的data被放到同一个data里
			//除了最后一次的请求上报外
			//前面的请求都会被cancel掉
			//去掉setTimeout，或者在preSend前加一个console却能终止这种现象
			//原因不明
			preSend(form, iframe, data);
		// }, 10);
	};
});
/** src/proto/getCPType.js **/
/*
 * 获取wpa的类型
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2016/09/14
 *
 */
LBF.define('wpa.proto.getCPType', function(require, exports, module) {
	//根据数据来获得上报类型
	var	CPTTP_NONE = 0,
		CPTTP_CORPWPA = 1,   //企业WPA
		CPTTP_STAFFWPA = 2,  //员工WPA
		CPTTP_FREETEL = 3,   //免费电话
		CPTTP_JOINGROUP = 4,  //加群
		CPTTP_ADDFRIEND = 5,   //加好友
		CPTTP_WXMANUAL = 6,   //WX公众号人工客服
		CPTTP_CHAT = 7,   //会话
		CPTTP_ADDATTENT = 8,   //加关注
		CPTTP_IM = 9;	//web im

	module.exports = exports = function(params) {

		var temp,
			result = CPTTP_NONE;//默认值

		//对于复合型接触点，同时有qq和电话的
		//以在uiEvents里强制添加的tp_tptype为准
		if (typeof params._tptype !== 'undefined') {
			return {
				tptype: params._tptype
			};
		}

		if (temp = params.roleQQ) {//会话
			//接触点存在会话和来电共存的类型
			//会话优先级高，所以只报会话
			result = temp.value ? CPTTP_CORPWPA : CPTTP_STAFFWPA;
		} else if (params.roleTEL) {//来电
			result = CPTTP_FREETEL;
		} else if (params.roleKFEXT) {//加好友
			result = CPTTP_ADDFRIEND;
		} else if (params.roleGROUP) {//加群
			result = CPTTP_JOINGROUP;
		} else if (params.rolePUB) {//加关注
			result = CPTTP_ADDATTENT;
		} else if (params.roleIM) {//IM
			result = CPTTP_IM;
		}

		return {
			tptype: result
		};
	};
});
/** src/protocol/getQQVersion.js **/
/**
 * get QQ version
 * User: amoschen
 * Date: 13-1-7
 * Time: 下午4:05
 * To change this template use File | Settings | File Templates.
 */
LBF.define('wpa.protocol.getQQVersion', 'globalSettings,lang.browser,util.events', function(require){
    var globalSettings = require('globalSettings'),
        browser = require('lang.browser'),
        events = require('wpa.util.domEvent');

    // for cache
    // version = null means can't get version
    var version;

    return function(callback){
        if(typeof version !== 'undefined'){
            callback(version);
            return;
        }

        // for IE, invoke activeX
        if(browser.msie){
            try{
                var xmlhttp = new ActiveXObject("TimwpDll.TimwpCheck");
                version = xmlhttp.GetHummerQQVersion();
            } catch(e){
                version = null;
            }

            callback(version);
            return;
        }

        //for webkit and firefox
        if(browser.mozilla || browser.webkit){
            // browser plugin is limited in qq.com domain
            // so load embed tag in a iframe to break through
            var body = document.getElementsByTagName('body')[0],
                iframe = document.createElement('iframe'),
                proxyPage = globalSettings.base + '/protocol/getQQVersion.html';

            iframe.style.display = 'none';
            events.addEvent(window, 'message', function(event){
                if(/https?:\/\/combo\.b\.qq\.com/.test(event.origin)){
                    return;
                }

                version = event.data;
                callback(version);
                events.removeEvent(window, 'message', arguments.callee);
                iframe.parentNode.removeChild(iframe);
            });

            iframe.src = proxyPage;
            body.insertBefore(iframe, body.firstChild);

            return;
        }

        version = null;
        callback(version);
    };
});
/** src/proto/chatSelect.js **/
LBF.define('wpa.proto.chatSelect', function(require, exports, module){
    var Style = require('wpa.util.Style'),
        domEvent = require('wpa.util.domEvent'),
        offset = require('wpa.util.offset'),
        browser = require('lang.browser'),
        css = require('wpa.util.css'),
        proxy = require('lang.proxy'),
        extend = require('lang.extend');

    var NODE_TYPE_ELEMENT = 1;

    var doc = document,
        isQuirk = doc.compatMode === 'BackCompat';
        noPosFix = browser.msie && browser.majorVersion < 7 || isQuirk;

    /**
     * Default settings
     * @type {Object}
     */
    var SETTINGS = {
        // container where panel to be contained
        container: doc.getElementsByTagName('body')[0],

        // template of panel
        template: [
            '<div class="WPA3-SELECT-PANEL">',
                '<div class="WPA3-SELECT-PANEL-TOP">',
                    '<a id="WPA3-SELECT-PANEL-CLOSE" href="javascript:;" class="WPA3-SELECT-PANEL-CLOSE"></a>',
                '</div>',
                '<div class="WPA3-SELECT-PANEL-MAIN">',
                    '<p class="WPA3-SELECT-PANEL-GUIDE">请选择发起聊天的方式：</p>',
                    '<div class="WPA3-SELECT-PANEL-SELECTS">',
                        '<a id="WPA3-SELECT-PANEL-AIO-CHAT" href="javascript:;" class="WPA3-SELECT-PANEL-CHAT WPA3-SELECT-PANEL-AIO-CHAT">',
                            '<span class="WPA3-SELECT-PANEL-QQ WPA3-SELECT-PANEL-QQ-AIO"></span>',
                            '<span class="WPA3-SELECT-PANEL-LABEL">QQ帐号聊天</span>',
                        '</a>',
                        /*'<a id="WPA3-SELECT-PANEL-ANONY-CHAT" href="javascript:;" class="WPA3-SELECT-PANEL-CHAT WPA3-SELECT-PANEL-ANONY-CHAT">',
                            '<span class="WPA3-SELECT-PANEL-QQ WPA3-SELECT-PANEL-QQ-ANONY"></span>',
                            '<span class="WPA3-SELECT-PANEL-LABEL">匿名聊天</span>',
                        '</a>',*/
                    '</div>',
                '</div>',
                '<div class="WPA3-SELECT-PANEL-BOTTOM">',
                    '<a target="_blank" href="http://im.qq.com" class="WPA3-SELECT-PANEL-INSTALL">安装QQ</a>',
                '</div>',
            '</div>'
        ].join(''),

        // panel's style
        cssText: [
            '.WPA3-SELECT-PANEL { z-index:2147483647; width:463px; height:292px; margin:0; padding:0; border:1px solid #d4d4d4; background-color:#fff; border-radius:5px; box-shadow:0 0 15px #d4d4d4;}',
            // css reset
            '.WPA3-SELECT-PANEL * { position:static; z-index:auto; top:auto; left:auto; right:auto; bottom:auto; width:auto; height:auto; max-height:auto; max-width:auto; min-height:0; min-width:0; margin:0; padding:0; border:0; clear:none; clip:auto; background:transparent; color:#333; cursor:auto; direction:ltr; filter:; float:none; font:normal normal normal 12px "Helvetica Neue", Arial, sans-serif; line-height:16px; letter-spacing:normal; list-style:none; marks:none; overflow:visible; page:auto; quotes:none; -o-set-link-source:none; size:auto; text-align:left; text-decoration:none; text-indent:0; text-overflow:clip; text-shadow:none; text-transform:none; vertical-align:baseline; visibility:visible; white-space:normal; word-spacing:normal; word-wrap:normal; -webkit-box-shadow:none; -moz-box-shadow:none; -ms-box-shadow:none; -o-box-shadow:none; box-shadow:none; -webkit-border-radius:0; -moz-border-radius:0; -ms-border-radius:0; -o-border-radius:0; border-radius:0; -webkit-opacity:1; -moz-opacity:1; -ms-opacity:1; -o-opacity:1; opacity:1; -webkit-outline:0; -moz-outline:0; -ms-outline:0; -o-outline:0; outline:0; -webkit-text-size-adjust:none; font-family:Microsoft YaHei,Simsun;}',
            '.WPA3-SELECT-PANEL a { cursor:auto;}',
            // panel top
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-TOP { height:25px;}',
            // close button
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-CLOSE { float:right; display:block; width:47px; height:25px; background:url(http://combo.b.qq.com/crm/wpa/release/3.3/wpa/views/SelectPanel-sprites.png) no-repeat;}',
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-CLOSE:hover { background-position:0 -25px;}',
            // panel main
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-MAIN { padding:23px 20px 45px;}',
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-GUIDE { margin-bottom:42px; font-family:"Microsoft Yahei"; font-size:16px;}',
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-SELECTS { width:246px; height:111px; margin:0 auto;}',
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-CHAT { float:right; display:block; width:88px; height:111px; background:url(http://combo.b.qq.com/crm/wpa/release/3.3/wpa/views/SelectPanel-sprites.png) no-repeat 0 -80px;}',
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-CHAT:hover { background-position:-88px -80px;}',
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-AIO-CHAT { float:left;}',
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-QQ { display:block; width:76px; height:76px; margin:6px; background:url(http://combo.b.qq.com/crm/wpa/release/3.3/wpa/views/SelectPanel-sprites.png) no-repeat -50px 0;}',
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-QQ-ANONY { background-position:-130px 0;}',
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-LABEL { display:block; padding-top:10px; color:#00a2e6; text-align:center;}',
            // panel bottom
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-BOTTOM { padding:0 20px; text-align:right;}',
            '.WPA3-SELECT-PANEL .WPA3-SELECT-PANEL-INSTALL { color:#8e8e8e;}'
        ].join(''),

        // use modal or not
        modal: true
    };

    // add confirm style to page
    Style.add({
        name: '_WPA_SELECT_PANEL_STYLE',
        cssText: SETTINGS.cssText
    });

    var SelectPanel = function(opts){
        this.opts = extend({}, SETTINGS, opts);
        this.render();
    };

    SelectPanel.prototype = {
        render: function(){
            var panel = this,
                opts = this.opts,
                body = this.container = opts.container;

            // create dom element
            var frag = doc.createElement('div'),
                frame;
            frag.innerHTML = opts.template;
            this.el = frame = frag.firstChild;

            // insert into dom
            (function(){
                try{
                    body.appendChild(frame);
                } catch(e){
                    setTimeout(arguments.callee, 1);
                    return;
                }

                domEvent.addEvent(doc.getElementById('WPA3-SELECT-PANEL-CLOSE'), 'click', function(){
                    panel.remove();
                    opts.onClose && opts.onClose();
                });

                domEvent.addEvent(doc.getElementById('WPA3-SELECT-PANEL-AIO-CHAT'), 'click', function(){
                    panel.remove();
                    opts.onAIOChat && opts.onAIOChat();
                });

                /*domEvent.addEvent(doc.getElementById('WPA3-SELECT-PANEL-ANONY-CHAT'), 'click', function(){
                    panel.remove();
                    opts.onAnonyChat && opts.onAnonyChat();
                });*/

                // when frame is inserted into dom
                // render modal                
                panel.renderModal();
                
                // set position
                // only node is in document can we get computedStyles correctly
                panel.setCenter();
            })();
        },

        show: function(){
            css(this.el, 'display', 'block');
            css(this.modal, 'display', 'block');            
        },

        remove: function(){
            this.el.parentNode.removeChild(this.el);
            this.modal.parentNode.removeChild(this.modal);

            // todo
            // remove events            
        },

        setCenter: function(){
            // set position to make sure it would not be affected by parent node
            css(this.el, {
                position: 'absolute', // make it compatible for ie
                top: '50%',
                left: '50%'
            });

            // standard mode css reset
            var styles = {
                position: 'fixed', // reset to fixed in standard mode
                marginLeft: '-' + this.outerWidth()/2 + 'px',
                marginTop: '-' + this.outerHeight()/2 + 'px'
            };

            // ie6 or quirk mode css reset
            if( noPosFix ){
                // css reset
                styles.position = 'absolute';
                styles.marginTop = 0;
                var top = styles.top = (offset.getClientHeight() - this.outerHeight())/2;

                // scroll update
                setInterval(proxy(this.el, function(){
                    this.style.top = offset.getScrollTop() + top + 'px';
                }), 128);
            }

            // batch set styles
            css(this.el, styles);
        },

        renderModal: function(){
            var container = this.container,
                width = css(container, 'width'),
                height = css(container, 'height'),
                overflow = css(container, 'overflow');

            var modalLayer = doc.createElement('div'),
                styles = {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    zIndex: 2147483647,
                    width: offset.getClientWidth() + 'px',
                    height: offset.getClientHeight() + 'px',
                    backgroundColor: 'white',
                    opacity: 0.1,
                    filter: 'alpha(opacity=10)'
                };

            if( noPosFix ){
                // css reset
                styles.position = 'absolute';

                // scroll update
                setInterval(proxy(modalLayer, function(){
                    this.style.top = offset.getScrollTop() + 'px';
                }), 128);
            }

            css(modalLayer, styles);
            container.insertBefore(modalLayer, this.el);
            this.modal = modalLayer;

            domEvent.addEvent(window, 'resize', proxy(modalLayer, function(){
                css(this.el, {
                    width: offset.getClientWidth() + 'px',
                    height: offset.getClientHeight() + 'px'
                });
            }));
        },

        outerWidth: function(){
            return this.el.offsetWidth;
        },

        outerHeight: function(){
            return this.el.offsetHeight;
        }
    };

    //exports.create = SelectPanel;
    module.exports = SelectPanel;
});
/** lib/lbf/util/report.js **/
/**
 * @fileOverview
 * @author amoschen
 * @version 1
 * Created: 13-4-2 下午9:19
 */
LBF.define('util.report', function(){
    var logs = {};

    /**
     * Report to a url
     * @class report
     * @namespace util
     * @module util
     * @constructor
     * @param {String} url Report destination. All data should be serialized and add tu search part of url
     * @chainable
     */
    return function(url){
        //send data
        var now = +new Date(),
            name = 'log_' + now,
            img = logs[name] = new Image();

        img.onload = img.onerror = function(){
            logs[name] = null;
        };

        url += (url.indexOf('?') > -1 ? '&' : '?') + now;

        img.src = url;

        return arguments.callee;
    };
});
/** src/util/parseQuerystring.js **/
/*
 * parse querystring into an object
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2017/09/26
 */
LBF.define('wpa.util.parseQuerystring', function(require, exports, module) {

	module.exports = exports = function(str) {

		var r = {};

		var strs = str.split('&');
		for (var i = 0, len = strs.length; i < len; i++) {
			var s = strs[i],
				k = s.split('=')[0],
				v = s.split('=')[1];
			r[k] = v;
		}

		return r;

	}

});
/** src/util/openMqqPage.js **/
/*
 * 呼起手q并跳转到指定页面
 * @author: vergilzhou
 * @version: 4.0.0
 * @date: 2016/07/19
 *
 */
LBF.define('wpa.util.openMqqPage', function(require, exports, module){

	var browser = require('lang.browser'),
		conf = require('wpa.conf.config');

	var CGIS = conf.CGIS,
        TYPE_PC = 0,
        TYPE_MOBILE = 1,
        isMobile = conf.isMobile,
        ENV = conf.ENV,
        envMapping = {
            development: 'devadmin.',
            test: 'oaadmin.',
            production: 'admin.'
        };

    var browserEnv = (function () {

		var ua = navigator.userAgent.toLowerCase();
		var ua2 = navigator.userAgent;

		var platform = function (os) {
			var ver = ('' + (new RegExp(os + '(\\d+((\\.|_)\\d+)*)').exec(ua) || [, 0])[1]).replace(/_/g, '.');
			// undefined < 3 === false, but null < 3 === true
			return !!parseFloat(ver);
		};

		return {
			is_mqq: /(iPad|iPhone|iPod).*? (IPad)?QQ\/([\d\.]+)/.test(ua2) || /\bV1_AND_SQI?_([\d\.]+)(.*? QQ\/([\d\.]+))?/.test(ua2),
			is_ios: platform('os '),
			is_android: platform('android[/ ]'),
			is_pc: !platform('os ') && !platform('android[/ ]')
		}
	})();

	function getUrlParam(name, url) {

		//这里使用惰性正则表达式，完善这里的正则表达式，完美支持HASH
		var reg = new RegExp("(^|&|\\?|#)" + name + "=([^&]*?)(&|#|$)");

		url = url || location.href;

		return url;

		var tempHash = url.match(/#.*/) ? url.match(/#.*/)[0] : ''; //临时存储hash
		url = url.replace(/#.*/, ''); //url
		if (reg.test(tempHash)) {
			//HASH优先
			return decodeURIComponent(tempHash.match(reg)[2]);
		} else if (reg.test(url)) {
			return decodeURIComponent(url.match(reg)[2]);
		} else {
			return '';
		}
	}

	//手Q跳转
	function callQQ(url, options) {

		var whiteListVerification = function (url) {
			var reg = /^http(s)?:\/\/([\w\-]+[\.])+qq\.com($|\/)/;
			return reg.test(url);
		};

		url = whiteListVerification(url) ? url : '';

		var settings = {
			env: options && options.env || 'unknown'
		};

		var jumpIframe = document.createElement('iframe');
		jumpIframe.style.cssText = 'display:none; width:0px; height:0px;';

		if (settings.env == 'android') {
			url = 'mqqapi://forward/url?plg_auth=1&url_prefix=' + btoa(url);
		} else if (settings.env == 'ios') {
			url = 'mqqapi://forward/url?version=1&src_type=web&url_prefix=' + btoa(url);
			setTimeout(function() {
				location.href = url;
			}, 300);
			return;
		}

		//就是在iframe.src 赋值伪协议之前先setTimeout 300ms以上，能大大提高唤起手Q的成功率
		setTimeout(function () {

			jumpIframe.src = url;

			document.body.appendChild(jumpIframe);

		}, 500)
	}

	exports = module.exports = function(url) {

		if (!browser.isMobile) {
			return alert('仅限移动端呼起');
		}

		if (browserEnv.is_ios) {
			callQQ(getUrlParam('url', url), {env: 'ios'});
		} else if (browserEnv.is_android) {
			callQQ(getUrlParam('url', url), {env: 'android'});
		}
	};

});
/** lib/lbf/util/serialize.js **/
/**
 * Created by amos on 14-8-18.
 */
LBF.define('util.serialize', function(require, exports, module){
    /**
     * Serialize object with delimiter
     * @class serialize
     * @namespace util
     * @constructor
     * @param {Object} obj
     * @param {String} [delimiterInside='=']
     * @param {String} [delimiterBetween='&']
     * @return {String}
     */
    module.exports = function(obj, delimiterInside, delimiterBetween){
        var stack = [];
        delimiterInside = delimiterInside || '=';
        delimiterBetween = delimiterBetween || '&';

        for(var key in obj){

            if(obj.hasOwnProperty(key)){
                stack.push(key + delimiterInside + (obj[key] || ''));
            }
        }

        return stack.join(delimiterBetween);
    };
});
/** src/util/launch.js **/
/**
 * 呼qq统一方法
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/10/12
 *
 */
LBF.define('wpa.util.launch', function (require, exports, module) {

    var browser = require('lang.browser'),
        conf = require('wpa.conf.config'),
        chatConf = require('wpa.conf.chat'),
        serialize = require('util.serialize'),
        jsonp = require('util.jsonp'),
        showInstallQQ = require('wpa.util.showInstallQQ'),
        // compareVersion = require('wpa.util.compareVersion'),
        LAUNCH_LINK = chatConf.LAUNCH_LINK,
        LAUNCH_MOBILE_QQ = chatConf.LAUNCH_MOBILE_QQ,
        BROWSER_ENV = conf.BROWSER_ENV,
        isMobile = conf.isMobile,
        isSSL = conf.isSSL,
        isIOS = browser.isIOS,
        isAndroid = browser.isAndroid,
        isInMobileQQ = BROWSER_ENV.isInMobileQQ,
        isInWX = BROWSER_ENV.isInWX,
        DOWNLOAD_QQ_TIMEOUT = conf.DOWNLOAD_QQ_TIMEOUT,
        // wxVersion = BROWSER_ENV.wxVersion,
        launchDelay = isMobile ? 500 : 0;

    var win = conf.gWin,
        doc = win.document,
        body = doc.body,
        ua = navigator.userAgent.toLowerCase(),
        cid = 0;

    //iframe跳转
    var iframeJump = function (schema) {

        var div = doc.createElement('div');

        div.style.visibility = 'hidden';
        div.style.width = 0;
        div.style.height = 0;

        div.innerHTML = '<iframe id="_qd_schema_' + cid + '" src="' + schema + '" scrolling="no" width="0" height="0"></iframe>';
        cid++;
        setTimeout(function () {
            body.appendChild(div);
        }, launchDelay);
    };

    // wx跳转
    // function wxCall(scheme) {
    //     scheme = encodeURI(decodeURI(scheme));

    //     WeixinJSBridge && WeixinJSBridge.invoke('launchApplication', {
    //         schemeUrl: scheme
    //     });
    // }

    // function wxJump(scheme) {
    //     if (typeof WeixinJSBridge === 'object' && typeof WeixinJSBridge.invoke === 'function') {
    //         wxCall(scheme);
    //     } else {
    //         if (doc.addEventListener) {
    //             doc.addEventListener('WeixinJSBridgeReady', function () {
    //                 wxCall(scheme);
    //             }, false);
    //         } else if (doc.attachEvent) {
    //             doc.attachEvent('WeixinJSBridgeReady', function () {
    //                 wxCall(scheme);
    //             });
    //             doc.attachEvent('onWeixinJSBridgeReady', function () {
    //                 wxCall(scheme);
    //             });
    //         }
    //     }
    // }

    module.exports = exports = function (protocol, options) {

        options = options || {};

        var needMobileJump = typeof options.needMobileJump !== 'undefined' ? options.needMobileJump : true,
            checkCallQQStatus = typeof options.checkCallQQStatus !== 'undefined' ? options.checkCallQQStatus : false,
            serializedOpts = serialize(options),
            targetPage = options.targetPage,
            kfuin = options.kfuin,
            url = targetPage || LAUNCH_MOBILE_QQ;

        if (isMobile) {//移动端呼qq
            // if (isInWX && compareVersion(wxVersion, '6.5.6') > 0) {
            //     wxJump(protocol);
            //     return;
            // }

            if (isInMobileQQ) {
                setTimeout(function () {
                    win.location.href = protocol;
                }, launchDelay);
            } else if (needMobileJump) {
                win.location.href = url + '?' + serializedOpts + '&protocol=' + protocol;
            } else {
                if (isIOS) {
                    setTimeout(function () {
                        win.location.href = protocol;
                    }, launchDelay);
                } else {
                    iframeJump(protocol);
                }
            }

            var mobileTimeout,
                lastHidden;

            if (checkCallQQStatus) {
                mobileTimeout = setTimeout(function () {
                    showInstallQQ({
                        kfuin: kfuin
                    });
                }, DOWNLOAD_QQ_TIMEOUT);

                doc.addEventListener('visibilitychange', function () {
                    var docHidden = doc.hidden;
                    if (docHidden === lastHidden) return;

                    lastHidden = docHidden;
                    if (docHidden) {
                        clearTimeout(mobileTimeout);
                    }
                });
            }
        } else {//pc端呼qq
            if (isSSL && !conf.BROWSER_ENV.isIE) {
                win.location.href = protocol;
            } else {
                iframeJump(protocol);
            }

            // 通过轮询cgi来判断是否呼起
            var rkey = options.rkey,
                pcInterval,
                pcTimeout;

            if (checkCallQQStatus && rkey) {
                pcInterval = setInterval(function () {
                    var opts = {
                        kfuin: kfuin,
                        rkey: rkey
                    };

                    jsonp(conf.CGIS.PC_CHECK_CALL_QQ_STATUS, opts, function (rs) {
                        if (rs && rs.r == 0) {
                            var data = rs.data || {},
                                status = data.status;

                            if (status) {
                                clearTimeout(pcTimeout);
                                clearTimeout(pcInterval);
                            }
                        }
                    });
                }, 500);

                pcTimeout = setTimeout(function () {
                    clearInterval(pcInterval);
                    showInstallQQ({
                        kfuin: kfuin
                    });
                }, DOWNLOAD_QQ_TIMEOUT);
            }
        }
    };
});

/** src/proto/CustomParams.js **/
/**
 * 图标型wpa所在页面，用户自定义的api参数共9个
   wpaShowItemId是鹅漫的，roc要求加上
   在调用php的cgi时，将这些参数作为cgi的参数传入
   qidian_track_id
   qidian_src_desc
   qidian_ex1
   qidian_ex2
   qidian_ex3
   qidian_ex4
   qidian_ex5
   guestId
   wpaShowItemId
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2018/03/07
 */
LBF.define('wpa.proto.CustomParams', function(require, exports, module) {

	var conf = require('wpa.conf.config'),
		extend = require('lang.extend'),
		gWin = conf.gWin;


	/*
		obj是需要设置这些自定义参数的对象
	*/
	exports.setCustomParams = function(obj) {
		var r = this.getCustomParams();
		extend(obj, r);
	};

	/*
		获取这些自定义参数
	*/
	exports.getCustomParams = function() {

		var r = {};
		if (typeof gWin.qidian_track_id !== 'undefined') {
			r.qidian_track_id = gWin.qidian_track_id;
		}
		if (typeof gWin.qidian_src_desc !== 'undefined') {
			r.qidian_src_desc = gWin.qidian_src_desc;
		}
		if (typeof gWin.qidian_ex1 !== 'undefined') {
			r.qidian_ex1 = gWin.qidian_ex1;
		}
		if (typeof gWin.qidian_ex2 !== 'undefined') {
			r.qidian_ex2 = gWin.qidian_ex2;
		}
		if (typeof gWin.qidian_ex3 !== 'undefined') {
			r.qidian_ex3 = gWin.qidian_ex3;
		}
		if (typeof gWin.qidian_ex4 !== 'undefined') {
			r.qidian_ex4 = gWin.qidian_ex4;
		}
		if (typeof gWin.qidian_ex5 !== 'undefined') {
			r.qidian_ex5 = gWin.qidian_ex5;
		}
		if (typeof gWin.guestId !== 'undefined') {
			r.guestId = gWin.guestId;
		}
		if (typeof gWin.wpaShowItemId !== 'undefined') {
			r.wpaShowItemId = gWin.wpaShowItemId;
		}
		return r;
	};

});

/** src/im/lang.js **/
/**
 * 网页接待支持多语言
 * 获取设置语言类型
 * @author: oliverbi
 * @version: 1.0.0
 * @date: 2018/07/26
 */
LBF.define('wpa.im.lang', function (require, exports, module) {
    var inArray = require('lang.inArray'),
        i18n = require('wpa.im.i18n'),
        conf = require('wpa.conf.config'),
        CustomParams = require('wpa.proto.CustomParams'),
        gWin = conf.gWin,
        DEFAULT_LANG = conf.IM_LANG.defaultLang,
        AVAILABLE_LIST = conf.IM_LANG.availableList;

    var currLang = DEFAULT_LANG;

    /**
     * 设置语言类型
     * @param {String} lang 语言类型
     */
    exports.setLang = function(lang) {
        if (inArray(lang, AVAILABLE_LIST) !== -1) {
            currLang = lang;
        }
    }

    /**
     * 获取语言类型
     * @return {String} 语言类型
     */
    exports.getLang = function() {
        return currLang;
    };

    /**
     * 获取语言key对应展示文字
     * @param  {String} key 语言key
     * @return {String}     展示文字
     */
    exports.getText = function(key) {
        var lang = this.getLang();
        return i18n[lang][key];
    };
});

/** src/util/platformAuthorization.js **/
/*
 * platformAuthorization dialog
 * @author: feiyugao
 * @version: 1.0.0
 * @date: 2019/12/04
 */
LBF.define('wpa.util.platformAuthorization', function(require, exports, module) {

	module.exports = exports = function(params){
        if(document.querySelector('#' + params.id) == null){
            var newIframe = document.createElement('iframe');
            newIframe.src = params.src;
            newIframe.setAttribute('id', params.id);
            newIframe.style.cssText = 'position: fixed; width: 100%; height: 100%; top: 0; left: 0; z-index: 999; border: none';
            document.body.insertBefore(newIframe, document.body.firstChild);

            if(!window[params.id + 'BindMessage']){
                window.addEventListener('message', function(e){
                    if(e.data && e.data.id === params.id){
                        if(e.data.cmd === 'close'){
                            newIframe.parentNode.removeChild(newIframe);
                            window[params.id + 'BindMessage'] = false;
                        }
                    }
                })
                window[params.id + 'BindMessage'] = true;
            }
            return true;
        }
        return false;
    }

});

/** src/util/getAuthorizationPageUrl.js **/
/*
 * platformAuthorization dialog
 * @author: feiyugao
 * @version: 1.0.0
 * @date: 2019/12/04
 */
LBF.define('wpa.util.getAuthorizationPageUrl', function(require, exports, module) {

	module.exports = exports = function(params){

        /************** 授权页逻辑 START **********************/
        /**
         * 这里注意本地开发的域名和端口根据自己本地的实际情况处理
         * 若此处有任何变动，请同时看下webIM的相关逻辑是否需要变动
         * 本地调试授权页必须先启动stellaris项目的授权页页面
         * 在stellaris项目下使用命令 gulp -t wpa-authorization --https
         */
        var QIDIAN_WPA_CUSTOMER = window.QIDIAN_WPA_CUSTOMER || {};
        var data = params || {};
        if(QIDIAN_WPA_CUSTOMER.auth != 1){
            return '';
        }
        var authQueryString = '';
        var pageHost = window.location.host;
        var authPath = 'https://admin.qidian.qq.com/hb/view/pc/wpa_authorization';
        if(pageHost.indexOf('local.qiye.qq.com') > -1 || pageHost.indexOf('localhost') > -1){
            authPath = 'https://local.qiye.qq.com:8001/page/wpa-authorization/pc/index.html';
        }else if(pageHost.indexOf('oaadmin.qidian.qq.com') > -1 || pageHost.indexOf('shpqc.dsnq.qq.com') > -1){
            authPath = 'https://oaadmin.qidian.qq.com/hb/view/pc/wpa_authorization';
        }
        authQueryString = 'auth_pid=' + (QIDIAN_WPA_CUSTOMER.auth_pid || '') + '&auth_paccount=' + (QIDIAN_WPA_CUSTOMER.auth_paccount || '') + '&auth_mode=' + (QIDIAN_WPA_CUSTOMER.auth_mode || 0) + '&from=' + (data.from || 'wpa');
        /************** 授权页逻辑 END **********************/
        return authPath + '?' + authQueryString;
    }

});

/** src/invite/getInviteConf.js **/
/**
 * 拉取会话邀请规则
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/10/28
 *
 */
LBF.define('wpa.invite.getInviteConf', function(require, exports, module) {

	var jsonp = require('util.jsonp'),
		conf = require('wpa.conf.config'),
		host = conf.host,
		url = host + '/webim/Invitation/config';

	var testConf = {
			"key": "fafeaewf123",
			"autoInvited": {
				"active": 1,
				"reception" : {
					"type" : 1, //1 单员工，2 分组
					"cuin" : 1232132//员工工号，分组ID
				}, 
				"repeat": {
					"active" : true, //1:单词，2：重复
					"finterval" : 2 ,// 单位:秒
					"frequency" : 1 
				},
				"condition": {
					"stayPeriod": 2, //单位：秒,为0的话代表立即弹出
					"deviceType": 1 //1: 移动，2：PC 
				}
			},
			"invitedStyle": {
				"kfuin":"",
				"type":"1",//样式类型
				"title": "客服在线，欢迎咨询",
				"content": "您好，当前有客服在线，点击即可咨询",
				"btns": [{
				  "type": "im",//("phone", "im")
				  "text": "网页咨询"
				}
				],
				"theme": "1",//1 2 3 4 5
				avatar: 'https://oa.gtimg.com/qidian/src/sites/srv/wpa/conf/wpa/avatar/1-1.png',
				xc: 'http://www.shiseido.co.jp/cms/products/sg/ei/img/BRND_WD_BNR_4W.jpg'
			}
		},
		defaultInviteStyle = {
			"type":"1",//样式类型
			"title": "客服在线，欢迎咨询",
			"content": "您好，当前有客服在线，点击即可咨询",
			"btns": [{
			  "type": "im",//("phone", "im")
			  "text": "网页咨询"
			}],
			"theme": "1"//1 2 3 4 5
		};

	module.exports = exports = function(opts, cb) {

		var self = this;

		//todo
		//
		// jsonp(URL, opts, function(r) {
		// 	cb(r);
		// });

		//test
		//hardcode conf
		
		var conf2 = {
			"kfuin": 2852199000,
			"key": "fafeaewf123",
			"autoInvited": {
				"active": 1,
				"reception" : {
					"type" : 1, //1 单员工，2 分组
					"cuin" : 1232132//员工工号，分组ID
				}, 
				"repeat": {
					"active" : true, //1:单词，2：重复
					"finterval" : 2 ,// 单位:秒
					"frequency" : 1 
				},
				"condition": {
					"stayPeriod": 2, //单位：秒,为0的话代表立即弹出
					"deviceType": 1 //1: 移动，2：PC 
				}
			},
			"invitedStyle": {
				"type":"1",//样式类型
				"title": "客服在线，欢迎咨询",
				"content": "您好，当前有客服在线，点击即可咨询",
				"btns": [{
				  "type": "im",//("phone", "im")
				  "text": "网页咨询"
				}
				],
				"theme": "1",//1 2 3 4 5
				avatar: 'https://oa.gtimg.com/qidian/src/sites/srv/wpa/conf/wpa/avatar/1-1.png',
				xc: 'http://www.shiseido.co.jp/cms/products/sg/ei/img/BRND_WD_BNR_4W.jpg'
			}
		};
		
		cb(conf2);
	};

});
/** src/invite/tpl.js **/
/**
 * 会话邀请模板
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/10/28
 *
 */
LBF.define('wpa.invite.tpl', function(require, exports, module) {

	var config = require('wpa.conf.config'),
		imageBaseUrl = config.imageBaseUrl,
		log = require('wpa.util.log'),
		browser = require('lang.browser'),
		isMobile = browser.isAndroid || browser.isIOS,
		xssFilter = require('util.xssFilter'),
		replaceImg3X = require('wpa.util.replaceImg3X');

	var COLORS = {
		1: '#0067ed',
		2: '#12b7f5',
		3: '#ff9232',
		4: '#ee685d',
		5: '#25cd98'
	};

	var commonCss = {
		mobile: {
			iframe: [
				'position:fixed',
				'z-index: 2000001000',
				'top: 0',
				'left: 0'
			].join(';') + ';',
			innerBody: [
				'* {margin: 0;padding: 0;font-family: "PingFang SC", "Droid Sans Fallback", "microsoft yahei";background: transparent;}'
			].join(''),
			shadow: [
				'box-shadow: 0 0 15px 1px rgba(0,0,0,.15);'
			].join(''),
			holder1: [
				'.wpa-invite-holder {position: relative;height: 155px;width: 100%;}'
			].join(''),
			holder2: [
				'.wpa-invite-holder {position: relative;height: 180px;width: 100%;}'
			].join('')//,
			// themeColors: {
			// 	1: COLORS[1],
			// 	2: COLORS[2],
			// 	3: COLORS[3],
			// 	4: COLORS[4],
			// 	5: COLORS[5]
			// }
		},
		pc: {
			iframe: [
				'position:fixed',
				'z-index: 2000001000',
				'top: 25%',
				'left: 50%',
				'box-shadow: 0 0 15px 1px rgba(0,0,0,.15)'
				//2017/09/08:去掉邀请框的灰色边框
				// 'border:1px solid #dadee7'
			].join(';') + ';',
			innerBody: [
				'* {margin: 0;padding: 0;font-family: "microsoft yahei";}'
			].join('')//,
			// themeColors: {
			// 	1: COLORS[1],
			// 	2: COLORS[2],
			// 	3: COLORS[3],
			// 	4: COLORS[4],
			// 	5: COLORS[5]
			// }
		}
	};

	commonCss = isMobile ? commonCss.mobile : commonCss.pc;

	commonCss.themeColors = COLORS;

	var btnTypes = exports.btnTypes = {
		qq: 'qq',
		phone: 'phone',
		im: 'im'
	};

	var btnIconNames = {
		qq: 'icon-qq',
		phone: 'icon-phone',
		im: 'icon-im'
	};

	var defaultConf = {
		title: '客服在线，欢迎咨询',
		content: '您好，当前有客服在线，点击即可咨询',
		theme: 1,
		btns: {
			qq: {
				type: btnTypes.qq,
				text: 'QQ交谈'
			},
			phone: {
				type: btnTypes.phone,
				text: '免费电话'
			},
			im: {
				type: btnTypes.im,
				text: '立即咨询'
			}
		}
	};

	var closeTpl = {
		mobile: {
			tpl: [
				'<a href="javascript:void(0);" id="invite_close" data-event="close" class="icon-close">',
		            '<img src="' + imageBaseUrl + '/invite/icon-close-2x.png" />',
		        '</a>'
			].join(''),
			css: [
				'.icon-close {position: fixed;top: 6px;right: 6px;}',
		        '.icon-close img {width: 27px;height: 27px;}'
			].join('')
		},
		pc: {
			tpl: [
				'<a href="javascript:void(0);" id="invite_close" class="icon-close">',
		            '<img src="' + imageBaseUrl + '/invite/icon-close-2x.png" />',
		        '</a>'
			].join(''),
			css: [
				'.icon-close {position: absolute;right: -2px;top: -2px;z-index: 1000;}'
			].join('')
		}
	};

	closeTpl = isMobile ? closeTpl.mobile : closeTpl.pc;

	var defaultAvatar = imageBaseUrl + '/default-avatar.png';
	__WPA.replaceErrAvatar = function(img) {
		img.src = defaultAvatar;
		img.onerror = null;
	};

	var tpls = {
		mobile: {
			1: {
				required: ['title', 'content', 'btn1', 'btn2', 'theme'],
				width: '100%',
				height: 155,
				tpl: [
					'<div class="wpa-invite-holder">',
						'<div class="wpa-invite {theme}">',
					        '<div class="main">',
					            '<p class="title">{title}</p>',
					            '<p class="content">{content}</p>',
					        '</div>',
					        '<div class="btns {is-multi-btn}">',
					            '<div class="btn" id="btn1" data-event="{btn1Event}" data-corpuin="{btn1CorpUin}">',
					                '<span class="btn-icon {btn1Icon}"></span>',
					                '<span class="btn-text">{btn1Text}</span>',
					            '</div>',
					            '<div class="btn" id="btn2" data-event="{btn2Event}" data-corpuin="{btn2CorpUin}">',
					                '<span class="btn-icon {btn2Icon}"></span>',
					                '<span class="btn-text">{btn2Text}</span>',
					            '</div>',
					        '</div>',
					    '</div>',
					    closeTpl.tpl,
					'</div>'
				].join(''),
				css: [
					commonCss.innerBody,
					commonCss.holder1,
			    	'.wpa-invite {background:#fff;height: 123px;border: 1px solid #dadee7;border-radius: 3px;position:absolute;bottom:15px;left:15px;right:15px;' + commonCss.shadow + '}',
			    	'.main {background: #fff url("' + imageBaseUrl + '/invite/icon-bg-bubble.png") no-repeat;background-size: 62px 53px;height: 85px;width: 100%;text-align: center;position: relative;border-top-left-radius:3px;}',
			    	'.title {font-size: 18px;color: #1e2300;position: relative;top: 20px;}',
			    	'.content {font-size: 12px;color: #777;position: relative;top: 23px;}',
			        '.btns {height: 40px;line-height: 40px;border-bottom-left-radius: 3px;border-bottom-right-radius: 3px;text-align: center;}',
			        '.theme-1 .btns {background: ' + commonCss.themeColors[1] + ';}',
			        '.theme-2 .btns {background: ' + commonCss.themeColors[2] + ';}',
			        '.theme-3 .btns {background: ' + commonCss.themeColors[3] + ';}',
			        '.theme-4 .btns {background: ' + commonCss.themeColors[4] + ';}',
			        '.theme-5 .btns {background: ' + commonCss.themeColors[5] + ';}',
			        '.btn {cursor: pointer;color: #fff;font-size: 15px;display: inline-block;}',
			        '.btn span {position:relative;top:-1px;}',
			        '.btn .btn-icon {top:-2px;}',
			        '.btn:last-child {display:none;}',
			        '.btn-text {display:inline-block;padding-left:3px;}',
			        '.multi-btn {display: flex;}',
			        '.multi-btn .btn {flex: 1;}',
			        '.multi-btn .btn:last-child {display:inline-block;border-left: 1px solid #fff;}',
			        '.btn:first-child {display:inline-block!important;}',
			        '.btn-icon {display: inline-block;width: 24px;height: 24px;vertical-align: middle;}',
			        '.icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-white.png") no-repeat;background-size: 24px 24px;}',
			        '.icon-phone {background: url("' + imageBaseUrl + '/invite/icon-phone-white.png") no-repeat;background-size: 24px 24px;}',
			        '.icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-white.png") no-repeat;background-size: 24px 24px;}',
			        closeTpl.css
				].join('')
			},
			2: {
				required: ['content', 'btn1', 'btn2', 'theme', 'avatar'],
				width: '100%',
				height: 155,
				tpl: [
					'<div class="wpa-invite-holder">',
				        '<div class="wpa-invite {theme}">',
				            '<div class="avatar">',
				                '<img src="{avatar}" onerror="javascript:parent.__WPA.replaceErrAvatar(this);"/>',
				            '</div>',
				            '<div class="content">{content}</div>',
				            '<div class="btns  {is-multi-btn}">',
				                '<div class="btn" id="btn1" data-event="{btn1Event}" data-corpuin="{btn1CorpUin}">',
				                    '<span class="btn-icon {btn1Icon}"></span>',
				                    '<span class="btn-text">{btn1Text}</span>',
				                '</div>',
				                '<div class="btn" id="btn2" data-event="{btn2Event}" data-corpuin="{btn2CorpUin}">',
				                    '<span class="btn-icon {btn2Icon}"></span>',
				                    '<span class="btn-text">{btn2Text}</span>',
				                '</div>',
				            '</div>',
				        '</div>',
				        closeTpl.tpl,
				    '</div>'
				].join(''),
				css: [
					commonCss.innerBody,
					commonCss.holder1,
			    	'.wpa-invite {background:#fff;position: absolute;left: 15px;right: 15px;bottom: 15px;height: 123px;border: 1px solid #dadee7;border-radius: 3px;box-shadow: 0 0 15px 1px rgba(0,0,0,.15);}',
			        '.avatar {position: absolute;top: 20px;left: 15px;}',
			        '.avatar img {width: 50px;height: 50px;border-radius: 50%;}',
			        '.content {font-size: 16px;color: #1e2330;position: absolute;top: 20px;left: 80px;width: 210px;line-height: 24px;}',
			        '.btn {display: inline-block;margin-left: 20px;vertical-align: middle;}',
			        '.btn-icon {display: inline-block;width: 24px;height: 24px;vertical-align: middle;background-size: 24px 24px!important;position:relative;top:-1px;}',
			        '.btn-text {font-size: 15px;}',
			        '.btn:last-child {display:none;}',
			        '.btn:first-child {display:inline-block!important;}',
			        '.btns {position: absolute;bottom: 12px;right: 15px;}',
			        '.multi-btn .btn:last-child {display:inline-block;}',
			        '.btn-text {display:inline-block;padding-left:3px;}',
			        '.theme-1 .btn {color: ' + commonCss.themeColors[1] + ';}',
			        '.theme-2 .btn {color: ' + commonCss.themeColors[2] + ';}',
			        '.theme-3 .btn {color: ' + commonCss.themeColors[3] + ';}',
			        '.theme-4 .btn {color: ' + commonCss.themeColors[4] + ';}',
			        '.theme-5 .btn {color: ' + commonCss.themeColors[5] + ';}',
			        '.theme-1 .icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-theme1-2x.png") no-repeat;}',
			        '.theme-2 .icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-theme2-2x.png") no-repeat;}',
			        '.theme-3 .icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-theme3-2x.png") no-repeat;}',
			        '.theme-4 .icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-theme4-2x.png") no-repeat;}',
			        '.theme-5 .icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-theme5-2x.png") no-repeat;}',
			        '.theme-1 .icon-phone {background: url("' + imageBaseUrl + '/invite/icon-phone-theme1-2x.png") no-repeat;}',
			        '.theme-2 .icon-phone {background: url("' + imageBaseUrl + '/invite/icon-phone-theme2-2x.png") no-repeat;}',
			        '.theme-3 .icon-phone {background: url("' + imageBaseUrl + '/invite/icon-phone-theme3-2x.png") no-repeat;}',
			        '.theme-4 .icon-phone {background: url("' + imageBaseUrl + '/invite/icon-phone-theme4-2x.png") no-repeat;}',
			        '.theme-5 .icon-phone {background: url("' + imageBaseUrl + '/invite/icon-phone-theme5-2x.png") no-repeat;}',
			        '.theme-1 .icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-theme1-2x.png") no-repeat;}',
			        '.theme-2 .icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-theme2-2x.png") no-repeat;}',
			        '.theme-3 .icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-theme3-2x.png") no-repeat;}',
			        '.theme-4 .icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-theme4-2x.png") no-repeat;}',
			        '.theme-5 .icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-theme5-2x.png") no-repeat;}',
			        closeTpl.css
				].join('')
			},
			3: {
				required: ['xc', 'btn1', 'btn2', 'theme'],
				width: '100%',
				height: 180,
				tpl: [
					'<div class="wpa-invite-holder">',
				        '<div class="wpa-invite {theme}">',
				            '<div class="xc">',
				                '<img src="{xc}" />',
				            '</div>',
				            '<div class="btns {is-multi-btn}">',
				                '<div class="btn" id="btn1" data-event="{btn1Event}" data-corpuin="{btn1CorpUin}">',
				                    '<span class="btn-icon {btn1Icon}"></span>',
				                    '<span class="btn-text">{btn1Text}</span>',
				                '</div>',
				                '<div class="btn" id="btn2" data-event="{btn2Event}" data-corpuin="{btn2CorpUin}">',
				                    '<span class="btn-icon {btn2Icon}"></span>',
				                    '<span class="btn-text">{btn2Text}</span>',
				                '</div>',
				            '</div>',
				        '</div>',
				        closeTpl.tpl,
				    '</div>'
				].join(''),
				css: [
					commonCss.innerBody,
					commonCss.holder2,
			    	'.wpa-invite {background:#fff;position: absolute;left: 15px;right: 15px;bottom: 15px;height: 148px;border: 1px solid #dadee7;border-radius: 3px;' + commonCss.shadow + '}',
			        '.xc img {width: 100%;height: 95px;border-bottom:1px solid #ebedf2;}',
			        '.btns {text-align: center;position: relative;top: 5px;}',
			        '.btn {display: inline-block;width: 170px;height: 35px;line-height: 35px;border-radius: 3px;color: #fff;font-size: 15px;text-align: center;}',
			        '.btn:last-child {display:none;}',
			        '.multi-btn .btn {width: 140px;}',
			        '.multi-btn .btn:last-child {display:inline-block;margin-left: 15px;}',
			        '.btn:first-child {display:inline-block!important;}',
			        '.theme-1 .btn {background: ' + commonCss.themeColors[1] + ';}',
			        '.theme-2 .btn {background: ' + commonCss.themeColors[2] + ';}',
			        '.theme-3 .btn {background: ' + commonCss.themeColors[3] + ';}',
			        '.theme-4 .btn {background: ' + commonCss.themeColors[4] + ';}',
			        '.theme-5 .btn {background: ' + commonCss.themeColors[5] + ';}',
			        '.btn-text {display:inline-block;padding-left:3px;}',
			        '.btn-icon {display: inline-block;width: 24px;height: 24px;vertical-align: middle;}',
			        '.icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-white.png") no-repeat;background-size: 24px 24px;}',
			        '.icon-phone {background: url("' + imageBaseUrl + '/invite/icon-phone-white.png") no-repeat;background-size: 24px 24px;}',
			        '.icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-white.png") no-repeat;background-size: 24px 24px;}',
			        closeTpl.css
				].join('')
			}
		},
		pc: {
			1: {
				required: ['title', 'content', 'btn1', 'btn2', 'theme'],
				width: 368,
				height: 228,
				tpl: [
					'<div class="wpa-invite {theme}">',
						'<a href="javascript:void(0);" id="invite_close" data-event="close" class="icon-close">',
				            '<img src="' + imageBaseUrl + '/invite/close_white.png" />',
				        '</a>',
						'<div class="main">',
							'<div class="title">{title}</div>',
							'<div class="content">{content}</div>',
						'</div>',
						'<div class="btns {is-multi-btn}">',
							'<div class="btn" id="btn1" data-event="{btn1Event}" data-corpuin="{btn1CorpUin}">',
								'<span class="btn-icon {btn1Icon}"></span>',
								'<span class="btn-text">{btn1Text}</span>',
							'</div>',
							'<span class="spliter"></span>',
							'<div class="btn" id="btn2" data-event="{btn2Event}" data-corpuin="{btn2CorpUin}">',
								'<span class="btn-icon {btn2Icon}"></span>',
								'<span class="btn-text">{btn2Text}</span>',
							'</div>',
						'</div>',
					'</div>'
				].join(''),
				css: [
					commonCss.innerBody,
					'.wpa-invite {width: 368px;height: 228px;background:#fff;border-radius: 4px;border: 1px solid #dadee7;font-family: "microsoft yahei";position: relative;}',
					closeTpl.css,
					'.main {width: 370px;height: 176px;text-align: center;color: #fff;position: absolute;top: -1px;left: -1px;border-top-left-radius: 4px;border-top-right-radius: 4px;position: relative;overflow: hidden;background: url("' + imageBaseUrl + '/invite/bubble.png") no-repeat;background-position: right center;}',
					'.theme-1 .main {background-color: #0067ed;}',
					'.theme-2 .main {background-color: #12b7f5;}',
					'.theme-3 .main {background-color: #ff9232;}',
					'.theme-4 .main {background-color: #ee685d;}',
					'.theme-5 .main {background-color: #25cd98;}',
					'.title {font-size: 24px;margin-top: 50px;}',
					'.content {font-size: 16px;margin-top: 10px;}',
					'.btn-icon {margin-right:7px;vertical-align: middle;display: inline-block;width: 24px;height: 24px;}',
					'.theme-1 .icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-pc1.png") no-repeat;}',
					'.theme-2 .icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-pc2.png") no-repeat;}',
					'.theme-3 .icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-pc3.png") no-repeat;}',
					'.theme-4 .icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-pc4.png") no-repeat;}',
					'.theme-5 .icon-qq {background: url("' + imageBaseUrl + '/invite/icon-qq-pc5.png") no-repeat;}',
					'.theme-1 .icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-pc1.png") no-repeat;}',
					'.theme-2 .icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-pc2.png") no-repeat;}',
					'.theme-3 .icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-pc3.png") no-repeat;}',
					'.theme-4 .icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-pc4.png") no-repeat;}',
					'.theme-5 .icon-im {background: url("' + imageBaseUrl + '/invite/icon-im-pc5.png") no-repeat;}',
					'.btns {text-align: center;}',
					'.btn-text {vertical-align:middle;}',
					'.btn {font-size: 16px;color: #1e2330;text-align: center;height: 54px;line-height: 48px;cursor: pointer;}',
					'.btn:last-child {display: none;}',
					'.btn:first-child {display: block;}',
					'.spliter {display: none;width: 1px;height: 27px;vertical-align: middle;background: #dadee7;}',
					'.multi-btn .btn {display: inline-block;width: 178px;}',
					'.multi-btn .spliter {display: inline-block;}'
				].join('')
			},
			2: {
				required: ['content', 'btn1', 'btn2', 'theme', 'avatar'],
				width: 258,//328,
				height: 318,//388,
				tpl: [
					'<div class="wpa-invite {theme}">',
						'<a href="javascript:void(0);" id="invite_close" data-event="close" class="icon-close">',
				            '<img src="' + imageBaseUrl + '/invite/close_black.png" />',
				        '</a>',
						'<img src="{avatar}" class="avatar" onerror="javascript:parent.__WPA.replaceErrAvatar(this);"/>',
						'<div class="main">',
							'<div class="title">{title}</div>',
							'<div class="content">{content}</div>',
						'</div>',
						'<div class="btns {is-multi-btn}">',
							'<div class="btn" id="btn1" data-event="{btn1Event}" data-corpuin="{btn1CorpUin}">',
								'<span class="btn-icon {btn1Icon}"></span>',
								'<span class="btn-text">{btn1Text}</span>',
							'</div><div class="btn" id="btn2" data-event="{btn2Event}" data-corpuin="{btn2CorpUin}">',
								'<span class="btn-icon {btn2Icon}"></span>',
								'<span class="btn-text">{btn2Text}</span>',
							'</div>',
						'</div>',
					'</div>'
				].join(''),
				css: [
					commonCss.innerBody,
					'.wpa-invite {width: 258px;height: 318px;border-radius: 4px;border: 1px solid #dadee7;position: relative;text-align: center;background: #fff;}',
					'.icon-close {position: absolute;right: -2px;top: -2px;z-index: 10;}',
					closeTpl.css,
					'.avatar {margin:0 auto;width: 120px;height: 120px;border-radius: 50%;position: absolute;top: 30px;left:70px;}',
					'.main {position: relative;top: 166px;}',
					'.title {font-size: 24px;color: #1e2330;}',
					'.content {font-size: 16px;color: #777;margin-top: 6px;}',
					'.btns {position: absolute;left: 0;bottom: 0;width: 100%;height: 54px;line-height: 54px;color: #fff;}',
					'.icon-im {margin-top:-1px;display: inline-block;width: 24px;height: 24px;background: url("' + imageBaseUrl + '/invite/im-bubble-pc-white.png") no-repeat;}',
					'.icon-qq {margin-top:-1px;display: inline-block;width: 24px;height: 24px;background: url("' + imageBaseUrl + '/invite/icon-qq-white-small.png") no-repeat;}',
					'.btn-icon {margin-right: 7px;vertical-align: middle;}',
					'.btn-text {vertical-align: top;display:inline-block;}',
					'.btn {position:relative;top:-1px;font-size: 16px;cursor: pointer;border-bottom-left-radius: 4px;border-bottom-right-radius: 4px;height: 54px;}',
					'.btn:last-child {display: none;}',
					'.btn:first-child {display: block;}',
					'.multi-btn .btn {display: inline-block;width: 128.5px;}',
					'.multi-btn .btn:first-child {float: left;border-bottom-left-radius: 4px;border-bottom-right-radius: 0;}',
					'.multi-btn .btn:last-child {float: right;border-bottom-left-radius: 0;border-bottom-right-radius: 4px;}',
					'.theme-1 .btn {background: ' + COLORS[1] + ';}',
					'.theme-2 .btn {background: ' + COLORS[2] + ';}',
					'.theme-3 .btn {background: ' + COLORS[3] + ';}',
					'.theme-4 .btn {background: ' + COLORS[4] + ';}',
					'.theme-5 .btn {background: ' + COLORS[5] + ';}'
				].join('')
			},
			3: {
				required: ['xc', 'btn1', 'btn2', 'theme'],
				width: 368,
				height: 292,
				tpl: [
					'<div class="wpa-invite {theme}">',
						'<a href="javascript:void(0);" id="invite_close" data-event="close" class="icon-close">',
					        '<img src="' + imageBaseUrl + '/invite/close_black.png" />',
					    '</a>',
						'<img src="{xc}" class="xc" />',
						'<div class="btns {is-multi-btn}">',
							'<div class="btn" id="btn1" data-event="{btn1Event}" data-corpuin="{btn1CorpUin}">',
								'<span class="btn-icon {btn1Icon}"></span>',
								'<span class="btn-text">{btn1Text}</span>',
							'</div><div class="btn" id="btn2" data-event="{btn2Event}" data-corpuin="{btn2CorpUin}">',
								'<span class="btn-icon {btn2Icon}"></span>',
								'<span class="btn-text">{btn2Text}</span>',
							'</div>',
						'</div>',
					'</div>'
				].join(''),
				css: [
					commonCss.innerBody,
					'.wpa-invite {width: 368px;height: 292px;border-radius: 4px;border: 1px solid #dadee7;position: relative;background: #fff;}',
					closeTpl.css,
					'.xc {border-bottom:1px solid #ebedf2;width: 370px;height: 210px;position: relative;left: -1px;top: -1px;}',
					'.btn {width:330px;}',
					'.btn:last-child {display: none;}',
					'.btn:first-child {display: inline-block;}',
					'.multi-btn .btn {display: inline-block;*display:inline;*zoom:1;width: 155px;}',
					'.multi-btn .btn:first-child {margin-right: 10px;}',
					'.icon-im {display: inline-block;width: 24px;height: 24px;background: url("' + imageBaseUrl + '/invite/im-bubble-pc-white.png") no-repeat;}',
					'.icon-qq {display: inline-block;width: 24px;height: 24px;background: url("' + imageBaseUrl + '/invite/icon-qq-white-small.png") no-repeat;}',
					'.btns {text-align: center;height: 84px;line-height: 84px;position: relative;left: 0;top: -5px;}',
					'.btn {cursor:pointer;display:inline-block;*display:inline;*zoom:1;height:44px;line-height: 44px;font-size: 16px;color: #fff;text-align: center;border-radius: 4px;}',
					'.btn-icon, .btn-text {vertical-align: middle;}',
					'.btn-text {display:inline-block;margin-top:-3px;vertical-align: middle;}',
					'.btn-icon {margin-right: 7px;margin-top:-1px;}',
					'.theme-1 .btn {background: ' + COLORS[1] + ';}',
					'.theme-2 .btn {background: ' + COLORS[2] + ';}',
					'.theme-3 .btn {background: ' + COLORS[3] + ';}',
					'.theme-4 .btn {background: ' + COLORS[4] + ';}',
					'.theme-5 .btn {background: ' + COLORS[5] + ';}'
				].join('')
			}
		}
	};

	var getBtn = function() {

	};

	//编译模板
	var compileTpl = function(targetTpl, conf) {
		var required = targetTpl.required,
			css = targetTpl.css,
			tpl = targetTpl.tpl,
			btns = conf.btns,
			avatar = conf.avatar,
			title = conf.title || defaultConf.title,
			content = conf.content || defaultConf.content,
			xc = conf.xc,
			theme = 'theme-' + (conf.theme || defaultConf.theme),
			isMultiBtn = btns.length > 1 ? true : false,
			isMultiBtnClass = isMultiBtn ? 'multi-btn' : '',
			btn1 = btns[0],
			btn1Type = btn1.type,
			btn1Text = btn1.text || defaultConf.btns[btn1Type].text,
			btn1Icon = btnIconNames[btn1Type],
			btn1CorpUin = btn1.isCorpUin ? parseInt(btn1.isCorpUin, 10) : 0,
			btn2 = btns[1] || {},
			btn2Type = btn2.type,
			btn2Text = btn2.text,
			btn2Icon = btnIconNames[btn2Type],
			btn2CorpUin = btn2.isCorpUin ? parseInt(btn2.isCorpUin, 10) : 0,
			r;

		r = tpl
				.replace('{title}', xssFilter.htmlEncode(title))
				.replace('{content}', xssFilter.htmlEncode(content))
				.replace('{theme}', xssFilter.htmlEncode(theme))
				.replace('{avatar}', xssFilter.htmlEncode(avatar))
				.replace('{xc}', xssFilter.htmlEncode(xc))
				.replace('{is-multi-btn}', isMultiBtnClass)
				.replace('{btn1Text}', xssFilter.htmlEncode(btn1Text))
				.replace('{btn2Text}', xssFilter.htmlEncode(btn2Text))
				.replace('{btn1Icon}', btn1Icon)
				.replace('{btn2Icon}', btn2Icon)
				.replace('{btn1Event}', btn1Type)
				.replace('{btn2Event}', btn2Type)
				.replace('{btn1CorpUin}', btn1CorpUin)
				.replace('{btn2CorpUin}', btn2CorpUin);
		
		return {
			css: css,
			tpl: r,
			height: targetTpl.height,
			width: targetTpl.width
		};

	};

	exports.getTpl = function(conf) {
		
		var type = conf.type,
			//todo
			//这里先hardcode为移动端的
			targetTpl = isMobile ? tpls.mobile[type] : tpls.pc[type],
			// targetTpl = tpls.mobile[type],
			actualTpl = compileTpl(targetTpl, conf);

		return actualTpl;
	};


	//移动端的iframe宽度需要动态计算
	//因为fixed的iframe，即使设置了left,right，也无法保证位置固定
	//必须要动态计算宽度
	exports.getIframeStyle = function(tpl, conf) {

		var style = commonCss.iframe,
			width = tpl.width,
			height = tpl.height;

		//pc端的邀请框与移动端不同，pc是宽高固定，要求左右居中，top为黄金比例
		if (!isMobile) {
			var ml = width / 2;
			style = style + 'margin-left:-' + ml + 'px';
		}

		return {
			style: style,
			width: width,
			height: height
		};
	};
});
/** src/util/getOffset.js **/
/**
 * get the absolute left and top for a dom
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/09/20
 *
 */

LBF.define('wpa.util.getOffset', function(require, exports, module) {

	module.exports = exports = function(dom, options) {

		if (!dom) {
			return;
		}

		options = options || {};

		var parent = dom.offsetParent,
			x = dom.offsetLeft,
			y = dom.offsetTop;

		//获取dom相对于整个页面的绝对位置
		if (options.isAbsolute) {
			while (parent) {
				x += parent.offsetLeft;
				y += parent.offsetTop;
				parent = parent.offsetParent;
			}
		}

		return {
			offsetParent: parent,
			x: x,
			y: y
		};
	};
});
/** src/proto/mobileUnreadBar.js **/
/**
 * 为配合移动端非im的邀请，移动端再也没有小红点了，用小蓝条代替，此改动是2017/04/17开始的
 * tapd: http://tapd.oa.com/TencentNewBiz/prong/stories/view/1010109441058960805
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2017/04/17
 *
 */
 LBF.define('wpa.proto.mobileUnreadBar', function(require, exports, module) {

 	var browser = require('lang.browser'),
		getOffset = require('wpa.util.getOffset'),
		conf = require('wpa.conf.config'),
		KFUINS = conf.KFUINS,
		isMobile = conf.isMobile,
		isIOS = conf.BROWSER_ENV.isIOS,
		isFengLing = conf.isFengLing,
		win = conf.gWin,
		WEB_IM_CATE = conf.TYPES.IM,
		WPAS_IM_TYPE = conf.WEB_IM.WPAS_IM_TYPE,
		Style = require('wpa.util.Style'),
		extend = require('lang.extend'),
		log = require('wpa.util.log'),
		wpaType = require('wpa.conf.wpaType'),
		domEvent = require('wpa.util.domEvent'),
		proxy = require('lang.proxy'),
        onIframeLoaded = require('wpa.util.onIframeLoaded'),
        lang = require('wpa.im.lang');

	//小蓝条样式：
	//240x70  字号：28 FFFFFF  间隔20px
	//95%  #4fbcfb
	var BAR_CLASS_NAME = 'qidian_wpa_unread_msg_bar',
		WPA_ID_PREFIX = conf.WPA_ID_PREFIX,
		WPA = win.__WPA,
		WIDTH = 120,
		HEIGHT = 35,
		actualPosition = 'fixed',
		CIRCLE_ID_PREFIX = 'qidian_wpa_id_unread_msg_bar_',
		total = 0,
		//多个bar同时出现的垂直间距
		barsGap = 45,
		//最下面的小蓝条距离底部为80px
		initBottomStyle = 80;

	// win[SHOWNING_RED_CIRCLE_WPAS] = win[SHOWNING_RED_CIRCLE_WPAS] ? win[SHOWNING_RED_CIRCLE_WPAS] : {};

	var	doc = win.document,
		body = doc.body;

	var barTpl = [
		'<div id="unreadBar">',
		'<span id="unreadNum">9+</span>条新消息',
		'</div>'
	].join('');

	/*
		gapObj = {
			2852199000: 0,
			2852199001: 1
		}
	*/
	//用gapObj来决定多主号的情况下
	//小蓝条的bottom
	var gapObj = {};

	var CIRCLE_INNER_CSS_TEXT = [
		'* {margin:0;padding:0;}',
		'#unreadBar {font-family:\"PingFang SC\", \"Droid Sans Fallback\";background:#4fbcfb;color:#fff;font-size:14px;width:120px;text-align:center;height:35px;line-height:35px;border-top-left-radius:50px;border-bottom-left-radius:50px;}'
	].join('');

	var barIframeStyle = [
		'position:fixed',
		'right:0'
	].join(';') + ';';

	exports.drawBar = function(options) {

		var kfuin = options.kfuin;

		var actualNumber = typeof options.number !== 'undefined' ? options.number : 0,
			number = actualNumber;

		var unreadMsgId = CIRCLE_ID_PREFIX + kfuin;

		if (typeof gapObj[kfuin] === 'undefined') {
			gapObj[kfuin] = total++;
		}

		//这里判断是否同主号的bar已经出现了
		//没有的话才新建iframe并插入
		//否则只是update里面的数字
		if (document.getElementById(unreadMsgId)) {
			return updateUnreadMsgBar(options);
		}

		var cssBottom = initBottomStyle + gapObj[kfuin] * barsGap;
		var style = barIframeStyle + 'bottom:' + cssBottom + 'px;';

		var strIframe = '<iframe scrolling="no" class="' + BAR_CLASS_NAME + '" id="' + unreadMsgId + '" frameborder="0" width="' + WIDTH + '" height="' + HEIGHT + '" allowtransparency="true" src="about:blank" style="{style}"></iframe>';
		strIframe = strIframe.replace('{style}', style);

	    // ie will reject operations when parent's domain is set
	    var iframe;
	    try{//ie
	        iframe = doc.createElement(strIframe);
	    } catch(e) {//none ie 
	        iframe = doc.createElement('iframe');
	        iframe.width = WIDTH;
	        iframe.height = HEIGHT;
	        iframe.id = unreadMsgId;
	        iframe.style.cssText = style;
	        iframe.setAttribute('scrolling', 'no');
	        iframe.setAttribute('frameborder', 0);
	        iframe.setAttribute('allowtransparency', true);
	        iframe.setAttribute('src', 'about:blank');
	        iframe.setAttribute('class', BAR_CLASS_NAME);
	    }

	    body.appendChild(iframe);

	    setTimeout(function() {


	    	if (browser.msie) {
		        // when domain is set in parent page and blank iframe is not ready, access to it's content is denied in ie
		        try{
		            var accessTest = iframe.contentWindow.document;
		        } catch(e){
		            // Test result shows that access is denied
		            // So reset iframe's document.domain to be the same as parent page
		            iframe.src = 'javascript:void((function(){document.open();document.domain=\''+ document.domain + '\';document.close()})())';
		        }
		    }

		    var loaded = function() {
		    	var iWin = iframe.contentWindow,
	                iDoc = iframe.contentDocument || iWin.document;

	            iDoc.open();
	            iDoc.write([
	                //'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
	                '<!doctype html>',
	                '<html xmlns="http://www.w3.org/1999/xhtml">',
	                '<head>',
	                    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
	                    //todo
	                    browser.msie && iframe.src !== 'about:blank' ? '<script>document.domain=\'' + document.domain + '\';</script>' : '',
	                    '<style>' + CIRCLE_INNER_CSS_TEXT + '</style>',
	                '</head>',
	                '<body>',
	                '<div id="unreadBar">',
						'<span id="number" data-number="' + actualNumber + '">' + number + '</span>' + lang.getText('common_new_message'),
					'</div>',
	                '</body>',
	                '</html>'
	            ].join(''));
	            iDoc.close();
	            //风铃要求加上禁止touchmove事件
	            //仅移动端添加
	            if (isFengLing && (browser.isIOS || browser.isAndroid)) {
	                try {
	                    iDoc.body.addEventListener('touchmove', function (event) {
	                        event.preventDefault();
	                    }, false);
	                } catch (e) {

	                }
	            }

	            var api = function() {

	            	var unreadNum = win.__WPA[KFUINS][kfuin].unread,
	            		onlyOpen = win.__WPA[KFUINS][kfuin].onlyOpen;

	            	if (typeof onlyOpen !== 'undefined' && !onlyOpen) {
	            		var param = extend(win.__WPA[KFUINS][kfuin].onlyOpenParam || {}, {
	            			kfuin: kfuin,
	            			openUnread: true
	            		});
	            		return WPA.IM.openChatIframe(param);
	            	}

	            	/*
	            		2017/09/11:
	            		跟web微信确认如下情况：
		            	未读消息：unread
						离线消息：socket
						unread > 0, socket = 0:true
						unread = 0, socket > 0:false
						unread > 0, socket > 0:false
					*/
					onlyOpen = false;
					if (unreadNum) {
						var socketNum = unreadNum.socket,
							unreadNum = unreadNum.chat;
						if (unreadNum > 0 && socketNum == 0) {
							onlyOpen = true;
						}
					}
	            	// if (unreadNum && unreadNum.socket > 0) {
	            	// 	onlyOpen = false;
	            	// }

					WPA.IM.openChatIframe({
	            	 	kfuin: kfuin,
	            	 	onlyOpen: onlyOpen
	            	});
	            };
	            /*
					it must be binded on doms except body to trigger the event
	            */
	            domEvent.addEvent(iDoc.getElementById('unreadBar'), 'click', api);
		    };

		    // if (isIOS) {
		    // 	loaded();
		    // } else {
	    	onIframeLoaded(iframe, loaded);
		    // }

	    }, 100);



	};

	function updateUnreadMsgBar(options) {
		log('[mobileUnreadBar][updateUnreadMsgBar]');
		var kfuin = options.kfuin,
			number = options.number,
			id = CIRCLE_ID_PREFIX + kfuin,
			iframe = document.getElementById(id),
			iWin = iframe.contentWindow,
            iDoc = iframe.contentDocument || iWin.document,
            domNumber = iDoc.getElementById('number');
        domNumber.innerHTML = getDisplayNumber(number);
        domNumber.setAttribute('data-number', number);
	};

	//>9: 显示9+
	//<=9: 显示原数
	function getDisplayNumber(number) {
		return number > 9 ? '9+' : number;
	}

	function removeUnreadMsgBar(kfuin) {
		var iframe = document.getElementById(CIRCLE_ID_PREFIX + kfuin);
		if (iframe) {
			iframe.parentNode.removeChild(iframe);
		}
	}
	exports.removeUnreadMsgBar = removeUnreadMsgBar;


 });

/** lib/lbf/monitor/SpeedReport.js **/
/**
 * Created by amos on 14-1-16.
 */
LBF.define('monitor.SpeedReport', function(require){
    var report = require('util.report'),
        Class = require('lang.Class'),
        serialize = require('util.serialize'),
        Attribute = require('util.Attribute');

    var defaults = {
        url: 'http://isdspeed.qq.com/cgi-bin/r.cgi',
        rate: 1,
        calGap: false
    };

    var PointReport = Class.inherit(Attribute, {
        initialize: function(options){
            this
                .set(defaults)
                .set({
                    points: [],
                    start: +new Date()
                })
                .set(options);
        },

        add: function(time, pos){
            var points = this.get('points');

            time = time || +new Date();
            pos = pos || points.length;

            points[pos] = time;

            return this;
        },

        send: function(){
            // clear points
            var points = this.get('points').splice(0);

            if(Math.random() > this.get('rate')){
                return this;
            }

            var start = this.get('start'),
                f1 = this.get('flag1'),
                f2 = this.get('flag2'),
                f3 = this.get('flag3'),
                url = this.get('url') + '?flag1=' + f1 + '&flag2=' + f2 + '&flag3=' + f3 + '&',
                proxy = this.get('proxy'),
                i;

            if(this.get('calGap')){
                for(i= points.length - 1; i> 0; i--){
                    points[i-1] = points[i-1] || 0;
                    points[i] -= points[i-1];
                }
            } else {
                for(i= points.length - 1; i> 0; i--){
                    if(points[i]){
                        points[i] -= start;
                    }
                }
            }

            url = url + serialize(points);

            // when use proxy mode
            if(proxy){
                url = proxy.replace('{url}', encodeURIComponent(url));
            }

            report(url);
        }
    });

    /**
     * 上报Performance timing数据；
     * 如果某个时间点花费时间为0，则此时间点数据不上报。
     *
     * @param {Object} options
     *
     * @param {String} options.flag1，测速系统中的业务ID，譬如校友业务为164
     *
     * @param {String} options.flag2，测速的站点ID
     *
     * @param {String} options.flag3IE，测速的页面ID
     *（因为使用过程中我们发现IE9的某些数据存在异常，
     * 如果IE9和chrome合并统计，会影响分析结果，所以这里建议分开统计）
     *
     * @param {String} [options.flag3Chrome]，测速的页面ID
     * （如果为空，则IE9和chrome合并统计）
     *
     * @param {Number} [options.initTime] 统计页面初始化时的时间
     *
     */
    var reportPerformance = function(options){
        var f1 = options.flag1,
            f2 = options.flag2,
            f3_ie = options.flag3IE,
            f3_c = options.flag3Chrome,
            d0 = options.initTime,
            proxy = options.proxy;

        var _t, _p = window.performance || window.webkitPerformance || window.msPerformance, _ta = ["navigationStart","unloadEventStart","unloadEventEnd","redirectStart","redirectEnd","fetchStart","domainLookupStart","domainLookupEnd","connectStart","connectEnd","requestStart",/*10*/"responseStart","responseEnd","domLoading","domInteractive","domContentLoadedEventStart","domContentLoadedEventEnd","domComplete","loadEventStart","loadEventEnd"], _da = [], _t0, _tmp, f3 = f3_ie;

        if (_p && (_t = _p.timing)) {

            if (typeof(_t.msFirstPaint) != 'undefined') {	//ie9
                _ta.push('msFirstPaint');
            } else {
                if (f3_c) {
                    f3 = f3_c;
                }
            }

            _t0 = _t[_ta[0]];
            for (var i = 1, l = _ta.length; i < l; i++) {
                _tmp = _t[_ta[i]];
                _tmp = (_tmp ? (_tmp - _t0) : 0);
                if (_tmp > 0) {
                    _da.push( i + '=' + _tmp);
                }
            }

            if (d0) {//统计页面初始化时的d0时间
                _da.push('30=' + (d0 - _t0));
            }

            var url = 'http://isdspeed.qq.com/cgi-bin/r.cgi?flag1=' + f1 + '&flag2=' + f2 + '&flag3=' + f3 + '&' + _da.join('&');

            // when use proxy mode
            if(proxy){
                url = proxy.replace('{url}', encodeURIComponent(url));
            }

            report(url);
        }

    };

    return {
        create: function(options){
            return new PointReport(options);
        },

        reportPerformance: reportPerformance
    }
});
/** lib/lbf/util/domain.js **/
/**
 * @fileOverview
 * @author amoschen
 * @version
 * Created: 12-8-28 上午10:16
 */
LBF.define('util.domain', function(){
    var domain = {},
        dm = document.domain;

    // in some cases, get location.href will throw security restriction error
    // so catch it and retry
    try{
        // in some cases, get location.href will throw security restriction error
        // so catch it and retry
        domain.url = location.href;
    } catch(e){
        domain.url = '';
    }

    domain.topDomain = function(){
        //in case of domains end up with .com.cn .edu.cn .gov.cn .org.cn
        var reg1 = /\.(?:(?:edu|gov|com|org|net)\.cn|co\.nz)$/,
        //in case of ip
            reg2 = /^[12]?\d?\d\.[12]?\d?\d\.[12]?\d?\d\.[12]?\d?\d$/,
        // for domain ends like .com.cn, top domain starts from -3
        // for ip starts from 0
        // else slice from -2
            slicePos = reg1.test(dm) ? -3 : reg2.test(dm) ? 0 : -2;
        return dm.split('.').slice(slicePos).join('.');
    }();

    domain.domain = function(){
        var reg = /(?::[\/]{2}|:[\\]{3})([a-zA-Z0-9_\.]+)/;

        try{
            var ret = reg.exec(domain.url);
            return ret ? ret[1] || dm : dm;
        } catch(e){
            return dm;
        }
    }();

    return domain;
});
/** src/util/getReportData.js **/
/*
 * 整理呼起上报的数据
 * @author: vergilzhou
 * @version: 4.0.0
 * @date: 2016/07/21
 *
 */
LBF.define('wpa.util.getReportData', function(require, exports, module) {

	var extend = require('lang.extend'),
		browser = require('lang.browser'),
		conf = require('wpa.conf.config'),
		win = conf.gWin,
		JSON = require('lang.JSON');

	var EVENT_TYPE_LOAD = 1,
		EVENT_TYPE_CLICK = 2,
		TYPE_NAME_CLICK = 'click',
		TYPE_NAME_RENDER = 'render';

	//根据数据来获得上报类型
	var	CPTTP_NONE = 0,
		CPTTP_CORPWPA = 1,   //企业WPA
		CPTTP_STAFFWPA = 2,  //员工WPA
		CPTTP_FREETEL = 3,   //免费电话
		CPTTP_JOINGROUP = 4,  //加群
		CPTTP_ADDFRIEND = 5,   //加好友
		CPTTP_WXMANUAL = 6,   //WX公众号人工客服
		CPTTP_CHAT = 7,   //会话
		CPTTP_ADDATTENT = 8;   //加关注
	
	//CP = contact point
	var getCPType = function(params) {

		var temp,
			result = CPTTP_NONE;//默认值

		if (temp = params.roleQQ) {//会话
			//接触点存在会话和来电共存的类型
			//会话优先级高，所以只报会话
			result = temp.value ? CPTTP_CORPWPA : CPTTP_STAFFWPA;
		} else if (params.roleTEL) {//来电
			result = CPTTP_FREETEL;
		} else if (params.roleKFEXT) {//加好友
			result = CPTTP_ADDFRIEND;
		} else if (params.roleGROUP) {//加群
			result = CPTTP_JOINGROUP;
		} else if (params.rolePUB) {//加关注
			result = CPTTP_ADDATTENT;
		}

		return {
			tptype: result
		};
	};

	module.exports = exports = function(params, type, serialize) {

		//默认type为click
		type = type || TYPE_NAME_CLICK;

		var	commonOptions = {
				//mid目前保留，为空字符串
				mid: '',
				//接触点id
				id: params.id,
				visitorid: params.guid,
				kfuin: params.fkfuin,
				kfext: params.fkfext,
				ldpg: win.location.href,
				refurl: typeof document.referrer !== 'undefined' ? document.referrer : '',
				ua: window.navigator.userAgent,
				eptype: browser.isMobile ? 2 : 1
			},
			tptypeObj = getCPType(params),
			reportData = extend(commonOptions, tptypeObj);

		if (type == TYPE_NAME_CLICK) {
			reportData = extend(reportData, {
				visitorId: params.visitorId,
				url: win.location.href,
				clickId: params.clickId,
				eventtp: EVENT_TYPE_CLICK,
				title: encodeURIComponent(document.title)
			});
		}

		return serialize ? JSON.stringify(reportData) : reportData;
	};

});
/** src/util/compareVersion.js **/
/**
 * 比较两个版本的大小通用方法
 * 当a<b返回-1, 当a==b返回0, 当a>b返回1
 * @author oliverbi
 * @date 2019/07/14
 */
LBF.define('wpa.util.compareVersion', function (require, exports, module) {
    module.exports = function (a, b) {
        var i, l, r, len;

        a = String(a).split('.');
        b = String(b).split('.');

        for (i = 0, len = Math.max(a.length, b.length); i < len; i++) {
            l = isFinite(a[i]) && Number(a[i]) || 0;
            r = isFinite(b[i]) && Number(b[i]) || 0;
            if (l < r) {
                return -1;
            } else if (l > r) {
                return 1;
            }
        }

        return 0;
    };
});

/** src/util/getLBSLocation.js **/
LBF.define('wpa.util.getLBSLocation', function(require, exports, module) {
    /**
     * 获取到当前的位置信息
     * @public
     * @param {successFn} function 获取位置信息成功的回调函数 回调参数为Position
     * @param {errorFn} function 获取位置信息错误的回调函数 回调参数为PositionError
     */
    module.exports = exports = function(successFn, errorFn) {
        // 其实手Q上也是有navigator.geolocation的，可以获取到。
        if (!navigator.geolocation) {
            // 浏览器不支持获取地理位置信息,直接执行错误函数
            alert(当前浏览器不支持获取位置信息);
            errorFn({
                code: 5,
                message: '当前浏览器不支持获取位置信息'
            });
            return;
        }
        // 由于手Q存在只能成功的时候执行回调函数，失败的时候就不会执行回调函数，所以只能考虑在手Q中执行成功的情况，失败的情况统一在原生获取地理位置中，其中，如果mqq的值有的话，那么就表示一定是在安卓手Q中
        if (typeof(mqq) !== 'undefined' && (location.href.indexOf('.qidian.qq.com') > -1 || location.href.indexOf('.dsnq.qq.com') > -1)) {
            // 以下为成功进入安卓手Q的代码
            mqq.sensor && mqq.sensor.getLocation({}, function(retCode, latitude, longitude) {
                if (retCode === 0) {
                    // 从端中获取信息成功
                    successFn({
                        coords: {
                            latitude: latitude,
                            longitude: longitude
                        },
                        coord_type: 2 // 2 表示火星GPS 
                    });
                } else {
                    alert('从端中获取位置失败');
                    errorFn({
                        code: 6,
                        message: '从端中获取位置失败'
                    });
                }
            });
        } else {
            // 不是安卓手Q的统一走如下路径
            navigator.geolocation.getCurrentPosition(function(position) {
                position.coord_type = 1; // 1表示的是正常的gps
                successFn(position);
            }, function(error) {
                // 手Q中没有权限调用位置信息的情况，直接调用错误的回调函数
                alert('获取地理位置信息被拒绝');
                errorFn(error);
            });
        }
    }
});
/** lib/lbf/util/xssFilter.js **/
/**
 * @fileOverview
 * @author amoschen
 * @version 1
 * Created: 13-4-8 下午2:19
 */
LBF.define('util.xssFilter', function(){
    /**
     * Filter all xss chars and replace them with legal ones.
     * @class xssFilter
     * @namespace util
     * @module util
     * @constructor
     * @param {String} str
     * @return {String} Secured string
     */
    return {

        /**
         * Filter used to filter the innerHTML and attributes of tag
         * @method htmlEncode
         * @param str
         * @returns {string}
         * @exmaple
         *     $('#needFilter').html(xssFilter.htmlEncode('untrusted data'));
         *     $('body').append($('<div data-attr="' + xssFilter.htmlEncode('untrusted data') + '"></div>');
         */
        htmlEncode: function (str) {
            return (str + '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/'/g, '&#39;')
                .replace(/"/g, '&quot;')
                .replace(/ /g, '&nbsp;')
                .replace(/=/g, '&#61;')
                .replace(/`/g, '&#96;');
        },

        /**
         * Filter used to filter the url parameters
         * @method uriComponentEncode
         * @param str
         * @returns {String}
         * @example
         *     // in fact we don't have to encode the whole url, but the parameters
         *     $('#needFilter).attr('src', xssFilter.uriComponentEncode('untrusted uri'));
         */
        uriComponentEncode: function(str) {
            str = encodeURIComponent(str + '');
            return str
                .replace(/~/g, '%7E')
                .replace(/!/g, '%21')
                .replace(/\*/g, '%2A')
                .replace(/\(/g, '%28')
                .replace(/\)/g, '%29')
                .replace(/'/g, '%27')
                .replace(/\?/g, '%3F')
                .replace(/;/g, '%3B');
        },

        /**
         * Filter used to filter the css code, mainly used in php
         * @method cssEncode
         * @param str
         * @returns {string}
         * @example
         *     <style>
         *         #foo[id ~= 'xssFilter.cssEncode("untrusted data")'] { background-color: pink;}
         *     </style>
         */
        cssEncode: function(str) {
            return (str + '')
                .replace(/\b/g, '\\08 ')
                .replace(/\t/g, '\\09 ')
                .replace(/\n/g, '\\0A ')
                .replace(/\f/g, '\\0C ')
                .replace(/\r/g, '\\0D ')
                .replace(/'/g, '\\27 ')
                .replace(/"/g, '\\22 ')
                .replace(/\\/g, '\\5C ')
                .replace(/&/g, '\\26 ')
                .replace(/\//g, '\\2F ')
                .replace(/</g, '\\3C ')
                .replace(/>/g, '\\3E ')
                .replace(/\u2028/g, '\\002028 ')
                .replace(/\u2029/g, '\\002029 ');
        },
        /**
         * Filter used to filter the css color, mainly used by php
         * @method cssColorValidate
         * @param str
         * @returns {boolean}
         * @example
         *     <style>
         *         #foo {
         *             background-color: xssFilter.cssColorValidate('untrusted data');
         *         }
         *     </style>
         */
        cssColorValidate: function(str) {
            var CSS_HEX_COLOR_REGEX = /#[0-9a-fA-f]{3}([0-9a-fA-f]{3})?/,
                CSS_NAMED_COLOR_REGEX = /[a-zA-Z]{1,20}/;

            return CSS_HEX_COLOR_REGEX.test(sStr) && CSS_NAMED_COLOR_REGEX.test(sStr);
        }

    };
});
/** src/conf/colors.js **/
/*
 * WPA colors
 *
 *
 */
LBF.define('wpa.conf.colors', function(require, exports, module) {

	var getBackground = require('wpa.util.backgroundMixin');
        config = require('wpa.conf.config'),
        baseUrl = config.imageBaseUrl,
        png8Url = config.png8Url;

    //blue,green,yellow,pink,other
    //0|1|2|3|4


    //s: start color, e: end color, e: pure color
    //n: normal, h: hover
    var colors = {
        //固定图标4
        4: {
            0: {
                n: {
                    s: '#3e87d5',
                    e: '#327ccb',
                    p: '#278cde'
                },
                h: {
                    s: '#499ef8',
                    e: '#327dcc',
                    p: '#4ea9e9'
                }
            },
            1: {
                n: {
                    s: '#0aa60a',
                    e: '#009900',
                    p: '#009900'
                },
                h: {
                    s: '#14b914',
                    e: '#009a00',
                    p: '#3aa93a'
                }
            },
            2: {
                n: {
                    s: '#f5b400',
                    e: '#e0a501',
                    p: '#f5b400'
                },
                h: {
                    s: '#ffc934',
                    e: '#e1a602',
                    p: '#ffc934'
                }
            },
            3: {
                n: {
                    s: '#ee685e',
                    e: '#e05248',
                    p: '#ee685e'
                },
                h: {
                    s: '#f4867e',
                    e: '#e05348',
                    p: '#f3837b'
                }
            }
        },
        //固定图标5
        5: {
            0: {
                n: {
                    p: '#278cde'
                }
            },
            1: {
                n: {
                    p: '#009900'
                }
            },
            2: {
                n: {
                    p: '#f5b400'
                }
            },
            3: {
                n: {
                    p: '#ee685e'
                }
            },
            4: {
                n: {
                    p: '#ffffff'
                }
            }
        },
        //浮动图标1
        6: {
            0: {
                n: {
                    p: '#278cde'
                },
                h: {
                    p: '#4ea9e9'
                }
            },
            1: {
                n: {
                    p: '#009900'
                },
                h: {
                    p: '#3aa93a'
                }
            },
            2: {
                n: {
                    p: '#f5b400'
                },
                h: {
                    p: '#ffc934'
                }
            },
            3: {
                n: {
                    p: '#ee685e'
                },
                h: {
                    p: '#f3837b'
                }
            }
        },
        //对话框1
        8: {
            0: {
                n: {
                    p: baseUrl + 'dialog1_bg_blue.png',
                    p_png8: png8Url + 'dialog1_bg_blue.png'
                },
                h: {
                    p: '#278cde'
                }
            },
            1: {
                n: {
                    p: baseUrl + 'dialog1_bg_green.png',
                    p_png8: png8Url + 'dialog1_bg_green.png'
                },
                h: {
                    p: '#009900'
                }
            },
            2: {
                n: {
                    p: baseUrl + 'dialog1_bg_yellow.png',
                    p_png8: png8Url + 'dialog1_bg_yellow.png'
                },
                h: {
                    p: '#f5b400'
                }
            },
            3: {
                n: {
                    p: baseUrl + 'dialog1_bg_pink.png',
                    p_png8: png8Url + 'dialog1_bg_pink.png'
                },
                h: {
                    p: '#ee685e'
                }
            }
        }
    };

    //fetch the corresponding background according to the color passed in
    //n: normal, h: hover
    var backgrounds = {
        //4 pic
        4: {
            0: {
                n: getBackground({
                	tmpl: 1,
                	colors: colors[4][0].n
                }),
                h: getBackground({
                	tmpl: 1,
                	colors: colors[4][0].h
                })
            },
            1: {
                n: getBackground({
                	tmpl: 1,
                	colors: colors[4][1].n
                }),
                h: getBackground({
                	tmpl: 1,
                	colors: colors[4][1].h
                })
            },
            2: {
                n: getBackground({
                	tmpl: 1,
                	colors: colors[4][2].n
                }),
                h: getBackground({
                	tmpl: 1,
                	colors: colors[4][2].h
                })
            },
            3: {
                n: getBackground({
                	tmpl: 1,
                	colors: colors[4][3].n
                }),
                h: getBackground({
                	tmpl: 1,
                	colors: colors[4][3].h
                })
            }
        },
        5: {
        	0: {
                n: getBackground({
                	tmpl: 2,
                	colors: colors[5][0].n
                })
            },
            1: {
                n: getBackground({
                	tmpl: 2,
                	colors: colors[5][1].n
                })
            },
            2: {
                n: getBackground({
                	tmpl: 2,
                	colors: colors[5][2].n
                })
            },
            3: {
                n: getBackground({
                	tmpl: 2,
                	colors: colors[5][3].n
                })
            }
        },
        6: {
            0: {
                n: getBackground({
                    tmpl: 2,
                    colors: colors[6][0].n
                }),
                h: getBackground({
                    tmpl: 2,
                    colors: colors[6][0].h
                })
            },
            1: {
                n: getBackground({
                    tmpl: 2,
                    colors: colors[6][1].n
                }),
                h: getBackground({
                    tmpl: 2,
                    colors: colors[6][1].h
                })
            },
            2: {
                n: getBackground({
                    tmpl: 2,
                    colors: colors[6][2].n
                }),
                h: getBackground({
                    tmpl: 2,
                    colors: colors[6][2].h
                })
            },
            3: {
                n: getBackground({
                    tmpl: 2,
                    colors: colors[6][3].n
                }),
                h: getBackground({
                    tmpl: 2,
                    colors: colors[6][3].h
                })
            }
        },
        //对话框1
        8: {
            0: {
                n: getBackground({
                    tmpl: 3,
                    colors: colors[8][0].n
                }),
                h: getBackground({
                    tmpl: 2,
                    colors: colors[8][0].h
                })
            },
            1: {
                n: getBackground({
                    tmpl: 3,
                    colors: colors[8][1].n
                }),
                h: getBackground({
                    tmpl: 2,
                    colors: colors[8][1].h
                })
            },
            2: {
                n: getBackground({
                    tmpl: 3,
                    colors: colors[8][2].n
                }),
                h: getBackground({
                    tmpl: 2,
                    colors: colors[8][2].h
                })
            },
            3: {
                n: getBackground({
                    tmpl: 3,
                    colors: colors[8][3].n
                }),
                h: getBackground({
                    tmpl: 2,
                    colors: colors[8][3].h
                })
            }
        }
    };

    module.exports = exports = backgrounds;


});
/** src/util/borderRadiusMixin.js **/
/*
 * 统一添加圆角样式类
 *
 *
 */
LBF.define('wpa.util.borderRadiusMixin', function(require, exports, module) {

	//四个圆角
	var getBorderRadius = function(radius) {
        return [
            '-webkit-border-radius: {{radius}}px;',
            '-moz-border-radius: {{radius}}px;',
            'border-radius: {{radius}}px;'
        ].join('').replace(/\{\{radius\}\}/g, radius || 5);
    };

    //top两个圆角
    var getTopBorderRadius = function(radius) {
        return [
            '-webkit-border-top-left-radius: {{radius}}px;',
            '-moz-border-top-left-radius: {{radius}}px;',
            'border-top-left-radius: {{radius}}px;',
            '-webkit-border-top-right-radius: {{radius}}px;',
            '-moz-border-top-right-radius: {{radius}}px;',
            'border-top-right-radius: {{radius}}px;'
        ].join('').replace(/\{\{radius\}\}/g, radius || 5);
    };

    //bottom两个圆角
    var getBottomBorderRadius = function(radius) {
        return [
            '-webkit-border-bottom-left-radius: {{radius}}px;',
            '-moz-border-bottom-left-radius: {{radius}}px;',
            'border-bottom-left-radius: {{radius}}px;',
            '-webkit-border-bottom-right-radius: {{radius}}px;',
            '-moz-border-bottom-right-radius: {{radius}}px;',
            'border-bottom-right-radius: {{radius}}px;'
        ].join('').replace(/\{\{radius\}\}/g, radius || 5);
    };



    module.exports = exports = {
    	getBorderRadius: getBorderRadius,
    	getTopBorderRadius: getTopBorderRadius,
    	getBottomBorderRadius: getBottomBorderRadius
    };

});
/** src/util/urlBackground.js **/
/*
 * 获取png8的background链接
 *
 *
 */
LBF.define('wpa.util.urlBackground', function(require, exports, module) {

	var globalSettings = require('globalSettings'),
		png8Url = globalSettings.png8Url;

	var colors = {
		4: {
			blue: png8Url + 'fixed4_white_qq_blue.png',
			green: png8Url + 'fixed4_white_qq_green.png',
			yellow: png8Url + 'fixed4_white_qq_yellow.png',
			pink: png8Url + 'fixed4_white_qq_pink.png'
		}
	}

    module.exports = exports = function(dispType, color) {
    	if (colors[dispType]) {
	    	return colors[dispType][color];
    	}
    }

});
/** src/util/replaceImg3X.js **/
/*
 * 根据ratio来替换img为3倍图
 * 注释图的命名都是有规律的
 * 在images下
 * @author: vergilzhou
 * @version: 0.0.1
 * @date: 2016/06/02
 *
 */
LBF.define('wpa.util.replaceImg3X', function(require, exports) {

	return function(url, ratio) {
		return ratio > 2 ? url.replace(/2x\.png/g, '3x.png') : url;
	};

});
/** src/conf/tpl.js **/
/**
 * 存放一些公用模板的地方
 * 可以通过参数返回需要的模板
 * 因为产品需求，比如有头像和没头像算两种模板，而且不能在新建接触点的时候设置
 * 所以这里根据参数返回相似的模板
 * @author: vergilzhou
 * @version: 1.0.0
 * @date: 2016/02/04
 */

LBF.define('wpa.conf.tpl', function(require, exports, module) {

	var config = require('wpa.conf.config'),
		imageBaseUrl = config.imageBaseUrl,
		browser = require('lang.browser'),
		defaultConst = require('wpa.conf.defaultConst'),
		defaultEventTagName = defaultConst.defaultEventTagName;

	var ACTIONS = {
		1: 'callChat',
		2: 'callPhone',
		3: 'callAddPal',
		4: 'callAddGroup',
		5: 'callAddFan'
	};

	//media query
	var MEDIA_QUERY = {
		//iphone 5
		IP5: [
			'@media only screen ',
			'and (min-device-width : 320px) ',
			'and (max-device-width : 568px) '
		].join(''),
		//iphone 6 plus
		IP6P: [
			'@media only screen ',
			'and (min-device-width : 414px) ',
		    'and (max-device-width : 736px) '
    	].join('')

	};

	var isRatioSet = false,
		css;

	var TPLS = {
		/*
			投放到H5页面
			可以选择是否有叉
			可以选择是否有头像
			可以指定接触点行为
			见文档加关注大类第2小类
		*/
		1: {
			tpl: [
				'<div class="wpa-container {theme} {closable} {has-avatar} {class}">',
					'<div style="float:left;">',
						'<a href="javascript:void(0);" name="' + defaultEventTagName + '" data-event="callClose" class="icon-close"></a>',
						'<img class="avatar" src="{avatar}" />',
					'</div>',
					'<div style="overflow:hidden;">',
						'<div class="texts" style="width:calc(73%);">',
							'<p class="title">{title}</p>',
							'<p class="signature">{signature}</p>',
						'</div>',
						'<a class="btnText" style="background:{btnBgColor}" name="' + defaultEventTagName + '" data-event="{event}">{btnText}</a>',
					'</div>',
				'</div>'
    		].join('')
		},
		/*
			右下角对话框类
			可以指定接触点行为
			见文档加关注大类第1小类
		*/
		2: {
			tpl: [
    			'<div class="wpa-container">',
					'<a class="close" data-event="callClose" name="' + defaultEventTagName + '" href="javascript:void(0);"></a>',
					'<img class="avatar" src="{avatar}" />',
					'<div class="content">',
						'<p class="title">{title}</p>',
						'<p class="signature">{signature}</p>',
					'</div>',
					'<a class="btn" style="background: {btnBgColor};" href="javascript:void(0);" name="' + defaultEventTagName + '" data-event="{event}">{btnText}</a>',
				'</div>'
    		].join('')
		},
		/*
			投放到H5页面
			可以选择是否有叉
			可以选择是否有头像
			可以指定接触点行为
			见文档第1大类第9、10、11小类
		*/
		3: {
			tpl: [
				'<div class="wpa-container {theme} {closable} {has-avatar} {class}">',
					'<div style="float:left;">',
						'<a href="javascript:void(0);" name="' + defaultEventTagName + '" data-event="callClose" class="icon-close"></a>',
						'<img class="avatar" src="{avatar}" />',
					'</div>',
					'<div style="overflow:hidden;">',
						'<div class="texts" style="width:{calc};">',
							'<p class="title">{title}</p>',
							'<p class="signature">{signature}</p>',
						'</div>',
						'<div class="actions {has-btnText}">',
							'<a class="action {hasAction2}" href="javascript:void(0);" name="' + defaultEventTagName + '" data-event="{event2}"><span class="{icon2} icon"></span>',
							'</a><span class="spliter {spliterLength}"></span><a class="action" href="javascript:void(0);" name="' + defaultEventTagName + '" data-event="{event1}">',
								// '<span class="{icon1} icon"></span>',
								'<span class="{icon1} icon"></span><br/>',
								'<span class="btnText">{fixedBtnText}</span>',
							'</a>',
						'</div>',
					'</div>',
				'</div>'
			].join('')
		},
		/*
			QQ图文图标
			底部浮层
			高度为140px
			带企鹅或者电话图标的
			见第一大类第13小类
		*/
		4: {
			tpl: [
				'<div class="wpa-container {has-avatar}">',
					'<div style="float:left;">',
						'<img class="avatar" src="{avatar}" />',
					'</div>',
					'<div style="overflow:hidden;">',
						'<div class="texts" style="width:{calc};">',
							'<p class="title">{title}</p>',
							'<p class="signature">{signature}</p>',
						'</div>',
						'<div class="actions {has-btnText}">',
							'<a class="action {hasAction2}" href="javascript:void(0);" name="' + defaultEventTagName + '" data-event="{event2}"><span class="{icon2} icon"></span>',
							'</a><span class="spliter {spliterLength}"></span><a class="action" href="javascript:void(0);" name="' + defaultEventTagName + '" data-event="{event1}">',
								'<span class="{icon1} icon"></span>',
								'<span class="btnText">{fixedBtnText}</span>',
							'</a>',
						'</div>',
					'</div>',
				'</div>'
			].join('')
		},
		/*
			QQ图文图标
			底部浮层
			高度为140px
			按钮类
			见第四大类第4小类
		*/
		5: {
			tpl: [
				'<div class="wpa-container {has-avatar}">',
					'<div style="float:left;">',
						'<img class="avatar" src="{avatar}" />',
					'</div>',
					'<div style="overflow:hidden;">',
						'<div class="texts" style="width:calc(73%);">',
							'<p class="title">{title}</p>',
							'<p class="signature">{signature}</p>',
						'</div>',
						'<a href="javascript:void(0);" name="' + defaultEventTagName + '" data-event="{event1}" class="button {btnWithoutIconAdd}">',
							'<span class="icon-add {btnWithoutIconAdd}"></span>',
							'<span>{fixedBtnText}</span>',
						'</a>',
					'</div>',
				'</div>'
			].join('')
		},
		/*
			H5
			高度为140px
			按钮类
			见第四大类第4小类
			更新后的
		*/
		6: {
			tpl: [
				'<div class="wpa-container {theme} {closable} {has-avatar} {class}">',
					'<div style="float:left;">',
						'<a href="javascript:void(0);" name="' + defaultEventTagName + '" data-event="callClose" class="icon-close"></a>',
						'<img class="avatar" src="{avatar}" />',
					'</div>',
					'<div style="overflow:hidden;">',
						'<div class="texts" style="width:calc(73%);">',
							'<p class="title">{title}</p>',
							'<p class="signature">{signature}</p>',
						'</div>',
						'<a href="javascript:void(0);" name="' + defaultEventTagName + '" data-event="{event1}" class="button {btnWithoutIconAdd}">',
							'<span class="icon-add"></span>',
							'<span>{fixedBtnText}</span>',
						'</a>',
					'</div>',
				'</div>'
			].join('')
		}
	};

	var getSizeFunc = require('wpa.util.getSize');

	var getCssTpl = function(params) {

		var ratio = params.ratio,
			type = params.type,
			getSize = getSizeFunc(ratio);
		
		if (!isRatioSet) {
			css = {
				/*
					投放到H5页面
					可以选择是否有叉
					可以选择是否有头像
					可以指定接触点行为
					见文档加关注大类第2小类
				*/
				1: {
		    		cssText: [
						'* {{common}margin: 0;padding: 0;}',
						'.wpa-container {{dib}position: relative;width: 100%;height: ' + getSize(130)  + 'px;line-height: ' + getSize(126) + 'px;}',
						'.theme-1 {background: #fff;}',
						'.theme-2 {background-color: rgba(0, 0, 0, 0.8);}',
						'.theme-3 {background: #f0f0f0;}',
						'.wpa-container.middle {background: transparent;}',
						'.avatar {width: ' + getSize(86)  + 'px;height: ' + getSize(86)  + 'px;border-radius: 50%;vertical-align: middle;margin-left: ' + getSize(30)  + 'px;display: none;}',
						'.has-avatar .avatar {{dib}}',
						'.has-avatar .texts, .closable .texts {margin-left: ' + getSize(10)  + 'px;}',
						'.closable .avatar {margin-left: ' + getSize(20)  + 'px;}',
						MEDIA_QUERY.IP5 + '{.closable .avatar {margin-left:' + getSize(20)  + 'px;}}',
						MEDIA_QUERY.IP6P + '{.closable .avatar {margin-left:' + getSize(30)  + 'px;}}',
						'.closable .icon-close {{dib}}',
						'.middle.closable .icon-close {display:none;}',
						'.middle.closable .texts {margin-left: ' + getSize(30)  + 'px;}',
						'.icon-qq {{dib}width: ' + getSize(37)  + 'px;height: ' + getSize(44)  + 'px;vertical-align: middle;background: url(' + imageBaseUrl + '/icon-qq-44-2x.png) no-repeat;background-size:' + getSize(37)  + 'px ' + getSize(44)  + 'px;}',
						'.icon-close {display: none;width: ' + getSize(20)  + 'px;height: ' + getSize(20)  + 'px;vertical-align: middle;background: url(' + imageBaseUrl + '/icon-close-2x.png) no-repeat;margin-left: ' + getSize(20)  + 'px;background-size:' + getSize(20)  + 'px ' + getSize(20)  + 'px;}',
						MEDIA_QUERY.IP5 + '{.icon-close {margin-left:' + getSize(20)  + 'px;}}',
						MEDIA_QUERY.IP6P + '{.icon-close {margin-left:' + getSize(30)  + 'px;}}',
						'.theme-2 .icon-close {background: url(' + imageBaseUrl + '/icon-close-for-black-2x.png) no-repeat;background-size:' + getSize(20)  + 'px ' + getSize(20)  + 'px;}',
						'.texts {{dib}vertical-align: middle;line-height: ' + getSize(40)  + 'px;margin-top: ' + getSize(0/*previous value is: 10*/)  + 'px;margin-left: ' + getSize(30)  + 'px;position:relative;top:-2px;}',
						'.title {font-size: ' + getSize(34)  + 'px;color: #000;}',
						'.signature {font-size: ' + getSize(28)  + 'px;color: #777;position:relative;top: 6px;}',
						'.theme-2 .title, .theme-2 .signature {color: #fff;}',
						'.middle .title {color: #000!important;}',
						'.middle .signature {color: #999!important;}',
						'.btnText {cursor: pointer;background: #0067ed;border-radius: ' + getSize(10)  + 'px;{dib}font-size: ' + getSize(28)  + 'px;color: #fff;height: ' + getSize(26)  + 'px;max-width: ' + getSize(147)  + 'px;line-height: ' + getSize(26)  + 'px;padding: ' + getSize(17) + 'px ' + getSize(18)  + 'px;position: absolute;top: ' + getSize(35)  + 'px;right: ' + getSize(30)  + 'px;margin-left: ' + getSize(30)  + 'px;{ell}}',
						'.theme-2 .btnText {background: transparent!important;border: ' + getSize(2)  + 'px solid #fff;padding: ' + getSize(15)  + 'px ' + getSize(16)  + 'px;height: ' + getSize(22)  + 'px;line-height:' + getSize(22)  + 'px;}'
		    		].join('')
				},
				/*
					右下角对话框类
					可以指定接触点行为
					见文档加关注大类第1小类
				*/
				2: {
		    		cssText: [
		    			'* {{common}margin: 0;padding: 0;}',
						'.wpa-container {{dib}width: 402px;height: 198px;border-radius: 2px;position: relative;background: #fff;border: 1px solid #dadee7;font-family:"microsoft yahei";font-size: 14px;{boxShadow}}',
						'.close {position: absolute;top: 15px;right: 15px;{dib}width: 14px;height: 14px;background: url(' + imageBaseUrl + '/icon-close.png) no-repeat;background-size:14px 14px;}',
						'.avatar {position: absolute;top: 26px;left: 26px;border-radius: 100%;width: 94px;height: 94px;}',
						'.content {position: absolute;top: 30px;left: 135px;}',
						'.title {font-size: 22px;{ell}}',
						'.signature {color: #777;line-height: 24px;margin-top: 10px;width: 226px;}',
						'.btn {{ell}text-decoration: none;color: #fff;position: absolute;right: 15px;bottom: 15px;width: 100px;border-radius: 2px;text-align: center;height: 35px;line-height: 35px;}'
		    		].join('')
				},
				/*
					投放到H5页面
					可以选择是否有叉
					可以选择是否有头像
					可以指定接触点行为
					见文档第1大类第9、10、11小类
				*/
				3: {
					cssText: [
						'* {{common}margin: 0;padding: 0;}',
						'.wpa-container {{dib}position: relative;width: 100%;height: ' + getSize(130) + 'px;line-height: ' + getSize(126) + 'px;}',
						'.theme-1 {background: #fff;}',
						'.theme-2 {background-color: rgba(0, 0, 0, 0.8);}',
						'.theme-3 {background: #f0f0f0;}',
						'.wpa-container.middle {background: transparent!important;}',
						'.avatar {width: ' + getSize(86) + 'px;height: ' + getSize(86) + 'px;border-radius: 50%;vertical-align: middle;margin-left: ' + getSize(30) + 'px;display: none;}',
						'.has-avatar .avatar {{dib}}',
						'.has-avatar .texts, .closable .texts {margin-left: ' + getSize(18) + 'px;}',
						MEDIA_QUERY.IP5 + '{.has-avatar .texts, .closable .texts {margin-left: ' + getSize(18) + 'px;}}',
						MEDIA_QUERY.IP6P + '{.has-avatar .texts, .closable .texts {margin-left: ' + getSize(30) + 'px;}}',
						'.closable .avatar {margin-left: ' + getSize(18) + 'px;}',
						MEDIA_QUERY.IP5 + '{.closable .avatar {margin-left:' + getSize(20)  + 'px;}}',
						MEDIA_QUERY.IP6P + '{.closable .avatar {margin-left:' + getSize(30)  + 'px;}}',
						'.closable .icon-close {{dib}}',
						'.middle.closable .icon-close {display:none;}',
						//'.action .icon {position: absolute;top: ' + getSize(44) + 'px;left: ' + getSize(40) + 'px;display: none;}',
						'.action .icon {position:relative; top: ' + getSize(44) + 'px;display: none;}',
						//'.has-btnText .action .icon {left: ' + getSize(56) + 'px;}',
						'.action .icon.icon-qq {{dib}width: ' + getSize(37) + 'px;height: ' + getSize(44) + 'px;vertical-align: middle;background: url(' + imageBaseUrl + '/icon-qq-44-2x.png) no-repeat;background-size:' + getSize(37)  + 'px ' + getSize(44)  + 'px;}',
						'.action .icon.icon-im {{dib}width: ' + getSize(44) + 'px;height: ' + getSize(44) + 'px;vertical-align: middle;background: url(' + imageBaseUrl + '/icon-im-44-blue-2x.png) no-repeat;background-size:' + getSize(44)  + 'px ' + getSize(44)  + 'px;}',
						'.action .icon.icon-call {{dib}width: ' + getSize(40) + 'px;height: ' + getSize(42) + 'px;vertical-align: middle;background: url(' + imageBaseUrl + '/icon-call-44-2x.png) no-repeat;background-size:' + getSize(40)  + 'px ' + getSize(42)  + 'px;}',
						'.icon-close {display: none;width: ' + getSize(20) + 'px;height: ' + getSize(20) + 'px;vertical-align: middle;background: url(' + imageBaseUrl + '/icon-close-2x.png) no-repeat;margin-left: ' + getSize(20) + 'px;background-size:' + getSize(20)  + 'px ' + getSize(20)  + 'px;}',
						MEDIA_QUERY.IP5 + '{.icon-close {margin-left:' + getSize(20)  + 'px;}}',
						MEDIA_QUERY.IP6P + '{.icon-close {margin-left:' + getSize(30)  + 'px;}}',
						'.theme-2 .icon-close {background: url(' + imageBaseUrl + '/icon-close-for-black-2x.png) no-repeat;background-size:' + getSize(20)  + 'px ' + getSize(20)  + 'px;}',
						'.texts {{dib}vertical-align: middle;line-height: ' + getSize(40) + 'px;margin-top: ' + getSize(-4) + 'px;margin-left: ' + getSize(30) + 'px;}',
						'.title {font-size: ' + getSize(34) + 'px;color: #000;{ell}}',
						'.signature {font-size: ' + getSize(28) + 'px;color: #777;{ell}position:relative;top: ' + getSize(5) + 'px;}',
						'.theme-2 .title, .theme-2 .signature {color: #fff;}',
						'.middle .title {color: #000!important;}',
						'.middle .signature {color: #999!important;}',
						'.spliter {{dib}vertical-align: middle;height: ' + getSize(56) + 'px;width: 1px;background: #d6d6d6;}',
						'.spliter.spliter-long {height: ' + getSize(80) + 'px;}',
						'.theme-2 .spliter {background: #565656;}',
						'.middle .spliter {background: #d6d6d6!important;}',
						'.actions {{dib}vertical-align: middle;position: absolute;right: 0;top: 0;height: ' + getSize(130) + 'px;}',
						'.actions span.icon {cursor: pointer;}',
						'.btnText {font-size: ' + getSize(22) + 'px;color: #777;display: none;}',
						'.theme-2 .btnText, .theme-2 .title, .theme-2 .signature {color: #fff;}',
						'.middle .btnText {color: #777!important;}',
						//'.action {margin-top: -3px;{dib}vertical-align: middle;text-align: center;line-height: ' + getSize(40) + 'px;position: relative;width: ' + getSize(122) + 'px;height: ' + getSize(130) + 'px;}',
						'.action {margin-top: -3px;{dib}vertical-align: middle;text-align: center;line-height: ' + getSize(40) + 'px;position: relative;width: ' + getSize(100) + 'px;height: ' + getSize(130) + 'px;}',
						MEDIA_QUERY.IP5 + '{.action {width: ' + getSize(100) + 'px;}}',
						MEDIA_QUERY.IP6P + '{.action {width: ' + getSize(120) + 'px;}}',
						'.has-btnText .action {width: ' + getSize(150) + 'px;}',
						'.has-btnText .action .icon {top: ' + getSize(28) + 'px;}',
						'.action.no-action2 {display:none;}',
						// '.has-btnText .action .btnText {{dib}position: relative;top: ' + getSize(77) + 'px;{ell}}'
						'.has-btnText .action .btnText {{dib}position: relative;top: ' + getSize(30) + 'px;{ell}}'
					].join('')
				},
				/*
					QQ图文图标
					底部浮层
					目前只有底部的
					高度为140px
					带企鹅或者电话图标的
					见第一大类第13小类
				*/
				4: {
					cssText: [
						'* {{common}margin: 0;padding: 0;}',
						'.wpa-container {{dib}position: relative;width: 100%;height: ' + getSize(140) + 'px;line-height: ' + getSize(136) + 'px;background: transparent;}',
						'.avatar {width: ' + getSize(100) + 'px;height: ' + getSize(100) + 'px;border-radius: 50%;vertical-align: middle;margin-left: ' + getSize(/*30*/0) + 'px;display: none;}',
						'.has-avatar .avatar {{dib}}',
						'.has-avatar .texts {margin-left: ' + getSize(22) + 'px;}',
						'.action .icon {position: absolute;top: ' + getSize(44) + 'px;left: ' + getSize(40) + 'px;display: none;}',
						'.has-btnText .action .icon {left: ' + getSize(57) + 'px;}',
						'.action .icon.icon-qq {{dib}width: ' + getSize(37) + 'px;height: ' + getSize(44) + 'px;vertical-align: middle;background: url(' + imageBaseUrl + '/icon-qq-44-2x.png) no-repeat;background-size:' + getSize(37)  + 'px ' + getSize(44)  + 'px;}',
						'.action .icon.icon-im {{dib}width: ' + getSize(44) + 'px;height: ' + getSize(44) + 'px;vertical-align: middle;background: url(' + imageBaseUrl + '/icon-im-44-blue-2x.png) no-repeat;background-size:' + getSize(44)  + 'px ' + getSize(44)  + 'px;}',
						'.action .icon.icon-call {{dib}width: ' + getSize(40) + 'px;height: ' + getSize(42) + 'px;vertical-align: middle;background: url(' + imageBaseUrl + '/icon-call-44-2x.png) no-repeat;background-size:' + getSize(40)  + 'px ' + getSize(42)  + 'px;}',
						'.texts {{dib}vertical-align: middle;line-height: ' + getSize(40) + 'px;margin-top: ' + getSize(-4) + 'px;margin-left: ' + getSize(30) + 'px;}',
						'.title {font-size: ' + getSize(34) + 'px;color: #000;}',
						'.signature {font-size: ' + getSize(28) + 'px;color: #777;position:relative; top:' + getSize(5) + 'px;}',
						'.spliter {{dib}vertical-align: middle;height: ' + getSize(56) + 'px;width: 1px;background: #d6d6d6;}',
						'.spliter.spliter-long {height: ' + getSize(80) + 'px;}',
						'.actions {{dib}vertical-align: middle;position: absolute;right: ' + getSize(-20) + 'px;top: 0;height: ' + getSize(140) + 'px;}',
						'.actions span.icon {cursor: pointer;}',
						'.btnText {font-size: ' + getSize(22) + 'px;color: #777;display: none;{ell}}',
						'.action {{dib}vertical-align: middle;text-align: center;line-height: ' + getSize(40) + 'px;position: relative;width: ' + getSize(122) + 'px;height: ' + getSize(140) + 'px;}',
						MEDIA_QUERY.IP5 + '.action {{width: ' + getSize(100) + 'px;}}',
						MEDIA_QUERY.IP6P + '.action {{width: ' + getSize(120) + 'px;}}',
						'.has-btnText .action {width: ' + getSize(150) + 'px;}',
						'.has-btnText .action .icon {top: ' + getSize(28) + 'px;}',
						'.action.no-action2 {display:none;}',
						'.has-btnText .action .btnText {{dib}{ell}position: relative;top: ' + getSize(77) + 'px;}'
					].join('')
				},
				/*
					QQ图文图标
					底部浮层
					高度为140px
					按钮类
					见第四大类第4小类
				*/
				5: {
					cssText: [
						'* {{common}margin: 0;padding: 0;}',
						'.wpa-container {{dib}position: relative;width: 100%;height: ' + getSize(140) + 'px;line-height: ' + getSize(136) + 'px;background: transparent;}',
						'.avatar {width: ' + getSize(100) + 'px;height: ' + getSize(100) + 'px;border-radius: 50%;vertical-align: middle;margin-left: ' + getSize(/*30*/0) + 'px;display: none;}',
						'.has-avatar .avatar {{dib}}',
						'.has-avatar .texts {margin-left: ' + getSize(22) + 'px;}',
						'.texts {{dib}vertical-align: middle;line-height: ' + getSize(40) + 'px;margin-top: ' + getSize(0/*previous value is 10*/) + 'px;margin-left: ' + getSize(30) + 'px;position:relative;top:-2px;}',
						'.title {font-size: ' + getSize(34) + 'px;color: #000;}',
						'.signature {font-size: ' + getSize(28) + 'px;color: #777;position:relative;top:6px;}',
						'.button {{dib}text-decoration: none;color: #00a5e0;font-size: ' + getSize(24) + 'px;padding: ' + getSize(12) + 'px ' + getSize(16) + 'px;max-width: ' + getSize(110) + 'px;height: ' + getSize(24) + 'px;line-height: ' + getSize(24) + 'px;text-align: center;border-radius: ' + getSize(10) + 'px;border: ' + getSize(2) + 'px solid #00a5e0;position: absolute;right: ' + getSize(/*30*/0) + 'px;top: ' + getSize(45) + 'px;}',
						'.btn-without-icon-add {padding: ' + getSize(12) + 'px ' + getSize(30) + 'px;}',
						'.button.btn-without-icon-add .icon-add {display:none;}',
						'.icon-add {{dib}width: ' + getSize(18) + 'px;height: ' + getSize(18) + 'px;background: url(' + imageBaseUrl + '/icon-add-2x.png) no-repeat;margin-right:' + getSize(10) + 'px;background-size:' + getSize(18)  + 'px ' + getSize(18)  + 'px;}'
					].join('')
				},
				/*
					H5
					高度为140px
					按钮类
					见第四大类第2小类
					更新后的，按钮统一加号固定文字，白底
				*/
				6: {
					cssText: [
						'* {{common}margin: 0;padding: 0;}',
						'.wpa-container {{dib}position: relative;width: 100%;height: ' + getSize(140) + 'px;line-height: ' + getSize(136) + 'px;background: transparent;}',
						'.theme-1 {background: #fff;}',
						'.theme-2 {background-color: rgba(0, 0, 0, 0.8);}',
						'.theme-3 {background: #f0f0f0;}',
						'.wpa-container.middle {background: transparent;}',
						'.closable .avatar {margin-left: ' + getSize(20)  + 'px;}',
						MEDIA_QUERY.IP5 + '{.closable .avatar {margin-left:' + getSize(20)  + 'px;}}',
						MEDIA_QUERY.IP6P + '{.closable .avatar {margin-left:' + getSize(30)  + 'px;}}',
						'.closable .icon-close {{dib}}',
						'.middle.closable .icon-close {display:none;}',
						'.middle.closable .texts {margin-left: ' + getSize(30)  + 'px;}',
						'.avatar {width: ' + getSize(100) + 'px;height: ' + getSize(100) + 'px;border-radius: 50%;vertical-align: middle;margin-left: ' + getSize(30) + 'px;display: none;}',
						'.icon-close {display: none;width: ' + getSize(20)  + 'px;height: ' + getSize(20)  + 'px;vertical-align: middle;background: url(' + imageBaseUrl + '/icon-close-2x.png) no-repeat;margin-left: ' + getSize(20)  + 'px;background-size:' + getSize(20)  + 'px ' + getSize(20)  + 'px;}',
						MEDIA_QUERY.IP5 + '{.icon-close {margin-left:' + getSize(20)  + 'px;}}',
						MEDIA_QUERY.IP6P + '{.icon-close {margin-left:' + getSize(30)  + 'px;}}',
						'.has-avatar .avatar {{dib}}',
						'.has-avatar .texts {margin-left: ' + getSize(22) + 'px;}',
						'.texts {{dib}vertical-align: middle;line-height: ' + getSize(40) + 'px;margin-top: ' + getSize(0/*previous value is 10*/) + 'px;margin-left: ' + getSize(30) + 'px;position:relative;top:-2px;}',
						'.title {font-size: ' + getSize(34) + 'px;color: #000;}',
						'.signature {font-size: ' + getSize(28) + 'px;color: #777;position:relative;top:6px;}',
						'.theme-2 .icon-close {background: url(' + imageBaseUrl + '/icon-close-for-black-2x.png) no-repeat;background-size:' + getSize(20)  + 'px ' + getSize(20)  + 'px;}',
						'.button {{dib}text-decoration: none;color: #00a5e0;font-size: ' + getSize(24) + 'px;padding: ' + getSize(12) + 'px ' + getSize(16) + 'px;height: ' + getSize(24) + 'px;line-height: ' + getSize(24) + 'px;text-align: center;border-radius: ' + getSize(10) + 'px;border: ' + getSize(2) + 'px solid #00a5e0;position: absolute;right: ' + getSize(30) + 'px;top: ' + getSize(45) + 'px;}',
						MEDIA_QUERY.IP5 + '{.button {top: ' + getSize(45) + 'px;padding: ' + getSize(12) + 'px ' + getSize(16) + 'px;font-size: ' + getSize(24) + 'px;height: ' + getSize(24) + 'px;line-height: ' + getSize(24) + 'px;}}',
						MEDIA_QUERY.IP6P + '{.button {top: ' + getSize(38) + 'px;padding: ' + getSize(12) + 'px ' + getSize(24) + 'px;font-size: ' + getSize(28) + 'px;height: ' + getSize(36) + 'px;line-height: ' + getSize(36) + 'px;}}',
						'.icon-add {{dib}width: ' + getSize(18) + 'px;height: ' + getSize(18) + 'px;background: url(' + imageBaseUrl + '/icon-add-2x.png) no-repeat;margin-right:' + getSize(10) + 'px;background-size:' + getSize(18)  + 'px ' + getSize(18)  + 'px;}',
						'.theme-2 .title, .theme-2 .signature, .theme-2 .button {color: #fff;}',
						'.theme-2 .button {border-color: #fff;}',
						'.theme-2 .icon-add {background: url(' + imageBaseUrl + '/icon-add-for-black-2x.png) no-repeat;background-size:9px 9px;}',
						'.middle .title {color: #000!important;}',
						'.middle .signature {color: #999!important;}',
						'.middle .button {color: #00a5e0!important;border-color: #00a5e0!important;}',
						'.btn-without-icon-add {padding: ' + getSize(12) + 'px ' + getSize(30) + 'px;}',
						'.button.btn-without-icon-add .icon-add {display:none;}',
						'.middle .icon-add {background: url(' + imageBaseUrl + '/icon-add-2x.png) no-repeat;background-size:9px 9px;}'
					].join('')
				}
			};
			isRatioSet = true;
		}
		
		return css[type].cssText;
	};

	module.exports = exports = function(type, options) {

		type = type || 1;
		options = options || {};
		var targetTpl = TPLS[type],
			ratio = options.ratio,
			tpl = targetTpl.tpl,
			cssText = getCssTpl({
				type: type,
				ratio: ratio
			}),
			hasBtnText = typeof options.hasBtnText !== undefined && options.hasBtnText ? 'has-btnText' : '',
			hasAvatar = typeof options.hasAvatar !== undefined && options.hasAvatar ? 'has-avatar' : '',
			eventList = options.eventList || [],
			fixedBtnText = options.fixedBtnText || '',
			iconList = options.iconList || [],
			btnWithoutIconAdd = options.btnWithoutIconAdd ? 'btn-without-icon-add' : '',
			event1 = eventList[0] || '',
			event2 = eventList[1] || '',
			icon1 = iconList[0] || '',
			icon2 = iconList[1] || '',
			hasAction2 = icon2 ? '' : 'no-action2',
			//spliter会根据是一个icon还是两个icon有不同的长度
			isSpliterLong = !icon2 ? 'spliter-long' : '',
			//有些接触点只有1个icon，有些有2个icon
			//例如第一大类的9、10、11（1个），第一大类的14(2个)
			//calc会根据icon个数来取不同的值
			calc = icon2 ? 'calc(60%)' : 'calc(73%)';

		//如果有按钮文字，而没有固定按钮文字
		//则固定按钮文字为传入参数
		if (hasBtnText && !fixedBtnText) {
			tpl = tpl.replace(/fixedBtnText/, 'btnText');
		}

		//这里必须要用一个新的变量来存放tpl执行replace后的值
		var compiledTpl = tpl.replace(/\{has-avatar\}/g, hasAvatar)
						.replace(/\{has-btnText\}/g, hasBtnText)
						.replace(/\{fixedBtnText\}/g, fixedBtnText)
						.replace(/\{icon1\}/g, icon1)
						.replace(/\{icon2\}/g, icon2)
						.replace(/\{event1\}/g, event1)
						.replace(/\{event2\}/g, event2)
						.replace(/\{spliterLength\}/g, isSpliterLong)
						.replace(/\{hasAction2\}/g, hasAction2)
						.replace(/\{btnWithoutIconAdd\}/g, btnWithoutIconAdd)
						.replace(/\{calc\}/g, calc);

		return function(params) {

			params = params || {};

			var eventName = ACTIONS[params.event] || ACTIONS[1];

			//这里也必须要用一个新的变量来存放tpl执行replace后的值
			var result = compiledTpl.replace(/\{event\}/g, eventName);

			//图的倍率修改
			if (ratio > 2) {
				cssText = cssText.replace(/2x\.png/g, '3x.png');
			}

			return {
				tpl: result,
				cssText: cssText
			}
		}
	};

});

/** lib/lbf/lang/dateTool.js **/
/**
 * @fileOverview
 * @author rainszhang, amoschen
 * @version 2
 * Created: 12-11-27 下午5:11
 * Last update amoschen 13-03-01
 */
LBF.define('lang.dateTool', function(){
    var ONE_DAY = 1000*3600*24;

    //month & week's array
    var fullMonthName = ['January', 'February', 'March', 'April', 'May', 'June','July','August', 'September', 'October', 'November', 'December'],
        fullWeekName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        /**
         * 添前导0
         * @inner
         */
            fillZero = function (num) {
            return num < 10 ? '0' + num : num;
        },
        /**
         * 计算时间差距，毫秒
         * @inner
         */
            timeDist = function(date1, date2) {
            date2 = date2 || new Date(date1.getFullYear(), 0, 1);
            return date1 - date2;
        },
    // 若添加更多格式，开发只需在pri中加上即可
        pri = {
            // d: 月份中的第几天，有前导零的 2位数字，01 到 31
            d : function (d) {
                return fillZero(this.j(d));
            },
            // D：星期中的第几天，文本表示，3个字母，Mon 到 Sun
            D : function (d) {
                return this.l(d).substr(0, 3);
            },
            // j:月份中的第几天，没有前导零，1 到 31
            j : function (d) {
                return d.getDate();
            },
            // l: 星期几，完整的文本格式，Sunday 到 Saturday
            l : function (d) {
                return fullWeekName[d.getDay()];
            },
            // N：ISO-8601 格式数字表示的星期中的第几天，1（表示星期一）到 7（表示星期天）
            N: function (d) {
                return this.w(d) || 7;
            },
            // w：星期中的第几天，数字表示，0（表示星期天）到 6（表示星期六）
            w : function (d) {
                return d.getDay();
            },
            // z: 一年中的第几天，0 到 366
            z : function (d){
                return Math.floor(timeDist(d) / 86400000);
            },
            // F：月份，完整的文本格式，例如 January 或者 March，January 到 December
            F : function (d) {
                return fullMonthName[d.getMonth()];
            },
            // m：数字表示的月份，有前导零， 01 到 12
            m : function (d) {
                return fillZero(this.n(d));
            },
            // n：数字表示的月份，没有前导零，1 到 12
            n : function (d) {
                return d.getMonth() + 1;
            },
            // M：三个字母缩写表示的月份，Jan 到 Dec
            M : function (d) {
                return this.F(d).substr(0, 3);
            },
            // Y：4 位数字表示的年份
            Y : function (d) {
                return d.getFullYear();
            },
            // y：2 位数字表示的年份
            y : function (d) {
                return this.Y(d).toString().slice(-2);
            },
            // a：显示am/pm
            a : function (d) {
                return d.getHours() < 12 ? 'am' : 'pm';
            },
            // A：显示AM/PM
            A : function (d) {
                return this.a(d).toUpperCase();
            },
            // g：小时，12 小时格式，没有前导零，1 到 12
            g : function (d) {
                return d.getHours() % 12 || 12;
            },
            // G：小时，24 小时格式，没有前导零，0 到 23
            G : function (d) {
                return d.getHours();
            },
            // h：小时，12 小时格式，有前导零，01 到 12
            h : function (d) {
                return fillZero(this.g(d));
            },
            // H：小时，24 小时格式，有前导零，00 到 23
            H : function (d) {
                return fillZero(this.G(d));
            },
            // i：有前导零的分钟数，00 到 59
            i : function (d) {
                return fillZero(d.getMinutes());
            },
            // s：秒数，有前导零，00 到 59
            s : function (d) {
                return fillZero(d.getSeconds());
            }
        };

    /**
     * Date enhancement tools
     * @class dateTool
     * @namespace lang
     * @module lang
     */
    var dateTool = {
        /**
         * 格式化日期为字符串
         * @method format
         * @param {String} expr 表达式
         * @param {Number|Date} [date=new Date()] 日期
         * @return {String} 字符串
         * @example
         *      format参数如下（来源于PHP的date函数的参数子集）：
         *	    日期：
         *		    d：月份中的第几天，有前导零的 2位数字，01 到 31
         *		    D：星期中的第几天，文本表示，3个字母，Mon 到 Sun
         *		    j：月份中的第几天，没有前导零，1 到 31
         *		    l: 星期几，完整的文本格式，Sunday 到 Saturday
         *		    N：ISO-8601 格式数字表示的星期中的第几天，1（表示星期一）到 7（表示星期天）
         *		    w：星期中的第几天，数字表示，0（表示星期天）到 6（表示星期六）
         *		    z: 一年中的第几天，0 到 366
         *	    月份：
         *		    F：月份，完整的文本格式，例如 January 或者 March，January 到 December
         *		    m：数字表示的月份，有前导零， 01 到 12
         *		    n：数字表示的月份，没有前导零，1 到 12
         *		    M：三个字母缩写表示的月份，Jan 到 Dec
         *	    年份：
         *		    Y：4 位数字表示的年份
         *		    y：2 位数字表示的年份
         *	    上下午标识：
         *		    a：显示am/pm
         *		    A：显示AM/PM
         *	    小时：
         *		    g：小时，12 小时格式，没有前导零，1 到 12
         *		    G：小时，24 小时格式，没有前导零，0 到 23
         *		    h：小时，12 小时格式，有前导零，01 到 12
         *		    H：小时，24 小时格式，有前导零，00 到 23
         *	    分钟：
         *		    i：有前导零的分钟数，00 到 59
         *	    秒数：
         *		    s：秒数，有前导零，00 到 59
         * @example
         *      date.format('Y-m-d H:i:s A l'); // output:2012-04-19 15:17:56 AM Thursday
         *      date.format('Y年m月d日 H:i:s A l'); // output:2012年04月19日 15:18:38 AM Thursday
         *      date.format('\\Y是Y'); // output:Y是2012
         */
        format: function(expr, date){
            expr = expr || 'Y-m-d H:i:s';

            if (arguments.length == 1) {
                date = new Date();
            } else if(!(date instanceof Date)){
                date = new Date(parseInt(date) || 0);
            }
            return expr.replace(/\\?([a-z])/gi, function(str, $1) {
                if (pri[str]) {
                    return pri[str].call(pri, date);
                } else {
                    return $1;
                }
            });
        },

        /**
         * Is The year a leap year
         * @method isLeapYear
         * @param {Date|String} year
         * @return {boolean}
         * @example
         *      dateTool.isLeapYear('2000'); // true
         *      dateTool.isLeapYear(new Date()); // it depends
         */
        isLeapYear : function(year){
            year.getTime && (year = dateTool.format('Y', year));
            year = parseInt(year, 10);
            return !!(0 == year % 4 && ((year % 100 != 0) || (year % 400 == 0)));
        },

        /**
         * Get last date ( One day before the given date ).
         * @method lastDay
         * @param {Date|Number} date
         * @return {Date}
         * @example
         *      dateTool.lastDay(new Date()); // returns yesterday
         *      dateTool.lastDay(new Date('2000-1-10')); // returns new Date('2000-1-9')
         */
        lastDay: function(date){
            return new Date(+date - ONE_DAY);
        },

        /**
         * Get date of the next day
         * @method nextDay
         * @param {Date|Number} date
         * @return {Date}
         * @example
         *      dateTool.lastDay(new Date()); // returns tomorrow
         *      dateTool.lastDay(new Date('2000-1-10')); // returns new Date('2000-1-11')
         */
        nextDay: function(date){
            return new Date(+date + ONE_DAY);
        },

        /**
         * Get the date of the day one month before
         * @method lastMonth
         * @param {Date|Number} date
         * @return {Date}
         * @example
         *      dateTool.lastDay(new Date()); // returns one month ago
         *      dateTool.lastDay(new Date('2000-1-10')); // returns new Date('1999-12-10')
         */
        lastMonth: function(date){
            var cloned = new Date(+date);
            cloned.setMonth(cloned.getMonth() - 1);
            return cloned;
        },

        /**
         * Get the date of the day in next month
         * @method nextMonth
         * @param {Date|Number} date
         * @return {Date}
         * @example
         *      dateTool.nextMonth(new Date()); // returns one month later
         *      dateTool.nextMonth(new Date('2000-1-10')); // returns new Date('2000-2-10')
         */
        nextMonth: function(date){
            var cloned = new Date(+date);
            cloned.setMonth(cloned.getMonth() + 1);
            return cloned;
        },

        /**
         * Get date of the day one year before
         * @method lastYear
         * @param {Date|Number} date
         * @return {Date}
         * @example
         *      dateTool.lastYear(new Date()); // returns one year ago
         *      dateTool.lastYear(new Date('2000-1-10')); // returns new Date('1999-1-10')
         */
        lastYear: function(date){
            var cloned = new Date(+date);
            cloned.setYear(cloned.getFullYear() - 1);
            return cloned;
        },

        /**
         * Get date of the day in next year
         * @method nextYear
         * @param {Date|Number} date
         * @return {Date}
         * @example
         *      dateTool.nextYear(new Date()); // returns one year later
         *      dateTool.nextYear(new Date('2000-1-10')); // returns new Date('2001-1-10')
         */
        nextYear: function(date){
            var cloned = new Date(+date);
            cloned.setYear(cloned.getFullYear() + 1);
            return cloned;
        },

        /**
         * Get days between two date
         * @method daysBetween
         * @param {Date|Number} start Accept date object or timestamp ( in ms )
         * @param {Date|Number} end Accept date object or timestamp ( in ms )
         * @return {Number} if end date is before start date, returns a negative int
         * @example
         *      dateTool.daysBetween(new Date('2000-1-10'), new Date('2000-1-20')); // returns 10
         *      // when start date is later than end date returns negative int
         *      dateTool.daysBetween(new Date('2000-1-20'), new Date('2000-1-10')); // returns -10
         */
        daysBetween: function(start, end){
		    // bug fix see https://github.com/lbfteam/lbf-doc/issues/5
			var timeZoneExtTime = new Date().getTimezoneOffset() * 60 * 1000; // in ms
            return parseInt((+end - timeZoneExtTime) / ONE_DAY, 10) - parseInt((+start -timeZoneExtTime) / ONE_DAY, 10)
        },

        /**
         * Check if two time are in the same day
         * Note that we should reset the two days to the 00:00:00 of the day to check if they are the same day
         * @param {Date|Number} date1 Accept date object or timestamp ( in ms )
         * @param {Date|Number} date2 Accept date object or timestamp ( in ms )
         * @return {Boolean}
         * @example
         *      var date1 = 1369808162919, // Wed May 29 2013 14:16:02 GMT+0800 (中国标准时间)
         *          date2 = 1369800000000; // Wed May 29 2013 12:00:00 GMT+0800 (中国标准时间)
         *      dateTool.isSameDay(date1, date2); // returns true
         */
        isSameDay: function(date1, date2){
            date1 = new Date(date1);
            date2 = new Date(date2);
            date1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
            date2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
            return dateTool.daysBetween(date1, date2) === 0;
        },

        /**
         * Get timestamp in second. Usually for syncing with server
         * @method timestamp
         * @param {Date|Number} date
         * @return {Number}
         * @example
         *      dateTool.timestamp(new Date(1369808162919)); // returns 1369808162
         */
        timestamp: function(date){
            return parseInt(+date / 1000, 10);
        }
    };

    return dateTool;
});
/** src/util/css.js **/
/**
 * Created with JetBrains WebStorm.
 * User: amoschen
 * Date: 13-1-7
 * Time: 下午7:34
 * To change this template use File | Settings | File Templates.
 */
LBF.define('wpa.util.css', function(require, exports, module){
    var contains = require('util.contains'),
        conf = require('wpa.conf.config'),
        win = conf.gWin,
        doc = win.document;

    // var doc = document;

    var getStyle = doc.defaultView && doc.defaultView.getComputedStyle ?
        // for standard W3C method
        function(node, style){
            //font-wight而非fontWight
            style = style.replace(/([A-Z])/g,"-$1").toLowerCase();

            //获取样式对象并获取属性（存在的话）值
            var s = doc.defaultView.getComputedStyle(node,"");
            return s && s.getPropertyValue(style);
        }:
        // for ie
        function(node, style){
            return node.currentStyle[style];
        };

    var inDom = function(node, fn){
        if(!contains(node, doc)){
            return fn();
        }

        var inVisible = {
                opacity: 0,
                filter: 'alpha(opacity=0)'
            },
            parent = node.parentNode,
            nextSibling = node.nextSibling,
            div = doc.createElement('div'),
            returnValue;

        div.appendChild(node);
        // css(div, inVisible);
        // css(node, inVisible);
        doc.body.appendChild(div);

        returnValue = fn();

        nextSibling ? parent.insertBefore(node, nextSibling) : parent.appendChild(node);
        div.parentNode.removeChild(div);

        return returnValue;
    };

    /**
     * css Node's style operation
     * @param {HTMLElement} node Node to be set
     * @param {string|object} style Style name or the styles' pairs
     * @param {string} [value] Style value
     * @retrun {string} Style value, only with string type style  and no value
     */
    module.exports = function(node, style, value){
        var cssText;

        if(!value){
            // get style
            if(typeof style === 'string'){
                return inDom(node, function(){
                    return getStyle(node, style);
                });
            }

            // type validation
            if(typeof style !== 'object'){
                new TypeError('Arg style should be string or object');
            }

            // batch set
            cssText = [];
            for(var styleName in style){
                cssText.push(styleName + ':' + style[styleName]);
            }
            cssText = cssText.join(';');
        } else {
            cssText = style + ':' + value;
        }

        // set style with value
        cssText = cssText.replace(/([A-Z])/g,"-$1").toLowerCase();
        node.style.cssText += ';' + cssText; // cssText ends up without a semicolon in ie
        return node;
    };
});
/** src/util/showInstallQQ.js **/
/**
 * 展示没有安装QQ提示
 * @author: oliverbi
 * @version: 1.0.0
 * @date: 2019/10/14
 */

LBF.define('wpa.util.showInstallQQ', function(require, exports, module) {
    var browser = require('lang.browser'),
        conf = require('wpa.conf.config'),
        onIframeLoaded = require('wpa.util.onIframeLoaded'),
        Style = require('wpa.util.Style'),
        domEvent = require('wpa.util.domEvent'),
        isMobile = conf.isMobile,
        imageBaseUrl = conf.imageBaseUrl,
        isIOS = browser.isIOS,
        isAndroid = browser.isAndroid,
        INSTALL_QQ_IFRAME_ID_PREFIX = conf.INSTALL_QQ_IFRAME_ID_PREFIX,
        DOWNLOAD_QQ_URL = conf.DOWNLOAD_QQ_URL;

    var win = conf.gWin,
        doc = win.document,
        body = doc.body;

    function getIframeStyle() {
        if (isMobile) {
            return {
                style: [
                    'position: fixed',
                    'z-index: 2000001000',
                    'top: 0',
                    'bottom: 0',
                    'left: 0',
                    'right: 0'
                ].join(';'),
                width: '100%',
                height: '100%'
            };
        }

        return {
            style: [
                'position: fixed',
                'z-index: 2000001000',
                'top: 0',
                'left: 50%',
                'margin-left: -220px',
                'background-color: #fff',
                'box-shadow: 0 0 15px 1px rgba(0, 0, 0, .15)'
            ].join(';'),
            width: 440,
            height: 173
        };
    }

    function getTplContent() {
        var commonTpl = [
                '<div class="wpa-install-qq">',
                    '<div class="main">',
                        '<p class="title">正在为你打开QQ</p>',
                        '<p class="content">没有安装QQ？请点击下载</p>',
                    '</div>',
                    '{btns}',
                '</div>'
            ].join(''),
            closeTpl = [
                '<a href="javascript:void(0);" id="btn-close" class="icon-close" data-event="close"><i></i></a>'
            ].join('');

        if (isMobile) {
            return [
                '<div class="wpa-install-qq-holder">',
                    commonTpl.replace('{btns}', [
                        '<div class="btns">',
                            '<div class="btn" id="btn-download" data-event="download">去下载</div>',
                        '</div>',
                        closeTpl
                    ].join('')),
                '</div>'
            ].join('');
        }

        return commonTpl.replace('{btns}', [
            '<div class="btns">',
                '<div class="btn btn--primary" id="btn-download" data-event="download">去下载</div>',
                '<div class="btn btn--default btn--cancel" id="btn-cancel" data-event="close">取消</div>',
            '</div>'
        ].join(''));
    }

    function getTplCss() {
        var commonCss = [
                '* {margin: 0; padding: 0; font-family: "PingFang SC", "Droid Sans Fallback", "microsoft yahei"; background: transparent; }',
                'body { visibility: visible !important; }'
            ].join(''),
            closeCss = [
                '.icon-close { position: absolute; width: 20px; height: 20px; top: 10px; right: 10px; text-align: center; }',
                '.icon-close i { display: inline-block; width: 13px; height: 13px; background-size: 13px 13px; background-image: url("' + imageBaseUrl + '/icon-close-2x.png"); }',
                '.icon-close:hover i { background-image: url("' + imageBaseUrl + '/icon-close-for-black-2x.png"); }'
            ].join('');

        if (isMobile) {
            return [
                commonCss,
                closeCss,
                '.wpa-install-qq-holder { position: absolute; width: 100%; height: 172px; top: 50%; margin-top: -86px; }',
                '.wpa-install-qq { position: absolute; height: 169px; left: 39px; right: 39px; background-color: #fff; box-shadow: 0 0 15px 1px rgba(0, 0, 0, .15); border-top: 3px solid #3481f7; }',
                '.wpa-install-qq .main { position: relative; text-align: center; }',
                '.wpa-install-qq .main .title { font-size: 20px; color: #1e2330; line-height: 1; margin-top: 35px; }',
                '.wpa-install-qq .main .content { font-size: 16px; color: #66686c; line-height: 1; margin-top: 20px; }',
                '.wpa-install-qq .btns { position: absolute; bottom: 0; left: 0; right: 0; border-top: 1px solid #ebedf2; }',
                '.wpa-install-qq .btns .btn { font-size: 18px; line-height: 45px; color: #0067ed; text-align: center; }'
            ].join('');
        }

        return [
            commonCss,
            closeCss,
            '.wpa-install-qq { position: relative; }',
            '.wpa-install-qq .main { text-align: left; padding: 32px 0 0 30px; }',
            '.wpa-install-qq .main .title { font-size: 24px; color: #1e2330; line-height: 1; }',
            '.wpa-install-qq .main .content { font-size: 14px; color: #66686c; line-height: 1; margin-top: 12px; }',
            '.wpa-install-qq .btns { font-size: 0; text-align: right; margin-top: 35px; }',
            '.wpa-install-qq .btns .btn { display: inline-block; text-align: center; width: 107px; height: 36px; font-size: 12px; line-height: 36px; border-radius: 2px; cursor: pointer; transition: border-color .25s, background-color .25s; }',
            '.wpa-install-qq .btns .btn--primary { color: #fff; background-color: #0067ed; border: 1px solid #0067ed; }',
            '.wpa-install-qq .btns .btn--primary:hover { color: #fff; background-color: #197dff; border: 1px solid #197dff; }',
            '.wpa-install-qq .btns .btn--default { background-color: #fff; border: 1px solid #dadee7; }',
            '.wpa-install-qq .btns .btn--default:hover { border: 1px solid #a8abb3; }',
            '.wpa-install-qq .btns .btn--cancel { margin: 0 18px 0 15px; }'
        ].join('');
    }

    function bindBtn($btn, options) {
        if (!$btn) {
            return;
        }

        var event = $btn.getAttribute('data-event');

        domEvent.addEvent($btn, 'click', function() {
            if (event === 'close') {
                clearInstallQQPanel(options);
            } else if (event === 'download') {
                if (isMobile) {
                    if (isIOS) {
                        // 打开iOS端QQ的appstore下载页面
                        win.location.href = DOWNLOAD_QQ_URL.iOS;
                    } else if (isAndroid) {
                        // 打开Anroid端QQ的应用宝下载页面
                        win.open(DOWNLOAD_QQ_URL.Android);
                    }
                } else {
                    // 打开PC端QQ下载页面
                    win.open(DOWNLOAD_QQ_URL.PC);
                }
            }
        });
    }

    function bindEvents(iframe, options) {
        var iWin = iframe.contentWindow,
            iDoc = iframe.contentDocument || iWin.document,
            kfuin = options.kfuin,
            $close = iDoc.getElementById('btn-close'),
            $download = iDoc.getElementById('btn-download'),
            $cancel = iDoc.getElementById('btn-cancel');

        bindBtn($close, {
            iframe: iframe,
            kfuin: kfuin
        });

        bindBtn($cancel, {
            iframe: iframe,
            kfuin: kfuin
        });

        bindBtn($download, {
            iframe: iframe,
            kfuin: kfuin
        });
    }

    function clearInstallQQPanel(options) {
        var kfuin = options.kfuin,
            iframe = options.iframe || doc.getElementById(INSTALL_QQ_IFRAME_ID_PREFIX + kfuin);

        if (iframe) {
            iframe.parentNode && iframe.parentNode.removeChild(iframe);
        }
    }

    module.exports = exports = function(options) {
        var kfuin = options.kfuin,
            iframeId = INSTALL_QQ_IFRAME_ID_PREFIX + kfuin,
            iframeStyle = getIframeStyle(),
            style = iframeStyle.style,
            width = iframeStyle.width,
            height = iframeStyle.height;

        if (doc.getElementById(iframeId)) return;

        var strIframe =
            '<iframe scrolling="no" id="' +
            iframeId +
            '" frameborder="0" width="' +
            width +
            '" height="' +
            height +
            '" allowtransparency="true" src="about:blank" style="{style}" ></iframe>';
        strIframe = strIframe.replace('{style}', style);

        var iframe;
        try {
            iframe = doc.createElement(strIframe);
        } catch (e) {
            iframe = doc.createElement('iframe');
            iframe.width = width;
            iframe.height = height;
            iframe.id = iframeId;
            iframe.style.cssText = style;
            iframe.setAttribute('scrolling', 'no');
            iframe.setAttribute('frameborder', 0);
            iframe.setAttribute('allowtransparency', true);
            iframe.setAttribute('src', 'about:blank');
            if (!isMobile) {
            	iframe.width = width;
            }
        }

        body.appendChild(iframe);

        var loaded = function () {
            var iWin = iframe.contentWindow,
                iDoc = iframe.contentDocument || iWin.document;

            iDoc.open();
            iDoc.write([
                '<!DOCTYPE html>',
                '<html xmlns="http://www.w3.org/1999/xhtml">',
                '<head>',
                    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
                '</head>',
                '<body style="visibility: hidden;">',
                    getTplContent(),
                '</body>',
                '</html>'
            ].join(''));
            iDoc.close();

            var styleObj = {
                name: 'style',
                cssText: getTplCss(),
                doc: iDoc
            };

            Style.commonAdd(styleObj);

            bindEvents(iframe, options);
        };

        onIframeLoaded(iframe, loaded);
    };
});

/** src/im/i18n.js **/
/**
 * 网页接待支持多语言
 * 全局语言包文件
 * @author: oliverbi
 * @version: 1.0.0
 * @date: 2018/07/26
 *
 * 支持繁体中文
 * @author: oliverbi
 * @version: 1.0.1
 * @date: 2020/04/23
 */
LBF.define('wpa.im.i18n', function(require, exports, module) {
    module.exports = {
        'zh-cn': {
            'common_new_message': '条新消息'
        },
        'en-us': {
            'common_new_message': ' new message'
        },
        'zh-tw': {
            'common_new_message': '條新消息'
        }
    };
});

/** lib/lbf/util/Attribute.js **/
/**
 * Created by amos on 14-8-18.
 */
LBF.define('util.Attribute', function(require, exports, module){
    var extend = require('lang.extend');

    var ATTR = '_ATTRIBUTES',
        VALIDATES = '_VALIDATES';

    /**
     * [mixable] Common attributes handler. Can be extended to any object that wants event handler.
     * @class Attribute
     * @namespace util
     * @example
     *      // mix in instance example
     *      // assume classInstance is instance of lang.Class or its sub class
     *
     *      // use class's mix method
     *      classInstance.mix(Event);
     *
     *      // watch events
     *      classInstance.bind('someEvent', function(){
     *          // do sth
     *      });
     *
     * @example
     *      // extend a sub class example
     *
     *      // use class's extend method
     *      var SubClass = Class.extend(Event, {
     *          // some other methods
     *          method1: function(){
     *          },
     *
     *          method2: function(){
     *          }
     *      });
     *
     *      // initialize an instance
     *      classInstance = new SubClass;
     *
     *      // watch events
     *      classInstance.bind('someEvent', function(){
     *          // do sth
     *      });
     */


    /**
     * Set an attribute
     * @method set
     * @param {String} attr Attribute name
     * @param {*} value
     * @param {Object} options Other options for setter
     * @param {Boolean} [options.silence=false] Silently set attribute without fire change event
     * @chainable
     */
    exports.set = function(attr, val, options){
        var attrs = this[ATTR];

        if(!attrs){
            attrs = this[ATTR] = {};
        }

        if(typeof attr !== 'object'){
            var oAttr = attrs[attr];
            attrs[attr] = val;

            // validate
            if(!this.validate(attrs)){
                // restore value
                attrs[attr] = oAttr;
            } else {
                // trigger event only when value is changed and is not a silent setting
                if(val !== oAttr && (!options || !options.silence) && this.trigger){
                    /**
                     * Fire when an attribute changed
                     * Fire once for each change and trigger method is needed
                     * @event change:attr
                     * @param {Event} JQuery event
                     * @param {Object} Current attributes
                     */
                    this.trigger('change:' + attr, [attrs[attr], oAttr]);

                    /**
                     * Fire when attribute changed
                     * Fire once for each change and trigger method is needed
                     * @event change
                     * @param {Event} JQuery event
                     * @param {Object} Current attributes
                     */
                    this.trigger('change', [attrs]);
                }
            }

            return this;
        }

        // set multiple attributes by passing in an object
        // the 2nd arg is options in this case
        options = val;

        // plain merge
        // so settings will only be merged plainly
        var obj = extend({}, attrs, attr);

        if(this.validate(obj)){
            this[ATTR] = obj;
            // change event
            if((!options || !options.silence) && this.trigger){
                var changedCount = 0;
                for(var i in attr){
                    // has property and property changed
                    if(attr.hasOwnProperty(i) && obj[i] !== attrs[i]){
                        changedCount++;
                        this.trigger('change:' + i, [obj[i], attrs[i]]);
                    }
                }

                // only any attribute is changed can trigger change event
                changedCount > 0 && this.trigger('change', [obj]);
            }
        }

        return this;
    };

    /**
     * Get attribute
     * @method get
     * @param {String} attr Attribute name
     * @return {*}
     */
    exports.get = function(attr){
        return !this[ATTR] ? null : this[ATTR][attr];
    };

    /**
     * Get all attributes.
     * Be sure it's ready-only cause it's not a copy!
     * @method attributes
     * @returns {Object} All attributes
     */
    exports.attributes = function(){
        return this[ATTR] || {};
    };

    /**
     * Add validate for attributes
     * @method addValidate
     * @param {Function} validate Validate function, return false when failed validation
     * @chainable
     * @example
     *      instance.addValidate(function(event, attrs){
     *          if(attrs.someAttr !== 1){
     *              return false; // return false when failed validation
     *          }
     *      });
     */
    exports.addValidate = function(validate){
        var validates = this[VALIDATES];

        if(!validates){
            validates = this[VALIDATES] = [];
        }

        // validates for all attributes
        validates.push(validate);

        return this;
    };

    /**
     * Remove a validate function
     * @method removeValidate
     * @param {Function} validate Validate function
     * @chainable
     * @example
     *      instance.removeValidate(someExistValidate);
     */
    exports.removeValidate = function(validate){
        // remove all validates
        if(!validate){
            this[VALIDATES] = null;
            return this;
        }

        var valArr = this[VALIDATES];

        for(var i= 0, len= valArr.length; i< len; i++){
            if(valArr[i] === validate){
                valArr.splice(i, 1);
                --i;
                --len;
            }
        }

        return this;
    };

    /**
     * Validate all attributes
     * @method validate
     * @return {Boolean} Validation result, return false when failed validation
     */
    exports.validate = function(attrs){
        var valArr = this[VALIDATES];
        if(!valArr){
            return true;
        }

        attrs = attrs || this[ATTR];
        for(var i= 0, len= valArr.length; i< len; i++){
            if(valArr[i].call(this, attrs) === false){
                return false;
            }
        }

        return true;
    };
});
/** src/util/backgroundMixin.js **/
/*
 * 统一添加背景类
 *
 *
 */
LBF.define('wpa.util.backgroundMixin', function(require, exports, module) {



    var backgroundTmpls = {
    	//p: pure color
		//s: start color
		//e: end color
    	1: [
		        'background: {{p}};',
		        'background: -moz-linear-gradient(top, {{s}} 0%, {{e}} 100%);',
		        'background: -webkit-gradient(linear, left top, left bottom, color-stop(0%,{{s}}), color-stop(100%,{{e}}));',
		        'background: -webkit-linear-gradient(top, {{s}} 0%,{{e}} 100%);',
		        'background: -o-linear-gradient(top, {{s}} 0%,{{e}} 100%);',
		        'background: -ms-linear-gradient(top, {{s}} 0%,{{e}} 100%);',
		        'background: linear-gradient(to bottom, {{s}} 0%,{{e}} 100%);',
		        'filter: progid:DXImageTransform.Microsoft.gradient( startColorstr="{{s}}", endColorstr="{{e}}",GradientType=0 );'
		    ].join(''),
		2: 'background: {{p}};',
		3: 'background: url({{p}});_background: url({{p_png8}});'
    }


    //e.g:
    //params = {
    // 	tmpl: 1,
    // 	colors: {
    // 		p: #fff,
    // 		s: #123,
    // 		e: #321
    // 	}
    // }
	var getBackground = function(params) {


		var tmpl;

		switch (params.tmpl) {
			case 1: tmpl = 1;
					break;
			case 2: tmpl = 2;
					break;
			case 3: tmpl = 3;
					break;
			default: tmpl = 1;
		};

        return backgroundTmpls[tmpl].replace(/\{\{p\}\}/g, params.colors.p)
		        					.replace(/\{\{s\}\}/g, params.colors.s)
		        					.replace(/\{\{e\}\}/g, params.colors.e)
		        					.replace(/\{\{p_png8\}\}/g, params.colors.p_png8 || '');


    };

    module.exports = exports = getBackground;

});
/** lib/lbf/util/contains.js **/
/**
 * @fileOverview
 * @author amoschen
 * @version
 * Created: 13-6-25 下午9:45
 */
LBF.define('util.contains', function(){
    return document.createElement('div').compareDocumentPosition ?
        //w3c
        function (parent, child, containSelf) {
            if (!containSelf && parent === child) {
                return false;
            }

            var res = parent.compareDocumentPosition(child);
            return res == 20 || res == 0;
        }:
        //ie
        function (parent, child, containSelf) {
            if (!containSelf && parent === child) {
                return false;
            }

            //return parent.contains(child);
            return child == document ? parent.contains(document.body) : parent.contains(child);
        };
});

// no conflict
LBF.use('wpa.app', function(app){
    app.init();
    // no conflict for LBF
    app.lbf = LBF;
    LBF.noConflict();
});

var http = require('http');
var https = require('https');
var express = require("express");
var RED = require("node-red");
var util = require("util");
var path = require("path");
var settings = require('./settingsttb');
var router = require('ttb-router');
var fs = require("fs")

var PORT = 80;

var server;
// Create an Express app
var app = express();
var ttbDir = __dirname;
var userDir = "/root/userdir/";
var flowDir = userDir;

try {
    var expressPackage = path.join(ttbDir, "node_modules", "express", "package.json");
    var expressVersion = require(expressPackage).version;
    console.log("Express version : " + expressVersion);
} catch (e) {}

// Create the settings object
var settings_ttb = settings.loadSettings();
var settings_nodered = {};

// http://nodered.org/docs/configuration.html
try { settings_nodered = require(__dirname + '/node_modules/node-red/settings.js'); } catch (e) {}

var settings_nodered_ext = {
	uiPort: PORT,
	uiHost: "0.0.0.0",
	httpAdminRoot:"/",
	httpNodeRoot: "/",
	httpNodeCors: {
		origin: "*",
		methods: "GET,PUT,POST,DELETE"
	},
	SKIP_BUILD_CHECK:true,
	userDir: userDir,
	flowDir: flowDir, // TTB specific
	flowFile: flowDir + "flows.json",
	secondFlowDir: "/root/thethingbox/node_modules/node-red/flow/",
	verbose: true,
	flowFilePretty: true,
	otherPropToSave: ['origin', 'extra'],
	paletteCategories:['basic', 'subflows', 'input', 'output', 'function', 'social', 'storage', 'analysis', 'advanced'],
	hiddenWorkspaces: ['system'],
	functionGlobalContext: {
		settings: settings_ttb
		,userDir: userDir
		,settingslib: require('/root/thethingbox/settingsttb.js')
		,wpi: require('node-red/node_modules/wiring-pi') // https://www.npmjs.com/package/wiring-pi
		,CryptoJS: require('node-red/node_modules/crypto-js') // https://www.npmjs.com/package/cryptojs
		,HID: require('node-red/node_modules/node-hid') // https://www.npmjs.com/package/node-hid
		,require: function(module){
			var pathSystem = path.join(ttbDir, "node_modules", "node-red", "node_modules", module)
			var pathUserdir = path.join(userDir, "node_modules", module)
			var toReturn = null;
			try {
				toReturn = require(module);
			} catch(e){
				if (fs.existsSync(pathSystem)) {
				    toReturn = require(pathSystem);
				} else if (fs.existsSync(pathUserdir)) {
					toReturn = require(pathSystem);
				}
			}
			return toReturn			
		}
	}
};
Object.assign(settings_nodered, settings_nodered_ext);

// Create a server
if (settings_nodered.https) {
    server = https.createServer(settings_nodered.https,function(req,res){app(req,res);});
} else {
    server = http.createServer(function(req,res){app(req,res);});
}
server.setMaxListeners(0);

function formatRoot(root) {
    if (root[0] != "/") {
        root = "/" + root;
    }
    if (root.slice(-1) != "/") {
        root = root + "/";
    }
    return root;
}

if (settings_nodered.httpRoot === false) {
    settings_nodered.httpAdminRoot = false;
    settings_nodered.httpNodeRoot = false;
} else {
    settings_nodered.httpRoot = settings_nodered.httpRoot||"/";
    settings_nodered.disableEditor = settings_nodered.disableEditor||false;
}

if (settings_nodered.httpAdminRoot !== false) {
    settings_nodered.httpAdminRoot = formatRoot(settings_nodered.httpAdminRoot || settings_nodered.httpRoot || "/");
    settings_nodered.httpAdminAuth = settings_nodered.httpAdminAuth || settings_nodered.httpAuth;
} else {
    settings_nodered.disableEditor = true;
}

if (settings_nodered.httpNodeRoot !== false) {
    settings_nodered.httpNodeRoot = formatRoot(settings_nodered.httpNodeRoot || settings_nodered.httpRoot || "/");
    settings_nodered.httpNodeAuth = settings_nodered.httpNodeAuth || settings_nodered.httpAuth;
}

// Initialise the runtime with a server and settings
try {
    RED.init(server,settings_nodered);
} catch(err) {
    if (err.code == "unsupported_version") {
        console.log("Unsupported version of node.js:",process.version);
        console.log("Node-RED requires node.js v4 or later");
    } else if  (err.code == "not_built") {
        console.log("Node-RED has not been built. See README.md for details");
    } else {
        console.log("Failed to start server:");
        if (err.stack) {
            console.log(err.stack);
        } else {
            console.log(err);
        }
    }
    process.exit(1);
}

// Load router
new router(app, path.join(ttbDir, "node_modules", "ttb-router"), ttbDir, RED, settings_nodered);
new router(app, path.join(userDir, "router"), ttbDir, RED, settings_nodered);

function getListenPath() {
    var listenPath = 'http'+(settings_nodered.https?'s':'')+'://'+
                    (settings_nodered.uiHost == '0.0.0.0'?'127.0.0.1':settings_nodered.uiHost)+
                    ':'+settings_nodered.uiPort;
    if (settings_nodered.httpAdminRoot !== false) {
        listenPath += settings_nodered.httpAdminRoot;
    } else if (settings_nodered.httpStatic) {
        listenPath += "/";
    }
    return listenPath;
}

RED.start().then(function() {
    if (settings_nodered.httpAdminRoot !== false || settings_nodered.httpNodeRoot !== false || settings_nodered.httpStatic) {
        server.on('error', function(err) {
            if (err.errno === "EADDRINUSE") {
                RED.log.error(RED.log._("server.unable-to-listen", {listenpath:getListenPath()}));
                RED.log.error(RED.log._("server.port-in-use"));
            } else {
                RED.log.error(RED.log._("server.uncaught-exception"));
                if (err.stack) {
                    RED.log.error(err.stack);
                } else {
                    RED.log.error(err);
                }
            }
            process.exit(1);
        });
        server.listen(settings_nodered.uiPort,settings_nodered.uiHost,function() {
            if (settings_nodered.httpAdminRoot === false) {
                RED.log.info(RED.log._("server.admin-ui-disabled"));
            }
            process.title = 'node-red';
            RED.log.info(RED.log._("server.now-running", {listenpath:getListenPath()}));
        });
    } else {
        RED.log.info(RED.log._("server.headless-mode"));
    }
}).otherwise(function(err) {
    RED.log.error(RED.log._("server.failed-to-start"));
    if (err.stack) {
        RED.log.error(err.stack);
    } else {
        RED.log.error(err);
    }
});

process.on('uncaughtException',function(err) {
    util.log('[red] Uncaught Exception:');
    if (err.stack) {
        util.log(err.stack);
    } else {
        util.log(err);
    }
    process.exit(1);
});

process.on('SIGINT', function () {
    RED.stop();
    // TODO: need to allow nodes to close asynchronously before terminating the
    // process - ie, promises
    process.exit();
});
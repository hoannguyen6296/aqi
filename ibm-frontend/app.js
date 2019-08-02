/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
//var express = require('express');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
//var cfenv = require('cfenv');

// create a new express server
//var app = express();

// serve the files out of ./public as our main files
//app.use(express.static(__dirname + '/public'));

// get the app environment from Cloud Foundry
//var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
// app.listen(appEnv.port, '0.0.0.0', function() {
//   // print a message when the server starts listening
//   console.log("server starting on " + appEnv.url);
// });

var Webserver = require("./cloudWebServer/cloudWebServer.js");
var Cloudclient = require("./cloudClient/cloudClient.js");

function Gateway() {
	var webserver = new Webserver();
	var cloudclient = new Cloudclient();
	

	/* rcvd send config req */
	webserver.on('sendConfig', function (data) {
		/* send config request */
		cloudclient.appC_sendConfig(data);
	});

	/* rcvd send toggle req */
	webserver.on('sendToggle', function (data) {
		/* send toggle request */
		cloudclient.appC_sendToggle(data);
	});

	/* rcvd getDevArray Req */
	webserver.on('getDevArrayReq', function (data) {
		/* process the request */
		cloudclient.appC_getDeviceArray();
	});

	/* rcvd getNwkInfoReq */
	webserver.on('getNwkInfoReq', function (data) {
		/* process the request */
		cloudclient.appC_getNwkInfo();
	});

	webserver.on('setJoinPermitReq', function (data) {
		/* process the request */
		cloudclient.appC_setPermitJoin(data);
	});

	webserver.on('setIBMCredentials', function (data) {
		/* process the request */
		cloudclient.appC_setIBMCredentials(data);
	});

	/* send message to web-client */
	cloudclient.on('permitJoinCnf', function (data) {
		webserver.webserverSendToClient('permitJoinCnf', JSON.stringify(data));
	});

	/* send connected device info update to web-client */
	cloudclient.on('connDevInfoUpdate', function (data) {
		webserver.webserverSendToClient('connDevInfoUpdate', JSON.stringify(data));
	});

	/* send nwkUpdate to web-client */
	cloudclient.on('nwkUpdate', function (data) {
		webserver.webserverSendToClient('nwkUpdate', JSON.stringify(data));
	});

	/* send device array to web-client */
	cloudclient.on('getdevArrayRsp', function (data) {
		webserver.webserverSendToClient('getdevArrayRsp', JSON.stringify(data));
	});
}

/* create gateway */
var gateway = new Gateway();
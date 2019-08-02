
/******************************************************************************

 @file awsCloudAdapter.js

 @brief Adapter between the cloudAgent and the Amazon AWS IoT Cloud

 Group: WCS LPC
 $Target Devices: Linux: AM335x, Embedded Devices: CC1310, CC1350$

 ******************************************************************************
 $License: BSD3 2016 $

   Copyright (c) 2015, Texas Instruments Incorporated
   All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions
   are met:

   *  Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.

   *  Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

   *  Neither the name of Texas Instruments Incorporated nor the names of
      its contributors may be used to endorse or promote products derived
      from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
   THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
   PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
   CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
   EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
   PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
   OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
   WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
   OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 ******************************************************************************
 $Release Name: TI-15.4Stack Linux x64 SDK$
 $Release Date: July 14, 2016 (2.00.00.30)$
 *****************************************************************************/

var events = require("events");
var awsIot = require('aws-iot-device-sdk');

/* AWS Cloud Adapter Singleton */
var awsCloudAdapterInstance;

/*!
 * @brief      Constructor for AWS Cloud Adapter
 *
 * @param      none
 *
 * @retun      none
 */
function AwsCloudAdapter() {

	if (typeof awsCloudAdapterInstance !== "undefined") {
		return awsCloudAdapterInstance;
	}

	/* Set up to emit events */
	events.EventEmitter.call(this);
	awsCloudAdapterInstance = this;

	awsCloudAdapterInstance.connected = false;
	awsCloudAdapterInstance.registered = [];


	var awsCfg = require('./awsConfig.json');
	var thingShadows = awsIot.thingShadow({
		
		keyPath: awsCfg.certDir + awsCfg.keyPath,
                certPath: awsCfg.certDir + awsCfg.certPath,
                caPath: awsCfg.certDir + awsCfg.caPath,
                clientId: awsCfg.clientId + '_' + new Date().getTime(),
                region: awsCfg.region,
                port: awsCfg.port,
                host: awsCfg.host,
                debug: awsCfg.debug
        });


        thingShadows.on('connect', function() {
                console.log('Connected to AWS IoT');
                awsCloudAdapterInstance.connected = true;
		awsCloudAdapterInstance.registered = [];
	});

        thingShadows.on('close', function() {
		console.log('AWS Cloud Adapter close');
	});

	thingShadows.on('reconnect', function() {
		console.log('AWS Cloud Adapter reconnect');
	});

	thingShadows.on('offline', function() {
		console.log('AWS Cloud Adapter offline');
	});

	thingShadows.on('error', function(error) {
		console.log('AWS Cloud Adapter error', error);
	});

	thingShadows.on('message', function(topic, payload) {
		console.log('AWS Cloud Adapter message');
	});

	thingShadows.on('status', function(thingName, stat, clientToken, stateObject) {
		//console.log('AWS Cloud Adapter ()');
        /* Print only if the status is not an error message */
        /* see 'Optomistic Locking' at:
         *   http://docs.aws.amazon.com/iot/latest/developerguide/using-thing-shadows.html
         * for an example.
        */
        if(stateObject.hasOwnProperty('state'))
            console.log('status : ' + thingName + ' reporting data');
            //console.log(thingName + ':\n' + JSON.stringify(stateObject.state.reported, null, 4));
        else
            console.log("status : error msg");

    });

	/* All requests from the Cloud will be received in this Delta event */
	thingShadows.on('delta', function(thingName, stateObject) {
		//console.log('AWS Cloud Adapter delta');
		//console.log('Delta on: ' + thingName);
		//console.log(JSON.stringify(stateObject, null, 4));

		/* Check the stateObject for an open/close command or a toggleLED command */
		if (stateObject.state.state === "open") {
			awsCloudAdapterInstance.emit('updateNetworkState', {action : "open"});
			console.log('delta : ' + thingName + ' open network');
		}
		if (stateObject.state.state === "close") {
			awsCloudAdapterInstance.emit('updateNetworkState', {action : "close"});
			console.log('delta : ' + thingName + ' close network');
		}
		if (stateObject.state.toggleLED === "true") {
			var index = thingName.lastIndexOf("_");
			var extAddr = thingName.substr(index+1);
			awsCloudAdapterInstance.emit('deviceActuation', {dstAddr : extAddr});
			console.log('delta : ' + thingName + ' toggle LED');
		}
	});

	thingShadows.on('timeout', function(thingName, clientToken) {
		//console.log('AWS Cloud Adapter timeout');
        console.log('timeout : ' + thingName);
	});

	AwsCloudAdapter.prototype.cloudAdapter_sendNetworkInfoMsg = function (nwkInfo) {
		if (awsCloudAdapterInstance.connected != true) {
			return;
		}

		/* Format the device topics for the full AWS specific Device Thing Shadow topic */
		var devices = nwkInfo.devices.slice();
		for (i = 0; i < devices.length; i++) {
			devices[i].topic = '$aws/things/' + devices[i].topic + '/shadow';
		}
		nwkInfo.devices = devices.slice();

		var nwkInfoThing = 'ti_iot_' + nwkInfo.ext_addr + '_network';
		/* If the network thing isn't registered yet, then register it before sending the update */
		if (awsCloudAdapterInstance.registered[nwkInfoThing] != 1) {
			thingShadows.register(nwkInfoThing, { ignoreDeltas : false, persistentSubscribe : false });
			/* Amazon requires a delay between Thing registration and its first update */
			setTimeout (function() {
				thingShadows['update'](nwkInfoThing, { state : { reported : nwkInfo }});
			}, 5000);
			awsCloudAdapterInstance.registered[nwkInfoThing] = 1;
		}
		else {
			thingShadows['update'](nwkInfoThing, { state : { reported : nwkInfo }});
		}
	}

	AwsCloudAdapter.prototype.cloudAdapter_sendDeviceInfoMsg = function (devInfo, nwkExtAddr) {
		if (awsCloudAdapterInstance.connected != true) {
			return;
		}

		var devInfoThing = 'ti_iot_' + nwkExtAddr + '_' + devInfo.ext_addr;
		/* If the device thing ins't registered yet, then register it before sending the update */
		if (awsCloudAdapterInstance.registered[devInfoThing] != 1) {
			thingShadows.register(devInfoThing, { ignoreDeltas : false, persistentSubscribe : false });
			/* Amazon requires a delay between Thing registration and its first update */
			setTimeout (function() {
				/* Set desired to null in order to remove any toggleLED requests */
				thingShadows['update'](devInfoThing, { state : { desired : null, reported : devInfo }});
			}, 5000);
			awsCloudAdapterInstance.registered[devInfoThing] = 1;
		}
		else {
			/* Set desired to null in order to remove any toggleLED requests */
			thingShadows['update'](devInfoThing, { state : { desired : null, reported : devInfo }});
		}
	}
}

AwsCloudAdapter.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = AwsCloudAdapter;

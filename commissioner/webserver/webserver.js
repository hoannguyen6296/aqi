/******************************************************************************

 @file webserver.js

 @brief webserver implementation

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
 $Release Name: TI-15.4Stack Linux x64 SDK ENG$
 $Release Date: Mar 08, 2017 (2.01.00.10)$
 *****************************************************************************/

const spawn = require('child_process').spawn;

var express = require('express');
var events = require("events");
var socket = require("socket.io");
var http = require("http");
var os = require("os");
var path = require('path');
var formidable = require('formidable');
var fs = require('fs');

/* Webserver Instance */
var webserverInstance;

var theSocket;

var gatewayPID = 0;

var gatewayRunning = "Not Running";

var ipAddr;

var networkChange = false;

var ssid = "";

var connected = false;

/*!
 * @brief      Constructor for web-server
 *
 * @param      none
 *
 * @retun      none
 */
function Webserver() {

    /* There should be only one app client */
    if (typeof webserverInstance !== "undefined") {
        return webserverInstance;
    }

    /* Set up to emit events */
    events.EventEmitter.call(this);
    webserverInstance = this;

    /* Set up webserver */
    var    app = express();
    var    server = http.createServer(app);
    webserverInstance.io = socket.listen(server);
    // 192.168.43.1 -> only listen to traffic via SitaraAP
    // 0.0.0.0 listen to all interfaces
    server.listen( 1310, '0.0.0.0');
    var path = require('path');
    app.use(express.static(path.join(__dirname, '..'+'/public')));
    app.get('/', function(req, res){
        res.sendFile(__dirname + '/commissioner.html');
    });

    app.post('/', function(req, res){
        // create an incoming form object
        var form = new formidable.IncomingForm();
        var files = [];
        // specify that we want to allow the user to upload multiple files in a single request
        form.multiples = true;

        // store all uploads in the /uploads directory
        form.uploadDir = path.join(__dirname, '/uploads');
        //console.log("upload dir: "+form.uploadDir);

        var awsConfig = {
            "certDir" : form.uploadDir+'/',
            "clientId" : "BBBTI",
            "region" : "us-east-1",
            "port" : 8883,
            "host" : "a23op339u3ex9t.iot.us-east-1.amazonaws.com",
            "debug" : true
        };

        // every time a file has been uploaded successfully,
        // rename it to it's orignal name
        form.on('file', function(field, file) {
            if (file.size == 0) {
                fs.unlink(file.path);
                return;
            }
            files.push(file.name);
            if (field == 'private key') {
                fs.rename(file.path, path.join(form.uploadDir, file.name));
                awsConfig['keyPath'] = file.name;
            }
            if (field == 'certificate') {
                fs.rename(file.path, path.join(form.uploadDir, file.name));
                awsConfig['certPath'] = file.name;
            }
            if (field == 'root certificate') {
                fs.rename(file.path, path.join(form.uploadDir, file.name));
                awsConfig['caPath'] = file.name;
            }
            if (field == 'public key') {
                fs.rename(file.path, path.join(form.uploadDir, file.name));
            }

        });

        // log any errors that occur
        form.on('error', function(err) {
            console.log('An error has occured: \n' + err);
        });

        // once all the files have been uploaded, send a response to the client
        form.on('end', function() {
            if (awsConfig['keyPath'] && awsConfig['caPath'] && awsConfig['certPath']) {
                fs.writeFile(path.join(__dirname, '/../../iot-gateway/cloudAdapter/awsConfig.json'),JSON.stringify(awsConfig), err => {
                    if (err)
                        console.log("error "+err+" writing awsConfig to: "+path.join(__dirname, '/../../iot-gateway/cloudAdapter/awsConfig.json'));
                });
                res.json({"files": files.toString()});
            } else {
            //res.sendFile(__dirname + '/commissioner.html');
                res.end("Fail!");
            }
        });

        // parse the incoming request containing the form data
        form.parse(req);
    });

    var uploaded_files = [];

    function syncUploads(socket){
        uploaded_files = [];
        fs.readdir(path.join(__dirname, '/uploads'), function(err, items) {
            //console.log(items);

            if (typeof(items) != "undefined") {
                for (var i=0; i<items.length; i++) {
                    console.log(items[i]);
                }
                uploaded_files = items;
                if (socket)
                    socket.emit('uploadedFiles', JSON.stringify(uploaded_files));
            }
        });
    }

    /* Handle socket events */
    webserverInstance.io.sockets.on('connection', function (socket) {

        syncUploads(socket);

        networkChange = true;
        checkConnection();

        var conStat = setInterval(checkConnection,30000);

        socket.on('connectToThisNetwork', function (data) {
            var networkDetails = JSON.parse(data);
            theSocket = this;
            console.log("request to connect to: " + networkDetails.ssid + ", key: " + networkDetails.key);
            console.log("remember: " + networkDetails.remember);

            console.log("here2: " + JSON.stringify(os.networkInterfaces()));

            //const connectToNetwork = spawn('sh', [ '/usr/share/wl18xx/sta_connect-ex.sh', networkDetails.ssid, 'WPA-PSK', networkDetails.key ], {
            const connectToNetwork = spawn('sh', [ 'scripts/connect.sh', networkDetails.ssid, networkDetails.key, networkDetails.remember ], {
            });

            connectToNetwork.stdout.on('data', (data) => {
                console.log(`connect stdout: ${data}`);
                var StationIpAddr = data.toString();
                console.log("StationIpAddr = " + StationIpAddr);
                console.log("sending StationIpAddr = " + StationIpAddr);
                console.log('{ipAddr:' + StationIpAddr.trim() + '}');
                ipAddr = StationIpAddr.trim();
                theSocket.emit('StationIpAddr2', {ipAddr:StationIpAddr.trim()});
                networkChange = true;
            });

            connectToNetwork.stderr.on('data', (data) => {
                console.log(`connect stderr: ${data}`);
            });

            connectToNetwork.on('close', (code) => {
                console.log(`child process exited with code ${code}`);
                checkConnection();
            });
        });

        socket.on('wifiConfig', function (data) {
            console.log("Lets start wifi config");
            //start wifi access point, and collect list of available networks.


            //const getAvailbleSsids = spawn('wpa_cli', [ '-iwlan0', 'scan' ], {
            const getAvailbleSsids = spawn('sh',[ 'scripts/my_wpa_cli' ], {
            })

            getAvailbleSsids.stdout.on('data', (data) => {
              console.log(`stdout: ${data}`);
                if (data.toString().trim() == "OK") {
                    var count = 0;
                    var intervalObject = setTimeout(function(){
                        const getAvailbleSsidsList = spawn('wpa_cli', [ '-iwlan0', 'scan_results' ], {
                        });

                        function compareSignalLevels(a,b) {
                          if (Number(a.signalLevel) < Number(b.signalLevel))
                            return 1;
                          if (Number(a.signalLevel) > Number(b.signalLevel))
                            return -1;
                          return 0;
                        }

                        var lastReportedAvailableNetworks = [];

                        function checkSsidExist(networkInfo) {
                            return networkInfo.ssid == this;
                        }

                        getAvailbleSsidsList.stdout.on('data', (data) => {
                            console.log(`stdout: ${data}`);
                            var resultLines = data.toString().split("\n");
                            resultLines.shift(); //remove the title line
                            resultLines.pop(); //remove the ending empty line
                            var i;
                            var availableNetworks = [];
                            for (i = 0; i < resultLines.length; i++)
                            {
                                networkDetails = resultLines[i].split("\t");
                                console.log(networkDetails[2] + "<>" + networkDetails[4]);
                                availableNetworks.push({ssid: networkDetails[4], signalLevel: networkDetails[2]});
                            }
                            availableNetworks.sort(compareSignalLevels);

                            var changeDetected = false;

                            if (availableNetworks.length != lastReportedAvailableNetworks.length) {
                                changeDetected = true;
                            } else {
                                for (i = 0; i < availableNetworks.length; i++) {
                                    if ((availableNetworks.ssid !== lastReportedAvailableNetworks.ssid) || (availableNetworks.signalLevel !== lastReportedAvailableNetworks.signalLevel)) {
                                        changeDetected = true;
                                        break;
                                    }
                                }
                            }

                            if (changeDetected) {
                                lastReportedAvailableNetworks = availableNetworks.slice();

                                for (i = 0; i < availableNetworks.length; i++) {
                                    console.log(availableNetworks[i].ssid + ":" + availableNetworks[i].signalLevel);
                                }
                                console.log(JSON.stringify(availableNetworks));
                                webserverInstance.webserverSendToClient("availableNetworks",JSON.stringify(availableNetworks)); //note that it will be sent to all clients - need to either send to the qlient requested, or to block on client if not requested.
                            }

                        });

                        getAvailbleSsidsList.stderr.on('data', (data) => {
                            console.log(`stderr: ${data}`);
                        });

                        getAvailbleSsidsList.on('close', (code) => {
                            console.log(`child process exited with code ${code}`);
                        });
                        count++;

                        if ( count == 15 ) {
                            clearInterval(intervalObject);
                        }
                    }, 5000);
                }
                else {
                    console.log(`ERROR`);
                }
            });

            getAvailbleSsids.stderr.on('data', (data) => {
              console.log(`stderr: ${data}`);
            });

            getAvailbleSsids.on('close', (code) => {
              console.log(`child process exited with code ${code}`);
            });

            getAvailbleSsids.on('error', function (err) {
              console.log('getAvailbleSsids error', err);
            });
        });

        socket.on('configCollector', function(form) {
            var configData = {};
            for (var i in form){
                switch(form[i]['name']){
                    case 'channel':
                        if (form[i]['value'])
                            configData['channel'] = form[i]['value'];
                        else
                            configData['channel'] = '0';
                        break;
                    case 'panID':
                        if (form[i]['value'])
                            configData['panID'] = "0x"+form[i]['value'];
                        else
                            configData['panID'] = '0xACDC';
                        break;
                    case 'reportInterval':
                        if (form[i]['value'])
                            configData['reportInterval'] = form[i]['value'];
                        else
                            configData['reportInterval'] = '10000';
                        break;
                    case 'pollInterval':
                        if (form[i]['value'])
                            configData['pollInterval'] = form[i]['value'];
                        else
                            configData['pollInterval'] = '6000';
                        break;
                    case 'frequencyRadios':
                        configData['phyID'] = form[i]['value'];
                        break;
                    case 'dataRateRadios':
                        configData['dataRate'] = form[i]['value'];
                        break;
                    case 'nvRestore':
                        configData['nvRestore'] = form[i]['value'];
                        break;
                    default:
                        console.log("unknown form item "+form[i]['name']);
                }
            }
            if (configData['dataRate'] === '5'){
                switch(configData['phyID']){
                    case '1':
                        configData['phyID'] = '129';
                        break;
                    case '3':
                        configData['phyID'] = '131';
                        break;
                    case '128':
                        configData['phyID'] = '130';
                        break;
                    default:
                        console.log("unknown phy "+configData['phyID']);
                }
            }
            if (!configData['nvRestore']) {
                configData['nvRestore'] = 'false';
            }
            console.log(configData);
            const launcher = spawn('bash', ['scripts/configureCollector.sh',configData['channel'],configData['panID'],configData['reportInterval'],configData['pollInterval'],configData['phyID'],configData['nvRestore']], {//[ 'run_ibm.sh'], {
            });

            launcher.stdout.on('data', (data) => {
                console.log(`connect stdout: ${data}`);
            });

            launcher.stderr.on('data', (data) => {
                console.log(`connect stderr: ${data}`);
            });

            launcher.on('close', (code) => {
                console.log(`child process exited with code ${code}`);
            });
        });

        socket.on('launchIBMGateway', function(data) {
            var ibmConfig = {
                "domain": "internetofthings.ibmcloud.com",
                "auth-method": "token",
                "use-client-certs": [false]
            };

            for (var i in data) {
                //console.log(data[i]);
                if (data[i]['name'] == 'org'){
                    ibmConfig['org'] = data[i]['value'];
                }
                if (data[i]['name'] == 'type'){
                    ibmConfig['type'] = data[i]['value'];
                }
                if (data[i]['name'] == 'id'){
                    ibmConfig['id'] = data[i]['value'];
                }
                if (data[i]['name'] == 'auth-token'){
                    ibmConfig['auth-token'] = data[i]['value'];
                }
            }
            console.log(ibmConfig);

            fs.writeFile(path.join(__dirname, '/../../iot-gateway/cloudAdapter/ibmConfig.json'),JSON.stringify(ibmConfig), err => {
                    if (err)
                        console.log("error "+err+" writing ibmConfig to: "+path.join(__dirname, '/../../iot-gateway/cloudAdapter/ibmConfig.json'));
            });

            launchGateway('ibm');
        });

        socket.on('launchGateway',function(data){
            launchGateway(data);
        });

        function launchGateway(cloudAdapter){
            networkChange = true;
            getGatewayStatus();
            if (gatewayRunning != "Not Running") {
                webserverInstance.webserverSendToClient("alert","Closing "+gatewayRunning.toLowerCase()+" gateway and starting "+cloudAdapter+" gateway.");
            }
            const launcher = spawn('bash', ['scripts/launch_gateway.sh',cloudAdapter], {
            });

            launcher.stdout.on('data', (data) => {
                var str = data.toString().trim();
                console.log(`connect stdout: ${data}`);
                if (str.startsWith('Gateway is running as Process id:')){
                    gatewayPID = str.slice(34);
                    console.log("Gateway PID: " + gatewayPID);
                    gatewayRunning = cloudAdapter.toUpperCase();
                }
                if (str.startsWith('iotdash')){
                    console.log("AWS URL: "+str);
                    webserverInstance.webserverSendToClient('awsUrl',str);
                }
                if (str.startsWith('Quickstart DevID=')){
                    var quickstartDevId = str.slice(17);
                    console.log(quickstartDevId);
                    var quickstartUrl = "https://quickstart.internetofthings.ibmcloud.com/#/device/sensor-to-cloud"+quickstartDevId+"/sensor/";
                    webserverInstance.webserverSendToClient('quickstartUrl',quickstartUrl);
                }
                if (str.startsWith('AWS Cloud Adapter error')){
                    // AWS error
                    //alert(str);
                    console.log("awsErr: "+str);
                    webserverInstance.webserverSendToClient("alert",str);
                }
                if (str.startsWith('AWS Cloud Adapter offline')){
                    // AWS error
                    //alert(str);
                    console.log("aws offline: "+str);
                    webserverInstance.webserverSendToClient("alert",str);
                }
                if (str.startsWith('IBM Cloud Adapter error:')){
                    console.log("ibmErr: "+str);
                    webserverInstance.webserverSendToClient("alert",str);
                }
                if (str.startsWith("localhost port=")){
                    console.log("Local Gateway Started");
                    var port = parseInt(str.slice(15));
                    webserverInstance.webserverSendToClient("localRedirect",port);
                }
            });

            launcher.stderr.on('data', (data) => {
                console.log(`connect stderr: ${data}`);
            });

            launcher.on('close', (code) => {
                var err = parseInt(code);
                if (err){
                    console.log("Error launching gateway! ERR: "+err);
                    var error = "Error launching gateway. Error="+err+"\n";
                    switch(err){
                        case 1:
                            error += "Unknown Architecture...";
                            socket.emit("alert",error);
                            break;
                        case 2:
                            error += "Launchpad is not connected. Please Reconnect.";
                            socket.emit("alert",error);
                            break;
                        case 3:
                            error += "Cannont find collector binary.";
                            socket.emit("alert",error);
                            break;
                        case 4:
                            error += "Collector binary is not executable."
                            socket.emit("alert",error);
                            break;
                        case 5:
                            error += "Error starting collector. Please reset Co-Processor and try again.";
                            socket.emit("alert",error);
                            break;
                        case 6:
                            error += "Node is not installed.";
                            socket.emit("alert",error);
                            break;
                        case 7:
                            error += "Cannot start IOT gateway."
                            socket.emit("alert",error);
                            break;
                        case 8:
                            error += "Cannot start localhost gateway."
                            socket.emit("alert",error);
                            break;
                    }
                }
                console.log(`child process exited with code ${code}`);
            });
        }


        socket.on('runScript',function(script){
            var runScript = 'scripts/'+script;
            const launcher = spawn('bash',[runScript], {

            });

            launcher.stdout.on('data', (data) => {
                console.log(`connect stdout: ${data}`);
            });

            launcher.stderr.on('data', (data) => {
                console.log(`connect stderr: ${data}`);
            });

            launcher.on('close', (code) => {
                console.log(`child process exited with code ${code}`);
                if (script == 'removeUploads.sh')
                    syncUploads(this);
            });
        });

        function getSSID() {
            const launcher = spawn('bash',['scripts/checkConnection.sh'], {
            });

            launcher.stdout.on('data', (data) => {
                //console.log(`connect stdout: ${data}`);
                if (data.toString().trim().startsWith('SSID')) {
                    if (data.toString().trim().slice(6) != ssid){
                        ssid = data.toString().trim().slice(6);
                        networkChange = true;
                    }
                    //console.log("ssid being set to "+ssid);
                }
            });

            launcher.stderr.on('data', (data) => {
                console.log(`connect stderr: ${data}`);
            });

            launcher.on('close', (code) => {
                //console.log(`child process exited with code ${code}`);
                if (code == 1)
                    connected = false;
                else
                    connected = true;
            });
        }

        function getIpAddr() {
            console.log(ssid);
            const launcher = spawn('bash',['scripts/getIpAddr.sh',ssid], {
            });

            launcher.stdout.on('data', (data) => {
                //console.log(`connect stdout: ${data}`);
                ipAddr = data.toString().trim();
            });

            launcher.stderr.on('data', (data) => {
                console.log(`connect stderr: ${data}`);
            });

            launcher.on('close', (code) => {
                //console.log(`child process exited with code ${code}`);
            });
        }

        function getGatewayStatus() {
            //console.log("gPID: "+gatewayPID);
            const launcher = spawn('bash',['scripts/isGatewayRunning.sh',gatewayPID], {
            });

            launcher.stderr.on('data', (data) => {
                console.log(`connect stderr: ${data}`);
            });

            launcher.on('close', (code) => {
                if (code == 1){
                    gatewayRunning = "Not Running";
                    networkChange = true;
                    console.log("gateway "+gatewayPID+" not found")
                }
                //socket.emit('connectionStatus',connected);
            });
        }

        function checkConnection(){
            getSSID();
            if (gatewayPID)
                getGatewayStatus();
            if (networkChange) {
                getIpAddr();
                setTimeout(function(){socket.emit('connectionStatus',{connected: connected,
                                                ssid: ssid,
                                                ipAddr: ipAddr,
                                                gateway: gatewayRunning});},500);
                networkChange = false;
            }
        }



    });

    /**********************************************************************
     Public method to send Update Messages to the client
    ***********************************************************************/
    webserverInstance.webserverSendToClient = function(msgType, data){
                webserverInstance.io.sockets.emit(msgType, data);
    };
}

Webserver.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Webserver;

/******************************************************************************
 @file appClient.js

 @brief TIMAC-2.0.0 Example Application - appClient Implementation

 Group: WCS LPC
 $Target Device: DEVICES $

 ******************************************************************************
 $License: BSD3 2016 $
 ******************************************************************************
 $Release Name: PACKAGE NAME $
 $Release Date: PACKAGE RELEASE DATE $
 *****************************************************************************/

/* *********************************************************************
 * Require Modules for connection with TIMAC Application Server
 * ********************************************************************/
var net = require("net");
var events = require("events");
var Device = require('./devices/device.js');
var NwkInfo = require('./nwkinfo/nwkinfo.js');
/* *********************************************************************
 * Variables
 * ********************************************************************/
/* AppClient Instance */
var cloudClientInstance;

/* ********************************************************************
* Initialization Function
**********************************************************************/
/*!
 * @brief      Constructor for appClient
 *
 * @param      none
 *
 * @retun      none
 */
function Cloudclient() {

    /* There should be only one app client */
    if (typeof cloudClientInstance !== "undefined") {
        return cloudClientInstance;
    }

    // cfenv provides access to your Cloud Foundry environment
    // for more info, see: https://www.npmjs.com/package/cfenv
    var cfenv = require('cfenv');
    // get the app environment from Cloud Foundry
    var appEnv = cfenv.getAppEnv();

    /* set-up the instance */
    cloudClientInstance = this;
    /* set-up to emit events */
    events.EventEmitter.call(this);

    // IBM IoT service
    var Client = require('ibmiotf').IotfApplication;
    var connected = false;
    var type;
    var typeId;
    var iotPlatformServiceName;
    var iotCredentials;
    var baseConfig;
    var iotAppConfig;
    var appClient;

    /* Device list array */
    this.connectedDeviceList = [];
    self = this;
    /* Netowrk Information var */
    this.nwkInfo;

    /*!
    * @brief        This function is called to handle incoming network update
    *               message from the application
    *
    * @param
    *
    * @return
    */
    function appC_processGetNwkInfoCnf(networkInfo) {
        var nInfo = JSON.parse(networkInfo);
        if (typeof self.nwkInfo === "undefined") {
            /* create a new network info element */
            self.nwkInfo = new NwkInfo(nInfo);
        }
        else {
            /* update the information */
            self.nwkInfo.updateNwkInfo(nInfo);
        }

        appC_processGetDevArrayCnf(nInfo.devices);

        /* send the network information */
        cloudClientInstance.emit('nwkUpdate', self.nwkInfo);
        /* Get Device array from appServer */
        // appC_getDevArrayFromAppServer();
    }

    /*!
    * @brief        This function is called to handle incoming device array
    *               cnf message from the application
    *
    * @param
    *
    * @return
    */
    function appC_processGetDevArrayCnf(deviceArray) {
        /* erase the exsisting infomration we will update
        information with the incoming information */
        self.connectedDeviceList = [];
        var i;
        for (i = 0; i < deviceArray.length; i++) {
            console.log("NEW DEVICE ADDED: " + deviceArray[i].short_addr.toString());
            var newDev = new Device(deviceArray[i].short_addr, deviceArray[i].ext_addr);
            /* Add device to the list */
            self.connectedDeviceList.push(newDev);
        }
    }


    /*!
    * @brief        This function is called to handle incoming message informing of
    *               reception of sensor data message/device config resp
    *               from a network device
    *
    * @param        devData - incoming message
    *
    * @return       none
    */
    function appC_processDeviceDataRxIndMsg(devData) {
        var deviceIdx = -1;
        var deviceData = JSON.parse(devData);
        /* Find the index of the device in the list */
        deviceIdx = findDeviceIndexExtAddr(deviceData.ext_addr);
        if (deviceIdx !== -1) {
            if (deviceData.smart_objects) {
                self.connectedDeviceList[deviceIdx].rxSensorData(deviceData);
                /* send the update to web client */
                cloudClientInstance.emit('connDevInfoUpdate', self.connectedDeviceList);
            }
            else{
                console.log("Developers can write handlers for new message types ")
            }
        }

        else {
            console.log("ERROR: rcvd sensor data message for non-existing device");
        }
    }

    /************************************************************************
     * Device list utility functions
     * *********************************************************************/
    /*!
    * @brief        Find index of device in the list based on short address
    *
    * @param        srcAddr - short address of the device
    *
    * @return      index of the device in the connected device list, if present
    *              -1, if not present
    *
    */
    function findDeviceIndexShortAddr(srcAddr) {
        /* find the device in the connected device list and update info */
        for (var i = 0; i < self.connectedDeviceList.length; i++) {
            if (self.connectedDeviceList[i].shortAddress == srcAddr) {
                return i;
            }
        }
        return -1;
    }

    /*!
    * @brief        Find index of device in the list based on extended
    *               address
    *
    * @param        extAddr - extended address of the device
    *
    * @return       index of the device in the connected device list, if present
    *               -1, if not present
    */
    function findDeviceIndexExtAddr(extAddr) {
        /* Check if the device already exists */
        for (var i = 0; i < self.connectedDeviceList.length; i++) {
            /* check if extended address match */
            if (self.connectedDeviceList[i].extAddress === extAddr) {
                return i;
            }
        }
        return -1;
    }

    /*****************************************************************
    Functions to send messages to the app server
    *****************************************************************/
    /*!
    * @brief        Send Config req message to application server
    *
    * @param        none
    *
    * @return       none
    */
    function appC_sendToggleLedMsgToAppServer(data) {

        // remove 0x from the address and then conver the hex value to decimal
        // var dstAddr = data.dstAddr.substring(2).toString(10);
        var dstAddr = data.dstAddr.toString();
        console.log(dstAddr);
        // find the device index in the list
        var deviceIdx = findDeviceIndexShortAddr(dstAddr);
        if(deviceIdx != -1)
        {
            // found the device information
            var devDesc = {
                panID: self.nwkInfo.panCoord.panId,
                shortAddress: self.connectedDeviceList[deviceIdx].shortAddress,
                extAddress: self.connectedDeviceList[deviceIdx].extAddress
            };

        var myData = JSON.stringify(data);
        // appClient.publishDeviceCommand("device", self.connectedDeviceList[deviceIdx].extAddress.toString(16), "toggle", "json", '{"toggle":"true"}');
        console.log(myData);
        appClient.publishDeviceCommand(type, typeId, "deviceUpdate", "json", myData);
       }
       else{
            console.log("ERROR: rcvd sensor data message for non-existing device");
       }
    }

    function appC_setJoinPermitAtAppServer(data){
        var myData = JSON.stringify(data);
        console.log(myData);
        appClient.publishDeviceCommand(type,typeId, "nwkUpdate", "json", myData);
    }

    function appC_processSetJoinPermitCnf(permitJoinCnf) {
        var cnf = JSON.parse(permitJoinCnf);
        appClientInstance.emit('permitJoinCnf', { status: this.nwkInfo.state });
    }

    /*!
    * @brief        Allows to request for network
    *               information
    *
    * @param        none
    *
    * @return       network information
    */
    Cloudclient.prototype.appC_getNwkInfo = function () {
        /* send the netwiork information */
        cloudClientInstance.emit('nwkUpdate', self.nwkInfo);
    };

    /*!
    * @brief        Allows to request for device array
    *               information
    *
    * @param        none
    *
    * @return       connected device list
    */
    Cloudclient.prototype.appC_getDeviceArray = function () {
        /* send the device information */
        cloudClientInstance.emit('getdevArrayRsp', self.connectedDeviceList);
    };

    /*!
    * @brief        Allows to modify permit join setting for the network
    *
    * @param        none
    *
    * @return       data - containinfo about action required
    *                   "open" - open network for device joins
    *                   "close"- close netwwork for device joins
    */
    Cloudclient.prototype.appC_setPermitJoin = function (data) {
        appC_setJoinPermitAtAppServer(data);
    }

    /*!
    * @brief        Allows send toggle command to a network device
    *
    * @param        none
    *
    * @return       none
    */
    Cloudclient.prototype.appC_sendToggle = function (data) {
        appC_sendToggleLedMsgToAppServer(data);
    }


    /*!
    * @brief        Allows send config command to a network device
    *
    * @param        none
    *
    * @return       none
    */
    Cloudclient.prototype.appC_sendConfig = function (data) {
        appC_sendConfigReqToAppServer(data);
    }

    /*!
    * @brief        Receive IBM IoT Watson Credentials
    *
    * @param        none
    *
    * @return       none
    */
    Cloudclient.prototype.appC_setIBMCredentials = function (data) {

        if(connected){
            appClient.disconnect();
            connected = false;
        }

        //@attention iot-raspberrypi is the IoT platform service name in this example, you should replace it with yours
        iotPlatformServiceName = data.ServiceName;

        //Loop through configuration internally defined in Bluemix and retrieve the credential from the IoT service
        baseConfig = appEnv.getServices(iotPlatformServiceName);
        iotCredentials = baseConfig[iotPlatformServiceName];

        iotAppConfig = {
         "org" : data.Org,
         "id" : data.Id,
         "auth-method" : "apikey",
         "auth-key" : data.ApiKey,
         "auth-token" : data.ApiToken,
         "type" : "shared"
        };

        appClient = new Client(iotAppConfig);

        appClient.connect();
        type = data.type;
        typeId = data.typeId;

        // subscribe to input events
        appClient.on("connect", function () {
            console.log("Connected");
            appClient.subscribeToDeviceEvents(type, typeId, "+");
            connected = true;
        });

        appClient.on("error", function (err) {
            connected = false;
            console.log("Error : " + err);
        });

        appClient.on("reconnect", function () {
            console.log("Re-connected");
            appClient.subscribeToDeviceEvents(data.type, data.typeId, "+");
            connected = true;
        });

        appClient.on("disconnect", function () {
            connected = false;
            console.log("Disconnected");
        });
        // deviceType "sensor" and eventType "update"
        appClient.on("deviceEvent", function(deviceType, deviceId, eventType, format, payload){
            var msg = JSON.parse(payload);
            console.log("Message received: " + JSON.stringify(msg));
             switch (eventType) {
                    case "nwkUpdate":

                        appC_processGetNwkInfoCnf(JSON.stringify(msg));
                        break;
                    case "deviceUpdate":

                        appC_processDeviceDataRxIndMsg(JSON.stringify(msg));
                        break;
                    case "permitJoinCnf":

                        appC_processDeviceDataRxIndMsg(JSON.stringify(msg));
                        break;
                    default:
                        console.log("ERROR: appClient: CmdId not processed: ", payload.cmdID);
                }
        });

    }
}

Cloudclient.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Cloudclient;
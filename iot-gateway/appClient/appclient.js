/******************************************************************************
 @file appClient.js

 @brief TIMAC-2.0.0 Example Application - appClient Implementation

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

/* *********************************************************************
 * Require Modules for connection with TIMAC Application Server
 * ********************************************************************/
var net = require("net");
var fs = require("fs");
var events = require("events");

var Device = require('./devices/device.js');
var NwkInfo = require('./nwkinfo/nwkinfo.js');
var ByteBuffer = require("bytebuffer");
var Long = require("long");
var aqibot = require('aqi-bot');


/* *********************************************************************
 * Defines
 * ********************************************************************/
/* APP Server Port, this should match the port number defined in the
file: appsrv.c */
const APP_SERVER_PORT = 5000;
/* Timeout in ms to attempt to reconnect to app server */
const APP_CLIENT_RECONNECT_TIMEOUT = 5000;
const PKT_HEADER_SIZE = 4;
const PKT_HEADER_LEN_FIELD = 0;
const PKT_HEADER_SUBSYS_FIELD = 2;
const PKT_HEADER_CMDID_FIELD = 3;
const APPSRV_SYS_ID_RPC = 10;

/* Toggle debug print statements */
const PRINT_DEBUG = true;

var cmdIds = Object.freeze({
    DEVICE_JOINED_IND: 0,
    DEVICE_LEFT_IND: 1,
    NWK_INFO_IND : 2,
    GET_NWK_INFO_REQ : 3,
    GET_NWK_INFO_RSP : 4,
    GET_NWK_INFO_CNF : 5,
    GET_DEVICE_ARRAY_REQ : 6,
    GET_DEVICE_ARRAY_CNF : 7,
    DEVICE_NOTACTIVE_UPDATE_IND : 8,
    DEVICE_DATA_RX_IND : 9,
    COLLECTOR_STATE_CNG_IND : 10,
    SET_JOIN_PERMIT_REQ : 11,
    SET_JOIN_PERMIT_CNF : 12,
    TX_DATA_REQ : 13,
    TX_DATA_CNF : 14,
    RMV_DEVICE_REQ: 15,
    RMV_DEVICE_RSP: 16,
    DEV_MOVED_IND: 17
});

var Smsgs_dataFields = Object.freeze({
    tempSensor: 0x0001,
    lightSensor: 0x0002,
    aqiCalculation: 0x0004,
    msgStats: 0x0008,
    configSettings: 0x0010,
    dustSensor: 0x0800
});

var smgsCmdIds = Object.freeze({
    CONFIG_REQ: 1,
    CONFIG_RSP: 2,
    TRACKING_REQ: 3,
    TRACKING_RSP: 4,
    SENSOR_DATA: 5,
    TOGGLE_REQ: 6,
    TOGGLE_RSP: 7,
    GENERIC_REQ: 12,
    GENERIC_RSP: 13
});

var sDataMsgTypes = Object.freeze({
    SENSOR_DATA_MSG: 0x01,
    CONFIG_RSP_MSG: 0x02
});

/* *********************************************************************
 * Variables
 * ********************************************************************/
/* AppClient Instance */
var appClientInstance;

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
function Appclient() {

    /* There should be only one app client */
    if (typeof appClientInstance !== "undefined") {
        return appClientInstance;
    }

    /* set-up the instance */
    appClientInstance = this;
    /* set-up to emit events */
    events.EventEmitter.call(this);
    /* set-up to connect to app server */
    var appClient = net.Socket();
    /* Start the connection with app Server */
    appClient.connect(APP_SERVER_PORT, '127.0.0.1', function () {
        console.log("Connected to App Server");
        /* Request Network Information */
        appC_getNwkInfoFromAppServer();
    });
    /* set-up callback for incoming data from the app server */
    appClient.on('data', function (data) {
        /* Call the incoming data processing function */
        appC_processIncoming(data);
    });

    /* set-up to handle error event */
    appClient.on('error', function (data) {
		/* connection lost or unable to make connection with the
		appServer, need to get network and device info back again
		as those may have changed */
        if(PRINT_DEBUG) console.log("ERROR: Rcvd Error on the socket connection with AppServer");
        if(PRINT_DEBUG) console.log(data);
        appClientReconnect();
    });
    /* Device list array */
    this.connectedDeviceList = [];
    self = this;
    /* Network Information var */
    this.nwkInfo;

	/*
	 * @brief      This function is called to  attempt to reconnect with
	 * 			   the application server
 	 *
 	 * @param      none
 	 *
 	 * @retun      none
	*/
    function appClientReconnect() {
        if (typeof appClientInstance.clientReconnectTimer === 'undefined') {
            /*start a connection timer that tries to reconnect 5s */
            appClientInstance.clientReconnectTimer = setTimeout(function () {
                appClient.destroy();
                appClient.connect(APP_SERVER_PORT, '127.0.0.1', function () {
                    console.log("Connected to App Server");
					/* Request Network Information, we just
					reconnected get info again in case something may
					have changed */
                    appC_getNwkInfoFromAppServer();
                });
                clearTimeout(appClientInstance.clientReconnectTimer);
                delete appClientInstance.clientReconnectTimer;
            }, APP_CLIENT_RECONNECT_TIMEOUT);
        }
    }

	/* *****************************************************************
	* Process Incoming Messages from the App Server
	*******************************************************************/
	/*!
	* @brief        This function is called to handle incoming messages
	*				from the app server
	*
	* @param        data - Incoming data msg buffer
	*
	* @return       none
	*/
    function appC_processIncoming(data) {
        var dataIdx = 0;
        while (dataIdx < data.length) {
            var rx_pkt_len = data[dataIdx + PKT_HEADER_LEN_FIELD] + (data[dataIdx + PKT_HEADER_LEN_FIELD + 1] << 8) + PKT_HEADER_SIZE;
            var rx_pkt_buf = new ByteBuffer(rx_pkt_len, ByteBuffer.LITTLE_ENDIAN);
            rx_pkt_buf.append(data.slice(dataIdx, dataIdx + rx_pkt_len), "hex", 0);
            if(PRINT_DEBUG) console.log('Incomming Msg: ' + rx_pkt_buf);
            dataIdx = dataIdx + rx_pkt_len;

            var rx_cmd_id = rx_pkt_buf.readUint8(PKT_HEADER_CMDID_FIELD);
            switch (rx_cmd_id) {
                case cmdIds.DEVICE_JOINED_IND:
                    if(PRINT_DEBUG) console.log('Device Joined Ind');
                    appC_processDeviceJoinedIndMsg(rx_pkt_buf);
                    break;
                case cmdIds.NWK_INFO_IND:
                    if(PRINT_DEBUG) console.log('Network Info Ind');
                    appC_processNetworkUpdateIndMsg(rx_pkt_buf);
                    break;
                case cmdIds.GET_NWK_INFO_CNF:
                    if(PRINT_DEBUG) console.log('Network Info Cnf');
                    appC_processGetNwkInfoCnf(rx_pkt_buf);
                    break;
                case cmdIds.GET_DEVICE_ARRAY_CNF:
                    if(PRINT_DEBUG) console.log('Device Array Cnf');
                    appC_processGetDevArrayCnf(rx_pkt_buf);
                    break;
                case cmdIds.DEVICE_NOTACTIVE_UPDATE_IND:
                    if(PRINT_DEBUG) console.log('Notactive Update Ind');
                    appC_processDeviceNotActiveIndMsg(rx_pkt_buf);
                    break;
                case cmdIds.DEVICE_DATA_RX_IND:
                    if(PRINT_DEBUG) console.log('Data Rx Ind');
                    appC_processDeviceDataRxIndMsg(rx_pkt_buf);
                    break;
                case cmdIds.COLLECTOR_STATE_CNG_IND:
                    if(PRINT_DEBUG) console.log('State Change Ind');
                    appC_processStateChangeUpdate(rx_pkt_buf);
                    break;
                case cmdIds.SET_JOIN_PERMIT_CNF:
                    if(PRINT_DEBUG) console.log('Join Permit Cnf');
                    appC_processSetJoinPermitCnf(rx_pkt_buf);
                    break;
                case cmdIds.TX_DATA_CNF:
                    if(PRINT_DEBUG) console.log('Tx Data Cnf');
                    break;
                case cmdIds.RMV_DEVICE_RSP:
                    if(PRINT_DEBUG) console.log('Rmv Device Rsp');
                    appC_processRemoveDeviceRsp(rx_pkt_buf);
                    break;
                default:
                    if(PRINT_DEBUG) console.log('ERROR: cmdId not processed');
            }
        }
    }

	/*!
	* @brief        This function is called to handle incoming network update
	* 				message from the application
	*
	* @param        Incoming msg data buffer
	*
	* @return       none
	*/
    function appC_processGetNwkInfoCnf(data){
        var ind = PKT_HEADER_SIZE;

        /* TODO: Make this simpler, no need for multiple nested objects */
        var nInfo = {};
        nInfo.nwkinfo = {};
        nInfo.nwkinfo.nwkInfo = {};
        nInfo.nwkinfo.nwkInfo.devInfo = {};

        nInfo.status = data.readUint8(ind);
        ind += 1;

        nInfo.nwkinfo.nwkInfo.devInfo.panID = data.readUint16(ind);
        ind += 2;
        nInfo.nwkinfo.nwkInfo.devInfo.shortAddress = data.readUint16(ind);
        ind += 2;
        nInfo.nwkinfo.nwkInfo.devInfo.extAddress = data.readUint64(ind);
        ind += 8;
        nInfo.nwkinfo.nwkInfo.channel = data.readUint8(ind);
        ind += 1;
        nInfo.nwkinfo.nwkInfo.fh = data.readUint8(ind);
        ind += 1;
        nInfo.nwkinfo.securityEnabled = data.readUint8(ind);
        ind += 1;
        nInfo.nwkinfo.networkMode = data.readUint8(ind),
        ind += 1;
        nInfo.nwkinfo.state = data.readUint8(ind)

        if (nInfo.status != 1) {
			/* Network not yet started, no nwk info returned
			by app server keep waiting until the server
			informs of the network info via network update indication
			*/
            if(PRINT_DEBUG) console.log('Network not started; Waiting for updates.');
            return;
        }
        if (typeof self.nwkInfo === "undefined") {
            /* create a new network info element */
            self.nwkInfo = new NwkInfo(nInfo);
        }
        else {
            /* Update the network information */
            self.nwkInfo.updateNwkInfo(nInfo);
        }
        if(PRINT_DEBUG) console.log(self.nwkInfo);

        /* Send update to web-client */
        appClientInstance.emit('nwkUpdate');
        /* Get device array from appsrv */
        appC_getDevArrayFromAppServer();
    }

	/*!
	* @brief        This function is called to handle incoming device array
	* 				cnf message from the application
	*
	* @param        data - Incoming msg data buffer
	*
	* @return       none
	*/
    function appC_processGetDevArrayCnf(data) {
        /* Erase the exsisting infomration we will update
		information with the incoming information */
        self.connectedDeviceList = [];
        var ind = PKT_HEADER_SIZE;

        var status = data.readUint8(ind);
        ind += 1;
        var n = data.readUint16(ind);
        ind += 2;

        var i;
        for(i = 0; i < n; i++){
            var panId = data.readUint16(ind);
            ind += 2;
            var shortAddress = data.readUint16(ind);
            ind += 2;
            var extendedAddress = data.readUint64(ind);
            ind += 8;

            var capInfo = {};
            capInfo.panCoord = data.readUint8(ind);
            ind += 1;
            capInfo.ffd = data.readUint8(ind);
            ind += 1;
            capInfo.mainsPower = data.readUint8(ind);
            ind += 1;
            capInfo.rxOnWhenIdle = data.readUint8(ind);
            ind += 1;
            capInfo.security = data.readUint8(ind);
            ind += 1;
            capInfo.allocAddr = data.readUint8(ind)
            ind += 1;

            var newDev = new Device(shortAddress, extendedAddress, capInfo);
            self.connectedDeviceList.push(newDev);
        }
        if(PRINT_DEBUG) console.log(self.connectedDeviceList);
        appClientInstance.emit('getdevArrayRsp');
    }

	/*!
	* @brief        This function is called to handle incoming network update
	* 				ind message from the application
	*
	* @param        Incoming msg data buffer
	*
	* @return       none
	*/
    function appC_processNetworkUpdateIndMsg(data) {
        var ind = PKT_HEADER_SIZE;

        /* TODO: Make this simpler by removing nested objects */
        var nInfo = {};
        nInfo.nwkinfo = {};
        nInfo.nwkinfo.nwkInfo = {};
        nInfo.nwkinfo.nwkInfo.devInfo = {};

        nInfo.nwkinfo.nwkInfo.devInfo.panID = data.readUint16(ind);
        ind += 2;
        nInfo.nwkinfo.nwkInfo.devInfo.shortAddress = data.readUint16(ind);
        ind += 2;
        nInfo.nwkinfo.nwkInfo.devInfo.extAddress = data.readUint64(ind);
        ind += 8;
        nInfo.nwkinfo.nwkInfo.channel = data.readUint8(ind);
        ind += 1;
        nInfo.nwkinfo.nwkInfo.fh = data.readUint8(ind);
        ind += 1;
        nInfo.nwkinfo.securityEnabled = data.readUint8(ind);
        ind += 1;
        nInfo.nwkinfo.networkMode = data.readUint8(ind),
        ind += 1;
        nInfo.nwkinfo.state = data.readUint8(ind)

        if (typeof self.nwkInfo === "undefined") {
            /* Create a new network info element */
            self.nwkInfo = new NwkInfo(nInfo);
        }
        else {
            /* Update the network information */
            self.nwkInfo.updateNwkInfo(nInfo);
        }
        if(PRINT_DEBUG) console.log(self.nwkInfo);
        /* Send update to web-client */
        appClientInstance.emit('nwkUpdate');
    }

	/*!
	* @brief        This function is called to handle incoming device joined
	* 				ind message informing of new device join from the
	* 				application
	*
	* @param 		Incoming msg data buffer
	*
	* @return       none
	*/
    function appC_processDeviceJoinedIndMsg(data) {
        var ind = PKT_HEADER_SIZE;

        /* Skip panId */
        ind += 2;

        var shortAddress = data.readUint16(ind);
        ind += 2;
        var extendedAddress = data.readUint64(ind);
        ind += 8;

        var capInfo = {}
        capInfo.panCoord = data.readUint8(ind);
        ind += 1;
        capInfo.ffd = data.readUint8(ind);
        ind += 1;
        capInfo.mainsPower = data.readUint8(ind);
        ind += 1;
        capInfo.rxOnWhenIdle = data.readUint8(ind);
        ind += 1;
        capInfo.security = data.readUint8(ind);
        ind += 1
        capInfo.allocAddr = data.readUint8(ind);

        var newDev = new Device(shortAddress, extendedAddress, capInfo);
        var devIndex = self.connectedDeviceList.push(newDev) - 1;

        if(PRINT_DEBUG) console.log(newDev);

        /* Send network update */
        appClientInstance.emit('nwkUpdate');

        /* Send update to web-client */
        appClientInstance.emit('connDevInfoUpdate', self.connectedDeviceList[devIndex]);
    }

	/*!
	* @brief        This function is called to handle incoming message informing that
	* 				 a device is now inactive(?)
	*
	* @param 		data - Incoming msg data buffer
	*
	* @return       none
	*/
    function appC_processDeviceNotActiveIndMsg(data) {
        var ind = PKT_HEADER_SIZE;

        /* Skip panId */
        ind += 2;

        var inactivedeviceInfo = {};
        inactivedeviceInfo.shortAddress = data.readUint16(ind);
        ind += 2;
        inactivedeviceInfo.extAddress = data.readUint64(ind);
        ind += 8;
        inactivedeviceInfo.timeout = data.readUint8(ind);
        ind += 1;

        var deviceIdx = findDeviceIndexShortAddr(inactivedeviceInfo.shortAddress);
        if (deviceIdx !== -1) {
            self.connectedDeviceList[deviceIdx].deviceNotActive(inactivedeviceInfo);
            /* Update the web-client */
            appClientInstance.emit('connDevInfoUpdate', self.connectedDeviceList[deviceIdx]);
        }
        else {
            if(PRINT_DEBUG) console.log("ERROR: rcvd inactive status info for non-existing device");
        }
    }

	/*!
	* @brief        This function is called to handle incoming message informing of
	* 				reception of sensor data message/device config resp
	*				from a network device
	*
	* @param 		data - Incoming msg data buffer
	*
	* @return       none
	*/

    function appC_processDeviceDataRxIndMsg(data){
        var ind = PKT_HEADER_SIZE;
        var deviceIdx = -1;
        var deviceData = {};
        deviceData.srcAddr = {};

        deviceData.srcAddr.addrMode = data.readUint8(ind);
        ind += 1;

        if(deviceData.srcAddr.addrMode == 3){
            deviceData.srcAddr.extAddr = data.readUint64(ind);
            ind += 8;
            deviceIdx = findDeviceIndexExtAddr(deviceData.srcAddr.extAddress);
        }
        else if(deviceData.srcAddr.addrMode == 2){
            deviceData.srcAddr.shortAddr = data.readUint16(ind);
            ind += 2;
            deviceIdx = findDeviceIndexShortAddr(deviceData.srcAddr.shortAddr);
        }

        /* Read signed rssi */
        deviceData.rssi = data.readInt8(ind);
        ind += 1;

        deviceData.msgContent = data.readUint8(ind);
        ind += 1;

        /* Sensor data msg received */
        if(deviceData.msgContent & sDataMsgTypes.SENSOR_DATA_MSG){
            deviceData.sDataMsg = {};
            deviceData.sDataMsg.cmdId = data.readUint8(ind);
            ind += 1;
            deviceData.sDataMsg.frameControl = data.readUint16(ind);
            ind += 2;
            deviceData.sDataMsg.extAddr = data.readUint64(ind);
            ind += 8;


            /* Temperature sensor data received */
            if(deviceData.sDataMsg.frameControl & Smsgs_dataFields.tempSensor){
                deviceData.sDataMsg.tempSensor = {};
                deviceData.sDataMsg.tempSensor.ambienceTemp = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.tempSensor.objectTemp = data.readUint16(ind);
                ind += 2;
            }
            /* Dust sensor data received */
            if(deviceData.sDataMsg.frameControl & Smsgs_dataFields.dustSensor){
                deviceData.sDataMsg.dustSensor = {};
                deviceData.sDataMsg.dustSensor.pm10_env = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.dustSensor.pm25_env = data.readUint16(ind);
                deviceData.aqi.pm25 = calAqi(data.readUint16(ind));
                ind += 2;

            }


            /* Light sensor data received */
            if(deviceData.sDataMsg.frameControl & Smsgs_dataFields.lightSensor){
                deviceData.sDataMsg.lightSensor = {};
                deviceData.sDataMsg.lightSensor.O3_envm = data.readUint16(ind);
                deviceData.aqi.ozone = calAqi(data.readUint16(ind));
                ind += 2;
                deviceData.sDataMsg.lightSensor.CO_envm = data.readUint16(ind);
                deviceData.aqi.co = calAqi(data.readUint16(ind));
                ind += 2;
                deviceData.sDataMsg.lightSensor.SO2_envm = data.readUint16(ind);
                deviceData.aqi.so2 = calAqi(data.readUint16(ind));
                ind += 2;
                deviceData.sDataMsg.lightSensor.NO2_envm = data.readUint16(ind);
                deviceData.aqi.no2 = calAqi(data.readUint16(ind));
                ind += 2;
            }
        /* AQI calculation data received */
            if (deviceData.sDataMsg.frameControl & Smsgs_dataFields.aqiCalculation) {
                deviceData.sDataMsg.aqiCalculation = {};
                deviceData.sDataMsg.aqiCalculation.O3_avg = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.aqiCalculation.CO_avg = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.aqiCalculation.SO2_avg = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.aqiCalculation.NO2_avg = data.readUint16(ind);
                ind += 2;
            }
            /* Msg Stats recieved */
            if(deviceData.sDataMsg.frameControl & Smsgs_dataFields.msgStats){
                deviceData.sDataMsg.msgStats = {};
                deviceData.sDataMsg.msgStats.joinAttempts = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.joinFails = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.msgsAttempted = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.msgsSent = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.trackingRequests = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.trackingResponseAttempts = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.trackingResponseSent = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.configRequests = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.configResponseAttempts = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.configResponseSent = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.channelAccessFailures = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.macAckFailures = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.otherDataRequestFailures = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.syncLossIndications = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.rxDecryptFailures = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.txEncryptFailures = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.resetCount = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.lastResetReason = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.joinTime = data.readUint16(ind);
                ind += 2;
                deviceData.sDataMsg.msgStats.interimDelay = data.readUint16(ind);
                ind += 2;
            }
            /* Config Settings recieved */
            if(deviceData.sDataMsg.frameControl & Smsgs_dataFields.configSettings){
                deviceData.sDataMsg.configSettings = {};
                deviceData.sDataMsg.configSettings.reportingInterval = data.readUint32(ind);
                ind += 4;
                deviceData.sDataMsg.configSettings.pollingInterval = data.readUint32(ind);
                ind += 4;
            }
 


            /* Check to see if device is known*/
            if (deviceIdx !== -1) {
                self.connectedDeviceList[deviceIdx].rxSensorData(deviceData);

                if(PRINT_DEBUG) console.log(deviceData);

                /* Update the web-client */
                appClientInstance.emit('connDevInfoUpdate', self.connectedDeviceList[deviceIdx]);
            }
            else {
                if(PRINT_DEBUG) console.log('ERROR: Sensor data msg received from unknown device');
            }
        }

        /* Sensor config msg received */
        if(deviceData.msgContent & sDataMsgTypes.CONFIG_RSP_MSG){
            deviceData.sConfigMsg = {};
            deviceData.sConfigMsg.cmdId = data.readUint8(ind);
            ind += 1;
            deviceData.sConfigMsg.status = data.readUint16(ind);
            ind += 2;
            deviceData.sConfigMsg.frameControl = data.readUint16(ind);
            ind += 2;
            deviceData.sConfigMsg.reportingInterval = data.readUint32(ind);
            ind += 4;
            deviceData.sConfigMsg.pollingInterval = data.readUint32(ind);

            /* Check to see if device is known*/
            if (deviceIdx !== -1) {
                self.connectedDeviceList[deviceIdx].rxConfigRspInd(deviceData);

                if(PRINT_DEBUG) console.log(deviceData);

                /* Update the web-client */
                appClientInstance.emit('connDevInfoUpdate', self.connectedDeviceList[deviceIdx]);
            }
            else {
                if(PRINT_DEBUG) console.log('ERROR: Sensor config response msg received from unknown device');
            }
        }
    }


	/*!
	* @brief        This function is called to handle incoming message informing change
	* 				in the state of the PAN-Coordiantor
	*
	* @param 		data - Incoming msg data buffer
	*
	* @return       none
	*/
    function appC_processStateChangeUpdate(data) {
        var nState = {state: data.readUint8(4)};
        if(PRINT_DEBUG) console.log(nState);
        /* update state */
        self.nwkInfo.updateNwkState(nState);
        /* send info to web client */
        appClientInstance.emit('nwkUpdate');
    }

	/*!
	* @brief        This function is called to handle incoming confirm for
	*				setjoinpermitreq
	*
	* @param 		data - Incoming msg data buffer
	*
	* @return       none
	*/
    function appC_processSetJoinPermitCnf(data) {
        var cnfStatus = data.readUint32(PKT_HEADER_SIZE);
        if (!cnfStatus && PRINT_DEBUG) console.log('JoinPermit Success!');
        appClientInstance.emit('permitJoinCnf', { status: cnfStatus });
    }


    /*!
	* @brief        This function is called to handle a remove device response
	*
	* @param 		data - Incoming msg data buffer
	*
	* @return       none
	*/
    function appC_processRemoveDeviceRsp(data){
        /* Device has been removed, ask for updated array */
        appC_getDevArrayFromAppServer();
    }

	/************************************************************************
	 * Device list utility functions
	 * *********************************************************************/
	/*!
	* @brief        Find index of device in the list based on short address
	*
	* @param 		srcAddr - short address of the device
	*
	* @return      index of the device in the connected device list, if present
	*			   -1, if not present
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
	*				address
	*
	* @param 		extAddr - extended address of the device
	*
	* @return       index of the device in the connected device list, if present
	*			    -1, if not present
	*/
    function findDeviceIndexExtAddr(extAddr) {
        /* Check if the device already exists */
        for (var i = 0; i < self.connectedDeviceList.length; i++) {
            /* check if extended address match */
            if (self.connectedDeviceList[i].extAddress == extAddr) {
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
	* @param 		data - Contains device address to send req to
	*
	* @return       none
	*/
    function appC_sendConfigReqToAppServer(data) {
        var dstAddr = parseInt(data.dstAddr.substring(2),16);
        var deviceIdx = findDeviceIndexShortAddr(dstAddr);
        if(deviceIdx != -1){
            var len = 9;
            var msg_buf = new ByteBuffer(PKT_HEADER_SIZE + len, ByteBuffer.LITTLE_ENDIAN);
            msg_buf.writeShort(len, PKT_HEADER_LEN_FIELD);
            msg_buf.writeUint8(APPSRV_SYS_ID_RPC, PKT_HEADER_SUBSYS_FIELD);
            msg_buf.writeUint8(cmdIds.TX_DATA_REQ, PKT_HEADER_CMDID_FIELD);
            var ind = PKT_HEADER_SIZE;
            msg_buf.writeUint8(smgsCmdIds.CONFIG_REQ, ind);
            ind+=1;
            msg_buf.writeUint16(self.connectedDeviceList[deviceIdx].shortAddress, ind);
            ind+=2;
            msg_buf.writeUint16(parseInt(data.pollingInterval), ind);
            ind+=2;
            msg_buf.writeUint16(parseInt(data.reportingInterval), ind);
            ind+=2;
            msg_buf.writeUint16(parseInt(data.framecontrol), ind);

            if(PRINT_DEBUG) console.log("Sent config request");

            appClient.write(msg_buf.buffer);
        }

    }

    function appC_sendDevMovedIndToAppServer(data){
        var dstAddr = parseInt(data.shortAddr,16);
        var deviceIdx = findDeviceIndexShortAddr(dstAddr);
        if(deviceIdx != -1){
            var len = 2;
            var ind = PKT_HEADER_SIZE;

            var msg_buf = new ByteBuffer(PKT_HEADER_SIZE + len, ByteBuffer.LITTLE_ENDIAN);
            msg_buf.writeShort(len, PKT_HEADER_LEN_FIELD);
            msg_buf.writeUint8(APPSRV_SYS_ID_RPC, PKT_HEADER_SUBSYS_FIELD);
            msg_buf.writeUint8(cmdIds.DEV_MOVED_IND, PKT_HEADER_CMDID_FIELD);

            msg_buf.writeUint16(self.connectedDeviceList[deviceIdx].shortAddress, ind);

            if(PRINT_DEBUG) console.log("Sent device moved ind");

            appClient.write(msg_buf.buffer);
        }
    }

	/*!
	* @brief        Send toggle led req message to application server
	*
	* @param 		data - Contains device address to send req to
	*
	* @return       none
	*/
    function appC_sendToggleLedMsgToAppServer(data) {
        //Find index of ext address
        var dstAddr = data.dstAddr.substring(2);

        var deviceIdx = findDeviceIndexShortAddr(dstAddr);
        if (deviceIdx == -1){
            deviceIdx = findDeviceIndexExtAddr(dstAddr);
        }
        if(deviceIdx != -1){
            var len = 5;
            var msg_buf = new ByteBuffer(PKT_HEADER_SIZE + len, ByteBuffer.LITTLE_ENDIAN);
            msg_buf.writeShort(len, PKT_HEADER_LEN_FIELD);
            msg_buf.writeUint8(APPSRV_SYS_ID_RPC, PKT_HEADER_SUBSYS_FIELD);
            msg_buf.writeUint8(cmdIds.TX_DATA_REQ, PKT_HEADER_CMDID_FIELD);
            var ind = PKT_HEADER_SIZE;
            msg_buf.writeUint8(smgsCmdIds.TOGGLE_REQ, ind);
            ind+=1;
            msg_buf.writeUint16(self.connectedDeviceList[deviceIdx].shortAddress, ind);

            appClient.write(msg_buf.buffer);
            if(PRINT_DEBUG) console.log("Sent toggle request");
        }
    }

    /*!
	* @brief        Send Generic req message to application server
	*
	* @param 		data - Contains device address to send req to
	*
	* @return       none
	*/
    function appC_sendGenericMsgToAppServer(data) {
        //Find index of ext address
        var dstAddr = data.dstAddr.substring(2);

        var deviceIdx = findDeviceIndexShortAddr(dstAddr);
        if (deviceIdx == -1){
            deviceIdx = findDeviceIndexExtAddr(dstAddr);
        }
        if(deviceIdx != -1){
            var len = 5;
            var msg_buf = new ByteBuffer(PKT_HEADER_SIZE + len, ByteBuffer.LITTLE_ENDIAN);
            msg_buf.writeShort(len, PKT_HEADER_LEN_FIELD);
            msg_buf.writeUint8(APPSRV_SYS_ID_RPC, PKT_HEADER_SUBSYS_FIELD);
            msg_buf.writeUint8(cmdIds.TX_DATA_REQ, PKT_HEADER_CMDID_FIELD);
            var ind = PKT_HEADER_SIZE;
            msg_buf.writeUint8(smgsCmdIds.GENERIC_REQ, ind);
            ind+=1;
            msg_buf.writeUint16(self.connectedDeviceList[deviceIdx].shortAddress, ind);

            appClient.write(msg_buf.buffer);
            if(PRINT_DEBUG) console.log("Sent Generic request");
        }
    }

    /*!
	* @brief        Send remove device req message to application server
	*
	* @param 		data - Contains device address to send req to
	*
	* @return       none
	*/
    function appC_sendRemoveDeviceReqToAppServer(data){
        /* Parse the string received from web-client */
        var shortAddr = parseInt(data.substring(2),16);

        var len = 2;
        var msg_buf = new ByteBuffer(PKT_HEADER_SIZE + len, ByteBuffer.LITTLE_ENDIAN);
        msg_buf.writeShort(len, PKT_HEADER_LEN_FIELD);
        msg_buf.writeUint8(APPSRV_SYS_ID_RPC, PKT_HEADER_SUBSYS_FIELD);
        msg_buf.writeUint8(cmdIds.RMV_DEVICE_REQ, PKT_HEADER_CMDID_FIELD);
        msg_buf.writeUint16(shortAddr, PKT_HEADER_SIZE);

        appClient.write(msg_buf.buffer);
        if(PRINT_DEBUG) console.log("Sent remove device request");
    }

	/*!
	* @brief        Send get network Info Req to application server
	*
	* @param 		none
	*
	* @return       none
	*/
    function appC_getNwkInfoFromAppServer() {
        var len = 0;
        var msg_buf = new ByteBuffer(PKT_HEADER_SIZE + len, ByteBuffer.LITTLE_ENDIAN);
        msg_buf.writeShort(len, PKT_HEADER_LEN_FIELD);
        msg_buf.writeUint8(APPSRV_SYS_ID_RPC, PKT_HEADER_SUBSYS_FIELD);
        msg_buf.writeUint8(cmdIds.GET_NWK_INFO_REQ, PKT_HEADER_CMDID_FIELD);
        appClient.write(msg_buf.buffer);
        if(PRINT_DEBUG) console.log("Get network info req sent");
    }

	/*!
	* @brief        Send get device array Req to application server
	*
	* @param 		none
	*
	* @return       none
	*/
    function appC_getDevArrayFromAppServer() {
        var len = 0;
        var msg_buf = new ByteBuffer(PKT_HEADER_SIZE + len, ByteBuffer.LITTLE_ENDIAN);
        msg_buf.writeShort(len, PKT_HEADER_LEN_FIELD);
        msg_buf.writeUint8(APPSRV_SYS_ID_RPC, PKT_HEADER_SUBSYS_FIELD);
        msg_buf.writeUint8(cmdIds.GET_DEVICE_ARRAY_REQ, PKT_HEADER_CMDID_FIELD);
        appClient.write(msg_buf.buffer);
        if(PRINT_DEBUG) console.log("Sent get device array req");
    }

	/*!
	* @brief        Send join permit Req to application server
	*
	* @param 		data - contains info about action required
	*					"open" - open network for device joins
	*				    "close"- close netwwork for device joins
	*
	* @return       none
	*/
    function appC_setJoinPermitAtAppServer(data) {
        var duration = 0x0;
        if (data.action == "open") {
            /* Set always open value */
            duration = 0xFFFFFFFF;
        }
        else {
            /* Set always close value */
            duration = 0x0;
        }
        /* Create the message */
        var len = 4;
        var msg_buf = new ByteBuffer(PKT_HEADER_SIZE + len, ByteBuffer.LITTLE_ENDIAN);
        msg_buf.writeShort(len, PKT_HEADER_LEN_FIELD);
        msg_buf.writeUint8(APPSRV_SYS_ID_RPC, PKT_HEADER_SUBSYS_FIELD);
        msg_buf.writeUint8(cmdIds.SET_JOIN_PERMIT_REQ, PKT_HEADER_CMDID_FIELD);
        msg_buf.writeUint32(duration,PKT_HEADER_SIZE);
        /* Send the message */
        appClient.write(msg_buf.buffer);
        if(PRINT_DEBUG) console.log("Sending join permit");
    }

	/*!
	* @brief        Allows to request for network
	*				information
	*
	* @param 		none
	*
	* @return       network information
	*/
    Appclient.prototype.appC_getNwkInfo = function () {
        /* send the netwiork information */
        appClientInstance.emit('nwkUpdate');
    };

	/*!
	* @brief        Allows to request for device array
	*				information
	*
	* @param 		none
	*
	* @return       connected device list
	*/
    Appclient.prototype.appC_getDeviceArray = function () {
        /* send the device information */
        appClientInstance.emit('getdevArrayRsp');
    };

	/*!
	* @brief        Allows to modify permit join setting for the network
	*
	* @param 		none
	*
	* @return       data - contains info about action required
	*					"open" - open network for device joins
	*				    "close"- close netwwork for device joins
	*/
    Appclient.prototype.appC_setPermitJoin = function (data) {
        appC_setJoinPermitAtAppServer(data);
    }

	/*!
	* @brief        Allows send toggle command to a network device
	*
	* @param 		none
	*
	* @return       none
	*/
    Appclient.prototype.appC_sendToggle = function (data) {
        appC_sendToggleLedMsgToAppServer(data);
    }

    /*!
	* @brief        Allows send generic command to a network device
	*
	* @param 		none
	*
	* @return       none
	*/
    Appclient.prototype.appC_sendGeneric = function (data) {
        appC_sendGenericMsgToAppServer(data);
    }

    /*!
	* @brief        Allows a device to be removed from device lists
	*
	* @param 		none
	*
	* @return       none
	*/
    Appclient.prototype.appC_removeDeviceReq = function (data) {
        appC_sendRemoveDeviceReqToAppServer(data);
    }


	/*!
	* @brief        Allows send config command to a network device
	*
	* @param 		none
	*
	* @return       none
	*/
    Appclient.prototype.appC_sendConfig = function (data) {
        appC_sendConfigReqToAppServer(data);
    }

    /*!
	* @brief        Allows send device moved ind msg
	*
	* @param 		none
	*
	* @return       none
	*/
    Appclient.prototype.appC_sendDevMovedInd = function (data) {
        appC_sendDevMovedIndToAppServer(data);
    }

}

function calAqi(type, avg) {
    var aqi = 0;
    aqibot.AQICalculator.getAQIResult(type, avg).then((res) => {
        aqi = res;
    }).catch(err => {
        console.log(err);
    })
    return aqi;
}

Appclient.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Appclient;
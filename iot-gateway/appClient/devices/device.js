/******************************************************************************

 @file device.js

 @brief device specific functions

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

/********************************************************************
 * Variables
 * *****************************************************************/
var fs = require("fs");
var SmartObject = require('smartobject');
var Long = require("long");
var aqibot = require('aqi-bot');

/********************************************************************
 * Defines
 * *****************************************************************/
var Smsgs_dataFields = Object.freeze({
    tempSensor: 0x0001,
    lightSensor: 0x0002,
    aqiCalculation: 0x004,
    msgStats: 0x0008,
    configSettings: 0x0010,
    dustSensor: 0x0800
});

var aqi = {
    ozone: 0,
    co: 0,
    so2: 0,
    no2: 0,
}
/*!
 * @brief      Constructor for device objects
 *
 * @param      shortAddress - 16 bit address of the device
 * 			   extAddress - 64 bit IEEE address of the device
 * 			   capabilityInfo - device capability information
 *
 * @retun      device object
 */

function calAqi(type, avg) {
    var aqi = 0;
    aqibot.AQICalculator.getAQIResult(type, avg).then((res) => {
        aqi = res;
    }).catch(err => {
        console.log(err);
    })
    return aqi;
}

function Device(shortAddress, extAddress, capabilityInfo) {
    var devInfo = this;
    devInfo.shortAddress = shortAddress;
    devInfo.extAddress = extAddress.toString(16);
    devInfo.capabilityInfo = capabilityInfo;
    devInfo.active = 'true';
    devInfo.so = new SmartObject();
    devInfo.aqi = {
        ozone: calAqi("O3", aqi.ozone),
        co: calAqi("CO", aqi.co),
        so2: calAqi("SO2", aqi.so2),
        no2: calAqi("NO2", aqi.no2),
    }
    return devInfo;
}

/**
 *
 */
function updateSensor(so, type, instance, value, units) {
    /* Sensor already exists, update its values */
    if (so.has(type, instance)) {
        so.write(type, instance, 'sensorValue', value, function (err, data) { });

        if (value < so.get(type, instance, 'minMeaValue'))
            so.write(type, instance, 'minMeaValue', value, function (err, data) { });

        if (value > so.get(type, instance, 'maxMeaValue'))
            so.write(type, instance, 'maxMeaValue', value, function (err, data) { });
    }
    /* Need to initialize the sensor */
    else {
        so.init(type, instance, {
            "sensorValue": value,
            "units": units,
            "minMeaValue": value,
            "maxMeaValue": value
        });
    }
}

function updateXYZSensor(so, type, instance, x, y, z, units) {
	/* Sensor already exists, update its values */
	if (so.has(type, instance)) {
		so.write(type, instance, 'xValue', x, function (err, data) { });
		so.write(type, instance, 'yValue', y, function (err, data) { });
		so.write(type, instance, 'zValue', z, function (err, data) { });
		so.write(type, instance, 'units', units, function (err, data) { });
	}
	/* Need to initialize the sensor */
	else {
		so.init(type, instance, {
			"xValue" : x,
			"yValue" : y,
			"zValue" : z,
			"units" : units
		});
	}
}


/* Prototype Functions */
Device.prototype.rxSensorData = function (sensorData) {
    /* recieved message from the device, set as active */
    this.active = 'true';
	/* Check the support sensor Types and
	add information elements for those */
    if (sensorData.sDataMsg.frameControl & Smsgs_dataFields.tempSensor){
        /* update the sensor values */
        this.temperaturesensor = {
            ambienceTemp: sensorData.sDataMsg.tempSensor.ambienceTemp,
            objectTemp: sensorData.sDataMsg.tempSensor.objectTemp
        };
        // create/upate ambience temp data
        updateSensor(this.so, 'temperature', 0, sensorData.sDataMsg.tempSensor.ambienceTemp, 'Cels');
    }
    if (sensorData.sDataMsg.frameControl & Smsgs_dataFields.lightSensor) {
        /* update the sensor values */
        this.lightsensor = {
            O3_envm: sensorData.sDataMsg.lightSensor.O3_envm,
            CO_envm: sensorData.sDataMsg.lightSensor.CO_envm,
            SO2_envm: sensorData.sDataMsg.lightSensor.SO2_envm,
            NO2_envm: sensorData.sDataMsg.lightSensor.NO2_envm,

        };
        updateSensor(this.so, 'gas', 0, sensorData.sDataMsg.lightSensor.O3_envm, 'ppb');
        updateSensor(this.so, 'gas', 1, sensorData.sDataMsg.lightSensor.CO_envm, 'ppb');
        updateSensor(this.so, 'gas', 2, sensorData.sDataMsg.lightSensor.SO2_envm, 'ppb');
        updateSensor(this.so, 'gas', 3, sensorData.sDataMsg.lightSensor.NO2_envm, 'ppb');
        aqi.ozone = Number(sensorData.sDataMsg.lightSensor.O3_envm);
        aqi.co = Number(sensorData.sDataMsg.lightSensor.CO_envm);
        aqi.so2 = Number(sensorData.sDataMsg.lightSensor.SO2_envm);
        aqi.no2 = Number(sensorData.sDataMsg.lightSensor.NO2_envm)

    }
   if (sensorData.sDataMsg.frameControl & Smsgs_dataFields.dustSensor) {
        /* update the sensor values */
        this.dustsensor = {
            pm10_env: sensorData.sDataMsg.dustSensor.pm10_env,
            pm25_env: sensorData.sDataMsg.dustSensor.pm25_env,
        };
        updateSensor(this.so, 'dust', 0, sensorData.sDataMsg.dustSensor.pm10_env, ' ug/m3');
        updateSensor(this.so, 'dust', 1, sensorData.sDataMsg.dustSensor.pm25_env, ' ug/m3');
        
   }
    if (sensorData.sDataMsg.frameControl & Smsgs_dataFields.aqiCalculation) {
    /*update AQI Calculation value*/
        this.aqiCalculation = {
            O3_avg: sensorData.sDataMsg.aqiCalculation.O3_avg,
            CO_avg: sensorData.sDataMsg.aqiCalculation.CO_avg,
            SO2_avg: sensorData.sDataMsg.aqiCalculation.SO2_avg,
            NO2_avg: sensorData.sDataMsg.aqiCalculation.NO2_avg,
        };
        updateSensor(this.so, 'value', 0, sensorData.sDataMsg.aqiCalculation.O3_avg, '');
        updateSensor(this.so, 'value', 0, sensorData.sDataMsg.aqiCalculation.CO_avg, '');
        updateSensor(this.so, 'value', 0, sensorData.sDataMsg.aqiCalculation.SO2_avg, '');
        updateSensor(this.so, 'value', 0, sensorData.sDataMsg.aqiCalculation.NO2_avg, '');
    }

    /* update rssi information */
    this.rssi = sensorData.rssi;

    /* time stanpd of last data recieved*/
    this.lastreported = getDateTime();
}

Device.prototype.rxConfigRspInd = function (devConfigData) {
    var device = this;
    if (devConfigData.sConfigMsg.status == 0) {
        device.active = 'true';
		/* Check the support sensor Types and add
		information elements for those */
        if (devConfigData.sConfigMsg.frameControl & Smsgs_dataFields.tempSensor) {
            /* initialize sensor information element */
            device.temperaturesensor = {
                ambienceTemp: 0,
                objectTemp: 0
            };
        }
        if (devConfigData.sConfigMsg.frameControl & Smsgs_dataFields.lightSensor) {
            /* initialize sensor information element */
            device.lightsensor = {
                O3_envm: 0,
                CO_envm: 0,
                SO2_envm: 0,
                NO2_envm: 0,
		        pm10_en: 0,
		        pm25_en: 0
            };
        }
       if (devConfigData.sConfigMsg.frameControl & Smsgs_dataFields.dustSensor) {
            /* initialize sensor information element */
            device.dustsensor = {
                pm10_env: 0,
                pm25_env: 0
            };
       }
        if (devConfigData.sConfigMsg.frameControl & Smsgs_dataFields.aqiCalculation) {
            /*intialize AQI data*/
            device.aqiCalculation = {
                O3_avg: 0,
                CO_avg: 0,
                SO2_avg: 0,
                NO2_avg: 0
            };
        }
        device.reportingInterval = devConfigData.sConfigMsg.reportingInterval;
        if (device.capabilityInfo.rxOnWhenIdle == 1) {
            device.pollingInterval = devConfigData.sConfigMsg.pollingInterval;
        }
        else {
            device.pollingInterval = "always on device";
        }
    }
}

Device.prototype.deviceNotActive = function (inactiveDevInfo) {
    this.active = 'false';
}

Device.prototype.devUpdateInfo = function (shortAddr, capInfo) {
    this.shortAddress = shortAddr;
    this.capabilityInfo = capInfo;
    this.active = 'true';
}

function getDateTime() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return hour + ":" + min + ":" + sec + " " + year + "-" + month + "-" + day ;

}


module.exports = Device;

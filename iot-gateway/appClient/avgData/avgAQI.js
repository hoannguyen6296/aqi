/********************************************************************
 * Variables
 * *****************************************************************/
var fs = require("fs");
var SmartObject = require('smartobject');
var Long = require("long");

/********************************************************************
 * Defines
 * *****************************************************************/
var Smsgs_dataFields = Object.freeze({
    tempSensor: 0x0001,
    lightSensor: 0x0002,
    msgStats: 0x0008,
    configSettings: 0x0010,
    dustSensor: 0x0800
});
/*!
 * @brief      Constructor for device objects
 *
 * @param      O3 AQI value - array avarage value of O3 in 1-hour
 * 			   CO AQI value - array avarage value of CO in 1-hour
 * 			   SO2 AQI value - array avarage value of SO2 in 1-hour
 * 			   NO2 AQI value - array avarage value of NO2 in 1-hour
 *
 * @retun      device object
 */
function Device(o3Value, coValue, so2Value, no2Value) {
    var devInfo = this;
    devInfo.o3Value = o3Value;
    devInfo.coValue = coValue;
    devInfo.so2Value = so2Value;
    devInfo.no2Value = no2Value;
    devInfo.active = 'true';
    devInfo.so = new SmartObject();
    return devInfo;
}

Device.prototype.rxSensorData = function (sensorData) {
    /* recieved message from the device, set as active */
    this.active = 'true';
	/* Check the support sensor Types and
add information elements for those */
    if (sensorData.sDataMsg.frameControl & Smsgs_dataFields.lightSensor) {
        /* update the sensor values */
        this.lightsensor = {
            O3_avg: sensorData.sDataMsg.lightSensor.O3_avg,
            CO_avg: sensorData.sDataMsg.lightSensor.CO_avg,
            SO2_avg: sensorData.sDataMsg.lightSensor.SO2_avg,
            NO2_avg: sensorData.sDataMsg.lightSensor.NO2_avg,
            pm25_avg: sensorData.sDataMsg.lightSensor.pm10_avg,
        };
        updateSensor(this.so, 'gas', 0, sensorData.sDataMsg.lightSensor.O3_avg);
        updateSensor(this.so, 'gas', 1, sensorData.sDataMsg.lightSensor.CO_avg);
        updateSensor(this.so, 'gas', 2, sensorData.sDataMsg.lightSensor.SO2_avg);
        updateSensor(this.so, 'gas', 3, sensorData.sDataMsg.lightSensor.NO2_avg);
        updateSensor(this.so, 'gas', 4, sensorData.sDataMsg.lightSensor.pm25_avg);
    }

}
Device.prototype.rxConfigRspInd = function (devConfigData) {
    var device = this;
    if (devConfigData.sConfigMsg.status == 0) {
        device.active = 'true';
		/* Check the support sensor Types and add
information elements for those */
        if (devConfigData.sConfigMsg.frameControl & Smsgs_dataFields.lightSensor) {
            /* initialize sensor information element */
            device.lightsensor = {
                O3_avg: 0,
                CO_avg: 0,
                SO2_avg: 0,
                NO2_avg: 0,
                pm25_avg: 0
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

Device.prototype.devUpdateInfo = function (o3Vlue, coVlue, so2Vlue, no2Vlue) {
    this.o3Value = o3Vlue;
    this.coValue = coVlue;
    this.so2Value = so2Vlue;
    this.no2Value = no2Vlue;
    this.active = 'true';
}

function getDateTime() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return hour + ":" + min + ":" + sec + " " + year + "-" + month + "-" + day;

}

module.exports = avgAQI;
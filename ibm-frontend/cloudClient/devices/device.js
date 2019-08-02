/******************************************************************************

 @file device.js

 @brief device specific functions

 Group: WCS LPC
 $Target Device: DEVICES $

 ******************************************************************************
 $License: BSD3 2016 $
 ******************************************************************************
 $Release Name: PACKAGE NAME $
 $Release Date: PACKAGE RELEASE DATE $
 *****************************************************************************/

/********************************************************************
 * Variables
 * *****************************************************************/


/*!
  Frame Control field states what data fields are included in reported
  sensor data, each value is a bit mask value so that they can be combined
  (OR'd together) in a control field.
  When sent over-the-air in a message this field is 2 bytes.
*/

/*!
 * @brief      Constructor for device objects
 *
 * @param      shortAddress - 16 bit address of the device
 * 			   extAddress - 64 bit IEEE address of the device
 * 			   capabilityInfo - device capability information
 *
 * @retun      device object
 */
function Device(shortAddress, extAddress) {
    var devInfo = this;
    devInfo.shortAddress = shortAddress;
    devInfo.extAddress = extAddress;
    devInfo.active = 'true';
    return devInfo;
}

/* Prototype Functions */
Device.prototype.rxSensorData = function (sensorData) {
    /* recieved message from the device, set as active */
    this.active = sensorData.active;
	/* Check the support sensor Types and
	add information elements for those */
    var i;
    var j = 0;

    if (sensorData.smart_objects.hasOwnProperty('temperature')) {
        for (;;) {
            /* update the sensor values */
            if(sensorData.smart_objects.temperature.hasOwnProperty(j)){
                this.temperaturesensor = {
                    ambienceTemp: sensorData.smart_objects.temperature[j].sensorValue,
                    objectTemp: sensorData.smart_objects.temperature[j].sensorValue
                };
            }
            else{
                break;
            }
            j++;
        }
    }

    j = 0;

    if (sensorData.smart_objects.hasOwnProperty("illuminance")) {
        for (;;) {
            if(sensorData.smart_objects.illuminance.hasOwnProperty(j)){
                /* update the sensor values */
                this.lightsensor = {
                    rawData: sensorData.smart_objects.illuminance[j].sensorValue
                };
            }
            else{
                break;
            }
            j++;
        }
    }

    j = 0;

    if (sensorData.smart_objects.hasOwnProperty("humidity")) {
        for (;;) {
            if(sensorData.smart_objects.humidity.hasOwnProperty(j)){
                /* update the sensor values */
                this.humiditysensor = {
                    humidity: sensorData.smart_objects.humidity[j].sensorValue
                };
            }
            else{
                break;
            }
            j++;
        }
    }

    j = 0;

    if (sensorData.smart_objects.hasOwnProperty("fan")) {
        for (;;) {
            if(sensorData.smart_objects.fan.hasOwnProperty(j)){
                /* update the sensor values */
                this.fan = {
                    value: sensorData.smart_objects.fan[j].sensorValue
                };
            }
            else{
                break;
            }
            j++;
        }
    }

    j = 0;

    if (sensorData.smart_objects.hasOwnProperty("doorlock")) {
        for (;;) {
            if(sensorData.smart_objects.doorlock.hasOwnProperty(j)){
                /* update the sensor values */
                this.doorlock = {
                    value: sensorData.smart_objects.doorlock[j].sensorValue
                };
            }
            else{
                break;
            }
            j++;
        }
    }

    if(sensorData.smart_objects.hasOwnProperty("barometer")){
        this.pressuresensor = {
            pressure: sensorData.smart_objects.barometer[0].sensorValue
        };
    }

    if(sensorData.smart_objects.hasOwnProperty("motion")){
        this.motionsensor = {
            isMotion: sensorData.smart_objects.motion[0].dInState
        };
    }

    if(sensorData.smart_objects.hasOwnProperty("voltage")){
        this.batterysensor = {
            voltage: sensorData.smart_objects.voltage[0].sensorValue
        };
    }

    if(sensorData.smart_objects.hasOwnProperty("halleffect")){
        this.halleffectsensor = {
            isOpen: sensorData.smart_objects.halleffect[0].dInState
        };
    }


    /* update rssi information */
    this.rssi = sensorData.rssi;

    /* time stanpd of last data recieved*/
    this.lastreported = sensorData.last_reported;
}



Device.prototype.deviceNotActive = function (inactiveDevInfo) {
    this.active = 'false';
}

Device.prototype.devUpdateInfo = function (shortAddr) {
    this.shortAddress = shortAddr;
    this.active = 'true';
}

module.exports = Device;

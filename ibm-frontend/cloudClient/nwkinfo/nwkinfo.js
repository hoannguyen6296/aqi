/******************************************************************************

 @file nwkinfo.js

 @brief network information specific functions

 Group: WCS LPC
 $Target Device: DEVICES $

 ******************************************************************************
 $License: BSD3 2016 $
 ******************************************************************************
 $Release Name: PACKAGE NAME $
 $Release Date: PACKAGE RELEASE DATE $
 *****************************************************************************/

var util = require('util');

const BEACON_ENABLED = 1;
const NON_BEACON = 2;
const FREQUENCY_HOPPING = 3;

/*!
 Coordinator State Values
 */
/*! Powered up, not started and waiting for user to start */
const Cllc_states_initWaiting = 1;
/*! Starting coordinator, scanning and selecting the best parameters */
const Cllc_states_startingCoordinator = 2;
/*!
Powered up, found network information, and restoring device in network
*/
const Cllc_states_initRestoringCoordinator = 3;
/*! Device is operating as coordinator */
const Cllc_states_started = 4;
/*! Device is restored as coordinator in the network */
const Cllc_states_restored = 5;
/*! Joining allowed state has changed to allowed */
const Cllc_states_joiningAllowed = 6;
/*! Joining allowed state has changed to not allowed */
const Cllc_states_joiningNotAllowed = 7;

/*!
 * @brief      Constructor for network Information object
 *
 * @param      networkInfo - object with network information
 *
 * @retun      network information object
 */
function NwkInfo(networkInfo) {
    var nwkInfo = this;
    return createNwkInfoObj(networkInfo);
    function createNwkInfoObj(networkInfo) {

        /* set network channel information */
        nwkInfo.channel = networkInfo.channels;
        /* set the PAN Coordinator device informatoin */
        nwkInfo.panCoord = {
            panId: networkInfo.pan_id,
            shortAddress: networkInfo.short_addr,
            extAddress: networkInfo.ext_addr
        };
        /* set the security information */
        nwkInfo.securityEnabled = networkInfo.security_enabled;
        /* set network mode */
        if (networkInfo.mode.toLowerCase() === "beacon") {
            nwkInfo.networkMode = "Beacon Enabled"
        }
        else if (networkInfo.mode.toLowerCase() === "non beacon") {
            nwkInfo.networkMode = "Non Beacon";
        }
        else if (networkInfo.mode.toLowerCase() === "frequency hopping") {
            nwkInfo.networkMode = "Freq Hopping";
        }
        else {
            nwkInfo.networkMode = "Unknown Mode"
        }
        /* set network state */

        if(networkInfo.state === "waiting" || networkInfo.state === "starting" || networkInfo.state === "restoring" || networkInfo.state === "started" || networkInfo.state === "open" || networkInfo.state === "close")
        {
            nwkInfo.state = networkInfo.state;
        }
        else{
            /* Should not get here */
            console.log("ERROR: rcvd illegal coord state(NwkInfo)");
            nwkInfo.state = "unknown";
        }

        return nwkInfo;
    }
}

/* update network information */
NwkInfo.prototype.updateNwkInfo = function (networkInfo) {
    var self = this;
    self.channel = networkInfo.channels;
    /* set the PAN Coordinator device informatoin */
    self.panCoord = {
            panId: networkInfo.pan_id,
            shortAddress: networkInfo.short_addr,
            extAddress: networkInfo.ext_addr
    };
    self.securityEnabled = networkInfo.security_enabled;
    /* set network mode */
    if (networkInfo.mode.toLowerCase() === "beacon") {
        self.networkMode = "Beacon Enabled"
    }
    else if (networkInfo.mode.toLowerCase() === "non beacon") {
        self.networkMode = "Non Beacon";
    }
    else if (networkInfo.mode.toLowerCase() === "frequency hopping") {
        self.networkMode = "Freq Hopping";
    }
    else {
        self.networkMode = "Unknown Mode"
    }
    /* set network state */
        if(networkInfo.state === "waiting" || networkInfo.state === "starting" || networkInfo.state === "restoring" || networkInfo.state === "started" || networkInfo.state === "open" || networkInfo.state === "close")
        {
            self.state = networkInfo.state;
        }
        else{
            /* Should not get here */
            console.log("ERROR: rcvd illegal coord state(NwkInfo)");
            self.state = "unknown";
        }
}

/* update network state */
NwkInfo.prototype.updateNwkState = function (nState) {
    var self = this;
    /* set network state */
    switch (nState.state) {
        case Cllc_states_initWaiting:
            /* Application is waiting for user input
            to start the application */
            self.state = "waiting";
            break;
        case Cllc_states_startingCoordinator:
            /* Application is working to start the network */
            self.state = "starting";
            break;
        case Cllc_states_initRestoringCoordinator:
            /* Application is working to restore the network
            from previously stored informatoin */
            self.state = "restoring";
            break;
        case Cllc_states_started:
        case Cllc_states_restored:
            /* Network is started */
            self.state = "started";
            break;
        case Cllc_states_joiningAllowed:
            /* Network is open for new devices to join */
            self.state = "open";
            break;
        case Cllc_states_joiningNotAllowed:
            /* Network is closed for new devices to join */
            self.state = "close";
            break;
        default:
            /* Should not get here */
            console.log("ERROR: rcvd illegal coord state(nState)");
            self.state = "unknown";
            break;
    }
}

module.exports = NwkInfo;

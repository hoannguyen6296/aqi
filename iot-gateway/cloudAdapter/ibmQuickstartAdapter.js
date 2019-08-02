var events = require("events");
var ibmIot = require('ibmiotf');

var ibmQuickstartAdapterInstance;
var started = false;

function IbmQuickstartAdapter(idNum) {
  if (typeof ibmQuickstartAdapterInstance !== "undefined") {
    return ibmQuickstartAdapterInstance;
  }

  /* Set up to emit events */
  events.EventEmitter.call(this);
  ibmQuickstartAdapterInstance = this;

  function formatNwkMsg(nwkInfo){
    return {d:{
      name:"Sensor-To-Cloud Linux Gateway",
      channels : nwkInfo.channels,
      pan_id: nwkInfo.pan_id,
      short_addr: nwkInfo.short_addr,
      ext_addr: nwkInfo.ext_addr,
      security_enabled: (nwkInfo.security_enabled ? "true" : "false"),
      mode: nwkInfo.mode,
      state: nwkInfo.state,
      devices: nwkInfo.devices.length
    }};
  }

  IbmQuickstartAdapter.prototype.cloudAdapter_sendNetworkInfoMsg = function (nwkInfo) {
    if (ibmQuickstartAdapterInstance.connected != true) {
      if (!started)
        // The first network update gives us the ext. address. Use this to start quickstart.
        connectToQuickstart(nwkInfo);
      return;
    }
    var payload = formatNwkMsg(nwkInfo);
    console.log(payload);
    deviceClient.publish('nwkUpdate','json',payload);
  }

  IbmQuickstartAdapter.prototype.cloudAdapter_sendDeviceInfoMsg = function (devInfo, nwkExtAddr) {
    if (ibmQuickstartAdapterInstance.connected != true) {
      return;
    }
    var payload = {d:devInfo};
    console.log(payload);
    deviceClient.publish('deviceUpdate','json',payload);
  }

  function connectToQuickstart(nwkInfo){
    var id = "sensor-to-cloud" + nwkInfo.ext_addr;
    console.log("ID: "+id);
    var ibmConfig = {
      "org": "quickstart",
      "type": "gateway",
      "id": id,
      "domain": "internetofthings.ibmcloud.com"
    }
    deviceClient = new ibmIot.IotfDevice(ibmConfig);
    deviceClient.log.setLevel('debug');
    deviceClient.connect();
    started = true;
    deviceClient.on('connect', function(){
      ibmQuickstartAdapterInstance.connected = true;
      console.log("Connected to IBM Watson Quickstart!");

      // Wait for 5s and send original nwkInfo.
      setTimeout(function(){deviceClient.publish('nwkUpdate','json',formatNwkMsg(nwkInfo));},5000);
      ibmQuickstartAdapterInstance.emit('updateNetworkState',{action: "open"});
    });
    deviceClient.on('reconnect', function(){
      console.log("Reconnected to IBM Quickstart!");
    });
    deviceClient.on('error', function(error){
      console.log("IBM Cloud Adapter error: "+error);
    });
  }

}

IbmQuickstartAdapter.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = IbmQuickstartAdapter;
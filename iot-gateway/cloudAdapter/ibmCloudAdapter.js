var events = require("events");
var ibmIot = require('ibmiotf');

var ibmCloudAdapterInstance;

function IbmCloudAdapter() {
  if (typeof ibmCloudAdapterInstance !== "undefined") {
    return ibmCloudAdapterInstance;
  }

  /* Set up to emit events */
  events.EventEmitter.call(this);
  ibmCloudAdapterInstance = this;

  var ibmConfig = require('./ibmConfig.json');
  var gatewayClient = new ibmIot.IotfGateway(ibmConfig);
  gatewayClient.log.setLevel('debug');
  gatewayClient.connect();
  gatewayClient.on('connect', function(){
    ibmCloudAdapterInstance.connected = true;
    console.log("Connected to IBM Watson!");
    gatewayClient.subscribeToGatewayCommand("nwkUpdate","json");
    gatewayClient.subscribeToGatewayCommand("deviceUpdate","json");
  });
  gatewayClient.on('reconnect', function(){
    console.log("Reconnected to IBM!");
  });
  gatewayClient.on('command', function(type, id, commandName, commandFormat, payload, topic){
    console.log("Command received");
    console.log("Type: %s  ID: %s  \nCommand Name : %s Format: %s",type, id, commandName, commandFormat);
    console.log("Payload : %s",payload);
    if (commandName === "nwkUpdate"){
      console.log("NETWORK UPDATE!");
      var action = JSON.parse(payload);
      ibmCloudAdapterInstance.emit('updateNetworkState',action);
      /*if (action.action == 1){
        ibmCloudAdapterInstance.emit('updateNetworkState',{action: "open"});
      } else {
        ibmCloudAdapterInstance.emit('updateNetworkState',{action: "close"});
      }*/
    }
    if (commandName === "deviceUpdate"){
      var action = JSON.parse(payload);
      ibmCloudAdapterInstance.emit('deviceActuation', action);
      console.log("DEVICE UPDATE!");
    }
  });
  gatewayClient.on('error', function(error){
    console.log("IBM Cloud Adapter error: "+error);
  });

  IbmCloudAdapter.prototype.cloudAdapter_sendNetworkInfoMsg = function (nwkInfo) {
    if (ibmCloudAdapterInstance.connected != true) {
      return;
    }

    gatewayClient.publishGatewayEvent('nwkUpdate','json',nwkInfo);
  }

  IbmCloudAdapter.prototype.cloudAdapter_sendDeviceInfoMsg = function (devInfo, nwkExtAddr) {
    if (ibmCloudAdapterInstance.connected != true) {
      return;
    }

    gatewayClient.publishGatewayEvent('deviceUpdate','json',devInfo);
  }
}

IbmCloudAdapter.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = IbmCloudAdapter;
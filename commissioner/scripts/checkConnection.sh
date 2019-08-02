#!/bin/bash

SSID=$(iw dev wlan0 link | grep SSID)

if [ "x${SSID}x" == "xx" ] ; then
  SSID=$(ethtool eth0 | grep "Link detected: yes")
  if [ "x${SSID}x" == "xx" ] ; then
    echo "Not connected to a network."
    exit 1
  else
    echo "SSID: Ethernet"
    exit 0
  fi
else
  echo ${SSID}
  exit 0
fi

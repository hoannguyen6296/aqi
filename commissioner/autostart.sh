#!/bin/sh

echo -n "autostart.sh started at: " > autostart.log
date >> autostart.log

THIS_DIR=$PWD

# Restore iptables
if [ -f iptables.rules ]
then
  iptables-restore < iptables.rules
fi

cd /usr/share/wl18xx
sh ./load_wlcore.sh >> autostart.log
sh ./ap_start.sh >> autostart.log
sh ./sta_start.sh >> autostart.log

sleep 5

SSID=$(iw dev wlan0 link | grep SSID)

if [ "x${SSID}x" != "xx" ] ; then
  udhcpc -i wlan0
fi

cd $THIS_DIR
node commissioner.js > commissioner.log&


# Oded
# read -n1 -r -p "Press any key to continue..." key

# exit status of 0 required for autostart.service to start properly
exit 0
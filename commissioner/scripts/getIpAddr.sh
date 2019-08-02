#!/bin/bash

if [ "${1}" == "Ethernet" ] ; then
    ifconfig eth0 | grep "inet " | awk -F'[: ]+' '{ print $4 }'
    exit $?
else
    ifconfig wlan0 | grep "inet " | awk -F'[: ]+' '{ print $4 }'
    exit $?
fi

# IP=$(timeout -t 1 udhcpc -i wlan0 | grep "Lease of" | grep -oE "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b")
# if [ "x${IP}x" == "xx" ] ; then
#     IP=$(timeout -t 1 udhcpc -i eth0 | grep "Lease of" | grep -oE "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b")
# fi
# echo "${IP}"
# exit $?
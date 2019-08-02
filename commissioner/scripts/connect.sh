ip addr flush dev wlan0

/usr/share/wl18xx/sta_connect-ex.sh "${1}" WPA-PSK "${2}" > connect.log
#if [ $? != 0 ]; then
#	exit $?
#fi

if [ "$3" == "true" ]; then
  wpa_cli -i wlan0 save_config > /dev/null
fi

udhcpc -i wlan0 | grep "Lease of" | grep -oE "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b"
exit $?
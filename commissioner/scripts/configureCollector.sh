#!/bin/bash

HERE=`pwd`

CFG_DIR=${HERE}/../prebuilt

sed -i -e "/config-channel-mask/ s/=.*/= ${1}/" ${CFG_DIR}/collector.cfg
sed -i -e "/config-pan-id/ s/=.*/= ${2}/" ${CFG_DIR}/collector.cfg
sed -i -e "/config-reporting-interval/ s/=.*/= ${3}/" ${CFG_DIR}/collector.cfg
sed -i -e "/config-polling-interval/ s/=.*/= ${4}/" ${CFG_DIR}/collector.cfg
sed -i -e "/config-phy-id/ s/=.*/= ${5}/" ${CFG_DIR}/collector.cfg
sed -i -e "/load-nv-sim/ s/=.*/= ${6}/" ${CFG_DIR}/collector.cfg

if [ -f ${CFG_DIR}/nv-simulation.bin ]
then
    rm ${CFG_DIR}/nv-simulation.bin
fi
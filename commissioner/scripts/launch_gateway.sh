#!/bin/bash
#############################################################
# @file run_demo.sh
#
# @brief TIMAC 2.0 run_demo.sh - run the ces-2016 demo
#
# Group: WCS LPC
# $Target Devices: Linux: AM335x, Embedded Devices: CC1310, CC1350$
#
#############################################################
# $License: BSD3 2016 $
#
#   Copyright (c) 2015, Texas Instruments Incorporated
#   All rights reserved.
#
#   Redistribution and use in source and binary forms, with or without
#   modification, are permitted provided that the following conditions
#   are met:
#
#   *  Redistributions of source code must retain the above copyright
#      notice, this list of conditions and the following disclaimer.
#
#   *  Redistributions in binary form must reproduce the above copyright
#      notice, this list of conditions and the following disclaimer in the
#      documentation and/or other materials provided with the distribution.
#
#   *  Neither the name of Texas Instruments Incorporated nor the names of
#      its contributors may be used to endorse or promote products derived
#      from this software without specific prior written permission.
#
#   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
#   AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
#   THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
#   PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
#   CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
#   EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
#   PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
#   OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
#   WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
#   OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
#   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
#############################################################
# $Release Name: TI-15.4Stack Linux x64 SDK$
# $Release Date: July 14, 2016 (2.00.00.30)$
#############################################################

hostarch=`uname -m`


if [ "x${hostarch}x" == "xarmv7lx" ]
then
    my_arch_name=bbb
fi

if [ "x${hostarch}x" == "xx86_64x" ]
then
    my_arch_name=host
fi

if [ "x${my_arch_name}x" == 'xx' ]
then
    echo "Unknown Host type: ${hostarch}"
    echo "Expected: armv7l {for BBB}"
    echo "Expected: x86_64 {for Linux 64bit host}"
    exit 1
fi

HERE=`pwd`

# Using prebuilt binaries
BIN_DIR=${HERE}/../prebuilt
# Uncomment line below to use binary built from source
#BIN_DIR=${HERE}/../collector

GATEWAY_DIR=${HERE}/../iot-gateway

echo "Launching the Collector Application in the background"
cd ${BIN_DIR}
bash ./run_collector.sh
ERR=$?
if [ $ERR != 0 ]
then
    echo "Something seems wrong with the collector app"
    echo "Make sure the /prebuilt/bin/bbb_collector file is executable:"
    echo "chmod +x /prebuilt/bin/bbb_collector"
    exit ${ERR}
fi
cd ${HERE}



echo "Launching Node-JS gateway application in background"
cd ${GATEWAY_DIR}
bash ./run_gateway.sh $1
ERR=$?
if [ $ERR != 0 ]
then
    echo "Something seems wrong with the gateway app"
    exit ${ERR}
fi
cd ${HERE}

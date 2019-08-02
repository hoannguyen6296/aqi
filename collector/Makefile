#############################################################
# @file Makefile
#
# @brief TIMAC 2.0 Collector Example Application Makefile
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
# $Release Date: Jun 28, 2017 (2.02.00.03)$
#############################################################

_default: _app


COMPONENTS_HOME=../../components
SDK_HOME=../../../

HERE=$(shell pwd)
CFLAGS += -include ${HERE}/timac_features.h
CFLAGS += -DAUTO_START
CFLAGS += -DNV_RESTORE
#CFLAGS += -DFCS_TYPE16
CFLAGS += -DIS_HEADLESS
CFLAGS += -I.
CFLAGS += -I${COMPONENTS_HOME}/common/inc
CFLAGS += -I${COMPONENTS_HOME}/nv/inc
CFLAGS += -I${COMPONENTS_HOME}/api/inc
CFLAGS += -I${SDK_HOME}

#----------------------------------------
# NOTE: to use the Protobuf-C package that is built
# locally to the  "../google/"  directory you must do 4 things:
#
# Step 1: Go build the protobuf packages
#    See the file: ../google/Makefile for details.
#    hint:  cd ../google
#    hint:  make all
#
# Step 2: uncomment this line.
#CFLAGS+= -I$(PROTOC_INSTALL_DIR)/include
#
# STEP 3: Remove the "protobuf-c.c
#
# STEP 4:
#   Link the protobuf-c library
#   To do this, you will need to cross-compile the
#   protobuf-C library and related items to your target.
#

include ../../scripts/front_matter.mak

APP_NAME = collector

C_SOURCES += linux_main.c
C_SOURCES += cllc.c
C_SOURCES += collector.c
C_SOURCES += csf_linux.c
C_SOURCES += appsrv.c
C_SOURCES += util.c
C_SOURCES += oad_protocol.c

APP_LIBS    += libnv.a
APP_LIBS    += libapimac.a
APP_LIBS    += libcommon.a

#APP_LIBDIRS += ${PROTOC_INSTALL_DIR}/lib
APP_LIBDIRS += ${COMPONENTS_HOME}/cllc/${OBJDIR}
APP_LIBDIRS += ${COMPONENTS_HOME}/nv/${OBJDIR}
APP_LIBDIRS += ${COMPONENTS_HOME}/api/${OBJDIR}
APP_LIBDIRS += ${COMPONENTS_HOME}/common/${OBJDIR}
APP_LIBDIRS += ${OBJDIR}

# This runs the protobuf-c compiler to convert
# the protocol definition file (.proto)
# into a C and H file ...
#
# To rebuild these, you will need to install
# the "protobuf-c" compiler.
#
# NOTE:
#    Please do not do this: "apt-get install protobuf-c"
# WHY?
#    The assumption is you will debug/develop/primary-test
#    your application on a desktop linux (x86) linux machine.
#    Why? Because it is simple to do that.
#
# This means:
#    You will need the protobuf compiler for X86.
#    And that means you must also use the protobuf compiler for ARM
#
# The problem:
#    The two versions (X86 vrs ARM) are different version numbers.
#    And may always be out of sync with each other, to solve this problem..
#
# The solution:
#    See the directory: ../google/Makefile
#    That makefile will fetch/clone, build and locally-install the
#    protobuf solution used here at TI during development.
#
# https://developers.google.com/protocol-buffers/
#


include ../../scripts/app.mak

#  ========================================
#  Texas Instruments Micro Controller Style
#  ========================================
#  Local Variables:
#  mode: makefile-gmake
#  End:
#  vim:set  filetype=make

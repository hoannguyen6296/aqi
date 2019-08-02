/******************************************************************************
 @file csf_linux.h

 @brief TIMAC 2.0 API Collector specific (linux) function definitions

 Group: WCS LPC
 $Target Devices: Linux: AM335x, Embedded Devices: CC1310, CC1350$

 ******************************************************************************
 $License: BSD3 2016 $
  
   Copyright (c) 2015, Texas Instruments Incorporated
   All rights reserved.
  
   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions
   are met:
  
   *  Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
  
   *  Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
  
   *  Neither the name of Texas Instruments Incorporated nor the names of
      its contributors may be used to endorse or promote products derived
      from this software without specific prior written permission.
  
   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
   THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
   PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
   CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
   EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
   PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
   OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
   WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
   OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
   EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 ******************************************************************************
 $Release Name: TI-15.4Stack Linux x64 SDK$
 $Release Date: Jun 28, 2017 (2.02.00.03)$
 *****************************************************************************/

#if !defined(CSF_LINUX_H)
#define CSF_LINUX_H

typedef uint8_t UArg;

/*!
 * Network parameters for a non-frequency hopping coordinator.
 */

/*! Network Information */
typedef struct
{
    /*! Device Information */
    ApiMac_deviceDescriptor_t deviceInfo;
    /*! Channel */
    uint8_t channel;
} Llc_networkInfo_t;

/*!
 * Frequency Hopping Interface Settings
 */
typedef struct _Llc_fhintervalsettings_t
{
    /*! Channel dwell time (in milliseconds) */
    uint16_t dwell;
    /*! Channel interval time (in milliseconds) */
    uint16_t interval;
} Llc_fhIntervalSettings_t;

/*!
 * Device frequency hopping information
 */
typedef struct _Llc_deviceinfofh_t
{
/*! Broadcast Interval settings */
    Llc_fhIntervalSettings_t bcIntervals;
    /*! Broadcast number of channels used */
    uint8_t bcNumChans;
    /*!
    Broadcast channels used.  Pointer to an array of bytes, Each byte
    is a channel number and the order is the sequence to hop.
    */
    uint8_t *pBcChans;
    /*! Unicast Rx Interval settings */
    Llc_fhIntervalSettings_t unicastIntervals;
    /*! Unicast Rx number of channels used */
    uint8_t unicastNumChans;
    /*!
     * Unicast channels used.  Pointer to an array of bytes, Each byte
     *  is a channel number and the order is the sequence to hop.
     */
    uint8_t *pUnicastChans;
} Llc_deviceInfoFh_t;

/*!
 * Network parameters for a frequency hopping coordinator.
 */
typedef struct _Llc_networkinfofh_t
{
    /*! Device Information */
    /* Address information */
    ApiMac_deviceDescriptor_t devInfo;
    /*! Device Frequency Hopping Information */
    Llc_deviceInfoFh_t fhInfo;
} Llc_networkInfoFh_t;

/*! Stored network information */
typedef struct
{
    /*! true if network is frequency hopping */
    bool fh;

    /*! union to hold network information */
    union
    {
        Llc_netInfo_t netInfo;
        Llc_networkInfoFh_t fhNetInfo;
    } info;
} Csf_networkInformation_t;

/*! for use by web interface */
typedef struct
{
    /*! Address information */
    ApiMac_deviceDescriptor_t devInfo;
    /*! Device capability */
    ApiMac_capabilityInfo_t  capInfo;
} Csf_deviceInformation_t;

/*
 * @brief Get the device list
 *
 * Note: Memory must be released via Csf_freeDeviceList()
 */
int Csf_getDeviceInformationList(Csf_deviceInformation_t **ppDeviceInfo);

/*
 * @brief Release memory from the getDeviceList call
 */
void Csf_freeDeviceInformationList(size_t n, Csf_deviceInformation_t *p);

/*
 * @brief given a state, return the ascii text name of this state (for dbg)
 * @param s - the state.
 */
const char *CSF_cllc_statename(Cllc_states_t s);

/*
 * @brief return the last known state of the CLLC.
 */
Cllc_states_t Csf_getCllcState(void);

/*!
 * @brief Send the configuration message to a collector module to be
 *        sent OTA.
 *
 * @param pDstAddr - destination address of the device to send the message
 * @param frameControl - configure what to the device is to report back.
 *                       Ref. Smsgs_dataFields_t.
 * @param reportingInterval - in millseconds- how often to report, 0
 *                            means to turn off automated reporting, but will
 *                            force the sensor device to send the Sensor Data
 *                            message once.
 * @param pollingInterval - in millseconds- how often to the device is to
 *                          poll its parent for data (for sleeping devices
 *                          only.
 *
 * @return status(uint8_t) - Success (0), Failure (1)
 */
extern uint8_t Csf_sendConfigRequest( ApiMac_sAddr_t *pDstAddr,
                uint16_t frameControl,
                uint32_t reportingInterval,
                uint32_t pollingInterval);
/*!
 * @brief Build and send the toggle led message to a device.
 *
 * @param pDstAddr - destination address of the device to send the message
 *
 * @return Collector_status_success, Collector_status_invalid_state
 *         or Collector_status_deviceNotFound
 */
extern uint8_t Csf_sendToggleLedRequest(
                ApiMac_sAddr_t *pDstAddr);

/*!
 * @brief Build and send the generic message to a device.
 *
 * @param pDstAddr - destination address of the device to send the message
 *
 * @return Collector_status_success, Collector_status_invalid_state
 *         or Collector_status_deviceNotFound
 */
extern uint8_t Csf_sendGenericRequest(
    ApiMac_sAddr_t *pDstAddr);

#endif

/*
 *  ========================================
 *  Texas Instruments Micro Controller Style
 *  ========================================
 *  Local Variables:
 *  mode: c
 *  c-file-style: "bsd"
 *  tab-width: 4
 *  c-basic-offset: 4
 *  indent-tabs-mode: nil
 *  End:
 *  vim:set  filetype=c tabstop=4 shiftwidth=4 expandtab=true
 */


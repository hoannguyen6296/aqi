/******************************************************************************
 @file appsrv.h

 @brief TIMAC 2.0 API Application Server API

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
 #ifndef APPINTERFACE_H
 #define APPINTERFACE_H

#ifdef __cplusplus
extern "C"
{
#endif
/******************************************************************************
 Includes
 *****************************************************************************/
#include <stdbool.h>

#include "csf.h"
#include "csf_linux.h"
#include "mt_msg.h"
#include "log.h"

#define LOG_APPSRV_CONNECTIONS  _bitN(LOG_DBG_APP_bitnum_first+0)
#define LOG_APPSRV_BROADCAST    _bitN(LOG_DBG_APP_bitnum_first+1)
#define LOG_APPSRV_MSG_CONTENT  _bitN(LOG_DBG_APP_bitnum_first+2)

/******************************************************************************
 Typedefs
 *****************************************************************************/

extern struct mt_msg_interface appClient_mt_interface_template;
extern struct socket_cfg       appClient_socket_cfg;

/*
 * The API_MAC_msg_interface will point to either
 * the *npi* or the *uart* interface.
 */
extern struct mt_msg_interface npi_mt_interface;
extern struct socket_cfg       npi_socket_cfg;

extern struct mt_msg_interface uart_mt_interface;
extern struct uart_cfg         uart_cfg;

/******************************************************************************
 Function Prototypes
 *****************************************************************************/

/*
 * Sets defaults for the application.
 */
void APP_defaults(void);

/*
 * Main application function.
 */
void APP_main(void);

/*!
 * @brief  Csf module calls this function to initialize the application server
 *         interface
 *
 *
 * @param
 *
 * @return
 */
 void appsrv_Init(void *param);

/*!
 * @brief        Csf module calls this function to inform the applicaiton client
 *                     that the application has either started/restored the network
 *
 * @param
 *
 * @return
 */
 void appsrv_networkUpdate(bool restored, Llc_netInfo_t *networkInfo);

/*!
 * @brief        Csf module calls this function to inform the applicaiton clientr
 *                     that a device has joined the network
 *
 * @param
 *
 * @return
 */
 void appsrv_deviceUpdate(Llc_deviceListItem_t *pDevInfo);

 /*!
 * @brief        Csf module calls this function to inform the applicaiton client
 *                     that the device has responded to the configuration request
 *
 * @param
 *
 * @return
 */
 void appsrv_deviceConfigUpdate(ApiMac_sAddr_t *pSrcAddr, int8_t rssi,
                                   Smsgs_configRspMsg_t *pMsg);

 /*!
 * @brief        Csf module calls this function to inform the applicaiton client
 *                     that a device is no longer active in the network
 *
 * @param
 *
 * @return
 */
 void appsrv_deviceNotActiveUpdate(ApiMac_deviceDescriptor_t *pDevInfo,
                                      bool timeout);
  /*!
 * @brief        Csf module calls this function to inform the applicaiton client
                         of the reported sensor data from a network device
 *
 * @param
 *
 * @return
 */
 void appsrv_deviceSensorDataUpdate(ApiMac_sAddr_t *pSrcAddr, int8_t rssi,
                                       Smsgs_sensorMsg_t *pMsg);

/*!
 * @brief        TBD
 *
 * @param
 *
 * @return
 */
 void appsrv_stateChangeUpdate(Cllc_states_t state);

/*!
 * @brief Broadcast a message to all connections
 * @param pMsg - msg to broadcast
 */
extern void appsrv_broadcast(struct mt_msg *pMsg);

/*!
 * @brief Send remove device response to gateway
 */
extern void appsrv_send_removeDeviceRsp(void);

#ifdef __cplusplus
}
#endif

#endif /* APPINTERFACE_H */

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


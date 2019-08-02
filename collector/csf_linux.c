/******************************************************************************

 @file csf_linux.c [Linux version of csf.c]

 @brief Collector Specific Functions

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

#if (defined(_MSC_VER) || defined(__linux__))
#define IS_HLOS 1  /* compiler=non-embedded */
#else
#define IS_HLOS 0  /* compiler=embedded */
#endif
/******************************************************************************
 Includes
 *****************************************************************************/

#if IS_HLOS
#include <stdio.h>
#include <stdarg.h>
#include <string.h>
#include <stdlib.h>
#include <stdint.h>
/* #include <unistd.h> */
#include "nvintf.h"
#include "nv_linux.h"

#include "log.h"
#include "mutex.h"
#include "ti_semaphore.h"
#include "timer.h"

#include "appsrv.h"

#include "util.h"

#include "common/util/board_lcd.h"

#else /* (HLOS) */
#include <xdc/std.h>
#include <xdc/runtime/Error.h>
#include <xdc/runtime/System.h>
#include <ti/sysbios/BIOS.h>
#include <ti/sysbios/knl/Clock.h>
#include <ti/sysbios/family/arm/m3/Hwi.h>
#include <ti/sysbios/knl/Semaphore.h>
#include <ti/drivers/Power.h>
#include <ti/drivers/PIN.h>
#include <string.h>
#include <inc/hw_ints.h>
#include <aon_event.h>
#include <ioc.h>

#include "board.h"
#include "timer.h"
#include "util.h"
#include "board_key.h"
#include "board_led.h"

#include "macconfig.h"

#include "nvoctp.h"

#include "icall.h"

#endif /* (HLOS) */
#include "config.h"
#include "api_mac.h"
#if IS_HLOS
#include "api_mac_linux.h"
#endif
#include "collector.h"
#include "cllc.h"
#include "csf.h"

#if defined(MT_CSF)
#include "mt_csf.h"
#endif

#if IS_HLOS
/* additional linux information */
#include "csf_linux.h"
#endif

/******************************************************************************
 Constants and definitions
 *****************************************************************************/

/* Initial timeout value for the tracking clock */
#define TRACKING_INIT_TIMEOUT_VALUE 100

/* NV Item ID - the device's network information */
#define CSF_NV_NETWORK_INFO_ID 0x0001
/* NV Item ID - the number of black list entries */
#define CSF_NV_BLACKLIST_ENTRIES_ID 0x0002
/* NV Item ID - the black list, use sub ID for each record in the list */
#define CSF_NV_BLACKLIST_ID 0x0003
/* NV Item ID - the number of device list entries */
#define CSF_NV_DEVICELIST_ENTRIES_ID 0x0004
/* NV Item ID - the device list, use sub ID for each record in the list */
#define CSF_NV_DEVICELIST_ID 0x0005
/* NV Item ID - this devices frame counter */
#define CSF_NV_FRAMECOUNTER_ID 0x0006
/* NV Item ID - reset reason */
#define CSF_NV_RESET_REASON_ID 0x0007

/* Maximum number of black list entries */
#define CSF_MAX_BLACKLIST_ENTRIES 10

/* Maximum number of device list entries */
#define CSF_MAX_DEVICELIST_ENTRIES 50

/*
 Maximum sub ID for a blacklist item, this is failsafe.  This is
 not the maximum number of items in the list
 */
#define CSF_MAX_BLACKLIST_IDS 100

/*
 Maximum sub ID for a device list item, this is failsafe.  This is
 not the maximum number of items in the list
 */
#define CSF_MAX_DEVICELIST_IDS 100

/* timeout value for trickle timer initialization */
#define TRICKLE_TIMEOUT_VALUE       20

/* timeout value for join timer */
#define JOIN_TIMEOUT_VALUE       20
/* timeout value for config request delay */
#define CONFIG_TIMEOUT_VALUE 1000

/*
 The increment value needed to save a frame counter. Example, setting this
 constant to 100, means that the frame counter will be saved when the new
 frame counter is 100 more than the last saved frame counter.  Also, when
 the get frame counter function reads the value from NV it will add this value
 to the read value.
 */
#define FRAME_COUNTER_SAVE_WINDOW     25

/* Value returned from findDeviceListIndex() when not found */
#define DEVICE_INDEX_NOT_FOUND  -1

/*! NV driver item ID for reset reason */
#define NVID_RESET {NVINTF_SYSID_APP, CSF_NV_RESET_REASON_ID, 0}

#ifdef IS_HLOS

#define board_led_type_LED1 0
#define board_led_type_LED2 0
#define board_led_state_ON  0
#define Board_Led_toggle(led)(void)led;
#define Board_Led_control(led, action) \
(void)led; \
(void)action;

#include <termios.h>

#define KEY_PERMIT_JOIN 'o'
#define KEY_SELECT_DEVICE 's'
#define KEY_FW_VER_REQ 'v'
#define KEY_FW_UPDATE_REQ 'u'
#define KEY_GET_OAD_FILE 'f'
#define KEY_TOGGLE_REQ 't'
#define KEY_LIST_DEVICES 'l'
#define KEY_DISASSOCIATE_DEVICE 'd'

#define DEFUALT_OAD_FILE "../../firmware/oad/sensor_oad_cc13x0lp_app.bin"
#endif //IS_HLOS

/******************************************************************************
 External variables
 *****************************************************************************/
#if IS_HLOS

/* handle for tracking timeout */
static intptr_t trackingClkHandle;
/* handle for PA trickle timeout */
static intptr_t tricklePAClkHandle;
/* handle for PC timeout */
static intptr_t tricklePCClkHandle;
/* handle for join permit timeout */
static intptr_t joinClkHandle;

/* handle for config request delay */
static intptr_t configClkHandle;

extern intptr_t semaphore0;
/* Non-volatile function pointers */
NVINTF_nvFuncts_t nvFps;

#else

#ifdef NV_RESTORE
/*! MAC Configuration Parameters */
extern mac_Config_t Main_user1Cfg;
#endif

#endif /* IS_HLOS */

/******************************************************************************
 Local variables
 *****************************************************************************/
#if IS_HLOS
static intptr_t collectorSem;
#define Semaphore_post(S)  SEMAPHORE_put(S)
#else
/* The application's semaphore */
static ICall_Semaphore collectorSem;

/* Clock/timer resources */
static Clock_Struct trackingClkStruct;
static Clock_Handle trackingClkHandle;

/* Clock/timer resources for CLLC */
/* trickle timer */
STATIC Clock_Struct tricklePAClkStruct;
STATIC Clock_Handle tricklePAClkHandle;
STATIC Clock_Struct tricklePCClkStruct;
STATIC Clock_Handle tricklePCClkHandle;

/* timer for join permit */
STATIC Clock_Struct joinClkStruct;
STATIC Clock_Handle joinClkHandle;

/* timer for config request delay */
STATIC Clock_Struct configClkStruct;
STATIC Clock_Handle configClkHandle;
#endif /* (!IS_HLOS) */

/* NV Function Pointers */
static NVINTF_nvFuncts_t *pNV = NULL;

/* Permit join setting */
static bool permitJoining = false;

static bool started = false;

/* The last saved coordinator frame counter */
static uint32_t lastSavedCoordinatorFrameCounter = 0;

#if defined(MT_CSF)
/*! NV driver item ID for reset reason */
static const NVINTF_itemID_t nvResetId = NVID_RESET;
#endif

#ifndef IS_HEADLESS
enum {
    DisplayLine_product = 0,
    DisplayLine_nwk,
    DisplayLine_sensorStart,
    DisplayLine_sensorEnd = 6,
    DisplayLine_info,
    DisplayLine_cmd,
} DisplayLine;
#else
#endif //IS_HEADLESS

static uint32_t selected_oad_file_id = 0;

/******************************************************************************
 Global variables
 *****************************************************************************/
/* Key press parameters */
uint8_t Csf_keys;

/* pending Csf_events */
uint16_t Csf_events = 0;

/* Saved CLLC state */
Cllc_states_t savedCllcState = Cllc_states_initWaiting;

/******************************************************************************
 Local function prototypes
 *****************************************************************************/
#if IS_HLOS

static void processTackingTimeoutCallback_WRAPPER(intptr_t thandle, intptr_t cookie);
static void processPATrickleTimeoutCallback_WRAPPER(intptr_t thandle, intptr_t cookie);
static void processPCTrickleTimeoutCallback_WRAPPER(intptr_t thandle, intptr_t cookie);
static void processJoinTimeoutCallback_WRAPPER(intptr_t thandle, intptr_t cookie);
static void processConfigTimeoutCallback_WRAPPER(intptr_t thandle, intptr_t cookie);

#ifndef IS_HEADLESS
char* getConsoleCmd(void);
void initConsoleCmd(void);
#endif //!IS_HEADLESS

#endif

static void processTackingTimeoutCallback(UArg a0);
static void processKeyChangeCallback(uint8_t keysPressed);
static void processPATrickleTimeoutCallback(UArg a0);
static void processPCTrickleTimeoutCallback(UArg a0);
static void processJoinTimeoutCallback(UArg a0);
static void processConfigTimeoutCallback(UArg a0);
static bool addDeviceListItem(Llc_deviceListItem_t *pItem);
static void updateDeviceListItem(Llc_deviceListItem_t *pItem);
static int findDeviceListIndex(ApiMac_sAddrExt_t *pAddr);
static int findUnusedDeviceListIndex(void);
static void saveNumDeviceListEntries(uint16_t numEntries);
static int findBlackListIndex(ApiMac_sAddr_t *pAddr);
static int findUnusedBlackListIndex(void);
static uint16_t getNumBlackListEntries(void);
static void saveNumBlackListEntries(uint16_t numEntries);
void removeBlackListItem(ApiMac_sAddr_t *pAddr);
static bool removeDevice(ApiMac_sAddr_t addr);

#if defined(TEST_REMOVE_DEVICE)
static void removeTheFirstDevice(void);
#endif
#if !IS_HLOS
/* not used in hlos version */
static uint16_t getTheFirstDevice(void);
#endif

/******************************************************************************
 Public Functions
 *****************************************************************************/

/*!
 The application calls this function during initialization

 Public function defined in csf.h
 */
void Csf_init(void *sem)
{
    char default_oad_file[256] = DEFUALT_OAD_FILE;

    /* Set defualt FW image */
    selected_oad_file_id = Collector_updateFwList(default_oad_file);

    /* Initialize the LCD */
    Board_LCD_open();

#ifndef IS_HEADLESS
    Board_Lcd_printf(DisplayLine_product, "TI Collector");

#if !defined(AUTO_START)
    Board_Lcd_printf(DisplayLine_nwk, "Nwk: Starting");
#endif /* AUTO_START */

#endif //!IS_HEADLESS

#if IS_HLOS

#ifndef IS_HEADLESS
    initConsoleCmd();
#endif //!HEADLESS

    /* Save off the semaphore */
    collectorSem = (intptr_t)sem;

    /* save the application semaphore here */
    /* load the NV function pointers */
    // printf("   >> Initialize the NV Function pointers \n");
    NVOCTP_loadApiPtrs(&nvFps);

    /* Suyash - the code is using pNV var. Using that for now. */
    /* config nv pointer will be read from the mac_config_t... */
    pNV = &nvFps;

    /* Init NV */
    nvFps.initNV(NULL);

#else
   /* Save off the NV Function Pointers */
#ifdef NV_RESTORE
    /* Save off the NV Function Pointers */
    pNV = &Main_user1Cfg.nvFps;
#endif

    /* Save off the semaphore */
    collectorSem = sem;

    /* Initialize keys */
    if(Board_Key_initialize(processKeyChangeCallback) == KEY_RIGHT)
    {
        /* Right key is pressed on power up, clear all NV */
        Csf_clearAllNVItems();
    }

#ifndef IS_HEADLESS
    /* Initialize the LCD */
    Board_LCD_open();

#if !defined(AUTO_START)
    Board_Lcd_printf(DisplayLine_nwk, "Nwk: Starting");
#endif /* AUTO_START */
#endif //!IS_HEADLESS

    Board_Led_initialize();

#if defined(MT_CSF)
    {
        uint8_t resetReseason = 0;

        if(pNV != NULL)
        {
            if(pNV->readItem != NULL)
            {
                /* Attempt to retrieve reason for the reset */
                (void)pNV->readItem(nvResetId, 0, 1, &resetReseason);
            }

            if(pNV->deleteItem != NULL)
            {
                /* Only use this reason once */
                (void)pNV->deleteItem(nvResetId);
            }
        }

        /* Start up the MT message handler */
        MTCSF_init(resetReseason);

        /* Did we reset because of assert? */
        if(resetReseason > 0)
        {
#if IS_HEADLESS
            Board_Lcd_printf(DisplayLine_nwk, "Nwk: Restarting");
#endif //!IS_HEADLESS

            /* Tell the collector to restart */
            Csf_events |= CSF_KEY_EVENT;
            Csf_keys |= KEY_LEFT;
        }
    }
#endif
#endif /* IS_HLOS */
}

/*!
 The application must call this function periodically to
 process any Csf_events that this module needs to process.

 Public function defined in csf.h
 */
void Csf_processEvents(void)
{

#if (!defined(IS_HEADLESS) && defined(IS_HLOS))

    char *cmdBuff;
    static uint16_t selected_device = 0;

    cmdBuff = getConsoleCmd();

    if(cmdBuff)
    {
        Csf_keys = cmdBuff[0];

        if(Csf_keys == KEY_PERMIT_JOIN)
        {
            uint32_t duration;
            /* Toggle the permit joining */
            if (permitJoining == true)
            {
                permitJoining = false;
                duration = 0;
                Board_Lcd_printf(DisplayLine_info, "Info: PermitJoin-OFF");
            }
            else
            {
                permitJoining = true;
                duration = 0xFFFFFFFF;
                Board_Lcd_printf(DisplayLine_info, "Info: PermitJoin-ON ");
            }

            /* Set permit joining */
            Cllc_setJoinPermit(duration);
        }

        if(Csf_keys == KEY_SELECT_DEVICE)
        {
            if(sscanf(cmdBuff, "s0x%hx", &selected_device) < 1)
            {
                sscanf(cmdBuff, "s%hd", &selected_device);
            }

            Board_Lcd_printf(DisplayLine_info, "Info: Selected device 0x%04x", selected_device);
        }

        if(Csf_keys == KEY_FW_VER_REQ)
        {
            ApiMac_sAddr_t sAddr;

            Board_Lcd_printf(DisplayLine_info, "Info: Sending 0x%04x FW version req", selected_device);

            sAddr.addr.shortAddr = selected_device;
            sAddr.addrMode = ApiMac_addrType_short;
            Collector_sendFwVersionRequest(&sAddr);
        }

        if(Csf_keys == KEY_FW_UPDATE_REQ)
        {
            ApiMac_sAddr_t sAddr;
            Collector_status_t status;

            Board_Lcd_printf(DisplayLine_info, "Info: Sending 0x%04x FW Update Req", selected_device);

            sAddr.addr.shortAddr = selected_device;
            sAddr.addrMode = ApiMac_addrType_short;
            status = Collector_startFwUpdate(&sAddr, selected_oad_file_id);

            if(status == Collector_status_invalid_file)
            {
                Board_Lcd_printf(DisplayLine_info, "Info: Update req file not found ID:%d", selected_oad_file_id);
            }
            else if(status != Collector_status_success)
            {
                Board_Lcd_printf(DisplayLine_info, "Info: Update req failed");
            }
        }

        if(Csf_keys == KEY_GET_OAD_FILE)
        {
            static char new_oad_file[256] = DEFUALT_OAD_FILE;

            if(sscanf(cmdBuff, "f %s", new_oad_file))
            {
                selected_oad_file_id = Collector_updateFwList(new_oad_file);
            }

            Board_Lcd_printf(DisplayLine_info, "Info: OAD file %s", new_oad_file);
        }

        if(Csf_keys == KEY_TOGGLE_REQ)
        {
            ApiMac_sAddr_t sAddr;
            Collector_status_t status;

            Board_Lcd_printf(DisplayLine_info, "Info: Sending 0x%04x LED toggle req", selected_device);

            sAddr.addr.shortAddr = selected_device;
            sAddr.addrMode = ApiMac_addrType_short;
            status = Csf_sendToggleLedRequest(&sAddr);

            if(status == Collector_status_deviceNotFound)
            {
                Board_Lcd_printf(DisplayLine_info, "Info: Toggle Req device 0x%04x not found", selected_device);
            }
            else if(status != Collector_status_success)
            {
                Board_Lcd_printf(DisplayLine_info, "Info: Update Req failed");
            }
        }

        if(Csf_keys == KEY_LIST_DEVICES)
        {
            ApiMac_sAddr_t sAddr;
            uint32_t devIdx;

            for(devIdx = 1; devIdx < CONFIG_MAX_DEVICES; devIdx++)
            {
                sAddr.addr.shortAddr = devIdx;
                sAddr.addrMode = ApiMac_addrType_short;

                if(Collector_findDevice(&sAddr) == Collector_status_success)
                {
                    Board_Lcd_printf(DisplayLine_info, "Info: Device 0x%04x found", devIdx);
                }
            }
        }

        if(Csf_keys == KEY_DISASSOCIATE_DEVICE)
        {
            ApiMac_sAddr_t sAddr;

            Board_Lcd_printf(DisplayLine_info, "Info: Sending 0x%04x disassociation req", selected_device);

            sAddr.addr.shortAddr = selected_device;
            sAddr.addrMode = ApiMac_addrType_short;

            if(!removeDevice(sAddr))
            {
                Board_Lcd_printf(DisplayLine_info, "Info: disassociation req device 0x%04x not found", selected_device);
            }
        }

        /* Clear the key press indication */
        Csf_keys = 0;
    }

    /* Clear the event */
    Util_clearEvent(&Csf_events, CSF_KEY_EVENT);

#endif /* (!defined(IS_HEADLESS) && defined(IS_HLOS)) */

#if defined(MT_CSF)
    MTCSF_displayStatistics();
#endif
}

#if (!defined(IS_HEADLESS) && defined(IS_HLOS))
void initConsoleCmd(void)
{
    struct termios term_attr;

    /* set the terminal to raw mode */
    tcgetattr(fileno(stdin), &term_attr);
    term_attr.c_lflag &= ~(ECHO|ICANON);
    term_attr.c_cc[VTIME] = 0;
    term_attr.c_cc[VMIN] = 0;
    tcsetattr(fileno(stdin), TCSANOW, &term_attr);

}

char* getConsoleCmd(void)
{
    static bool cmdComplete = false;
    static char cmd[256] = {0};
    static int ch;
    static uint8_t cmdIdx = 0;

    if(cmdComplete)
    {
        memset(cmd, 0, 256);
        cmdIdx = 0;
        cmdComplete = false;
    }

    /* read a character from the stdin stream without blocking */
    /*   returns EOF (-1) if no character is available */
    ch = getchar();

    if(ch != -1)
    {
         /* Discard non-ascii characters except new lines */
        if(ch == 0xa || (ch >= 0x20 && ch < 0x7F))
        {
            cmd[cmdIdx] = ch;
        }

        Board_Lcd_printf(DisplayLine_cmd, "cmd: %s", cmd)
        //cmdIdx will wrap arounf for the 256Byte buffer
        if(cmd[cmdIdx] == 0xa)
        {
            cmdComplete = true;
        }
        else
        {
            cmdIdx++;
        }
    }

    if(cmdComplete)
    {
        return cmd;
    }
    else
    {
        return 0;
    }
}
#endif //(!defined(HEADLESS) && defined(IS_HLOS))

/*!
 The application calls this function to retrieve the stored
 network information.

 Public function defined in csf.h
 */
bool Csf_getNetworkInformation(Llc_netInfo_t *pInfo)
{
    if((pNV != NULL) && (pNV->readItem != NULL) && (pInfo != NULL))
    {
        NVINTF_itemID_t id;

        /* Setup NV ID */
        id.systemID = NVINTF_SYSID_APP;
        id.itemID = CSF_NV_NETWORK_INFO_ID;
        id.subID = 0;

        /* Read Network Information from NV */
        if(pNV->readItem(id, 0, sizeof(Llc_netInfo_t), pInfo) == NVINTF_SUCCESS)
        {
            return(true);
        }
    }
    return(false);
}

/*!
 The application calls this function to indicate that it has
 started or restored the device in a network

 Public function defined in csf.h
 */
void Csf_networkUpdate(bool restored, Llc_netInfo_t *pNetworkInfo)
{
    /* check for valid structure ponter, ignore if not */
    if(pNetworkInfo != NULL)
    {
        if((pNV != NULL) && (pNV->writeItem != NULL))
        {
            NVINTF_itemID_t id;

            /* Setup NV ID */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_NETWORK_INFO_ID;
            id.subID = 0;

            /* Write the NV item */
            pNV->writeItem(id, sizeof(Llc_netInfo_t), pNetworkInfo);
        }


#if IS_HLOS
        /* Send info to appClient */
        if(pNetworkInfo != NULL)
        {
             appsrv_networkUpdate(restored, pNetworkInfo);
        }
#endif /* IS_HLOS */

        started = true;

#ifndef IS_HEADLESS
        if(restored == false)
        {
            Board_Lcd_printf(DisplayLine_nwk, "Nwk: Started");
        }
        else
        {
            Board_Lcd_printf(DisplayLine_nwk, "Nwk: Started");
        }

        if(pNetworkInfo->fh == false)
        {
            Board_Lcd_printf(DisplayLine_info, "Info: Channel %d", pNetworkInfo->channel);
        }
        else
        {
            Board_Lcd_printf(DisplayLine_info, "Info: Freq. Hopping");
        }
#endif //!IS_HEADLESS

        Board_Led_control(board_led_type_LED1, board_led_state_ON);

#if defined(MT_CSF)
        MTCSF_networkUpdateIndCB();
#endif
    }
}

/*!
 The application calls this function to indicate that a device
 has joined the network.

 Public function defined in csf.h
 */
ApiMac_assocStatus_t Csf_deviceUpdate(ApiMac_deviceDescriptor_t *pDevInfo,
                                      ApiMac_capabilityInfo_t *pCapInfo)
{
    ApiMac_assocStatus_t status = ApiMac_assocStatus_success;
    ApiMac_sAddr_t shortAddr;
    ApiMac_sAddr_t extAddr;

    shortAddr.addrMode = ApiMac_addrType_short;
    shortAddr.addr.shortAddr = pDevInfo->shortAddress;

    extAddr.addrMode = ApiMac_addrType_extended;
    memcpy(&extAddr.addr.extAddr, &pDevInfo->extAddress, APIMAC_SADDR_EXT_LEN);

    /* Is the device in the black list? */
    if((findBlackListIndex(&shortAddr) >= 0)
       || (findBlackListIndex(&extAddr) >= 0))
    {
        /* Denied */
        status = ApiMac_assocStatus_panAccessDenied;

#if IS_HLOS
        LOG_printf(LOG_APPSRV_MSG_CONTENT,
                   "Denied: 0x%04x\n",
                   pDevInfo->shortAddress);
#endif /* IS_HLOS */

#ifndef IS_HEADLESS
        Board_Lcd_printf(DisplayLine_info, "Info: Denied 0x%04x", pDevInfo->shortAddress);
#endif //IS_HEADLESS
    }
    else
    {
        /* Save the device information */
        Llc_deviceListItem_t dev;

        memcpy(&dev.devInfo, pDevInfo, sizeof(ApiMac_deviceDescriptor_t));
        memcpy(&dev.capInfo, pCapInfo, sizeof(ApiMac_capabilityInfo_t));
        dev.rxFrameCounter = 0;

        if(addDeviceListItem(&dev) == false)
        {
#ifdef NV_RESTORE
            status = ApiMac_assocStatus_panAtCapacity;

#if IS_HLOS
            LOG_printf(LOG_ERROR,"Failed: 0x%04x\n", pDevInfo->shortAddress);
#endif /* IS_HLOS */

#ifndef IS_HEADLESS
            Board_Lcd_printf(DisplayLine_info, "Info: Join Failed 0x%04x", pDevInfo->shortAddress);
#endif //!IS_HEADLESS

#else /* NV_RESTORE */
        status = ApiMac_assocStatus_success;
#if IS_HLOS
        LOG_printf(LOG_ERROR,"Joined: 0x%04x\n", pDevInfo->shortAddress);
#endif /* IS_HLOS */

#ifndef IS_HEADLESS
        Board_Lcd_printf(DisplayLine_info, "Info: Joined 0x%04x", pDevInfo->shortAddress);
#endif //!IS_HEADLESS

#endif /* NV_RESTORE */
        }
        else
        {
#if IS_HLOS
         /* Send update to the appClient */
            LOG_printf(LOG_APPSRV_MSG_CONTENT,
                       "sending device update info to appsrv \n");
            appsrv_deviceUpdate(&dev);
#endif /* IS_HLOS */

#ifndef IS_HEADLESS
            Board_Lcd_printf(DisplayLine_info, "Info: Joined 0x%04x", pDevInfo->shortAddress);
#endif //!IS_HEADLESS
        }
    }

#if defined(MT_CSF)
    MTCSF_deviceUpdateIndCB(pDevInfo, pCapInfo);
#endif

    /* Return the status of the joining device */
    return (status);
}

/*!
 The application calls this function to indicate that a device
 is no longer active in the network.

 Public function defined in csf.h
 */
void Csf_deviceNotActiveUpdate(ApiMac_deviceDescriptor_t *pDevInfo,
bool timeout)
{

#if IS_HLOS
    /* send update to the appClient */
    LOG_printf(LOG_APPSRV_MSG_CONTENT,
               "!Responding: 0x%04x\n",
               pDevInfo->shortAddress);
    appsrv_deviceNotActiveUpdate(pDevInfo, timeout);
    LOG_printf( LOG_DBG_API_MAC_datastats,
                "inactive: pan: 0x%04x short: 0x%04x ext: %02x:%02x:%02x:%02x:%02x:%02x:%02x:%02x\n",
                pDevInfo->panID,
                pDevInfo->shortAddress,
                pDevInfo->extAddress[0],
                pDevInfo->extAddress[1],
                pDevInfo->extAddress[2],
                pDevInfo->extAddress[3],
                pDevInfo->extAddress[4],
                pDevInfo->extAddress[5],
                pDevInfo->extAddress[6],
                pDevInfo->extAddress[7]);
#endif /* IS_HLOS */

#ifndef IS_HEADLESS
    Board_Lcd_printf(DisplayLine_info, "Info: No response 0x%04x", pDevInfo->shortAddress);
#endif //IS_HEADLESS

#if defined(MT_CSF)
    MTCSF_deviceNotActiveIndCB(pDevInfo, timeout);
#endif

}

/*!
 The application calls this function to indicate that a device
 has responded to a Config Request.

 Public function defined in csf.h
 */
void Csf_deviceConfigUpdate(ApiMac_sAddr_t *pSrcAddr, int8_t rssi,
                            Smsgs_configRspMsg_t *pMsg)
{
#if IS_HLOS
    /* send update to the appClient */
    appsrv_deviceConfigUpdate(pSrcAddr,rssi,pMsg);
    LOG_printf(LOG_APPSRV_MSG_CONTENT,
               "ConfigRsp: 0x%04x\n",
               pSrcAddr->addr.shortAddr);
#endif /* IS_HLOS */

#ifndef IS_HEADLESS
    Board_Lcd_printf(DisplayLine_info, "Info: ConfigRsp 0x%04x", pSrcAddr->addr.shortAddr);
#endif //IS_HEADLESS

#if defined(MT_CSF)
    MTCSF_configResponseIndCB(pSrcAddr, rssi, pMsg);
#endif

}

/*!
 The application calls this function to indicate that a device
 has reported sensor data.

 Public function defined in csf.h
 */
void Csf_deviceSensorDataUpdate(ApiMac_sAddr_t *pSrcAddr, int8_t rssi,
                                Smsgs_sensorMsg_t *pMsg)
{
#ifndef IS_HEADLESS
    uint16_t sensorData = pMsg->tempSensor.ambienceTemp;

    if((DisplayLine_sensorStart + (pSrcAddr->addr.shortAddr - 1)) < DisplayLine_sensorEnd)
    {
        Board_Lcd_printf(DisplayLine_sensorStart + (pSrcAddr->addr.shortAddr - 1), "Sensor 0x%04x: Temp %d, RSSI %d",
                        pSrcAddr->addr.shortAddr, sensorData, rssi);
    }
    else
    {
        Board_Lcd_printf(DisplayLine_sensorEnd, "Sensor 0x%04x: Temp %d, RSSI %d",
                        pSrcAddr->addr.shortAddr, sensorData, rssi);
    }
#endif //!IS_HEADLESS

#if IS_HLOS
    /* send data to the appClient */
    LOG_printf(LOG_APPSRV_MSG_CONTENT,
               "Sensor 0x%04x\n",
               pSrcAddr->addr.shortAddr);

    appsrv_deviceSensorDataUpdate(pSrcAddr, rssi, pMsg);
#endif /* IS_HLOS */

    Board_Led_toggle(board_led_type_LED2);

#if defined(MT_CSF)
    MTCSF_sensorUpdateIndCB(pSrcAddr, rssi, pMsg);
#endif
}

/*!
 The application calls this function to indicate that a device
 has disassociated.

 Public function defined in csf.h
 */
void Csf_deviceDisassocUpdate( ApiMac_sAddr_t *pSrcAddr )
{
#ifndef IS_HEADLESS
    if(pSrcAddr->addrMode == ApiMac_addrType_extended)
    {
        Board_Lcd_printf(DisplayLine_info, "Info: Disassociate ind from %02x:%02x:%02x:%02x:%02x:%02x:%02x:%02x",
                            pSrcAddr->addr.extAddr[7], pSrcAddr->addr.extAddr[6],
                            pSrcAddr->addr.extAddr[5], pSrcAddr->addr.extAddr[4],
                            pSrcAddr->addr.extAddr[3], pSrcAddr->addr.extAddr[2],
                            pSrcAddr->addr.extAddr[1], pSrcAddr->addr.extAddr[0]);
    }
    else //assume short addr
    {
        Board_Lcd_printf(DisplayLine_info, "Info: Disassociate ind from 0x%04x", pSrcAddr->addr.shortAddr);
    }
#endif //!IS_HEADLESS
}

/*!
 The application calls this function to indicate that a device
 has reported its FW version.

 Public function defined in csf.h
 */
void Csf_deviceSensorFwVerUpdate( uint16_t srcAddr, char *fwVerStr)
{
    Board_Led_toggle(board_led_type_LED2);

#ifndef IS_HEADLESS
    if((DisplayLine_sensorStart + (srcAddr - 1)) < DisplayLine_sensorEnd)
    {
        Board_Lcd_printf(DisplayLine_sensorStart + (srcAddr - 1), "Sensor 0x%04x: FW Ver %s",
                        srcAddr, fwVerStr);
    }
    else
    {
        Board_Lcd_printf(DisplayLine_sensorEnd, "Sensor 0x%04x: FW Ver %s",
                        srcAddr, fwVerStr);
    }
#endif //!IS_HEADLESS
}

/*!
 The application calls this function to indicate that a device
 has reported its FW version.

 Public function defined in csf.h
 */
void Csf_deviceSensorOadUpdate( uint16_t srcAddr, uint16_t imgId, uint16_t blockNum, uint16_t NumBlocks)
{
    Board_Led_toggle(board_led_type_LED2);

#ifndef IS_HEADLESS
    uint8_t displayLine = 0;
    
    if((DisplayLine_sensorStart + (srcAddr - 1)) < DisplayLine_sensorEnd)
    {
        displayLine = (DisplayLine_sensorStart + (srcAddr - 1));
    }
    else
    {
        displayLine = DisplayLine_sensorEnd;
    }
    
    if((blockNum + 1) == NumBlocks)
    {
        Board_Lcd_printf(displayLine, "Sensor 0x%04x: OAD completed, booting new image...", 
                        srcAddr);
    }
    else
    {
        Board_Lcd_printf(displayLine, "Sensor 0x%04x: OAD image %d, block %d of %d",
                srcAddr, imgId, blockNum + 1, NumBlocks);
    }
#endif //!IS_HEADLESS
}

/*!
 The application calls this function to indicate that a device
 set a Toggle LED Response message.

 Public function defined in csf.h
 */
void Csf_toggleResponseReceived(ApiMac_sAddr_t *pSrcAddr, bool ledState)
{
#if defined(MT_CSF)
    uint16_t shortAddr = 0xFFFF;

    Board_Lcd_printf(DisplayLine_info, "Info: Device 0x%04x LED toggle rsp received", selected_device);

    if(pSrcAddr)
    {
        if(pSrcAddr->addrMode == ApiMac_addrType_short)
        {
            shortAddr = pSrcAddr->addr.shortAddr;
        }
        else
        {
            /* Convert extended to short addr */
            shortAddr = Csf_getDeviceShort(&pSrcAddr->addr.extAddr);
        }
    }
    MTCSF_deviceToggleIndCB(shortAddr, ledState);
#endif
}

/*!
 The application calls this function to indicate that the
 Coordinator's state has changed.

 Public function defined in csf.h
 */
void Csf_stateChangeUpdate(Cllc_states_t state)
{
#if !defined(IS_HLOS)
    if(started == true)
    {
        if(state == Cllc_states_joiningAllowed)
        {
            /* Flash LED1 while allowing joining */
            Board_Led_control(board_led_type_LED1, board_led_state_BLINKING);
        }
        else if(state == Cllc_states_joiningNotAllowed)
        {
            /* Don't flash when not allowing joining */
            Board_Led_control(board_led_type_LED1, board_led_state_ON);
        }
    }
#endif
    /* Save the state to be used later */
    savedCllcState = state;

#if defined(MT_CSF)
    MTCSF_stateChangeIndCB(state);
#endif
#if IS_HLOS
    /* Send the update to appClient */
    LOG_printf(LOG_APPSRV_MSG_CONTENT,
               "stateChangeUpdate, newstate: (%d) %s\n",
               (int)(state), CSF_cllc_statename(state));
    appsrv_stateChangeUpdate(state);
#endif /* IS_HLOS */
}

/* Wrappers for Callbacks*/
#if IS_HLOS

static void processConfigTimeoutCallback_WRAPPER(intptr_t timer_handle,
                         intptr_t cookie)
{
    (void)timer_handle;
    (void)cookie;
    processConfigTimeoutCallback(0);
}

static void processJoinTimeoutCallback_WRAPPER(intptr_t timer_handle,
                                               intptr_t cookie)
{
    (void)timer_handle;
    (void)cookie;
    processJoinTimeoutCallback(0);
}

static void processPATrickleTimeoutCallback_WRAPPER(intptr_t timer_handle,
                                                    intptr_t cookie)
{
    (void)timer_handle;
    (void)cookie;
    processPATrickleTimeoutCallback(0);
}

static void processPCTrickleTimeoutCallback_WRAPPER(intptr_t timer_handle,
                                                    intptr_t cookie)
{
    (void)timer_handle;
    (void)cookie;
    processPCTrickleTimeoutCallback(0);
}

/* Wrap HLOS to embedded callback */
static void processTackingTimeoutCallback_WRAPPER(intptr_t timer_handle,
                                                  intptr_t cookie)
{
    (void)timer_handle;
    (void)cookie;
    processTackingTimeoutCallback(0);
}

#endif

/*!
 Initialize the tracking clock.

 Public function defined in csf.h
 */
void Csf_initializeTrackingClock(void)
{
#if IS_HLOS
    trackingClkHandle = TIMER_CB_create("trackingTimer",
        processTackingTimeoutCallback_WRAPPER,
        0,
        TRACKING_INIT_TIMEOUT_VALUE,
        false);
#else
    /* Initialize the timers needed for this application */
    trackingClkHandle = Timer_construct(&trackingClkStruct,
                                        processTackingTimeoutCallback,
                                        TRACKING_INIT_TIMEOUT_VALUE,
                                        0,
                                        false,
                                        0);
#endif
}

/*!
 Initialize the trickle clock.

 Public function defined in csf.h
 */
void Csf_initializeTrickleClock(void)
{
#if IS_HLOS
    tricklePAClkHandle =
        TIMER_CB_create(
            "paTrickleTimer",
            processPATrickleTimeoutCallback_WRAPPER,
             0,
                TRICKLE_TIMEOUT_VALUE,
                false);

    tricklePCClkHandle =
        TIMER_CB_create(
            "pcTrickleTimer",
            processPCTrickleTimeoutCallback_WRAPPER,
             0,
            TRICKLE_TIMEOUT_VALUE,
        false);

#else
    /* Initialize trickle timer */
    tricklePAClkHandle = Timer_construct(&tricklePAClkStruct,
                                         processPATrickleTimeoutCallback,
                                         TRICKLE_TIMEOUT_VALUE,
                                         0,
                                         false,
                                         0);

    tricklePCClkHandle = Timer_construct(&tricklePCClkStruct,
                                         processPCTrickleTimeoutCallback,
                                         TRICKLE_TIMEOUT_VALUE,
                                         0,
                                         false,
                                         0);
#endif
}

/*!
 Initialize the clock for join permit attribute.

 Public function defined in csf.h
 */
void Csf_initializeJoinPermitClock(void)
{
#if IS_HLOS
    /* Initialize join permit timer */
    joinClkHandle =
        TIMER_CB_create(
        "joinTimer",
        processJoinTimeoutCallback_WRAPPER,
        0,
        JOIN_TIMEOUT_VALUE,
        false);
#else
    /* Initialize join permit timer */
    joinClkHandle = Timer_construct(&joinClkStruct,
                                    processJoinTimeoutCallback,
                                    JOIN_TIMEOUT_VALUE,
                                    0,
                                    false,
                                    0);
#endif
}

/*!
 Initialize the clock for config request delay

 Public function defined in csf.h
 */
void Csf_initializeConfigClock(void)
{
#if IS_HLOS
    configClkHandle =
        TIMER_CB_create(
            "configTimer",
            processConfigTimeoutCallback_WRAPPER,
            0,
            CONFIG_TIMEOUT_VALUE,
            false );
#else
    /* Initialize join permit timer */
    configClkHandle = Timer_construct(&configClkStruct,
                                    processConfigTimeoutCallback,
                                    CONFIG_TIMEOUT_VALUE,
                                    0,
                                    false,
                                    0);
#endif
}

/*!
 Set the tracking clock.

 Public function defined in csf.h
 */
void Csf_setTrackingClock(uint32_t trackingTime)
{
#if IS_HLOS
    /* Stop the Tracking timer */

    TIMER_CB_destroy(trackingClkHandle);
    trackingClkHandle = 0;

    /* Setup timer */
    if(trackingTime != 0)
    {
        trackingClkHandle =
            TIMER_CB_create(
                "trackingTimer",
                processTackingTimeoutCallback_WRAPPER,
                0,
                trackingTime,
                false);
    }
#else
    /* Stop the Tracking timer */
    if(Timer_isActive(&trackingClkStruct) == true)
    {
        Timer_stop(&trackingClkStruct);
    }

    if(trackingTime)
    {
        /* Setup timer */
        Timer_setTimeout(trackingClkHandle, trackingTime);
        Timer_start(&trackingClkStruct);
    }
#endif
}

/*!
 Set the trickle clock.

 Public function defined in csf.h
 */
void Csf_setTrickleClock(uint32_t trickleTime, uint8_t frameType)
{
    uint16_t randomNum = 0;
    uint16_t randomTime = 0;

    if(trickleTime > 0)
    {
        randomNum = ((ApiMac_randomByte() << 8) + ApiMac_randomByte());
        randomTime = (trickleTime >> 1) +
                      (randomNum % (trickleTime >> 1));
    }

    if(frameType == ApiMac_wisunAsyncFrame_advertisement)
    {
#if IS_HLOS
        /* ALWAYS stop (avoid race conditions) */
        TIMER_CB_destroy(tricklePAClkHandle);
        tricklePAClkHandle = 0;

    /* then create new, only if needed */
        if(trickleTime > 0)
        {
            /* Setup timer */
            tricklePAClkHandle = TIMER_CB_create(
                "paTrickleTimer",
                    processPATrickleTimeoutCallback_WRAPPER,
                    0,
                    randomTime,
                    false);
        }
#else
        /* Stop the PA trickle timer */
        if(Timer_isActive(&tricklePAClkStruct) == true)
        {
            Timer_stop(&tricklePAClkStruct);
        }

        if(trickleTime > 0)
        {
            /* Setup timer */
            Timer_setTimeout(tricklePAClkHandle, randomTime);
            Timer_start(&tricklePAClkStruct);
        }
#endif
    }
    else if(frameType == ApiMac_wisunAsyncFrame_config)
    {
#if IS_HLOS
        /* Always stop */
        TIMER_CB_destroy(tricklePCClkHandle);
        tricklePCClkHandle = 0;
    /* and recreate only if needed */
        if(trickleTime > 0)
        {
            /* Setup timer */
            tricklePCClkHandle =
                TIMER_CB_create(
                "pcTrickleTimer",
                processPCTrickleTimeoutCallback_WRAPPER,
                0,
                trickleTime, false);
        }
#else
        /* Stop the PC trickle timer */
        if(Timer_isActive(&tricklePCClkStruct) == true)
        {
            Timer_stop(&tricklePCClkStruct);
        }

        if(trickleTime > 0)
        {
            /* Setup timer */
            Timer_setTimeout(tricklePCClkHandle, randomTime);
            Timer_start(&tricklePCClkStruct);
        }
#endif
    }
}

/*!
 Set the clock join permit attribute.

 Public function defined in csf.h
 */
void Csf_setJoinPermitClock(uint32_t joinDuration)
{
#if IS_HLOS
    /* Always stop the join timer */
    TIMER_CB_destroy(joinClkHandle);
    joinClkHandle = 0;

    /* Setup timer */
    if(joinDuration != 0)
    {
        joinClkHandle =
            TIMER_CB_create("joinTimer",
                processJoinTimeoutCallback_WRAPPER,
                0,
                joinDuration, false);
    }
#else
    /* Stop the join timer */
    if(Timer_isActive(&joinClkStruct) == true)
    {
        Timer_stop(&joinClkStruct);
    }

    if(joinDuration != 0)
    {
        /* Setup timer */
        Timer_setTimeout(joinClkHandle, joinDuration);
        Timer_start(&joinClkStruct);
    }
#endif
}

/*!
 Set the clock config request delay.

 Public function defined in csf.h
 */
void Csf_setConfigClock(uint32_t delay)
{
#if IS_HLOS
    /* Always destroy */
    TIMER_CB_destroy( configClkHandle );
    configClkHandle = 0;
    /* and create if needed */
    if( delay != 0 ){
        configClkHandle =
            TIMER_CB_create( "configClk",
                             processConfigTimeoutCallback_WRAPPER,
                             0,
                             delay,
                             false );
    }
#else
    /* Stop the join timer */
    if(Timer_isActive(&configClkStruct) == true)
    {
        Timer_stop(&configClkStruct);
    }

    if(delay != 0)
    {
        /* Setup timer */
        Timer_setTimeout(configClkHandle, delay);
        Timer_start(&configClkStruct);
    }
#endif
}

/*!
 Read the number of device list items stored

 Public function defined in csf.h
 */
uint16_t Csf_getNumDeviceListEntries(void)
{
    uint16_t numEntries = 0;

    if(pNV != NULL)
    {
        NVINTF_itemID_t id;
        uint8_t stat;

        /* Setup NV ID for the number of entries in the device list */
        id.systemID = NVINTF_SYSID_APP;
        id.itemID = CSF_NV_DEVICELIST_ENTRIES_ID;
        id.subID = 0;

        /* Read the number of device list items from NV */
        stat = pNV->readItem(id, 0, sizeof(uint16_t), &numEntries);
        if(stat != NVINTF_SUCCESS)
        {
            numEntries = 0;
        }
    }
    return (numEntries);
}

/*!
 Find the short address from a given extended address

 Public function defined in csf.h
 */
uint16_t Csf_getDeviceShort(ApiMac_sAddrExt_t *pExtAddr)
{
    Llc_deviceListItem_t item;
    ApiMac_sAddr_t devAddr;
    uint16_t shortAddr = CSF_INVALID_SHORT_ADDR;

    devAddr.addrMode = ApiMac_addrType_extended;
    memcpy(&devAddr.addr.extAddr, pExtAddr, sizeof(ApiMac_sAddrExt_t));

    if(Csf_getDevice(&devAddr,&item))
    {
        shortAddr = item.devInfo.shortAddress;
    }

    return(shortAddr);
}

/*!
 Find entry in device list

 Public function defined in csf.h
 */
bool Csf_getDevice(ApiMac_sAddr_t *pDevAddr, Llc_deviceListItem_t *pItem)
{
    if((pNV != NULL) && (pItem != NULL))
    {
        uint16_t numEntries;

        numEntries = Csf_getNumDeviceListEntries();

        if(numEntries > 0)
        {
            NVINTF_itemID_t id;
            uint8_t stat;
            int subId = 0;
            int readItems = 0;

            /* Setup NV ID for the device list records */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_DEVICELIST_ID;

            while((readItems < numEntries) && (subId
                                               < CSF_MAX_DEVICELIST_IDS))
            {
                Llc_deviceListItem_t item;

                id.subID = (uint16_t)subId;

                /* Read Network Information from NV */
                stat = pNV->readItem(id, 0, sizeof(Llc_deviceListItem_t),
                                     &item);
                if(stat == NVINTF_SUCCESS)
                {
                    if(((pDevAddr->addrMode == ApiMac_addrType_short)
                        && (pDevAddr->addr.shortAddr
                            == item.devInfo.shortAddress))
                       || ((pDevAddr->addrMode == ApiMac_addrType_extended)
                           && (memcmp(&pDevAddr->addr.extAddr,
                                      &item.devInfo.extAddress,
                                      (APIMAC_SADDR_EXT_LEN))
                               == 0)))
                    {
                        memcpy(pItem, &item, sizeof(Llc_deviceListItem_t));
                        return (true);
                    }
                    readItems++;
                }
                subId++;
            }
        }
    }

    return (false);
}

/*!
 Find entry in device list

 Public function defined in csf.h
 */
bool Csf_getDeviceItem(uint16_t devIndex, Llc_deviceListItem_t *pItem)
{
    if((pNV != NULL) && (pItem != NULL))
    {
        uint16_t numEntries;

        numEntries = Csf_getNumDeviceListEntries();

        if(numEntries > 0)
        {
            NVINTF_itemID_t id;
            uint8_t stat;
            int subId = 0;
            int readItems = 0;

            /* Setup NV ID for the device list records */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_DEVICELIST_ID;

            while((readItems < numEntries) && (subId
                                               < CSF_MAX_DEVICELIST_IDS))
            {
                Llc_deviceListItem_t item;

                id.subID = (uint16_t)subId;

                /* Read Network Information from NV */
                stat = pNV->readItem(id, 0, sizeof(Llc_deviceListItem_t),
                                     &item);
                if(stat == NVINTF_SUCCESS)
                {
                    if(readItems == devIndex)
                    {
                        memcpy(pItem, &item, sizeof(Llc_deviceListItem_t));
                        return (true);
                    }
                    readItems++;
                }
                subId++;
            }
        }
    }

    return (false);
}

/*!
 Csf implementation for memory allocation

 Public function defined in csf.h
 */
void *Csf_malloc(uint16_t size)
{
#if IS_HLOS
    return malloc(size);
#else
    return ICall_malloc(size);
#endif
}

/*!
 Csf implementation for memory de-allocation

 Public function defined in csf.h
 */
void Csf_free(void *ptr)
{
#if IS_HLOS
    free(ptr);
#else
    ICall_free(ptr);
#endif
}

/*!
 Update the Frame Counter

 Public function defined in csf.h
 */
void Csf_updateFrameCounter(ApiMac_sAddr_t *pDevAddr, uint32_t frameCntr)
{
    if((pNV != NULL) && (pNV->writeItem != NULL))
    {
        if(pDevAddr == NULL)
        {
            /* Update this device's frame counter */
            if((frameCntr >=
                (lastSavedCoordinatorFrameCounter + FRAME_COUNTER_SAVE_WINDOW)))
            {
                NVINTF_itemID_t id;

                /* Setup NV ID */
                id.systemID = NVINTF_SYSID_APP;
                id.itemID = CSF_NV_FRAMECOUNTER_ID;
                id.subID = 0;

                /* Write the NV item */
                if(pNV->writeItem(id, sizeof(uint32_t), &frameCntr)
                                == NVINTF_SUCCESS)
                {
                    lastSavedCoordinatorFrameCounter = frameCntr;
                }
            }
        }
        else
        {
            /* Child frame counter update */
            Llc_deviceListItem_t devItem;

            /* Is the device in our database? */
            if(Csf_getDevice(pDevAddr, &devItem))
            {
                /*
                 Don't save every update, only save if the new frame
                 counter falls outside the save window.
                 */
                if((devItem.rxFrameCounter + FRAME_COUNTER_SAVE_WINDOW)
                                <= frameCntr)
                {
                    /* Update the frame counter */
                    devItem.rxFrameCounter = frameCntr;
                    updateDeviceListItem(&devItem);
                }
            }
        }
    }
}

/*!
 Get the Frame Counter

 Public function defined in csf.h
 */
bool Csf_getFrameCounter(ApiMac_sAddr_t *pDevAddr, uint32_t *pFrameCntr)
{
    /* Check for valid pointer */
    if(pFrameCntr != NULL)
    {
        /*
         A pDevAddr that is null means to get the frame counter for this device
         */
        if(pDevAddr == NULL)
        {
            if((pNV != NULL) && (pNV->readItem != NULL))
            {
                NVINTF_itemID_t id;

                /* Setup NV ID */
                id.systemID = NVINTF_SYSID_APP;
                id.itemID = CSF_NV_FRAMECOUNTER_ID;
                id.subID = 0;

                /* Read Network Information from NV */
                if(pNV->readItem(id, 0, sizeof(uint32_t), pFrameCntr)
                                == NVINTF_SUCCESS)
                {
                    /* Set to the next window */
                    *pFrameCntr += FRAME_COUNTER_SAVE_WINDOW;
                    return(true);
                }
                else
                {
                    /*
                     Wasn't found, so write 0, so the next time it will be
                     greater than 0
                     */
                    uint32_t fc = 0;

                    /* Setup NV ID */
                    id.systemID = NVINTF_SYSID_APP;
                    id.itemID = CSF_NV_FRAMECOUNTER_ID;
                    id.subID = 0;

                    /* Write the NV item */
                    pNV->writeItem(id, sizeof(uint32_t), &fc);
                }
            }
        }

        *pFrameCntr = 0;
    }
    return (false);
}


/*!
 Delete an entry from the device list

 Public function defined in csf.h
 */
void Csf_removeDeviceListItem(ApiMac_sAddrExt_t *pAddr)
{
    if((pNV != NULL) && (pNV->deleteItem != NULL))
    {
        int index;

        /* Does the item exist? */
        index = findDeviceListIndex(pAddr);
        if(index != DEVICE_INDEX_NOT_FOUND)
        {
            uint8_t stat;
            NVINTF_itemID_t id;

            /* Setup NV ID for the device list record */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_DEVICELIST_ID;
            id.subID = (uint16_t)index;

            stat = pNV->deleteItem(id);
            if(stat == NVINTF_SUCCESS)
            {
                /* Update the number of entries */
                uint16_t numEntries = Csf_getNumDeviceListEntries();
                if(numEntries > 0)
                {
                    numEntries--;
                    saveNumDeviceListEntries(numEntries);
                }
            }
        }
    }
}

/*!
 Assert Indication

 Public function defined in csf.h
 */
void Csf_assertInd(uint8_t reason)
{
#if IS_HLOS
    LOG_printf( LOG_ERROR, "Assert Reason: %d\n", (int)(reason) );
#endif
#if defined(MT_CSF)
    if((pNV != NULL) && (pNV->writeItem != NULL))
    {
        /* Attempt to save reason to read after reset */
        (void)pNV->writeItem(nvResetId, 1, &reason);
    }
#endif
}

/*!
 Clear all the NV Items

 Public function defined in csf.h
 */
void Csf_clearAllNVItems(void)
{
    if((pNV != NULL) && (pNV->deleteItem != NULL))
    {
        NVINTF_itemID_t id;
        uint16_t entries;

        /* Clear Network Information */
        id.systemID = NVINTF_SYSID_APP;
        id.itemID = CSF_NV_NETWORK_INFO_ID;
        id.subID = 0;
        pNV->deleteItem(id);

        /* Clear the black list entries number */
        id.systemID = NVINTF_SYSID_APP;
        id.itemID = CSF_NV_BLACKLIST_ENTRIES_ID;
        id.subID = 0;
        pNV->deleteItem(id);

        /*
         Clear the black list entries.  Brute force through
         every possible subID, if it doesn't exist that's fine,
         it will fail in deleteItem.
         */
        id.systemID = NVINTF_SYSID_APP;
        id.itemID = CSF_NV_BLACKLIST_ID;
        for(entries = 0; entries < CSF_MAX_BLACKLIST_IDS; entries++)
        {
            id.subID = entries;
            pNV->deleteItem(id);
        }

        /* Clear the device list entries number */
        id.systemID = NVINTF_SYSID_APP;
        id.itemID = CSF_NV_DEVICELIST_ENTRIES_ID;
        id.subID = 0;
        pNV->deleteItem(id);

        /*
         Clear the device list entries.  Brute force through
         every possible subID, if it doesn't exist that's fine,
         it will fail in deleteItem.
         */
        id.systemID = NVINTF_SYSID_APP;
        id.itemID = CSF_NV_DEVICELIST_ID;
        for(entries = 0; entries < CSF_MAX_DEVICELIST_IDS; entries++)
        {
            id.subID = entries;
            pNV->deleteItem(id);
        }

        /* Clear the device tx frame counter */
        id.systemID = NVINTF_SYSID_APP;
        id.itemID = CSF_NV_FRAMECOUNTER_ID;
        id.subID = 0;
        pNV->deleteItem(id);
    }
}


/*!
 Add an entry into the black list

 Public function defined in csf.h
 */
bool Csf_addBlackListItem(ApiMac_sAddr_t *pAddr)
{
    bool retVal = false;

    if((pNV != NULL) && (pAddr != NULL)
       && (pAddr->addrMode != ApiMac_addrType_none))
    {
        if(findBlackListIndex(pAddr))
        {
            retVal = true;
        }
        else
        {
            uint8_t stat;
            NVINTF_itemID_t id;
            uint16_t numEntries = getNumBlackListEntries();

            /* Check the maximum size */
            if(numEntries < CSF_MAX_BLACKLIST_ENTRIES)
            {
                /* Setup NV ID for the black list record */
                id.systemID = NVINTF_SYSID_APP;
                id.itemID = CSF_NV_BLACKLIST_ID;
                id.subID = (uint16_t)findUnusedBlackListIndex();

                /* write the black list record */
                stat = pNV->writeItem(id, sizeof(ApiMac_sAddr_t), pAddr);
                if(stat == NVINTF_SUCCESS)
                {
                    /* Update the number of entries */
                    numEntries++;
                    saveNumBlackListEntries(numEntries);
                    retVal = true;
                }
            }
        }
    }

    return (retVal);
}

/*!
 Check if config timer is active

 Public function defined in csf.h
 */
bool Csf_isConfigTimerActive(void)
{
    bool b;
#if IS_HLOS
    int r;
    /*
     * If the timer is not valid (ie: handle=0)
     * the 'getRemain()' will return negative
     * which is the same as expired.
     */
    r = TIMER_CB_getRemain(configClkHandle);
    if( r < 0 ){
        b = false;
    } else {
        b = true;
    }
#else
    b = (Timer_isActive(&configClkStruct));
#endif
    return b;
}

/*!
 Check if tracking timer is active

 Public function defined in csf.h
*/
bool Csf_isTrackingTimerActive(void)
{
    bool b;
#if IS_HLOS
    int r;
    r = TIMER_CB_getRemain(trackingClkHandle);
    if( r < 0 ){
        b = false;
    } else {
        b = true;
    }
#else
    b = (Timer_isActive(&trackingClkStruct));
#endif
    return b;
}

/******************************************************************************
 Local Functions
 *****************************************************************************/

/*!
 * @brief       Tracking timeout handler function.
 *
 * @param       a0 - ignored
 */
static void processTackingTimeoutCallback(UArg a0)
{
    (void)a0; /* Parameter is not used */

    Util_setEvent(&Collector_events, COLLECTOR_TRACKING_TIMEOUT_EVT);

    /* Wake up the application thread when it waits for clock event */
    Semaphore_post(collectorSem);
}

/*!
 * @brief       Join permit timeout handler function.
 *
 * @param       a0 - ignored
 */
static void processJoinTimeoutCallback(UArg a0)
{
    (void)a0; /* Parameter is not used */

    Util_setEvent(&Cllc_events, CLLC_JOIN_EVT);

    /* Wake up the application thread when it waits for clock event */
    Semaphore_post(collectorSem);
}

/*!
 * @brief       Config delay timeout handler function.
 *
 * @param       a0 - ignored
 */
static void processConfigTimeoutCallback(UArg a0)
{
    (void)a0; /* Parameter is not used */

    Util_setEvent(&Collector_events, COLLECTOR_CONFIG_EVT);

    /* Wake up the application thread when it waits for clock event */
    Semaphore_post(collectorSem);
}

/*!
 * @brief       Trickle timeout handler function for PA .
 *
 * @param       a0 - ignored
 */
static void processPATrickleTimeoutCallback(UArg a0)
{
    (void)a0; /* Parameter is not used */

    Util_setEvent(&Cllc_events, CLLC_PA_EVT);

    /* Wake up the application thread when it waits for clock event */
    Semaphore_post(collectorSem);
}

/*!
 * @brief       Trickle timeout handler function for PC.
 *
 * @param       a0 - ignored
 */
static void processPCTrickleTimeoutCallback(UArg a0)
{
    (void)a0; /* Parameter is not used */

    Util_setEvent(&Cllc_events, CLLC_PC_EVT);

    /* Wake up the application thread when it waits for clock event */
    Semaphore_post(collectorSem);
}

/*!
 * @brief       Key event handler function
 *
 * @param       keysPressed - Csf_keys that are pressed
 */
static void processKeyChangeCallback(uint8_t keysPressed)
{
    Csf_keys = keysPressed;

    Csf_events |= CSF_KEY_EVENT;

    /* Wake up the application thread when it waits for clock event */
    Semaphore_post(collectorSem);
}

/*!
 * @brief       Add an entry into the device list
 *
 * @param       pItem - pointer to the device list entry
 *
 * @return      true if added or already existed, false if problem
 */
static bool addDeviceListItem(Llc_deviceListItem_t *pItem)
{
    bool retVal = false;

    if((pNV != NULL) && (pItem != NULL))
    {
        if(findDeviceListIndex(&pItem->devInfo.extAddress)
                        != DEVICE_INDEX_NOT_FOUND)
        {
            retVal = true;
        }
        else
        {
            uint8_t stat;
            NVINTF_itemID_t id;
            uint16_t numEntries = Csf_getNumDeviceListEntries();

            /* Check the maximum size */
            if(numEntries < CSF_MAX_DEVICELIST_ENTRIES)
            {
                /* Setup NV ID for the device list record */
                id.systemID = NVINTF_SYSID_APP;
                id.itemID = CSF_NV_DEVICELIST_ID;
                id.subID = (uint16_t)findUnusedDeviceListIndex();

                /* write the device list record */
                stat = pNV->writeItem(id, sizeof(Llc_deviceListItem_t), pItem);
                if(stat == NVINTF_SUCCESS)
                {
                    /* Update the number of entries */
                    numEntries++;
                    saveNumDeviceListEntries(numEntries);
                    retVal = true;
                }
            }
        }
    }

    return (retVal);
}

/*!
 * @brief       Update an entry in the device list
 *
 * @param       pItem - pointer to the device list entry
 */
static void updateDeviceListItem(Llc_deviceListItem_t *pItem)
{
    if((pNV != NULL) && (pItem != NULL))
    {
        int idx;

        idx = findDeviceListIndex(&pItem->devInfo.extAddress);
        if(idx != DEVICE_INDEX_NOT_FOUND)
        {
            NVINTF_itemID_t id;

            /* Setup NV ID for the device list record */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_DEVICELIST_ID;
            id.subID = (uint16_t)idx;

            /* write the device list record */
            pNV->writeItem(id, sizeof(Llc_deviceListItem_t), pItem);
        }
    }
}

/*!
 * @brief       Find entry in device list
 *
 * @param       pAddr - address to of device to find
 *
 * @return      sub index into the device list, -1 (DEVICE_INDEX_NOT_FOUND)
 *              if not found
 */
static int findDeviceListIndex(ApiMac_sAddrExt_t *pAddr)
{
    if((pNV != NULL) && (pAddr != NULL))
    {
        uint16_t numEntries;

        numEntries = Csf_getNumDeviceListEntries();

        if(numEntries > 0)
        {
            NVINTF_itemID_t id;
            uint8_t stat;
            int subId = 0;
            int readItems = 0;

            /* Setup NV ID for the device list records */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_DEVICELIST_ID;

            while((readItems < numEntries) && (subId
                                               < CSF_MAX_DEVICELIST_IDS))
            {
                Llc_deviceListItem_t item;

                id.subID = (uint16_t)subId;

                /* Read Network Information from NV */
                stat = pNV->readItem(id, 0, sizeof(Llc_deviceListItem_t),
                                     &item);
                if(stat == NVINTF_SUCCESS)
                {
                    /* Is the address the same */
                    if(memcmp(pAddr, &item.devInfo.extAddress,
                              (APIMAC_SADDR_EXT_LEN))
                       == 0)
                    {
                        return (subId);
                    }
                    readItems++;
                }
                subId++;
            }
        }
    }

    return (DEVICE_INDEX_NOT_FOUND);
}

/*!
 * @brief       Find an unused device list index
 *
 * @return      index that is not in use
 */
static int findUnusedDeviceListIndex(void)
{
    int subId = 0;

    if(pNV != NULL)
    {
        uint16_t numEntries;

        numEntries = Csf_getNumDeviceListEntries();

        if(numEntries > 0)
        {
            NVINTF_itemID_t id;

            int readItems = 0;
            /* Setup NV ID for the device list records */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_DEVICELIST_ID;

            while((readItems < numEntries) && (subId
                                               < CSF_MAX_DEVICELIST_IDS))
            {
                Llc_deviceListItem_t item;
                uint8_t stat;

                id.subID = (uint16_t)subId;

                /* Read Network Information from NV */
                stat = pNV->readItem(id, 0, sizeof(Llc_deviceListItem_t),
                                     &item);
                if(stat == NVINTF_NOTFOUND)
                {
                    /* Use this sub id */
                    break;
                }
                else if(stat == NVINTF_SUCCESS)
                {
                    readItems++;
                }
                subId++;
            }
        }
    }

    return (subId);
}

/*!
 * @brief       Read the number of device list items stored
 *
 * @param       numEntries - number of entries in the device list
 */
static void saveNumDeviceListEntries(uint16_t numEntries)
{
    if(pNV != NULL)
    {
        NVINTF_itemID_t id;

        /* Setup NV ID for the number of entries in the device list */
        id.systemID = NVINTF_SYSID_APP;
        id.itemID = CSF_NV_DEVICELIST_ENTRIES_ID;
        id.subID = 0;

        /* Read the number of device list items from NV */
        pNV->writeItem(id, sizeof(uint16_t), &numEntries);
    }
}

/*!
 * @brief       Find entry in black list
 *
 * @param       pAddr - address to add into the black list
 *
 * @return      sub index into the blacklist, -1 if not found
 */
static int findBlackListIndex(ApiMac_sAddr_t *pAddr)
{
    if((pNV != NULL) && (pAddr != NULL)
       && (pAddr->addrMode != ApiMac_addrType_none))
    {
        uint16_t numEntries;

        numEntries = getNumBlackListEntries();

        if(numEntries > 0)
        {
            NVINTF_itemID_t id;
            uint8_t stat;
            int subId = 0;
            int readItems = 0;

            /* Setup NV ID for the black list records */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_BLACKLIST_ID;

            while((readItems < numEntries) && (subId < CSF_MAX_BLACKLIST_IDS))
            {
                ApiMac_sAddr_t item;

                id.subID = (uint16_t)subId;

                /* Read Network Information from NV */
                stat = pNV->readItem(id, 0, sizeof(ApiMac_sAddr_t), &item);
                if(stat == NVINTF_SUCCESS)
                {
                    if(pAddr->addrMode == item.addrMode)
                    {
                        /* Is the address the same */
                        if(((pAddr->addrMode == ApiMac_addrType_short)
                            && (pAddr->addr.shortAddr == item.addr.shortAddr))
                           || ((pAddr->addrMode == ApiMac_addrType_extended)
                               && (memcmp(&pAddr->addr.extAddr,
                                          &item.addr.extAddr,
                                          APIMAC_SADDR_EXT_LEN)
                                   == 0)))
                        {
                            return (subId);
                        }
                    }
                    readItems++;
                }
                subId++;
            }
        }
    }

    return (-1);
}

/*!
 * @brief       Find an unused blacklist index
 *
 * @return      index that is not in use
 */
static int findUnusedBlackListIndex(void)
{
    int subId = 0;

    if(pNV != NULL)
    {
        uint16_t numEntries;

        numEntries = getNumBlackListEntries();

        if(numEntries > 0)
        {
            NVINTF_itemID_t id;

            int readItems = 0;
            /* Setup NV ID for the black list records */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_BLACKLIST_ID;

            while((readItems < numEntries) && (subId < CSF_MAX_BLACKLIST_IDS))
            {
                ApiMac_sAddr_t item;
                uint8_t stat;

                id.subID = (uint16_t)subId;

                /* Read Network Information from NV */
                stat = pNV->readItem(id, 0, sizeof(ApiMac_sAddr_t), &item);
                if(stat == NVINTF_NOTFOUND)
                {
                    /* Use this sub id */
                    break;
                }
                else if(stat == NVINTF_SUCCESS)
                {
                    readItems++;
                }
                subId++;
            }
        }
    }

    return (subId);
}

/*!
 * @brief       Read the number of black list items stored
 *
 * @return      number of entries in the black list
 */
static uint16_t getNumBlackListEntries(void)
{
    uint16_t numEntries = 0;

    if(pNV != NULL)
    {
        NVINTF_itemID_t id;
        uint8_t stat;

        /* Setup NV ID for the number of entries in the black list */
        id.systemID = NVINTF_SYSID_APP;
        id.itemID = CSF_NV_BLACKLIST_ENTRIES_ID;
        id.subID = 0;

        /* Read the number of black list items from NV */
        stat = pNV->readItem(id, 0, sizeof(uint16_t), &numEntries);
        if(stat != NVINTF_SUCCESS)
        {
            numEntries = 0;
        }
    }
    return (numEntries);
}

/*!
 * @brief       Read the number of black list items stored
 *
 * @param       numEntries - number of entries in the black list
 */
static void saveNumBlackListEntries(uint16_t numEntries)
{
    if(pNV != NULL)
    {
        NVINTF_itemID_t id;

        /* Setup NV ID for the number of entries in the black list */
        id.systemID = NVINTF_SYSID_APP;
        id.itemID = CSF_NV_BLACKLIST_ENTRIES_ID;
        id.subID = 0;

        /* Read the number of black list items from NV */
        pNV->writeItem(id, sizeof(uint16_t), &numEntries);
    }
}

/*!
 * @brief       Delete an address from the black list
 *
 * @param       pAddr - address to remove from black list.
 */
void removeBlackListItem(ApiMac_sAddr_t *pAddr)
{
    if(pNV != NULL)
    {
        int index;

        /* Does the item exist? */
        index = findBlackListIndex(pAddr);
        if(index > 0)
        {
            uint8_t stat;
            NVINTF_itemID_t id;

            /* Setup NV ID for the black list record */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_BLACKLIST_ID;
            id.subID = (uint16_t)index;

            stat = pNV->deleteItem(id);
            if(stat == NVINTF_SUCCESS)
            {
                /* Update the number of entries */
                uint16_t numEntries = getNumBlackListEntries();
                if(numEntries > 0)
                {
                    numEntries--;
                    saveNumBlackListEntries(numEntries);
                }
            }
        }
    }
}

/*!
 * @brief       This is an example function on how to remove a device
 *              from this network.
 *
 * @param       addr - device address
 *
 * @return      true if found, false if not
 */
static bool removeDevice(ApiMac_sAddr_t addr)
{
    LOG_printf(LOG_ERROR, "removing device 0x%04x\n", addr.addr.shortAddr);

    LOG_printf(LOG_ERROR, "sending Disassociation request to device 0x%04x\n", addr.addr.shortAddr);

    /* Send a disassociate to the device */
    Cllc_sendDisassociationRequest(addr.addr.shortAddr,
                                     false);

    return 1;
}

#if defined(TEST_REMOVE_DEVICE)
/*!
 * @brief       This is an example function on how to remove a device
 *              from this network.
 */
static void removeTheFirstDevice(void)
{
    if(pNV != NULL)
    {
        uint16_t numEntries;

        numEntries = Csf_getNumDeviceListEntries();

        if(numEntries > 0)
        {
            NVINTF_itemID_t id;
            uint16_t subId = 0;

            /* Setup NV ID for the device list records */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_DEVICELIST_ID;

            while(subId < CSF_MAX_DEVICELIST_IDS)
            {
                Llc_deviceListItem_t item;
                uint8_t stat;

                id.subID = (uint16_t)subId;

                /* Read Network Information from NV */
                stat = pNV->readItem(id, 0, sizeof(Llc_deviceListItem_t),
                                     &item);
                if(stat == NVINTF_SUCCESS)
                {
                    /* Found the first device in the list */
                    ApiMac_sAddr_t addr;

                    /* Send a disassociate to the device */
                    Cllc_sendDisassociationRequest(item.devInfo.shortAddress,
                                                   item.capInfo.rxOnWhenIdle);
                    /* Remove device from the NV list */
                    Cllc_removeDevice(&item.devInfo.extAddress);

                    /* Remove it from the Device list */
                    Csf_removeDeviceListItem(&item.devInfo.extAddress);

                    /* Add the device to the black list so it can't join again */
                    addr.addrMode = ApiMac_addrType_extended;
                    memcpy(&addr.addr.extAddr, &item.devInfo.extAddress,
                           (APIMAC_SADDR_EXT_LEN));
                    Csf_addBlackListItem(&addr);
                    break;
                }
                subId++;
            }
        }
    }
}
#endif

#if !IS_HLOS
/*!
 * @brief       Retrieve the first device's short address
 *
 * @return      short address or 0xFFFF if not found
 */
static uint16_t getTheFirstDevice(void)
{
    uint16_t found = CSF_INVALID_SHORT_ADDR;
    if(pNV != NULL)
    {
        uint16_t numEntries;

        numEntries = Csf_getNumDeviceListEntries();

        if(numEntries > 0)
        {
            NVINTF_itemID_t id;

            /* Setup NV ID for the device list records */
            id.systemID = NVINTF_SYSID_APP;
            id.itemID = CSF_NV_DEVICELIST_ID;
            id.subID = 0;

            while(id.subID < CSF_MAX_DEVICELIST_IDS)
            {
                Llc_deviceListItem_t item;
                uint8_t stat;

                /* Read Network Information from NV */
                stat = pNV->readItem(id, 0, sizeof(Llc_deviceListItem_t),
                                     &item);
                if(stat == NVINTF_SUCCESS)
                {
                    found = item.devInfo.shortAddress;
                    break;
                }
                id.subID++;
            }
        }
    }
    return(found);
}
#endif

/*!
 * @brief       Retrieve the first device's short address
 *
 * @return      short address or 0xFFFF if not found
 */
void Csf_freeDeviceInformationList(size_t n, Csf_deviceInformation_t *p)
{
    (void)(n); /* not used */
    if(p)
    {
        free((void *)(p));
    }
}

/*!
 The appSrv calls this function to get the list of connected
 devices

 Public function defined in csf_linux.h
 */
int Csf_getDeviceInformationList(Csf_deviceInformation_t **ppDeviceInfo)
{
    Csf_deviceInformation_t *pThis;
    Llc_deviceListItem_t    tmp;
    uint16_t actual;
    uint16_t subId;
    int n;
    NVINTF_itemID_t id;

    /* get number of connected devices */
    n = Csf_getNumDeviceListEntries();
    /* initialize device list pointer */

    pThis = calloc(n+1, sizeof(*pThis));
    *ppDeviceInfo = pThis;
    if(pThis == NULL)
    {
        LOG_printf(LOG_ERROR, "No memory for device list\n");
        return 0;
    }

    /* Setup NV ID for the device list records */
    id.systemID = NVINTF_SYSID_APP;
    id.itemID = CSF_NV_DEVICELIST_ID;
    subId = 0;
    actual = 0;
    /* Read the Entries */
    while((subId < CSF_MAX_DEVICELIST_IDS) && (actual < n))
    {
        uint8_t stat;

        id.subID = subId;
        /* Read Device Information from NV */
        stat = pNV->readItem(id, 0,
                             sizeof(tmp),
                             &tmp);
        if(stat == NVINTF_SUCCESS)
        {
            pThis->devInfo = tmp.devInfo;
            pThis->capInfo = tmp.capInfo;
            actual++;
            pThis++;
        }
        subId++;
     }

    /* return actual number of devices connected */
    return actual;
}

void CSF_LINUX_USE_THESE_FUNCTIONS(void);
void CSF_LINUX_USE_THESE_FUNCTIONS(void)
{
    /* (void)started; */
#if defined(TEST_REMOVE_DEVICE)
    (void)removeTheFirstDevice;
#endif
    (void)removeBlackListItem;
    (void)processKeyChangeCallback;
    (void)permitJoining;
}

const char *CSF_cllc_statename(Cllc_states_t s)
{
    const char *cp;
    switch(s)
    {
    default:
        cp = "unknown";
        break;
    case Cllc_states_initWaiting:
        cp = "initWaiting";
        break;
    case Cllc_states_startingCoordinator:
        cp = "startingCoordinator";
        break;
    case Cllc_states_initRestoringCoordinator:
        cp = "initRestoringCoordinator";
        break;
    case Cllc_states_started:
        cp = "started";
        break;
    case Cllc_states_restored:
        cp = "restored";
        break;
    case Cllc_states_joiningAllowed:
        cp = "joiningAllowed";
        break;
    case Cllc_states_joiningNotAllowed:
        cp = "joiningNotAllowed";
        break;
    }
    return cp;
}

/*!
 The appsrv module calls this function to send config request
 to a device over the air

 Public function defined in csf_linux.h
 */
extern uint8_t Csf_sendConfigRequest( ApiMac_sAddr_t *pDstAddr,
                uint16_t frameControl,
                uint32_t reportingInterval,
                uint32_t pollingInterval)
{
    return Collector_sendConfigRequest( pDstAddr,
                frameControl,
                reportingInterval,
                pollingInterval);
}

/*!
 The appsrv module calls this function to send a led toggle request
 to a device over the air

 Public function defined in csf_linux.h
 */
extern uint8_t Csf_sendToggleLedRequest(
                ApiMac_sAddr_t *pDstAddr)
{
    return Collector_sendToggleLedRequest(pDstAddr);
}

/*!
 The appsrv module calls this function to send a generic request
 to a device over the air

 Public function defined in csf_linux.h
 */
 extern uint8_t Csf_sendGenericRequest(
    ApiMac_sAddr_t *pDstAddr)
{
return Collector_sendGenericRequest(pDstAddr);
}

/*
 * Public function in csf_linux.h
 * Gateway front end uses this to get the current state.
 */
Cllc_states_t Csf_getCllcState(void)
{
    return savedCllcState;
}

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

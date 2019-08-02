/******************************************************************************

 @file  util.c

 @brief Utility functions commonly used by TIMAC applications

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

#define UTIL_SADDR_EXT_LEN  8

/******************************************************************************
 Includes
 *****************************************************************************/

#include "compiler.h"
#include <string.h>
#include <stdint.h>
#include "hlos_specific.h"
#include "util.h"


/*!
 Get the high byte of a uint16_t variable

 Public function defined in util.h
 */
uint8_t Util_hiUint16(uint16_t a)
{
    return((a >> 8) & 0xFF);
}

/*!
 Get the low byte of a uint16_t variable

 Public function defined in util.h
 */
uint8_t Util_loUint16(uint16_t a)
{
    return((a) & 0xFF);
}

/*!
 Build a uint16_t out of 2 uint8_t variables

 Public function defined in util.h
 */
uint16_t Util_buildUint16(uint8_t loByte, uint8_t hiByte)
{
    return((uint16_t)(((loByte) & 0x00FF) + (((hiByte) & 0x00FF) << 8)));
}

/*!
 Build a uint32_t out of 4 uint8_t variables

 Public function defined in util.h
 */
uint32_t Util_buildUint32(uint8_t byte0, uint8_t byte1, uint8_t byte2,
                            uint8_t byte3)
{
    return((uint32_t)((uint32_t)((byte0) & 0x00FF) +
                     ((uint32_t)((byte1) & 0x00FF) << 8) +
                     ((uint32_t)((byte2) & 0x00FF) << 16) +
                     ((uint32_t)((byte3) & 0x00FF) << 24)));
}

/*!
 Pull 1 uint8_t out of a uint32_t

 Public function defined in util.h
 */
uint8_t Util_breakUint32(uint32_t var, int byteNum)
{
    return(uint8_t)((uint32_t)(((var) >> ((byteNum) * 8)) & 0x00FF));
}

/*!
 Build a uint16_t from a uint8_t array

 Public function defined in util.h
 */
uint16_t Util_parseUint16(uint8_t *pArray)
{
    return(Util_buildUint16(pArray[0], pArray[1]));
}

/*!
 Build a uint32_t from a uint8_t array

 Public function defined in util.h
 */
uint32_t Util_parseUint32(uint8_t *pArray)
{
    return(Util_buildUint32(pArray[0], pArray[1], pArray[2], pArray[3]));
}

/*!
 Break and buffer a uint16_t value - LSB first

 Public function defined in util.h
 */
uint8_t *Util_bufferUint16(uint8_t *pBuf, uint16_t val)
{
    *pBuf++ = Util_loUint16(val);
    *pBuf++ = Util_hiUint16(val);

    return(pBuf);
}

/*!
 Break and buffer a uint32_t value - LSB first

 Public function defined in util.h
 */
uint8_t *Util_bufferUint32(uint8_t *pBuf, uint32_t val)
{
    *pBuf++ = Util_breakUint32(val, 0);
    *pBuf++ = Util_breakUint32(val, 1);
    *pBuf++ = Util_breakUint32(val, 2);
    *pBuf++ = Util_breakUint32(val, 3);

    return(pBuf);
}

/*!
  Utility function to clear an event

 Public function defined in util.h
 */
void Util_clearEvent(uint16_t *pEvent, uint16_t event)
{
    _ATOMIC_global_lock();
    /* Clear the event */
    *pEvent &= ~(event);
    
    _ATOMIC_global_unlock();
}

/*!
  Utility function to set an event

 Public function defined in util.h
 */
void Util_setEvent(uint16_t *pEvent, uint16_t event)
{
    _ATOMIC_global_lock();

    /* Set the event */
    *pEvent |= event;

    _ATOMIC_global_unlock();
}

/*!
  Utility function to copy the extended address

 Public function defined in util.h
 */
void Util_copyExtAddr(void *pSrcAddr, void *pDstAddr)
{
    memcpy(pSrcAddr, pDstAddr, (UTIL_SADDR_EXT_LEN));
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

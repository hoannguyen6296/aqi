#!/bin/bash

NV="../prebuilt/nv-simulation.bin"

if [ -f $NV ] ; then
  rm $NV
  echo "NV erased"
fi

exit 0
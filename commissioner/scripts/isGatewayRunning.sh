#!/bin/bash

if [ -d "/proc/${1}" ]
then
  echo "Yes"
  exit 0
else
  echo "No"
  exit 1
fi
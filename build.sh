#!/bin/bash

pnpm build
pnpm m3u
cp -f ./public/index.* ./public/style.css m3u/

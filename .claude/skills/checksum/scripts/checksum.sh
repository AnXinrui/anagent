#!/usr/bin/env bash
cd "$(dirname "$0")/.."
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum data.txt | cut -c1-8
else
  shasum -a 256 data.txt | cut -c1-8
fi

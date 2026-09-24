#!/usr/bin/env sh
# Cuts the Geist variable fonts down to what the site's text needs: Latin, the accents of
# Portuguese, the typographic marks, arrows and the check mark. Half the bytes of the full fonts,
# in front of every first paint. Needs fonttools (pip install fonttools brotli).
set -e
cd "$(dirname "$0")/.."
RANGES='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-0301,U+0303,U+0327,U+2000-206F,U+2074,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+2713,U+FEFF,U+FFFD'
for face in sans mono; do
  case $face in sans) src=node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2;; mono) src=node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2;; esac
  pyftsubset "$src" --unicodes="$RANGES" --flavor=woff2 --layout-features='*' --no-hinting --desubroutinize --output-file="src/assets/fonts/geist-$face.woff2"
  ls -l "src/assets/fonts/geist-$face.woff2"
done

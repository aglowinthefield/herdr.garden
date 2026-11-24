#!/bin/sh
# Install herdr.garden modules into the Herdr app's folder.
#   ./install.sh themes             install every theme
#   ./install.sh themes nord dracula install some
#   ./install.sh tab-names          install a mod from mods/
set -eu

here=$(cd "$(dirname "$0")" && pwd)
home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}

usage() { sed -n '2,5p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

[ $# -ge 1 ] || usage 1
module=$1; shift

case $module in
  themes)
    mkdir -p "$home/themes"
    if [ $# -eq 0 ]; then
      set -- $(cd "$here/themes" && ls *.json | sed 's/\.json$//')
    fi
    for name in "$@"; do
      src="$here/themes/$name.json"
      [ -f "$src" ] || { echo "no theme named $name" >&2; exit 1; }
      cp "$src" "$home/themes/"
      echo "installed $name"
    done
    ;;
  -h|--help) usage ;;
  *)
    src="$here/mods/$module"
    [ -d "$src" ] || { echo "unknown module: $module" >&2; usage 1; }
    mkdir -p "$home/mods/$module"
    for f in "$src"/*; do
      case $f in *.test.js) continue ;; esac
      cp "$f" "$home/mods/$module/"
    done
    echo "installed $module"
    ;;
esac

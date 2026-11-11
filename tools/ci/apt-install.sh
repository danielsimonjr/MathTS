#!/usr/bin/env bash
# Robust apt-get update/install for GitHub Actions ubuntu runners when the
# configured azure apt mirror fails DNS or fetch. Tries current sources first,
# then rewrites to archive.ubuntu.com / security.ubuntu.com and retries.
set -euo pipefail

readonly OFFICIAL_ARCHIVE="http://archive.ubuntu.com/ubuntu"
readonly OFFICIAL_SECURITY="http://security.ubuntu.com/ubuntu"

APT_OPTS=(
  -o Acquire::Retries=3
  -o Acquire::http::Timeout=30
  -o Acquire::https::Timeout=30
)

MIRRORS_SWITCHED=0

log() {
  printf 'apt-install.sh: %s\n' "$*" >&2
}

apt_output_is_retriable() {
  local logfile=$1
  grep -qiE \
    'Could not resolve|Temporary failure resolving|Temporary failure in name resolution|Failed to fetch|Connection timed out|Connection failed|Network is unreachable|mirrorfile.*failure|Mirror sync in progress|Clearsigned file .*not valid' \
    "$logfile"
}

run_apt_get() {
  local logfile
  logfile=$(mktemp)
  local rc=0
  if ! apt-get "${APT_OPTS[@]}" "$@" 2>&1 | tee "$logfile"; then
    rc=$?
    if apt_output_is_retriable "$logfile"; then
      rm -f "$logfile"
      return 100
    fi
    rm -f "$logfile"
    return "$rc"
  fi
  rm -f "$logfile"
  return 0
}

switch_to_official_mirrors() {
  if [[ $MIRRORS_SWITCHED -eq 1 ]]; then
    return 0
  fi
  MIRRORS_SWITCHED=1
  log "switching apt sources to official Ubuntu mirrors"

  if [[ -f /etc/apt/sources.list.d/ubuntu.sources ]]; then
    local bak="/etc/apt/sources.list.d/ubuntu.sources.mathts-ci-bak"
    if [[ ! -f $bak ]]; then
      cp -p /etc/apt/sources.list.d/ubuntu.sources "$bak"
    fi
    awk -v archive="$OFFICIAL_ARCHIVE" -v security="$OFFICIAL_SECURITY" '
      BEGIN { suites = "" }
      /^$/ { suites = ""; print; next }
      /^Suites:/ { suites = $0; print; next }
      /^URIs:/ {
        if (suites ~ /(^|[[:space:]])[^[:space:]]*-security([[:space:]]|$)/) {
          print "URIs: " security
        } else {
          print "URIs: " archive
        }
        next
      }
      { print }
    ' "$bak" > /etc/apt/sources.list.d/ubuntu.sources
  fi

  local f
  for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list; do
    [[ -f $f ]] || continue
    [[ $f == *mathts-ci-bak ]] && continue
    local list_bak="${f}.mathts-ci-bak"
    if [[ ! -f $list_bak ]]; then
      cp -p "$f" "$list_bak"
    fi
    sed -E \
      -e "s|mirror\\+file:/etc/apt/apt-mirrors\\.txt|${OFFICIAL_ARCHIVE}|g" \
      -e "s|https?://[^ ]*\\.archive\\.ubuntu\\.com/ubuntu|${OFFICIAL_ARCHIVE}|g" \
      -e "s|https?://security\\.ubuntu\\.com/ubuntu|${OFFICIAL_SECURITY}|g" \
      "$list_bak" >"$f"
  done

  if [[ -f /etc/apt/apt-mirrors.txt ]]; then
    if [[ ! -f /etc/apt/apt-mirrors.txt.mathts-ci-bak ]]; then
      cp -p /etc/apt/apt-mirrors.txt /etc/apt/apt-mirrors.txt.mathts-ci-bak
    fi
    printf '%s\n' "$OFFICIAL_ARCHIVE" >/etc/apt/apt-mirrors.txt
  fi
}

apt_get_with_fallback() {
  local rc=0
  if ! run_apt_get "$@"; then
    rc=$?
    if [[ $rc -ne 100 ]]; then
      return "$rc"
    fi
    switch_to_official_mirrors
    run_apt_get "$@" 
  fi
}

do_update() {
  apt_get_with_fallback update -y
}

do_install() {
  local packages=("$@")
  if [[ ${#packages[@]} -eq 0 ]]; then
    log "install: no packages specified"
    return 2
  fi
  do_update
  local rc=0
  if ! run_apt_get install -y --no-install-recommends "${packages[@]}"; then
    rc=$?
    if [[ $rc -ne 100 ]]; then
      return "$rc"
    fi
    switch_to_official_mirrors
    do_update
    run_apt_get install -y --no-install-recommends "${packages[@]}"
  fi
}

# Playwright install-deps (and --dry-run) invoke apt-get directly; this entry
# point is used from tools/ci/wrappers/apt-get on PATH.
forward_apt_get() {
  if [[ ${1-} == update ]]; then
    shift
    apt_get_with_fallback update "$@"
    return
  fi
  if [[ ${1-} == install ]]; then
    shift
    apt_get_with_fallback install "$@"
    return
  fi
  run_apt_get "$@"
}

usage() {
  cat >&2 <<'EOF'
Usage:
  apt-install.sh update
  apt-install.sh install <pkg> [<pkg>...]
  apt-install.sh apt-get-forward <apt-get args...>
EOF
  return 2
}

main() {
  if [[ ${1-} == "" ]]; then
    usage
  fi
  case $1 in
    update)
      do_update
      ;;
    install)
      shift
      do_install "$@"
      ;;
    apt-get-forward)
      shift
      forward_apt_get "$@"
      ;;
    -h | --help | help)
      usage
      ;;
    *)
      log "unknown command: $1"
      usage
      ;;
  esac
}

main "$@"

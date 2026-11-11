#!/usr/bin/env bash
# Robust apt-get update/install for GitHub Actions ubuntu runners when the
# configured azure apt mirror fails DNS or fetch. Tries mirror+file sources
# first, then drops azure.archive.ubuntu.com from /etc/apt/apt-mirrors.txt so
# apt fails over to archive.ubuntu.com / security.ubuntu.com.
set -euo pipefail

readonly APT_MIRRORS_FILE=/etc/apt/apt-mirrors.txt
readonly OFFICIAL_ARCHIVE="http://archive.ubuntu.com/ubuntu/"
readonly OFFICIAL_SECURITY="http://security.ubuntu.com/ubuntu/"

APT_OPTS=(
  -o Acquire::Retries=3
  -o Acquire::http::Timeout=30
  -o Acquire::https::Timeout=30
)

MIRRORS_SWITCHED=0

log() {
  printf 'apt-install.sh: %s\n' "$*" >&2
}

apt_log_is_retriable() {
  local logfile=$1
  grep -qiE \
    'Could not resolve|Temporary failure resolving|Temporary failure in name resolution|Failed to fetch|Connection timed out|Connection failed|Network is unreachable|mirrorfile.*failure|Mirror sync in progress|Clearsigned file .*not valid|Some index files failed to download|Failed to fetch mirror|mirror\\+file:/etc/apt/apt-mirrors\\.txt|azure\\.archive\\.ubuntu\\.com' \
    "$logfile"
}

apt_log_has_install_fetch_errors() {
  local logfile=$1
  grep -qE '^E: Failed to fetch|^E: Unable to fetch some archives' "$logfile"
}

run_apt_get() {
  local logfile
  logfile=$(mktemp)
  apt-get "${APT_OPTS[@]}" "$@" 2>&1 | tee "$logfile"
  local rc=${PIPESTATUS[0]}

  if [[ $rc -eq 0 ]]; then
    if apt_log_is_retriable "$logfile" || apt_log_has_install_fetch_errors "$logfile"; then
      rc=100
    fi
  elif apt_log_is_retriable "$logfile" || apt_log_has_install_fetch_errors "$logfile"; then
    rc=100
  fi

  if [[ $rc -eq 100 ]]; then
    rm -f "$logfile"
    return 100
  fi
  if [[ $rc -ne 0 ]]; then
    rm -f "$logfile"
    return "$rc"
  fi
  rm -f "$logfile"
  return 0
}

ensure_official_mirrors_in_list() {
  if ! grep -qi 'archive\.ubuntu\.com' "$APT_MIRRORS_FILE"; then
    printf '%s\tpriority:1\n' "$OFFICIAL_ARCHIVE" >>"$APT_MIRRORS_FILE"
  fi
  if ! grep -qi 'security\.ubuntu\.com' "$APT_MIRRORS_FILE"; then
    printf '%s\tpriority:2\n' "$OFFICIAL_SECURITY" >>"$APT_MIRRORS_FILE"
  fi
}

switch_to_official_mirrors() {
  if [[ $MIRRORS_SWITCHED -eq 1 ]]; then
    return 0
  fi
  MIRRORS_SWITCHED=1
  log "dropping unreachable entries from ${APT_MIRRORS_FILE} and preferring official Ubuntu archives"

  # Ubuntu 24.04+ runners point URIs: mirror+file:/etc/apt/apt-mirrors.txt in
  # deb822 ubuntu.sources — edit the mirror list, not ubuntu.sources (runner-images).
  if [[ -f $APT_MIRRORS_FILE ]]; then
    local bak="${APT_MIRRORS_FILE}.mathts-ci-bak"
    if [[ ! -f $bak ]]; then
      cp -p "$APT_MIRRORS_FILE" "$bak"
    fi
    grep -vi 'azure\.archive\.ubuntu\.com' "$bak" >"$APT_MIRRORS_FILE" || true
    ensure_official_mirrors_in_list
  else
    log "warning: ${APT_MIRRORS_FILE} missing; writing official mirrors"
    printf '%s\tpriority:1\n' "$OFFICIAL_ARCHIVE" >"$APT_MIRRORS_FILE"
    printf '%s\tpriority:2\n' "$OFFICIAL_SECURITY" >>"$APT_MIRRORS_FILE"
  fi

  # Legacy one-line sources (ubuntu-22.04 and partial configs): replace azure
  # hosts with the official archive URI.
  local f
  for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list; do
    [[ -f $f ]] || continue
    [[ $f == *mathts-ci-bak ]] && continue
    if grep -q 'azure\.archive\.ubuntu\.com' "$f"; then
      local list_bak="${f}.mathts-ci-bak"
      if [[ ! -f $list_bak ]]; then
        cp -p "$f" "$list_bak"
      fi
      sed -E \
        -e "s|https?://azure\\.archive\\.ubuntu\\.com/ubuntu/?|${OFFICIAL_ARCHIVE}|g" \
        -e "s|mirror\\+file:/etc/apt/apt-mirrors\\.txt|${OFFICIAL_ARCHIVE}|g" \
        "$list_bak" >"$f"
    fi
  done

  # If a previous version of this script rewrote deb822 URIs, restore mirror+file.
  local sources=/etc/apt/sources.list.d/ubuntu.sources
  if [[ -f ${sources}.mathts-ci-bak ]]; then
    if ! grep -q 'mirror+file:/etc/apt/apt-mirrors.txt' "$sources" 2>/dev/null; then
      cp -p "${sources}.mathts-ci-bak" "$sources"
    fi
  fi
}

apt_get_with_fallback() {
  local rc=0
  run_apt_get "$@" || rc=$?
  if [[ $rc -eq 0 ]]; then
    return 0
  fi
  if [[ $rc -ne 100 ]]; then
    return "$rc"
  fi
  switch_to_official_mirrors
  run_apt_get "$@" || rc=$?
  [[ $rc -eq 0 ]]
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
  run_apt_get install -y --no-install-recommends "${packages[@]}" || rc=$?
  if [[ $rc -eq 0 ]]; then
    return 0
  fi
  if [[ $rc -ne 100 ]]; then
    return "$rc"
  fi
  switch_to_official_mirrors
  do_update
  run_apt_get install -y --no-install-recommends "${packages[@]}" || rc=$?
  [[ $rc -eq 0 ]]
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

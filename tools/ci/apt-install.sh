#!/usr/bin/env bash
# Robust apt-get update/install for GitHub Actions ubuntu runners when the
# configured apt mirror fails DNS or fetch. Tries the configured mirror first,
# then rewrites legacy apt-mirrors.txt / one-line sources and deb822
# ubuntu.sources so later attempts use archive.ubuntu.com and
# security.ubuntu.com. A non-retriable apt failure is returned as apt's own
# exit code. Nothing here is optional: a failed install fails the caller.
set -euo pipefail

APT_ETC="${MATHTS_APT_ETC:-/etc/apt}"
readonly APT_ETC
readonly APT_MIRRORS_FILE="${APT_ETC}/apt-mirrors.txt"
readonly OFFICIAL_ARCHIVE="https://archive.ubuntu.com/ubuntu/"
readonly OFFICIAL_SECURITY="https://security.ubuntu.com/ubuntu/"
readonly US_ARCHIVE="https://us.archive.ubuntu.com/ubuntu/"
readonly AZURE_MIRROR_HOST=azure.archive.ubuntu.com
readonly ARCHIVE_MIRROR_HOST=archive.ubuntu.com
readonly RETRY_SLEEP="${MATHTS_APT_RETRY_SLEEP:-5}"

# Match GitHub runner-images apt failover timings (see configure-apt.sh).
# These are shorter than apt's defaults, not longer.
APT_OPTS=(
  -o Acquire::Retries=2
  -o Acquire::http::Timeout=15
  -o Acquire::https::Timeout=15
)

MIRRORS_SWITCHED=0
US_MIRROR_ADDED=0

log() {
  printf 'apt-install.sh: %s\n' "$*" >&2
}

apt_log_is_retriable() {
  local logfile=$1
  grep -qiE \
    'Could not resolve|Temporary failure resolving|Temporary failure in name resolution|Failed to fetch|Connection timed out|Connection failed|Network is unreachable|mirrorfile.*failure|Mirror sync in progress|Clearsigned file .*not valid|Some index files failed to download|Failed to fetch mirror' \
    "$logfile"
}

apt_log_has_install_fetch_errors() {
  local logfile=$1
  grep -qE '^E: Failed to fetch|^E: Unable to fetch some archives' "$logfile"
}

host_resolves() {
  local host=$1
  getent ahostsv4 "$host" &>/dev/null
}

ensure_apt_dns() {
  if host_resolves "$ARCHIVE_MIRROR_HOST" || host_resolves "$AZURE_MIRROR_HOST"; then
    return 0
  fi
  local resolv=/etc/resolv.conf
  log "ubuntu archive hosts do not resolve via system DNS; using public resolvers"
  local bak="${resolv}.mathts-ci-bak"
  if [[ ! -f $bak ]]; then
    cp -p "$resolv" "$bak"
  fi
  {
    printf 'nameserver 8.8.8.8\n'
    printf 'nameserver 1.1.1.1\n'
  } >"$resolv"
}

maybe_preflight_drop_azure() {
  if [[ $MIRRORS_SWITCHED -eq 1 ]]; then
    return 0
  fi
  if host_resolves "$AZURE_MIRROR_HOST"; then
    return 0
  fi
  log "${AZURE_MIRROR_HOST} does not resolve; switching to official mirrors before apt-get"
  switch_to_official_mirrors
  if ! host_resolves "$ARCHIVE_MIRROR_HOST"; then
    add_us_archive_mirror
  fi
}

# Runs apt-get. Returns 0 on success, 101 when the failure is a mirror/DNS/fetch
# problem worth a fallback, otherwise apt-get's own status. 101 is not an apt
# status (apt uses 100 for both fetch errors and missing packages), so the
# caller can propagate a real 100 unchanged. A zero exit is success even if
# the log names a mirror host (Hit lines do that).
run_apt_get() {
  local logfile rc
  logfile=$(mktemp)
  # Caller disables set -e for this function. A non-zero return must not
  # re-enable it: bash would then exit before the fallback loop runs.
  apt-get "${APT_OPTS[@]}" "$@" >"$logfile" 2>&1
  rc=$?
  cat "$logfile" >&2
  if [[ $rc -eq 0 ]]; then
    rm -f "$logfile"
    return 0
  fi
  if apt_log_is_retriable "$logfile" || apt_log_has_install_fetch_errors "$logfile"; then
    rm -f "$logfile"
    return 101
  fi
  rm -f "$logfile"
  return "$rc"
}

ensure_official_mirrors_in_list() {
  if ! grep -qi 'archive\.ubuntu\.com/ubuntu' "$APT_MIRRORS_FILE"; then
    printf '%s\tpriority:1\n' "$OFFICIAL_ARCHIVE" >>"$APT_MIRRORS_FILE"
  fi
  if ! grep -qi 'security\.ubuntu\.com' "$APT_MIRRORS_FILE"; then
    printf '%s\tpriority:2\n' "$OFFICIAL_SECURITY" >>"$APT_MIRRORS_FILE"
  fi
}

add_us_archive_mirror() {
  if [[ $US_MIRROR_ADDED -eq 1 ]]; then
    return 0
  fi
  US_MIRROR_ADDED=1
  log "adding ${US_ARCHIVE} to ${APT_MIRRORS_FILE}"
  if [[ ! -f $APT_MIRRORS_FILE ]]; then
    printf '%s\tpriority:1\n' "$US_ARCHIVE" >"$APT_MIRRORS_FILE"
    return 0
  fi
  if ! grep -qi 'us\.archive\.ubuntu\.com' "$APT_MIRRORS_FILE"; then
    printf '%s\tpriority:1\n' "$US_ARCHIVE" >>"$APT_MIRRORS_FILE"
  fi
}

rewrite_one_line_sources() {
  local f list_bak
  for f in "${APT_ETC}/sources.list" "${APT_ETC}/sources.list.d/"*.list; do
    [[ -f $f ]] || continue
    [[ $f == *mathts-ci-bak ]] && continue
    if ! grep -q 'azure\.archive\.ubuntu\.com\|mirror+file:/etc/apt/apt-mirrors\.txt' "$f"; then
      continue
    fi
    list_bak="${f}.mathts-ci-bak"
    if [[ ! -f $list_bak ]]; then
      cp -p "$f" "$list_bak"
    fi
    # Security pockets go to security.ubuntu.com; every other azure or
    # mirror+file line goes to archive.ubuntu.com. Applied per line so a
    # security line is not rewritten twice.
    local tmp
    tmp=$(mktemp)
    while IFS= read -r line || [[ -n $line ]]; do
      if [[ $line == *azure.archive.ubuntu.com* || $line == *'mirror+file:/etc/apt/apt-mirrors.txt'* ]]; then
        if [[ $line == *-security* ]]; then
          line=$(sed -E \
            -e "s|https?://azure\\.archive\\.ubuntu\\.com/ubuntu/?|${OFFICIAL_SECURITY}|g" \
            -e "s|mirror\\+file:/etc/apt/apt-mirrors\\.txt|${OFFICIAL_SECURITY}|g" <<<"$line")
        else
          line=$(sed -E \
            -e "s|https?://azure\\.archive\\.ubuntu\\.com/ubuntu/?|${OFFICIAL_ARCHIVE}|g" \
            -e "s|mirror\\+file:/etc/apt/apt-mirrors\\.txt|${OFFICIAL_ARCHIVE}|g" <<<"$line")
        fi
      fi
      printf '%s\n' "$line"
    done <"$list_bak" >"$tmp"
    mv "$tmp" "$f"
  done
}

# deb822 stanzas (ubuntu.sources). mirror+file stanzas are left pointing at
# apt-mirrors.txt, which switch_to_official_mirrors rewrites. Direct azure
# URIs are replaced per stanza.
rewrite_deb822_sources() {
  local f bak tmp
  for f in "${APT_ETC}/sources.list.d/"*.sources; do
    [[ -f $f ]] || continue
    [[ $f == *mathts-ci-bak ]] && continue
    if ! grep -q 'azure\.archive\.ubuntu\.com' "$f"; then
      continue
    fi
    bak="${f}.mathts-ci-bak"
    if [[ ! -f $bak ]]; then
      cp -p "$f" "$bak"
    fi
    tmp=$(mktemp)
    awk -v archive="$OFFICIAL_ARCHIVE" -v security="$OFFICIAL_SECURITY" '
      BEGIN { RS = ""; ORS = "" }
      {
        stanza = $0
        if (stanza ~ /azure\.archive\.ubuntu\.com/) {
          repl = (stanza ~ /-security/) ? security : archive
          gsub(/https?:\/\/azure\.archive\.ubuntu\.com\/ubuntu\/?/, repl, stanza)
        }
        if (NR > 1) {
          printf "\n\n"
        }
        printf "%s", stanza
      }
      END { if (NR > 0) printf "\n" }
    ' "$bak" >"$tmp"
    mv "$tmp" "$f"
  done
}

switch_to_official_mirrors() {
  if [[ $MIRRORS_SWITCHED -eq 1 ]]; then
    return 0
  fi
  MIRRORS_SWITCHED=1
  log "switching apt sources to archive.ubuntu.com and security.ubuntu.com"

  if [[ -f $APT_MIRRORS_FILE ]]; then
    local bak="${APT_MIRRORS_FILE}.mathts-ci-bak"
    if [[ ! -f $bak ]]; then
      cp -p "$APT_MIRRORS_FILE" "$bak"
    fi
    grep -vi 'azure\.archive\.ubuntu\.com' "$bak" >"$APT_MIRRORS_FILE" || true
    ensure_official_mirrors_in_list
  fi

  rewrite_one_line_sources
  rewrite_deb822_sources
}

apt_get_with_fallback() {
  ensure_apt_dns
  maybe_preflight_drop_azure
  local attempt rc=0
  for attempt in 1 2 3; do
    # A failed `if` has status 0 when it has no else, so the status has to be
    # captured from the call itself. set -e stays off only for that call.
    set +e
    run_apt_get "$@"
    rc=$?
    set -e
    if [[ $rc -eq 0 ]]; then
      return 0
    fi
    # 101 is the script's retriable signal. Any other status, including apt's
    # own 100 for "Unable to locate package", is returned unchanged.
    if [[ $rc -ne 101 ]]; then
      return "$rc"
    fi
    if [[ $MIRRORS_SWITCHED -eq 0 ]]; then
      switch_to_official_mirrors
      continue
    fi
    if [[ $attempt -eq 2 ]]; then
      add_us_archive_mirror
    fi
    if [[ $attempt -lt 3 ]]; then
      log "apt transient failure (attempt ${attempt}/3); retrying in ${RETRY_SLEEP}s"
      sleep "$RETRY_SLEEP"
      continue
    fi
    return 100
  done
  return "$rc"
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
  apt_get_with_fallback install -y --no-install-recommends "${packages[@]}"
}

usage() {
  cat >&2 <<'EOF'
Usage:
  apt-install.sh update
  apt-install.sh install <pkg> [<pkg>...]
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

#!/usr/bin/env bash
# Create the git tag and GitHub Release for every current public workspace
# version that this workflow owns.
#
# `changeset git-tag` (changesets v3; `changeset tag` is a deprecated alias)
# annotates a tag for each public package whose package.json version has no tag
# yet. It names the tag from the version in the WORKING TREE and puts it on HEAD.
# Tags are cut as github-actions[bot]. Releases are opened only for tags with
# that tagger, so tags cut by hand are left alone.
#
# The checkout must hold exactly the commit that was pushed. The changesets
# action rewrites package.json in the working tree (it commits through the API,
# so HEAD does not move). A tag cut after that names the NEXT version and lands
# on the commit before the version commit. So the workflow runs this script
# BEFORE the action, and the script refuses to tag when a package.json differs
# from HEAD. A tag it creates goes on the commit that set the version (HEAD, when
# this run is that commit's own run). It also checks every tag it creates:
# package.json at the tag target must hold the version in the tag name
# (check-new-tag-targets.mjs).
#
# A release created with GITHUB_TOKEN does not fire `release` for other
# workflows. Publishing is not this script's job.
set -euo pipefail

BOT_EMAIL="41898282+github-actions[bot]@users.noreply.github.com"
BOT_NAME="github-actions[bot]"

# What this step sees, so the log answers "which commit, which files differ".
echo "HEAD=$(git rev-parse HEAD)"
git status --short

bumped=false
if [ -n "${BEFORE_SHA:-}" ] && [[ "${BEFORE_SHA}" =~ ^[0-9a-f]{40}$ ]] && [ "${BEFORE_SHA}" != "0000000000000000000000000000000000000000" ]; then
  if ! git cat-file -e "${BEFORE_SHA}^{commit}" 2>/dev/null; then
    echo "::error::BEFORE_SHA ${BEFORE_SHA} is not a commit in this checkout"
    exit 1
  fi
  diff_out="$(git diff -U0 "${BEFORE_SHA}" HEAD -- ':(glob)**/package.json')"
  if printf '%s\n' "${diff_out}" | grep -E '^[+-][[:space:]]*"version":' >/dev/null; then
    bumped=true
  fi
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "versions_bumped=${bumped}" >> "${GITHUB_OUTPUT}"
fi
echo "versions_bumped=${bumped}"

list_packages() {
  node --input-type=module << 'EOF'
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = JSON.parse(readFileSync("package.json", "utf8"));
const dirs = [];
for (const pattern of root.workspaces) {
  if (pattern.endsWith("/*")) {
    const base = pattern.slice(0, -2);
    for (const name of readdirSync(base)) {
      const dir = join(base, name);
      if (statSync(dir).isDirectory() && existsSync(join(dir, "package.json"))) {
        dirs.push(dir);
      }
    }
  } else if (existsSync(join(pattern, "package.json"))) {
    dirs.push(pattern);
  }
}

for (const dir of dirs.sort()) {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  if (pkg.private || typeof pkg.name !== "string" || typeof pkg.version !== "string") {
    continue;
  }
  process.stdout.write(`${pkg.name}\t${pkg.version}\t${dir}\n`);
}
EOF
}

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "DRY_RUN: not tagging, pushing, or opening releases"
  list_packages
  exit 0
fi

# A package.json that differs from HEAD holds a version that no commit holds yet.
# A tag cut now would name that version and sit on the wrong commit.
if ! git diff --quiet HEAD -- ':(glob)**/package.json'; then
  echo "::error::A package.json differs from HEAD, so a tag cut now would name a version that no commit holds. Run this script before the changesets action."
  git diff --stat HEAD -- ':(glob)**/package.json'
  exit 1
fi

if [ "${RELEASES_ENABLED:-}" != "true" ]; then
  echo "RELEASES_ENABLED is not 'true'; not tagging, pushing tags, or opening GitHub releases."
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "versions_bumped=false" >> "${GITHUB_OUTPUT}"
  fi
  exit 0
fi

git config user.name "${BOT_NAME}"
git config user.email "${BOT_EMAIL}"

notes="$(mktemp)"
packages="$(mktemp)"
tags_before="$(mktemp)"
tags_after="$(mktemp)"
new_tags="$(mktemp)"
trap 'rm -f "${notes}" "${packages}" "${tags_before}" "${tags_after}" "${new_tags}"' EXIT
created=0

git for-each-ref --format='%(refname:strip=2)' refs/tags | LC_ALL=C sort > "${tags_before}"
bunx changeset git-tag
git for-each-ref --format='%(refname:strip=2)' refs/tags | LC_ALL=C sort > "${tags_after}"
LC_ALL=C comm -13 "${tags_before}" "${tags_after}" > "${new_tags}"

list_packages > "${packages}"

# A new tag is on HEAD. HEAD is not the version commit when an earlier run never tagged that
# version (its run was cancelled, for example). These tags are new in this run and not pushed
# yet, so put each one on the commit that set its version. No existing tag moves. `git log -S`
# does not match merge commits. With the squash merges this repository uses, the setter is the
# squash commit. After a true merge commit it would be the version commit on the side branch.
while IFS=$'\t' read -r name version dir; do
  tag="${name}@${version}"
  grep -qxF -- "${tag}" "${new_tags}" || continue
  setter="$(git log -1 --format=%H -S"\"version\": \"${version}\"" -- "${dir//\\//}/package.json")"
  if [ -n "${setter}" ] && [ "${setter}" != "$(git rev-parse "${tag}^{commit}")" ]; then
    echo "Tag ${tag}: moving the new tag from $(git rev-parse --short "${tag}^{commit}") to ${setter:0:8}, the commit that set ${version}."
    git tag -f -a "${tag}" -m "${tag}" "${setter}"
  fi
done < "${packages}"

# Tags that already existed are not examined here: they were cut before this check.
node "$(dirname "${BASH_SOURCE[0]}")/check-new-tag-targets.mjs" "${packages}" "${new_tags}"

while IFS=$'\t' read -r name version dir; do
  [ -n "${name}" ] || continue
  tag="${name}@${version}"
  if ! git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
    echo "::error::No git tag ${tag} after changeset git-tag"
    exit 1
  fi

  email="$(git for-each-ref --format='%(taggeremail)' "refs/tags/${tag}")"
  if [ "${email}" != "<${BOT_EMAIL}>" ]; then
    echo "Leaving ${tag} alone (tagger ${email:-none})."
    continue
  fi

  git push origin "refs/tags/${tag}"

  if gh release view "${tag}" >/dev/null 2>&1; then
    echo "GitHub release ${tag} already exists."
    continue
  fi

  if [ -f "${dir}/CHANGELOG.md" ]; then
    awk -v ver="${version}" '
      $0 == "## " ver { found = 1; print; next }
      found && /^## / { exit }
      found { print }
    ' "${dir}/CHANGELOG.md" > "${notes}"
  else
    : > "${notes}"
  fi
  if [ ! -s "${notes}" ]; then
    printf 'Release %s\n' "${tag}" > "${notes}"
  fi

  gh release create "${tag}" \
    --title "${tag}" \
    --notes-file "${notes}" \
    --latest=false \
    --verify-tag
  created=$((created + 1))
  echo "Opened GitHub release ${tag}"
done < "${packages}"

echo "Opened ${created} GitHub release(s)."
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Package tags and GitHub releases"
    echo
    echo "- versions bumped in this push: \`${bumped}\`"
    echo "- GitHub releases opened: ${created}"
    echo
    echo "Releases created here use \`GITHUB_TOKEN\`, so they do not trigger the Publish workflow. Publish runs in this same workflow only when \`versions_bumped\` is true."
  } >> "${GITHUB_STEP_SUMMARY}"
fi

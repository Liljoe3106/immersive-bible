#!/usr/bin/env bash
# Build with GitHub Pages base and push dist/ to the gh-pages branch.
# (CI Actions workflow needs `workflow` OAuth scope; this script is the supported path.)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Building with GITHUB_PAGES=true …"
GITHUB_PAGES=true npm run build
cp -f dist/index.html dist/404.html

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -a dist/. "$TMP/"
cd "$TMP"
git init -b gh-pages
git config user.name "$(git -C "$ROOT" config user.name || echo 'Joe Sutcliffe')"
git config user.email "$(git -C "$ROOT" config user.email || echo 'joe@local')"
git add -A
git commit -m "Deploy Immersive Bible to GitHub Pages $(date -u +%Y-%m-%dT%H:%MZ)"
git remote add origin "$(git -C "$ROOT" remote get-url origin)"
git push -u origin gh-pages --force
echo "Live: https://liljoe3106.github.io/immersive-bible/"

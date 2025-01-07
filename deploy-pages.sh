#!/bin/sh

if [ -z "${OUT:-}" ] || [ -n "${OUT%%*/out/fogy}" ]; then
    echo "OUT='$OUT' not properly set" >&2
    exit 1
elif [ -z "${PRJROOT:-}" ]; then
    echo "PRJROOT='$PRJROOT' not properly set" >&2
    exit 1
fi

set -euo pipefail

LAST_COMMIT=$(git log --format="%h" -n 1)
LAST_BRANCH=$(git rev-parse --abbrev-ref HEAD)
GIT_REMOTE_URL="$(git remote get-url --push origin)"
rm -rf "$OUT/fogy-gh-page"
mkdir -p "$OUT/fogy-gh-page"
cd "$OUT/fogy-gh-page"

git -c init.defaultBranch=gh-page init --quiet
git config remote.origin.url "$GIT_REMOTE_URL"
git fetch --force origin \
    "refs/heads/gh-page:refs/remotes/origin/gh-page"
git reset --hard origin/gh-page

for path in "$PRJROOT/docs"/*; do
    case $(basename "$path") in
        fogy.js|css|lib) ;;
        *)
            echo "$path"
            cp -r "$path" .
            ;;
    esac
done
for path in "$PRJROOT/fogy.js" "$PRJROOT/css" "$PRJROOT/lib"; do
    echo "$path"
    cp -r "$path" .
done

message="auto build from $LAST_BRANCH#$LAST_COMMIT"
git add .
git commit -m "$message"
echo "$message" >&2
git push origin gh-page



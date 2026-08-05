#!/usr/bin/env bash
#
# push-to-main.sh
#
# Run this LOCALLY, from a clone where you have real push access to
# baieltaalaiuulu-create/Zhangak. It could not be run from the Claude Code
# session that built this branch — GitHub returned 403 on every push
# attempt to main from that environment (confirmed via two separate paths).
#
# What this does: pushes claude/zhangak-student-cabinet-49sl6z onto
# origin/main, OVERWRITING main's current history with this branch's.
#
# Why overwrite instead of a real merge: origin/main has diverged with a
# parallel set of commits (through at least `ead0d2b` at last check) that
# independently reimplement the same admin panel / RLS fixes this branch
# built — including one regression (an anon-key fallback in
# ensure-practice-test that silently reintroduces the RLS bug this branch
# fixed properly). A real three-way merge would mean resolving conflicts
# across dozens of overlapping files by hand. The explicit decision made
# earlier in this session was: keep this branch's version, discard main's
# parallel commits entirely. That's what this script does.
#
# If you'd rather do a real merge and keep pieces of both, don't run this —
# do it manually instead:
#   git fetch origin
#   git checkout -b reconcile-main origin/main
#   git merge claude/zhangak-student-cabinet-49sl6z
#   # resolve conflicts by hand, test, then push normally

set -euo pipefail

BRANCH="claude/zhangak-student-cabinet-49sl6z"
REMOTE="origin"
EXPECTED_REPO="baieltaalaiuulu-create/Zhangak"

# Sanity check: make sure this is actually run inside the right repo.
remote_url=$(git remote get-url "$REMOTE" 2>/dev/null || true)
if [[ "$remote_url" != *"$EXPECTED_REPO"* ]]; then
  echo "error: '$REMOTE' remote does not look like $EXPECTED_REPO (got: '$remote_url')." >&2
  echo "Run this from inside your local clone of the repo." >&2
  exit 1
fi

echo "==> Fetching latest from $REMOTE..."
git fetch "$REMOTE" main "$BRANCH"

echo "==> Checking out $BRANCH locally (tracking $REMOTE/$BRANCH)..."
git checkout -B "$BRANCH" "$REMOTE/$BRANCH"

CURRENT_MAIN=$(git rev-parse "$REMOTE/main")
echo "==> $REMOTE/main is currently at: $CURRENT_MAIN"
echo "==> Commits on $REMOTE/main NOT in $BRANCH (would be discarded by this push):"
git log --oneline "$REMOTE/main" "^$BRANCH" || true
echo

read -r -p "Overwrite $REMOTE/main with $BRANCH? This discards the commits listed above. [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted. Nothing was pushed."
  exit 1
fi

echo "==> Pushing $BRANCH onto $REMOTE/main (force-with-lease, protects against last-second changes)..."
git push --force-with-lease="main:$CURRENT_MAIN" "$REMOTE" "$BRANCH:main"

echo "==> Done. $REMOTE/main now matches $BRANCH."

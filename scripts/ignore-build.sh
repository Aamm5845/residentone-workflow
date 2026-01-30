#!/bin/bash

# Vercel Ignored Build Step
# Returns exit code 0 to skip build, 1 to proceed with build

echo "Checking if build should be skipped..."

# Always build on main branch
if [[ "$VERCEL_GIT_COMMIT_REF" == "main" || "$VERCEL_GIT_COMMIT_REF" == "master" ]]; then
  echo "✓ Main branch - proceeding with build"
  exit 1
fi

# Skip build if only these files changed
IGNORE_PATTERNS="*.md|*.txt|public/*.pdf|.gitignore|LICENSE|.vscode/*"

# Get changed files
CHANGED_FILES=$(git diff --name-only HEAD^ HEAD 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
  echo "✓ Could not determine changed files - proceeding with build"
  exit 1
fi

# Check if any non-ignorable files changed
for file in $CHANGED_FILES; do
  SKIP=false
  for pattern in ${IGNORE_PATTERNS//|/ }; do
    if [[ "$file" == $pattern ]]; then
      SKIP=true
      break
    fi
  done

  if [ "$SKIP" = false ]; then
    echo "✓ Found code changes in: $file - proceeding with build"
    exit 1
  fi
done

echo "○ Only documentation/static files changed - skipping build"
exit 0
// Build optimization test: 2026-01-30

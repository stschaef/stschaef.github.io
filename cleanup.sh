#!/usr/bin/env sh

# List of paths to keep
KEEP=(
  ".DS_Store"
  ".git"
  ".gitignore"
  ".gitmodules"
  "build.sh"
  "cleanup.sh"
  "CNAME"
)

# Convert the array into a pattern string for grep
KEEP_PATTERNS=$(printf "|%s" "${KEEP[@]}")
KEEP_PATTERNS=${KEEP_PATTERNS:1} # Remove the leading "|"

# Find all files and directories, exclude the ones to keep, and delete them
find . -mindepth 1 -maxdepth 1 | grep -vE "(${KEEP_PATTERNS//\./\\.})$" | xargs rm -rf

echo "Cleanup complete. Only the specified paths remain."

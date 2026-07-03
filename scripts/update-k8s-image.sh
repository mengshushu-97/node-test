#!/usr/bin/env sh
set -eu

APP_NAME="${APP_NAME:?APP_NAME is required}"
CONTAINER_NAME="${CONTAINER_NAME:-$APP_NAME}"
IMAGE="${IMAGE:?IMAGE is required}"
MANIFEST_FILE="${MANIFEST_FILE:?MANIFEST_FILE is required}"

python3 - "$MANIFEST_FILE" "$CONTAINER_NAME" "$IMAGE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
container_name = sys.argv[2]
image = sys.argv[3]

lines = path.read_text().splitlines(keepends=True)
in_containers = False
containers_indent = None
in_target_container = False
updated = False

for index, line in enumerate(lines):
    stripped = line.lstrip()
    indent = len(line) - len(stripped)

    if stripped.startswith("containers:"):
        in_containers = True
        containers_indent = indent
        in_target_container = False
        continue

    if in_containers and stripped.strip() and indent <= containers_indent:
        in_containers = False
        in_target_container = False

    if not in_containers:
        continue

    if stripped.startswith("- name: "):
        current_name = stripped.split(":", 1)[1].strip()
        in_target_container = current_name == container_name
        continue

    if in_target_container and stripped.startswith("image: "):
        line_ending = "\n" if line.endswith("\n") else ""
        lines[index] = " " * indent + f"image: {image}" + line_ending
        updated = True
        in_target_container = False
        break

if not updated:
    raise SystemExit(f"container {container_name!r} image not found in {path}")

path.write_text("".join(lines))
PY

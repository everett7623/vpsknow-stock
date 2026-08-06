#!/usr/bin/env python3
"""Production deploy via .env.deploy.local — never print secret values."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def load_deploy_env(path: Path) -> None:
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ[key.strip()] = value.strip().strip('"').strip("'")


def sh_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def redact(text: str, secrets: list[str]) -> str:
    out = text
    for secret in secrets:
        if secret:
            out = out.replace(secret, "***")
    return out


def write_out(text: str, secrets: list[str]) -> None:
    safe = redact(text, secrets)
    try:
        sys.stdout.write(safe)
    except UnicodeEncodeError:
        sys.stdout.buffer.write(safe.encode(sys.stdout.encoding or "utf-8", errors="replace"))
    sys.stdout.flush()


def main() -> int:
    env_path = Path(".env.deploy.local")
    if not env_path.exists():
        print("Missing .env.deploy.local", file=sys.stderr)
        return 1

    load_deploy_env(env_path)
    required = [
        "VPSKNOW_DEPLOY_HOST",
        "VPSKNOW_DEPLOY_PORT",
        "VPSKNOW_DEPLOY_USER",
        "VPSKNOW_DEPLOY_PASSWORD",
        "VPSKNOW_DEPLOY_PATH",
        "VPSKNOW_DEPLOY_COMPOSE_FILE",
    ]
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        print("Missing keys:", ",".join(missing), file=sys.stderr)
        return 1

    try:
        import paramiko
    except ImportError:
        print("paramiko is required", file=sys.stderr)
        return 1

    host = os.environ["VPSKNOW_DEPLOY_HOST"]
    port = int(os.environ["VPSKNOW_DEPLOY_PORT"])
    user = os.environ["VPSKNOW_DEPLOY_USER"]
    password = os.environ["VPSKNOW_DEPLOY_PASSWORD"]
    path = os.environ["VPSKNOW_DEPLOY_PATH"]
    compose = os.environ["VPSKNOW_DEPLOY_COMPOSE_FILE"]
    secrets = [password, host]

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("Connecting...")
    client.connect(
        hostname=host,
        port=port,
        username=user,
        password=password,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    print("Connected. Deploying...")

    remote = f"""
set -euo pipefail
cd {sh_quote(path)}
echo '==> git status'
git status -sb
echo '==> git pull --ff-only'
git pull --ff-only
echo '==> HEAD'
git log --oneline -3
echo '==> docker compose up -d --build'
docker compose -f {sh_quote(compose)} up -d --build
echo '==> compose ps'
docker compose -f {sh_quote(compose)} ps
echo '==> web logs tail'
docker compose -f {sh_quote(compose)} logs --tail=50 web
echo 'DEPLOY_OK'
"""

    _stdin, stdout, stderr = client.exec_command(remote, get_pty=True, timeout=1200)
    while True:
        line = stdout.readline()
        if not line:
            break
        write_out(line, secrets)

    exit_status = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace")
    if err:
        try:
            sys.stderr.write(redact(err, secrets))
        except UnicodeEncodeError:
            sys.stderr.buffer.write(
                redact(err, secrets).encode(sys.stderr.encoding or "utf-8", errors="replace")
            )
    client.close()
    print("exit_status=", exit_status)
    return exit_status


if __name__ == "__main__":
    raise SystemExit(main())

"""Collect a redacted production acceptance snapshot via .env.deploy.local."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from importlib.machinery import SourceFileLoader
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
dep = SourceFileLoader("dep", str(ROOT / "scripts" / "deploy-production.py")).load_module()


def main() -> int:
    env_path = ROOT / ".env.deploy.local"
    if not env_path.exists():
        print("Missing .env.deploy.local", file=sys.stderr)
        return 1

    dep.load_deploy_env(env_path)
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

    import paramiko

    host = os.environ["VPSKNOW_DEPLOY_HOST"]
    port = int(os.environ["VPSKNOW_DEPLOY_PORT"])
    user = os.environ["VPSKNOW_DEPLOY_USER"]
    password = os.environ["VPSKNOW_DEPLOY_PASSWORD"]
    path = os.environ["VPSKNOW_DEPLOY_PATH"]
    compose = os.environ["VPSKNOW_DEPLOY_COMPOSE_FILE"]
    secrets = [password, host]

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=host,
        port=port,
        username=user,
        password=password,
        timeout=45,
        banner_timeout=60,
        auth_timeout=45,
        allow_agent=False,
        look_for_keys=False,
    )

    remote = f"""
set -euo pipefail
cd {dep.sh_quote(path)}
COMPOSE={dep.sh_quote(compose)}
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "=== ACCEPTANCE_SNAPSHOT $TS ==="
echo "==> git HEAD"
git rev-parse --short HEAD
echo "==> compose ps"
docker compose -f "$COMPOSE" ps
echo "==> container stats (no-stream)"
docker stats --no-stream --format 'table {{{{.Name}}}}\\t{{{{.CPUPerc}}}}\\t{{{{.MemUsage}}}}\\t{{{{.MemPerc}}}}' $(docker compose -f "$COMPOSE" ps -q) || true
echo "==> disk"
df -h / | tail -1
echo "==> public health"
curl -sS -m 15 -o /tmp/vpsknow_health.json -w 'http=%{{http_code}}\\n' https://stock.vpsknow.com/api/health || true
cat /tmp/vpsknow_health.json 2>/dev/null || true
echo
echo "==> worker health"
docker compose -f "$COMPOSE" exec -T worker node -e "fetch('http://127.0.0.1:3001/health').then(async (r)=>{{console.log(await r.text()); process.exit(r.ok?0:1);}}).catch((e)=>{{console.error(String(e)); process.exit(1);}})" || true
echo "==> redis queue keys / lengths"
docker compose -f "$COMPOSE" exec -T redis redis-cli --scan --pattern 'bull:*:meta' | head -40 || true
docker compose -f "$COMPOSE" exec -T redis sh -c "for k in \\$(redis-cli --scan --pattern 'bull:*:wait' | head -40); do echo \\"\\$k \\$(redis-cli llen \\$k)\\"; done" || true
docker compose -f "$COMPOSE" exec -T redis sh -c "for k in \\$(redis-cli --scan --pattern 'bull:*:failed' | head -40); do echo \\"\\$k \\$(redis-cli zcard \\$k)\\"; done" || true
echo "==> db event counts (24h / 48h)"
docker compose -f "$COMPOSE" exec -T postgres psql -U vpsknow -d vpsknow_stock -v ON_ERROR_STOP=1 -c "
SELECT
  COUNT(*) FILTER (WHERE \\"detectedAt\\" >= NOW() - INTERVAL '24 hours') AS events_24h,
  COUNT(*) FILTER (WHERE \\"detectedAt\\" >= NOW() - INTERVAL '48 hours') AS events_48h,
  COUNT(*) FILTER (WHERE \\"detectedAt\\" >= NOW() - INTERVAL '24 hours' AND \\"eventType\\" = 'restock') AS restock_24h,
  COUNT(*) FILTER (WHERE \\"detectedAt\\" >= NOW() - INTERVAL '24 hours' AND \\"eventType\\" = 'sold_out') AS sold_out_24h,
  COUNT(*) FILTER (WHERE \\"detectedAt\\" >= NOW() - INTERVAL '24 hours' AND \\"eventType\\" = 'manual_override') AS manual_24h
FROM stock_events;
"
echo "==> recent restocks (12)"
docker compose -f "$COMPOSE" exec -T postgres psql -U vpsknow -d vpsknow_stock -c "
SELECT se.\\"detectedAt\\", se.\\"eventType\\", p.slug, pr.\\"planName\\", pr.location, se.notified
FROM stock_events se
JOIN products pr ON pr.id = se.\\"productId\\"
JOIN providers p ON p.id = pr.\\"providerId\\"
WHERE se.\\"eventType\\" IN ('restock', 'sold_out')
ORDER BY se.\\"detectedAt\\" DESC
LIMIT 12;
"
echo "==> telegram messages 24h"
docker compose -f "$COMPOSE" exec -T postgres psql -U vpsknow -d vpsknow_stock -c "
SELECT status, COUNT(*)
FROM telegram_messages
WHERE \\"sentAt\\" >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY status;
"
echo "==> provider product freshness"
docker compose -f "$COMPOSE" exec -T postgres psql -U vpsknow -d vpsknow_stock -c "
SELECT p.slug,
  COUNT(*) AS products,
  COUNT(*) FILTER (WHERE pr.\\"inStock\\") AS in_stock,
  MAX(pr.\\"lastCheckedAt\\") AS last_checked,
  COUNT(*) FILTER (WHERE pr.\\"lastCheckedAt\\" IS NULL OR pr.\\"lastCheckedAt\\" < NOW() - INTERVAL '30 minutes') AS stale_30m
FROM providers p
JOIN products pr ON pr.\\"providerId\\" = p.id
WHERE p.\\"isActive\\"
GROUP BY p.slug
ORDER BY stale_30m DESC, p.slug;
"
echo "==> worker log error/warn sample"
docker compose -f "$COMPOSE" logs --since=6h --tail=300 worker 2>/dev/null | grep -Ei 'error|warn|fail|403|challenge|paused|circuit' | tail -80 || true
echo "==> SNAPSHOT_OK"
"""

    _stdin, stdout, stderr = client.exec_command(remote, get_pty=True, timeout=180)
    while True:
        line = stdout.readline()
        if not line:
            break
        dep.write_out(line, secrets)

    exit_status = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace")
    if err:
        sys.stderr.write(dep.redact(err, secrets))
    client.close()
    print("exit_status=", exit_status)
    return exit_status


if __name__ == "__main__":
    raise SystemExit(main())

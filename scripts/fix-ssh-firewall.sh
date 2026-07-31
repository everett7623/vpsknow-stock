#!/bin/bash
# VPS 防火墙修复脚本 - 通过 Hetzner Console VNC 执行
# 用途: 修复 SSH 被 UFW 阻止的问题

echo "=== VPSKnow Stock VPS 防火墙修复 ==="
echo "执行时间: $(date)"
echo ""

# 方案 1: 完全禁用防火墙 (最快)
echo "方案 1: 禁用防火墙"
ufw disable
echo "UFW 已禁用"
echo ""

# 方案 2: 正确配置防火墙规则
echo "方案 2: 配置正确的防火墙规则"
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
echo ""

echo "=== 当前防火墙规则 ==="
ufw status numbered
echo ""

echo "=== SSH 服务状态 ==="
systemctl status ssh --no-pager -l
echo ""

echo "=== 监听端口检查 ==="
ss -tulpn | grep -E ':22|:80|:443'
echo ""

echo "=== 修复完成 ==="
echo "请在本地终端测试 SSH 连接:"
echo "  ssh root@168.119.246.220"
echo ""
echo "如果能连接,可选择重新启用防火墙:"
echo "  ufw enable"

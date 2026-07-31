# VNC Console 操作步骤

> 用途: 通过 Hetzner Console VNC 修复 SSH 访问
> 问题: UFW 防火墙配置错误,SSH 端口被阻止

---

## 🔴 问题原因

在配置防火墙时,UFW 命令执行顺序错误:

```bash
# 错误的执行顺序
ufw --force default deny incoming  # 1. 先拒绝所有入站
ufw --force enable                 # 2. 立即启用 (SSH 规则未生效)
ufw --force allow ssh              # 3. SSH 规则添加失败 (已断开连接)
```

**结果**: SSH 端口 22 被防火墙阻止,无法远程连接

---

## ✅ 解决方案: 通过 VNC 修复

### 步骤 1: 访问 Hetzner Console

1. 打开浏览器
2. 访问: **https://console.hetzner.cloud/**
3. 登录你的 Hetzner 账户
4. 选择项目
5. 找到 VPS: **Debian-2gb-falkenstein** (IP: 168.119.246.220)
6. 点击右上角的 **"Console"** 按钮

### 步骤 2: VNC 登录

VNC 窗口打开后,输入登录凭据:

```
debian login: root
Password: 9dyQogHUyAQ5uR
```

**注意**: 输入密码时不会显示任何字符,这是正常的

### 步骤 3: 执行修复命令

登录成功后,复制粘贴以下命令:

```bash
# 禁用防火墙 (最简单)
ufw disable

# 验证 SSH 服务正常
systemctl status ssh

# 查看监听端口
ss -tulpn | grep :22
```

**预期输出**:
```
Firewall stopped and disabled on system startup
● ssh.service - OpenBSD Secure Shell server
   Active: active (running)
tcp   LISTEN   0   128   0.0.0.0:22   0.0.0.0:*
```

### 步骤 4: 退出 VNC

```bash
exit
```

### 步骤 5: 测试 SSH 连接

在**本地终端** (不是 VNC) 测试:

```bash
ssh root@168.119.246.220
```

**如果成功连接**: ✅ 问题已解决!

---

## 🔧 (可选) 重新配置防火墙

如果希望启用防火墙,SSH 连接后执行:

```bash
# 正确的配置顺序
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw default deny incoming
ufw default allow outgoing
ufw enable

# 验证规则
ufw status numbered
```

**输出应该包含**:
```
Status: active

     To                         Action      From
     --                         ------      ----
[ 1] 22/tcp                     ALLOW IN    Anywhere         # SSH
[ 2] 80/tcp                     ALLOW IN    Anywhere         # HTTP
[ 3] 443/tcp                    ALLOW IN    Anywhere         # HTTPS
```

---

## 📝 快速命令参考

### 在 VNC 中执行 (修复 SSH)

```bash
ufw disable
systemctl status ssh
exit
```

### 在本地测试 (验证修复)

```bash
ssh root@168.119.246.220
```

### 在 SSH 中执行 (重新配置防火墙)

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## 🆘 故障排查

### 问题 1: VNC 无法打开

**解决**: 
- 刷新浏览器
- 尝试不同的浏览器 (Chrome/Firefox)
- 检查 VPS 是否正在运行 (状态应该是 "Running")

### 问题 2: 登录密码错误

**解决**:
- 确认密码: `9dyQogHUyAQ5uR`
- 密码输入时不显示字符是正常的
- 如果多次失败,等待 30 秒后重试

### 问题 3: SSH 仍然无法连接

**检查**:
```bash
# 在 VNC 中执行
ufw status
systemctl status ssh
ss -tulpn | grep :22
```

**如果 SSH 服务未运行**:
```bash
systemctl start ssh
systemctl enable ssh
```

---

## ✅ 修复完成后的任务

SSH 连接恢复后,继续部署流程:

```bash
# 1. 进入项目目录
cd /opt/vpsknow/vpsknow-stock

# 2. 拉取最新代码
git pull origin main

# 3. 重新构建
docker compose -f docker-compose.production.yml up -d --build

# 4. 运行数据库迁移 (添加 whmcsPid 字段)
docker compose -f docker-compose.production.yml exec worker \
  npx prisma db push

# 5. 查看服务状态
docker compose -f docker-compose.production.yml ps
```

---

**预计修复时间**: 5-10 分钟

**难度**: ⭐⭐☆☆☆ (简单)

---

> 📋 本指南遵循:`chinese-language.md` - 简体中文回复规则

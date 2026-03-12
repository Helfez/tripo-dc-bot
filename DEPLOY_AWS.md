# AWS EC2 部署流程

## 服务器信息

- IP: 54.193.12.241
- 域名: haozhening.jujubit.ai
- 系统: Ubuntu 24.04 (x86_64)
- SSH: `ssh -i ~/.ssh/jujubit-haozhening.pem ubuntu@54.193.12.241`

## 前置条件

- SSH 密钥文件 `jujubit-haozhening.pem` 放置于 `~/.ssh/` 并设置权限：
  ```bash
  chmod 400 ~/.ssh/jujubit-haozhening.pem
  ```
- 服务器已安装 Docker（含 Docker Compose）、Git
- GitHub 仓库已配置 Deploy Key（ED25519，存于服务器 `~/.ssh/id_ed25519`）

## 数据目录（重要）

服务器上持久化数据存放在以下位置，**不在 Git 仓库目录内**：

| 宿主机路径 | 容器内路径 | 用途 |
|---|---|---|
| Docker 命名卷 `pgdata` | `/var/lib/postgresql/data` | PostgreSQL 数据库 |
| `/data/testplatform` | `/app/data/testplatform` | 测试平台上传/结果图片 |

> **注意**: 数据库已由 SQLite 切换为 PostgreSQL，通过 Docker Compose 管理，数据存储在命名卷 `pgdata` 中。

## 部署步骤

### 1. SSH 连接服务器

```bash
ssh -i ~/.ssh/jujubit-haozhening.pem ubuntu@54.193.12.241
```

### 2. 克隆代码（首次部署）

```bash
git clone git@github.com:Helfez/tripo-dc-bot.git
cd tripo-dc-bot
```

首次部署还需创建数据目录：
```bash
sudo mkdir -p /data/testplatform/uploads /data/testplatform/results
```

### 3. 配置环境变量

在 `~/tripo-dc-bot/.env` 中写入以下内容（注意：Docker --env-file 不能带引号）：

```env
IS_TEST=
DISCORD_BOT_TOKEN=<your-discord-bot-token>
TRIPO_URL=https://www.tripo3d.ai
TRIPO_API_URL=https://api.tripo3d.ai
TRIPO_API_KEY=<your-tripo-api-key>
TRIPO_SHARE_URL=https://www.tripo3d.ai/preview?share=
REDIS_ADDR=
ROVER_API_KEY=
AIHUBMIX_API_KEY=<your-aihubmix-api-key>
POSTGRES_PASSWORD=<your-secure-password>

# AWS S3 (Image Pool)
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
AWS_BUCKET_NAME=jujubit-test-shop-creation
AWS_REGION=ap-southeast-1
S3_POOL_FOLDER=uploads/agentcase/
```

> **注意**: `DATABASE_URL` 不需要在 .env 中设置，docker-compose.yml 已自动配置指向 `db` 容器。

### 4. 使用 Docker Compose 部署

```bash
cd ~/tripo-dc-bot
docker compose up -d --build
```

这会同时启动 PostgreSQL 数据库和应用容器。

### 5. 查看日志

```bash
docker compose logs -f bot
```

启动成功应看到：
```
Logged in as JuJuBit Bot#3507!
Registering 3 global commands...
Global commands registered successfully
```

## 更新部署

```bash
ssh -i ~/.ssh/jujubit-haozhening.pem ubuntu@54.193.12.241

cd ~/tripo-dc-bot
git pull
docker compose up -d --build
docker compose logs -f bot
```

## PostgreSQL 备份

```bash
# 导出数据库
docker compose exec db pg_dump -U jujumon jujumon > backup_$(date +%Y%m%d).sql

# 恢复数据库
cat backup.sql | docker compose exec -T db psql -U jujumon jujumon
```

## 常用运维命令

```bash
# 查看容器状态
docker compose ps

# 查看最近日志
docker compose logs --tail 50 bot

# 重启应用（不丢数据）
docker compose restart bot

# 停止所有服务
docker compose down

# 停止并删除数据卷（危险！会丢失数据库数据）
# docker compose down -v

# 进入 PostgreSQL 命令行
docker compose exec db psql -U jujumon jujumon
```

## 注意事项

- 同一个 DISCORD_BOT_TOKEN 不能同时在多处运行，部署前确保 Zeabur 等其他环境已停止
- .env 文件用于 Docker --env-file，值不要加引号
- Redis 未配置时限流功能自动跳过，不影响核心功能
- PostgreSQL 数据存储在 Docker 命名卷 `pgdata` 中，`docker compose down` 不会删除数据，但 `docker compose down -v` 会

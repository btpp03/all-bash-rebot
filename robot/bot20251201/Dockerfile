FROM node:20-alpine3.20

# northflank使用

# 更改工作目录为 /app，这是标准的 Node.js 容器实践
WORKDIR /app

# 复制必要文件
# ----------------------------------------------------------------
# 重点修改：移除了 index.html，只复制 index.js 和 package.json
COPY index.js package.json ./
# ----------------------------------------------------------------
# 如果您使用了 bot_configs.json 进行持久化，也应该复制
# COPY bot_configs.json .

# 暴露端口 (保持您现有的 3000，Northflank 会自动处理映射)
EXPOSE 3000

# 1. 安装系统依赖
# 2. 安装项目依赖
# 3. 全局安装 PM2
RUN apk update && apk add --no-cache bash openssl curl && \
    npm install && \
    npm install -g pm2

# 4. 更改启动命令：使用 pm2-runtime 启动应用
# pm2-runtime 确保 PM2 在 Docker 环境中正确管理和重启崩溃的进程，大大提高稳定性。
CMD ["pm2-runtime", "start", "index.js", "--name", "mcplayer"]
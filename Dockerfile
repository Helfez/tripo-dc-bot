# 使用官方 Node.js 镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装 ts-node
RUN yarn global add ts-node typescript

# 复制依赖文件
COPY package.json yarn.lock ./

# 安装依赖
RUN yarn install --frozen-lockfile

# 复制源代码
COPY . .

# 启动命令
CMD ["yarn", "start"]

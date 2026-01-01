#!/bin/bash

# =================================================================
# tinyblog Linux 重启脚本
# 默认使用 PM2 进行管理
# =================================================================

APP_NAME="tinyblog"
PORT=3001

echo "正在拉取最新代码 (git pull)..."
if [ -d ".git" ]; then
    git pull
    echo "代码拉取完成。"
else
    echo "警告: 当前目录不是 Git 仓库，跳过 git pull。"
fi

echo "正在安装依赖 (npm install)..."
npm install --production

echo "正在尝试重启 $APP_NAME..."

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null
then
    echo "错误: 未检测到 PM2。请先安装: npm install -g pm2"
    exit 1
fi

# 检查进程是否存在
pm2 describe $APP_NAME > /dev/null 2>&1
RUNNING=$?

if [ $RUNNING -eq 0 ]; then
    echo "检测到正在运行的进程，执行重启..."
    pm2 restart $APP_NAME
else
    echo "未检测到运行中的进程，正在启动新实例..."
    pm2 start server.js --name "$APP_NAME" -- --port=$PORT
fi

# 显示状态
pm2 status $APP_NAME

echo "---------------------------------------------------"
echo "$APP_NAME 重启操作完成！"
echo "可以通过 'pm2 logs $APP_NAME' 查看实时日志。"
echo "---------------------------------------------------"

#!/usr/bin/env bash
# 启动集团作战地图（纯前端，端口 5188，监听 0.0.0.0）
# 用法：./start.sh        正式运行：先打包再启动（加载快，演示用这个）
#       ./start.sh dev    开发模式：改代码后页面自动刷新（首次加载较慢）
#       ./start.sh stop   停止
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG="$ROOT/.logs"; mkdir -p "$LOG"
PORT=5188

stop() {
  pkill -f "vite --host 0.0.0.0 --port $PORT" 2>/dev/null || true
  pkill -f "vite preview" 2>/dev/null || true
}

if [ "$1" = "stop" ]; then stop; echo "已停止"; exit 0; fi
stop

cd "$ROOT/frontend"
[ -d node_modules ] || npm install
# 还没有数据文件时，先从 data/ 下的 Excel 生成
[ -f public/mock/companies.json ] || npm run data

if [ "$1" = "dev" ]; then
  nohup npx vite --host 0.0.0.0 --port $PORT > "$LOG/frontend.log" 2>&1 &
else
  echo "正在打包…"
  npm run build > "$LOG/build.log" 2>&1 || { echo "打包失败，详见 $LOG/build.log"; exit 1; }
  nohup npx vite preview > "$LOG/frontend.log" 2>&1 &
fi

IP=$(hostname -I | awk '{print $1}')
sleep 3
echo "方案列表： http://$IP:$PORT/"
echo "Demo 1：   http://$IP:$PORT/demo1"
echo "Demo 2：   http://$IP:$PORT/demo2"
echo "Demo 3：   http://$IP:$PORT/demo3"
echo "Demo 4：   http://$IP:$PORT/demo4"
echo "日志目录： $LOG"

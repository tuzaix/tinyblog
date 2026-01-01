# tinyblog

🚀 一个轻量级、基于文件的私密博客系统，集成卡密验证、水印保护与多主题支持。

## ✨ 特性

- **极简部署**：无需数据库，基于本地 JSON 文件存储数据。
- **卡密验证**：支持文章加锁，用户需输入有效卡密方可解锁阅读。
- **版权保护**：
  - 动态全屏水印（包含用户信息与卡密）。
  - 禁止右键、禁止复制、禁止 F12 调试。
- **多主题切换**：内置 浅色 (Light)、深色 (Dark)、护眼 (Sepia) 三种主题。
- **响应式设计**：适配 PC 与移动端。
- **管理后台**：集成文章管理、卡密生成、站点设置与 2FA 二步验证。

## 🛠️ 快速部署

### 1. 环境准备
确保您的服务器已安装 [Node.js](https://nodejs.org/) (推荐 v14+)。

### 2. 安装步骤
```bash
# 克隆项目
git clone https://github.com/tuzaix/tinyblog.git
cd tinyblog

# 安装依赖
npm install

# 启动项目
npm start
```
项目默认运行在 `http://localhost:3001`。您可以通过 `--port=XXXX` 或设置环境变量 `PORT` 来指定其他端口。

### 3. 后台管理
- **管理地址**：`http://localhost:3001/admin`
- **默认密码**：`admin`
- **注意**：建议首次登录后立即在“站点设置”中修改管理员密码，并启用 2FA 二步验证。

## 🌐 Ubuntu 生产环境部署

在 Ubuntu 上部署建议使用 **PM2** 进行进程守护，并使用 **Nginx** 作为反向代理。

### 1. 使用 PM2 启动
```bash
# 安装 PM2
sudo npm install -g pm2

# 启动项目并命名为 tinyblog
pm2 start server.js --name tinyblog -- --port=3001

# 设置开机自启
pm2 save
pm2 startup
```

### 2. Nginx 反向代理配置
创建一个新的 Nginx 配置文件（如 `/etc/nginx/sites-available/tinyblog`）：

```nginx
server {
    listen 80;
    server_name yourdomain.com; # 替换为你的域名或 IP

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 静态资源缓存（可选）
    location /public/ {
        alias /path/to/tinyblog/public/; # 替换为项目的实际绝对路径
        expires 30d;
    }
}
```

启用配置并重启 Nginx：
```bash
sudo ln -s /etc/nginx/sites-available/tinyblog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. 使用重启脚本 (可选)
项目根目录下提供了一个 `restart-server.sh` 脚本，用于**拉取最新代码、安装依赖并重启服务**。
```bash
# 赋予执行权限
chmod +x restart-server.sh

# 运行重启脚本
./restart-server.sh
```

## 📖 使用手册

### 发布文章
1. 进入管理后台 -> 文章管理。
2. 点击“发布新文章”，支持 Markdown 语法。
3. 保存后文章将出现在首页。

### 卡密管理
1. 进入管理后台 -> 卡密管理。
2. 设置卡密有效期（小时）及生成数量。
3. 将生成的卡密发放给用户。

### 水印设置
1. 进入管理后台 -> 站点设置。
2. 修改“水印文字”内容。
3. 水印会根据设置的文字自动生成高密度覆盖层。

## 📦 项目结构
```text
tinyblog/
├── data/               # 数据存储 (文章、卡密、设置)
├── public/             # 静态资源 (CSS, JS, Images)
├── views/              # EJS 模板文件
├── server.js           # 后端核心逻辑
├── package.json        # 项目依赖
└── README.md           # 项目文档
```

## 📄 开源协议
本项目采用 [MIT License](LICENSE) 协议开源。

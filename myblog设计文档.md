# 无数据库卡密付费阅读博客系统设计方案

## 1. 产品概述 (Product Overview)
*   **定位**：一个极简的、基于卡密验证的私有内容发布平台。
*   **视觉体验**：支持多种**主题模式**（Light, Dark, Sepia），通过 CSS 变量实现一键切换，并自动适配水印颜色。
*   **核心逻辑**：内容默认被锁定，仅展示标题和摘要。用户需通过微信联系客服购买卡密，输入正确卡密后通过接口获取全文内容.
*   **权限控制**：**一卡一文**。卡密首次使用时自动绑定当前文章 ID。
*   **时效控制**：支持设置卡密有效期（如 24 小时）。卡密激活后开始倒计时，过期后无法再次阅读。
*   **安全增强**：
    *   **密集水印**：文章内容需覆盖高密度水印，水印文字可在后台配置。
    *   **防篡改**：前端采用 MutationObserver 监听，一旦检测到水印被删除或隐藏，立即清空正文内容。
    *   **防复制**：禁止右键、禁止选中（CSS/JS）、禁止 Ctrl+C，尝试打开开发者工具时熔断页面。
*   **技术特点**：无传统数据库（MySQL/Mongo），所有数据（文章、配置、卡密）存储于本地 JSON 或 Markdown 文件中。

## 2. 用户交互流程 (User Flow)

### A. 访客端 (Front-end)
1.  **进入首页**：看到文章列表（仅显示标题、封面图、简短摘要）。
2.  **点击文章**：
    *   页面加载，但正文区域显示“模糊”或“锁定”状态。
    *   页面中央自动弹出**模态框 (Modal)**，且无法关闭（强制遮罩）。
3.  **弹窗内容**：
    *   提示语：“本站内容为付费资源，请解锁后阅读。”
    *   **客服二维码**：展示在显眼位置（扫码加好友购卡）。
    *   **输入框**：输入卡密。
    *   **验证按钮**：点击“立即解锁”。
4.  **解锁逻辑**：
    *   输入卡密 -> 请求后端验证 -> 验证通过 -> 后端返回文章正文 HTML -> 前端动态替换锁定区域 -> 存入浏览器缓存。

### B. 管理员端 (Admin Dashboard)
1.  **登录**：访问 `/admin`，输入配置文件中设定的密码。
2.  **仪表盘**：查看卡密状态（总数、已用、剩余）。
3.  **文章管理**：新建/编辑/删除文章（支持 Markdown 编辑）。
4.  **卡密管理**：单次生成卡密，查看卡密列表及状态。
5.  **全局设置**：修改客服二维码图片、修改弹窗提示语、修改网站标题、水印文字等。

## 3. 技术架构设计 (Technical Architecture)

为了满足“无数据库”且“安全”的需求，采用**后端渲染摘要，API 获取正文**的方式。

*   **后端框架**：Node.js (Express)。
*   **数据存储**：JSON 文件 + Markdown 文件。
*   **安全机制**：
    *   文章正文**不**随页面首次加载返回。
    *   卡密验证通过后，服务器才下发正文数据。

## 4. 数据结构设计 (Data Structure)

项目目录结构规划：

```text
/myblog
├── /data
│   ├── settings.json      # 网站配置（密码、提示语等）
│   ├── keys.json          # 卡密库
│   └── /articles          # 文章元数据
│       └── metadata.json  # 文章列表索引（ID, 标题, 摘要, 发布时间）
├── /content               # 文章正文内容
│   ├── post-001.md        # 实际的文章内容（不公开访问）
│   └── ...
├── /public                # 静态资源
│   ├── /images            # 图片资源（含二维码）
│   └── /css, /js
├── /views                 # HTML 模板 (EJS)
├── package.json           # 项目依赖
└── server.js              # 核心逻辑
```

### 关键数据文件示例

**A. `keys.json` (卡密存储)**
```json
[
  {
    "code": "KM8829103",
    "status": "active", // unused, active, expired
    "bound_article_id": "post-001",
    "create_time": "2023-10-01 12:00:00",
    "activate_time": "2023-10-02 14:00:00",
    "expire_time": "2023-10-03 14:00:00", // 激活时间 + 有效期
    "duration_hours": 24 // 生成时设定的有效时长
  }
]

**B. `settings.json` (全局配置)**
```json
{
  "site_name": "我的私密博客",
  "admin_password": "my_secure_password",
  "popup_title": "解锁阅读全文",
  "popup_message": "请扫描下方二维码联系客服获取访问密码",
  "wechat_qr_image": "/static/images/kf_qr.jpg",
  "default_key_duration_hours": 24, // 默认卡密有效期（小时）
  "default_theme": "light", // 默认主题
  "watermark_text": "严禁外传 IP: 127.0.0.1"
}
```

## 5. 关键功能逻辑 (Core Logic)

### 1. 文章加载机制 (防盗核心)
*   **请求**：`GET /article/<id>`
*   **响应**：服务器读取 `metadata.json` 中的摘要信息，渲染页面模板。**注意：此时不读取也不返回 .md 文件的正文内容。**

### 2. 解锁验证接口 (Updated)
*   **请求**：`POST /api/unlock`
    *   Body: `{ "article_id": 1, "key": "KM8829103" }`
*   **服务器逻辑**：
    1.  读取 `keys.json`。
    2.  查找该 Key。
    3.  **状态检查**：
        *   若 `status` == `unused`: 
            *   变为 `active`。
            *   `activate_time` = Now, `expire_time` = Now + `duration_hours`。
            *   `bound_article_id` = 当前文章ID。
            *   **允许访问**。
        *   若 `status` == `active`: 
            *   检查 `bound_article_id` 是否匹配。
            *   检查是否过期 (`expire_time` < Now)。若过期则更新为 `expired` 并拒绝。
            *   **允许访问**。
        *   若 `status` == `expired`: **拒绝访问**。

### 3. 前端防护逻辑
*   **防复制**：
    *   CSS: `body { user-select: none; -webkit-user-select: none; }`
    *   JS: 监听 `contextmenu`, `copy`, `keydown` (Ctrl+C/S/P) 并 `preventDefault`。
*   **防截图（威慑与干扰）**：
    *   **失焦模糊**：监听 `window.onblur`，一旦窗口失去焦点（如切换到截图软件），立即给 `body` 添加高斯模糊滤镜 (`filter: blur(20px)`)。
    *   **溯源水印**：水印中包含唯一卡密 ID，截图即暴露身份。
*   **防去水印**：
    *   使用 Canvas 绘制全屏水印层，置于最顶层，设置 `pointer-events: none`。
    *   **主题适配**：水印颜色读取 CSS 变量 `--watermark-color`，确保在不同主题下均可见。
    *   `MutationObserver` 监控 `body` 变化，若水印节点移除，立即 `document.body.innerHTML = ""`。

### 4. 主题系统
*   **实现方案**：CSS Variables (`:root` vs `[data-theme="dark"]`).
*   **支持模式**：
    1.  **Light**: 白底黑字，水印浅灰。
    2.  **Dark**: 深灰底白字，水印深灰。
    3.  **Sepia**: 暖黄底棕字，复古风格。
*   **持久化**：用户选择存入 `localStorage`。

## 6. 后台管理页面规划

1.  **设置页**：修改标题、上传二维码、修改弹窗文案、**设置默认卡密有效期**。
2.  **卡密管理页**：**单次生成卡密**（点击一次生成一个），查看状态，手动失效。
3.  **文章发布页**：Markdown 编辑器，保存文章元数据和内容。
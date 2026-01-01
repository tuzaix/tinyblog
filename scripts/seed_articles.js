const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const ARTICLES_META_FILE = path.join(DATA_DIR, 'articles', 'metadata.json');
const CONTENT_DIR = path.join(DATA_DIR, 'content');

// Ensure directories exist
if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

// Read existing metadata
let articles = [];
try {
    if (fs.existsSync(ARTICLES_META_FILE)) {
        const data = fs.readFileSync(ARTICLES_META_FILE, 'utf8');
        // Strip BOM
        const content = data.charCodeAt(0) === 0xFEFF ? data.slice(1) : data;
        articles = JSON.parse(content);
    }
} catch (e) {
    console.error('Error reading metadata:', e);
    articles = [];
}

const titles = [
    "深入理解 Node.js 事件循环",
    "React 18 并发模式实战指南",
    "CSS Grid 布局完全教程",
    "TypeScript 高级类型体操",
    "Docker 容器化部署最佳实践",
    "微服务架构设计模式解析",
    "Redis 高可用方案详解",
    "MySQL 性能调优实战",
    "Vue 3 组合式 API 深度解析",
    "Webpack 5 构建性能优化",
    "前端安全性指南：XSS 与 CSRF",
    "Go 语言并发编程实战",
    "Python 异步编程 asyncio 详解",
    "Kubernetes 核心概念图解",
    "Rust 所有权机制通俗解释",
    "GraphQL 与 RESTful API 对比",
    "Nginx 反向代理配置全攻略",
    "Linux 系统性能分析工具",
    "Git 工作流与分支管理策略",
    "Serverless 架构的优缺点分析"
];

const summaries = [
    "本文深入剖析 Node.js 的核心机制——事件循环，从 libuv 源码层面解释 timers, poll, check 等阶段的执行顺序...",
    "并发模式是 React 18 最重要的特性。本文通过实际案例，演示 useTransition 和 useDeferredValue 的使用场景...",
    "Grid 布局是 CSS 中最强大的布局系统。本文将从基础概念讲起，带你掌握 grid-template-areas 等高级用法...",
    "TypeScript 的类型系统非常强大。本文包含 20 个高难度的类型体操题目，帮助你精通泛型、条件类型和推断...",
    "如何编写高效的 Dockerfile？如何管理多阶段构建？本文总结了生产环境中容器化部署的 10 条黄金法则...",
    "微服务架构虽然灵活，但也带来了复杂性。本文介绍了断路器、服务发现、API 网关等核心模式的实现原理..."
];

// Helper to generate random date
const randomDate = (start, end) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
}

console.log('Generating 20 articles...');

// Helper for ID format: post-YYYYMMDD-HHmmss
const formatId = (dateObj, index) => {
    // Add 'index' seconds to avoid collision
    const t = new Date(dateObj.getTime() + index * 1000);
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    const H = String(t.getHours()).padStart(2, '0');
    const M = String(t.getMinutes()).padStart(2, '0');
    const S = String(t.getSeconds()).padStart(2, '0');
    return `post-${y}${m}${d}-${H}${M}${S}`;
};

const baseDate = new Date();

for (let i = 0; i < 20; i++) {
    const id = formatId(baseDate, i);
    const title = titles[i] || `测试文章标题 ${i+1}`;
    const summary = summaries[i % summaries.length];
    
    // Add Metadata
    articles.unshift({
        id: id,
        title: title,
        summary: summary,
        date: randomDate(new Date(2023, 0, 1), new Date())
    });

    // Create Content
    const content = `
# ${title}

这里是文章 **${title}** 的详细内容。

## 1. 简介
这是一篇自动生成的测试文章，用于填充博客内容。

## 2. 核心概念
> 这是一个引用块，用于强调重要信息。

\`\`\`javascript
// 这是一个代码块示例
console.log("Hello World from ${id}");
function test() {
    return "This is a test content";
}
\`\`\`

## 3. 详细分析
这里包含了很多很多文字...
- 列表项 1
- 列表项 2
- 列表项 3

### 3.1 子章节
更多详细内容，用于测试滚动的**Footer**效果。

${Array(20).fill('这是重复的占位文本，用于增加文章长度，测试页面布局和滚动效果。').join('\n\n')}

## 4. 总结
希望这个博客系统能为你提供帮助！
    `;

    fs.writeFileSync(path.join(CONTENT_DIR, `${id}.md`), content, 'utf8');
}

// Save Metadata
fs.writeFileSync(ARTICLES_META_FILE, JSON.stringify(articles, null, 2), 'utf8');

console.log('Done! 20 articles generated.');
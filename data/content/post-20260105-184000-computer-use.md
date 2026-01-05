# 谷歌又一强大工具开源，Selenium 慌了！

做过爬虫或者自动化测试的朋友，应该都体会过被 Selenium 和 Puppeteer 支配的恐惧。为了点一个按钮，我们得去扒网页源码，找 ID，找 Class。一旦网页改版，精心写好的脚本瞬间报错，维护起来既耗时又耗力。

如今，Google 把这个想法变成了现实。在 GitHub 上开源了一个名为 **Computer Use Preview** 的项目，直接让 Gemini 模型接管了浏览器。

## 01 核心原理：睁眼看世界

以前的自动化是“盲人摸象”，靠代码定位；现在的自动化是“睁眼看世界”，靠视觉识别。该工具模拟人的操作流程：**截图 → 分析 → 行动**。

它会先给网页截个图，通过 Gemini 2.5 Pro 模型强大的视觉能力，分析出页面上有哪些输入框、按钮和下拉菜单，然后决定下一步该干什么。

## 02 性能表现：傲视群雄

在官方给出的网页任务完成测试里，Gemini 拿到了 **69%** 的高分，直接超过了 Claude Sonnet 4.5 的 55% 和 OpenAI Operator 的 61.3%。

## 03 实用场景

- **跨网站数据搬运**：以前得写复杂脚本处理数据接口，现在直接告诉 AI：“把这上面的宠物信息填到那个系统里”，它就能自己切换页面，复制粘贴。
- **复杂视觉交互**：能够精准识别网页上的各种便签内容，并进行拖拽分类。这种涉及到空间理解的任务，传统脚本很难搞定。

## 04 如何体验

### 开发者模式（本地部署）
```bash
# 1. 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate

# 2. 安装依赖和浏览器内核
pip install -r requirements.txt
playwright install chrome

# 3. 开始运行
python main.py --query "去 Google 搜索一下 GitHubDaily"
```

> **提醒**：目前是 Preview（预览版），存在一些已知限制，如某些系统上抓取不到原生下拉菜单（<select> 元素）。

---
**GitHub 项目地址**：[https://github.com/google-gemini/computer-use-preview](https://github.com/google-gemini/computer-use-preview)

> 本文内容整理自微信公众号“逛逛 GitHub”。
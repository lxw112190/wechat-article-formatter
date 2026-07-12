# 公众号发布台

面向微信公众号的 Markdown 排版、预览和发布前检查工具。界面参考 mdnice 的编辑体验，聚焦写作、排版、手机预览、主题切换、封面选择和复制发布稿。

## 功能

- Markdown 编辑和常用排版按钮
- 标题、作者、摘要设置
- 微信公众号手机预览
- 青绿、墨蓝、暖刊三套正文主题
- 封面视觉选择
- 标题、摘要、结构、正文和封面检查
- 复制富文本 HTML，便于粘贴到公众号后台
- 导出 HTML 文件

## 命令

```bash
npm install
npm run dev
npm run build
node --test tests/rendered-html.test.mjs
```

## 技术栈

- Next.js / React
- Vinext
- Tailwind CSS 入口样式
- OpenAI Sites 部署配置

import type { Article } from "../types";

export const appVersion = "0.2.0";
export const maxVersionsPerArticle = 30;

const starterMarkdown = `# 一篇公众号文章，从草稿到可发布

## 先把读者放在第一位
公众号的开头不需要铺太长。用一句具体判断接住读者，再给出这篇文章要解决的问题。

> 好的排版不是装饰，而是降低阅读阻力。

## 用结构替代堆句子
- 每一节只承载一个观点
- 小标题要能被单独扫读
- 重点句可以加粗，但不要每段都加粗

## 发布前检查三件事
1. 标题是否足够明确
2. 摘要是否像一个自然的人写出来
3. 正文是否讲清楚一件事

### 可直接粘贴的素材

\`\`\`
把这段 HTML 复制到公众号后台，正文样式会尽量保留。
\`\`\`

最后，给文章留一个清晰的收束：读者读完之后，应该知道下一步做什么。`;

export const initialArticles: Article[] = [
  {
    id: "starter",
    title: "一篇公众号文章，从草稿到可发布",
    markdown: starterMarkdown,
    updatedAt: "刚刚",
  },
  {
    id: "writing",
    title: "写作，是一次对读者时间的尊重",
    markdown: "# 写作，是一次对读者时间的尊重\n\n## 先说结论\n一篇好文章不是写得多，而是让读者更快理解。",
    updatedAt: "昨天",
  },
  {
    id: "review",
    title: "六月内容复盘",
    markdown: "# 六月内容复盘\n\n## 有效的选题\n从具体问题出发，往往比泛泛而谈更容易被读完。",
    updatedAt: "6 月 30 日",
  },
];

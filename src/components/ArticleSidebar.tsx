import { stripMarkdown } from "../markdown/renderMarkdown";
import { formatUpdatedAt } from "../app/formatters";
import type { Article } from "../types";

type ArticleSidebarProps = {
  articles: Article[];
  activeId: string;
  onCreate: () => void;
  onSelect: (article: Article) => void;
};

export function ArticleSidebar({ articles, activeId, onCreate, onSelect }: ArticleSidebarProps) {
  return (
    <aside className="articleList" aria-label="文章列表">
      <div className="listHead">
        <div>
          <p className="panelKicker">草稿库</p>
          <h2>文章</h2>
        </div>
        <div className="articleListActions">
          <button className="addArticle" type="button" title="新建文章" onClick={onCreate}>
            +
          </button>
        </div>
      </div>
      <div className="articleItems">
        {articles.map((article) => (
          <button
            key={article.id}
            type="button"
            className={article.id === activeId ? "articleItem active" : "articleItem"}
            onClick={() => onSelect(article)}
          >
            <strong>{article.title || "未命名文章"}</strong>
            <span>{stripMarkdown(article.markdown) || "暂无内容"}</span>
            <em>{formatUpdatedAt(article.updatedAt)}</em>
          </button>
        ))}
      </div>
    </aside>
  );
}

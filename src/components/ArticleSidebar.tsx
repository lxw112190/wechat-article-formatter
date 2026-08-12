import { stripMarkdown } from "../markdown/renderMarkdown";
import { formatUpdatedAt } from "../app/formatters";
import type { ArticleSort } from "../hooks/useArticleLibrary";
import type { Article } from "../types";

type ArticleSidebarProps = {
  articles: Article[];
  activeId: string;
  searchQuery: string;
  articleSort: ArticleSort;
  totalCount: number;
  trashCount: number;
  onCreate: () => void;
  onSelect: (article: Article) => void;
  onSearch: (value: string) => void;
  onSort: (value: ArticleSort) => void;
  onTogglePinned: (articleId: string) => void;
  onOpenTrash: () => void;
};

export function ArticleSidebar(props: ArticleSidebarProps) {
  return (
    <aside className="articleList" aria-label="文章列表">
      <div className="listHead">
        <div>
          <p className="panelKicker">草稿库</p>
          <h2>文章</h2>
        </div>
        <div className="articleListActions">
          <button className="trashArticle" type="button" title="打开回收站" onClick={props.onOpenTrash}>
            回收站{props.trashCount ? ` ${props.trashCount}` : ""}
          </button>
          <button className="addArticle" type="button" title="新建文章" onClick={props.onCreate}>
            +
          </button>
        </div>
      </div>
      <div className="articleFilters">
        <input
          type="search"
          value={props.searchQuery}
          onChange={(event) => props.onSearch(event.target.value)}
          placeholder="搜索标题或正文"
          aria-label="搜索草稿"
        />
        <select value={props.articleSort} onChange={(event) => props.onSort(event.target.value as ArticleSort)} aria-label="草稿排序">
          <option value="updated-desc">最近更新</option>
          <option value="updated-asc">最早更新</option>
          <option value="title">标题排序</option>
        </select>
      </div>
      <div className="articleItems">
        {props.articles.length ? (
          props.articles.map((article) => (
            <article key={article.id} className={article.id === props.activeId ? "articleItem active" : "articleItem"}>
              <button className="articleSelect" type="button" onClick={() => props.onSelect(article)}>
                <strong>{article.title || "未命名文章"}</strong>
                <span>{stripMarkdown(article.markdown) || "暂无内容"}</span>
                <em>{formatUpdatedAt(article.updatedAt)}</em>
              </button>
              <button
                className={`pinArticle${article.pinned ? " active" : ""}`}
                type="button"
                aria-label={article.pinned ? "取消置顶" : "置顶文章"}
                title={article.pinned ? "取消置顶" : "置顶文章"}
                onClick={() => props.onTogglePinned(article.id)}
              >
                {article.pinned ? "★" : "☆"}
              </button>
            </article>
          ))
        ) : (
          <div className="articleEmpty">没有找到匹配的草稿</div>
        )}
      </div>
      <p className="articleCount">
        显示 {props.articles.length} / {props.totalCount} 篇
      </p>
    </aside>
  );
}

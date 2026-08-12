import { formatUpdatedAt } from "../app/formatters";
import type { DeletedArticle } from "../types";

type TrashDialogProps = {
  open: boolean;
  articles: DeletedArticle[];
  onClose: () => void;
  onRestore: (articleId: string) => void;
  onDelete: (articleId: string) => void;
  onEmpty: () => void;
};

export function TrashDialog({ open, articles, onClose, onRestore, onDelete, onEmpty }: TrashDialogProps) {
  if (!open) return null;
  return (
    <div className="historyOverlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="historyDialog libraryDialog" role="dialog" aria-modal="true" aria-labelledby="trash-title">
        <div className="historyHead">
          <div>
            <p className="panelKicker">草稿安全</p>
            <h2 id="trash-title">回收站</h2>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <p className="dialogHint">移入回收站的文章仍会保留历史版本和图片，也会包含在完整 ZIP 备份中。</p>
        {articles.length ? (
          <div className="trashList">
            {articles.map((article) => (
              <article className="trashItem" key={article.id}>
                <div>
                  <strong>{article.title || "未命名文章"}</strong>
                  <span>删除于 {formatUpdatedAt(article.deletedAt)}</span>
                </div>
                <div className="trashActions">
                  <button type="button" onClick={() => onRestore(article.id)}>
                    恢复
                  </button>
                  <button className="dangerText" type="button" onClick={() => onDelete(article.id)}>
                    彻底删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyDialogState">回收站为空</div>
        )}
        {articles.length > 0 && (
          <div className="dialogFooter">
            <button className="dangerText" type="button" onClick={onEmpty}>
              清空回收站
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

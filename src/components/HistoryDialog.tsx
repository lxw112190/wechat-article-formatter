import { maxVersionsPerArticle } from "../app/config";
import { formatVersionTime } from "../app/formatters";
import { stripMarkdown } from "../markdown/renderMarkdown";
import type { ArticleVersion } from "../types";

type HistoryDialogProps = {
  open: boolean;
  versions: ArticleVersion[];
  onClose: () => void;
  onRestore: (version: ArticleVersion) => void;
};

export function HistoryDialog({ open, versions, onClose, onRestore }: HistoryDialogProps) {
  if (!open) return null;
  return (
    <div className="historyOverlay" role="presentation" onClick={onClose}>
      <section
        className="historyDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="historyHeader">
          <div>
            <p className="panelKicker">自动备份</p>
            <h2 id="history-title">历史版本</h2>
          </div>
          <button type="button" aria-label="关闭历史版本" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="historyHint">每次自动或手动保存前保留旧内容，每篇文章最多保存 {maxVersionsPerArticle} 个版本。</p>
        <div className="historyList">
          {versions.length ? (
            versions.map((version) => (
              <article className="historyItem" key={version.id}>
                <div>
                  <strong>{formatVersionTime(version.savedAt)}</strong>
                  <span>{version.markdown.replace(/\s+/g, " ").slice(0, 90) || "空白内容"}</span>
                  <em>{stripMarkdown(version.markdown).replace(/\s/g, "").length} 字</em>
                </div>
                <button type="button" onClick={() => onRestore(version)}>
                  恢复此版本
                </button>
              </article>
            ))
          ) : (
            <div className="historyEmpty">还没有历史版本。编辑内容并等待自动保存后，这里会出现可恢复版本。</div>
          )}
        </div>
      </section>
    </div>
  );
}

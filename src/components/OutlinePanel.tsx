import type { OutlineItem } from "../types";

type OutlinePanelProps = {
  outline: OutlineItem[];
  activeIndex: number;
  onClose: () => void;
  onNavigate: (item: OutlineItem, index: number) => void;
};

export function OutlinePanel({ outline, activeIndex, onClose, onNavigate }: OutlinePanelProps) {
  return (
    <aside className="outlinePanel editorOutline" aria-label="文章大纲">
      <div className="outlineHead">
        <div>
          <p className="panelKicker">导航</p>
          <h3>文章大纲</h3>
        </div>
        <div className="outlineMeta">
          <span>{outline.length}</span>
          <button type="button" title="收起文章大纲" aria-label="收起文章大纲" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      {outline.length ? (
        <nav className="outlineItems">
          {outline.map((item, index) => (
            <button
              key={`${item.position}-${item.text}`}
              className={activeIndex === index ? "active" : ""}
              type="button"
              style={{ paddingLeft: `${8 + Math.max(0, item.level - 1) * 10}px` }}
              title={`第 ${item.line} 行 · H${item.level}`}
              onClick={() => onNavigate(item, index)}
            >
              <span>H{item.level}</span>
              <strong>{item.text}</strong>
            </button>
          ))}
        </nav>
      ) : (
        <p className="outlineEmpty">添加 Markdown 标题后，这里会生成可点击的大纲。</p>
      )}
    </aside>
  );
}

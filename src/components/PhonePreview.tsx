import type { CSSProperties, RefObject } from "react";

type PhonePreviewProps = {
  previewRef: RefObject<HTMLElement | null>;
  title: string;
  bodyHtml: string;
  syncScroll: boolean;
  themeVars: CSSProperties;
  onScroll: (source: HTMLElement) => void;
};

export function PhonePreview({ previewRef, title, bodyHtml, syncScroll, themeVars, onScroll }: PhonePreviewProps) {
  return (
    <section className="previewPanel" aria-label="公众号预览">
      <div className="phoneShell">
        <div className="phoneTop">
          <span>公众号</span>
          <span>{syncScroll ? "同步预览" : "预览"}</span>
        </div>
        <article ref={previewRef} className="wechatArticle" style={themeVars} onScroll={(event) => onScroll(event.currentTarget)}>
          <header className="articleHeader">
            <h2>{title || "未命名文章"}</h2>
            <p>草稿</p>
          </header>
          <div className="articleBody" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </article>
      </div>
    </section>
  );
}

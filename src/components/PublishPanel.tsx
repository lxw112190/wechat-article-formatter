import type { CSSProperties } from "react";
import type { PreflightIssue, Theme } from "../types";

type PublishPanelProps = {
  title: string;
  copied: string;
  fieldCopied: string | null;
  themeId: string;
  themes: Theme[];
  preflightIssues: PreflightIssue[];
  localImageCount: number;
  onCopyField: (key: string, value: string) => void;
  onPrint: () => void;
  onThemeChange: (themeId: string) => void;
  onCopy: () => void;
};

export function PublishPanel(props: PublishPanelProps) {
  const errors = props.preflightIssues.filter((issue) => issue.status === "error");
  const warnings = props.preflightIssues.filter((issue) => issue.status === "warning");
  const passes = props.preflightIssues.filter((issue) => issue.status === "pass").length;
  return (
    <aside className="publishPanel" aria-label="发布设置">
      <div className="panelHead">
        <div>
          <p className="panelKicker">设置</p>
          <h2>发布准备</h2>
        </div>
      </div>
      <div className="sectionBlock">
        <h3>微信字段</h3>
        <div className="fieldCopyGrid">
          <button type="button" onClick={() => props.onCopyField("title", props.title)}>
            {props.fieldCopied === "title" ? "已复制标题" : "复制标题"}
          </button>
        </div>
        <p className="fieldHint">标题需要单独粘贴到公众号后台；作者与封面由公众号后台自行填写和编辑。</p>
      </div>
      <div className="sectionBlock">
        <h3>定稿存档</h3>
        <div className="fieldCopyGrid">
          <button type="button" onClick={props.onPrint}>
            打印 / 保存 PDF
          </button>
        </div>
        <p className="fieldHint">打开独立的 A4 打印预览；可直接打印，或在系统打印对话框中选择“另存为 PDF”。</p>
      </div>
      <div className="sectionBlock">
        <h3>发布前检查</h3>
        <div className={`preflightSummary${errors.length ? " error" : warnings.length ? " warning" : " ready"}`}>
          <strong>
            {errors.length ? `${errors.length} 个问题待处理` : warnings.length ? `${warnings.length} 项建议确认` : "可以发布"}
          </strong>
          <span>
            {passes}/{props.preflightIssues.length} 项通过
          </span>
        </div>
        <div className="preflightList">
          {props.preflightIssues.map((issue) => (
            <article className={`preflightItem ${issue.status}`} key={issue.id}>
              <span aria-hidden="true">{issue.status === "pass" ? "✓" : issue.status === "warning" ? "!" : "×"}</span>
              <div>
                <strong>{issue.label}</strong>
                <p>{issue.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="sectionBlock">
        <h3>排版主题</h3>
        <div className="themeGrid">
          {props.themes.map((item) => (
            <button
              className={item.id === props.themeId ? "themeOption active" : "themeOption"}
              key={item.id}
              style={{ "--swatch": item.accent } as CSSProperties}
              type="button"
              onClick={() => props.onThemeChange(item.id)}
            >
              <span />
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="publishFooter">
        <button className="primaryButton wide" type="button" onClick={props.onCopy}>
          {props.copied}
        </button>
        {props.localImageCount > 0 && (
          <div className="assetPublishWarning">本文有 {props.localImageCount} 张本地图片。复制后请按图片 ID 在公众号后台重新上传。</div>
        )}
        <p>复制正文后粘贴到公众号编辑器，再填写标题、作者和封面。</p>
      </div>
    </aside>
  );
}

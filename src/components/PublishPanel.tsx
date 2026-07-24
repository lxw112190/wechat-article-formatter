import { useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import type { PreflightIssue, Theme } from "../types";
import { ThemeEditorDialog } from "./ThemeEditorDialog";

type PublishPanelProps = {
  title: string;
  copied: string;
  fieldCopied: string | null;
  themeId: string;
  themes: Theme[];
  preflightIssues: PreflightIssue[];
  localImageCount: number;
  currentTheme: Theme;
  isCustomTheme: boolean;
  themeMessage: string;
  onCopyField: (key: string, value: string) => void;
  onPrint: () => void;
  onThemeChange: (themeId: string) => void;
  onCreateThemeDraft: () => Theme;
  onEditThemeDraft: () => Theme;
  onSaveTheme: (theme: Theme) => void;
  onDeleteTheme: () => void;
  onExportTheme: () => void;
  onImportTheme: (event: ChangeEvent<HTMLInputElement>) => void;
  onCopy: () => void;
};

export function PublishPanel(props: PublishPanelProps) {
  const [themeDraft, setThemeDraft] = useState<Theme | null>(null);
  const themeInputRef = useRef<HTMLInputElement>(null);
  const errors = props.preflightIssues.filter((issue) => issue.status === "error");
  const warnings = props.preflightIssues.filter((issue) => issue.status === "warning");
  const passes = props.preflightIssues.filter((issue) => issue.status === "pass").length;
  return (
    <>
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
          <div className="themeSectionHead">
            <h3>排版主题</h3>
            {props.themeMessage && <span>{props.themeMessage}</span>}
          </div>
          <div className="themeGrid">
            {props.themes.map((item) => (
              <button
                className={item.id === props.themeId ? "themeOption active" : "themeOption"}
                key={item.id}
                style={{ "--swatch": item.accent, "--swatch-soft": item.accentSoft } as CSSProperties}
                type="button"
                onClick={() => props.onThemeChange(item.id)}
              >
                <span />
                <strong>{item.name}</strong>
                <em>{item.id.startsWith("custom-") ? "自定义" : "内置"}</em>
              </button>
            ))}
          </div>
          <div className="themeActions">
            <button type="button" onClick={() => setThemeDraft(props.onEditThemeDraft())}>
              {props.isCustomTheme ? "编辑当前" : "基于当前创建"}
            </button>
            <button type="button" onClick={() => setThemeDraft(props.onCreateThemeDraft())}>
              复制为新主题
            </button>
            <button type="button" onClick={props.onExportTheme}>
              导出当前
            </button>
            <button type="button" onClick={() => themeInputRef.current?.click()}>
              导入主题
            </button>
            {props.isCustomTheme && (
              <button
                className="dangerAction"
                type="button"
                onClick={() => {
                  if (window.confirm(`确定删除自定义主题“${props.currentTheme.name}”吗？`)) props.onDeleteTheme();
                }}
              >
                删除当前
              </button>
            )}
          </div>
          <input
            ref={themeInputRef}
            className="visuallyHidden"
            type="file"
            accept="application/json,.json,.wechat-theme.json"
            onChange={props.onImportTheme}
          />
          <p className="fieldHint">主题文件包含完整排版参数，可直接发给别人导入；不包含文章内容和图片。</p>
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
      <ThemeEditorDialog
        theme={themeDraft}
        onClose={() => setThemeDraft(null)}
        onSave={(theme) => {
          props.onSaveTheme(theme);
          setThemeDraft(null);
        }}
      />
    </>
  );
}

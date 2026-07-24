import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { renderMarkdown } from "../markdown/renderMarkdown";
import type { Theme, ThemeHeadingConfig, ThemeHeadingLevel } from "../types";

type ThemeEditorDialogProps = {
  theme: Theme | null;
  onClose: () => void;
  onSave: (theme: Theme) => void;
};

type ThemeColorKey = "accent" | "accentSoft" | "heading" | "text" | "muted" | "border" | "codeBg";

const colorFields: Array<{ key: ThemeColorKey; label: string }> = [
  { key: "accent", label: "强调色" },
  { key: "accentSoft", label: "强调浅色" },
  { key: "heading", label: "通用标题色" },
  { key: "text", label: "正文色" },
  { key: "muted", label: "辅助文字" },
  { key: "border", label: "边框色" },
  { key: "codeBg", label: "代码背景" },
];

const headingLevels: Array<{ key: ThemeHeadingLevel; label: string }> = [
  { key: "h1", label: "H1" },
  { key: "h2", label: "H2" },
  { key: "h3", label: "H3" },
  { key: "h4", label: "H4" },
  { key: "h5", label: "H5" },
  { key: "h6", label: "H6" },
];

const previewMarkdown = `# 一级标题：主题预览

正文用于观察字体、字号、行距、字间距和首行缩进。**重点文字**和[示例链接](https://example.com)会使用主题配置。

## 二级标题

> 好的排版不是装饰堆叠，而是让读者更轻松地理解内容。

### 三级标题

- 第一项无序列表
- 第二项无序列表

1. 第一项有序列表
2. 第二项有序列表

#### 四级标题

\`\`\`ts
const theme = "可以分享的完整排版";
\`\`\`

##### 五级标题

| 项目 | 效果 |
| --- | --- |
| 标题 | 独立配置 |
| 内容块 | 完整配置 |

---

###### 六级标题

最后一段用于检查整体排版节奏。`;

function cloneTheme(theme: Theme) {
  return structuredClone(theme);
}

export function ThemeEditorDialog({ theme, onClose, onSave }: ThemeEditorDialogProps) {
  const [draft, setDraft] = useState<Theme | null>(theme ? cloneTheme(theme) : null);
  const [initialTheme, setInitialTheme] = useState<Theme | null>(theme ? cloneTheme(theme) : null);
  const [undoStack, setUndoStack] = useState<Theme[]>([]);
  const [redoStack, setRedoStack] = useState<Theme[]>([]);
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("mobile");

  useEffect(() => {
    const next = theme ? cloneTheme(theme) : null;
    setDraft(next);
    setInitialTheme(next ? cloneTheme(next) : null);
    setUndoStack([]);
    setRedoStack([]);
    setMode("basic");
  }, [theme]);

  const previewHtml = useMemo(() => (draft ? renderMarkdown(previewMarkdown, draft) : ""), [draft]);
  if (!draft) return null;

  const imagePreviewStyle = {
    borderRadius: draft.imageStyle === "square" ? 0 : draft.radius,
    border: draft.imageStyle === "shadow" ? "0" : `1px solid ${draft.border}`,
    boxShadow: draft.imageStyle === "shadow" ? "0 10px 28px rgba(15,23,42,.16)" : "none",
    background: `linear-gradient(135deg, ${draft.accentSoft}, #ffffff)`,
    color: draft.muted,
    marginBottom: draft.imageSpacing,
  } as CSSProperties;

  function commit(next: Theme) {
    if (!draft) return;
    setUndoStack((items) => [...items, cloneTheme(draft)].slice(-60));
    setRedoStack([]);
    setDraft(next);
  }

  function update<K extends keyof Theme>(key: K, value: Theme[K]) {
    if (!draft) return;
    commit({ ...draft, [key]: value });
  }

  function updateHeading<K extends keyof ThemeHeadingConfig>(level: ThemeHeadingLevel, key: K, value: ThemeHeadingConfig[K]) {
    if (!draft) return;
    commit({
      ...draft,
      headings: {
        ...draft.headings,
        [level]: { ...draft.headings[level], [key]: value },
      },
    });
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous || !draft) return;
    setUndoStack((items) => items.slice(0, -1));
    setRedoStack((items) => [cloneTheme(draft), ...items].slice(0, 60));
    setDraft(cloneTheme(previous));
  }

  function redo() {
    const next = redoStack[0];
    if (!next || !draft) return;
    setRedoStack((items) => items.slice(1));
    setUndoStack((items) => [...items, cloneTheme(draft)].slice(-60));
    setDraft(cloneTheme(next));
  }

  function restoreInitial() {
    if (initialTheme) commit(cloneTheme(initialTheme));
  }

  return (
    <div className="themeEditorOverlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="themeEditorDialog" role="dialog" aria-modal="true" aria-labelledby="theme-editor-title">
        <header className="themeEditorHeader">
          <div>
            <p className="panelKicker">自定义排版</p>
            <h2 id="theme-editor-title">主题编辑器</h2>
          </div>
          <div className="themeEditorHeaderActions">
            <button type="button" disabled={!undoStack.length} onClick={undo}>
              撤销
            </button>
            <button type="button" disabled={!redoStack.length} onClick={redo}>
              重做
            </button>
            <button type="button" onClick={restoreInitial}>
              恢复
            </button>
            <button className="themeEditorClose" type="button" aria-label="关闭主题编辑器" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <div className="themeEditorBody">
          <form
            className="themeControls"
            onSubmit={(event) => {
              event.preventDefault();
              onSave(draft);
            }}
          >
            <div className="themeModeTabs" role="tablist" aria-label="主题编辑模式">
              <button className={mode === "basic" ? "active" : ""} type="button" role="tab" onClick={() => setMode("basic")}>
                基础设置
              </button>
              <button className={mode === "advanced" ? "active" : ""} type="button" role="tab" onClick={() => setMode("advanced")}>
                高级设置
              </button>
            </div>

            <div className="themeControlScroller">
              <details className="themeEditorGroup" open>
                <summary>基本信息与配色</summary>
                <div className="themeEditorGroupBody">
                  <label className="themeWideField">
                    <span>主题名称</span>
                    <input value={draft.name} maxLength={30} required onChange={(event) => update("name", event.target.value)} />
                  </label>
                  <div className="themeColorGrid">
                    {colorFields.map((field) => (
                      <label key={field.key}>
                        <span>{field.label}</span>
                        <span className="themeColorInput">
                          <input type="color" value={draft[field.key]} onChange={(event) => update(field.key, event.target.value)} />
                          <code>{draft[field.key]}</code>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>

              <details className="themeEditorGroup" open>
                <summary>字体与正文节奏</summary>
                <div className="themeEditorGroupBody themeFormGrid">
                  <label className="themeSpanTwo">
                    <span>正文字体</span>
                    <select value={draft.fontFamily} onChange={(event) => update("fontFamily", event.target.value as Theme["fontFamily"])}>
                      <option value="system">跟随系统</option>
                      <option value="microsoft-yahei">微软雅黑</option>
                      <option value="pingfang">苹方</option>
                      <option value="noto-sans">思源黑体 / Noto Sans SC</option>
                      <option value="serif">思源宋体 / 通用衬线</option>
                      <option value="songti">宋体</option>
                      <option value="kaiti">楷体</option>
                      <option value="fangsong">仿宋</option>
                      <option value="rounded">现代圆体</option>
                      <option value="arial">Arial</option>
                    </select>
                  </label>
                  <label>
                    <span>正文大小</span>
                    <input
                      type="number"
                      min="13"
                      max="20"
                      value={draft.bodyFontSize}
                      onChange={(event) => update("bodyFontSize", Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>正文行高</span>
                    <input
                      type="number"
                      min="1.4"
                      max="2.2"
                      step="0.05"
                      value={draft.bodyLineHeight}
                      onChange={(event) => update("bodyLineHeight", Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>段落间距</span>
                    <input
                      type="number"
                      min="8"
                      max="32"
                      value={draft.paragraphSpacing}
                      onChange={(event) => update("paragraphSpacing", Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>内容块圆角</span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={draft.radius}
                      onChange={(event) => update("radius", Number(event.target.value))}
                    />
                  </label>
                </div>
              </details>

              <details className="themeEditorGroup" open>
                <summary>常用内容块</summary>
                <div className="themeEditorGroupBody themeFormGrid">
                  <label>
                    <span>引用样式</span>
                    <select
                      value={draft.blockquoteStyle}
                      onChange={(event) => update("blockquoteStyle", event.target.value as Theme["blockquoteStyle"])}
                    >
                      <option value="left-bar">左侧色条</option>
                      <option value="card">边框卡片</option>
                      <option value="quote">上下引线</option>
                    </select>
                  </label>
                  <label>
                    <span>代码块</span>
                    <select value={draft.codeStyle} onChange={(event) => update("codeStyle", event.target.value as Theme["codeStyle"])}>
                      <option value="soft">柔和底色</option>
                      <option value="dark">深色代码</option>
                      <option value="bordered">白底边框</option>
                    </select>
                  </label>
                  <label>
                    <span>表格样式</span>
                    <select value={draft.tableStyle} onChange={(event) => update("tableStyle", event.target.value as Theme["tableStyle"])}>
                      <option value="soft-header">浅色表头</option>
                      <option value="accent-header">强调色表头</option>
                      <option value="minimal">极简横线</option>
                    </select>
                  </label>
                  <label>
                    <span>图片样式</span>
                    <select value={draft.imageStyle} onChange={(event) => update("imageStyle", event.target.value as Theme["imageStyle"])}>
                      <option value="rounded">圆角边框</option>
                      <option value="square">直角边框</option>
                      <option value="shadow">悬浮阴影</option>
                    </select>
                  </label>
                  <label>
                    <span>分隔线</span>
                    <select
                      value={draft.dividerStyle}
                      onChange={(event) => update("dividerStyle", event.target.value as Theme["dividerStyle"])}
                    >
                      <option value="solid">实线</option>
                      <option value="dashed">虚线</option>
                      <option value="dotted">点线</option>
                    </select>
                  </label>
                </div>
              </details>

              {mode === "advanced" && (
                <>
                  <details className="themeEditorGroup" open>
                    <summary>H1～H6 独立标题设置</summary>
                    <div className="themeEditorGroupBody">
                      <div className="headingConfigTable">
                        <div className="headingConfigHeader">
                          <span>级别</span>
                          <span>字号</span>
                          <span>颜色</span>
                          <span>对齐</span>
                          <span>装饰</span>
                        </div>
                        {headingLevels.map(({ key, label }) => {
                          const heading = draft.headings[key];
                          return (
                            <div className="headingConfigRow" key={key}>
                              <strong>{label}</strong>
                              <input
                                aria-label={`${label} 字号`}
                                type="number"
                                min={key === "h1" ? 20 : key === "h2" ? 17 : 12}
                                max={key === "h1" ? 40 : key === "h2" ? 34 : 28}
                                value={heading.fontSize}
                                onChange={(event) => updateHeading(key, "fontSize", Number(event.target.value))}
                              />
                              <input
                                aria-label={`${label} 颜色`}
                                type="color"
                                value={heading.color}
                                onChange={(event) => updateHeading(key, "color", event.target.value)}
                              />
                              <select
                                aria-label={`${label} 对齐`}
                                value={heading.align}
                                onChange={(event) => updateHeading(key, "align", event.target.value as ThemeHeadingConfig["align"])}
                              >
                                <option value="left">左</option>
                                <option value="center">中</option>
                                <option value="right">右</option>
                              </select>
                              <select
                                aria-label={`${label} 装饰`}
                                value={heading.decoration}
                                onChange={(event) =>
                                  updateHeading(key, "decoration", event.target.value as ThemeHeadingConfig["decoration"])
                                }
                              >
                                <option value="plain">纯文字</option>
                                <option value="left-bar">左色条</option>
                                <option value="underline">底横线</option>
                                <option value="filled">浅卡片</option>
                                <option value="pill">胶囊</option>
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </details>

                  <details className="themeEditorGroup" open>
                    <summary>正文细节</summary>
                    <div className="themeEditorGroupBody themeFormGrid">
                      <label>
                        <span>正文对齐</span>
                        <select
                          value={draft.bodyTextAlign}
                          onChange={(event) => update("bodyTextAlign", event.target.value as Theme["bodyTextAlign"])}
                        >
                          <option value="left">左对齐</option>
                          <option value="justify">两端对齐</option>
                        </select>
                      </label>
                      <label>
                        <span>字间距（px）</span>
                        <input
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={draft.letterSpacing}
                          onChange={(event) => update("letterSpacing", Number(event.target.value))}
                        />
                      </label>
                      <label>
                        <span>首行缩进（字）</span>
                        <input
                          type="number"
                          min="0"
                          max="2"
                          step="0.5"
                          value={draft.firstLineIndent}
                          onChange={(event) => update("firstLineIndent", Number(event.target.value))}
                        />
                      </label>
                    </div>
                  </details>

                  <details className="themeEditorGroup" open>
                    <summary>列表、强调与链接</summary>
                    <div className="themeEditorGroupBody themeFormGrid">
                      <label>
                        <span>无序列表符号</span>
                        <select
                          value={draft.unorderedListStyle}
                          onChange={(event) => update("unorderedListStyle", event.target.value as Theme["unorderedListStyle"])}
                        >
                          <option value="disc">实心圆</option>
                          <option value="circle">空心圆</option>
                          <option value="square">方块</option>
                        </select>
                      </label>
                      <label>
                        <span>有序列表编号</span>
                        <select
                          value={draft.orderedListStyle}
                          onChange={(event) => update("orderedListStyle", event.target.value as Theme["orderedListStyle"])}
                        >
                          <option value="decimal">1, 2, 3</option>
                          <option value="decimal-leading-zero">01, 02, 03</option>
                          <option value="cjk-ideographic">一、二、三</option>
                        </select>
                      </label>
                      <label>
                        <span>列表项间距</span>
                        <input
                          type="number"
                          min="0"
                          max="16"
                          value={draft.listSpacing}
                          onChange={(event) => update("listSpacing", Number(event.target.value))}
                        />
                      </label>
                      <label>
                        <span>粗体样式</span>
                        <select
                          value={draft.strongStyle}
                          onChange={(event) => update("strongStyle", event.target.value as Theme["strongStyle"])}
                        >
                          <option value="color">标题色加粗</option>
                          <option value="highlight">浅色高亮</option>
                          <option value="underline">强调下划线</option>
                        </select>
                      </label>
                      <label>
                        <span>链接样式</span>
                        <select value={draft.linkStyle} onChange={(event) => update("linkStyle", event.target.value as Theme["linkStyle"])}>
                          <option value="bottom-border">细底边</option>
                          <option value="underline">下划线</option>
                          <option value="plain">纯文字色</option>
                        </select>
                      </label>
                    </div>
                  </details>

                  <details className="themeEditorGroup" open>
                    <summary>图片与说明文字</summary>
                    <div className="themeEditorGroupBody themeFormGrid">
                      <label>
                        <span>图片下间距</span>
                        <input
                          type="number"
                          min="8"
                          max="48"
                          value={draft.imageSpacing}
                          onChange={(event) => update("imageSpacing", Number(event.target.value))}
                        />
                      </label>
                      <label>
                        <span>说明文字大小</span>
                        <input
                          type="number"
                          min="10"
                          max="18"
                          value={draft.imageCaptionSize}
                          onChange={(event) => update("imageCaptionSize", Number(event.target.value))}
                        />
                      </label>
                      <label>
                        <span>说明文字对齐</span>
                        <select
                          value={draft.imageCaptionAlign}
                          onChange={(event) => update("imageCaptionAlign", event.target.value as Theme["imageCaptionAlign"])}
                        >
                          <option value="left">左对齐</option>
                          <option value="center">居中</option>
                          <option value="right">右对齐</option>
                        </select>
                      </label>
                    </div>
                  </details>
                </>
              )}
            </div>

            <div className="themeEditorActions">
              <button type="button" onClick={onClose}>
                取消
              </button>
              <button className="primaryButton" type="submit">
                保存并使用
              </button>
            </div>
          </form>

          <aside className="themeLivePreview">
            <div className="themeLivePreviewHead">
              <div>
                <strong>实时预览</strong>
                <span>保存后同步用于复制、HTML 和 PDF</span>
              </div>
              <div className="themePreviewModes">
                <button className={previewMode === "mobile" ? "active" : ""} type="button" onClick={() => setPreviewMode("mobile")}>
                  手机
                </button>
                <button className={previewMode === "desktop" ? "active" : ""} type="button" onClick={() => setPreviewMode("desktop")}>
                  桌面
                </button>
              </div>
            </div>
            <article className={`themePreviewSheet ${previewMode}`}>
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              <div className="themeImageDemo" style={imagePreviewStyle}>
                图片样式与说明文字预览
              </div>
              <p
                className="themeCaptionDemo"
                style={{ color: draft.muted, fontSize: draft.imageCaptionSize, textAlign: draft.imageCaptionAlign }}
              >
                这是一段图片说明
              </p>
            </article>
          </aside>
        </div>
      </section>
    </div>
  );
}

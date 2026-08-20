import { defaultWordExportSettings, getWordExportPreset } from "../services/word";
import type { WordExportPreset, WordExportSettings } from "../services/word";

type WordExportDialogProps = {
  open: boolean;
  settings: WordExportSettings;
  exporting: boolean;
  onChange: (settings: WordExportSettings) => void;
  onClose: () => void;
  onExport: () => void | Promise<void>;
};

const presetOptions: Array<{ id: WordExportPreset; label: string; detail: string }> = [
  { id: "wechat", label: "公众号定稿", detail: "跟随当前主题，适合存档与审核" },
  { id: "formal", label: "正式报告", detail: "宋体、宽页边距并自动生成目录" },
  { id: "compact", label: "紧凑打印", detail: "缩小留白与字号，减少打印页数" },
];

export function WordExportDialog(props: WordExportDialogProps) {
  if (!props.open) return null;

  function update<K extends keyof WordExportSettings>(key: K, value: WordExportSettings[K]) {
    props.onChange({ ...props.settings, [key]: value });
  }

  return (
    <div
      className="historyOverlay wordExportOverlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && props.onClose()}
    >
      <section className="historyDialog wordExportDialog" role="dialog" aria-modal="true" aria-labelledby="word-export-title">
        <header className="historyHeader">
          <div>
            <p className="panelKicker">定稿与交付</p>
            <h2 id="word-export-title">Word 导出设置</h2>
          </div>
          <button type="button" aria-label="关闭 Word 导出设置" onClick={props.onClose}>
            ×
          </button>
        </header>

        <div className="wordExportBody">
          <section className="wordExportSection">
            <div className="wordExportSectionHead">
              <h3>快速模板</h3>
              <button type="button" onClick={() => props.onChange({ ...defaultWordExportSettings })}>
                恢复默认
              </button>
            </div>
            <div className="wordPresetGrid">
              {presetOptions.map((preset) => (
                <button type="button" key={preset.id} onClick={() => props.onChange(getWordExportPreset(preset.id))}>
                  <strong>{preset.label}</strong>
                  <span>{preset.detail}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="wordExportSection">
            <h3>页面与正文</h3>
            <div className="wordSettingsGrid">
              <label>
                <span>纸张尺寸</span>
                <select value={props.settings.pageSize} onChange={(event) => update("pageSize", event.target.value as "a4" | "a5")}>
                  <option value="a4">A4（正式文档）</option>
                  <option value="a5">A5（小册阅读）</option>
                </select>
              </label>
              <label>
                <span>正文字体</span>
                <select
                  value={props.settings.fontFamily}
                  onChange={(event) => update("fontFamily", event.target.value as WordExportSettings["fontFamily"])}
                >
                  <option value="theme">跟随当前主题</option>
                  <option value="microsoft-yahei">微软雅黑</option>
                  <option value="simsun">宋体</option>
                  <option value="kaiti">楷体</option>
                  <option value="fangsong">仿宋</option>
                </select>
              </label>
              <label>
                <span>正文字号</span>
                <select
                  value={props.settings.bodyFontSize ?? ""}
                  onChange={(event) => update("bodyFontSize", event.target.value ? Number(event.target.value) : null)}
                >
                  <option value="">跟随当前主题</option>
                  <option value="10.5">五号（10.5 磅）</option>
                  <option value="12">小四（12 磅）</option>
                  <option value="14">四号（14 磅）</option>
                  <option value="16">三号（16 磅）</option>
                </select>
              </label>
              <label>
                <span>正文行距</span>
                <select
                  value={props.settings.lineHeight ?? ""}
                  onChange={(event) => update("lineHeight", event.target.value ? Number(event.target.value) : null)}
                >
                  <option value="">跟随当前主题</option>
                  <option value="1.4">1.4 倍</option>
                  <option value="1.5">1.5 倍</option>
                  <option value="1.7">1.7 倍</option>
                  <option value="2">2 倍</option>
                </select>
              </label>
              {(["Top", "Right", "Bottom", "Left"] as const).map((side) => {
                const key = `margin${side}` as keyof Pick<WordExportSettings, "marginTop" | "marginRight" | "marginBottom" | "marginLeft">;
                const labels = { Top: "上边距", Right: "右边距", Bottom: "下边距", Left: "左边距" };
                return (
                  <label key={key}>
                    <span>{labels[side]}（毫米）</span>
                    <input
                      type="number"
                      min="8"
                      max="40"
                      step="1"
                      value={props.settings[key]}
                      onChange={(event) => update(key, Number(event.target.value))}
                    />
                  </label>
                );
              })}
              <label>
                <span>图片最大宽度（像素）</span>
                <input
                  type="number"
                  min="280"
                  max="680"
                  step="20"
                  value={props.settings.imageMaxWidth}
                  onChange={(event) => update("imageMaxWidth", Number(event.target.value))}
                />
              </label>
            </div>
          </section>

          <section className="wordExportSection">
            <h3>文档结构</h3>
            <div className="wordOptionList">
              <label>
                <input type="checkbox" checked={props.settings.showTitle} onChange={(event) => update("showTitle", event.target.checked)} />
                <span>显示文章主标题</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={props.settings.removeDuplicateTitle}
                  disabled={!props.settings.showTitle}
                  onChange={(event) => update("removeDuplicateTitle", event.target.checked)}
                />
                <span>自动移除正文开头重复的 H1</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={props.settings.includeToc}
                  onChange={(event) => update("includeToc", event.target.checked)}
                />
                <span>生成可点击文章目录</span>
              </label>
              <label className="wordInlineOption">
                <span>目录包含</span>
                <select
                  value={props.settings.tocDepth}
                  disabled={!props.settings.includeToc}
                  onChange={(event) => update("tocDepth", Number(event.target.value) as 1 | 2 | 3)}
                >
                  <option value="1">H1</option>
                  <option value="2">H1～H2</option>
                  <option value="3">H1～H3</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={props.settings.showFooterTitle}
                  onChange={(event) => update("showFooterTitle", event.target.checked)}
                />
                <span>页脚显示文章标题</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={props.settings.showPageNumbers}
                  onChange={(event) => update("showPageNumbers", event.target.checked)}
                />
                <span>页脚显示页码</span>
              </label>
            </div>
          </section>
        </div>

        <footer className="wordExportFooter">
          <p>设置会保存在当前浏览器。WebP、SVG 图片会在导出时自动转换为 Word 兼容格式。</p>
          <div>
            <button type="button" onClick={props.onClose}>
              取消
            </button>
            <button className="primaryButton" type="button" disabled={props.exporting} onClick={() => void props.onExport()}>
              {props.exporting ? "正在生成 Word…" : "导出 .docx"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

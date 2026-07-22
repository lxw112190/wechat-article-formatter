import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  Dispatch,
  DragEvent as ReactDragEvent,
  RefObject,
  SetStateAction,
} from "react";
import { formatGroups } from "../hooks/useMarkdownEditor";
import type { ImageAsset } from "../imageAssets";
import type { OutlineItem } from "../types";
import { ImageAssetPanel } from "./ImageAssetPanel";
import { OutlinePanel } from "./OutlinePanel";

type ArticleEditorProps = {
  activeId: string;
  title: string;
  markdown: string;
  setTitle: Dispatch<SetStateAction<string>>;
  setMarkdown: Dispatch<SetStateAction<string>>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  imageInputRef: RefObject<HTMLInputElement | null>;
  replaceImageInputRef: RefObject<HTMLInputElement | null>;
  formatRef: RefObject<HTMLDivElement | null>;
  dragActive: boolean;
  setDragActive: Dispatch<SetStateAction<boolean>>;
  formatOpen: boolean;
  setFormatOpen: Dispatch<SetStateAction<boolean>>;
  applyFormat: (value: string) => void;
  storageError: boolean;
  isDirty: boolean;
  hasUnsavedChanges: boolean;
  outline: OutlineItem[];
  outlineOpen: boolean;
  activeOutlineIndex: number;
  syncScroll: boolean;
  readMinutes: number;
  characterCount: number;
  headingCount: number;
  imageCount: number;
  pasteMessage: string;
  imageMessage: string;
  imageAssets: ImageAsset[];
  assetUrls: Record<string, string>;
  imageProcessing: boolean;
  onToggleOutline: () => void;
  onCloseOutline: () => void;
  onToggleSync: () => void;
  onNavigateOutline: (item: OutlineItem, index: number) => void;
  onUpdateOutline: (position: number) => void;
  onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  onDrop: (event: ReactDragEvent<HTMLTextAreaElement>) => void;
  onEditorScroll: (source: HTMLElement) => void;
  onImageInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onReplaceImageInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpdateImageAlt: (id: string, value: string) => void;
  onSaveImageAlt: (id: string) => void;
  onInsertImage: (asset: ImageAsset) => void;
  onDownloadImage: (asset: ImageAsset) => void;
  onRecompressImage: (asset: ImageAsset) => void;
  onReplaceImage: (id: string) => void;
  onRemoveImage: (asset: ImageAsset) => void;
};

export function ArticleEditor(props: ArticleEditorProps) {
  const { textareaRef, imageInputRef, replaceImageInputRef, formatRef } = props;
  return (
    <section className={`editorPanel${props.dragActive ? " isDragging" : ""}`} aria-label="Markdown 编辑器">
      <div className="panelHead">
        <div>
          <p className="panelKicker">草稿</p>
          <h2>Markdown 编辑</h2>
        </div>
        <div className="panelHeadActions">
          <span className={`saveState${props.hasUnsavedChanges ? " dirty" : ""}`}>
            {props.storageError ? "⚠ 存储失败" : props.isDirty ? "● 未保存" : "✓ 已保存"}
          </span>
          <button
            className={`outlineToggle${props.outlineOpen ? " active" : ""}`}
            type="button"
            aria-expanded={props.outlineOpen}
            title="显示或收起当前文章大纲"
            onClick={props.onToggleOutline}
          >
            大纲 · {props.outlineOpen ? "开" : "关"}
          </button>
          <button
            className={`syncToggle${props.syncScroll ? " active" : ""}`}
            type="button"
            aria-pressed={props.syncScroll}
            title="编辑区与手机预览按阅读进度同步滚动"
            onClick={props.onToggleSync}
          >
            同步滚动 · {props.syncScroll ? "开" : "关"}
          </button>
          <div className="metricPill">{props.readMinutes} 分钟阅读</div>
        </div>
      </div>
      <div className={`editorWorkspace${props.outlineOpen ? "" : " outlineCollapsed"}`}>
        <OutlinePanel
          outline={props.outline}
          activeIndex={props.activeOutlineIndex}
          onClose={props.onCloseOutline}
          onNavigate={props.onNavigateOutline}
        />
        <div className="editorMain">
          <div className="titleFields">
            <label>
              标题
              <input value={props.title} onChange={(event) => props.setTitle(event.target.value)} placeholder="填写文章标题" />
            </label>
          </div>
          <div className="toolbar" aria-label="排版工具">
            <button type="button" title="加粗" onClick={() => props.applyFormat("bold")}>
              B
            </button>
            <button type="button" title="引用" onClick={() => props.applyFormat("quote")}>
              “
            </button>
            <button type="button" title="无序列表" onClick={() => props.applyFormat("list")}>
              列表
            </button>
            <button type="button" title="行内代码" onClick={() => props.applyFormat("inlineCode")}>
              {"</>"}
            </button>
            <button type="button" title="代码块" onClick={() => props.applyFormat("codeBlock")}>
              {"{ }"}
            </button>
            <button type="button" title="上传并压缩图片" disabled={props.imageProcessing} onClick={() => imageInputRef.current?.click()}>
              {props.imageProcessing ? "处理中" : "图片"}
            </button>
            <div className="formatPicker" ref={formatRef}>
              <button
                className="formatTrigger"
                type="button"
                aria-expanded={props.formatOpen}
                onClick={() => props.setFormatOpen((open) => !open)}
              >
                格式 <span>⌄</span>
              </button>
              {props.formatOpen && (
                <div className="formatMenu" role="menu">
                  {formatGroups.map((group) => (
                    <div className="formatGroup" key={group.label}>
                      <p>{group.label}</p>
                      {group.actions.map(([id, label]) => (
                        <button key={id} type="button" onClick={() => props.applyFormat(id)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {(props.pasteMessage || props.imageMessage) && (
            <div className="pasteNotice" role="status">
              {props.imageMessage || props.pasteMessage}
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="markdownInput"
            value={props.markdown}
            onChange={(event) => {
              props.setMarkdown(event.target.value);
              props.onUpdateOutline(event.currentTarget.selectionStart);
            }}
            onSelect={(event) => props.onUpdateOutline(event.currentTarget.selectionStart)}
            onPaste={props.onPaste}
            onDragEnter={(event) => {
              if (event.dataTransfer.types.includes("Files")) props.setDragActive(true);
            }}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files")) event.preventDefault();
            }}
            onDragLeave={() => props.setDragActive(false)}
            onDrop={props.onDrop}
            onScroll={(event) => props.onEditorScroll(event.currentTarget)}
            spellCheck={false}
          />
          <div className="editorStats">
            <span>{props.characterCount} 字</span>
            <span>{props.headingCount} 个小标题</span>
            <span>{props.imageCount} 张图片</span>
          </div>
          <ImageAssetPanel
            activeId={props.activeId}
            assets={props.imageAssets}
            urls={props.assetUrls}
            processing={props.imageProcessing}
            onAdd={() => imageInputRef.current?.click()}
            onUpdateAlt={props.onUpdateImageAlt}
            onSaveAlt={props.onSaveImageAlt}
            onInsert={props.onInsertImage}
            onDownload={props.onDownloadImage}
            onRecompress={props.onRecompressImage}
            onReplace={props.onReplaceImage}
            onRemove={props.onRemoveImage}
          />
          <input
            ref={imageInputRef}
            className="visuallyHidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={props.onImageInput}
          />
          <input
            ref={replaceImageInputRef}
            className="visuallyHidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={props.onReplaceImageInput}
          />
        </div>
      </div>
    </section>
  );
}

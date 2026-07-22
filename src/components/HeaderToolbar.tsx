import { useRef } from "react";
import type { ChangeEvent } from "react";
import { BackupPanel } from "./BackupPanel";

type HeaderToolbarProps = {
  activeId: string;
  saved: string;
  hasUnsavedChanges: boolean;
  historyCount: number;
  markdownMessage: string;
  libraryMessage: string;
  backupMessage: string;
  copied: string;
  onSave: () => void;
  onOpenHistory: () => void;
  onImportMarkdown: (event: ChangeEvent<HTMLInputElement>) => void;
  onExportMarkdown: () => void;
  onDeleteArticle: () => void;
  onExportLibrary: () => void;
  onImportLibrary: (event: ChangeEvent<HTMLInputElement>) => void;
  onExportBackup: () => void;
  onImportBackup: (event: ChangeEvent<HTMLInputElement>) => void;
  onExportHtml: () => void;
  onPrint: () => void;
  onCopy: () => void;
};

export function HeaderToolbar(props: HeaderToolbarProps) {
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const markdownInputRef = useRef<HTMLInputElement>(null);
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">WeChat Formatter</p>
        <h1>公众号排版助手</h1>
      </div>
      <div className="topbarActions">
        <button
          className="ghostButton"
          type="button"
          title={props.hasUnsavedChanges ? "立即保存当前修改" : "当前内容已保存"}
          onClick={props.onSave}
        >
          {props.saved}
        </button>
        <button className="ghostButton" type="button" onClick={props.onOpenHistory} disabled={!props.activeId}>
          历史版本{props.historyCount ? ` (${props.historyCount})` : ""}
        </button>
        <button className="ghostButton" type="button" onClick={() => markdownInputRef.current?.click()}>
          {props.markdownMessage && props.markdownMessage !== "已导出" ? props.markdownMessage : "导入 .md"}
        </button>
        <button className="ghostButton" type="button" onClick={props.onExportMarkdown} disabled={!props.activeId}>
          {props.markdownMessage === "已导出" ? "已导出" : "导出 .md"}
        </button>
        <button className="ghostButton" type="button" onClick={props.onDeleteArticle} disabled={!props.activeId}>
          删除文章
        </button>
        <button className="ghostButton" type="button" onClick={props.onExportLibrary}>
          {props.libraryMessage || "导出 JSON"}
        </button>
        <button className="ghostButton" type="button" onClick={() => jsonInputRef.current?.click()}>
          {props.libraryMessage || "导入 JSON"}
        </button>
        <BackupPanel message={props.backupMessage} onExport={props.onExportBackup} onImport={props.onImportBackup} />
        <button className="ghostButton" type="button" onClick={props.onExportHtml}>
          导出 HTML
        </button>
        <button className="ghostButton" type="button" onClick={props.onPrint}>
          打印 / 保存 PDF
        </button>
        <button className="primaryButton" type="button" onClick={props.onCopy}>
          {props.copied}
        </button>
      </div>
      <input ref={jsonInputRef} className="visuallyHidden" type="file" accept="application/json,.json" onChange={props.onImportLibrary} />
      <input
        ref={markdownInputRef}
        className="visuallyHidden"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        onChange={props.onImportMarkdown}
      />
    </header>
  );
}

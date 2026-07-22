import { useRef } from "react";
import type { ChangeEvent } from "react";

type BackupPanelProps = {
  message: string;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function BackupPanel({ message, onExport, onImport }: BackupPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="ghostButton" type="button" onClick={onExport}>
        {message || "完整备份 ZIP"}
      </button>
      <button className="ghostButton" type="button" onClick={() => inputRef.current?.click()}>
        恢复 ZIP
      </button>
      <input ref={inputRef} className="visuallyHidden" type="file" accept="application/zip,.zip" onChange={onImport} />
    </>
  );
}

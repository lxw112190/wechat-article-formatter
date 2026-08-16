import { formatBytes } from "../app/formatters";
import type { StorageSnapshot } from "../hooks/useStorageManager";

type StorageDialogProps = {
  open: boolean;
  busy: boolean;
  message: string;
  snapshot: StorageSnapshot | null;
  articleCount: number;
  historyCount: number;
  trashCount: number;
  onClose: () => void;
  onRefresh: () => void;
  onPersist: () => void;
  onCleanup: () => void;
  onBackup: () => void;
};

export function StorageDialog(props: StorageDialogProps) {
  if (!props.open) return null;
  const snapshot = props.snapshot;
  const usagePercent = snapshot?.usage && snapshot.quota ? Math.min(100, (snapshot.usage / snapshot.quota) * 100) : null;
  return (
    <div className="historyOverlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && props.onClose()}>
      <section className="historyDialog storageDialog" role="dialog" aria-modal="true" aria-labelledby="storage-title">
        <div className="historyHead">
          <div>
            <p className="panelKicker">数据安全</p>
            <h2 id="storage-title">存储空间中心</h2>
          </div>
          <button type="button" onClick={props.onClose}>
            关闭
          </button>
        </div>
        <div className="storageStats">
          <div>
            <strong>{props.articleCount}</strong>
            <span>文章</span>
          </div>
          <div>
            <strong>{props.historyCount}</strong>
            <span>历史版本</span>
          </div>
          <div>
            <strong>{props.trashCount}</strong>
            <span>回收站</span>
          </div>
          <div>
            <strong>{snapshot?.imageCount ?? "—"}</strong>
            <span>图片</span>
          </div>
        </div>
        <div className="storageDetails">
          <p>
            <span>浏览器总占用</span>
            <strong>{snapshot?.usage == null ? "浏览器未提供" : formatBytes(snapshot.usage)}</strong>
          </p>
          <p>
            <span>浏览器配额</span>
            <strong>{snapshot?.quota == null ? "浏览器未提供" : formatBytes(snapshot.quota)}</strong>
          </p>
          <p>
            <span>文章与设置</span>
            <strong>{snapshot ? formatBytes(snapshot.localStorageBytes) : "—"}</strong>
          </p>
          <p>
            <span>压缩图片</span>
            <strong>{snapshot ? formatBytes(snapshot.imageBytes) : "—"}</strong>
          </p>
          <p>
            <span>未使用图片</span>
            <strong>{snapshot?.unusedImageCount ?? "—"} 张</strong>
          </p>
          <p>
            <span>持久化存储</span>
            <strong>{snapshot?.persistent == null ? "未知" : snapshot.persistent ? "已启用" : "未启用"}</strong>
          </p>
        </div>
        {usagePercent != null && (
          <div className="storageMeter" aria-label={`已使用 ${usagePercent.toFixed(1)}%`}>
            <span style={{ width: `${Math.max(1, usagePercent)}%` }} />
          </div>
        )}
        <p className="dialogHint">持久化存储可以降低浏览器自动清理站点数据的概率，但不能替代完整 ZIP 备份。</p>
        {props.message && (
          <div className="storageMessage" role="status">
            {props.message}
          </div>
        )}
        <div className="storageActions">
          <button type="button" disabled={props.busy} onClick={props.onRefresh}>
            刷新统计
          </button>
          <button type="button" disabled={props.busy || snapshot?.persistent === true} onClick={props.onPersist}>
            申请持久化
          </button>
          <button type="button" disabled={props.busy || !snapshot?.unusedImageCount} onClick={props.onCleanup}>
            清理未使用图片
          </button>
          <button type="button" disabled={props.busy} onClick={props.onBackup}>
            完整备份 ZIP
          </button>
        </div>
      </section>
    </div>
  );
}

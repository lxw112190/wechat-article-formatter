import type { StorageRecovery } from "../services/articleStorage";

type StorageRecoveryDialogProps = {
  libraryRecovery: StorageRecovery | null;
  historyRecovery: StorageRecovery | null;
  onDownloadLibrary: () => void;
  onRepairLibrary: () => boolean;
  onDiscardLibrary: () => void;
  onDownloadHistory: () => void;
  onRepairHistory: () => boolean;
  onDiscardHistory: () => void;
  onError: (message: string) => void;
};

export function StorageRecoveryDialog(props: StorageRecoveryDialogProps) {
  const recoveries = [
    props.libraryRecovery && {
      recovery: props.libraryRecovery,
      download: props.onDownloadLibrary,
      repair: props.onRepairLibrary,
      discard: props.onDiscardLibrary,
    },
    props.historyRecovery && {
      recovery: props.historyRecovery,
      download: props.onDownloadHistory,
      repair: props.onRepairHistory,
      discard: props.onDiscardHistory,
    },
  ].filter(Boolean) as Array<{ recovery: StorageRecovery; download: () => void; repair: () => boolean; discard: () => void }>;
  if (!recoveries.length) return null;
  return (
    <div className="historyOverlay recoveryOverlay" role="presentation">
      <section className="historyDialog recoveryDialog" role="alertdialog" aria-modal="true" aria-labelledby="recovery-title">
        <div className="historyHead">
          <div>
            <p className="panelKicker">已暂停自动覆盖</p>
            <h2 id="recovery-title">检测到本地数据损坏</h2>
          </div>
        </div>
        <p className="dialogHint">工具已经保留原始内容副本。在你作出选择前，不会用示例数据覆盖损坏的数据。</p>
        {recoveries.map(({ recovery, download, repair, discard }) => (
          <article className="recoveryItem" key={recovery.storageKey}>
            <div>
              <strong>{recovery.label}</strong>
              <span>安全副本：{recovery.backupKey}</span>
            </div>
            <div className="recoveryActions">
              <button type="button" onClick={download}>
                下载原始数据
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!repair()) props.onError(`${recovery.label}无法自动修复，请先下载原始数据再选择重新开始。`);
                }}
              >
                尝试修复
              </button>
              <button
                className="dangerText"
                type="button"
                onClick={() => {
                  if (window.confirm(`确定放弃损坏的${recovery.label}并重新开始吗？建议先下载原始数据。`)) discard();
                }}
              >
                重新开始
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

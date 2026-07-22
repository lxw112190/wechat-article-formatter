type StatusMessageProps = { message: string; onClose: () => void };

export function StatusMessage({ message, onClose }: StatusMessageProps) {
  if (!message) return null;
  return (
    <div className="globalError" role="alert">
      <div>
        <strong>本地数据操作出现问题</strong>
        <span>{message}</span>
      </div>
      <button type="button" aria-label="关闭错误提示" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

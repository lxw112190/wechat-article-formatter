import { formatBytes } from "../app/formatters";
import type { ImageAsset } from "../imageAssets";

type ImageAssetPanelProps = {
  activeId: string;
  assets: ImageAsset[];
  urls: Record<string, string>;
  processing: boolean;
  onAdd: () => void;
  onUpdateAlt: (id: string, value: string) => void;
  onSaveAlt: (id: string) => void;
  onInsert: (asset: ImageAsset) => void;
  onDownload: (asset: ImageAsset) => void;
  onRecompress: (asset: ImageAsset) => void;
  onReplace: (id: string) => void;
  onRemove: (asset: ImageAsset) => void;
};

export function ImageAssetPanel(props: ImageAssetPanelProps) {
  return (
    <section className="imageManager" aria-label="图片素材">
      <div className="imageManagerHead">
        <div>
          <h3>图片素材</h3>
          <p>自动压缩后保存在本机；正文只记录图片 ID。</p>
        </div>
        <button type="button" disabled={props.processing || !props.activeId} onClick={props.onAdd}>
          {props.processing ? "正在处理…" : "+ 添加图片"}
        </button>
      </div>
      {props.assets.length ? (
        <div className="imageAssetList">
          {props.assets.map((asset) => (
            <article className="imageAssetCard" key={asset.id}>
              <img src={props.urls[asset.id]} alt={asset.alt} />
              <div className="imageAssetInfo">
                <strong>{asset.id}</strong>
                <span>
                  {asset.width} × {asset.height} · {formatBytes(asset.originalSize)} → {formatBytes(asset.compressedSize)}
                </span>
                <label>
                  图片说明
                  <input
                    value={asset.alt}
                    maxLength={120}
                    onChange={(event) => props.onUpdateAlt(asset.id, event.target.value)}
                    onBlur={() => props.onSaveAlt(asset.id)}
                  />
                </label>
                <div className="imageAssetActions">
                  <button type="button" onClick={() => props.onInsert(asset)}>
                    插入
                  </button>
                  <button type="button" onClick={() => props.onDownload(asset)}>
                    下载
                  </button>
                  <button type="button" disabled={props.processing} onClick={() => props.onRecompress(asset)}>
                    节省空间
                  </button>
                  <button type="button" disabled={props.processing} onClick={() => props.onReplace(asset.id)}>
                    替换
                  </button>
                  <button className="danger" type="button" onClick={() => props.onRemove(asset)}>
                    删除
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <button className="imageDropEmpty" type="button" disabled={props.processing || !props.activeId} onClick={props.onAdd}>
          粘贴、拖拽图片到编辑区，或点击选择图片
          <br />
          <span>支持 JPG、PNG、WebP、GIF，单张最大 25MB</span>
        </button>
      )}
      <p className="imageStorageHint">
        图片不会进入 JSON 或 .md 文件；请在更换设备前下载需要的图片。复制正文时会使用图片 ID 占位，不嵌入 Base64。
      </p>
    </section>
  );
}

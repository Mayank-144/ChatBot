import { FileIcon } from '../Icons/Icons';

export function FileCard({ fileItem }) {
  return (
    <div className="message-file-card">
      <div
        className="file-icon-box"
        style={{ background: fileItem.typeInfo?.bgColor || 'rgba(59, 130, 246, 0.15)' }}
      >
        <FileIcon category={fileItem.typeInfo?.category} />
      </div>
      <div className="file-card-details">
        <span className="file-card-name" title={fileItem.name}>
          {fileItem.name}
        </span>
        <div className="file-card-meta">
          <span className="file-badge" style={{ color: fileItem.typeInfo?.color }}>
            {fileItem.typeInfo?.label}
          </span>
          <span className="file-card-size">{fileItem.size}</span>
        </div>
      </div>
    </div>
  );
}

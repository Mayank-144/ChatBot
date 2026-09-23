import { FileIcon } from '../Icons/Icons';

export function FileCard({ fileItem }) {
  // Image or Video Thumbnail Card
  if ((fileItem.isImage || fileItem.isVideo) && fileItem.dataUrl) {
    return (
      <div className="message-image-card">
        <div className="image-preview-container">
          <img
            src={fileItem.dataUrl}
            alt={fileItem.name}
            className="message-image-preview"
            onClick={() => window.open(fileItem.dataUrl, '_blank')}
            title="Click to view full preview"
          />
          {fileItem.isVideo && <div className="video-overlay-badge">🎥 Video Frame</div>}
        </div>
        <div className="message-image-meta">
          <span className="file-card-name" title={fileItem.name}>{fileItem.name}</span>
          <span className="file-card-size">{fileItem.duration ? `${fileItem.duration} • ${fileItem.size}` : fileItem.size}</span>
        </div>
      </div>
    );
  }

  // Audio or Document Card
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
          <span className="file-card-size">
            {fileItem.duration ? `${fileItem.duration} • ${fileItem.size}` : fileItem.size}
          </span>
        </div>
      </div>
    </div>
  );
}


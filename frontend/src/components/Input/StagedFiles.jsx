import { FileIcon, Spinner, CheckIcon, CloseIcon } from '../Icons/Icons';

export function StagedFiles({ stagedFiles, onRemoveFile }) {
  if (!stagedFiles || stagedFiles.length === 0) return null;

  return (
    <div className="staged-files-container">
      {stagedFiles.map((item) => (
        <div key={item.id} className={`staged-file-chip ${item.status}`}>
          <div className="staged-file-icon" style={{ background: item.typeInfo.bgColor }}>
            {item.isImage && item.dataUrl ? (
              <img src={item.dataUrl} alt={item.name} className="staged-thumb-img" />
            ) : (
              <FileIcon category={item.typeInfo.category} />
            )}
          </div>
          <div className="staged-file-info">
            <span className="staged-file-name" title={item.name}>
              {item.name}
            </span>
            <div className="staged-file-status">
              <span className="staged-size">{item.size}</span>
              {item.status === 'parsing' && (
                <span className="status-badge parsing">
                  <Spinner /> Parsing...
                </span>
              )}
              {item.status === 'ready' && (
                <span className="status-badge ready">
                  <CheckIcon /> Ready
                </span>
              )}
              {item.status === 'error' && (
                <span className="status-badge error" title={item.errorMsg}>
                  Failed
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="remove-file-btn"
            onClick={() => onRemoveFile(item.id)}
            title="Remove file"
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}

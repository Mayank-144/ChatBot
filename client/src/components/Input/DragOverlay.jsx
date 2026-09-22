import { UploadCloudIcon } from '../Icons/Icons';

export function DragOverlay({ isDragging }) {
  if (!isDragging) return null;

  return (
    <div className="drag-drop-overlay">
      <div className="drag-drop-modal">
        <UploadCloudIcon />
        <h3>Drop your files here</h3>
        <p>Upload PDF, Excel, Word, CSV, JSON, or Text to analyze</p>
      </div>
    </div>
  );
}

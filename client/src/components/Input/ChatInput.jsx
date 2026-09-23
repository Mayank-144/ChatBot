import { useState, useRef, useEffect } from 'react';
import {
  PlusIcon,
  StopIcon,
  SendArrowIcon,
  PhotoIcon,
  VideoIcon,
  AudioIcon,
  DocumentFileIcon,
} from '../Icons/Icons';
import { StagedFiles } from './StagedFiles';

export function ChatInput({
  input,
  setInput,
  stagedFiles,
  loading,
  onSend,
  onStop,
  onRemoveFile,
  onOpenFilePicker,
  onOpenPhotoPicker,
  onOpenVideoPicker,
  onOpenAudioPicker,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isAnyFileParsing = stagedFiles.some((f) => f.status === 'parsing');
  const isSendDisabled = isAnyFileParsing || (!input.trim() && stagedFiles.length === 0);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (loading) {
        onStop();
      } else if (!isSendDisabled) {
        onSend();
      }
    }
  };

  const handlePickPhotos = () => {
    setMenuOpen(false);
    onOpenPhotoPicker();
  };

  const handlePickVideos = () => {
    setMenuOpen(false);
    onOpenVideoPicker();
  };

  const handlePickAudios = () => {
    setMenuOpen(false);
    onOpenAudioPicker();
  };

  const handlePickFiles = () => {
    setMenuOpen(false);
    onOpenFilePicker();
  };

  return (
    <div className="input-section">
      <StagedFiles stagedFiles={stagedFiles} onRemoveFile={onRemoveFile} />

      <div className="input-box-wrapper">
        {/* Attach Button + Dropdown Menu */}
        <div className="attach-menu-wrapper" ref={menuRef}>
          <button
            type="button"
            className={`attach-btn ${menuOpen ? 'active' : ''}`}
            onClick={() => setMenuOpen((prev) => !prev)}
            title="Attach Photos, Videos, Audios, or Files"
            disabled={loading}
          >
            <PlusIcon />
          </button>

          {menuOpen && (
            <div className="attach-dropdown-menu">
              <button
                type="button"
                className="dropdown-menu-item"
                onClick={handlePickPhotos}
              >
                <div className="dropdown-item-icon photo">
                  <PhotoIcon />
                </div>
                <div className="dropdown-item-text">
                  <span className="dropdown-item-title">Photos</span>
                  <span className="dropdown-item-desc">Upload image files</span>
                </div>
              </button>

              <button
                type="button"
                className="dropdown-menu-item"
                onClick={handlePickVideos}
              >
                <div className="dropdown-item-icon video">
                  <VideoIcon />
                </div>
                <div className="dropdown-item-text">
                  <span className="dropdown-item-title">Videos</span>
                  <span className="dropdown-item-desc">Upload video clips</span>
                </div>
              </button>

              <button
                type="button"
                className="dropdown-menu-item"
                onClick={handlePickAudios}
              >
                <div className="dropdown-item-icon audio">
                  <AudioIcon />
                </div>
                <div className="dropdown-item-text">
                  <span className="dropdown-item-title">Audios</span>
                  <span className="dropdown-item-desc">Upload voice & audio</span>
                </div>
              </button>

              <button
                type="button"
                className="dropdown-menu-item"
                onClick={handlePickFiles}
              >
                <div className="dropdown-item-icon doc">
                  <DocumentFileIcon />
                </div>
                <div className="dropdown-item-text">
                  <span className="dropdown-item-title">Files</span>
                  <span className="dropdown-item-desc">Upload documents & code</span>
                </div>
              </button>
            </div>
          )}
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            stagedFiles.length > 0
              ? 'Ask anything about the attached file(s) or press Send...'
              : 'Type your message or attach a file...'
          }
          disabled={loading}
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
        />

        {/* Combined Send / Stop Button */}
        {loading ? (
          <button
            type="button"
            className="send-btn stop-btn"
            onClick={onStop}
            title="Stop generating"
          >
            <StopIcon />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="button"
            className="send-btn"
            onClick={onSend}
            disabled={isSendDisabled}
            title="Send message (Enter)"
          >
            <SendArrowIcon />
            <span>Send</span>
          </button>
        )}
      </div>
    </div>
  );
}



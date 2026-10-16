import { useState, useRef, useEffect } from 'react';
import {
  PlusIcon,
  StopIcon,
  SendArrowIcon,
  PhotoIcon,
  VideoIcon,
  AudioIcon,
  DocumentFileIcon,
  MaximizeIcon,
  MinimizeIcon,
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
  const [isExpanded, setIsExpanded] = useState(false);
  const menuRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-resize textarea height smoothly as prompt length grows or shrinks,
  // or smoothly scale to a spacious height when expanded
  useEffect(() => {
    if (textareaRef.current) {
      if (isExpanded) {
        textareaRef.current.style.height = '320px';
      } else {
        textareaRef.current.style.height = 'auto';
        const scrollHeight = textareaRef.current.scrollHeight;
        const nextHeight = Math.min(Math.max(scrollHeight, 24), 180);
        textareaRef.current.style.height = `${nextHeight}px`;
      }
    }
  }, [input, isExpanded]);

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
    if (e.key === 'Escape' && isExpanded) {
      e.preventDefault();
      setIsExpanded(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (loading) {
        onStop();
      } else if (!isSendDisabled) {
        onSend();
        setIsExpanded(false);
      }
    }
  };

  const handleSendClick = () => {
    if (loading) {
      onStop();
    } else if (!isSendDisabled) {
      onSend();
      setIsExpanded(false);
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

      <div className={`input-box-wrapper ${isExpanded ? 'is-expanded' : ''}`}>
        {/* Expanded Mode Top Header Bar */}
        {isExpanded && (
          <div className="expanded-prompt-header">
            <div className="expanded-prompt-info">
              <span className="expanded-mode-pill">Expanded Prompt</span>
              {input.length > 0 && (
                <span className="expanded-stats-badge">
                  {input.length} chars • {input.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              )}
            </div>
            <button
              type="button"
              className="expand-arrow-btn active"
              onClick={() => setIsExpanded(false)}
              title="Collapse prompt (Esc)"
              aria-label="Collapse prompt"
            >
              <MinimizeIcon size={16} />
            </button>
          </div>
        )}

        <div className="input-content-row">
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

          <textarea
            ref={textareaRef}
            rows={isExpanded ? 10 : 1}
            className={`chat-textarea ${isExpanded ? 'is-expanded' : ''}`}
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

          <div className="input-actions-right">
            {/* Upper Right Corner Expand Arrow Button */}
            {!isExpanded && (
              <button
                type="button"
                className="expand-arrow-btn"
                onClick={() => setIsExpanded(true)}
                title="Expand prompt to full size (⤢)"
                aria-label="Expand prompt"
              >
                <MaximizeIcon size={16} />
              </button>
            )}

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
                onClick={handleSendClick}
                disabled={isSendDisabled}
                title="Send message (Enter)"
              >
                <SendArrowIcon />
                <span>Send</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



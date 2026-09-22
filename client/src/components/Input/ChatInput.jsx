import { PaperclipIcon } from '../Icons/Icons';
import { StagedFiles } from './StagedFiles';

export function ChatInput({
  input,
  setInput,
  stagedFiles,
  loading,
  onSend,
  onRemoveFile,
  onOpenFilePicker,
}) {
  const isAnyFileParsing = stagedFiles.some((f) => f.status === 'parsing');
  const isSendDisabled = loading || isAnyFileParsing || (!input.trim() && stagedFiles.length === 0);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="input-section">
      <StagedFiles stagedFiles={stagedFiles} onRemoveFile={onRemoveFile} />

      <div className="input-box-wrapper">
        <button
          type="button"
          className="attach-btn"
          onClick={onOpenFilePicker}
          title="Attach document (PDF, Excel, Word, CSV, Code, Text)"
          disabled={loading}
        >
          <PaperclipIcon />
        </button>

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

        <button
          type="button"
          className="send-btn"
          onClick={onSend}
          disabled={isSendDisabled}
          title="Send message"
        >
          Send ↵
        </button>
      </div>
    </div>
  );
}

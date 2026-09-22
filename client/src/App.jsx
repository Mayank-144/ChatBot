import { Header } from './components/Header/Header';
import { MessageList } from './components/Chat/MessageList';
import { ChatInput } from './components/Input/ChatInput';
import { DragOverlay } from './components/Input/DragOverlay';
import { useTheme } from './hooks/useTheme';
import { useFileUpload } from './hooks/useFileUpload';
import { useChat } from './hooks/useChat';
import './App.css';

function App() {
  const { theme, toggleTheme } = useTheme();

  const {
    stagedFiles,
    isDragging,
    fileInputRef,
    handleFileSelect,
    handleRemoveStagedFile,
    clearStagedFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFilePicker,
  } = useFileUpload();

  const {
    messages,
    input,
    setInput,
    loading,
    copiedIndex,
    handleSend,
    handleClearChat,
    handleCopy,
  } = useChat();

  const onSend = () => {
    handleSend({ stagedFiles, clearStagedFiles });
  };

  const onClear = (e) => {
    handleClearChat(e);
    clearStagedFiles();
  };

  return (
    <div
      className={`app-wrapper ${theme}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DragOverlay isDragging={isDragging} />

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.json,.md,.js,.jsx,.ts,.tsx,.py,.html,.css,.sql,.xml,.yaml,.yml,.log"
        style={{ display: 'none' }}
      />

      <div className="chat-window">
        <Header
          theme={theme}
          onToggleTheme={toggleTheme}
          onClearChat={onClear}
        />

        <MessageList
          messages={messages}
          loading={loading}
          copiedIndex={copiedIndex}
          onCopy={handleCopy}
        />

        <ChatInput
          input={input}
          setInput={setInput}
          stagedFiles={stagedFiles}
          loading={loading}
          onSend={onSend}
          onRemoveFile={handleRemoveStagedFile}
          onOpenFilePicker={openFilePicker}
        />
      </div>
    </div>
  );
}

export default App;

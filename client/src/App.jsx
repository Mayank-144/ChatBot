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
    photoInputRef,
    videoInputRef,
    audioInputRef,
    handleFileSelect,
    handleRemoveStagedFile,
    clearStagedFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFilePicker,
    openPhotoPicker,
    openVideoPicker,
    openAudioPicker,
  } = useFileUpload();

  const {
    messages,
    input,
    setInput,
    loading,
    copiedIndex,
    handleSend,
    handleStop,
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

      {/* Hidden Separate Photo/Image Input */}
      <input
        type="file"
        ref={photoInputRef}
        onChange={handleFileSelect}
        multiple
        accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg"
        style={{ display: 'none' }}
      />

      {/* Hidden Separate Video Input */}
      <input
        type="file"
        ref={videoInputRef}
        onChange={handleFileSelect}
        multiple
        accept="video/*,.mp4,.webm,.mov,.mkv,.avi,.wmv,.flv"
        style={{ display: 'none' }}
      />

      {/* Hidden Separate Audio Input */}
      <input
        type="file"
        ref={audioInputRef}
        onChange={handleFileSelect}
        multiple
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.wma"
        style={{ display: 'none' }}
      />

      {/* Hidden Separate Document/File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.json,.md,.js,.jsx,.ts,.tsx,.py,.html,.css,.sql,.xml,.yaml,.yml,.log"
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
          onStop={handleStop}
          onRemoveFile={handleRemoveStagedFile}
          onOpenFilePicker={openFilePicker}
          onOpenPhotoPicker={openPhotoPicker}
          onOpenVideoPicker={openVideoPicker}
          onOpenAudioPicker={openAudioPicker}
        />
      </div>
    </div>
  );
}

export default App;



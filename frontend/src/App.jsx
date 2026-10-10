import { Header } from './components/Header/Header';
import { MessageList } from './components/Chat/MessageList';
import { ChatInput } from './components/Input/ChatInput';
import { DragOverlay } from './components/Input/DragOverlay';
import { DocumentBadgeList } from './components/RAG/DocumentBadgeList';
import { useTheme } from './hooks/useTheme';
import { useFileUpload } from './hooks/useFileUpload';
import { useChat } from './hooks/useChat';
import { useRAG } from './hooks/useRAG';
import './App.css';

function App() {
  const { theme, toggleTheme } = useTheme();

  const {
    ragDocuments,
    isUploadingRAG,
    ragStatusMessage,
    ragError,
    uploadToRAG,
    deleteFromRAG,
  } = useRAG();

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

  // Intercept file selection to index PDF and Excel files into MongoDB Atlas Vector Search
  const handleFileSelectWithRAG = async (e) => {
    const files = Array.from(e.target.files || []);
    handleFileSelect(e);

    const ragFiles = files.filter((f) => /\.(pdf|xlsx|xls|csv)$/i.test(f.name));
    for (const file of ragFiles) {
      try {
        await uploadToRAG(file);
      } catch (err) {
        console.warn('Auto RAG indexing failed:', err.message);
      }
    }
  };

  // Intercept drag-and-drop to index documents into vector store
  const handleDropWithRAG = async (e) => {
    const files = Array.from(e.dataTransfer?.files || []);
    handleDrop(e);

    const ragFiles = files.filter((f) => /\.(pdf|xlsx|xls|csv)$/i.test(f.name));
    for (const file of ragFiles) {
      try {
        await uploadToRAG(file);
      } catch (err) {
        console.warn('Auto RAG indexing failed:', err.message);
      }
    }
  };

  return (
    <div
      className={`app-wrapper ${theme}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropWithRAG}
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

      {/* Hidden Separate Document/File Input with RAG Auto-indexing */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelectWithRAG}
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

        {/* Active RAG Vector Knowledge Base badges */}
        <DocumentBadgeList
          ragDocuments={ragDocuments}
          isUploadingRAG={isUploadingRAG}
          ragStatusMessage={ragStatusMessage}
          ragError={ragError}
          onDeleteDocument={deleteFromRAG}
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

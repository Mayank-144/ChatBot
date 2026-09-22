import { useState, useRef } from 'react';
import { extractTextFromFile, formatFileSize, getFileTypeInfo } from '../utils/fileParser';

export function useFileUpload() {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  const processFiles = async (filesList) => {
    if (!filesList || filesList.length === 0) return;

    const newStaged = Array.from(filesList).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name,
      size: formatFileSize(file.size),
      typeInfo: getFileTypeInfo(file.name),
      status: 'parsing', // 'parsing' | 'ready' | 'error'
      parsedContent: '',
      errorMsg: '',
    }));

    setStagedFiles((prev) => [...prev, ...newStaged]);

    for (const item of newStaged) {
      try {
        const parsed = await extractTextFromFile(item.file);
        const text = typeof parsed === 'object' ? parsed.text : parsed;
        const dataUrl = typeof parsed === 'object' ? parsed.dataUrl : null;
        const isImage = typeof parsed === 'object' ? parsed.isImage : false;

        setStagedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'ready',
                  parsedContent: text,
                  dataUrl,
                  isImage,
                }
              : f
          )
        );
      } catch (err) {
        setStagedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: 'error', errorMsg: err.message } : f
          )
        );
      }
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveStagedFile = (id) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearStagedFiles = () => {
    setStagedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return {
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
  };
}

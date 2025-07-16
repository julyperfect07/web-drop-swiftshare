import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, File, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSize?: number;
}

export function FileDropZone({ 
  onFilesSelected, 
  disabled = false, 
  maxFiles = 10,
  maxSize = 1024 * 1024 * 1024 // 1GB
}: FileDropZoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = [...selectedFiles, ...acceptedFiles].slice(0, maxFiles);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  }, [selectedFiles, onFilesSelected, maxFiles]);

  const removeFile = useCallback((index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  }, [selectedFiles, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    maxSize,
    multiple: maxFiles > 1
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer",
          "bg-gradient-to-br from-card/50 to-card/80 backdrop-blur-sm",
          isDragActive 
            ? "border-accent scale-105 shadow-lg glow-effect" 
            : "border-border hover:border-accent/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{
          transform: isDragActive ? 'scale(1.02)' : 'scale(1)'
        }}
      >
        <input {...getInputProps()} />
        
        <div className="p-12 text-center">
          <motion.div
            className="mx-auto mb-6 w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center"
            animate={{ 
              rotate: isDragActive ? 360 : 0,
              scale: isDragActive ? 1.1 : 1
            }}
            transition={{ duration: 0.3 }}
          >
            <Upload className="w-10 h-10 text-accent" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {isDragActive ? "Drop files here!" : "Drop files or click to browse"}
            </h3>
            <p className="text-muted-foreground">
              Upload up to {maxFiles} files, max {formatFileSize(maxSize)} each
            </p>
          </motion.div>
        </div>

        {/* Animated background effect */}
        <AnimatePresence>
          {isDragActive && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-accent/20 via-transparent to-accent/20"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              exit={{ x: '200%' }}
              transition={{ 
                duration: 1, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Selected Files */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <h4 className="text-sm font-medium text-foreground">
              Selected Files ({selectedFiles.length})
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <motion.div
                  key={`${file.name}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-card/80 border border-border/50"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <File className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
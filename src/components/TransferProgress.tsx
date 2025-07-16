import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileTransfer } from '@/services/webrtc';
import { File, Download, Upload, Check, X, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface TransferProgressProps {
  transfers: FileTransfer[];
  onCancelTransfer?: (transferId: string) => void;
}

export function TransferProgress({ transfers, onCancelTransfer }: TransferProgressProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (transfer: FileTransfer) => {
    switch (transfer.status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'transferring':
        return transfer.direction === 'send' ? 
          <Upload className="w-4 h-4 text-accent" /> : 
          <Download className="w-4 h-4 text-info" />;
      case 'completed':
        return <Check className="w-4 h-4 text-success" />;
      case 'error':
        return <X className="w-4 h-4 text-destructive" />;
      default:
        return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: FileTransfer['status']) => {
    switch (status) {
      case 'pending':
        return 'text-warning';
      case 'transferring':
        return 'text-accent';
      case 'completed':
        return 'text-success';
      case 'error':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  if (transfers.length === 0) return null;

  return (
    <Card className="p-4 card-gradient border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">File Transfers</h3>
        <span className="text-sm text-muted-foreground">
          {transfers.filter(t => t.status === 'transferring').length} active
        </span>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {transfers.map((transfer) => (
            <motion.div
              key={transfer.id}
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="p-3 rounded-lg bg-card/50 border border-border/30"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    {getStatusIcon(transfer)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {transfer.name}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(transfer.size)}</span>
                      <span>•</span>
                      <span className={cn("capitalize", getStatusColor(transfer.status))}>
                        {transfer.status}
                      </span>
                      <span>•</span>
                      <span className={cn(
                        transfer.direction === 'send' ? 'text-accent' : 'text-info'
                      )}>
                        {transfer.direction === 'send' ? 'Sending' : 'Receiving'}
                      </span>
                    </div>
                  </div>
                </div>

                {transfer.status === 'transferring' && onCancelTransfer && (
                  <motion.button
                    onClick={() => onCancelTransfer(transfer.id)}
                    className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </div>

              {transfer.status === 'transferring' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {Math.round(transfer.progress)}% complete
                    </span>
                    <span className="text-muted-foreground">
                      {formatFileSize(transfer.size * transfer.progress / 100)} / {formatFileSize(transfer.size)}
                    </span>
                  </div>
                  <Progress 
                    value={transfer.progress} 
                    className="h-1.5"
                  />
                </div>
              )}

              {transfer.status === 'completed' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="mt-2"
                >
                  <div className="text-xs text-success bg-success/10 px-2 py-1 rounded-md inline-block">
                    Transfer completed successfully
                  </div>
                </motion.div>
              )}

              {transfer.status === 'error' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="mt-2"
                >
                  <div className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded-md inline-block">
                    Transfer failed
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}
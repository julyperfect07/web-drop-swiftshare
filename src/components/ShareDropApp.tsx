import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Share2, Zap, Shield, Globe } from 'lucide-react';
import { WebRTCService, FileTransfer } from '@/services/webrtc';
import { PeerDiscovery } from './PeerDiscovery';
import { FileDropZone } from './FileDropZone';
import { QRCodeGenerator } from './QRCodeGenerator';
import { TransferProgress } from './TransferProgress';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Peer {
  id: string;
  name?: string;
}

export function ShareDropApp() {
  const [webrtc] = useState(() => new WebRTCService());
  const [connectedPeers, setConnectedPeers] = useState<Peer[]>([]);
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [roomId, setRoomId] = useState<string>();
  const [roomUrl, setRoomUrl] = useState<string>();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const handleJoinRoom = useCallback(async (roomId: string) => {
    if (roomId.trim()) {
      try {
        await webrtc.joinRoom(roomId.trim());
        setRoomId(roomId.trim());
        const url = `${window.location.origin}?room=${roomId.trim()}`;
        setRoomUrl(url);
        
        toast({
          title: "Joined Room",
          description: `Connected to room ${roomId.trim()}`,
        });
      } catch (error) {
        toast({
          title: "Failed to Join Room",
          description: "Please check the room ID and try again",
          variant: "destructive"
        });
      }
    }
  }, [webrtc, toast]);

  useEffect(() => {
    webrtc.setCallbacks({
      onPeerConnected: (peerId: string, peerName?: string) => {
        setConnectedPeers(prev => [...prev.filter(p => p.id !== peerId), { id: peerId, name: peerName }]);
        toast({
          title: "Device Connected",
          description: `${peerName || `Device ${peerId.slice(0, 6)}`} is now connected`,
        });
      },
      onPeerDisconnected: (peerId: string) => {
        setConnectedPeers(prev => prev.filter(p => p.id !== peerId));
        toast({
          title: "Device Disconnected",
          description: `Device disconnected`,
          variant: "destructive"
        });
      },
      onFileReceived: (transfer: FileTransfer) => {
        setTransfers(prev => [...prev, transfer]);
        toast({
          title: "File Received",
          description: `Receiving ${transfer.name}`,
        });
      },
      onTransferProgress: (transferId: string, progress: number) => {
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, progress } : t
        ));
      },
      onTransferComplete: (transferId: string) => {
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'completed' as const } : t
        ));
        const transfer = transfers.find(t => t.id === transferId);
        if (transfer) {
          toast({
            title: "Transfer Complete",
            description: `${transfer.name} transferred successfully`,
          });
        }
      }
    });

    // Check for room parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam && !roomId) {
      handleJoinRoom(roomParam);
    }

    return () => {
      webrtc.disconnect();
    };
  }, [webrtc, toast, transfers, roomId, handleJoinRoom]);

  const handleCreateRoom = useCallback(async () => {
    try {
      const newRoomId = await webrtc.createRoom();
      const url = `${window.location.origin}?room=${newRoomId}`;
      setRoomId(newRoomId);
      setRoomUrl(url);
      
      toast({
        title: "Room Created",
        description: `Room ${newRoomId} is ready for connections`,
      });
    } catch (error) {
      toast({
        title: "Failed to Create Room",
        description: "Please try again",
        variant: "destructive"
      });
    }
  }, [webrtc, toast]);

  const handleNameChange = useCallback((name: string) => {
    webrtc.setLocalName(name);
  }, [webrtc]);

  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles(files);
  }, []);

  const handleSendFiles = useCallback(async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select files to send",
        variant: "destructive"
      });
      return;
    }

    if (connectedPeers.length === 0) {
      toast({
        title: "No Connected Devices",
        description: "Connect to a device first before sending files",
        variant: "destructive"
      });
      return;
    }

    for (const file of selectedFiles) {
      for (const peer of connectedPeers) {
        try {
          await webrtc.sendFile(file, peer.id);
          toast({
            title: "Transfer Started",
            description: `Sending ${file.name} to ${peer.name || peer.id.slice(0, 6)}`,
          });
        } catch (error) {
          toast({
            title: "Transfer Failed",
            description: `Failed to send ${file.name}`,
            variant: "destructive"
          });
        }
      }
    }
    
    setSelectedFiles([]);
  }, [selectedFiles, connectedPeers, webrtc, toast]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-accent/10 opacity-50" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-center mb-16"
          >
            <motion.div
              className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6 glow-effect"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Share2 className="w-10 h-10 text-accent" />
            </motion.div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Share<span className="text-accent">Drop</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Secure, fast, and simple peer-to-peer file sharing. 
              No servers, no accounts, no limits.
            </p>
            
            <div className="flex items-center justify-center space-x-8 text-sm text-muted-foreground">
              <motion.div 
                className="flex items-center space-x-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Zap className="w-5 h-5 text-accent" />
                <span>Lightning Fast</span>
              </motion.div>
              <motion.div 
                className="flex items-center space-x-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Shield className="w-5 h-5 text-accent" />
                <span>End-to-End Encrypted</span>
              </motion.div>
              <motion.div 
                className="flex items-center space-x-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Globe className="w-5 h-5 text-accent" />
                <span>Cross-Platform</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* File Drop Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card className="p-6 card-gradient border border-border/50">
              <h2 className="text-2xl font-bold text-foreground mb-6">Select Files to Share</h2>
              <FileDropZone onFilesSelected={handleFilesSelected} />
              
              <AnimatePresence>
                {selectedFiles.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-6"
                  >
                    <Button
                      onClick={handleSendFiles}
                      disabled={connectedPeers.length === 0}
                      className="w-full primary-gradient hover:opacity-90 transition-opacity"
                      size="lg"
                    >
                      Send Files ({selectedFiles.length})
                    </Button>
                    {connectedPeers.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Connect to a device first
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* Peer Discovery */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <PeerDiscovery
              localId={webrtc.getLocalId()}
              localName={webrtc.getLocalName()}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onNameChange={handleNameChange}
              connectedPeers={connectedPeers}
              roomId={roomId}
              roomUrl={roomUrl}
            />
          </motion.div>
        </div>

        {/* QR Code */}
        <AnimatePresence>
          {roomUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 flex justify-center"
            >
              <QRCodeGenerator value={roomUrl} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transfer Progress */}
        <AnimatePresence>
          {transfers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <TransferProgress transfers={transfers} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
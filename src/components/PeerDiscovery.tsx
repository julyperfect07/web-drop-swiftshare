import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Users, Smartphone, QrCode, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PeerDiscoveryProps {
  localId: string;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  connectedPeers: Array<{ id: string; name?: string }>;
  roomId?: string;
  roomUrl?: string;
}

export function PeerDiscovery({ 
  localId, 
  onCreateRoom, 
  onJoinRoom, 
  connectedPeers,
  roomId,
  roomUrl 
}: PeerDiscoveryProps) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    if (roomUrl) {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Local Network Discovery */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 card-gradient border border-border/50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Wifi className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Local Network</h3>
              <p className="text-sm text-muted-foreground">
                Devices on the same WiFi network will appear automatically
              </p>
            </div>
          </div>
          
          <AnimatePresence>
            {connectedPeers.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                {connectedPeers.map((peer, index) => (
                  <motion.div
                    key={peer.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                        <Smartphone className="w-4 h-4 text-success" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {peer.name || `Device ${peer.id.slice(0, 6)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">Connected</p>
                      </div>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-6"
              >
                <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No devices found on local network
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Room Creation/Joining */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6 card-gradient border border-border/50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <QrCode className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Cross-Network Sharing</h3>
              <p className="text-sm text-muted-foreground">
                Create or join a room to connect with remote devices
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {roomId ? (
              <motion.div
                key="room-active"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                  <p className="text-sm font-medium text-accent mb-2">
                    Room Active: {roomId}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Share this URL or QR code with others to connect
                  </p>
                  
                  <div className="flex items-center space-x-2">
                    <Input
                      value={roomUrl || ''}
                      readOnly
                      className="text-xs bg-card/50"
                    />
                    <Button
                      onClick={handleCopyUrl}
                      size="sm"
                      variant="outline"
                      className={cn(
                        "transition-all duration-200",
                        copied && "bg-success/10 border-success/20 text-success"
                      )}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="room-inactive"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                <Button 
                  onClick={onCreateRoom}
                  className="w-full primary-gradient hover:opacity-90 transition-opacity"
                  size="lg"
                >
                  Create Room
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter room ID..."
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    className="bg-card/50"
                  />
                  <Button
                    onClick={() => onJoinRoom(joinRoomId)}
                    disabled={!joinRoomId.trim()}
                    variant="outline"
                  >
                    Join
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Device Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-4 bg-muted/20 border border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Your Device ID</p>
              <p className="text-xs text-muted-foreground font-mono">{localId}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-accent" />
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
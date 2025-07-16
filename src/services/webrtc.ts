interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  name?: string;
}

interface FileTransfer {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'error';
  peerId: string;
  direction: 'send' | 'receive';
}

export class WebRTCService {
  private peers: Map<string, PeerConnection> = new Map();
  private transfers: Map<string, FileTransfer> = new Map();
  private localId: string;
  private onPeerConnected?: (peerId: string, peerName?: string) => void;
  private onPeerDisconnected?: (peerId: string) => void;
  private onFileReceived?: (transfer: FileTransfer) => void;
  private onTransferProgress?: (transferId: string, progress: number) => void;
  private onTransferComplete?: (transferId: string) => void;

  constructor() {
    this.localId = this.generateId();
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  setCallbacks(callbacks: {
    onPeerConnected?: (peerId: string, peerName?: string) => void;
    onPeerDisconnected?: (peerId: string) => void;
    onFileReceived?: (transfer: FileTransfer) => void;
    onTransferProgress?: (transferId: string, progress: number) => void;
    onTransferComplete?: (transferId: string) => void;
  }) {
    this.onPeerConnected = callbacks.onPeerConnected;
    this.onPeerDisconnected = callbacks.onPeerDisconnected;
    this.onFileReceived = callbacks.onFileReceived;
    this.onTransferProgress = callbacks.onTransferProgress;
    this.onTransferComplete = callbacks.onTransferComplete;
  }

  async createPeer(peerId: string, isInitiator: boolean = false): Promise<RTCPeerConnection> {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);
    
    const peer: PeerConnection = {
      id: peerId,
      connection: peerConnection
    };

    // Set up data channel
    if (isInitiator) {
      const dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true
      });
      peer.dataChannel = dataChannel;
      this.setupDataChannel(dataChannel, peerId);
    } else {
      peerConnection.ondatachannel = (event) => {
        peer.dataChannel = event.channel;
        this.setupDataChannel(event.channel, peerId);
      };
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage(peerId, {
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'connected') {
        this.onPeerConnected?.(peerId, peer.name);
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.peers.delete(peerId);
        this.onPeerDisconnected?.(peerId);
      }
    };

    this.peers.set(peerId, peer);
    return peerConnection;
  }

  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string) {
    dataChannel.onopen = () => {
      console.log('Data channel opened with peer:', peerId);
    };

    dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data, peerId);
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  private handleDataChannelMessage(data: any, peerId: string) {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'file-info') {
        const transfer: FileTransfer = {
          id: message.id,
          name: message.name,
          size: message.size,
          progress: 0,
          status: 'pending',
          peerId,
          direction: 'receive'
        };
        this.transfers.set(transfer.id, transfer);
        this.onFileReceived?.(transfer);
      } else if (message.type === 'file-chunk') {
        this.handleFileChunk(message);
      } else if (message.type === 'transfer-complete') {
        const transfer = this.transfers.get(message.transferId);
        if (transfer) {
          transfer.status = 'completed';
          this.onTransferComplete?.(message.transferId);
        }
      }
    } catch (error) {
      console.error('Error handling data channel message:', error);
    }
  }

  private handleFileChunk(message: any) {
    const transfer = this.transfers.get(message.transferId);
    if (!transfer) return;

    // In a real implementation, you would accumulate chunks and reconstruct the file
    const progress = (message.chunkIndex + 1) / message.totalChunks * 100;
    transfer.progress = progress;
    
    this.onTransferProgress?.(message.transferId, progress);

    if (progress >= 100) {
      transfer.status = 'completed';
      this.onTransferComplete?.(message.transferId);
    }
  }

  async sendFile(file: File, peerId: string): Promise<string> {
    const peer = this.peers.get(peerId);
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') {
      throw new Error('Peer not connected or data channel not ready');
    }

    const transferId = this.generateId();
    const transfer: FileTransfer = {
      id: transferId,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'transferring',
      peerId,
      direction: 'send'
    };

    this.transfers.set(transferId, transfer);

    // Send file info
    peer.dataChannel.send(JSON.stringify({
      type: 'file-info',
      id: transferId,
      name: file.name,
      size: file.size
    }));

    // Send file in chunks
    const chunkSize = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = await file.slice(start, end).arrayBuffer();

      peer.dataChannel.send(JSON.stringify({
        type: 'file-chunk',
        transferId,
        chunkIndex: i,
        totalChunks,
        data: Array.from(new Uint8Array(chunk))
      }));

      const progress = (i + 1) / totalChunks * 100;
      transfer.progress = progress;
      this.onTransferProgress?.(transferId, progress);
    }

    // Send completion message
    peer.dataChannel.send(JSON.stringify({
      type: 'transfer-complete',
      transferId
    }));

    transfer.status = 'completed';
    this.onTransferComplete?.(transferId);
    
    return transferId;
  }

  private sendSignalingMessage(peerId: string, message: any) {
    // In a real implementation, this would send via WebSocket or another signaling mechanism
    console.log('Signaling message to', peerId, message);
  }

  getLocalId(): string {
    return this.localId;
  }

  getPeers(): PeerConnection[] {
    return Array.from(this.peers.values());
  }

  getTransfers(): FileTransfer[] {
    return Array.from(this.transfers.values());
  }

  disconnect() {
    this.peers.forEach(peer => {
      peer.connection.close();
    });
    this.peers.clear();
    this.transfers.clear();
  }
}

export type { FileTransfer, PeerConnection };
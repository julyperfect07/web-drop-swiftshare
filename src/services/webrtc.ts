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
  private localName: string;
  private roomId?: string;
  private onPeerConnected?: (peerId: string, peerName?: string) => void;
  private onPeerDisconnected?: (peerId: string) => void;
  private onFileReceived?: (transfer: FileTransfer) => void;
  private onTransferProgress?: (transferId: string, progress: number) => void;
  private onTransferComplete?: (transferId: string) => void;
  private signalingInterval?: NodeJS.Timeout;

  constructor() {
    this.localId = this.generateId();
    this.localName = this.generateDeviceName();
  }

  private generateDeviceName(): string {
    const deviceTypes = ['Phone', 'Laptop', 'Desktop', 'Tablet'];
    const adjectives = ['Blue', 'Red', 'Green', 'Silver', 'Black', 'White'];
    const randomDevice = deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNumber = Math.floor(Math.random() * 99) + 1;
    return `${randomAdjective} ${randomDevice} ${randomNumber}`;
  }

  setLocalName(name: string): void {
    this.localName = name.trim() || this.generateDeviceName();
  }

  getLocalName(): string {
    return this.localName;
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
      console.log(`Peer ${peerId} connection state:`, state);
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

  async createRoom(): Promise<string> {
    this.roomId = this.generateId();
    console.log('Creating room:', this.roomId);
    
    // Initialize room data in HTTP storage
    try {
      const roomData = {
        id: this.roomId,
        creator: this.localId,
        creatorName: this.localName,
        peers: [{ id: this.localId, name: this.localName }],
        messages: [],
        created: Date.now()
      };
      
      await this.saveRoomData(roomData);
      this.startSignalingPolling();
    } catch (error) {
      console.log('Room creation fallback mode (for demo)');
    }
    
    return this.roomId;
  }

  async joinRoom(roomId: string): Promise<void> {
    this.roomId = roomId;
    console.log('Joining room:', roomId);
    
    try {
      // Get room data and add this peer
      const roomData = await this.getRoomData();
      if (roomData) {
        // Add this peer to the room
        const existingPeer = roomData.peers.find((p: any) => p.id === this.localId);
        if (!existingPeer) {
          roomData.peers.push({ id: this.localId, name: this.localName });
          await this.saveRoomData(roomData);
        }
        
        // Notify existing peers
        await this.sendSignalingMessage('broadcast', {
          type: 'peer-joined',
          peerId: this.localId,
          peerName: this.localName
        });
      }
      
      this.startSignalingPolling();
    } catch (error) {
      console.log('Join room fallback mode (for demo)');
      this.startSignalingPolling();
    }
  }

  private async getRoomData(): Promise<any> {
    try {
      const response = await fetch(`https://httpbin.org/cache/${this.roomId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log('Failed to get room data (expected for demo)');
    }
    return null;
  }

  private async saveRoomData(data: any): Promise<void> {
    try {
      await fetch(`https://httpbin.org/cache/${this.roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.log('Failed to save room data (expected for demo)');
    }
  }

  private startSignalingPolling() {
    if (this.signalingInterval) {
      clearInterval(this.signalingInterval);
    }

    const pollForMessages = async () => {
      try {
        const roomData = await this.getRoomData();
        if (roomData?.messages) {
          // Process unread messages
          const unreadMessages = roomData.messages.filter((msg: any) => 
            (msg.to === this.localId || msg.to === 'broadcast') && 
            msg.from !== this.localId &&
            !msg.processedBy?.includes(this.localId)
          );

          for (const message of unreadMessages) {
            console.log('Processing message:', message.type);
            await this.handleSignalingMessage(message);
            
            // Mark as processed
            message.processedBy = message.processedBy || [];
            message.processedBy.push(this.localId);
          }

          if (unreadMessages.length > 0) {
            await this.saveRoomData(roomData);
          }
        }
      } catch (error) {
        // Expected to fail in demo environment
        console.log('Signaling poll failed (expected for demo)');
      }
    };

    // Poll every 3 seconds
    this.signalingInterval = setInterval(pollForMessages, 3000);
    
    // Initial poll
    pollForMessages();
  }

  private async handleSignalingMessage(message: any): Promise<void> {
    const { type, from, offer, answer, candidate, peerName } = message;

    console.log('Handling signaling message:', type, 'from:', from);

    switch (type) {
      case 'peer-joined':
        if (from !== this.localId) {
          await this.createPeer(from, true);
          const peer = this.peers.get(from);
          if (peer) {
            peer.name = peerName;
            const offer = await peer.connection.createOffer();
            await peer.connection.setLocalDescription(offer);
            await this.sendSignalingMessage(from, { type: 'offer', offer });
          }
        }
        break;

      case 'offer':
        if (from !== this.localId) {
          const peer = await this.createPeer(from, false);
          const peerObj = this.peers.get(from);
          if (peerObj) {
            peerObj.name = peerName;
          }
          await peer.setRemoteDescription(offer);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await this.sendSignalingMessage(from, { type: 'answer', answer });
        }
        break;

      case 'answer':
        const peer = this.peers.get(from);
        if (peer) {
          await peer.connection.setRemoteDescription(answer);
        }
        break;

      case 'ice-candidate':
        const targetPeer = this.peers.get(from);
        if (targetPeer) {
          await targetPeer.connection.addIceCandidate(candidate);
        }
        break;
    }
  }

  private async sendSignalingMessage(peerId: string, message: any) {
    try {
      const roomData = await this.getRoomData() || { messages: [] };
      
      const signalMessage = {
        ...message,
        from: this.localId,
        to: peerId,
        peerName: this.localName,
        timestamp: Date.now(),
        processedBy: []
      };

      roomData.messages = roomData.messages || [];
      roomData.messages.push(signalMessage);
      
      await this.saveRoomData(roomData);
      console.log('Sent signaling message:', message.type, 'to:', peerId);
    } catch (error) {
      console.log('Failed to send signaling message (expected for demo)');
    }
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
      if (peer.connection && typeof peer.connection.close === 'function') {
        peer.connection.close();
      }
    });
    this.peers.clear();
    this.transfers.clear();
    
    if (this.signalingInterval) {
      clearInterval(this.signalingInterval);
      this.signalingInterval = undefined;
    }
  }
}

export type { FileTransfer, PeerConnection };
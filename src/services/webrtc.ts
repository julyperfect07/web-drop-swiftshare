import { v4 as uuidv4 } from 'uuid';

export interface FileTransfer {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed';
  blob?: Blob;
}

interface WebRTCCallbacks {
  onPeerConnected?: (peerId: string, peerName?: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onFileReceived?: (transfer: FileTransfer) => void;
  onTransferProgress?: (transferId: string, progress: number) => void;
  onTransferComplete?: (transferId: string) => void;
}

interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';
  from: string;
  to?: string;
  data: any;
  fromName?: string;
  timestamp: number;
}

interface RoomData {
  id: string;
  creator: string;
  creatorName: string;
  peers: Array<{ id: string; name: string }>;
  messages: SignalMessage[];
  created: number;
}

export class WebRTCService {
  private localId: string;
  private localName: string;
  private roomId?: string;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private callbacks: WebRTCCallbacks = {};
  private signalingInterval?: number;
  private lastMessageIndex = 0;

  constructor() {
    this.localId = uuidv4().substring(0, 9);
    this.localName = this.generateRandomName();
  }

  private generateRandomName(): string {
    const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Cyan'];
    const devices = ['Phone', 'Laptop', 'Desktop', 'Tablet', 'Computer', 'Device'];
    const numbers = Math.floor(Math.random() * 100);
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];
    
    return `${color} ${device} ${numbers}`;
  }

  getLocalId(): string {
    return this.localId;
  }

  getLocalName(): string {
    return this.localName;
  }

  setLocalName(name: string): void {
    this.localName = name;
  }

  setCallbacks(callbacks: WebRTCCallbacks): void {
    this.callbacks = callbacks;
  }

  async createRoom(): Promise<string> {
    this.roomId = uuidv4().substring(0, 9);
    console.log('Creating room:', this.roomId);
    
    // Initialize room in localStorage
    const roomData: RoomData = {
      id: this.roomId,
      creator: this.localId,
      creatorName: this.localName,
      peers: [{ id: this.localId, name: this.localName }],
      messages: [],
      created: Date.now()
    };
    
    try {
      localStorage.setItem(`sharerooms_${this.roomId}`, JSON.stringify(roomData));
    } catch (error) {
      console.log('Failed to save room data to localStorage');
    }
    
    this.startSignaling();
    return this.roomId;
  }

  async joinRoom(roomId: string): Promise<void> {
    this.roomId = roomId;
    console.log('Joining room:', roomId);
    
    // Add self to room data
    try {
      const roomDataStr = localStorage.getItem(`sharerooms_${roomId}`);
      let roomData: RoomData;
      
      if (roomDataStr) {
        roomData = JSON.parse(roomDataStr);
      } else {
        // Create new room data if not exists
        roomData = {
          id: roomId,
          creator: this.localId,
          creatorName: this.localName,
          peers: [],
          messages: [],
          created: Date.now()
        };
      }
      
      // Add self to peers list if not already there
      const existingPeerIndex = roomData.peers.findIndex(p => p.id === this.localId);
      if (existingPeerIndex === -1) {
        roomData.peers.push({ id: this.localId, name: this.localName });
        localStorage.setItem(`sharerooms_${roomId}`, JSON.stringify(roomData));
      }
    } catch (error) {
      console.log('Failed to join room in localStorage');
    }

    // Send join message
    await this.sendSignalMessage({
      type: 'join',
      from: this.localId,
      data: {},
      fromName: this.localName,
      timestamp: Date.now()
    });

    this.startSignaling();
  }

  private startSignaling(): void {
    if (this.signalingInterval) {
      clearInterval(this.signalingInterval);
    }

    // Poll for messages every 2 seconds
    this.signalingInterval = window.setInterval(() => {
      this.pollForMessages();
    }, 2000);
    
    // Initial poll
    this.pollForMessages();
  }

  private async sendSignalMessage(message: SignalMessage): Promise<void> {
    if (!this.roomId) return;

    try {
      const roomDataStr = localStorage.getItem(`sharerooms_${this.roomId}`);
      if (roomDataStr) {
        const roomData: RoomData = JSON.parse(roomDataStr);
        roomData.messages.push(message);
        localStorage.setItem(`sharerooms_${this.roomId}`, JSON.stringify(roomData));
      }
    } catch (error) {
      console.log('Failed to send signal message:', error);
    }
  }

  private pollForMessages(): void {
    if (!this.roomId) return;

    try {
      const roomDataStr = localStorage.getItem(`sharerooms_${this.roomId}`);
      if (!roomDataStr) return;

      const roomData: RoomData = JSON.parse(roomDataStr);
      const newMessages = roomData.messages.slice(this.lastMessageIndex);
      
      for (const message of newMessages) {
        if (message.from !== this.localId) {
          this.handleSignalMessage(message);
        }
      }
      
      this.lastMessageIndex = roomData.messages.length;
    } catch (error) {
      console.log('Failed to poll messages:', error);
    }
  }

  private async handleSignalMessage(message: SignalMessage): Promise<void> {
    console.log('Received signal message:', message.type, 'from:', message.from);

    switch (message.type) {
      case 'join':
        console.log('Peer joined:', message.from, message.fromName);
        this.callbacks.onPeerConnected?.(message.from, message.fromName);
        // Initiate connection as the existing peer
        if (!this.peers.has(message.from)) {
          await this.createPeerConnection(message.from, true);
        }
        break;

      case 'offer':
        if (message.to === this.localId || !message.to) {
          await this.handleOffer(message.from, message.data, message.fromName);
        }
        break;

      case 'answer':
        if (message.to === this.localId) {
          await this.handleAnswer(message.from, message.data);
        }
        break;

      case 'ice-candidate':
        if (message.to === this.localId) {
          await this.handleIceCandidate(message.from, message.data);
        }
        break;

      case 'leave':
        this.handlePeerLeave(message.from);
        break;
    }
  }

  private async createPeerConnection(peerId: string, initiator: boolean): Promise<void> {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(config);
    this.peers.set(peerId, peerConnection);

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalMessage({
          type: 'ice-candidate',
          from: this.localId,
          to: peerId,
          data: event.candidate,
          fromName: this.localName,
          timestamp: Date.now()
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        console.log(`Successfully connected to peer ${peerId}`);
      } else if (peerConnection.connectionState === 'disconnected' || 
          peerConnection.connectionState === 'failed') {
        this.handlePeerLeave(peerId);
      }
    };

    if (initiator) {
      // Create data channel
      const dataChannel = peerConnection.createDataChannel('fileTransfer');
      this.setupDataChannel(dataChannel, peerId);
      this.dataChannels.set(peerId, dataChannel);

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await this.sendSignalMessage({
        type: 'offer',
        from: this.localId,
        to: peerId,
        data: offer,
        fromName: this.localName,
        timestamp: Date.now()
      });
    } else {
      // Handle incoming data channels
      peerConnection.ondatachannel = (event) => {
        const dataChannel = event.channel;
        this.setupDataChannel(dataChannel, peerId);
        this.dataChannels.set(peerId, dataChannel);
      };
    }
  }

  private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit, peerName?: string): Promise<void> {
    let peerConnection = this.peers.get(peerId);
    
    if (!peerConnection) {
      await this.createPeerConnection(peerId, false);
      peerConnection = this.peers.get(peerId)!;
    }

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await this.sendSignalMessage({
      type: 'answer',
      from: this.localId,
      to: peerId,
      data: answer,
      fromName: this.localName,
      timestamp: Date.now()
    });

    this.callbacks.onPeerConnected?.(peerId, peerName);
  }

  private async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peerConnection = this.peers.get(peerId);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(answer);
    }
  }

  private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnection = this.peers.get(peerId);
    if (peerConnection) {
      await peerConnection.addIceCandidate(candidate);
    }
  }

  private handlePeerLeave(peerId: string): void {
    const peerConnection = this.peers.get(peerId);
    if (peerConnection) {
      peerConnection.close();
    }
    this.peers.delete(peerId);
    this.dataChannels.delete(peerId);
    this.callbacks.onPeerDisconnected?.(peerId);
  }

  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`);
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'file-chunk') {
          this.handleFileChunk(message);
        } else if (message.type === 'file-start') {
          this.handleFileStart(message);
        } else if (message.type === 'file-end') {
          this.handleFileEnd(message);
        }
      } catch (error) {
        console.error('Failed to parse data channel message:', error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  private receivedFiles: Map<string, { transfer: FileTransfer; chunks: Uint8Array[] }> = new Map();

  private handleFileStart(message: any): void {
    const transfer: FileTransfer = {
      id: message.id,
      name: message.name,
      size: message.size,
      type: message.mimeType || 'application/octet-stream',
      progress: 0,
      status: 'transferring'
    };

    this.receivedFiles.set(message.id, { transfer, chunks: [] });
    this.callbacks.onFileReceived?.(transfer);
  }

  private handleFileChunk(message: any): void {
    const fileData = this.receivedFiles.get(message.id);
    if (fileData) {
      const chunk = new Uint8Array(message.chunk);
      fileData.chunks.push(chunk);
      
      const totalReceived = fileData.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const progress = Math.round((totalReceived / fileData.transfer.size) * 100);
      
      this.callbacks.onTransferProgress?.(message.id, progress);
    }
  }

  private handleFileEnd(message: any): void {
    const fileData = this.receivedFiles.get(message.id);
    if (fileData) {
      // Combine all chunks into a single blob
      const totalSize = fileData.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of fileData.chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const blob = new Blob([combined], { type: fileData.transfer.type });
      fileData.transfer.blob = blob;
      fileData.transfer.status = 'completed';
      
      this.callbacks.onTransferComplete?.(message.id);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileData.transfer.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.receivedFiles.delete(message.id);
    }
  }

  async sendFile(file: File, peerId: string): Promise<void> {
    const dataChannel = this.dataChannels.get(peerId);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const transferId = uuidv4();
    const chunkSize = 16384; // 16KB chunks

    // Send file start message
    dataChannel.send(JSON.stringify({
      type: 'file-start',
      id: transferId,
      name: file.name,
      size: file.size,
      mimeType: file.type
    }));

    // Send file in chunks
    const reader = new FileReader();
    let offset = 0;

    const sendNextChunk = () => {
      const slice = file.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (event) => {
      if (event.target?.result) {
        const chunk = new Uint8Array(event.target.result as ArrayBuffer);
        
        dataChannel.send(JSON.stringify({
          type: 'file-chunk',
          id: transferId,
          chunk: Array.from(chunk)
        }));

        offset += chunk.length;
        const progress = Math.round((offset / file.size) * 100);
        this.callbacks.onTransferProgress?.(transferId, progress);

        if (offset < file.size) {
          sendNextChunk();
        } else {
          // Send file end message
          dataChannel.send(JSON.stringify({
            type: 'file-end',
            id: transferId
          }));
          this.callbacks.onTransferComplete?.(transferId);
        }
      }
    };

    sendNextChunk();
  }

  disconnect(): void {
    if (this.signalingInterval) {
      clearInterval(this.signalingInterval);
      this.signalingInterval = undefined;
    }

    // Send leave message
    if (this.roomId) {
      this.sendSignalMessage({
        type: 'leave',
        from: this.localId,
        data: {},
        fromName: this.localName,
        timestamp: Date.now()
      });
    }

    // Close all peer connections
    for (const peerConnection of this.peers.values()) {
      peerConnection.close();
    }
    this.peers.clear();
    this.dataChannels.clear();
    this.lastMessageIndex = 0;
  }
}
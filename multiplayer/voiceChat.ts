// VoiceMeshController — raw browser WebRTC P2P mesh for voice chat.
// Signaling rides the existing PartyKit WS via rtc_signal C2S/S2C messages.
// No third-party services; uses Google's free public STUN.

import type { C2S, S2C } from './protocol';

type RtcSignalIn = Extract<S2C, { type: 'rtc_signal' }>;
type SendFn = (msg: C2S) => void;

export type PeerConnectionFactory = (
  config: RTCConfiguration
) => RTCPeerConnection;

const DEFAULT_ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type VoiceMeshDeps = {
  /** Per-platform RTCPeerConnection constructor — override for tests. */
  PeerConnection?: PeerConnectionFactory;
  /** getUserMedia — override for tests. Default uses navigator.mediaDevices. */
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  /** Called whenever a remote stream is ready/updated for a given peer. */
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  /** Optional override for the WebRTC config (e.g. additional STUN/TURN). */
  rtcConfig?: RTCConfiguration;
};

/** Coordinates RTCPeerConnection objects keyed by remote playerId. Glare
 *  is avoided by the deterministic rule: the lexicographically smaller
 *  playerId issues the offer. */
export class VoiceMeshController {
  private pcs: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private send: SendFn;
  private myId: string;
  private deps: Required<Pick<VoiceMeshDeps, 'rtcConfig'>> & VoiceMeshDeps;

  constructor(send: SendFn, myPlayerId: string, deps: VoiceMeshDeps = {}) {
    this.send = send;
    this.myId = myPlayerId;
    this.deps = { rtcConfig: DEFAULT_ICE, ...deps };
  }

  hasLocalStream(): boolean {
    return this.localStream != null;
  }

  /** Acquire mic + connect to each peer in `peers`. Idempotent — safe to
   *  call again when the peer set grows. */
  async start(peers: string[]): Promise<void> {
    if (!this.localStream) {
      const getMedia =
        this.deps.getUserMedia ??
        ((c) => navigator.mediaDevices.getUserMedia(c));
      this.localStream = await getMedia({ audio: true, video: false });
    }
    for (const peer of peers) {
      if (peer === this.myId) continue;
      if (this.pcs.has(peer)) continue;
      const pc = this.createPeer(peer);
      this.pcs.set(peer, pc);
      // Deterministic offer initiator: smaller id wins. The other side
      // accepts the offer when it arrives in handleSignal.
      if (this.myId < peer) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.send({
          type: 'rtc_signal',
          to: peer,
          kind: 'offer',
          sdp: offer.sdp,
        });
      }
    }
  }

  /** Tear down all connections and release the mic. */
  stop(): void {
    for (const pc of this.pcs.values()) {
      try {
        pc.close();
      } catch {
        // ignore close errors
      }
    }
    this.pcs.clear();
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop();
      this.localStream = null;
    }
  }

  /** Drop any peer connections that aren't in the current peer set. */
  pruneAbsent(peers: Set<string>): void {
    for (const id of [...this.pcs.keys()]) {
      if (!peers.has(id)) {
        this.pcs.get(id)?.close();
        this.pcs.delete(id);
      }
    }
  }

  /** Enable or disable the local mic track. */
  setMuted(muted: boolean): void {
    if (!this.localStream) return;
    for (const t of this.localStream.getAudioTracks()) {
      t.enabled = !muted;
    }
  }

  /** Apply a signaling payload received from the server. */
  async handleSignal(msg: RtcSignalIn): Promise<void> {
    const peer = msg.from;
    let pc = this.pcs.get(peer);
    if (!pc) {
      pc = this.createPeer(peer);
      this.pcs.set(peer, pc);
    }
    if (msg.kind === 'offer' && msg.sdp) {
      await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      this.send({ type: 'rtc_signal', to: peer, kind: 'answer', sdp: ans.sdp });
    } else if (msg.kind === 'answer' && msg.sdp) {
      await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
    } else if (msg.kind === 'ice' && msg.candidate) {
      try {
        await pc.addIceCandidate(msg.candidate as RTCIceCandidateInit);
      } catch {
        // best-effort; some candidates fail in headless / mock contexts
      }
    }
  }

  private createPeer(peerId: string): RTCPeerConnection {
    const Ctor =
      this.deps.PeerConnection ??
      ((cfg: RTCConfiguration) => new RTCPeerConnection(cfg));
    const pc = Ctor(this.deps.rtcConfig);
    // Add local audio tracks so the peer can receive.
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) {
        pc.addTrack(t, this.localStream);
      }
    }
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.send({
          type: 'rtc_signal',
          to: peerId,
          kind: 'ice',
          candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate,
        });
      }
    };
    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      this.deps.onRemoteStream?.(peerId, stream);
    };
    return pc;
  }
}

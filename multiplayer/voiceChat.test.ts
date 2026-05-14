import { describe, it, expect, vi } from 'vitest';
import { VoiceMeshController } from './voiceChat';

function makeMockPc(): RTCPeerConnection {
  const pc = {
    createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'OFFER_SDP' })),
    createAnswer: vi.fn(async () => ({ type: 'answer', sdp: 'ANSWER_SDP' })),
    setLocalDescription: vi.fn(async () => {}),
    setRemoteDescription: vi.fn(async () => {}),
    addIceCandidate: vi.fn(async () => {}),
    addTrack: vi.fn(),
    close: vi.fn(),
    onicecandidate: null,
    ontrack: null,
  };
  return pc as unknown as RTCPeerConnection;
}

function makeStream(): MediaStream {
  const tracks: Array<{ stop: () => void; enabled: boolean }> = [
    { stop: vi.fn(), enabled: true },
  ];
  return {
    getTracks: () => tracks as unknown as MediaStreamTrack[],
    getAudioTracks: () => tracks as unknown as MediaStreamTrack[],
  } as unknown as MediaStream;
}

describe('VoiceMeshController', () => {
  it('lower-id initiates offer to each new peer', async () => {
    const sends: { type: string; to?: string; kind?: string }[] = [];
    const send = (m: { type: string; [k: string]: unknown }) => {
      sends.push(m as { type: string; to?: string; kind?: string });
    };
    const pcs: RTCPeerConnection[] = [];
    const vmc = new VoiceMeshController(send as never, 'aaa', {
      PeerConnection: () => {
        const pc = makeMockPc();
        pcs.push(pc);
        return pc;
      },
      getUserMedia: async () => makeStream(),
    });
    await vmc.start(['bbb', 'ccc']); // 'aaa' < both → offers both
    const offers = sends.filter((s) => s.kind === 'offer');
    expect(offers.map((o) => o.to).sort()).toEqual(['bbb', 'ccc']);
  });

  it('higher-id does NOT initiate; only responds when an offer arrives', async () => {
    const sends: { type: string; to?: string; kind?: string }[] = [];
    const vmc = new VoiceMeshController(
      ((m: { type: string }) => sends.push(m as never)) as never,
      'zzz',
      {
        PeerConnection: () => makeMockPc(),
        getUserMedia: async () => makeStream(),
      }
    );
    await vmc.start(['aaa']);
    expect(sends.filter((s) => s.kind === 'offer')).toHaveLength(0);

    await vmc.handleSignal({
      type: 'rtc_signal',
      from: 'aaa',
      kind: 'offer',
      sdp: 'OFFER',
    });
    const answer = sends.find((s) => s.kind === 'answer');
    expect(answer).toBeDefined();
    expect(answer?.to).toBe('aaa');
  });

  it('forwards ICE candidates from local PC', async () => {
    const sends: { type: string; to?: string; kind?: string; candidate?: unknown }[] = [];
    const pcs: RTCPeerConnection[] = [];
    const vmc = new VoiceMeshController(
      ((m: { type: string }) => sends.push(m as never)) as never,
      'aaa',
      {
        PeerConnection: () => {
          const pc = makeMockPc();
          pcs.push(pc);
          return pc;
        },
        getUserMedia: async () => makeStream(),
      }
    );
    await vmc.start(['bbb']);
    // Simulate the browser firing an ICE candidate
    const pc = pcs[0];
    const cand = { candidate: 'a=ice', sdpMLineIndex: 0 } as unknown as RTCIceCandidate;
    (cand as unknown as { toJSON: () => unknown }).toJSON = () => cand;
    pc.onicecandidate?.({ candidate: cand } as RTCPeerConnectionIceEvent);
    const ice = sends.find((s) => s.kind === 'ice');
    expect(ice).toBeDefined();
    expect(ice?.to).toBe('bbb');
    expect(ice?.candidate).toBeDefined();
  });

  it('mute disables all local audio tracks', async () => {
    const stream = makeStream();
    const vmc = new VoiceMeshController(((_: unknown) => {}) as never, 'aaa', {
      PeerConnection: () => makeMockPc(),
      getUserMedia: async () => stream,
    });
    await vmc.start(['bbb']);
    vmc.setMuted(true);
    for (const t of stream.getAudioTracks()) {
      expect((t as unknown as { enabled: boolean }).enabled).toBe(false);
    }
    vmc.setMuted(false);
    for (const t of stream.getAudioTracks()) {
      expect((t as unknown as { enabled: boolean }).enabled).toBe(true);
    }
  });

  it('stop closes peer connections and stops tracks', async () => {
    const tracks = [{ stop: vi.fn(), enabled: true }];
    const stream = {
      getTracks: () => tracks as unknown as MediaStreamTrack[],
      getAudioTracks: () => tracks as unknown as MediaStreamTrack[],
    } as unknown as MediaStream;
    const pcs: RTCPeerConnection[] = [];
    const vmc = new VoiceMeshController(((_: unknown) => {}) as never, 'aaa', {
      PeerConnection: () => {
        const pc = makeMockPc();
        pcs.push(pc);
        return pc;
      },
      getUserMedia: async () => stream,
    });
    await vmc.start(['bbb', 'ccc']);
    vmc.stop();
    expect(pcs.every((pc) => (pc.close as unknown as { mock: { calls: unknown[] } }).mock.calls.length === 1)).toBe(true);
    expect(tracks[0].stop).toHaveBeenCalled();
  });
});

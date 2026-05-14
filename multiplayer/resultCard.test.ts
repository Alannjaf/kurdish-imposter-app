import { describe, it, expect, vi } from 'vitest';
import { exportResultCardAsPng } from './resultCard';

describe('exportResultCardAsPng', () => {
  it('returns ok=false when element missing', async () => {
    const r = await exportResultCardAsPng('missing', 'card.png', {
      getElementById: () => null,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it('captures the element, generates a data URL, and triggers download', async () => {
    const fakeEl = { _kind: 'fake-element' } as unknown as HTMLElement;
    const fakeCanvas = {
      toDataURL: vi.fn(() => 'data:image/png;base64,AAAA'),
    } as unknown as HTMLCanvasElement;
    const h2c = vi.fn(async () => fakeCanvas);
    const triggerDownload = vi.fn();

    const r = await exportResultCardAsPng('card', 'my-round.png', {
      getElementById: () => fakeEl,
      html2canvas: h2c,
      triggerDownload,
    });
    expect(r.ok).toBe(true);
    expect(h2c).toHaveBeenCalledWith(fakeEl);
    expect(triggerDownload).toHaveBeenCalledWith(
      'my-round.png',
      'data:image/png;base64,AAAA'
    );
  });

  it('returns ok=false when html2canvas throws', async () => {
    const fakeEl = {} as HTMLElement;
    const r = await exportResultCardAsPng('card', 'x.png', {
      getElementById: () => fakeEl,
      html2canvas: () => Promise.reject(new Error('boom')),
      triggerDownload: vi.fn(),
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('boom');
  });
});

import { describe, it, expect } from 'vitest';
import { buildWhatsAppShareUrl, fillShareTemplate } from './shareLink';

describe('shareLink helpers', () => {
  it('builds a wa.me URL with the text encoded', () => {
    const url = buildWhatsAppShareUrl('ABCD', 'Join: ABCD https://x');
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toBe('Join: ABCD https://x');
  });

  it('encodes spaces, newlines, and special chars', () => {
    const url = buildWhatsAppShareUrl('ZZZZ', 'Hi & welcome!\nCode: ZZZZ');
    expect(url).toContain('%20'); // space
    expect(url).toContain('%0A'); // newline
    expect(url).toContain('%26'); // ampersand
  });

  it('fills {code} placeholders', () => {
    expect(fillShareTemplate('Code: {code}', { code: 'WXYZ' })).toBe('Code: WXYZ');
    expect(fillShareTemplate('No code', { code: 'ABCD' })).toBe('No code');
    expect(fillShareTemplate('{code} and {code}', { code: 'XY' })).toBe('XY and XY');
  });
});

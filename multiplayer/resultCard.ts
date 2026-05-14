// Result-card PNG export — wraps html2canvas (free MIT-licensed OSS) and
// triggers a browser download. Web-only; native callers should fall back to
// react-native-view-shot or skip (no-op).

export type ExportDeps = {
  /** html2canvas (or compatible function) — injected for tests. */
  html2canvas?: (el: HTMLElement) => Promise<HTMLCanvasElement>;
  /** document.getElementById equivalent — injected for tests. */
  getElementById?: (id: string) => HTMLElement | null;
  /** Triggers a download. Default: anchor click in DOM. Override for tests. */
  triggerDownload?: (filename: string, dataUrl: string) => void;
};

export async function exportResultCardAsPng(
  elementId: string,
  filename: string,
  deps: ExportDeps = {}
): Promise<{ ok: boolean; error?: string }> {
  const getEl =
    deps.getElementById ??
    ((id: string) =>
      typeof document !== 'undefined' ? document.getElementById(id) : null);
  const el = getEl(elementId);
  if (!el) return { ok: false, error: 'Element not found' };

  let h2c: ((el: HTMLElement) => Promise<HTMLCanvasElement>) | undefined = deps.html2canvas;
  if (!h2c) {
    if (typeof window === 'undefined') {
      return { ok: false, error: 'html2canvas requires a browser' };
    }
    try {
      // Lazy-load to avoid pulling DOM-only code into the native bundle path.
      const mod = (await import('html2canvas')) as unknown as
        | ((el: HTMLElement) => Promise<HTMLCanvasElement>)
        | { default: (el: HTMLElement) => Promise<HTMLCanvasElement> };
      h2c = typeof mod === 'function' ? mod : mod.default;
    } catch (e) {
      return { ok: false, error: 'html2canvas unavailable: ' + String(e) };
    }
  }
  if (!h2c) return { ok: false, error: 'html2canvas resolver missing' };

  try {
    const canvas = await h2c(el);
    const dataUrl = canvas.toDataURL('image/png');
    const download =
      deps.triggerDownload ??
      ((name: string, url: string) => {
        if (typeof document === 'undefined') return;
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    download(filename, dataUrl);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

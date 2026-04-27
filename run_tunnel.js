// Keep localtunnel alive — the CLI exits on Windows when stdin goes away.
// This wrapper holds the event loop open explicitly.
const localtunnel = require('localtunnel');

(async () => {
  while (true) {
    try {
      const tunnel = await localtunnel({ port: 8081, subdomain: 'kurdish-imposter' });
      console.log('url is:', tunnel.url);
      await new Promise((resolve) => {
        tunnel.on('close', () => {
          console.log('tunnel closed, will reconnect');
          resolve();
        });
        tunnel.on('error', (err) => {
          console.log('tunnel error:', err && err.message);
        });
      });
    } catch (e) {
      console.log('connect error:', e && e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
})();

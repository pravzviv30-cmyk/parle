/** One POST for the HTTP survival proof. Resolves with the status code, or 'reset' when the
 * server cuts the connection while the body is still being written (it may refuse an oversized
 * body mid-upload). A cut after the whole body was sent, and every other error, the 3 s fixture
 * timeout included, rejects. */
import { request } from 'node:http';

const CUT = new Set(['EPIPE', 'ECONNRESET']);

export function exchange(port, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    let status;
    let sent = false;
    const failed = error => (status !== undefined && CUT.has(error.code) ? resolve(status)
      : !sent && CUT.has(error.code) ? resolve('reset') : reject(error));
    const req = request({ hostname: '127.0.0.1', port, path, method: 'POST', headers }, res => {
      status = res.statusCode;
      res.once('error', failed); res.resume(); res.once('end', () => resolve(status));
    });
    req.setTimeout(3000, () => req.destroy(new Error('fixture timeout')));
    req.on('error', failed);
    // The socket-level write callback: it reports an error when the server cut the upload.
    req.write(body, error => { if (!error) sent = true; }); req.end();
  });
}

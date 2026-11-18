/** One POST for the HTTP survival proof. Resolves with the status code, or 'reset' when the
 * server cuts the connection before answering (it may refuse an oversized body mid-upload).
 * Every other error, the 3 s fixture timeout included, rejects. */
import { request } from 'node:http';

const CUT = new Set(['EPIPE', 'ECONNRESET']);

export function exchange(port, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    let status;
    const failed = error => (CUT.has(error.code) ? resolve(status ?? 'reset') : reject(error));
    const req = request({ hostname: '127.0.0.1', port, path, method: 'POST', headers }, res => {
      status = res.statusCode;
      res.once('error', failed); res.resume(); res.once('end', () => resolve(status));
    });
    req.setTimeout(3000, () => req.destroy(new Error('fixture timeout')));
    req.on('error', failed); req.end(body);
  });
}

/** One POST for the HTTP survival proof. Resolves with the status code. An overflow upload is
 * sent with { unfinished: true }: its body is written but the request is never ended, so a
 * reset before any response can only be the server cutting the upload, and resolves 'reset'.
 * A reset on a finished request rejects, because the server may have read the whole body. A
 * reset after the response headers resolves with that status. Every other error, the 3 s
 * fixture timeout included, rejects. Every settle destroys the request. */
import { request } from 'node:http';

const CUT = new Set(['EPIPE', 'ECONNRESET']);

export function exchange(port, path, body, headers = {}, { unfinished = false } = {}) {
  return new Promise((resolve, reject) => {
    let status;
    const settle = (done, value) => { done(value); req.destroy(); };
    const failed = error => (status !== undefined && CUT.has(error.code) ? settle(resolve, status)
      : unfinished && CUT.has(error.code) ? settle(resolve, 'reset') : settle(reject, error));
    const req = request({ hostname: '127.0.0.1', port, path, method: 'POST', headers }, res => {
      status = res.statusCode;
      res.once('error', failed); res.resume(); res.once('end', () => settle(resolve, status));
    });
    req.setTimeout(3000, () => req.destroy(new Error('fixture timeout')));
    req.on('error', failed);
    if (unfinished) req.write(body); else req.end(body);
  });
}

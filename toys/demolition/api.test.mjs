import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { validateCaptureUrl, isPublicAddress, imageType, handleDemolitionRequest } from './api.mjs'

const publicDNS = async () => [{ address: '93.184.216.34' }]
assert.equal(await validateCaptureUrl('example.com/a?q=one%20two#section', publicDNS), 'https://example.com/a?q=one%20two')
assert.equal(await validateCaptureUrl('example.com/?next=https://other.com', publicDNS), 'https://example.com/?next=https://other.com')
assert.equal(await validateCaptureUrl('https://example.com:443', publicDNS), 'https://example.com/')
for (const input of ['', 'file:///etc/passwd', 'ftp://example.com', 'custom.scheme://example.com', 'javascript:alert(1)', 'http://name:secret@example.com', 'https://example.com:8080', 'localhost', 'http://2130706433', 'http://127.1', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'http://192.168.1.1', 'http://169.254.169.254']) {
  await assert.rejects(validateCaptureUrl(input, publicDNS), Error, input)
}
await assert.rejects(validateCaptureUrl('https://example.com', async () => [{ address: '93.184.216.34' }, { address: '10.0.0.1' }]))
await assert.rejects(validateCaptureUrl('https://example.com', async () => { throw new Error('ENOTFOUND') }))
for (const address of ['0.0.0.0', '10.0.0.1', '100.64.0.1', '172.31.0.1', '192.168.0.1', '224.0.0.1', '::1', 'fd00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::']) assert.equal(isPublicAddress(address), false, address)
for (const address of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address)
assert.equal(imageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png')
assert.equal(imageType(Buffer.from('<html>provider error</html>')), null)

// Closing the caller must abort the provider fetch and release the next capture.
const originalFetch = globalThis.fetch
const response = () => Object.assign(new EventEmitter(), {
  destroyed: false, writableEnded: false,
  writeHead(status) { this.status = status; return this },
  end(body) { this.body = body; this.writableEnded = true },
})
try {
  let started
  const fetched = new Promise(resolve => { started = resolve })
  globalThis.fetch = (_, { signal }) => new Promise((resolve, reject) => {
    signal.throwIfAborted()
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    started(signal)
  })
  const req = { url: '/api/demolition/capture?url=https://8.8.8.8', method: 'GET', headers: { host: 'localhost:4173' } }
  const cancelled = response(), first = handleDemolitionRequest(req, cancelled)
  const upstreamSignal = await fetched
  cancelled.destroyed = true; cancelled.emit('close')
  assert.equal(await first, true)
  assert.equal(upstreamSignal.aborted, true)
  assert.equal(cancelled.status, undefined)
  assert.equal(cancelled.listenerCount('close'), 0)
  globalThis.fetch = async () => new Response(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const next = response()
  await handleDemolitionRequest(req, next)
  assert.equal(next.status, 200)
  assert.equal(next.listenerCount('close'), 0)
} finally { globalThis.fetch = originalFetch }
console.log('demolition URL validation, image response and cancellation checks passed')

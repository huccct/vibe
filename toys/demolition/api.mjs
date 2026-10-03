import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

const blocked = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
]) blocked.addSubnet(address, prefix)
const globalIPv6 = new BlockList()
globalIPv6.addSubnet('2000::', 3, 'ipv6')
for (const [address, prefix] of [
  ['2001::', 32], ['2001:2::', 48], ['2001:10::', 28], ['2001:20::', 28],
  ['2001:db8::', 32], ['2002::', 16],
]) blocked.addSubnet(address, prefix, 'ipv6')

export function isPublicAddress(address) {
  const version = isIP(address)
  return version === 4 ? !blocked.check(address, 'ipv4')
    : version === 6 && globalIPv6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
}

function fail(message, status = 400) { return Object.assign(new Error(message), { status }) }

export async function validateCaptureUrl(input, resolve = lookup) {
  if (typeof input !== 'string' || !input.trim() || input.length > 2048) throw fail('请输入有效的公开网址')
  let url
  try { url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`) }
  catch { throw fail('网址格式不正确') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw fail('仅支持不含账号密码、使用默认端口的 HTTP / HTTPS 网址')
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!hostname.includes('.') && !isIP(hostname) || /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(hostname)) throw fail('请使用公开网站；本机和内网地址无法截图')
  let timer
  try {
    const addresses = isIP(hostname) ? [{ address: hostname }] : await Promise.race([
      resolve(hostname, { all: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(fail('网址解析超时，请重试', 504)), 8000) }),
    ])
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw fail('请使用公开网站；本机和内网地址无法截图')
  } catch (error) { throw error.status ? error : fail('找不到这个网站，请检查域名') }
  finally { clearTimeout(timer) }
  url.hash = ''
  return url.href
}

export function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())) return 'image/gif'
  return null
}

export async function captureWebsite(url, signal) {
  // ponytail: a fixed screenshot provider keeps this toy dependency-free; use an owned renderer if provider limits become a problem.
  let response
  try {
    response = await fetch(`https://image.thum.io/get/noanimate/width/1280/crop/800/${url}`, {
      redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45_000)]) : AbortSignal.timeout(45_000),
    })
    if (!response.ok || Number(response.headers.get('thum_status_code')) >= 400) throw fail('这个网站暂时无法截图，可换个网址或上传截图', 502)
    const chunks = []
    let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > 8_000_000) throw fail('网页截图过大，请上传本地截图', 413)
      chunks.push(chunk)
    }
    const bytes = Buffer.concat(chunks)
    const type = imageType(bytes)
    if (!type) throw fail('截图服务没有返回有效图片，请稍后重试', 502)
    return { bytes, type }
  } catch (error) {
    try { await response?.body?.cancel() } catch {}
    if (signal?.aborted) throw signal.reason
    if (error.status) throw error
    throw fail(error.name === 'TimeoutError' || error.name === 'AbortError'
      ? '截图超时；登录或有验证的网站可直接上传截图'
      : '暂时连不上截图服务，可稍后重试或上传截图', 502)
  }
}

let running = false
export async function handleDemolitionRequest(req, res) {
  if (req.url?.split('?')[0] !== '/api/demolition/capture') return false
  const send = (status, error) => {
    if (res.destroyed || res.writableEnded) return
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error }))
  }
  const host = req.headers.host
  if (!host || !/^(localhost|127\.0\.0\.1):\d+$/.test(host) || req.headers.origin && req.headers.origin !== `http://${host}`) { send(403, '请从本地网页拆迁办打开'); return true }
  if (req.method !== 'GET') { send(405, '请使用 GET 请求'); return true }
  if (running) { send(429, '已有网页正在截图，请稍后重试'); return true }
  // ponytail: one capture at a time is enough for the local toy; use a bounded queue for public hosting.
  running = true
  const controller = new AbortController()
  const onClose = () => { if (!res.writableEnded) controller.abort() }
  res.once('close', onClose)
  try {
    const url = await validateCaptureUrl(new URL(req.url, `http://${host}`).searchParams.get('url'))
    const { bytes, type } = await captureWebsite(url, controller.signal)
    if (res.destroyed || controller.signal.aborted) return true
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(bytes)
  } catch (error) { send(error.status || 502, error.message || '截图失败，请稍后重试') }
  finally { res.off('close', onClose); running = false }
  return true
}

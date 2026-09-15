/**
 * 生成符合 RFC 4122 v4 规范的唯一标识符（UUID v4）
 *
 * 【为什么不能直接用 crypto.randomUUID()？】
 * 1. 规范约束：W3C Web Cryptography API 规范规定 `crypto.randomUUID()` 属于「安全上下文（Secure Context）」
 *    专有 API，仅在 HTTPS、WSS 或本地 localhost / 127.0.0.1 环境下暴露。
 * 2. 部署现状：本项目既定部署形态为 HTTP 协议（如 http://gateway.example.com，由集群入口 APISIX 统一终结 TLS，
 *    内部与网关间保持纯 HTTP 通信）。浏览器访问该域名时处于非安全上下文（window.isSecureContext === false），
 *    此时 `window.crypto.randomUUID` 是 `undefined`。
 * 3. 事故危害：若直接调用 `crypto.randomUUID()`，每次发送请求都会抛出
 *    `TypeError: crypto.randomUUID is not a function`，导致 Axios 请求拦截器中断，包括登录在内的所有业务功能彻底瘫痪。
 *
 * 【降级兜底策略】
 * 1. 优先使用 `crypto.randomUUID()`（若当前运行在安全上下文，性能最佳）；
 * 2. 降级使用 `crypto.getRandomValues()`（该底层密码学 API 不受安全上下文限制，绝大多数现代浏览器非安全上下文中均可用），
 *    通过密码学安全伪随机字节填充并构造标准的 RFC 4122 v4 UUID；
 * 3. 极端环境兜底：若 Web Crypto API 整体不可用，降级使用 `Math.random()` 构造同等格式与长度的 UUID v4 字符串。
 *
 * 所有分支产出的字符串格式完全一致（UUID v4 36 位小写十六进制连字符分隔），保证日志追踪与网关链路排障的一致性。
 */

const byteToHex: string[] = [];
for (let i = 0; i < 256; i++) {
  byteToHex.push(i.toString(16).padStart(2, '0'));
}

function getCrypto(): Crypto | undefined {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof crypto !== 'undefined') {
    return crypto;
  }
  return undefined;
}

export function randomId(): string {
  const c = getCrypto();

  // 1. 安全上下文且支持原生 randomUUID 时直接使用
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }

  // 2. 非安全上下文降级：crypto.getRandomValues 不要求安全上下文
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);

    // RFC 4122 规范：版本 4 (0100xxxx -> 第 7 字节高 4 位设为 0x4)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // RFC 4122 规范：变体 (10xxxxxx -> 第 9 字节高 2 位设为 0x8, 0x9, 0xa, 0xb)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return (
      byteToHex[bytes[0]] +
      byteToHex[bytes[1]] +
      byteToHex[bytes[2]] +
      byteToHex[bytes[3]] +
      '-' +
      byteToHex[bytes[4]] +
      byteToHex[bytes[5]] +
      '-' +
      byteToHex[bytes[6]] +
      byteToHex[bytes[7]] +
      '-' +
      byteToHex[bytes[8]] +
      byteToHex[bytes[9]] +
      '-' +
      byteToHex[bytes[10]] +
      byteToHex[bytes[11]] +
      byteToHex[bytes[12]] +
      byteToHex[bytes[13]] +
      byteToHex[bytes[14]] +
      byteToHex[bytes[15]]
    );
  }

  // 3. 极端环境降级：无 Crypto 支持时使用 Math.random 构造相同 RFC 4122 v4 格式的 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

'use strict';

const DEFAULT_MAX_LENGTH = 4096;
const SENSITIVE_KEYS = new Set([
  'authorization',
  'access_token',
  'accessToken',
  'apiKey',
  'api_key',
  'key',
  'password',
  'passwd',
  'refresh_token',
  'refreshToken',
  'secret',
  'token',
]);

function isSensitiveKey(key) {
  return SENSITIVE_KEYS.has(key) || /password|token|secret|authorization|api[-_]?key/i.test(key);
}

function truncate(value, maxLength = DEFAULT_MAX_LENGTH) {
  if (typeof value !== 'string' || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...[TRUNCATED]`;
}

function sanitize(value, maxLength = DEFAULT_MAX_LENGTH, depth = 0) {
  if (value === undefined || value === null) {
    return value;
  }
  if (depth > 8) {
    return '[MAX_DEPTH]';
  }
  if (Buffer.isBuffer(value)) {
    return truncate(value.toString('utf8'), maxLength);
  }
  if (typeof value === 'string') {
    return parseJsonOrString(value, maxLength, depth);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, maxLength, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? '[REDACTED]' : sanitize(item, maxLength, depth + 1),
    ]));
  }
  return value;
}

function parseJsonOrString(value, maxLength, depth) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return sanitize(JSON.parse(trimmed), maxLength, depth + 1);
    } catch (_error) {
      return truncate(value, maxLength);
    }
  }
  return truncate(value, maxLength);
}

module.exports = { sanitize };

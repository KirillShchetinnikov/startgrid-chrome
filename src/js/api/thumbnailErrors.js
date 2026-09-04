const NETWORK_PROTOCOLS = new Set(['http:', 'https:']);

function isProtectedBrowserPage(url) {
  return url.hostname === 'chromewebstore.google.com'
    || (url.hostname === 'chrome.google.com' && /^\/webstore(?:\/|$)/.test(url.pathname));
}

export function inspectThumbnailUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    return {
      allowed: false,
      code: 'INVALID_URL',
      protocol: '',
      target: String(value || '').trim() || '—'
    };
  }

  const target = url.hostname || `${url.protocol}//`;
  if (!NETWORK_PROTOCOLS.has(url.protocol)) {
    return {
      allowed: false,
      code: 'UNSUPPORTED_SCHEME',
      protocol: url.protocol,
      target
    };
  }
  if (isProtectedBrowserPage(url)) {
    return {
      allowed: false,
      code: 'PROTECTED_BROWSER_PAGE',
      protocol: url.protocol,
      target
    };
  }

  return {
    allowed: true,
    href: url.href,
    protocol: url.protocol,
    target
  };
}

export function createThumbnailFailure(code, {
  operation = 'thumbnail',
  status,
  url
} = {}) {
  const inspected = inspectThumbnailUrl(url);
  return {
    success: false,
    error: {
      code,
      operation,
      target: inspected.target,
      protocol: inspected.protocol,
      ...(Number.isFinite(status) && { status })
    }
  };
}

export function validateThumbnailRequest(url, operation = 'thumbnail') {
  const inspected = inspectThumbnailUrl(url);
  return inspected.allowed
    ? { success: true, url: inspected.href, target: inspected.target }
    : createThumbnailFailure(inspected.code, { operation, url });
}

export function normalizeThumbnailFailure(response, { operation, url } = {}) {
  if (response?.error?.code) return response;
  return createThumbnailFailure(
    response?.code || 'UNKNOWN_ERROR',
    { operation, url }
  );
}

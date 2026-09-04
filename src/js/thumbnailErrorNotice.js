import Toast from './components/toast';
import { getMessage } from './i18n';
import { normalizeThumbnailFailure } from './api/thumbnailErrors';

const PROBLEM_KEYS = {
  INVALID_URL: 'thumbnail_error_problem_invalid_url',
  UNSUPPORTED_SCHEME: 'thumbnail_error_problem_unsupported_scheme',
  PROTECTED_BROWSER_PAGE: 'thumbnail_error_problem_protected_page',
  PERMISSION_DENIED: 'thumbnail_error_problem_permission',
  NETWORK_ERROR: 'thumbnail_error_problem_network',
  HTTP_ERROR: 'thumbnail_error_problem_http',
  NOT_AN_IMAGE: 'thumbnail_error_problem_not_image',
  FAVICON_NOT_FOUND: 'thumbnail_error_problem_no_favicon',
  TIMEOUT: 'thumbnail_error_problem_timeout',
  CLIENT_TIMEOUT: 'thumbnail_error_problem_timeout',
  RUNTIME_ERROR: 'thumbnail_error_problem_runtime',
  INVALID_RESPONSE: 'thumbnail_error_problem_runtime',
  INVALID_REQUEST: 'thumbnail_error_problem_invalid_url',
  STORE_FAILED: 'thumbnail_error_problem_storage',
  CAPTURE_FAILED: 'thumbnail_error_problem_capture',
  WINDOW_CREATE_FAILED: 'thumbnail_error_problem_capture',
  WINDOW_HAS_NO_TAB: 'thumbnail_error_problem_capture',
  TAB_READ_FAILED: 'thumbnail_error_problem_capture',
  INSERT_CSS_FAILED: 'thumbnail_error_problem_capture',
  WINDOW_UPDATE_FAILED: 'thumbnail_error_problem_capture',
  EMPTY_CAPTURE: 'thumbnail_error_problem_capture'
};

const REASON_KEYS = {
  INVALID_URL: 'thumbnail_error_reason_invalid_url',
  UNSUPPORTED_SCHEME: 'thumbnail_error_reason_unsupported_scheme',
  PROTECTED_BROWSER_PAGE: 'thumbnail_error_reason_protected_page',
  PERMISSION_DENIED: 'thumbnail_error_reason_permission',
  NETWORK_ERROR: 'thumbnail_error_reason_network',
  HTTP_ERROR: 'thumbnail_error_reason_http',
  NOT_AN_IMAGE: 'thumbnail_error_reason_not_image',
  FAVICON_NOT_FOUND: 'thumbnail_error_reason_no_favicon',
  TIMEOUT: 'thumbnail_error_reason_timeout',
  CLIENT_TIMEOUT: 'thumbnail_error_reason_timeout',
  RUNTIME_ERROR: 'thumbnail_error_reason_runtime',
  INVALID_RESPONSE: 'thumbnail_error_reason_runtime',
  INVALID_REQUEST: 'thumbnail_error_reason_invalid_url',
  STORE_FAILED: 'thumbnail_error_reason_storage',
  CAPTURE_FAILED: 'thumbnail_error_reason_capture',
  WINDOW_CREATE_FAILED: 'thumbnail_error_reason_capture',
  WINDOW_HAS_NO_TAB: 'thumbnail_error_reason_capture',
  TAB_READ_FAILED: 'thumbnail_error_reason_capture',
  INSERT_CSS_FAILED: 'thumbnail_error_reason_capture',
  WINDOW_UPDATE_FAILED: 'thumbnail_error_reason_capture',
  EMPTY_CAPTURE: 'thumbnail_error_reason_capture'
};

const TITLE_KEYS = {
  favicon: 'thumbnail_error_title_favicon',
  site: 'thumbnail_error_title_site',
  url: 'thumbnail_error_title_url'
};

export function showThumbnailError(response, { operation = 'thumbnail', url } = {}) {
  const failure = normalizeThumbnailFailure(response, { operation, url });
  const error = failure.error;
  const baseProblem = getMessage(PROBLEM_KEYS[error.code] || 'thumbnail_error_problem_unknown');
  const problem = error.code === 'HTTP_ERROR' && error.status
    ? `${baseProblem} ${error.status}`
    : baseProblem;
  const reasonKey = REASON_KEYS[error.code] || 'thumbnail_error_reason_unknown';
  const reason = getMessage(reasonKey);

  return Toast.show({
    title: getMessage(TITLE_KEYS[error.operation] || 'thumbnail_error_title_thumbnail'),
    message: reason,
    details: [
      { label: getMessage('thumbnail_error_site'), value: error.target || '—' },
      { label: getMessage('thumbnail_error_problem'), value: problem }
    ],
    modClass: 'toast--error toast--detailed',
    delay: 10000,
    progress: true,
    dedupeKey: `${error.operation}:${error.target}:${error.code}`
  });
}

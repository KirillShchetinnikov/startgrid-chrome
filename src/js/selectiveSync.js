// Policy is never written by ordinary edits. Each enabled generation has its
// own value key, so delayed offline writes cannot overwrite a re-enabled value.
export const SYNC_PREFIX = 'startgrid.setting.';
export const POLICY_PREFIX = 'startgrid.policy.';
export const SYNC_VERSION_KEY = 'startgrid.sync';
export const SYNC_STATE_KEY = 'sync_state';
export const SYNC_ERROR_KEY = 'sync_error';
export const LOCAL_SETTING_KEYS = Object.freeze([
  'performance_mode', 'language', 'default_folder_id', 'sync_default_folder_id', 'enable_sync'
]);
export const SYNC_GROUPS = Object.freeze({
  search_engines: ['search_engines', 'search_engine'],
  background_image: ['background_image', 'background_color', 'background_external']
});

export const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
export const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const valueKey = (group, epoch = 'initial') => `${SYNC_PREFIX}${group}.${epoch}`;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeKey = key => !['__proto__', 'constructor', 'prototype'].includes(key);

export function syncGroup(key) {
  return Object.keys(SYNC_GROUPS).find(group => SYNC_GROUPS[group].includes(key)) || key;
}

export function groupValues(settings) {
  const groups = {};
  Object.entries(settings).forEach(([key, value]) => {
    if (LOCAL_SETTING_KEYS.includes(key) || !safeKey(key)) return;
    const group = syncGroup(key);
    groups[group] ||= {};
    groups[group][key] = copy(value);
  });
  return groups;
}

// Apply only the user's edits to the raw remote value. The normalized before
// image is deliberately NOT a cloud payload: it may omit future fields/values.
export function applyKnownChanges(raw, before, after) {
  if (equal(before, after)) return copy(raw);
  if (before === undefined && object(after) && object(raw)) before = {};
  if (before === undefined && Array.isArray(after) && Array.isArray(raw)) before = [];
  if (Array.isArray(before) && Array.isArray(after) && Array.isArray(raw)
    && [...before, ...after, ...raw].every(item => object(item) && typeof item.id === 'string')) {
    const oldById = new Map(before.map(item => [item.id, item]));
    const rawById = new Map(raw.map(item => [item.id, item]));
    const result = after.map(item => applyKnownChanges(rawById.get(item.id), oldById.get(item.id), item));
    // Entries invisible to this version survive. Entries explicitly removed by
    // the user (present in before but absent in after) do not get resurrected.
    raw.forEach(item => {
      if (!oldById.has(item.id) && !after.some(next => next.id === item.id)) result.push(copy(item));
    });
    return result;
  }
  if (object(before) && object(after)) {
    const result = object(raw) ? copy(raw) : {};
    new Set([...Object.keys(before), ...Object.keys(after)]).forEach(key => {
      if (!safeKey(key) || equal(before[key], after[key])) return;
      if (!Object.hasOwn(after, key)) delete result[key];
      else result[key] = applyKnownChanges(result[key], before[key], after[key]);
    });
    return result;
  }
  return copy(after);
}

export function readSyncRecords(records) {
  const values = {};
  const policy = {};
  Object.entries(records).forEach(([key, record]) => {
    if (!key.startsWith(POLICY_PREFIX) || !object(record)) return;
    const group = key.slice(POLICY_PREFIX.length);
    if (!safeKey(group)) return;
    policy[group] = record.enabled !== false;
    const value = records[valueKey(group, record.epoch)]?.value;
    if (record.enabled !== false && object(value)) {
      Object.entries(value).forEach(([name, value]) => {
        if (safeKey(name) && syncGroup(name) === group && !LOCAL_SETTING_KEYS.includes(name)) {
          values[name] = copy(value);
        }
      });
    }
  });
  return { values, policy };
}

export function createInitialSyncRecords(values, existing = {}) {
  const result = {};
  Object.entries(groupValues(values)).forEach(([group, value]) => {
    const key = POLICY_PREFIX + group;
    if (!Object.hasOwn(existing, key)) {
      result[key] = { enabled: true, epoch: 'initial' };
      result[valueKey(group)] = { value };
    }
  });
  result[SYNC_VERSION_KEY] = { version: 1 };
  return result;
}

// Web Locks serialize read/modify/write across extension tabs and the worker.
// The fallback is for unit environments without navigator, not production Chrome.
let queue = Promise.resolve();
export function withSettingsLock(operation) {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('startgrid-settings', operation);
  }
  const result = queue.then(operation);
  queue = result.catch(() => undefined);
  return result;
}

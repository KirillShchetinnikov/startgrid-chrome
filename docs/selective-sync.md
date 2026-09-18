# Selective synchronization

The Data section contains a global selection shared by devices with StartGrid sync enabled. Its 18 expandable blocks follow the quick-settings organization and include the additional full-settings controls. Each block can be switched on/off in one batch; expanding it exposes individual settings. A centered switch and enabled/total count indicate a partially enabled block. Clicking that switch enables all its items. Every supported setting is selected initially. Search-engine configuration and the selected engine form one indivisible item; background source, color and external URL form another. Language, performance mode, device IDs and the overall enable switch stay local.

Disabling a group preserves each device's current value and removes the cloud value. Enabling publishes the initiating device's local value. Receivers adopt that value instead of uploading their own. Import, quick reset and explicit upload respect exclusions. Local reset preserves cloud policy; explicit cloud reset deletes it.

## Storage protocol

- `startgrid.sync`: protocol version (currently `1`). Unsupported versions are read-only and report an error.
- `startgrid.policy.<group>`: `enabled`, `epoch`, and retired epochs. Policy has no exclusion control. Ordinary value edits never modify existing policy.
- `startgrid.setting.<group>.<epoch>`: the raw `value` object. A new epoch is allocated when the user changes policy. Retired keys are removed after successful policy persistence and whenever delayed writes recreate them.
- Local `sync_state`: durable pending operations, last policy, raw values and their received epochs, and an applied revision for refreshing open pages. Cache cleanup preserves this state.

Policy and value may arrive separately: an enabled policy is applied only to a matching value generation. Unknown groups and fields are not rebuilt from this version's defaults. Known local values are normalized for the UI; only explicit edits are patched into the raw cloud payload. Objects use field differences; search-engine arrays use stable IDs to retain unknown entries/fields while honoring removal of known entries.

Automatic layout and permission fallbacks stay local. Repeated cloud events with unchanged raw data and epoch do not overwrite these fallbacks or reload the page. Changed values and new enabled epochs are applied; an explicit restore from cloud also reapplies unchanged values.

Web Locks serialize operations within the extension profile, including worker and page instances. Before cloud writes, local values and pending intent are persisted. Failed writes remain pending across restart. A changed policy epoch invalidates edits queued before that change, preventing a reconnecting device from replacing the re-enabling device's value. Concurrent user edits to the same cloud record still follow Chrome Sync's conflict resolution; this is not a distributed transaction or collaborative editor.

## Migration and compatibility

The four legacy records are read without dropping unknown fields. Their values and migrated known fields are copied to the new namespace. Old records are removed only after successful persistence of the new records and protocol marker. On failure, legacy data stays intact. New clients do not import subsequent legacy writes: doing so would let already released versions bypass global exclusions. Consequently devices on pre-selective-sync releases no longer exchange new-format edits with upgraded devices and should be updated.

Future versions must preserve policy identity and group membership, retain unrecognized raw fields and values, use stable IDs in editable collections, and explicitly version incompatible schema changes. Do not reuse retired setting names for unrelated data. A change to the grouping or a format an older client cannot safely patch requires a protocol version change; older compatible clients then leave cloud data untouched.

Quota checks include unknown data already in storage and the actual records being replaced. No fields are silently dropped to satisfy quotas. Byte quota errors and other storage failures retain local intent and are shown in the selection UI with a retry action.

## Validation

`selectiveSync.test.js` uses independent stores with shared cloud storage to exercise version compatibility, policy transitions, delayed writes, persistent failures, imports/resets and UI selection coverage. `searchSettingsSync.test.js` checks search grouping and quota recovery. Browser tests use an isolated test profile; `PUPPETEER_HEADLESS=true` and `PUPPETEER_NO_SANDBOX=true` are opt-in flags for restricted test environments, not production settings.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, isNewerVersion, getUnseenEntries, WHATS_NEW } from './whatsNew.js';

describe('compareVersions', () => {
  test('equal versions return 0', () => {
    assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  });

  test('numeric comparison, not string comparison — 1.10.0 > 1.9.0', () => {
    assert.ok(compareVersions('1.10.0', '1.9.0') > 0);
  });

  test('shorter version treats missing segments as 0 (1.0 == 1.0.0)', () => {
    assert.equal(compareVersions('1.0', '1.0.0'), 0);
  });

  test('null/undefined treated as version 0', () => {
    assert.ok(compareVersions('1.0.0', null) > 0);
    assert.ok(compareVersions('1.0.0', undefined) > 0);
  });

  test('major version difference dominates minor/patch', () => {
    assert.ok(compareVersions('2.0.0', '1.99.99') > 0);
  });
});

describe('isNewerVersion', () => {
  test('true when a is strictly greater than b', () => {
    assert.equal(isNewerVersion('1.1.0', '1.0.0'), true);
  });

  test('false when equal', () => {
    assert.equal(isNewerVersion('1.0.0', '1.0.0'), false);
  });

  test('false when a is older than b', () => {
    assert.equal(isNewerVersion('1.0.0', '1.1.0'), false);
  });
});

describe('getUnseenEntries', () => {
  const entries = [
    { version: '1.0.0', note: 'first' },
    { version: '1.1.0', note: 'second' },
    { version: '1.2.0', note: 'third' },
  ];

  test('lastSeenVersion older than all entries returns everything, newest first', () => {
    const result = getUnseenEntries('0.9.0', '1.2.0', entries);
    assert.deepEqual(result.map((e) => e.version), ['1.2.0', '1.1.0', '1.0.0']);
  });

  test('lastSeenVersion matching an entry excludes that entry and everything older', () => {
    const result = getUnseenEntries('1.0.0', '1.2.0', entries);
    assert.deepEqual(result.map((e) => e.version), ['1.2.0', '1.1.0']);
  });

  test('lastSeenVersion equal to currentVersion returns nothing (fully caught up)', () => {
    const result = getUnseenEntries('1.2.0', '1.2.0', entries);
    assert.deepEqual(result, []);
  });

  test('an entry dated ahead of currentVersion is excluded (defensive)', () => {
    const result = getUnseenEntries('1.0.0', '1.1.0', entries);
    assert.deepEqual(result.map((e) => e.version), ['1.1.0']);
  });

  test('null lastSeenVersion (nothing seen) returns every entry up to currentVersion', () => {
    const result = getUnseenEntries(null, '1.2.0', entries);
    assert.equal(result.length, 3);
  });

  test('default entries argument uses the real WHATS_NEW export', () => {
    const result = getUnseenEntries(null, '99.0.0');
    assert.equal(result.length, WHATS_NEW.length);
  });
});

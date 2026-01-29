/**
 * @task T023
 * @epic T001
 * @why Test version checking functionality
 * @what Unit tests for VersionChecker utilities
 */

import { compareSemver, shouldCheckForUpdates, getCurrentISODate } from '../src/updates/VersionChecker.js';

// Simple test runner
function test(name: string, fn: () => void): void {
    try {
        fn();
        console.log(`PASS: ${name}`);
    } catch (e) {
        console.error(`FAIL: ${name}`);
        console.error(`  ${(e as Error).message}`);
    }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

// Test compareSemver
test('compareSemver: equal versions', () => {
    assertEqual(compareSemver('1.0.0', '1.0.0'), 0);
});

test('compareSemver: a < b (patch)', () => {
    assertEqual(compareSemver('1.0.0', '1.0.1'), -1);
});

test('compareSemver: a > b (patch)', () => {
    assertEqual(compareSemver('1.0.1', '1.0.0'), 1);
});

test('compareSemver: a < b (minor)', () => {
    assertEqual(compareSemver('1.0.0', '1.1.0'), -1);
});

test('compareSemver: a > b (minor)', () => {
    assertEqual(compareSemver('1.1.0', '1.0.0'), 1);
});

test('compareSemver: a < b (major)', () => {
    assertEqual(compareSemver('1.0.0', '2.0.0'), -1);
});

test('compareSemver: a > b (major)', () => {
    assertEqual(compareSemver('2.0.0', '1.0.0'), 1);
});

test('compareSemver: handles v prefix', () => {
    assertEqual(compareSemver('v1.0.0', 'v1.0.1'), -1);
    assertEqual(compareSemver('1.0.0', 'v1.0.1'), -1);
    assertEqual(compareSemver('v1.0.0', '1.0.1'), -1);
});

test('compareSemver: handles missing patch', () => {
    assertEqual(compareSemver('1.0', '1.0.1'), -1);
    assertEqual(compareSemver('1.0.0', '1.0'), 0);
});

// Test shouldCheckForUpdates
test('shouldCheckForUpdates: null returns true', () => {
    assertEqual(shouldCheckForUpdates(null), true);
});

test('shouldCheckForUpdates: invalid date returns true', () => {
    assertEqual(shouldCheckForUpdates('not-a-date'), true);
});

test('shouldCheckForUpdates: recent check returns false', () => {
    const now = getCurrentISODate();
    assertEqual(shouldCheckForUpdates(now), false);
});

test('shouldCheckForUpdates: old check returns true', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    assertEqual(shouldCheckForUpdates(twoDaysAgo), true);
});

// Test getCurrentISODate
test('getCurrentISODate: returns valid ISO string', () => {
    const date = getCurrentISODate();
    // Should parse without error
    const parsed = new Date(date);
    assertEqual(isNaN(parsed.getTime()), false, 'Date should be valid');
});

console.log('\nAll tests completed.');

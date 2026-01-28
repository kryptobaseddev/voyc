/**
 * @task T007
 * @epic T001
 * @why Configuration system tests
 * @what Verify config load/save and validation works
 */

// Test imports
import {
    getConfigDir,
    getConfigFilePath,
    getDataDir,
    getCacheDir,
    ensureDir,
    fileExists
} from '../src/config/paths.js';

import {
    DEFAULT_CONFIG,
    validateConfig,
    isValidProvider,
    isValidSilenceTimeout,
    hasValidApiKey,
    getCurrentApiKey,
    getCurrentEndpoint,
    type Config,
} from '../src/config/schema.js';

import {
    ConfigManager,
} from '../src/config/Config.js';

// GJS imports for testing
import GLib from 'gi://GLib?version=2.0';
import Gio from 'gi://Gio?version=2.0';

/**
 * Test result tracking
 */
interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

const results: TestResult[] = [];
let testsPassed = 0;
let testsFailed = 0;

/**
 * Simple test runner
 */
function test(name: string, fn: () => void): void {
    try {
        fn();
        results.push({ name, passed: true });
        testsPassed++;
        console.log(`✓ ${name}`);
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        results.push({ name, passed: false, error });
        testsFailed++;
        console.log(`✗ ${name}: ${error}`);
    }
}

/**
 * Assertion helpers
 */
function assertEquals(actual: unknown, expected: unknown, message?: string): void {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertTrue(value: boolean, message?: string): void {
    if (!value) {
        throw new Error(message || `Expected true, got ${value}`);
    }
}

function assertFalse(value: boolean, message?: string): void {
    if (value) {
        throw new Error(message || `Expected false, got ${value}`);
    }
}

function assertNotNull(value: unknown, message?: string): void {
    if (value === null || value === undefined) {
        throw new Error(message || `Expected non-null value`);
    }
}

/**
 * Create temporary test directory
 */
function createTempDir(): string {
    const tempDir = GLib.dir_make_tmp('voyc-config-test-XXXXXX');
    return tempDir;
}

/**
 * Clean up temporary directory
 */
function cleanupTempDir(dir: string): void {
    try {
        const file = Gio.File.new_for_path(dir);
        // Recursively delete (simplified - just delete files we know about)
        const enumerator = file.enumerate_children(
            'standard::name',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const child = file.get_child(info.get_name());
            child.delete(null);
        }

        file.delete(null);
    } catch (e) {
        // Ignore cleanup errors
    }
}

/**
 * Run all tests
 */
function runTests(): number {
    console.log('=== Voyc Config System Tests ===\n');

    // === PATHS TESTS ===
    console.log('\n--- Paths Tests ---');

    test('getConfigDir returns non-empty string', () => {
        const dir = getConfigDir();
        assertTrue(typeof dir === 'string' && dir.length > 0);
        assertTrue(dir.includes('voyc'));
    });

    test('getConfigFilePath returns path ending in config.json', () => {
        const path = getConfigFilePath();
        assertTrue(path.endsWith('config.json'));
        assertTrue(path.includes('voyc'));
    });

    test('getDataDir returns non-empty string', () => {
        const dir = getDataDir();
        assertTrue(typeof dir === 'string' && dir.length > 0);
        assertTrue(dir.includes('voyc'));
    });

    test('getCacheDir returns non-empty string', () => {
        const dir = getCacheDir();
        assertTrue(typeof dir === 'string' && dir.length > 0);
        assertTrue(dir.includes('voyc'));
    });

    test('ensureDir creates directory', () => {
        const tempDir = createTempDir();
        const testDir = GLib.build_filenamev([tempDir, 'test-subdir']);

        assertFalse(fileExists(testDir));
        const result = ensureDir(testDir);
        assertTrue(result);
        assertTrue(fileExists(testDir));

        cleanupTempDir(tempDir);
    });

    // === SCHEMA TESTS ===
    console.log('\n--- Schema Tests ---');

    test('DEFAULT_CONFIG has all required fields', () => {
        assertEquals(DEFAULT_CONFIG.provider, 'elevenlabs');
        assertEquals(DEFAULT_CONFIG.silenceTimeout, 30);
        assertEquals(DEFAULT_CONFIG.autostart, true);
        assertEquals(DEFAULT_CONFIG.enablePostProcessing, true);
        assertEquals(DEFAULT_CONFIG.logTranscripts, false);
        assertNotNull(DEFAULT_CONFIG.hotkeys);
        assertEquals(DEFAULT_CONFIG.hotkeys.toggleDictation, '<Super>v');
    });

    test('isValidProvider accepts valid providers', () => {
        assertTrue(isValidProvider('elevenlabs'));
        assertTrue(isValidProvider('openai'));
        assertTrue(isValidProvider('baseten'));
    });

    test('isValidProvider rejects invalid providers', () => {
        assertFalse(isValidProvider('invalid'));
        assertFalse(isValidProvider(''));
        assertFalse(isValidProvider('google'));
    });

    test('isValidSilenceTimeout accepts valid values', () => {
        assertTrue(isValidSilenceTimeout(0));
        assertTrue(isValidSilenceTimeout(30));
        assertTrue(isValidSilenceTimeout(60));
    });

    test('isValidSilenceTimeout rejects invalid values', () => {
        assertFalse(isValidSilenceTimeout(15));
        assertFalse(isValidSilenceTimeout(45));
        assertFalse(isValidSilenceTimeout(90));
    });

    test('validateConfig applies defaults for empty object', () => {
        const config = validateConfig({});
        assertEquals(config.provider, DEFAULT_CONFIG.provider);
        assertEquals(config.silenceTimeout, DEFAULT_CONFIG.silenceTimeout);
        assertEquals(config.autostart, DEFAULT_CONFIG.autostart);
    });

    test('validateConfig preserves valid values', () => {
        const partial: Partial<Config> = {
            provider: 'openai',
            silenceTimeout: 60,
            autostart: false,
        };
        const config = validateConfig(partial);
        assertEquals(config.provider, 'openai');
        assertEquals(config.silenceTimeout, 60);
        assertEquals(config.autostart, false);
    });

    test('validateConfig rejects invalid provider', () => {
        const partial = { provider: 'invalid' as any };
        const config = validateConfig(partial);
        assertEquals(config.provider, DEFAULT_CONFIG.provider);
    });

    test('validateConfig rejects invalid silenceTimeout', () => {
        const partial = { silenceTimeout: 45 as any };
        const config = validateConfig(partial);
        assertEquals(config.silenceTimeout, DEFAULT_CONFIG.silenceTimeout);
    });

    test('hasValidApiKey returns false for empty keys', () => {
        const config = validateConfig({});
        assertFalse(hasValidApiKey(config));
    });

    test('hasValidApiKey returns true when provider has key', () => {
        const config = validateConfig({
            provider: 'elevenlabs',
            elevenlabsApiKey: 'test-key-123',
        });
        assertTrue(hasValidApiKey(config));
    });

    test('getCurrentApiKey returns correct key for provider', () => {
        const config = validateConfig({
            provider: 'openai',
            openaiApiKey: 'openai-key',
            elevenlabsApiKey: 'elevenlabs-key',
        });
        assertEquals(getCurrentApiKey(config), 'openai-key');
    });

    test('getCurrentEndpoint returns correct endpoint for provider', () => {
        const config = validateConfig({
            provider: 'elevenlabs',
        });
        assertEquals(getCurrentEndpoint(config), DEFAULT_CONFIG.elevenlabsEndpoint);
    });

    // === CONFIG MANAGER TESTS ===
    console.log('\n--- ConfigManager Tests ---');

    test('ConfigManager creates with defaults when no config exists', () => {
        const tempDir = createTempDir();
        const configPath = GLib.build_filenamev([tempDir, 'config.json']);

        const manager = new ConfigManager(configPath);
        const config = manager.config;

        assertEquals(config.provider, DEFAULT_CONFIG.provider);
        assertEquals(config.silenceTimeout, DEFAULT_CONFIG.silenceTimeout);

        cleanupTempDir(tempDir);
    });

    test('ConfigManager saves and loads config', () => {
        const tempDir = createTempDir();
        const configPath = GLib.build_filenamev([tempDir, 'config.json']);

        // Create manager and modify config
        const manager = new ConfigManager(configPath);
        manager.setProvider('openai');
        manager.setSilenceTimeout(60);
        manager.save();

        // Create new manager pointing to same file
        const manager2 = new ConfigManager(configPath);
        const config = manager2.config;

        assertEquals(config.provider, 'openai');
        assertEquals(config.silenceTimeout, 60);

        cleanupTempDir(tempDir);
    });

    test('ConfigManager creates config file on save', () => {
        const tempDir = createTempDir();
        const configPath = GLib.build_filenamev([tempDir, 'config.json']);

        assertFalse(fileExists(configPath));

        const manager = new ConfigManager(configPath);
        manager.save();

        assertTrue(fileExists(configPath));

        cleanupTempDir(tempDir);
    });

    test('ConfigManager reset restores defaults', () => {
        const tempDir = createTempDir();
        const configPath = GLib.build_filenamev([tempDir, 'config.json']);

        const manager = new ConfigManager(configPath);
        manager.setProvider('openai');
        manager.setSilenceTimeout(60);
        manager.setAutostart(false);

        manager.reset();

        const config = manager.config;
        assertEquals(config.provider, DEFAULT_CONFIG.provider);
        assertEquals(config.silenceTimeout, DEFAULT_CONFIG.silenceTimeout);
        assertEquals(config.autostart, DEFAULT_CONFIG.autostart);

        cleanupTempDir(tempDir);
    });

    test('ConfigManager individual setters work', () => {
        const tempDir = createTempDir();
        const configPath = GLib.build_filenamev([tempDir, 'config.json']);

        const manager = new ConfigManager(configPath);

        manager.setProvider('baseten');
        assertEquals(manager.config.provider, 'baseten');

        manager.setElevenlabsApiKey('eleven-key');
        assertEquals(manager.config.elevenlabsApiKey, 'eleven-key');

        manager.setOpenaiApiKey('openai-key');
        assertEquals(manager.config.openaiApiKey, 'openai-key');

        manager.setBasetenApiKey('baseten-key');
        assertEquals(manager.config.basetenApiKey, 'baseten-key');

        manager.setSilenceTimeout(0);
        assertEquals(manager.config.silenceTimeout, 0);

        manager.setAutostart(false);
        assertEquals(manager.config.autostart, false);

        manager.setAudioDevice('device-1');
        assertEquals(manager.config.audioDevice, 'device-1');

        manager.setEnablePostProcessing(false);
        assertEquals(manager.config.enablePostProcessing, false);

        manager.setLogTranscripts(true);
        assertEquals(manager.config.logTranscripts, true);

        manager.setHotkeys({ toggleDictation: '<Ctrl>d' });
        assertEquals(manager.config.hotkeys.toggleDictation, '<Ctrl>d');

        cleanupTempDir(tempDir);
    });

    test('ConfigManager update method works', () => {
        const tempDir = createTempDir();
        const configPath = GLib.build_filenamev([tempDir, 'config.json']);

        const manager = new ConfigManager(configPath);
        manager.update({
            provider: 'openai',
            silenceTimeout: 60,
            autostart: false,
        });

        const config = manager.config;
        assertEquals(config.provider, 'openai');
        assertEquals(config.silenceTimeout, 60);
        assertEquals(config.autostart, false);

        cleanupTempDir(tempDir);
    });

    // === SIGNAL TESTS ===
    console.log('\n--- Signal Tests ---');

    test('ConfigManager emits changed signal on update', () => {
        const tempDir = createTempDir();
        const configPath = GLib.build_filenamev([tempDir, 'config.json']);

        const manager = new ConfigManager(configPath);
        let signalEmitted = false;

        manager.connect('changed', () => {
            signalEmitted = true;
        });

        manager.setProvider('openai');

        assertTrue(signalEmitted, 'changed signal should have been emitted');

        cleanupTempDir(tempDir);
    });

    test('ConfigManager emits provider-changed signal', () => {
        const tempDir = createTempDir();
        const configPath = GLib.build_filenamev([tempDir, 'config.json']);

        const manager = new ConfigManager(configPath);
        let signalEmitted = false;

        manager.connect('provider-changed', () => {
            signalEmitted = true;
        });

        manager.setProvider('openai');

        assertTrue(signalEmitted, 'provider-changed signal should have been emitted');

        cleanupTempDir(tempDir);
    });

    test('ConfigManager emits hotkeys-changed signal', () => {
        const tempDir = createTempDir();
        const configPath = GLib.build_filenamev([tempDir, 'config.json']);

        const manager = new ConfigManager(configPath);
        let signalEmitted = false;

        manager.connect('hotkeys-changed', () => {
            signalEmitted = true;
        });

        manager.setHotkeys({ toggleDictation: '<Ctrl>x' });

        assertTrue(signalEmitted, 'hotkeys-changed signal should have been emitted');

        cleanupTempDir(tempDir);
    });

    // Print summary
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log(`Total: ${testsPassed + testsFailed}`);

    if (testsFailed > 0) {
        console.log('\nFailed tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.name}: ${r.error}`);
        });
    }

    return testsFailed === 0 ? 0 : 1;
}

// Run tests and exit with appropriate code
const exitCode = runTests();

// Exit with code (GJS compatible)
if (exitCode !== 0) {
    // Force non-zero exit on failure
    throw new Error(`Tests failed with exit code ${exitCode}`);
}
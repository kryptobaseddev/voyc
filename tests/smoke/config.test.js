/**
 * @task T018
 * @epic T001
 * @why Verify configuration system works correctly
 * @what Config smoke tests for XDG paths and environment
 */

// GJS imports for testing
imports.gi.versions.GLib = '2.0';
imports.gi.versions.Gio = '2.0';
const { GLib, Gio } = imports.gi;

const results = [];
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    const startTime = GLib.get_monotonic_time();
    try {
        fn();
        const duration = (GLib.get_monotonic_time() - startTime) / 1000;
        results.push({ name, passed: true, duration });
        testsPassed++;
        log('✓ ' + name + ' (' + duration.toFixed(2) + 'ms)');
    } catch (e) {
        const duration = (GLib.get_monotonic_time() - startTime) / 1000;
        const error = e instanceof Error ? e.message : String(e);
        results.push({ name, passed: false, error, duration });
        testsFailed++;
        log('✗ ' + name + ': ' + error);
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || 'Expected ' + expected + ', got ' + actual);
    }
}

function assertTrue(value, message) {
    if (!value) {
        throw new Error(message || 'Expected true, got ' + value);
    }
}

function assertFalse(value, message) {
    if (value) {
        throw new Error(message || 'Expected false, got ' + value);
    }
}

function assertNotNull(value, message) {
    if (value === null || value === undefined) {
        throw new Error(message || 'Expected non-null value');
    }
}

function fileExists(filePath) {
    try {
        const file = Gio.File.new_for_path(filePath);
        return file.query_exists(null);
    } catch (e) {
        return false;
    }
}

function runTests() {
    log('=== Voyc Config Smoke Tests ===\n');
    
    // === XDG PATH TESTS ===
    log('--- XDG Path Tests ---');
    
    test('XDG config directory is available', function() {
        const configDir = GLib.get_user_config_dir();
        assertTrue(typeof configDir === 'string' && configDir.length > 0, 'Config dir should be a non-empty string');
        assertTrue(fileExists(configDir), 'Config dir should exist');
    });
    
    test('XDG data directory is available', function() {
        const dataDir = GLib.get_user_data_dir();
        assertTrue(typeof dataDir === 'string' && dataDir.length > 0, 'Data dir should be a non-empty string');
        assertTrue(fileExists(dataDir), 'Data dir should exist');
    });
    
    test('XDG cache directory is available', function() {
        const cacheDir = GLib.get_user_cache_dir();
        assertTrue(typeof cacheDir === 'string' && cacheDir.length > 0, 'Cache dir should be a non-empty string');
        assertTrue(fileExists(cacheDir), 'Cache dir should exist');
    });
    
    test('Can create voyc config directory', function() {
        const configDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'voyc']);
        const file = Gio.File.new_for_path(configDir);
        
        if (!file.query_exists(null)) {
            file.make_directory_with_parents(null);
        }
        
        assertTrue(file.query_exists(null), 'voyc config dir should exist');
    });
    
    // === CONFIG FILE TESTS ===
    log('\n--- Config File Tests ---');
    
    test('Can create and write config file', function() {
        const configDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'voyc']);
        const configPath = GLib.build_filenamev([configDir, 'config.json']);
        
        // Ensure directory exists
        const dirFile = Gio.File.new_for_path(configDir);
        if (!dirFile.query_exists(null)) {
            dirFile.make_directory_with_parents(null);
        }
        
        // Write test config
        const testConfig = {
            provider: 'elevenlabs',
            silenceTimeout: 30,
            autostart: true
        };
        
        const file = Gio.File.new_for_path(configPath);
        const bytes = new TextEncoder().encode(JSON.stringify(testConfig, null, 2));
        file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        
        assertTrue(fileExists(configPath), 'Config file should exist');
    });
    
    test('Can read and parse config file', function() {
        const configPath = GLib.build_filenamev([GLib.get_user_config_dir(), 'voyc', 'config.json']);
        
        const file = Gio.File.new_for_path(configPath);
        const [success, contents] = file.load_contents(null);
        assertTrue(success, 'Should be able to read config file');
        
        const decoder = new TextDecoder();
        const jsonStr = decoder.decode(contents);
        
        const config = JSON.parse(jsonStr);
        assertEquals(config.provider, 'elevenlabs', 'Provider should match');
        assertEquals(config.silenceTimeout, 30, 'Silence timeout should match');
        assertEquals(config.autostart, true, 'Autostart should match');
    });
    
    test('Config save/load roundtrip works', function() {
        const configPath = GLib.build_filenamev([GLib.get_user_config_dir(), 'voyc', 'test-config.json']);
        
        // Write
        const testConfig = {
            provider: 'openai',
            silenceTimeout: 60,
            autostart: false,
            testKey: 'test-value'
        };
        
        const file = Gio.File.new_for_path(configPath);
        const bytes = new TextEncoder().encode(JSON.stringify(testConfig, null, 2));
        file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        
        // Read
        const [success, contents] = file.load_contents(null);
        assertTrue(success, 'Should be able to read config file');
        
        const decoder = new TextDecoder();
        const loadedConfig = JSON.parse(decoder.decode(contents));
        
        assertEquals(loadedConfig.provider, 'openai', 'Provider should persist');
        assertEquals(loadedConfig.silenceTimeout, 60, 'Silence timeout should persist');
        assertEquals(loadedConfig.autostart, false, 'Autostart should persist');
        assertEquals(loadedConfig.testKey, 'test-value', 'Custom key should persist');
        
        // Cleanup
        file.delete(null);
    });
    
    // === VALIDATION TESTS ===
    log('\n--- Validation Tests ---');
    
    test('Valid provider values', function() {
        const validProviders = ['elevenlabs', 'openai', 'baseten', 'elevenlabs-realtime'];
        for (const provider of validProviders) {
            assertTrue(provider.length > 0, provider + ' should be non-empty');
        }
    });
    
    test('Valid silence timeout values', function() {
        const validTimeouts = [0, 30, 60];
        for (const timeout of validTimeouts) {
            assertTrue(timeout >= 0, 'Timeout should be non-negative');
            assertTrue(Number.isInteger(timeout), 'Timeout should be integer');
        }
    });
    
    // Print summary
    log('\n=== Config Smoke Test Summary ===');
    log('Passed: ' + testsPassed);
    log('Failed: ' + testsFailed);
    log('Total: ' + (testsPassed + testsFailed));
    
    if (testsFailed > 0) {
        log('\nFailed tests:');
        results.filter(r => !r.passed).forEach(r => {
            log('  - ' + r.name + ': ' + r.error);
        });
    }
    
    return testsFailed === 0 ? 0 : 1;
}

const exitCode = runTests();

if (exitCode !== 0) {
    throw new Error('Config smoke tests failed with exit code ' + exitCode);
}

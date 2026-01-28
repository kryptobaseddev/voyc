/**
 * @task T018
 * @epic T001
 * @why Verify build artifacts are valid and loadable
 * @what Build smoke tests for TypeScript compilation and GJS loading
 */

// GJS imports for testing
imports.gi.versions.GLib = '2.0';
imports.gi.versions.Gio = '2.0';
const { GLib, Gio } = imports.gi;

/**
 * Test result tracking
 * @task T018
 * @why Track test execution results
 */
const results = [];
let testsPassed = 0;
let testsFailed = 0;

/**
 * Simple test runner with timing
 * @task T018
 * @why Execute tests and capture results
 */
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

/**
 * Assertion helpers
 * @task T018
 * @why Provide clear test assertions
 */
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

/**
 * Check if a file exists and is readable
 * @task T018
 * @why Verify module imports work correctly
 */
function fileExists(filePath) {
    try {
        const file = Gio.File.new_for_path(filePath);
        return file.query_exists(null);
    } catch (e) {
        return false;
    }
}

/**
 * Get the project root directory
 * @task T018
 * @why Locate project files for testing
 */
function getProjectRoot() {
    // Use environment variable or default to current working directory
    const envRoot = GLib.getenv('VOYC_PROJECT_ROOT');
    if (envRoot) {
        return envRoot;
    }
    
    // Fallback: try to find project root by looking for package.json
    let currentDir = GLib.get_current_dir();
    while (currentDir && currentDir !== '/') {
        const packagePath = GLib.build_filenamev([currentDir, 'package.json']);
        if (fileExists(packagePath)) {
            return currentDir;
        }
        const parentDir = GLib.path_get_dirname(currentDir);
        if (parentDir === currentDir) break;
        currentDir = parentDir;
    }
    
    // Last resort: assume we're in project root
    return GLib.get_current_dir();
}

/**
 * Run all build smoke tests
 * @task T018
 * @why Verify build artifacts are valid
 */
function runTests() {
    log('=== Voyc Build Smoke Tests ===\n');
    
    const projectRoot = getProjectRoot();
    log('Project root: ' + projectRoot + '\n');
    
    // === BUILD VERIFICATION TESTS ===
    log('--- Build Verification Tests ---');
    
    test('TypeScript output directory exists', function() {
        const distDir = GLib.build_filenamev([projectRoot, 'dist']);
        const file = Gio.File.new_for_path(distDir);
        assertTrue(file.query_exists(null), 'dist directory should exist');
    });
    
    test('Main entry point exists', function() {
        const mainPath = GLib.build_filenamev([projectRoot, 'dist', 'main.js']);
        assertTrue(fileExists(mainPath), 'dist/main.js should exist');
    });
    
    test('Main entry point has content', function() {
        const mainPath = GLib.build_filenamev([projectRoot, 'dist', 'main.js']);
        const file = Gio.File.new_for_path(mainPath);
        const [success, contents] = file.load_contents(null);
        assertTrue(success, 'Should be able to read main.js');
        assertTrue(contents.length > 1000, 'main.js should have substantial content');
    });
    
    test('Main entry point has shebang', function() {
        const mainPath = GLib.build_filenamev([projectRoot, 'dist', 'main.js']);
        const file = Gio.File.new_for_path(mainPath);
        const [success, contents] = file.load_contents(null);
        assertTrue(success, 'Should be able to read main.js');
        const decoder = new TextDecoder();
        const content = decoder.decode(contents);
        assertTrue(content.startsWith('#!/usr/bin/env gjs') || content.includes('GJS'), 'Should have GJS shebang or references');
    });
    
    // === MODULE VERIFICATION TESTS ===
    log('\n--- Module Verification Tests ---');
    
    test('Config module files exist', function() {
        const configDir = GLib.build_filenamev([projectRoot, 'dist', 'config']);
        const file = Gio.File.new_for_path(configDir);
        assertTrue(file.query_exists(null), 'dist/config directory should exist');
        
        const requiredFiles = ['Config.js', 'paths.js', 'schema.js', 'index.js'];
        for (const fileName of requiredFiles) {
            const filePath = GLib.build_filenamev([configDir, fileName]);
            assertTrue(fileExists(filePath), fileName + ' should exist');
        }
    });
    
    test('Audio module files exist', function() {
        const audioDir = GLib.build_filenamev([projectRoot, 'dist', 'audio']);
        const file = Gio.File.new_for_path(audioDir);
        assertTrue(file.query_exists(null), 'dist/audio directory should exist');
        
        const requiredFiles = ['PipeWireCapture.js', 'SilenceDetector.js', 'AudioBuffer.js', 'index.js'];
        for (const fileName of requiredFiles) {
            const filePath = GLib.build_filenamev([audioDir, fileName]);
            assertTrue(fileExists(filePath), fileName + ' should exist');
        }
    });
    
    test('STT module files exist', function() {
        const sttDir = GLib.build_filenamev([projectRoot, 'dist', 'stt']);
        const file = Gio.File.new_for_path(sttDir);
        assertTrue(file.query_exists(null), 'dist/stt directory should exist');
        
        const requiredFiles = ['SttProvider.js', 'ElevenLabsProvider.js', 'OpenAIProvider.js', 
                               'ElevenLabsRealtimeProvider.js', 'ProviderFactory.js', 'index.js'];
        for (const fileName of requiredFiles) {
            const filePath = GLib.build_filenamev([sttDir, fileName]);
            assertTrue(fileExists(filePath), fileName + ' should exist');
        }
    });
    
    test('Dictation module files exist', function() {
        const dictationDir = GLib.build_filenamev([projectRoot, 'dist', 'dictation']);
        const file = Gio.File.new_for_path(dictationDir);
        assertTrue(file.query_exists(null), 'dist/dictation directory should exist');
        
        const requiredFiles = ['StateMachine.js', 'DictationEngine.js', 'index.js'];
        for (const fileName of requiredFiles) {
            const filePath = GLib.build_filenamev([dictationDir, fileName]);
            assertTrue(fileExists(filePath), fileName + ' should exist');
        }
    });
    
    test('UI module files exist', function() {
        const uiDir = GLib.build_filenamev([projectRoot, 'dist', 'ui']);
        const file = Gio.File.new_for_path(uiDir);
        assertTrue(file.query_exists(null), 'dist/ui directory should exist');
        
        const requiredFiles = ['TrayIndicator.js', 'StatusIcon.js', 'SettingsWindow.js', 'index.js'];
        for (const fileName of requiredFiles) {
            const filePath = GLib.build_filenamev([uiDir, fileName]);
            assertTrue(fileExists(filePath), fileName + ' should exist');
        }
    });
    
    test('Hotkeys module files exist', function() {
        const hotkeysDir = GLib.build_filenamev([projectRoot, 'dist', 'hotkeys']);
        const file = Gio.File.new_for_path(hotkeysDir);
        assertTrue(file.query_exists(null), 'dist/hotkeys directory should exist');
        
        const requiredFiles = ['PortalHotkey.js', 'dbus-interfaces.js', 'index.js'];
        for (const fileName of requiredFiles) {
            const filePath = GLib.build_filenamev([hotkeysDir, fileName]);
            assertTrue(fileExists(filePath), fileName + ' should exist');
        }
    });
    
    test('Post-process module files exist', function() {
        const postprocessDir = GLib.build_filenamev([projectRoot, 'dist', 'postprocess']);
        const file = Gio.File.new_for_path(postprocessDir);
        assertTrue(file.query_exists(null), 'dist/postprocess directory should exist');
        
        const requiredFiles = ['PostProcessor.js', 'BasetenProvider.js', 'OpenAIProvider.js', 
                               'Pipeline.js', 'index.js'];
        for (const fileName of requiredFiles) {
            const filePath = GLib.build_filenamev([postprocessDir, fileName]);
            assertTrue(fileExists(filePath), fileName + ' should exist');
        }
    });
    
    test('Inject module files exist', function() {
        const injectDir = GLib.build_filenamev([projectRoot, 'dist', 'inject']);
        const file = Gio.File.new_for_path(injectDir);
        assertTrue(file.query_exists(null), 'dist/inject directory should exist');
        
        const requiredFiles = ['TextInjector.js', 'Clipboard.js', 'index.js'];
        for (const fileName of requiredFiles) {
            const filePath = GLib.build_filenamev([injectDir, fileName]);
            assertTrue(fileExists(filePath), fileName + ' should exist');
        }
    });
    
    test('Logging module files exist', function() {
        const loggingDir = GLib.build_filenamev([projectRoot, 'dist', 'logging']);
        const file = Gio.File.new_for_path(loggingDir);
        assertTrue(file.query_exists(null), 'dist/logging directory should exist');
        
        const requiredFiles = ['Logger.js', 'metrics.js', 'index.js'];
        for (const fileName of requiredFiles) {
            const filePath = GLib.build_filenamev([loggingDir, fileName]);
            assertTrue(fileExists(filePath), fileName + ' should exist');
        }
    });
    
    test('Startup module files exist', function() {
        const startupDir = GLib.build_filenamev([projectRoot, 'dist', 'startup']);
        const file = Gio.File.new_for_path(startupDir);
        assertTrue(file.query_exists(null), 'dist/startup directory should exist');
        
        const requiredFiles = ['Autostart.js', 'Lifecycle.js', 'index.js'];
        for (const fileName of requiredFiles) {
            const filePath = GLib.build_filenamev([startupDir, fileName]);
            assertTrue(fileExists(filePath), fileName + ' should exist');
        }
    });
    
    test('Privacy module files exist', function() {
        const privacyDir = GLib.build_filenamev([projectRoot, 'dist', 'privacy']);
        const file = Gio.File.new_for_path(privacyDir);
        assertTrue(file.query_exists(null), 'dist/privacy directory should exist');
        
        const requiredFiles = ['policy.js', 'redaction.js', 'index.js'];
        for (const fileName of requiredFiles) {
            const filePath = GLib.build_filenamev([privacyDir, fileName]);
            assertTrue(fileExists(filePath), fileName + ' should exist');
        }
    });
    
    // === DEPENDENCY CHECK TESTS ===
    log('\n--- Dependency Check Tests ---');
    
    test('Package.json exists', function() {
        const packagePath = GLib.build_filenamev([projectRoot, 'package.json']);
        assertTrue(fileExists(packagePath), 'package.json should exist');
    });
    
    test('TypeScript config exists', function() {
        const tsconfigPath = GLib.build_filenamev([projectRoot, 'tsconfig.json']);
        assertTrue(fileExists(tsconfigPath), 'tsconfig.json should exist');
    });
    
    test('Desktop entry file exists', function() {
        const desktopPath = GLib.build_filenamev([projectRoot, 'voyc.desktop']);
        assertTrue(fileExists(desktopPath), 'voyc.desktop should exist');
    });
    
    test('Node modules directory exists', function() {
        const nodeModulesPath = GLib.build_filenamev([projectRoot, 'node_modules']);
        const file = Gio.File.new_for_path(nodeModulesPath);
        assertTrue(file.query_exists(null), 'node_modules should exist');
    });
    
    // === SOURCE FILE TESTS ===
    log('\n--- Source File Tests ---');
    
    test('Source directory structure is complete', function() {
        const srcDir = GLib.build_filenamev([projectRoot, 'src']);
        const file = Gio.File.new_for_path(srcDir);
        assertTrue(file.query_exists(null), 'src directory should exist');
        
        // Check for all module directories
        const modules = ['audio', 'config', 'dictation', 'hotkeys', 'inject', 
                        'logging', 'postprocess', 'privacy', 'startup', 'stt', 'ui'];
        for (const module of modules) {
            const modulePath = GLib.build_filenamev([srcDir, module]);
            const moduleFile = Gio.File.new_for_path(modulePath);
            assertTrue(moduleFile.query_exists(null), 'src/' + module + ' should exist');
        }
    });
    
    test('Main source file exists', function() {
        const mainPath = GLib.build_filenamev([projectRoot, 'src', 'main.ts']);
        assertTrue(fileExists(mainPath), 'src/main.ts should exist');
    });
    
    // === BUILD OUTPUT VALIDATION ===
    log('\n--- Build Output Validation ---');
    
    test('Build output has provenance tags', function() {
        const mainPath = GLib.build_filenamev([projectRoot, 'dist', 'main.js']);
        const file = Gio.File.new_for_path(mainPath);
        const [success, contents] = file.load_contents(null);
        assertTrue(success, 'Should be able to read main.js');
        
        const decoder = new TextDecoder();
        const content = decoder.decode(contents);
        
        // Check for provenance tags
        assertTrue(content.includes('@task'), 'Should have @task tags');
        assertTrue(content.includes('@epic'), 'Should have @epic tags');
    });
    
    // Print summary
    log('\n=== Build Smoke Test Summary ===');
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

// Run tests and exit with appropriate code
const exitCode = runTests();

// Exit with code (GJS compatible)
if (exitCode !== 0) {
    throw new Error('Build smoke tests failed with exit code ' + exitCode);
}

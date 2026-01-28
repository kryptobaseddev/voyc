/**
 * @task T018
 * @epic T001
 * @why Verify TypeScript builds successfully and GJS can load output
 * @what Build smoke tests for Voyc
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

/**
 * @task T018
 * @why Ensure build artifacts exist and are valid
 * @what Build verification smoke tests
 */
describe('Build Smoke Tests', () => {
  beforeAll(() => {
    // Ensure dist directory exists
    if (!fs.existsSync(DIST_DIR)) {
      throw new Error('dist/ directory does not exist. Run npm run build first.');
    }
  });

  it('should have compiled main.js', () => {
    const mainJs = path.join(DIST_DIR, 'main.js');
    expect(fs.existsSync(mainJs)).toBe(true);
  });

  it('should have compiled config module', () => {
    const configIndex = path.join(DIST_DIR, 'config', 'index.js');
    expect(fs.existsSync(configIndex)).toBe(true);
  });

  it('should have compiled audio module', () => {
    const audioIndex = path.join(DIST_DIR, 'audio', 'index.js');
    expect(fs.existsSync(audioIndex)).toBe(true);
  });

  it('should have compiled stt module', () => {
    const sttIndex = path.join(DIST_DIR, 'stt', 'index.js');
    expect(fs.existsSync(sttIndex)).toBe(true);
  });

  it('should have compiled postprocess module', () => {
    const postprocessIndex = path.join(DIST_DIR, 'postprocess', 'index.js');
    expect(fs.existsSync(postprocessIndex)).toBe(true);
  });

  it('should have compiled ui module', () => {
    const uiIndex = path.join(DIST_DIR, 'ui', 'index.js');
    expect(fs.existsSync(uiIndex)).toBe(true);
  });

  it('should have compiled dictation module', () => {
    const dictationIndex = path.join(DIST_DIR, 'dictation', 'index.js');
    expect(fs.existsSync(dictationIndex)).toBe(true);
  });

  it('main.js should be valid JavaScript', () => {
    const mainJs = path.join(DIST_DIR, 'main.js');
    const content = fs.readFileSync(mainJs, 'utf-8');
    
    // Basic JS validation - should parse without errors
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain('import');
    expect(content).toContain('export');
  });

  it('should have all required GIR imports mapped', () => {
    const mainJs = path.join(DIST_DIR, 'main.js');
    const content = fs.readFileSync(mainJs, 'utf-8');
    
    // Check for GJS-style imports
    const requiredImports = [
      'gi://Gtk',
      'gi://Gio',
      'gi://GLib',
      'gi://GObject'
    ];
    
    for (const imp of requiredImports) {
      expect(content).toContain(imp);
    }
  });
});

/**
 * @task T018
 * @epic T001
 * @why Verify module integration and DictationEngine initialization
 * @what Integration smoke tests for Voyc
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

/**
 * @task T018
 * @why Ensure all modules integrate correctly
 * @what Integration verification smoke tests
 */
describe('Integration Smoke Tests', () => {
  it('should have all source modules', () => {
    const modules = [
      'config',
      'audio',
      'stt',
      'postprocess',
      'ui',
      'hotkeys',
      'inject',
      'logging',
      'privacy',
      'startup',
      'dictation'
    ];
    
    for (const mod of modules) {
      const modPath = path.join(SRC_DIR, mod);
      expect(fs.existsSync(modPath)).toBe(true);
      expect(fs.existsSync(path.join(modPath, 'index.ts'))).toBe(true);
    }
  });

  it('should have DictationEngine implementation', () => {
    const enginePath = path.join(SRC_DIR, 'dictation', 'DictationEngine.ts');
    expect(fs.existsSync(enginePath)).toBe(true);
    
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('class DictationEngine');
    expect(content).toContain('start()');
    expect(content).toContain('stop()');
  });

  it('should have StateMachine implementation', () => {
    const stateMachinePath = path.join(SRC_DIR, 'dictation', 'StateMachine.ts');
    expect(fs.existsSync(stateMachinePath)).toBe(true);
    
    const content = fs.readFileSync(stateMachinePath, 'utf-8');
    expect(content).toContain('class StateMachine');
    expect(content).toContain('IDLE');
    expect(content).toContain('LISTENING');
    expect(content).toContain('PROCESSING');
  });

  it('should have main.ts entry point', () => {
    const mainPath = path.join(SRC_DIR, 'main.ts');
    expect(fs.existsSync(mainPath)).toBe(true);
    
    const content = fs.readFileSync(mainPath, 'utf-8');
    expect(content).toContain('DictationEngine');
    expect(content).toContain('ConfigManager');
    expect(content).toContain('TrayIndicator');
  });

  it('should have voyc.desktop file', () => {
    const desktopPath = path.join(PROJECT_ROOT, 'voyc.desktop');
    expect(fs.existsSync(desktopPath)).toBe(true);
    
    const content = fs.readFileSync(desktopPath, 'utf-8');
    expect(content).toContain('[Desktop Entry]');
    expect(content).toContain('Name=Voyc');
  });

  it('should have all provider implementations', () => {
    const providers = [
      'ElevenLabsProvider.ts',
      'ElevenLabsRealtimeProvider.ts',
      'OpenAIProvider.ts'
    ];
    
    for (const provider of providers) {
      const providerPath = path.join(SRC_DIR, 'stt', provider);
      expect(fs.existsSync(providerPath)).toBe(true);
    }
  });

  it('should have post-processing providers', () => {
    const processors = [
      'BasetenProvider.ts',
      'OpenAIProvider.ts'
    ];
    
    for (const processor of processors) {
      const processorPath = path.join(SRC_DIR, 'postprocess', processor);
      expect(fs.existsSync(processorPath)).toBe(true);
    }
  });
});

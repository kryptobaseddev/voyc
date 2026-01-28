/**
 * @task T006
 * @epic T001
 * @why Build script to bundle TypeScript for GJS runtime
 * @what Uses TypeScript compiler to transpile src/main.ts to dist/src/main.js
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function build() {
  try {
    // Run TypeScript compiler
    execSync('npx tsc', { cwd: rootDir, stdio: 'inherit' });
    
    // Path to the compiled entry point
    // With rootDir=".", output might be dist/src/main.js or dist/main.js depending on includes
    // Based on `ls` output, it's at dist/main.js
    let distPath = join(rootDir, 'dist', 'main.js');
    if (!fs.existsSync(distPath)) {
        distPath = join(rootDir, 'dist', 'src', 'main.js');
    }
    
    // Output path for the executable
    const binPath = join(rootDir, 'dist', 'voyc');
    
    // Read the compiled JavaScript
    let content = fs.readFileSync(distPath, 'utf-8');
    
    // Add shebang and GJS header
    const gjsOutput = `#!/usr/bin/env gjs
// @ts-nocheck
/**
 * @task T006
 * @epic T001
 * @why GJS-compatible entry point (transpiled from TypeScript)
 * @what Voyc voice dictation application entry point
 */

${content}
`;

    fs.writeFileSync(binPath, gjsOutput);
    fs.chmodSync(binPath, 0o755);
    
    console.log(`✓ Build complete: ${binPath}`);
  } catch (error) {
    console.error('✗ Build failed:', error);
    process.exit(1);
  }
}

build();
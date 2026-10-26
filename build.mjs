import * as esbuild from 'esbuild';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

async function build() {
  console.log(`🚀 Building dsh-plugins-update v${pkg.version}...`);
  mkdirSync('lib', { recursive: true });

  // 1. Build backend index.js (ESM)
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    outfile: 'lib/index.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: false,
    external: [
      'node:*',
      '@deepseek-ai/*'
    ]
  });
  console.log('✅ Built lib/index.js');

  // 2. Build client.js (wrapped in window.__ModuleLoader__.load)
  const clientResult = await esbuild.build({
    entryPoints: ['src/client.tsx'],
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    target: 'es2022',
    write: false,
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@deepseek-ai/*'
    ]
  });

  const clientCode = clientResult.outputFiles[0].text;
  const wrappedClientCode = `/**
 * dsh-plugins-update v${pkg.version}
 * One-click updater for third-party plugins in DeepSeek Harness.
 */
window.__ModuleLoader__.load({
  id: "dsh-plugins-update",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${clientCode}
    return module.exports;
  }
});
`;

  writeFileSync('lib/client.js', wrappedClientCode, 'utf8');
  console.log('✅ Built lib/client.js');

  // 3. Emit TypeScript declaration files
  try {
    console.log('📝 Generating TypeScript declarations...');
    execSync('npx tsc --emitDeclarationOnly', { stdio: 'inherit' });
    console.log('✅ Generated type declarations');
  } catch (err) {
    console.warn('⚠️ TypeScript declaration generation skipped or failed:', err.message);
  }

  console.log('🎉 Build completed successfully!');
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});

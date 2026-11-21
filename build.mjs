import * as esbuild from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const require = createRequire(import.meta.url);
const tscBin = require.resolve('typescript/bin/tsc');
const watchMode = process.argv.includes('--watch');

function wrapClientCode(clientCode) {
  return `/**
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
}

function emitDeclarations() {
  console.log('📝 Generating TypeScript declarations...');
  execFileSync(process.execPath, [tscBin, '--emitDeclarationOnly'], { stdio: 'inherit' });
  rmSync('lib/locales.d.ts', { force: true });
  rmSync('lib/dsh-primitives.d.ts', { force: true });
  console.log('✅ Generated type declarations');
}

const backendOptions = {
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: false,
  external: ['node:*', '@deepseek-ai/*']
};

const clientOptions = {
  entryPoints: ['src/client.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  write: false,
  external: ['react', 'react-dom', 'react/jsx-runtime', '@deepseek-ai/*']
};

async function build() {
  console.log(`🚀 Building dsh-plugins-update v${pkg.version}...`);
  mkdirSync('lib', { recursive: true });

  if (watchMode) {
    const backendWatchPlugin = {
      name: 'backend-watch-log',
      setup(buildApi) {
        buildApi.onEnd(result => {
          if (result.errors.length === 0) {
            console.log('✅ Rebuilt lib/index.js');
          }
        });
      }
    };

    const clientWritePlugin = {
      name: 'client-wrap-write',
      setup(buildApi) {
        buildApi.onEnd(result => {
          if (result.errors.length === 0 && result.outputFiles?.[0]) {
            writeFileSync('lib/client.js', wrapClientCode(result.outputFiles[0].text), 'utf8');
            console.log('✅ Rebuilt lib/client.js');
          }
        });
      }
    };

    try {
      emitDeclarations();
    } catch (err) {
      console.warn('⚠️ Initial TypeScript declaration generation failed:', err.message);
    }

    const [backendCtx, clientCtx] = await Promise.all([
      esbuild.context({ ...backendOptions, plugins: [backendWatchPlugin] }),
      esbuild.context({ ...clientOptions, plugins: [clientWritePlugin] })
    ]);

    await Promise.all([backendCtx.watch(), clientCtx.watch()]);
    console.log('👀 Watching src/ for changes...');

    const shutdown = async () => {
      await Promise.all([backendCtx.dispose(), clientCtx.dispose()]);
      process.exit(0);
    };
    process.once('SIGINT', () => void shutdown());
    process.once('SIGTERM', () => void shutdown());
    return;
  }

  // 1. Build backend index.js (ESM)
  await esbuild.build(backendOptions);
  console.log('✅ Built lib/index.js');

  // 2. Build client.js (wrapped in window.__ModuleLoader__.load)
  const clientResult = await esbuild.build(clientOptions);
  writeFileSync('lib/client.js', wrapClientCode(clientResult.outputFiles[0].text), 'utf8');
  console.log('✅ Built lib/client.js');

  // 3. Emit TypeScript declaration files
  emitDeclarations();
  console.log('🎉 Build completed successfully!');
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});

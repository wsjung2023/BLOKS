// PM2 launcher — runs pnpm dev without opening a visible cmd window
const { spawn } = require('child_process');
const app = process.env.BLOKS_APP; // 'api' | 'web' | 'worker'
const child = spawn('pnpm', ['dev'], {
  cwd: require('path').join(__dirname, 'apps', app),
  stdio: 'inherit',
  shell: true,
  windowsHide: true,
});
child.on('exit', (code) => process.exit(code ?? 0));

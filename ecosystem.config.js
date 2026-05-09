// PM2 ecosystem — BLOKS dev stack (Windows, no visible windows)
const ROOT = __dirname;
const LAUNCHER = `${ROOT}\\pm2-launcher.js`;

module.exports = {
  apps: [
    {
      name: "bloks-api",
      script: LAUNCHER,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 20,
      env: { NODE_ENV: "development", BLOKS_APP: "api" },
    },
    {
      name: "bloks-web",
      script: LAUNCHER,
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 20,
      env: { NODE_ENV: "development", BLOKS_APP: "web" },
    },
    {
      name: "bloks-worker",
      script: LAUNCHER,
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      env: { NODE_ENV: "development", BLOKS_APP: "worker" },
    },
  ],
};

module.exports = {
  apps: [
    {
      name: "lifetracker",
      script: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "350M",
      env: {
        PORT: 3000,
        NODE_ENV: "production",
      },
    },
  ],
}

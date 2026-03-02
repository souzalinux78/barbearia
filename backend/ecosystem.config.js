module.exports = {
  apps: [
    {
      name: "barbearia-api",
      script: "dist/server.js",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        PRISMA_CLIENT_ENGINE_TYPE: "library"
      },
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      time: true
    }
  ]
};

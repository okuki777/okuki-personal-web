module.exports = {
  apps: [
    {
      name: 'okuki-home',
      script: 'server/standalone.js',
      cwd: __dirname.replace(/[\\/]server$/, ''),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      out_file: './logs/out.log',
      error_file: './logs/err.log',
      merge_logs: true,
      time: true
    }
  ]
}

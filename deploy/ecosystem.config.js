module.exports = {
    apps: [{
      name: 'cfrsite',
      script: './scripts/admin-server.mjs',
      cwd: '/home/cfr_balloo/sites/cfrsite',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ADMIN_PORT: 3456,
        ADMIN_PASSWORD: 'ЦФР_2026.10.21',
      },
      // PM2 читает .env.production в корне проекта
      dotenv_config_path: '.env.production',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      wait_ready: true,
      kill_timeout: 5000
    }]
  };
  
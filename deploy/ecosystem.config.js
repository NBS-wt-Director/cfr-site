module.exports = {
    apps: [{
      name: 'shifu-panda',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: '/home/deploy/shifu-panda',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_file: '.env.production',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      wait_ready: true,
      kill_timeout: 5000
    }]
  };
  
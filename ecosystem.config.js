module.exports = {
  apps: [
    {
      name: 'optisass-angular-api',
      script: 'dist/src/main.js',
      cwd: '/home/ubuntu/projects/optisass-angular/backend',
      node_args: '--max-old-space-size=1800',
      env: {
        PORT: 3003,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public',
        MINIO_ENDPOINT: 'localhost',
        MINIO_PORT: '9002',
        MINIO_ACCESS_KEY: 'minioadmin',
        MINIO_SECRET_KEY: 'minioadmin',
        MINIO_BUCKET: 'optisaas',
        MINIO_PUBLIC_URL: 'http://localhost:9002',
      },
    },
  ],
};


// Configuration PM2 pour la version DEMO d'OptiSaas
module.exports = {
  apps: [
    {
      name: 'optisaas-backend-demo',
      script: 'dist/src/main.js',
      cwd: '/home/ubuntu/projects/optisaas-demo/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        DATABASE_URL: 'postgresql://postgres:mypassword@localhost:5432/optisaas_demo?schema=public'
      }
    }
  ]
};

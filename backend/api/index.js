// api/index.js - Point d'entrée pour Vercel Serverless (CommonJS)
const { createApp } = require('../dist/main');

let cachedApp = null;

module.exports = async (req, res) => {
  if (!cachedApp) {
    console.log('🚀 Initialisation de l\'application NestJS...');
    cachedApp = await createApp();
    console.log('✅ Application initialisée');
  }
  
  return cachedApp(req, res);
};
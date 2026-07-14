const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Dev-only: proxy API calls through the React dev server so phones on the LAN
 * can use http://192.168.x.x:3000 without cross-origin requests to :9001.
 */
module.exports = function setupProxy(app) {
  app.use(
    ['/api', '/accounts', '/media'],
    createProxyMiddleware({
      target: 'http://127.0.0.1:9001',
      changeOrigin: true,
    })
  );
};

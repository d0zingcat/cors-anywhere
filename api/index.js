const cors_proxy = require('../lib/cors-anywhere');

// Parse environment variables for configuration
function parseEnvList(env) {
  if (!env) {
    return [];
  }
  return env.split(',');
}

const originBlacklist = parseEnvList(process.env.CORSANYWHERE_BLACKLIST);
const originWhitelist = parseEnvList(process.env.CORSANYWHERE_WHITELIST);

// Set up rate-limiting to avoid abuse
const checkRateLimit = require('../lib/rate-limit')(process.env.CORSANYWHERE_RATELIMIT);

// Create the CORS Anywhere server options
const options = {
  originBlacklist: originBlacklist,
  originWhitelist: originWhitelist,
  requireHeader: ['origin', 'x-requested-with'],
  checkRateLimit: checkRateLimit,
  removeHeaders: [
    'cookie',
    'cookie2',
    // Strip Vercel-specific headers that might cause issues
    'x-vercel-id',
    'x-vercel-forwarded-for',
    'x-vercel-deployment-url',
    'x-vercel-trace',
    // Keep other headers that might be useful
  ],
  redirectSameOrigin: true,
  httpProxyOptions: {
    // Vercel handles forwarding headers, so we can keep this
    xfwd: true,
  },
};

// Create the server (this will give us access to the internal handler)
const server = cors_proxy.createServer(options);

// Extract the request handler from the server
// This is a bit of a hack, but necessary for Vercel serverless functions
const requestHandler = server.listeners('request')[0];

module.exports = (req, res) => {
  // Vercel serverless functions expect the handler to be called directly
  // But we need to ensure the request URL is properly formatted

  // For Vercel, the path might include the API route prefix
  // We need to adjust the URL to match what CORS Anywhere expects
  const originalUrl = req.url;
  if (req.url.startsWith('/api/')) {
    // Remove the /api/ prefix for CORS Anywhere
    req.url = req.url.substring(4);
  }

  // Call the CORS Anywhere handler
  requestHandler(req, res);
};
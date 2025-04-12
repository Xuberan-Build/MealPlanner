module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
          fs: false,
          "fs/promises": false,
          net: false,
          tls: false,
          stream: require.resolve("stream-browserify"),
          zlib: require.resolve("browserify-zlib"),
          http: require.resolve("stream-http"),
          https: require.resolve("https-browserify"),
          buffer: require.resolve("buffer/"),
          util: require.resolve("util/"),
          os: require.resolve("os-browserify/browser"),
          path: require.resolve("path-browserify"),
          crypto: require.resolve("crypto-browserify"),
          querystring: require.resolve("querystring-es3"),
          // Add any other fallbacks as needed
        },
        alias: {
          "node:fs": false,
          "node:fs/promises": false,
          "node:net": false,
          "node:tls": false,
          "node:stream": require.resolve("stream-browserify"),
          "node:zlib": require.resolve("browserify-zlib"),
          "node:http": require.resolve("stream-http"),
          "node:https": require.resolve("https-browserify"),
          "node:buffer": require.resolve("buffer/"),
          "node:util": require.resolve("util/"),
          "node:os": require.resolve("os-browserify/browser"),
          "node:path": require.resolve("path-browserify"),
          "node:crypto": require.resolve("crypto-browserify"),
          "node:querystring": require.resolve("querystring-es3"),
          "node:async_hooks": false
        }
      }
    }
  }
};

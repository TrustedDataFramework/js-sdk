const path = require("path");

module.exports = (env = {}) => ({
  mode: env.prod ? 'production' : 'development',
  devtool: env.prod ? 'source-map' : 'inline-source-map',
  entry: path.join(__dirname, "src/index.ts"),
  output: {
    path: path.join(__dirname, "dist"),
    filename: "bundle.js",
    library: "tdsSDK",
    libraryTarget: "umd",
  },
  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: [".ts", ".tsx", ".js"],
    // ignore node module
    fallback: {
      child_process: false,
      crypto: false,
      buffer: false,
      http: false,
      url: false,
      path: false,
      fs: false,
      worker_threads: false
    },
  },
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: { transpileOnly: true },
        exclude: /node_modules/,
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel-loader",
      },
    ],
  },
  externals: {
    // require('ws') as WebSocket
    ws: "WebSocket",
    "assemblyscript/cli/asc": 'commonjs2 assemblyscript/cli/asc',
  },
})

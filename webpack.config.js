const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './dist/swap.js', // Update this path to reflect the new location of swap.js
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist'),
    },
  mode: 'development',
  devServer: {
    static: path.join(__dirname, 'dist'), // Serve content from /dist
    port: 8080,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html', // Use your custom HTML file
    }),
  ],
};

import { UserscriptPlugin }  from 'webpack-userscript';

export default {
  entry: './src/userscript.js',
  output: {
    filename: 'revert.js'
  },
  module: {
    rules: [
      {
        test: /\.s[ac]ss$/i,
        type: 'asset/source',
        use: [
          "sass-loader"
        ],
      },
    ],
  },
  plugins: [ new UserscriptPlugin({
    headers: {
     name: 'Piazza Revert',
     namespace: 'https://github.com/embeddedt',
     description: 'Revert Piazza to the old user interface',
     icon: 'https://www.google.com/s2/favicons?sz=64&domain=piazza.com',
     author: 'embeddedt',
     match: 'https://piazza.com/*',
     homepage: 'https://github.com/embeddedt/piazza-revert',
     updateURL: 'https://github.com/embeddedt/piazza-revert/raw/refs/heads/main/revert.user.js',
     downloadURL: 'https://github.com/embeddedt/piazza-revert/raw/refs/heads/main/revert.user.js',
     grant: ['GM_addStyle', 'GM_addElement']
    }
  }) ]
};


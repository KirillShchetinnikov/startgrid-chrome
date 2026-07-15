module.exports = (webpack) => ({
  plugins: [
    'postcss-import',
    'postcss-nesting',
    'autoprefixer',
    'postcss-sort-media-queries',
    webpack.mode === 'production' && 'postcss-csso'
  ]
})

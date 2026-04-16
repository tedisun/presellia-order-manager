module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@modules': './src/modules',
            '@components': './src/components',
            '@services': './src/services',
            '@config': './src/config',
            '@navigation': './src/navigation',
            '@app-types': './src/types',
            '@context':   './src/context',
          },
        },
      ],
    ],
  };
};

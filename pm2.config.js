module.exports = {
  apps: [
    {
      name: 'VK-TO-TG',
      script: './entry.mjs',
      node_args: '--experimental-modules',
      autorestart: true,
    },
  ],
};

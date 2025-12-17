process.env.SERVERS_JSON='[{"host":"syd.retslav.net","port":10257,"minBots":1,"maxBots":3,"version":"1.21.8"},{"host":"191.96.231.5","port":30066,"minBots":1,"maxBots":3,"version":"1.21.8"},{"host":"135.125.9.13","port":2838,"minBots":1,"maxBots":3,"version":"1.21.8"},{"host":"151.242.106.7","port":25340,"minBots":1,"maxBots":3,"version":"1.21.8"}]';

const { initialize, shutdown } = require('@baipiaodajun/mcbots');

initialize().then(() => {
  console.log('mcbots start successed');
}).catch(err => {
  console.error('mcbots start fail:', err);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
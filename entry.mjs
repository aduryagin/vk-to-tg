import VK from './connect/vk';
import DB from './connect/db';
import Bot from './connect/telegraf';

const startScheduledGrubbing = (service, mins = 10) => {
  const grubFromService = async () => {
    try {
      await service.scheduleWork();

      const grub = () => {
        setTimeout(async () => {
          try {
            await service.scheduleWork();
            grub();
          } catch (e) {
            console.log('Ошибка', e);
          }
        }, 1000 * 60 * mins);
      };

      grub();
    } catch (e) {
      console.log('Ошибка', e);
    }
  };

  grubFromService();
};

const init = async () => {
  const db = new DB();
  const dbInstance = await db.connect();
  const bot = new Bot(db, dbInstance);
  const vk = new VK(db, bot, dbInstance);

  startScheduledGrubbing(vk);
  startScheduledGrubbing(bot, 1);
};

init();

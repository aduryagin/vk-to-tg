import Telegram from 'telegraf/telegram';
import Telegraf from 'telegraf';
import moment from 'moment-timezone';

export default class Bot {
  constructor(db, dbInstance) {
    this.db = db;
    this.dbInstance = dbInstance;
    this.token = process.env.BOT_TOKEN;
    this.replyMarkup = {
      inline_keyboard: [
        [
          {
            text: 'Отправить',
            callback_data: 'publish',
          },
        ],
      ],
    };
    this.channel = process.env.TELEGRAM_CHANNEL;

    this.connect();
    this.listeners();
  }

  connect() {
    this.bot = new Telegram(this.token);
    this.telegraf = new Telegraf(this.token);
    this.telegraf.startPolling();
  }

  async notification(text, ctx) {
    await ctx.reply(text);
  }

  async publishMessage(message, notification, ctx) {
    const result = await this.dbInstance.query('SELECT COUNT (*) FROM planned');

    const randomMinutes = Math.floor(Math.random() * (180 - 120 + 1) + 120);
    let postDate = moment()
      .tz('Europe/Moscow')
      .add(randomMinutes, 'm');

    if (Number(result.rows[0].count)) {
      const latestTime = await this.dbInstance.query(
        `SELECT time FROM planned ORDER BY time DESC LIMIT 1`
      );

      postDate = moment(latestTime.rows[0].time)
        .tz('Europe/Moscow')
        .add(randomMinutes, 'm');
    }

    const postHours = postDate.hour();

    if (postHours > 22) {
      postDate.add(1, 'days');
      postDate.hours(8);
    } else if (postHours < 8) {
      postDate.hours(8);
    }

    let type = 'text';
    if (message.photo) {
      type = 'photo';
    } else if (message.document) {
      type = 'document';
    }

    const fileID =
      type === 'text'
        ? message.text
        : Array.isArray(message[type])
          ? message[type].slice(-1)[0].file_id
          : message[type].file_id;
    const imageExistsResult = await this.dbInstance.query(
      `SELECT COUNT (file_id) FROM planned WHERE file_id = '${fileID}'`
    );

    if (Number(imageExistsResult.rows[0].count)) {
      notification(
        'Пост с такой картинкой или текстом уже находится в очереди.',
        ctx
      );
    } else {
      await this.dbInstance.query(
        `INSERT INTO planned (file_id, type, time) VALUES ('${fileID}', '${type}', '${postDate.toISOString()}')`
      );
      notification(
        `Пост будет опубликован ${postDate.format('D MMM HH:mm')}`,
        ctx
      );
    }
  }

  async getAdmins() {
    const admins = await this.bot.getChatAdministrators(this.channel);
    return admins.filter(admin => !admin.user.is_bot);
  }

  listeners() {
    this.telegraf.action('publish', async ctx => {
      try {
        const { message } = ctx.update.callback_query;
        await this.publishMessage(message, ctx.answerCbQuery);
        await ctx.deleteMessage();
      } catch (e) {
        console.error('Ошибка публикации', e);
      }
    });

    this.telegraf.command('planned', async ctx => {
      const result = await this.dbInstance.query('SELECT * FROM planned');
      let string = '';
      // eslint-disable-next-line
      result.rows.forEach(row => (string += `${moment(row.time).tz('Europe/Moscow').toString()}\n`));
      if (string === '') string = 'Запланированных сообщений нет.';
      ctx.reply(string);
    });

    this.telegraf.command('pages', async ctx => {
      const result = await this.dbInstance.query('SELECT url FROM vk_publics');
      let string = '';
      // eslint-disable-next-line
      result.rows.forEach((row, index) => (string += `${index + 1} - <a href="https://vk.com/${row.url}">${row.url}</a>\n`));
      if (string === '') string = 'Вы не добавили ни одного паблика.';
      ctx.replyWithHTML(string);
    });

    this.telegraf.command('add_page', async ctx => {
      const page = ctx.message.text.substr(10).trim();
      if (page !== '') {
        const result = await this.dbInstance.query(
          `SELECT url FROM vk_publics WHERE url = '${page}'`
        );

        if (result.rows.length) {
          ctx.reply(`Страница ${page} уже добавлена.`);
        } else {
          await this.dbInstance.query(
            `INSERT INTO vk_publics (url) VALUES ('${page}')`
          );
          ctx.reply('Страница добавлена!');
        }
      } else {
        ctx.reply(
          'Что бы добавить страницу, отправь сообщение /add_page page-url.'
        );
      }
    });

    this.telegraf.command('remove_page', async ctx => {
      const page = ctx.message.text.substr(13).trim();
      if (page !== '') {
        const result = await this.dbInstance.query(
          `SELECT url FROM vk_publics WHERE url = '${page}'`
        );

        if (!result.rows.length) {
          ctx.reply(`Страницы ${page} не существует в базе.`);
        } else {
          await this.dbInstance.query(
            `DELETE FROM vk_publics WHERE url = '${page}'`
          );
          ctx.reply('Страница удалена!');
        }
      } else {
        ctx.reply(
          'Что бы удалить страницу, отправь сообщение /remove_page page-url.'
        );
      }
    });

    this.telegraf.on('message', async ctx => {
      const { message } = ctx.update;
      const admins = await this.getAdmins();

      if (!admins.find(admin => admin.user.id === message.from.id)) return;
      if (message.text && message.text.indexOf('/') === 0) return;

      this.publishMessage(message, this.notification, ctx);
    });
  }

  // Public methods

  async scheduleWork() {
    try {
      const result = await this.dbInstance.query('SELECT * FROM planned');
      result.rows.forEach(async plannedMessage => {
        try {
          const plannedMessageTime = moment(plannedMessage.time)
            .tz('Europe/Moscow')
            .valueOf();

          const now = moment()
            .tz('Europe/Moscow')
            .valueOf();

          if (plannedMessageTime <= now) {
            if (plannedMessage.type === 'text') {
              this.bot.sendMessage(this.channel, plannedMessage.file_id);
            } else if (plannedMessage.type === 'photo') {
              this.bot.sendPhoto(this.channel, plannedMessage.file_id);
            } else if (plannedMessage.type === 'document') {
              this.bot.sendDocument(this.channel, plannedMessage.file_id);
            }

            this.dbInstance.query(
              `DELETE FROM planned WHERE file_id = '${plannedMessage.file_id}'`
            );
          }
        } catch (e) {
          console.log('Ошибка', e);
        }
      });
    } catch (e) {
      console.log('Ошибка', e);
    }
  }

  sendMessageToAdmin(message) {
    this.bot.sendMessage(40923799, message);
  }

  sendVideo(video, admin) {
    this.bot
      .sendDocument(admin, video, {
        reply_markup: this.replyMarkup,
      })
      .catch(e => {
        this.sendMessageToAdmin(`sendDocument - ${video} - ${e.message}`);
      });
  }

  sendPhoto(photo, caption, admin) {
    this.bot
      .sendPhoto(admin, photo, {
        caption,
        reply_markup: this.replyMarkup,
      })
      .catch(e => {
        this.sendMessageToAdmin(`sendPhoto - ${photo} - ${e.message}`);
      });
  }

  sendMessage(message, admin) {
    this.bot
      .sendMessage(admin, message, {
        reply_markup: this.replyMarkup,
      })
      .catch(e => {
        this.sendMessageToAdmin(`sendMessage - ${message} - ${e.message}`);
      });
  }
}

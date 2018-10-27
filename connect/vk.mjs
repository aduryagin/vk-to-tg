import VKApi from 'node-vkapi';

export default class VK {
  constructor(db, bot) {
    this.db = db;
    this.bot = bot;

    this.connect();
  }

  connect() {
    this.vk = new VKApi({
      accessToken: process.env.VK_ACCESS_TOKEN,
      apiVersion: process.env.VK_API_VERSION || '5.76',
      appId: process.env.VK_APP_ID,
      appSecret: process.env.VK_APP_SECRET,
    });
  }

  async scheduleWork() {
    try {
      const [vkPublics, admins] = await Promise.all([
        this.db.getVKPublics(),
        this.bot.getAdmins(),
      ]);

      let adminIndex = 0;
      // eslint-disable-next-line
      function adminIndexInc() {
        adminIndex = adminIndex === admins.length - 1 ? 0 : adminIndex + 1;
      }

      vkPublics.rows.forEach((vkPublic, i) => {
        setTimeout(async () => {
          try {
            const data = await this.vk.call('wall.get', {
              domain: vkPublic.url,
              offset: 10,
              filter: 'owner',
              count: 10,
            });

            const lastViewedPostDate = vkPublic.last_viewed_post_date;
            const posts = data.items.filter(
              item =>
                !item.marked_as_ads &&
                (lastViewedPostDate
                  ? lastViewedPostDate.getTime() / 1000 < item.date // Only new posts
                  : true) &&
                item.text.indexOf('[club') === -1 && // Disable ad posts
                item.text.indexOf('vk.com') === -1 &&
                item.text.indexOf('vk.cc') === -1
            );

            if (!posts.length) return;

            const averageViews =
              posts.reduce(
                (prev, current) =>
                  (prev.views ? prev.views.count : 0) + current.views.count
              ) / posts.length;
            const bestPosts = posts
              .filter(post => post.views.count >= averageViews)
              .sort((a, b) => a.date - b.date);

            // Send best posts to users

            if (!bestPosts.length) return;

            bestPosts.forEach(bestPost => {
              if (bestPost.attachments) {
                const firstAttachment = bestPost.attachments[0];

                if (firstAttachment.type === 'photo') {
                  const maxResolutionPhotoKey = Object.keys(
                    firstAttachment.photo
                  )
                    .reverse()
                    .find(key => key.indexOf('photo') !== -1);
                  const maxResolutionPhotoURL =
                    firstAttachment.photo[maxResolutionPhotoKey];
                  this.bot.sendPhoto(
                    maxResolutionPhotoURL,
                    bestPost.text.substr(0, 200),
                    admins[adminIndex].user.id
                  );
                  adminIndexInc();
                } else if (
                  firstAttachment.type === 'doc' &&
                  firstAttachment.doc.ext === 'gif' &&
                  firstAttachment.doc.size <= 52428800
                ) {
                  this.bot.sendVideo(
                    firstAttachment.doc.url,
                    admins[adminIndex].user.id
                  );
                  adminIndexInc();
                }
              } else if (bestPost.text) {
                this.bot.sendMessage(bestPost.text, admins[adminIndex].user.id);
                adminIndexInc();
              }
            });

            await this.db.updateVKLastViewedPost(
              vkPublic.url,
              bestPosts[bestPosts.length - 1].date
            );
          } catch (e) {
            console.log('Ошибка', e);
          }
        }, 1000 * (i + 1));
      });
    } catch (e) {
      console.log('Ошибка', e);
    }
  }
}

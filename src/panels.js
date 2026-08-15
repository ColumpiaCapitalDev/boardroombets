const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { channelUrl } = require('./config');
const { buildGuidePayload } = require('./content');

const PANEL_TITLES = Object.freeze({
  guide: 'Boardroom Bets Server Guide',
  rules: 'Boardroom Bets Community Rules',
  announcements: 'Boardroom Bets Announcements',
  gainAccess: 'Unlock Your Boardroom Access',
  freePremium: 'Start Free. Earn Your Seat.',
  socials: 'Follow Boardroom Bets',
  upgrade: 'Choose Your Seat',
  bankroll: 'Protect the Bankroll',
});

function linkButton(label, url, emoji) {
  const button = new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url);
  if (emoji) button.setEmoji(emoji);
  return button;
}

function rulesPanelPayload(config) {
  return {
    content: 'Read every rule, then react with ✅ to confirm and receive the **' + config.roles.rulesAcceptedName + '** role.',
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle(PANEL_TITLES.rules)
        .setDescription('The Boardroom works when the conversation stays sharp, honest, and useful.')
        .addFields(
          { name: '1. Respect the room', value: 'No harassment, hate speech, threats, personal attacks, or unnecessary drama.' },
          { name: '2. No spam or outside promotion', value: 'Do not advertise other servers, paid groups, services, affiliate links, or send unsolicited promotional DMs.' },
          { name: '3. Protect private plays', value: 'Do not leak, repost, screenshot, sell, or share VIP plays or private server content.' },
          { name: '4. Keep results honest', value: 'No edited slips, fake tickets, misleading odds, or claiming a result after the game has started.' },
          { name: '5. Use the correct channels', value: 'Keep picks, wins, general discussion, support, and access questions in their designated areas.' },
          { name: '6. Respect the card', value: 'Discussion is welcome. Pick shaming, personal attacks, and reckless guarantees are not.' },
          { name: '7. Bet responsibly', value: 'No play is guaranteed. Use a dedicated bankroll, stay within your limits, and never chase losses.' },
          { name: '8. Staff has final say', value: 'Staff may warn, timeout, remove, or ban anyone whose behavior puts the community at risk.' }
        )
        .setFooter({ text: 'React with ✅ when you have read and accepted the rules' }),
    ],
    allowedMentions: { parse: [] },
  };
}

function announcementsPanelPayload(config) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle(PANEL_TITLES.announcements)
        .setDescription('This is the official source for Boardroom updates. Keep notifications on so you do not miss important changes.')
        .addFields(
          { name: 'What gets posted here', value: 'VIP updates, card alerts, promotions, partnerships, schedule changes, server news, and important member information.' },
          { name: 'Where to talk', value: 'Use <#' + config.channels.freeChat + '> for community conversation and <#' + config.channels.needHelp + '> when you need direct support.' }
        )
        .setFooter({ text: 'Boardroom Bets • Official updates only' }),
    ],
    allowedMentions: { parse: [] },
  };
}

function gainAccessPanelPayload(config) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle(PANEL_TITLES.gainAccess)
        .setDescription('Winible is the official membership system for Boardroom VIP. Follow these steps after choosing your plan.')
        .addFields(
          { name: '1. Choose your seat', value: 'Open the official Boardroom Winible page and select the membership that fits you.' },
          { name: '2. Connect Discord', value: 'Use the Discord connection inside your Winible account and authorize the same Discord account you use in this server.' },
          { name: '3. Let access sync', value: 'Your VIP role should update automatically after the accounts are connected.' },
          { name: '4. Need help?', value: 'If access does not appear, open a ticket in <#' + config.channels.needHelp + '> and include the email used on Winible.' }
        )
        .setFooter({ text: 'Never send payment details or passwords in a Discord ticket' }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        linkButton('Open Boardroom VIP', config.premiumUrl, '💎'),
        linkButton('Need Help', channelUrl(config.channels.needHelp), '🎫')
      ),
    ],
    allowedMentions: { parse: [] },
  };
}

function freePremiumPanelPayload(config) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle(PANEL_TITLES.freePremium)
        .setDescription('Start inside the free community, learn how the room operates, and move into VIP when you are ready for the full card.')
        .addFields(
          { name: 'Free community access', value: 'Free picks when posted, community discussion, bankroll education, tracked wins, announcements, and support.' },
          { name: 'The VIP seat', value: 'The complete member card, private Discord and Telegram delivery, faster alerts, and the full Boardroom experience.' },
          { name: 'No pressure', value: 'Use the free room to learn the process. Upgrade only when the membership fits your goals and bankroll.' }
        )
        .setFooter({ text: 'Boardroom Bets • Free community access stays available' }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        linkButton('Explore Boardroom VIP', config.premiumUrl, '💎'),
        linkButton('Free Picks', channelUrl(config.channels.freePicks), '🎯'),
        linkButton('Free Chat', channelUrl(config.channels.freeChat), '💬')
      ),
    ],
    allowedMentions: { parse: [] },
  };
}

function socialsPanelPayload(config) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle(PANEL_TITLES.socials)
        .setDescription('Stay connected with the official Boardroom Bets platforms. Use these links so you know you are following the real accounts.')
        .addFields(
          { name: 'Official website', value: '[boardroombets.com](' + config.links.website + ')' },
          { name: 'Instagram', value: '[@txrichjd](' + config.links.instagram + ')' },
          { name: 'VIP membership', value: '[The Boardroom on Winible](' + config.premiumUrl + ')' }
        )
        .setFooter({ text: 'Only trust links posted by Boardroom staff' }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        linkButton('Official Website', config.links.website, '🌐'),
        linkButton('Instagram', config.links.instagram, '📸'),
        linkButton('Boardroom VIP', config.premiumUrl, '💎')
      ),
    ],
    allowedMentions: { parse: [] },
  };
}

function upgradePanelPayload(config) {
  return {
    content: config.premiumUrl,
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle(PANEL_TITLES.upgrade)
        .setDescription('Every paid Boardroom plan unlocks the same private Discord and Telegram delivery. Choose the schedule that fits how you want to enter the room.')
        .addFields(
          { name: 'VIP Weekly', value: 'A flexible way to test the full room before committing longer.', inline: true },
          { name: 'VIP Monthly', value: 'The recurring membership built for regular members.', inline: true },
          { name: 'VIP Yearly', value: 'Long-term access for members committed to the full year.', inline: true },
          { name: 'NFL Season Pass', value: 'One season-long membership built around the football calendar.', inline: true },
          { name: 'What VIP includes', value: 'The member card across sports, private Discord and Telegram access, fast play delivery, and unit-management guidance.' }
        )
        .setFooter({ text: 'Boardroom Bets • No play or result is guaranteed' }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        linkButton('VIP Weekly', config.links.weekly, '📅'),
        linkButton('VIP Monthly', config.links.monthly, '📈'),
        linkButton('VIP Yearly', config.links.yearly, '🏆')
      ),
      new ActionRowBuilder().addComponents(
        linkButton('NFL Season Pass', config.links.season, '🏈'),
        linkButton('View All Plans', config.premiumUrl, '💎'),
        linkButton('Need Help', channelUrl(config.channels.needHelp), '🎫')
      ),
    ],
    allowedMentions: { parse: [] },
  };
}

function bankrollPanelPayload(config) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle(PANEL_TITLES.bankroll)
        .setDescription('Your bankroll is money intentionally separated for sports betting. The objective is to protect it, stay consistent, and give good decisions time to work.')
        .addFields(
          { name: '1. Define the bankroll', value: 'Use only money you can afford to lose without affecting bills, savings, or everyday life.' },
          { name: '2. Find one unit', value: 'A common starting range is 1% to 2% of the current bankroll for a standard play. Use /bankroll calculate privately to find your unit size.' },
          { name: '3. Keep sizing consistent', value: 'Do not randomly double, triple, or max a play because it feels stronger. Follow the posted unit guidance.' },
          { name: '4. Never chase', value: 'Losing stretches happen. Do not increase risk simply to recover the last result or the last slate.' },
          { name: '5. Track the full record', value: 'Record the odds, units risked, result, and total units won or lost. If you are not tracking, you are guessing.' },
          { name: '6. Review—not react', value: 'Recalculate your unit at planned checkpoints instead of after every win or loss. Think in meaningful samples, not single days.' },
          { name: 'The Boardroom approach', value: 'Stay selective. Protect the roll. Respect the units. Think long term.' }
        )
        .setFooter({ text: 'React with ✅ when you have read the guide • No play is guaranteed' }),
    ],
    allowedMentions: { parse: [] },
  };
}

const PAYLOAD_BUILDERS = {
  guide: buildGuidePayload,
  rules: rulesPanelPayload,
  announcements: announcementsPanelPayload,
  gainAccess: gainAccessPanelPayload,
  freePremium: freePremiumPanelPayload,
  socials: socialsPanelPayload,
  upgrade: upgradePanelPayload,
  bankroll: bankrollPanelPayload,
};

async function replacePanel(channel, payload, title) {
  const recent = await channel.messages.fetch({ limit: 50 });
  const oldPanels = recent.filter((message) =>
    message.author.id === channel.client.user.id && message.embeds.some((embed) => embed.title === title)
  );
  await Promise.all(oldPanels.map((message) => message.delete().catch(() => null)));
  return channel.send(payload);
}

async function postPermanentPanel(guild, config, type, targetChannelId) {
  const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) throw new Error('The selected panel channel is not available.');
  const builder = PAYLOAD_BUILDERS[type];
  if (!builder) throw new Error('Unknown panel type.');
  const message = await replacePanel(channel, builder(config), PANEL_TITLES[type]);
  if (type === 'rules' || type === 'bankroll') await message.react('✅').catch(() => null);
  return message;
}

async function postBoardroomSetup(guild, config) {
  const targets = {
    guide: config.channels.welcome,
    rules: config.channels.rules,
    announcements: config.channels.announcements,
    gainAccess: config.channels.gainAccess,
    freePremium: config.channels.freePremium,
    socials: config.channels.socials,
    upgrade: config.channels.premium,
    bankroll: config.channels.bankroll,
  };
  const messages = {};
  for (const [type, channelId] of Object.entries(targets)) {
    messages[type] = await postPermanentPanel(guild, config, type, channelId);
  }
  return messages;
}

module.exports = {
  PANEL_TITLES,
  announcementsPanelPayload,
  bankrollPanelPayload,
  freePremiumPanelPayload,
  gainAccessPanelPayload,
  postBoardroomSetup,
  postPermanentPanel,
  rulesPanelPayload,
  socialsPanelPayload,
  upgradePanelPayload,
};

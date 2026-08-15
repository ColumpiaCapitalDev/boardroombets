const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { channelUrl } = require('./config');
const { buildGuidePayload } = require('./content');

const PANEL_TITLES = Object.freeze({
  guide: 'Boardroom Bets Server Guide',
  rules: 'Boardroom Bets Community Rules',
  upgrade: 'Boardroom Bets Premium Access',
  bankroll: 'Bankroll Management',
});

function rulesPanelPayload(config) {
  return {
    content: 'React with ✅ after reading every rule to receive the **' + config.roles.rulesAcceptedName + '** role.',
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle(PANEL_TITLES.rules)
        .setDescription('Keep the community useful, respectful, and safe for everyone.')
        .addFields(
          { name: '1. Respect the community', value: 'No harassment, hate speech, threats, personal attacks, or unnecessary drama.' },
          { name: '2. No spam or unauthorized promotion', value: 'Do not advertise outside servers, paid groups, services, affiliate links, or send unsolicited direct messages.' },
          { name: '3. Protect premium content', value: 'Do not leak, repost, screenshot, sell, or share premium plays or private server content.' },
          { name: '4. Keep picks honest', value: 'Do not edit slips, misrepresent odds or stakes, claim results after the fact, or shame members for a losing play.' },
          { name: '5. Use the correct channels', value: 'Keep picks, wins, general discussion, support, and promotions in their designated areas.' },
          { name: '6. Bet responsibly', value: 'No play is guaranteed. Never chase losses or wager money needed for essentials.' },
          { name: '7. Staff has final say', value: 'Staff may warn, timeout, remove, or ban members whose behavior harms the community.' }
        )
        .setFooter({ text: 'React with ✅ to confirm you have read and accepted the rules' }),
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
        .setDescription('Ready for the complete Boardroom Bets experience? Follow the current instructions in this channel to unlock premium access.')
        .addFields(
          { name: 'Premium access', value: 'Get the full card, faster play alerts, premium discussion, and the server’s strongest betting content.' },
          { name: 'Before joining', value: 'Read the rules, review the bankroll guide, and open a support ticket if you have questions about access or billing.' }
        )
        .setFooter({ text: 'Boardroom Bets • No play is guaranteed' }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Join Premium').setStyle(ButtonStyle.Link).setURL(config.premiumUrl),
        new ButtonBuilder().setLabel('Rules').setStyle(ButtonStyle.Link).setURL(channelUrl(config.channels.rules)),
        new ButtonBuilder().setLabel('Bankroll Guide').setStyle(ButtonStyle.Link).setURL(channelUrl(config.channels.bankroll)),
        new ButtonBuilder().setLabel('Need Help').setStyle(ButtonStyle.Link).setURL(channelUrl(config.channels.needHelp))
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
        .setDescription('A bankroll is money intentionally separated for sports betting. Protecting it matters more than forcing action on every board.')
        .addFields(
          { name: '1. Set a dedicated bankroll', value: 'Only use money you can afford to lose without affecting bills or everyday life.' },
          { name: '2. Find your unit size', value: 'A common starting point is 1% of the bankroll for one standard unit. Use `/bankroll calculate` privately to find yours.' },
          { name: '3. Keep sizing consistent', value: 'Do not randomly double or triple a play because it feels stronger.' },
          { name: '4. Never chase losses', value: 'Bad stretches happen. Stick to predetermined units and limits instead of trying to recover everything at once.' },
          { name: '5. Track every wager', value: 'Record the odds, stake, result, and units won or lost. If you are not tracking, you are guessing.' },
          { name: '6. Think long term', value: 'Stay selective, protect the roll, and evaluate results over a meaningful sample.' }
        )
        .setFooter({ text: 'React with ✅ when you have read the guide • No play is guaranteed' }),
    ],
    allowedMentions: { parse: [] },
  };
}

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

  let payload;
  if (type === 'guide') payload = buildGuidePayload(config);
  else if (type === 'rules') payload = rulesPanelPayload(config);
  else if (type === 'upgrade') payload = upgradePanelPayload(config);
  else if (type === 'bankroll') payload = bankrollPanelPayload(config);
  else throw new Error('Unknown panel type.');

  const message = await replacePanel(channel, payload, PANEL_TITLES[type]);
  if (type === 'rules' || type === 'bankroll') await message.react('✅').catch(() => null);
  return message;
}

module.exports = { PANEL_TITLES, bankrollPanelPayload, postPermanentPanel, rulesPanelPayload, upgradePanelPayload };

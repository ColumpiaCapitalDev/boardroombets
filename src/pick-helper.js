const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const channelQueues = new Map();
const recapPattern = /\b(?:recap|results?|final record|sweep|went \d|graded|cashed|closed out|skip(?:ping)? today|no plays?|back tomorrow|update only)\b/i;

function isHelperMessage(message) {
  return message.author.id === message.client.user.id && message.components.some((row) =>
    row.components.some((component) => component.customId === 'hoodie_pick:read')
  );
}

function pickHelperPayload(config) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle('Pick Tools')
        .setDescription('Before placing this play, confirm the **market, line, and odds**, then size it using your normal unit.')
        .setFooter({ text: 'Boardroom Bets • Open a guide below • No play is guaranteed' }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hoodie_pick:read').setLabel('How to Play').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('hoodie_pick:bankroll').setLabel('Bankroll Guide').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setLabel('Upgrade').setStyle(ButtonStyle.Link).setURL(config.premiumUrl)
      ),
    ],
    allowedMentions: { parse: [], repliedUser: false },
  };
}

function isConfiguredPick(message, config) {
  return config.picks.channelIds.includes(message.channelId) &&
    config.picks.posterUserIds.length > 0 &&
    config.picks.posterUserIds.includes(message.author.id);
}

function looksLikeNewPick(message) {
  const content = message.content.trim();
  if (!content && message.attachments.size === 0) return false;
  return !recapPattern.test(content);
}

async function replacePickHelper(message, config) {
  const recent = await message.channel.messages.fetch({ limit: 100 });
  const previous = recent.filter(isHelperMessage);
  await Promise.all(previous.map((helper) => helper.delete().catch(() => null)));
  await message.channel.send(pickHelperPayload(config));
}

async function handlePickMessage(message, config, featureState) {
  if (message.author.id === message.client.user.id) return false;
  if (!featureState.isEnabled('pickHelper') || !isConfiguredPick(message, config) || !looksLikeNewPick(message)) return false;
  const prior = channelQueues.get(message.channelId) || Promise.resolve();
  const current = prior.catch(() => null).then(() => replacePickHelper(message, config));
  channelQueues.set(message.channelId, current);
  try {
    await current;
  } finally {
    if (channelQueues.get(message.channelId) === current) channelQueues.delete(message.channelId);
  }
  return true;
}

module.exports = { handlePickMessage, isConfiguredPick, looksLikeNewPick, pickHelperPayload };

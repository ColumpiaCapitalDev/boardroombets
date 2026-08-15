const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { isAdminInteraction, isAdminMember } = require('./auth');
const { markBotInitiatedBan } = require('./ban-audit');

const invitePattern = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([a-z0-9-]+)/gi;
const promotionPatterns = [
  /\b(?:join|check\s*out)\s+(?:my|our|this)\s+(?:discord|server|community)\b/i,
  /\b(?:free|vip|premium|paid)\s+(?:picks?|plays?|locks?|signals?)\b.{0,70}\b(?:discord|server|dm|message)\b/i,
  /\b(?:dm|message|inbox)\s+me\b.{0,70}\b(?:picks?|plays?|locks?|signals?|premium|vip)\b/i,
  /\b(?:selling|buy|purchase)\b.{0,50}\b(?:picks?|plays?|locks?|signals?|membership)\b/i,
  /\b(?:guaranteed|risk[- ]?free)\s+(?:profit|return|lock|winner)\b/i,
  /\b(?:wallet|crypto)\s+(?:recovery|verification|support)\b/i,
];
const duplicateMessages = new Map();

function sanitize(value) {
  return String(value || '').replace(/`/g, 'ˋ').replace(/@/g, '@\u200b').slice(0, 900) || '(no text content)';
}

function isBypassed(message, config) {
  return message.author.bot ||
    isAdminMember(message.member, config) ||
    config.moderation.whitelistUserIds.includes(message.author.id) ||
    [config.channels.admin, config.channels.security, config.channels.watermark].includes(message.channelId);
}

async function findExternalInvite(message, config) {
  const matches = [...message.content.matchAll(invitePattern)];
  for (const match of matches) {
    const invite = await message.client.fetchInvite(match[1]).catch(() => null);
    if (!invite || !invite.guild || invite.guild.id !== config.guildId) return match[0];
  }
  return null;
}

function duplicateTrigger(message) {
  const normalized = message.content.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized.length < 15) return false;
  const now = Date.now();
  const prior = duplicateMessages.get(message.author.id) || [];
  const recent = prior.filter((item) => now - item.at < 60_000);
  recent.push({ text: normalized, at: now });
  duplicateMessages.set(message.author.id, recent.slice(-10));
  return recent.filter((item) => item.text === normalized).length >= 3;
}

async function detectViolation(message, config) {
  const externalInvite = await findExternalInvite(message, config);
  if (externalInvite) return { label: 'Outside Discord invite', evidence: externalInvite };
  if (message.mentions.users.size >= 6) return { label: 'Mass mention spam', evidence: message.mentions.users.size + ' user mentions' };
  const promotion = promotionPatterns.find((pattern) => pattern.test(message.content));
  if (promotion) return { label: 'Suspicious promotion', evidence: 'Promotional language pattern' };
  if (duplicateTrigger(message)) return { label: 'Repeated-message spam', evidence: 'Same message posted 3 times within 60 seconds' };
  return null;
}

function reviewComponents(userId, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('boardroom_mod:ban:' + userId).setLabel('BAN').setStyle(ButtonStyle.Danger).setDisabled(disabled),
      new ButtonBuilder().setCustomId('boardroom_mod:allow:' + userId).setLabel('ALLOW').setStyle(ButtonStyle.Success).setDisabled(disabled)
    ),
  ];
}

async function sendReview(message, config, violation, action) {
  const channel = await message.guild.channels.fetch(config.channels.security).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  await channel.send({
    content: '<@&' + config.roles.admin + '>',
    embeds: [
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('Promotion / Spam Review')
        .setDescription('Review the removed message and decide whether this member should be banned or allowed back after the timeout.')
        .addFields(
          { name: 'Member', value: '<@' + message.author.id + '> (`' + message.author.id + '`)', inline: true },
          { name: 'Channel', value: '<#' + message.channelId + '>', inline: true },
          { name: 'Trigger', value: violation.label, inline: true },
          { name: 'Automatic Action', value: action },
          { name: 'Message', value: sanitize(message.content) },
          { name: 'Evidence', value: sanitize(violation.evidence) }
        )
        .setFooter({ text: 'ALLOW removes the active timeout; it does not permanently whitelist the member' })
        .setTimestamp(),
    ],
    components: reviewComponents(message.author.id),
    allowedMentions: { roles: [config.roles.admin], users: [], repliedUser: false },
  });
}

async function moderateMessage(message, config) {
  if (!config.moderation.enabled || !message.inGuild() || isBypassed(message, config)) return false;
  const violation = await detectViolation(message, config);
  if (!violation) return false;

  await message.delete().catch(() => null);
  let action = 'Message removed. The bot could not apply a timeout; check its role position and Moderate Members permission.';
  if (message.member && message.member.moderatable) {
    const duration = config.moderation.timeoutMinutes * 60_000;
    await message.member.timeout(duration, violation.label + ' — pending staff review').then(() => {
      action = 'Message removed and member timed out for ' + config.moderation.timeoutMinutes + ' minutes.';
    }).catch(() => null);
  }
  await sendReview(message, config, violation, action).catch((error) => console.error('Security review post failed:', error));
  return true;
}

async function handleModerationButton(interaction, config) {
  if (!interaction.isButton() || !interaction.customId.startsWith('boardroom_mod:')) return false;
  if (!isAdminInteraction(interaction, config)) {
    await interaction.reply({ content: 'Only Boardroom Bets admins can review moderation actions.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const [, action, userId] = interaction.customId.split(':');
  await interaction.deferUpdate();

  let result;
  let color;
  if (action === 'ban') {
    markBotInitiatedBan(interaction.guild.id, userId);
    await interaction.guild.members.ban(userId, { deleteMessageSeconds: 0, reason: 'Approved by ' + interaction.user.tag + ' from security review' });
    result = 'BANNED by <@' + interaction.user.id + '>';
    color = 0xed4245;
  } else {
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (member && member.moderatable) await member.timeout(null, 'Allowed by ' + interaction.user.tag + ' from security review');
    result = member ? 'ALLOWED by <@' + interaction.user.id + '> — active timeout removed.' : 'ALLOWED by <@' + interaction.user.id + '> — member is no longer in the server.';
    color = 0x57f287;
  }

  const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(color).addFields({ name: 'Staff Decision', value: result }).setTimestamp();
  await interaction.editReply({ embeds: [embed], components: reviewComponents(userId, true), allowedMentions: { parse: [] } });
  return true;
}

module.exports = { detectViolation, handleModerationButton, moderateMessage };

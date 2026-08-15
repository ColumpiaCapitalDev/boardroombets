const { PermissionFlagsBits } = require('discord.js');
const { PANEL_TITLES } = require('./panels');

async function ensureRulesAcceptedRole(guild, config) {
  let role = config.roles.rulesAccepted
    ? await guild.roles.fetch(config.roles.rulesAccepted).catch(() => null)
    : null;
  if (!role) {
    await guild.roles.fetch();
    role = guild.roles.cache.find((candidate) => candidate.name === config.roles.rulesAcceptedName) || null;
  }
  if (!role) {
    const botMember = guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('Manage Roles is required to create the Rules Accepted role.');
    }
    role = await guild.roles.create({
      name: config.roles.rulesAcceptedName,
      color: config.brandColor,
      mentionable: false,
      hoist: false,
      reason: 'Boardroom Bets rules acceptance role',
    });
  }
  return role;
}

async function handleRulesReaction(reaction, user, config, featureState) {
  if (user.bot || !featureState.isEnabled('rulesRole')) return false;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (reaction.message.partial) await reaction.message.fetch().catch(() => null);
  const message = reaction.message;
  if (message.guildId !== config.guildId) return false;
  if (reaction.emoji.name !== '✅' || message.author?.id !== message.client.user.id) return false;
  if (!message.embeds.some((embed) => embed.title === PANEL_TITLES.rules)) return false;

  const member = await message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return false;
  const role = await ensureRulesAcceptedRole(message.guild, config);
  if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'Member accepted the Boardroom Bets rules');
  return true;
}

module.exports = { ensureRulesAcceptedRole, handleRulesReaction };

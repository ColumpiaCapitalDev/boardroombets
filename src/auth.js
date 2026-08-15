const { MessageFlags, PermissionFlagsBits } = require('discord.js');

function isAdminMember(member, config) {
  if (!member) return false;
  if (member.guild && member.guild.ownerId === member.id) return true;
  if (member.permissions && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return Boolean(member.roles && member.roles.cache && member.roles.cache.has(config.roles.admin));
}

function isAdminInteraction(interaction, config) {
  return interaction.inGuild() && isAdminMember(interaction.member, config);
}

async function requireAdmin(interaction, config, action = 'use this bot control') {
  if (isAdminInteraction(interaction, config)) return true;

  await interaction.reply({
    content: 'Only a Boardroom Bets admin can ' + action + '.',
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
  return false;
}

module.exports = {
  isAdminInteraction,
  isAdminMember,
  requireAdmin,
};

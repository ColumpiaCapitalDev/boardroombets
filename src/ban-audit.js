const { AuditLogEvent, EmbedBuilder } = require('discord.js');

const botBans = new Map();
const keyFor = (guildId, userId) => guildId + ':' + userId;

function markBotInitiatedBan(guildId, userId) {
  botBans.set(keyFor(guildId, userId), Date.now() + 30_000);
}

function consumeBotBan(guildId, userId) {
  const key = keyFor(guildId, userId);
  const expires = botBans.get(key);
  botBans.delete(key);
  return Boolean(expires && expires >= Date.now());
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function recentBanEntry(guild, userId) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await wait(750);
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 6 });
    const match = logs.entries.find((entry) =>
      String(entry.targetId || entry.target?.id || '') === String(userId) &&
      Date.now() - Number(entry.createdTimestamp || 0) <= 20_000
    );
    if (match) return match;
  }
  return null;
}

async function handleManualBan(ban, config, featureState) {
  if (!featureState.isEnabled('banAudit') || ban.guild.id !== config.guildId || consumeBotBan(ban.guild.id, ban.user.id)) return false;
  const entry = await recentBanEntry(ban.guild, ban.user.id).catch(() => null);
  if (!entry?.executor || entry.executor.bot) return false;
  const channel = await ban.guild.channels.fetch(config.channels.security).catch(() => null);
  if (!channel?.isTextBased()) return false;
  await channel.send({
    content: '<@&' + config.roles.admin + '>',
    embeds: [
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('Manual Ban Recorded')
        .setDescription('A Boardroom Bets staff member manually banned a user.')
        .addFields(
          { name: 'Banned user', value: '<@' + ban.user.id + '>\n`' + ban.user.tag + '` (`' + ban.user.id + '`)', inline: true },
          { name: 'Banned by', value: '<@' + entry.executor.id + '>\n`' + entry.executor.tag + '` (`' + entry.executor.id + '`)', inline: true },
          { name: 'Reason', value: String(entry.reason || 'No reason was provided.').slice(0, 1024) }
        )
        .setFooter({ text: 'Boardroom Bets moderation audit' })
        .setTimestamp(entry.createdAt || new Date()),
    ],
    allowedMentions: { roles: [config.roles.admin], users: [], repliedUser: false },
  });
  return true;
}

module.exports = { handleManualBan, markBotInitiatedBan };

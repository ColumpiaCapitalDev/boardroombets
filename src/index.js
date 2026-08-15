const {
  ActivityType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  PermissionFlagsBits,
} = require('discord.js');
const { requireAdmin } = require('./auth');
const { handleManualBan } = require('./ban-audit');
const { handleBettingButton, handleBettingCommand } = require('./betting-tools');
const { commands } = require('./commands');
const { config, validateConfig } = require('./config');
const { buildGuidePayload, buildWelcomePayload } = require('./content');
const { FEATURE_LABELS, FeatureState } = require('./features-state');
const { buildScoreReply } = require('./live-scores');
const { handleModerationButton, moderateMessage } = require('./moderation');
const { postBoardroomSetup, postPermanentPanel, upgradePanelPayload } = require('./panels');
const { handlePickMessage } = require('./pick-helper');
const { openPostComposer, submitPostComposer } = require('./post-composer');
const { ensureRulesAcceptedRole, handleRulesReaction } = require('./rules-reaction');
const { handleTicketInteraction, handleTicketPanelCommand, postTicketPanel } = require('./tickets');
const { handleAutomaticWatermark, handleWatermarkCommand, logoExists } = require('./watermark');

validateConfig();
const featureState = new FeatureState(config.features);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  allowedMentions: { parse: [], repliedUser: false },
});

async function securityLog(guild, title, description, color = 0xf5a300) {
  const channel = await guild.channels.fetch(config.channels.security).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  await channel.send({
    embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp()],
    allowedMentions: { parse: [] },
  }).catch(() => null);
}

async function handleMemberJoin(member) {
  if (member.guild.id !== config.guildId) return;
  const role = await member.guild.roles.fetch(config.roles.freeMember).catch(() => null);
  if (role) {
    await member.roles.add(role, 'Automatic Boardroom Bets free-member access').catch((error) =>
      securityLog(member.guild, 'Role Assignment Failed', 'Could not give <@' + member.id + '> the Free Member role. Check the bot role position.\n`' + error.message + '`', 0xed4245)
    );
  }

  if (!featureState.isEnabled('welcome')) return;
  const welcome = await member.guild.channels.fetch(config.channels.welcome).catch(() => null);
  if (welcome && welcome.isTextBased()) {
    const payload = buildWelcomePayload(config, member);
    await welcome.send(payload).catch((error) =>
      securityLog(member.guild, 'Welcome Message Failed', 'Could not welcome <@' + member.id + '>.\n`' + error.message + '`', 0xed4245)
    );
  }
  if (config.welcomeDmEnabled) {
    await member.send(buildGuidePayload(config)).catch(() => null);
  }
}

async function setupStatus(interaction) {
  if (!(await requireAdmin(interaction, config, 'check the setup status'))) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  const botMember = guild.members.me;
  const checks = [];
  const channelEntries = Object.entries(config.channels);
  for (const [label, id] of channelEntries) {
    const found = await guild.channels.fetch(id).catch(() => null);
    checks.push((found ? '✅' : '❌') + ' ' + label + ': <#' + id + '>');
  }
  const category = await guild.channels.fetch(config.ticketCategoryId).catch(() => null);
  checks.push((category ? '✅' : '❌') + ' ticket category: `' + config.ticketCategoryId + '`');
  const freeRole = await guild.roles.fetch(config.roles.freeMember).catch(() => null);
  const adminRole = await guild.roles.fetch(config.roles.admin).catch(() => null);
  await guild.roles.fetch();
  const rulesRole = (config.roles.rulesAccepted ? guild.roles.cache.get(config.roles.rulesAccepted) : null) ||
    guild.roles.cache.find((role) => role.name === config.roles.rulesAcceptedName);
  checks.push((freeRole ? '✅' : '❌') + ' Free Member role');
  checks.push((adminRole ? '✅' : '❌') + ' Admin role');
  checks.push((rulesRole ? '✅' : '⚠️') + ' Rules Accepted role');

  const required = [
    ['View Channels', PermissionFlagsBits.ViewChannel],
    ['Send Messages', PermissionFlagsBits.SendMessages],
    ['Embed Links', PermissionFlagsBits.EmbedLinks],
    ['Attach Files', PermissionFlagsBits.AttachFiles],
    ['Read History', PermissionFlagsBits.ReadMessageHistory],
    ['Manage Channels', PermissionFlagsBits.ManageChannels],
    ['Manage Roles', PermissionFlagsBits.ManageRoles],
    ['Manage Messages', PermissionFlagsBits.ManageMessages],
    ['Moderate Members', PermissionFlagsBits.ModerateMembers],
    ['Ban Members', PermissionFlagsBits.BanMembers],
    ['View Audit Log', PermissionFlagsBits.ViewAuditLog],
  ];
  const permissionChecks = required.map(([name, permission]) =>
    (botMember && botMember.permissions.has(permission) ? '✅' : '❌') + ' ' + name
  );
  const hierarchyOkay = botMember && freeRole && botMember.roles.highest.comparePositionTo(freeRole) > 0;
  permissionChecks.push((hierarchyOkay ? '✅' : '❌') + ' Bot role is above Free Member');
  const hasLogo = await logoExists(config);

  const embed = new EmbedBuilder()
    .setColor(checks.some((item) => item.startsWith('❌')) || permissionChecks.some((item) => item.startsWith('❌')) ? 0xed4245 : 0x57f287)
    .setTitle('Boardroom Bets Setup Status')
    .addFields(
      { name: 'Channels & Roles', value: checks.join('\n').slice(0, 1024) },
      { name: 'Bot Permissions', value: permissionChecks.join('\n').slice(0, 1024) },
      {
        name: 'Watermark Design',
        value: config.watermark.style === 'x-text'
          ? '✅ X pattern • `' + config.watermark.text + '`'
          : (hasLogo
              ? (config.watermark.style === 'full-overlay' ? '✅ Full-frame Boardroom Bets asset ready' : '✅ Logo ready')
              : '⚠️ The configured watermark asset is missing'),
      },
      {
        name: 'Moderation',
        value: config.moderation.enabled
          ? '✅ Enabled • ' + config.moderation.timeoutMinutes + '-minute timeout • ' + config.moderation.whitelistUserIds.length + ' whitelisted users'
          : '⚠️ Disabled',
      },
      {
        name: 'Pick Helper',
        value: config.picks.channelIds.length > 0 && config.picks.posterUserIds.length > 0
          ? '✅ ' + config.picks.channelIds.length + ' channels • ' + config.picks.posterUserIds.length + ' authorized posters'
          : '⚠️ Add `PICK_CHANNEL_IDS` and `PICK_POSTER_USER_IDS` in Railway',
      },
      {
        name: 'Ticket Archive',
        value: '✅ Files: `' + config.ticketTranscriptDir + '`\nStaff copy: <#' + (config.ticketTranscriptChannelId || config.channels.security) + '>',
      },
      { name: 'Runtime Features', value: featureState.lines().join('\n').slice(0, 1024) }
    )
    .setFooter({ text: 'Only admins can see this report' });

  await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function welcomePreviewPayload(member) {
  return buildWelcomePayload(config, member);
}

async function handleSetupCommand(interaction) {
  if (!(await requireAdmin(interaction, config, 'manage permanent server panels'))) return;
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'status') {
    await setupStatus(interaction);
    return;
  }
  if (!featureState.isEnabled('permanentPanels')) {
    await interaction.reply({ content: 'Permanent panels are paused. Use `/features enable` first.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if ((subcommand === 'rules' || subcommand === 'all') && featureState.isEnabled('rulesRole')) await ensureRulesAcceptedRole(interaction.guild, config);
  if (subcommand === 'all') {
    const messages = await postBoardroomSetup(interaction.guild, config);
    await interaction.editReply({ content: 'Refreshed ' + Object.keys(messages).length + ' permanent Boardroom panels.' });
    return;
  }
  const panelType = {
    'gain-access': 'gainAccess',
    'free-premium': 'freePremium',
  }[subcommand] || subcommand;
  const defaults = {
    guide: config.channels.welcome,
    rules: config.channels.rules,
    upgrade: config.channels.premium,
    bankroll: config.channels.bankroll,
    announcements: config.channels.announcements,
    gainAccess: config.channels.gainAccess,
    freePremium: config.channels.freePremium,
    socials: config.channels.socials,
  };
  const target = interaction.options.getChannel('channel')?.id || defaults[panelType];
  const message = await postPermanentPanel(interaction.guild, config, panelType, target);
  await interaction.editReply({ content: 'Permanent ' + panelType + ' panel posted: ' + message.url });
}

async function handleFeatureCommand(interaction) {
  if (!(await requireAdmin(interaction, config, 'manage bot features'))) return;
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'status') {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.brandColor).setTitle('Boardroom Bets Feature Status').setDescription(featureState.lines().join('\n')).setFooter({ text: 'Runtime changes reset to Railway defaults after a restart' })],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }
  const feature = interaction.options.getString('feature', true);
  const enabled = subcommand === 'enable';
  featureState.set(feature, enabled);
  await interaction.reply({
    content: (enabled ? 'Enabled **' : 'Paused **') + FEATURE_LABELS[feature] + '**. This runtime change resets after the next restart.',
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

client.once('ready', async () => {
  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (!guild) throw new Error('The bot is not installed in the configured Boardroom Bets server.');
  await guild.commands.set(commands.map((command) => command.toJSON()));
  if (featureState.isEnabled('rulesRole')) {
    await ensureRulesAcceptedRole(guild, config).catch((error) => console.error('Rules role setup failed:', error));
  }
  if (featureState.isEnabled('tickets')) {
    await postTicketPanel(guild, config, false).catch((error) => console.error('Ticket panel setup failed:', error));
  }
  client.user.setActivity('/guide • Boardroom Bets', { type: ActivityType.Watching });
  console.log('Boardroom Bets Bot is online as ' + client.user.tag + '.');
});

client.on('guildMemberAdd', (member) => {
  handleMemberJoin(member).catch((error) => console.error('Member onboarding failed:', error));
});

client.on('messageCreate', async (message) => {
  if (message.guildId !== config.guildId) return;
  try {
    if (featureState.isEnabled('moderation') && await moderateMessage(message, config)) return;
    const watermarked = featureState.isEnabled('watermark')
      ? await handleAutomaticWatermark(message, config)
      : false;
    if (await handlePickMessage(message, config, featureState)) return;
    if (watermarked) return;
  } catch (error) {
    console.error('Message handler failed:', error);
  }
});

client.on('messageReactionAdd', (reaction, user) => {
  handleRulesReaction(reaction, user, config, featureState).catch((error) => console.error('Rules reaction failed:', error));
});

client.on('guildBanAdd', (ban) => {
  handleManualBan(ban, config, featureState).catch((error) => console.error('Manual ban audit failed:', error));
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.inGuild() || interaction.guildId !== config.guildId) return;
  try {
    if (await handleModerationButton(interaction, config)) return;
    if (await handleTicketInteraction(interaction, config, featureState)) return;
    if (interaction.isButton() && interaction.customId.startsWith('boardroom_pick:') && !featureState.isEnabled('bettingTools')) {
      await interaction.reply({ content: 'Betting tools are temporarily paused.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (await handleBettingButton(interaction, config)) return;
    if (interaction.isModalSubmit() && interaction.customId.startsWith('boardroom_post:') && !featureState.isEnabled('postComposer')) {
      await interaction.reply({ content: 'The post composer is temporarily paused.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.isModalSubmit() && await submitPostComposer(interaction, config)) return;
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'guide') {
      await interaction.reply({ ...buildGuidePayload(config), flags: MessageFlags.Ephemeral });
    } else if (interaction.commandName === 'upgrade') {
      await interaction.reply({ ...upgradePanelPayload(config), flags: MessageFlags.Ephemeral });
    } else if (['playhelp', 'bankroll', 'odds'].includes(interaction.commandName)) {
      if (!featureState.isEnabled('bettingTools')) {
        await interaction.reply({ content: 'Betting tools are temporarily paused.', flags: MessageFlags.Ephemeral });
      } else {
        await handleBettingCommand(interaction, config);
      }
    } else if (interaction.commandName === 'score') {
      if (!featureState.isEnabled('liveScores')) {
        await interaction.reply({ content: 'Live scores are temporarily paused.', flags: MessageFlags.Ephemeral });
      } else {
        await interaction.deferReply();
        const payload = await buildScoreReply(config, interaction.options.getString('league', true), interaction.options.getString('game', true), interaction.options.getString('date'));
        await interaction.editReply(payload);
      }
    } else if (interaction.commandName === 'welcome') {
      if (!(await requireAdmin(interaction, config, 'preview the welcome message'))) return;
      await interaction.reply({ ...(await welcomePreviewPayload(interaction.member)), flags: MessageFlags.Ephemeral });
    } else if (interaction.commandName === 'post') {
      if (!featureState.isEnabled('postComposer')) await interaction.reply({ content: 'The post composer is temporarily paused.', flags: MessageFlags.Ephemeral });
      else await openPostComposer(interaction, config);
    } else if (interaction.commandName === 'watermark') {
      if (!featureState.isEnabled('watermark')) await interaction.reply({ content: 'The watermark engine is temporarily paused.', flags: MessageFlags.Ephemeral });
      else await handleWatermarkCommand(interaction, config);
    } else if (interaction.commandName === 'ticket') {
      await handleTicketPanelCommand(interaction, config, featureState);
    } else if (interaction.commandName === 'setup') {
      await handleSetupCommand(interaction);
    } else if (interaction.commandName === 'features') {
      await handleFeatureCommand(interaction);
    }
  } catch (error) {
    console.error('Interaction failed:', error);
    const payload = { content: 'That action could not be completed. The error was logged.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
    else await interaction.reply(payload).catch(() => null);
  }
});

client.on('error', (error) => console.error('Discord client error:', error));
process.on('unhandledRejection', (error) => console.error('Unhandled promise rejection:', error));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    client.destroy();
    process.exit(0);
  });
}

client.login(config.token);

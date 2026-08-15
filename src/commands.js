const {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');
const { FEATURE_CHOICES } = require('./features-state');
const { scoreLeagueChoices } = require('./live-scores');

const adminPermission = PermissionFlagsBits.ManageMessages;

const commands = [
  new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Open the Boardroom Bets server guide.'),
  new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('Open the official Boardroom Bets premium page.'),
  new SlashCommandBuilder()
    .setName('playhelp')
    .setDescription('Learn how to follow posted plays, units, odds, and parlays.')
    .addStringOption((option) =>
      option
        .setName('topic')
        .setDescription('Topic to open.')
        .addChoices(
          { name: 'How to Play', value: 'basics' },
          { name: 'Units', value: 'units' },
          { name: 'American Odds', value: 'odds' },
          { name: 'Parlays', value: 'parlays' }
        )
    ),
  new SlashCommandBuilder()
    .setName('bankroll')
    .setDescription('Open the bankroll guide or privately calculate a unit size.')
    .addSubcommand((subcommand) => subcommand.setName('guide').setDescription('Open the bankroll management guide.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('calculate')
        .setDescription('Privately calculate unit sizes from a bankroll.')
        .addNumberOption((option) => option.setName('balance').setDescription('Your dedicated bankroll.').setMinValue(1).setMaxValue(10000000).setRequired(true))
        .addNumberOption((option) => option.setName('unit_percent').setDescription('Percentage for one unit.').setMinValue(0.1).setMaxValue(5).setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName('odds')
    .setDescription('Privately calculate potential profit and return from American odds.')
    .addIntegerOption((option) => option.setName('american').setDescription('American odds, such as -110 or +150.').setMinValue(-10000).setMaxValue(10000).setRequired(true))
    .addNumberOption((option) => option.setName('stake').setDescription('Amount risked.').setMinValue(0.01).setMaxValue(10000000).setRequired(true)),
  new SlashCommandBuilder()
    .setName('score')
    .setDescription('Check a current or recent sports score.')
    .addStringOption((option) => option.setName('league').setDescription('League to check.').setRequired(true).addChoices(...scoreLeagueChoices))
    .addStringOption((option) => option.setName('game').setDescription('Team or matchup to find.').setRequired(true))
    .addStringOption((option) => option.setName('date').setDescription('Optional date in YYYY-MM-DD format.')),
  new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Manage Boardroom Bets welcome messages.')
    .setDefaultMemberPermissions(adminPermission)
    .addSubcommand((subcommand) =>
      subcommand.setName('test').setDescription('Preview the welcome message privately.')
    ),
  new SlashCommandBuilder()
    .setName('post')
    .setDescription('Create a polished server post.')
    .setDefaultMemberPermissions(adminPermission)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('compose')
        .setDescription('Open the branded post composer.')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel where the finished post will be published.')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName('watermark')
    .setDescription('Create a Boardroom Bets watermarked image.')
    .setDefaultMemberPermissions(adminPermission)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add the configured logo to an uploaded image.')
        .addAttachmentOption((option) =>
          option.setName('image').setDescription('PNG, JPG, or WebP image.').setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('opacity')
            .setDescription('Logo opacity from 10 to 75 percent.')
            .setMinValue(10)
            .setMaxValue(75)
        )
    ),
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage Boardroom Bets support tickets.')
    .setDefaultMemberPermissions(adminPermission)
    .addSubcommand((subcommand) =>
      subcommand.setName('panel').setDescription('Post or refresh the help ticket panel.')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('transcript').setDescription('Archive the current ticket without closing it.')
    ),
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Check configuration or publish permanent Boardroom Bets panels.')
    .setDefaultMemberPermissions(adminPermission)
    .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Privately verify channels, roles, and permissions.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('guide')
        .setDescription('Post or refresh the permanent server guide.')
        .addChannelOption((option) => option.setName('channel').setDescription('Optional destination channel.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('rules')
        .setDescription('Post or refresh the rules and reaction-role panel.')
        .addChannelOption((option) => option.setName('channel').setDescription('Optional destination channel.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('upgrade')
        .setDescription('Post or refresh the premium access panel.')
        .addChannelOption((option) => option.setName('channel').setDescription('Optional destination channel.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('bankroll')
        .setDescription('Post or refresh the bankroll management panel.')
        .addChannelOption((option) => option.setName('channel').setDescription('Optional destination channel.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    ),
  new SlashCommandBuilder()
    .setName('features')
    .setDescription('Pause, resume, or inspect Boardroom Bets bot features.')
    .setDefaultMemberPermissions(adminPermission)
    .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Show all runtime feature states.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('enable').setDescription('Enable a feature until the next restart.').addStringOption((option) => option.setName('feature').setDescription('Feature to enable.').setRequired(true).addChoices(...FEATURE_CHOICES))
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('disable').setDescription('Pause a feature until the next restart.').addStringOption((option) => option.setName('feature').setDescription('Feature to pause.').setRequired(true).addChoices(...FEATURE_CHOICES))
    ),
];

module.exports = {
  commands,
};

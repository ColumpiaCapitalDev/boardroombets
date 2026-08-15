const { EmbedBuilder } = require('discord.js');

const SCOREBOARD_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const LEAGUES = Object.freeze({
  mlb: { name: 'MLB', sport: 'baseball', league: 'mlb' },
  nba: { name: 'NBA', sport: 'basketball', league: 'nba' },
  nfl: { name: 'NFL', sport: 'football', league: 'nfl' },
  ncaaf: { name: 'College Football', sport: 'football', league: 'college-football' },
  ncaamb: { name: 'College Basketball', sport: 'basketball', league: 'mens-college-basketball' },
  nhl: { name: 'NHL', sport: 'hockey', league: 'nhl' },
  mls: { name: 'MLS', sport: 'soccer', league: 'usa.1' },
  wnba: { name: 'WNBA', sport: 'basketball', league: 'wnba' },
  worldcup: { name: 'World Cup', sport: 'soccer', league: 'fifa.world' },
});

const scoreLeagueChoices = Object.entries(LEAGUES).map(([value, league]) => ({ name: league.name, value }));

function parseDate(value) {
  if (!value) return null;
  const compact = String(value).replace(/-/g, '');
  if (!/^\d{8}$/.test(compact)) throw new Error('Use YYYY-MM-DD for the date.');
  const year = Number(compact.slice(0, 4));
  const month = Number(compact.slice(4, 6));
  const day = Number(compact.slice(6, 8));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) throw new Error('That date is not valid.');
  return compact;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function competition(event) {
  return Array.isArray(event.competitions) ? event.competitions[0] : null;
}

function competitors(event) {
  return competition(event)?.competitors || [];
}

function teamName(competitor) {
  return competitor?.team?.shortDisplayName || competitor?.team?.displayName || competitor?.team?.abbreviation || 'Team';
}

function eventSearchText(event) {
  return normalize([event.name, event.shortName, ...competitors(event).flatMap((item) => [teamName(item), item.team?.displayName, item.team?.abbreviation])].join(' '));
}

function matchEvent(event, query) {
  const tokens = normalize(query).split(' ').filter(Boolean);
  const haystack = eventSearchText(event);
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

function statusText(event) {
  const status = competition(event)?.status || event.status;
  return status?.type?.shortDetail || status?.type?.detail || status?.type?.description || 'Scheduled';
}

function eventLine(event) {
  const teams = competitors(event);
  const away = teams.find((item) => item.homeAway === 'away') || teams[1];
  const home = teams.find((item) => item.homeAway === 'home') || teams[0];
  return teamName(away) + ' ' + (away?.score ?? '-') + ' • ' + teamName(home) + ' ' + (home?.score ?? '-') + ' — ' + statusText(event);
}

function scoreEmbed(config, league, event) {
  const teams = competitors(event);
  const away = teams.find((item) => item.homeAway === 'away') || teams[1];
  const home = teams.find((item) => item.homeAway === 'home') || teams[0];
  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle(league.name + ' Score')
    .setDescription('**' + teamName(away) + '**  ' + (away?.score ?? '-') + '\n**' + teamName(home) + '**  ' + (home?.score ?? '-'))
    .addFields(
      { name: 'Status', value: statusText(event), inline: true },
      { name: 'Matchup', value: event.shortName || event.name || teamName(away) + ' at ' + teamName(home), inline: true }
    )
    .setFooter({ text: 'Boardroom Bets • Score data provided by ESPN' })
    .setTimestamp();
  const logo = home?.team?.logo || away?.team?.logo;
  if (logo) embed.setThumbnail(logo);
  return embed;
}

async function fetchEvents(key, dateInput) {
  const league = LEAGUES[key];
  if (!league) throw new Error('That league is not supported.');
  const url = new URL(SCOREBOARD_BASE + '/' + league.sport + '/' + league.league + '/scoreboard');
  url.searchParams.set('limit', '100');
  const date = parseDate(dateInput);
  if (date) url.searchParams.set('dates', date);
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'BoardroomBetsScores/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('The score provider returned HTTP ' + response.status + '.');
  const data = await response.json();
  return { league, events: Array.isArray(data.events) ? data.events : [] };
}

async function buildScoreReply(config, key, query, date) {
  const { league, events } = await fetchEvents(key, date);
  if (events.length === 0) return { content: 'No ' + league.name + ' games were found' + (date ? ' for ' + date : ' right now') + '.', allowedMentions: { parse: [] } };
  const matches = events.filter((event) => matchEvent(event, query));
  if (matches.length === 0) {
    return {
      content: 'I could not find **' + query + '**. Games found:\n' + events.slice(0, 8).map((event) => '- ' + eventLine(event)).join('\n'),
      allowedMentions: { parse: [] },
    };
  }
  return { embeds: [scoreEmbed(config, league, matches[0])], allowedMentions: { parse: [] } };
}

module.exports = { LEAGUES, buildScoreReply, eventLine, matchEvent, parseDate, scoreLeagueChoices };

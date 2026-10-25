import {
  Client, GatewayIntentBits, ApplicationIntegrationType, InteractionContextType, REST, Routes, SlashCommandBuilder, AttachmentBuilder, MessageFlags,
} from 'discord.js';
import chalk from 'chalk';
import db from '#db';

// Categorías de cmds/ que se exponen en Discord.
const CATEGORIES = ['downloads', 'anime'];
// Plugins cuyo alias cambia el resultado (el alias se usa como endpoint): se registran todos.
const ALL_ALIASES = new Set(['anime/waifu']);
const ACTIONS_PLUGIN = 'anime/shares';
const DEFAULT_LIMIT = 10 * 1024 * 1024;

const log = (m) => console.log(chalk.magentaBright('[ Discord ]'), m);

// WhatsApp usa *negrita*; Discord usa **negrita**.
const toDiscordText = (t = '') =>
  String(t).replace(/\*(?!\*)([^*\n]+)\*/g, '**$1**').slice(0, 2000);

function extFor(type, mimetype = '') {
  if (type === 'image') return 'jpg';
  if (type === 'video') return 'mp4';
  if (type === 'audio') return 'mp3';
  return mimetype.split('/')[1] || 'bin';
}

async function toBuffer(src, limit) {
  if (Buffer.isBuffer(src)) return src.length <= limit ? src : null;
  const url = src?.url;
  if (!url) return null;
  if (Buffer.isBuffer(url)) return url.length <= limit ? url : null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar el archivo`);
  const len = Number(res.headers.get('content-length') || 0);
  if (len && len > limit) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length <= limit ? buf : null;
}

// Construye un `sock` y un `msg` falsos con la forma que esperan los comandos de WhatsApp,
// pero que envían todo a la interacción de Discord.
export function createContext({ send, limit, userId, userName, targetId, targetName, text }) {
  const chat = 'discord';
  const sender = `${userId}@discord`;
  const mentioned = targetId ? `${targetId}@discord` : null;

  const setName = (jid, name) => {
    try { db.getUser(jid); db.setUser(jid, 'name', name); } catch {}
  };
  setName(sender, userName);
  if (mentioned) setName(mentioned, targetName);

  async function mediaPayload(kind, media, caption, fileName) {
    const buf = await toBuffer(media, limit).catch(() => null);
    if (!buf) {
      const link = typeof media?.url === 'string' ? `\n${media.url}` : '\n(archivo demasiado grande para Discord)';
      return { content: toDiscordText(caption || '') + link };
    }
    const name = fileName || `file.${extFor(kind)}`;
    return { content: toDiscordText(caption || ''), files: [new AttachmentBuilder(buf, { name })] };
  }

  async function sendMessage(_jid, content = {}) {
    if (content.react || content.delete) return;
    if (content.text !== undefined) return send({ content: toDiscordText(content.text) });
    for (const kind of ['image', 'video', 'audio', 'document']) {
      if (content[kind]) return send(await mediaPayload(kind, content[kind], content.caption, content.fileName));
    }
  }

  const sock = new Proxy({
    sendMessage,
    reply: async (_jid, t) => send({ content: toDiscordText(t) }),
    sendFile: async (_jid, buf, name, caption) => {
      const isVideo = /\.(mp4|mov|webm)$/i.test(name || '');
      return send(await mediaPayload(isVideo ? 'video' : 'image', buf, caption, name || 'file.jpg'));
    },
    sendAlbumMessage: async (_jid, medias) => {
      const files = [];
      let links = '';
      const per = Math.floor(limit / Math.min(medias.length, 10));
      for (const m of medias.slice(0, 10)) {
        const buf = await toBuffer(m.data, per).catch(() => null);
        if (buf) files.push(new AttachmentBuilder(buf, { name: `${files.length}.${extFor(m.type)}` }));
        else if (typeof m.data?.url === 'string') links += `${m.data.url}\n`;
      }
      const cap = toDiscordText(medias[0]?.caption || '');
      return send({ content: `${cap}\n${links}`.trim().slice(0, 2000), files });
    },
  }, {
    // Cualquier otro método de Baileys (presencia, lectura, etc.) no hace nada.
    get: (t, p) => (p in t ? t[p] : p === 'then' ? undefined : async () => undefined),
  });

  const msg = {
    chat, sender, text, body: text,
    key: { remoteJid: chat, fromMe: false, id: 'discord' },
    pushName: userName,
    isGroup: true,
    mentionedJid: mentioned ? [mentioned] : [],
    quoted: null,
    react: async () => {},
    reply: async (content) => (typeof content === 'string'
      ? send({ content: toDiscordText(content) })
      : sendMessage(chat, content)),
  };
  return { sock, msg };
}

function buildCommands() {
  const defs = [];
  const seen = new Set();
  const byPlugin = new Map();
  for (const [name, data] of global.comandos) {
    if (!CATEGORIES.includes(data.category) || data.customPrefix) continue;
    if (!byPlugin.has(data.pluginKey)) byPlugin.set(data.pluginKey, { data, names: [] });
    byPlugin.get(data.pluginKey).names.push(name);
  }
  for (const [key, { data, names }] of byPlugin) {
    if (key === ACTIONS_PLUGIN) continue;
    const list = ALL_ALIASES.has(key) ? names : [names[0]];
    for (const n of list) {
      if (!/^[\w-]{1,32}$/.test(n) || seen.has(n)) continue;
      seen.add(n);
      const b = new SlashCommandBuilder().setName(n).setDescription((data.description || n).slice(0, 100));
      b.addStringOption((o) => o.setName('texto').setDescription('Enlace o término de búsqueda'));
      defs.push({ name: n, builder: b });
    }
  }
  const actions = byPlugin.get(ACTIONS_PLUGIN);
  if (actions) {
    const b = new SlashCommandBuilder().setName('accion').setDescription('Reacciones de anime (abrazar, besar, etc.)');
    b.addStringOption((o) => o.setName('tipo').setDescription('Acción').setRequired(true).setAutocomplete(true));
    b.addUserOption((o) => o.setName('usuario').setDescription('A quién va dirigida'));
    defs.push({ name: 'accion', builder: b, actions: actions.names });
  }
  return defs;
}

// Instalable en servidores y en cuentas de usuario; usable en servidores, DM con el bot y cualquier DM/grupo.
const withUserInstall = (b) => b
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
  .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel);

export default async function startDiscord() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token || !clientId) {
    log('DISCORD_TOKEN / DISCORD_CLIENT_ID no definidos: el bot de Discord no se inicia.');
    return;
  }
  const defs = buildCommands();
  const byName = new Map(defs.map((d) => [d.name, d]));
  const actionNames = (byName.get('accion')?.actions || []).filter((n) => /^[a-z0-9]+$/.test(n));

  const rest = new REST({ version: '10' }).setToken(token);
  const route = process.env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(clientId, process.env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(clientId);
  await rest.put(route, { body: defs.map((d) => withUserInstall(d.builder).toJSON()) });
  log(`${defs.length} comandos slash registrados.`);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once('clientReady', (c) => log(`Conectado como ${c.user.tag}`));

  client.on('interactionCreate', async (i) => {
    try {
      if (i.isAutocomplete() && i.commandName === 'accion') {
        const q = i.options.getFocused().toLowerCase();
        return i.respond(actionNames.filter((n) => n.includes(q)).slice(0, 25).map((n) => ({ name: n, value: n })));
      }
      if (!i.isChatInputCommand() || !byName.has(i.commandName)) return;

      let command = i.commandName;
      let args = [];
      let target = null;
      if (command === 'accion') {
        command = i.options.getString('tipo', true).toLowerCase();
        target = i.options.getUser('usuario');
      } else {
        args = (i.options.getString('texto') || '').split(/\s+/).filter(Boolean);
      }
      const cmdData = global.comandos.get(command);
      if (!cmdData) return i.reply({ content: 'Comando no encontrado.', flags: MessageFlags.Ephemeral });

      await i.deferReply();
      let first = true;
      const send = async (payload) => {
        if (!payload.content && !payload.files?.length) return;
        if (first) { first = false; return i.editReply(payload); }
        return i.followUp(payload);
      };
      const text = args.join(' ');
      const { sock, msg } = createContext({
        send,
        limit: i.guild?.maximumUploadLimit || DEFAULT_LIMIT,
        userId: i.user.id,
        userName: i.member?.displayName || i.user.globalName || i.user.username,
        targetId: target?.id,
        targetName: target?.globalName || target?.username,
        text: `/${command} ${text}`.trim(),
      });
      await cmdData.run({
        msg, sock, args, text, command, usedPrefix: '/',
        groupMetadata: null, participants: [], isAdmins: false, isBotAdmins: false, isOwner: false,
        __dirname: global.plugins[cmdData.pluginKey]?.dirname,
      });
      // Algunos comandos no esperan (await) su envío final: damos un margen antes de rendirnos.
      for (let n = 0; first && n < 40; n++) await new Promise((r) => setTimeout(r, 500));
      if (first) await i.editReply('El comando no devolvió resultado.');
    } catch (e) {
      console.error('[ Discord ] Error:', e);
      const content = `Error: ${String(e.message || e).slice(0, 500)}`;
      if (i.deferred || i.replied) await i.followUp({ content }).catch(() => {});
      else if (i.isRepliable()) await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });

  await client.login(token);
}

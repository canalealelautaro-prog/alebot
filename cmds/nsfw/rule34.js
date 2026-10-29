import fetch from 'node-fetch';
import db from '#db';

export default {
  command: ['r34', 'rule34', 'rule'],
  category: 'nsfw',
  description: 'Buscar imágenes en Rule34.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    try {
      const chat = db.getChat(msg.chat);
      if (!chat.nsfw) return msg.reply(`ꕥ El contenido *NSFW* está desactivado en este grupo.\n\nUn *administrador* puede activarlo con el comando:\n» *${usedPrefix}nsfw on*`);
      if (!args[0]) return sock.reply(msg.chat, `《✧》 Debes especificar tags para buscar\n> Ejemplo » *${usedPrefix + command} neko* o *${usedPrefix + command} neko video*`, msg);
      await msg.react('🕒');
      const wantsVideo = ['video', 'vid'].includes((args[1] || '').toLowerCase());
      const type = wantsVideo ? 'video' : 'image';
      const tag = encodeURIComponent(args[0].replace(/\s+/g, '_'));
      const key = process.env.EVOGB_KEY || 'alefox';
      const url = `https://api.evogb.org/nsfw/rule34?key=${key}&tag=${tag}&type=${type}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const ctype = res.headers.get('content-type') || '';
      if (!res.ok || !/^(image|video)\//.test(ctype)) {
        await msg.react('✖️');
        return sock.reply(msg.chat, `《✧》 No se encontraron resultados para ${args[0]}`, msg);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const caption = `ꕥ Resultados para » ${args[0]}`;
      if (type === 'video') {
        await sock.sendMessage(msg.chat, { video: buffer, caption, mentions: [msg.sender] });
      } else {
        await sock.sendMessage(msg.chat, { image: buffer, caption, mentions: [msg.sender] });
      }
      await msg.react('✔️');
    } catch (e) {
      await msg.react('✖️');
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`);
    }
  }
};
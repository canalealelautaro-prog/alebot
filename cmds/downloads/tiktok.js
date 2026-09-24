import fetch from 'node-fetch'

export default {
  command: ['tiktok', 'tt'],
  category: 'downloads',
  description: 'Descargar un video de TikTok.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    if (!args.length) {
      return msg.reply(`《✧》 Por favor, ingresa un término de búsqueda o enlace de TikTok.`)
    }
    const text = args.join(" ")
    const isUrl = /(?:https:?\/{2})?(?:w{3}|vm|vt|t)?\.?tiktok.com\/([^\s&]+)/gi.test(text)
    const endpoint = isUrl ? `${global.APIs.evogb.url}/dl/tiktok?url=${encodeURIComponent(text)}&key=${global.APIs.evogb.key}` : `${global.APIs.yuki.url}/search/tiktok?query=${encodeURIComponent(text)}&key=${global.APIs.yuki.key}`
    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`El servidor respondió con ${res.status}`)
      const json = await res.json()
      if (!json.status) return msg.reply('《✧》 No se encontró contenido válido en TikTok.')
      if (isUrl) {
        const download_url = json.data?.download_url
        const filename = json.data?.filename || ''
        if (!download_url) return msg.reply('《✧》 Enlace inválido o sin contenido descargable.')
        const caption = `ㅤ۟∩　ׅ　★ ໌　ׅ　🅣𝗂𝗄𝖳𝗈𝗄 🅓ownload　ׄᰙ`.trim()
        if (/\.(jpe?g|png|webp)$/i.test(filename)) {
          await sock.sendMessage(msg.chat, { image: { url: download_url }, caption }, { quoted: msg })
        } else {
          await sock.sendMessage(msg.chat, { video: { url: download_url }, caption }, { quoted: msg })
        }
      } else {
        const validResults = json.data?.filter(v => v.dl)
        if (!validResults || validResults.length < 2) {
          return msg.reply('《✧》 Se requieren al menos 2 resultados válidos con contenido.')
        }
        const medias = validResults.filter(v => typeof v.dl === 'string' && v.dl.startsWith('http')).map(v => {
            const caption = `ㅤ۟∩　ׅ　★ ໌　ׅ　🅣𝗂𝗄𝖳𝗈𝗄 🅓ownload　ׄᰙ

𖣣ֶㅤ֯⌗ ✎  ׄ ⬭ *Título:* ${v.title || 'Sin título'}
𖣣ֶㅤ֯⌗ ꕥ  ׄ ⬭ *Autor:* ${v.author?.nickname || 'Desconocido'} ${v.author?.unique_id ? `@${v.author.unique_id}` : ''}
𖣣ֶㅤ֯⌗ ⴵ  ׄ ⬭ *Duración:* ${v.duration || 'N/A'}
𖣣ֶㅤ֯⌗ ❖  ׄ ⬭ *Likes:* ${(v.stats?.likes || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ❀  ׄ ⬭ *Comentarios:* ${(v.stats?.comments || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ✿  ׄ ⬭ *Vistas:* ${(v.stats?.views || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ☆  ׄ ⬭ *Compartidos:* ${(v.stats?.shares || 0).toLocaleString()}
𖣣ֶㅤ֯⌗ ❒  ׄ ⬭ *Audio:* ${v.music?.title || `[${v.author?.nickname || 'No disponible'}] original sound - ${v.author?.unique_id || 'unknown'}`}`.trim()
            return { type: 'video', data: { url: v.dl }, caption }
          }).slice(0, 10)
        await sock.sendAlbumMessage(msg.chat, medias, { quoted: msg })
      }
    } catch (e) {
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  },
}
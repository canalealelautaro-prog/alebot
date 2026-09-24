import fetch from 'node-fetch'

export default {
  command: ['fb', 'facebook'],
  category: 'downloads',
  description: 'Descargar un video de Facebook.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    if (!args[0]) {
      return msg.reply('《✧》 Por favor, Ingrese un enlace de Facebook.')
    }
    if (!args[0].match(/facebook\.com|fb\.watch|video\.fb\.com/)) {
      return msg.reply('《✧》 El enlace es invalido, envía un link de Facebook válido')
    }
    try {
      const data = await getFacebookMedia(args[0])
      if (!data) return msg.reply('《✧》 No se pudo obtener el contenido.')
      const caption = `ㅤ۟∩　ׅ　★　ׅ　🅕𝖡 🅓ownload　ׄᰙ　\n\n𖣣ֶㅤ֯⌗ ☆  ׄ ⬭ *Enlace* › ${args[0]}`
      if (data.type === 'video') {
        await sock.sendMessage(msg.chat, { video: { url: data.url }, caption, mimetype: 'video/mp4', fileName: 'fb.mp4' }, { quoted: msg })
      } else if (data.type === 'image') {
        await sock.sendMessage(msg.chat, { image: { url: data.url }, caption }, { quoted: msg })
      } else {
        throw new Error('Contenido no soportado.')
      }
    } catch (e) {
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}

async function getFacebookMedia(url) {
  const endpoint = `${global.APIs.evogb.url}/dl/facebook?url=${encodeURIComponent(url)}&key=${global.APIs.evogb.key}`
  const res = await fetch(endpoint).then(r => r.json()).catch(() => null)

  if (!res?.status || !Array.isArray(res?.resultados)) return null

  const candidates = res.resultados
    .filter(r => typeof r.url === 'string' && r.url.startsWith('http'))
    .map(r => ({ ...r, resolution: parseInt(r.quality) || 0 }))
    .sort((a, b) => b.resolution - a.resolution)

  const best = candidates[0]
  if (!best) return null

  return {
    type: 'video',
    url: best.url
  }
}

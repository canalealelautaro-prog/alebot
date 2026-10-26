import fetch from 'node-fetch'
import db from '#db'

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview'
const MAX_TURNS = 10
const history = new Map()

export default {
  command: ['gemini'],
  category: 'utils',
  description: 'Hablar con Gemini 3.1 Pro.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const text = args.join(' ').trim()
    if (!text) return msg.reply('《✧》 Escriba una *petición* para que *Gemini* le responda.')

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return msg.reply('《✧》 Falta la variable *GEMINI_API_KEY* en el servidor.')

    const isDiscord = String(msg.sender).endsWith('@discord')
    try {
      const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net'
      const botname = db.getSettings(botId)?.botname || 'Bot'
      const username = db.getUser(msg.sender)?.name || 'usuario'
      const system = `Tu nombre es ${botname}. Usas el idioma Español, a menos que te escriban en otro. Llamas a la persona por su nombre: ${username}. Eres amigable y divertida.`

      await msg.react('🕒')
      const turns = history.get(msg.sender) || []
      const contents = [...turns, { role: 'user', parts: [{ text }] }]

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents
        })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${json?.error?.message || 'sin detalle'}`.slice(0, 300))

      const answer = (json?.candidates?.[0]?.content?.parts || [])
        .filter(p => !p.thought && p.text).map(p => p.text).join('').trim()
      if (!answer) throw new Error(json?.promptFeedback?.blockReason ? `Bloqueado: ${json.promptFeedback.blockReason}` : 'Respuesta vacía')

      history.set(msg.sender, [...contents, { role: 'model', parts: [{ text: answer }] }].slice(-MAX_TURNS * 2))

      if (isDiscord && answer.length > 1900) await sock.sendCodeMessage(msg.chat, 'respuesta.txt', answer)
      else await sock.sendMessage(msg.chat, { text: answer }, { quoted: msg })
      await msg.react('✔️')
    } catch (e) {
      await msg.reply(`> Error al ejecutar *${usedPrefix + command}*.\n> [Error: *${e.message}*]`)
    }
  }
}

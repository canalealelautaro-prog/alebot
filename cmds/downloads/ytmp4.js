import yts from 'yt-search'
import fetch from 'node-fetch'

const cmd = {
  command: ['play2', 'mp4', 'ytmp4', 'ytvideo', 'playvideo'],
  category: 'downloads',
  description: 'Descargar un vídeo de YouTube.',

  run: async ({ msg, sock, args, usedPrefix, command }) => {
    try {
      if (!args[0]) {
        return msg.reply('《✧》Por favor, menciona el nombre o URL del video que deseas descargar')
      }

      const input_text = args.join(' ').trim()
      const video_id = getVideoId(input_text)
      const query = video_id ? `https://youtu.be/${video_id}` : input_text

      let url = query
      let title = 'video'
      let thumbnail = null
      let channel = 'Desconocido'
      let duration = 'Desconocido'
      let views = 'Desconocido'

      try {
        const video_info = await getVideoInfo(query, video_id)

        if (video_info) {
          url = video_info.url || `https://youtu.be/${video_info.videoId}`
          title = video_info.title || title
          thumbnail = video_info.image || video_info.thumbnail || null
          channel = video_info.author?.name || video_info.author || channel
          duration = video_info.timestamp || duration
          views = Number(video_info.views || 0).toLocaleString('es-HN')
        }
      } catch {}

      if (!isYTUrl(url)) {
        return msg.reply('《✧》No se encontró un video válido de YouTube.')
      }

      const download = await getVideoFromApi(url)

      if (!download?.url) {
        return msg.reply('《✧》No se pudo descargar el *video*, intenta más tarde.')
      }

      const file_name = sanitizeFileName(title) + '.mp4'

      const video_buffer = await getRemoteFileBuffer(download.url).catch(() => null)

      if (!video_buffer?.length) {
        return msg.reply('《✧》No se pudo descargar el *video*, intenta más tarde.')
      }

      const size_bytes = video_buffer.length
      const size_text = formatBytes(size_bytes)
      const send_as_document = size_bytes > max_video_size

      const info_message = `➩ Descargando › *${title}*

> ❖ Canal › *${channel}*
> ⴵ Duración › *${duration}*
> ❀ Vistas › *${views}*
> ❒ Tamaño › *${size_text}*
> ❒ Enlace › *${url}*`

      if (thumbnail) {
        await sock.sendMessage(msg.chat, {
          image: { url: thumbnail },
          caption: info_message
        }, { quoted: msg })
      } else {
        await msg.reply(info_message)
      }

      const caption = `乂 *Video descargado*

> ❒ Tamaño › *${size_text}*`

      if (send_as_document) {
        await sock.sendMessage(msg.chat, {
          document: video_buffer,
          mimetype: 'video/mp4',
          fileName: file_name,
          caption
        }, { quoted: msg })
        return
      }

      try {
        await sock.sendMessage(msg.chat, {
          video: video_buffer,
          mimetype: 'video/mp4',
          fileName: file_name,
          caption,
          ...(thumbnail ? { jpegThumbnail: await getThumbnail(thumbnail).catch(() => null) } : {})
        }, { quoted: msg })
      } catch {
        await sock.sendMessage(msg.chat, {
          document: video_buffer,
          mimetype: 'video/mp4',
          fileName: file_name,
          caption
        }, { quoted: msg })
      }
    } catch (e) {
      await msg.reply(
        `> An unexpected error occurred while executing command *${usedPrefix + command}*.\n> [Error: *${e.message}*]`
      )
    }
  }
}

export default cmd

const max_video_size = 50 * 1024 * 1024

const isYTUrl = (url = '') =>
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

const getVideoId = (text = '') => {
  const raw = String(text || '').trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw

  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/
  ]

  for (const pattern of patterns) {
    const match = raw.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

async function getVideoInfo(input, video_id) {
  if (video_id) {
    try {
      const info = await yts({ videoId: video_id })
      if (info?.videoId) {
        return {
          ...info,
          url: `https://youtu.be/${info.videoId}`,
          image: info.thumbnail || info.image
        }
      }
    } catch {}
  }

  const search = await yts(input)
  return search.videos?.[0] || search.all?.find(v => v.type === 'video') || null
}

async function getVideoFromApi(url) {
  const { url: api_base, key: api_key } = global.APIs.evogb
  const api_url = `${api_base}/dl/ytmp4?key=${api_key}&url=${encodeURIComponent(url)}&quality=auto`

  const res = await fetch(api_url, {
    headers: { accept: 'application/json' }
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`API HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  let data

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Respuesta inválida de la API: ${text.slice(0, 200)}`)
  }

  if (!data?.status) {
    throw new Error(data?.message || 'La API no devolvió un resultado válido.')
  }

  if (!data?.data?.dl) {
    throw new Error('La API no devolvió la URL de descarga.')
  }

  return {
    url: data.data.dl,
    name: data.data.title ? `${data.data.title}.mp4` : 'video.mp4'
  }
}

async function getRemoteFileBuffer(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0' }
  })

  if (!res.ok) throw new Error(`No se pudo descargar el video: HTTP ${res.status}`)

  return Buffer.from(await res.arrayBuffer())
}

async function getThumbnail(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0'
    }
  })

  if (!res.ok) return null

  const buffer = Buffer.from(await res.arrayBuffer())
  return buffer.length ? buffer : null
}

function sanitizeFileName(name = 'video') {
  return String(name)
    .replace(/\.(mp4|mkv|webm|mov|avi)$/i, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'video'
}

function formatBytes(bytes = 0) {
  if (!bytes || Number.isNaN(bytes)) return 'Desconocido'

  const units = ['B', 'KB', 'MB', 'GB']
  let size = Number(bytes)
  let unit = 0

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }

  return `${size.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`
}

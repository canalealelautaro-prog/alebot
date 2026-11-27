// Parche del proto de baileys para enviar/recibir audioStickerMessage (campo 134), adaptado de Tensura
import { proto } from 'baileys';

let patched = false

function readVarint(buffer, offset) {
  let value = 0
  let shift = 0
  let position = offset
  while (position < buffer.length && shift <= 49) {
    const byte = buffer[position++]
    value += (byte & 0x7f) * 2 ** shift
    if (!(byte & 0x80)) return { value, next: position }
    shift += 7
  }
  return null
}

function rawFields(buffer) {
  const fields = []
  let position = 0
  while (position < buffer.length) {
    const tag = readVarint(buffer, position)
    if (!tag) break
    position = tag.next
    const field = Math.floor(tag.value / 8)
    const wire = tag.value % 8
    if (!field) break

    if (wire === 0) {
      const value = readVarint(buffer, position)
      if (!value) break
      position = value.next
      continue
    }
    if (wire === 1) {
      position += 8
      continue
    }
    if (wire === 2) {
      const length = readVarint(buffer, position)
      if (!length) break
      const start = length.next
      const end = start + length.value
      if (end > buffer.length) break
      fields.push({ field, wire, data: buffer.subarray(start, end) })
      position = end
      continue
    }
    if (wire === 5) {
      position += 4
      continue
    }
    break
  }
  return fields
}

function decodeStickerWithAudio(M, stickerBytes) {
  const sticker = M.StickerMessage.decode(stickerBytes)
  const audioBytes = rawFields(stickerBytes).find(field => field.field === 26 && field.wire === 2)?.data
  if (audioBytes) {
    try {
      sticker.audioMessage = M.AudioMessage.decode(audioBytes)
    } catch {}
  }
  return sticker
}

export function patchAudioStickerProtocol() {
  const M = proto?.Message
  if (!M || patched || M.__tensuraAudioStickerPatched) return
  patched = true

  if (M.StickerMessage?.encode) {
    const previousEncode = M.StickerMessage.encode

    M.StickerMessage.encode = function (message, writer) {
      const audio = message?.audioMessage
      if (audio && Object.prototype.hasOwnProperty.call(message, 'audioMessage')) {
        delete message.audioMessage
      }

      const result = previousEncode.call(this, message, writer)

      if (audio && M.AudioMessage) {
        message.audioMessage = audio
        M.AudioMessage.encode(audio, result.uint32(210).fork()).ldelim()
      }

      return result
    }

    if (typeof M.StickerMessage.fromObject === 'function') {
      const previousFromObject = M.StickerMessage.fromObject
      M.StickerMessage.fromObject = function (object) {
        const message = previousFromObject.call(this, object)
        if (object?.audioMessage) {
          message.audioMessage = M.AudioMessage?.fromObject
            ? M.AudioMessage.fromObject(object.audioMessage)
            : object.audioMessage
        }
        return message
      }
    }
  }

  const previousMessageEncode = M.encode

  M.encode = function (message, writer) {
    const audioSticker = message?.audioStickerMessage
    if (audioSticker) {
      delete message.stickerMessage
      delete message.audioStickerMessage
    }

    const result = previousMessageEncode.call(this, message, writer)

    if (audioSticker && M.FutureProofMessage) {
      message.audioStickerMessage = audioSticker
      M.FutureProofMessage.encode(audioSticker, result.uint32(1074).fork()).ldelim()
    }

    return result
  }

  if (typeof M.fromObject === 'function') {
    const previousFromObject = M.fromObject
    M.fromObject = function (object) {
      const message = previousFromObject.call(this, object)

      if (object?.audioStickerMessage) {
        const inner = object.audioStickerMessage.message || object.audioStickerMessage
        if (
          inner?.stickerMessage &&
          object.audioStickerMessage.message?.stickerMessage?.audioMessage
        ) {
          inner.stickerMessage.audioMessage =
            object.audioStickerMessage.message.stickerMessage.audioMessage
        }
        message.audioStickerMessage = { message: inner }
        delete message.stickerMessage
        if (inner) Object.setPrototypeOf(message, inner)
      }

      return message
    }
  }

  const previousDecode = M.decode

  M.decode = function (reader, length) {
    const isBuffer = Buffer.isBuffer(reader)
    const start = isBuffer ? 0 : Number(reader?.pos || 0)
    const end = isBuffer
      ? Number(length ?? reader.length)
      : Number(length === undefined ? reader?.len : start + length)
    const result = previousDecode.call(this, reader, length)
    const source = isBuffer ? reader : reader?.buf
    if (!Buffer.isBuffer(source) || !result) return result

    const raw = source.subarray(start, Math.min(start + (end - start), source.length))
    if (!raw.length) return result

    const fields = rawFields(raw)
    const wrapperBytes = fields.find(field => field.field === 134 && field.wire === 2)?.data
    if (wrapperBytes) {
      const wrapperFields = rawFields(wrapperBytes)
      const innerBytes =
        wrapperFields.find(field => field.field === 1 && field.wire === 2)?.data || wrapperBytes
      const inner = previousDecode.call(this, innerBytes)
      const innerFields = rawFields(innerBytes)
      const stickerBytes = innerFields.find(field => field.field === 26 && field.wire === 2)?.data
      if (stickerBytes) {
        const sticker = decodeStickerWithAudio(this, stickerBytes)
        if (inner) inner.stickerMessage = sticker
      }
      if (inner) {
        for (const [key, value] of Object.entries(inner)) {
          if (value == null) continue
          if (result[key] == null) result[key] = value
        }
      }
      if (inner?.stickerMessage) result.stickerMessage = inner.stickerMessage
    } else {
      const stickerBytes = fields.find(field => field.field === 26 && field.wire === 2)?.data
      if (stickerBytes && result.stickerMessage) {
        const audioBytes = rawFields(stickerBytes).find(field => field.field === 26 && field.wire === 2)?.data
        if (audioBytes) {
          try {
            result.stickerMessage.audioMessage = this.AudioMessage.decode(audioBytes)
          } catch {}
        }
      }
    }

    if (result.stickerMessage && result.audioMessage && !result.stickerMessage.audioMessage) {
      result.stickerMessage.audioMessage = result.audioMessage
    }

    return result
  }

  M.__tensuraAudioStickerPatched = true
}


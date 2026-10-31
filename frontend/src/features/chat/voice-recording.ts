export const MAX_VOICE_SECONDS = 600

export function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((size, chunk) => size + chunk.length, 0)
  const buffer = new ArrayBuffer(44 + length * 2)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index++)
      view.setUint8(offset + index, text.charCodeAt(index))
  }
  write(0, "RIFF")
  view.setUint32(4, 36 + length * 2, true)
  write(8, "WAVE")
  write(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, "data")
  view.setUint32(40, length * 2, true)
  let offset = 44
  for (const chunk of chunks)
    for (const sample of chunk) {
      const value = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, value < 0 ? value * 32768 : value * 32767, true)
      offset += 2
    }
  return new Blob([buffer], { type: "audio/wav" })
}

export class VoiceRecording {
  private chunks: Float32Array[] = []
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private node: AudioWorkletNode | null = null
  private cancelled = false
  private rate = 16000
  private lastLevelAt = 0

  async start(onLimit: () => void, onLevel: (level: number) => void = () => {}) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false,
      })
      if (this.cancelled) {
        this.release()
        return false
      }
      this.context = new AudioContext({ sampleRate: 16000 })
      this.rate = this.context.sampleRate
      await this.context.audioWorklet.addModule("/voice-recorder.js")
      if (this.cancelled) {
        this.release()
        return false
      }
      this.node = new AudioWorkletNode(this.context, "datum-recorder", {
        processorOptions: { maxSamples: this.rate * MAX_VOICE_SECONDS },
      })
      this.node.port.onmessage = ({
        data,
      }: MessageEvent<{ samples?: Float32Array; done?: boolean }>) => {
        if (this.cancelled) return
        if (data.samples) {
          this.chunks.push(data.samples)
          if (performance.now() - this.lastLevelAt > 75) {
            this.lastLevelAt = performance.now()
            const energy = data.samples.reduce((sum, sample) => sum + sample * sample, 0)
            onLevel(Math.min(1, Math.sqrt(energy / data.samples.length) * 8))
          }
        }
        if (data.done) onLimit()
      }
      const source = this.context.createMediaStreamSource(this.stream)
      const mute = this.context.createGain()
      mute.gain.value = 0
      source.connect(this.node).connect(mute).connect(this.context.destination)
      await this.context.resume()
      return !this.cancelled
    } catch (error) {
      this.release()
      throw error
    }
  }

  stop() {
    this.cancelled = true
    this.release()
    const blob = encodeWav(this.chunks, this.rate)
    this.chunks = []
    return blob
  }

  cancel() {
    this.cancelled = true
    this.chunks = []
    this.release()
  }

  private release() {
    this.stream?.getTracks().forEach((track) => {
      track.stop()
    })
    this.node?.disconnect()
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => {})
    this.stream = null
    this.context = null
    this.node = null
  }
}

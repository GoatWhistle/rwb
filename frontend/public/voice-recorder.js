class DatumRecorder extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.remaining = options.processorOptions.maxSamples
  }

  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel || this.remaining <= 0) return this.remaining > 0
    const samples = channel.slice(0, this.remaining)
    this.remaining -= samples.length
    this.port.postMessage({ samples, done: this.remaining === 0 }, [samples.buffer])
    return this.remaining > 0
  }
}

registerProcessor("datum-recorder", DatumRecorder)

import array
import importlib.util
import io
import sys
import threading
import wave
from functools import lru_cache

import anyio
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from .config import settings

MODEL = "GigaAM-v3-e2e-ctc"
MAX_SECONDS = 600
MAX_BYTES = 32 * 1024 * 1024
router = APIRouter(prefix="/api/audio", tags=["voice"])
processing = threading.Lock()


class Transcription(BaseModel):
    text: str
    duration_seconds: float
    model: str = MODEL


class SpeechStatus(BaseModel):
    available: bool
    model: str = MODEL
    max_seconds: int = MAX_SECONDS


def model_files():
    root = settings().gigaam_model_dir
    return root / "v3_e2e_ctc.ckpt", root / "v3_e2e_ctc_tokenizer.model"


@router.get("/health", response_model=SpeechStatus)
def health():
    files_ready = all(path.is_file() for path in model_files())
    installed = all(importlib.util.find_spec(name) is not None for name in ("torch", "torchaudio", "gigaam"))
    return SpeechStatus(available=files_ready and installed)


def failure(status: int, code: str):
    return HTTPException(status, detail={"code": code})


def decode_wav(payload: bytes):
    try:
        with wave.open(io.BytesIO(payload), "rb") as audio:
            rate = audio.getframerate()
            frames = audio.getnframes()
            if audio.getnchannels() != 1 or audio.getsampwidth() != 2 or audio.getcomptype() != "NONE":
                raise failure(422, "invalid_audio")
            if not 8000 <= rate <= 48000 or frames < rate // 4:
                raise failure(422, "invalid_audio")
            if frames > rate * MAX_SECONDS:
                raise failure(413, "audio_too_long")
            pcm = audio.readframes(frames)
            if len(pcm) != frames * 2:
                raise failure(422, "invalid_audio")
    except (wave.Error, EOFError, OSError, ValueError):
        raise failure(422, "invalid_audio") from None
    samples = array.array("h", pcm)
    if sys.byteorder != "little":
        samples.byteswap()
    if sum(value * value for value in samples) / len(samples) < 256:
        raise failure(422, "speech_not_detected")
    return pcm, rate, frames / rate


@lru_cache(maxsize=1)
def load_model():
    checkpoint, tokenizer = model_files()
    if not checkpoint.is_file() or not tokenizer.is_file():
        raise failure(503, "speech_unavailable")
    try:
        import torch
        from gigaam.model import GigaAMASR

        torch.set_num_threads(max(1, min(settings().gigaam_threads, 8)))
        saved = torch.load(checkpoint, map_location="cpu", weights_only=False)
        config = saved["cfg"]
        config.encoder.flash_attn = False
        config.decoding.model_path = str(tokenizer.resolve())
        model = GigaAMASR(config).cpu().float().eval()
        model.load_state_dict(saved["state_dict"], strict=True)
        return model
    except Exception as exc:
        raise failure(503, "speech_unavailable") from exc


def speech_windows(samples: int, rate=16000):
    window, overlap = 20 * rate, 2 * rate
    for start in range(0, samples, window - overlap):
        if start and samples - start <= overlap:
            break
        yield start, min(start + window, samples)


def continuation(previous: str, current: str) -> str:
    before, after = previous.split(), current.split()
    def normalized(word):
        return word.casefold().strip('.,!?;:«»"—-')
    for size in range(min(len(before), len(after), 40), 0, -1):
        if [normalized(word) for word in before[-size:]] == [normalized(word) for word in after[:size]]:
            return " ".join(after[size:])
    return current


def transcribe_pcm(pcm: bytes, rate: int) -> str:
    model = load_model()
    import torch
    import torchaudio

    audio = torch.frombuffer(bytearray(pcm), dtype=torch.int16).float() / 32768
    if rate != 16000:
        audio = torchaudio.functional.resample(audio, rate, 16000)
    parts, previous = [], ""
    with torch.inference_mode():
        for start, end in speech_windows(audio.shape[0]):
            chunk = audio[start:end]
            if chunk.square().mean().item() < (16 / 32768) ** 2:
                previous = ""
                continue
            lengths = torch.tensor([chunk.shape[0]])
            encoded, encoded_len = model(chunk.unsqueeze(0), lengths)
            text = str(model._decode(encoded, encoded_len, lengths)[0][0]).strip()
            parts.append(continuation(previous, text))
            previous = text
    return " ".join(part for part in parts if part).strip()


@router.post("/transcribe", response_model=Transcription, openapi_extra={
    "requestBody": {"required": True, "content": {"audio/wav": {"schema": {"type": "string", "format": "binary"}}}}
})
async def transcribe(request: Request):
    if request.headers.get("content-type", "").split(";")[0].strip() != "audio/wav":
        raise failure(415, "invalid_audio")
    if not processing.acquire(blocking=False):
        raise failure(429, "speech_busy")
    try:
        payload = bytearray()
        async for chunk in request.stream():
            payload.extend(chunk)
            if len(payload) > MAX_BYTES:
                raise failure(413, "audio_too_long")
        pcm, rate, duration = decode_wav(bytes(payload))
        try:
            text = await anyio.to_thread.run_sync(transcribe_pcm, pcm, rate)
        except HTTPException:
            raise
        except Exception as exc:
            raise failure(503, "speech_unavailable") from exc
        if not text:
            raise failure(422, "speech_not_detected")
        return Transcription(text=text, duration_seconds=round(duration, 3))
    finally:
        processing.release()

import io
import math
import struct
import wave

import pytest
from fastapi.testclient import TestClient
from backend.app import app
import backend.speech as speech


def wav_audio(seconds=1, rate=16000, channels=1, silence=False):
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        samples = (0 if silence else int(4000 * math.sin(index * 0.1)) for index in range(int(seconds * rate) * channels))
        wav.writeframes(b"".join(struct.pack("<h", value) for value in samples))
    return output.getvalue()


def oversized_duration():
    payload = bytearray(wav_audio())
    struct.pack_into("<I", payload, 40, (speech.MAX_SECONDS + 1) * 16000 * 2)
    return bytes(payload)


def test_voice_transcription_keeps_audio_in_memory_and_returns_draft(monkeypatch):
    received = []
    def recognize(pcm, rate):
        received.append((len(pcm), rate))
        return "Покажи выручку по месяцам."
    monkeypatch.setattr(speech, "transcribe_pcm", recognize)
    with TestClient(app) as client:
        response = client.post("/api/audio/transcribe", content=wav_audio(), headers={"Content-Type": "audio/wav"})
    assert response.status_code == 200
    assert response.json() == {"text": "Покажи выручку по месяцам.", "duration_seconds": 1.0, "model": speech.MODEL}
    assert received == [(32000, 16000)]
    assert not speech.processing.locked()


@pytest.mark.parametrize("payload,code", [
    (b"not a wave file", "invalid_audio"),
    (wav_audio()[:-30], "invalid_audio"),
    (wav_audio(channels=2), "invalid_audio"),
    (wav_audio(seconds=0.1), "invalid_audio"),
    (wav_audio(rate=96000), "invalid_audio"),
    (wav_audio(silence=True), "speech_not_detected"),
    (oversized_duration(), "audio_too_long"),
    (b"x" * (speech.MAX_BYTES + 1), "audio_too_long"),
])
def test_rejects_bad_audio_before_model_inference(monkeypatch, payload, code):
    def unexpected(*args):
        pytest.fail("Inference must not run for invalid audio")
    monkeypatch.setattr(speech, "transcribe_pcm", unexpected)
    with TestClient(app) as client:
        response = client.post("/api/audio/transcribe", content=payload, headers={"Content-Type": "audio/wav"})
    assert response.status_code in {413, 422}
    assert response.json()["detail"]["code"] == code
    assert not speech.processing.locked()


def test_rejects_unsupported_content_type():
    with TestClient(app) as client:
        assert client.post("/api/audio/transcribe", content=b"x", headers={"Content-Type": "audio/webm"}).status_code == 415


def test_busy_recognizer_does_not_queue_unbounded_uploads():
    speech.processing.acquire()
    try:
        with TestClient(app) as client:
            response = client.post("/api/audio/transcribe", content=wav_audio(), headers={"Content-Type": "audio/wav"})
        assert response.status_code == 429
    finally:
        speech.processing.release()


def test_missing_model_does_not_expose_internal_errors(monkeypatch):
    def failed(*args):
        raise RuntimeError("private internal path")
    monkeypatch.setattr(speech, "transcribe_pcm", failed)
    with TestClient(app) as client:
        response = client.post("/api/audio/transcribe", content=wav_audio(), headers={"Content-Type": "audio/wav"})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "speech_unavailable"
    assert "private" not in response.text
    assert not speech.processing.locked()


def test_voice_readiness_without_model_files(monkeypatch, tmp_path):
    monkeypatch.setattr(speech, "model_files", lambda: (tmp_path / "missing.ckpt", tmp_path / "missing.model"))
    with TestClient(app) as client:
        response = client.get("/api/audio/health")
    assert response.status_code == 200
    assert response.json()["available"] is False


def test_long_recording_is_accepted_and_chunk_windows_cover_it(monkeypatch):
    monkeypatch.setattr(speech, "transcribe_pcm", lambda pcm, rate: "Длинный вопрос.")
    with TestClient(app) as client:
        response = client.post("/api/audio/transcribe", content=wav_audio(seconds=31), headers={"Content-Type": "audio/wav"})
    assert response.status_code == 200
    assert response.json()["duration_seconds"] == 31
    windows = list(speech.speech_windows(31 * 16000))
    assert windows == [(0, 320000), (288000, 496000)]
    assert all(end - start <= 20 * 16000 for start, end in windows)


def test_chunk_join_removes_overlapping_words_but_keeps_new_words():
    assert speech.continuation("Покажи выручку по месяцам.", "По месяцам за 2018 год.") == "за 2018 год."
    assert speech.continuation("Первый вопрос.", "Другой вопрос.") == "Другой вопрос."
    assert list(speech.speech_windows(20 * 16000)) == [(0, 320000)]

"""Persistent job store for async MLX generation."""

from __future__ import annotations

import json
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional


class JobKind(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    PHOTO_TO_VIDEO = "photo_to_video"
    TEXT_TO_VIDEO = "text_to_video"


class JobState(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class GenerationJob:
    id: str
    kind: JobKind
    state: JobState
    model_id: str
    prompt: str
    created_at: str
    updated_at: str
    progress: float = 0.0
    error: Optional[str] = None
    result_path: Optional[str] = None
    result_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["kind"] = self.kind.value
        payload["state"] = self.state.value
        return payload

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "GenerationJob":
        return cls(
            id=data["id"],
            kind=JobKind(data["kind"]),
            state=JobState(data["state"]),
            model_id=data["model_id"],
            prompt=data["prompt"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            progress=float(data.get("progress", 0.0)),
            error=data.get("error"),
            result_path=data.get("result_path"),
            result_url=data.get("result_url"),
            thumbnail_url=data.get("thumbnail_url"),
            metadata=data.get("metadata") or {},
        )


class JobStore:
    def __init__(self, root: Path) -> None:
        self._root = root
        self._root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path(self, job_id: str) -> Path:
        return self._root / f"{job_id}.json"

    def create(
        self,
        *,
        kind: JobKind,
        model_id: str,
        prompt: str,
        metadata: Optional[dict[str, Any]] = None,
        job_id: Optional[str] = None,
    ) -> GenerationJob:
        now = datetime.utcnow().isoformat()
        job = GenerationJob(
            id=job_id or f"job_{uuid.uuid4().hex[:12]}",
            kind=kind,
            state=JobState.PENDING,
            model_id=model_id,
            prompt=prompt,
            created_at=now,
            updated_at=now,
            metadata=metadata or {},
        )
        self.save(job)
        return job

    def save(self, job: GenerationJob) -> None:
        job.updated_at = datetime.utcnow().isoformat()
        with self._lock:
            self._path(job.id).write_text(
                json.dumps(job.to_dict(), indent=2),
                encoding="utf-8",
            )

    def get(self, job_id: str) -> Optional[GenerationJob]:
        path = self._path(job_id)
        if not path.exists():
            return None
        with self._lock:
            data = json.loads(path.read_text(encoding="utf-8"))
        return GenerationJob.from_dict(data)

    def list_pending(self) -> list[GenerationJob]:
        jobs: list[GenerationJob] = []
        for path in sorted(self._root.glob("job_*.json")):
            job = GenerationJob.from_dict(json.loads(path.read_text(encoding="utf-8")))
            if job.state == JobState.PENDING:
                jobs.append(job)
        return jobs
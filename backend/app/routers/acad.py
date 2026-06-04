import os
import json
import re
from datetime import datetime
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.routers.auth import get_current_user
from app.r2 import generate_presigned_put

router = APIRouter(prefix="/acad", tags=["Acad Vault"])

# ==========================================
# CONSTANTS / TIMETABLE
# ==========================================
TIMETABLE_FILE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "master_timetable.json"
)
MASTER_TIMETABLE: dict = {}
if os.path.exists(TIMETABLE_FILE_PATH):
    with open(TIMETABLE_FILE_PATH, "r") as f:
        MASTER_TIMETABLE = json.load(f)

KIND = Literal["YEAR1_COMMON", "STREAM_SCHEME", "STREAM_COURSE", "MISC"]
ALLOWED_SUB_TAGS = {"PYQ", "Notes", "Cheatsheet", "Syllabus", "Other"}


# ==========================================
# HELPERS
# ==========================================
def _ensure_can_upload(user: models.User):
    if user.role == "guest" or not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Only verified Thapar users can upload to the Acad Vault.",
        )
    if user.banned_until and user.banned_until > datetime.utcnow():
        raise HTTPException(
            status_code=403,
            detail=f"You are banned until {user.banned_until.isoformat()}.",
        )


def _serialize(r: models.AcadResource, uploader_name: Optional[str] = None) -> dict:
    tags = r.tags if isinstance(r.tags, dict) else {}
    return {
        "id": r.id,
        "title": r.title,
        "file_url": r.file_url,
        "status": r.status,
        "uploader_id": r.uploader_id,
        "uploader_name": uploader_name,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "kind": tags.get("kind"),
        "year": tags.get("year"),
        "stream": tags.get("stream"),
        "course_code": tags.get("course_code"),
        "course_name": tags.get("course_name"),
        "sub_tag": tags.get("sub_tag"),
        "source": tags.get("source"),
    }


# ==========================================
# SCHEMAS
# ==========================================
class PresignRequest(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"


class PresignResponse(BaseModel):
    upload_url: str
    public_url: str
    key: str


class ResourceCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    file_url: str = Field(..., min_length=4, max_length=1000)
    kind: KIND
    year: Optional[int] = None
    stream: Optional[str] = None
    course_code: Optional[str] = None
    course_name: Optional[str] = None
    sub_tag: Optional[str] = None
    source: Literal["file", "link"] = "file"


# ==========================================
# UPLOAD URL
# ==========================================
@router.post("/upload-url", response_model=PresignResponse)
def get_upload_url(
    payload: PresignRequest,
    current_user: models.User = Depends(get_current_user),
):
    _ensure_can_upload(current_user)
    if not payload.filename or not payload.filename.strip():
        raise HTTPException(status_code=400, detail="Filename required")
    try:
        upload_url, public_url, key = generate_presigned_put(
            payload.filename, payload.content_type or "application/octet-stream"
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return PresignResponse(upload_url=upload_url, public_url=public_url, key=key)


# ==========================================
# CREATE RESOURCE
# ==========================================
@router.post("/resources")
def create_resource(
    payload: ResourceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_can_upload(current_user)

    if payload.kind == "YEAR1_COMMON":
        if not payload.course_code:
            raise HTTPException(status_code=400, detail="Year 1 resource requires a course code.")
        year_val: Optional[int] = 1
        stream_val: Optional[str] = None
    elif payload.kind == "STREAM_SCHEME":
        if not payload.stream:
            raise HTTPException(status_code=400, detail="Stream scheme requires a stream.")
        year_val = None
        stream_val = payload.stream.upper()
    elif payload.kind == "STREAM_COURSE":
        if not (payload.stream and payload.year and payload.course_code):
            raise HTTPException(
                status_code=400, detail="Stream course requires stream, year, and course code."
            )
        if payload.year not in (2, 3, 4):
            raise HTTPException(status_code=400, detail="Stream course year must be 2, 3, or 4.")
        year_val = payload.year
        stream_val = payload.stream.upper()
    else:  # MISC
        year_val = payload.year
        stream_val = (payload.stream or "").upper() or None

    if payload.sub_tag and payload.sub_tag not in ALLOWED_SUB_TAGS:
        raise HTTPException(
            status_code=400, detail=f"sub_tag must be one of {sorted(ALLOWED_SUB_TAGS)}"
        )

    tag_obj = {
        "kind": payload.kind,
        "year": year_val,
        "stream": stream_val,
        "course_code": (payload.course_code or "").upper().strip() or None,
        "course_name": (payload.course_name or "").strip() or None,
        "sub_tag": payload.sub_tag,
        "source": payload.source,
    }

    resource = models.AcadResource(
        uploader_id=current_user.id,
        title=payload.title.strip(),
        file_url=payload.file_url.strip(),
        tags=tag_obj,
        status="pending",
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return _serialize(resource, current_user.name)


# ==========================================
# LIST / DELETE
# ==========================================
@router.get("/resources")
def list_resources(
    kind: Optional[str] = None,
    stream: Optional[str] = None,
    year: Optional[int] = None,
    course_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Returns all approved resources plus the current user's own pending uploads."""
    q = db.query(models.AcadResource).filter(
        (models.AcadResource.status == "approved")
        | (models.AcadResource.uploader_id == current_user.id)
    )
    rows = q.order_by(models.AcadResource.created_at.desc()).all()

    uploader_ids = {r.uploader_id for r in rows if r.uploader_id}
    uploaders: dict = {}
    if uploader_ids:
        uploaders = {
            u.id: u.name
            for u in db.query(models.User).filter(models.User.id.in_(uploader_ids)).all()
        }

    out = [_serialize(r, uploaders.get(r.uploader_id)) for r in rows]

    def _match(r: dict) -> bool:
        if kind and r["kind"] != kind:
            return False
        if stream and (r["stream"] or "").upper() != stream.upper():
            return False
        if year is not None and r["year"] != year:
            return False
        if course_code and (r["course_code"] or "").upper() != course_code.upper():
            return False
        return True

    return [r for r in out if _match(r)]


@router.delete("/resources/{resource_id}")
def delete_own_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    r = (
        db.query(models.AcadResource)
        .filter(models.AcadResource.id == resource_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found.")
    if r.uploader_id != current_user.id and current_user.role != "super_admin":
        raise HTTPException(
            status_code=403, detail="You can only delete your own uploads."
        )
    db.delete(r)
    db.commit()
    return {"message": "deleted"}


# ==========================================
# COURSES — derived from master_timetable.json
# ==========================================
_COURSE_CACHE: dict = {}


def _build_course_index() -> dict:
    """Returns {year: [{code, name}]} unique per year."""
    if _COURSE_CACHE:
        return _COURSE_CACHE
    by_year: dict = {}
    for batch_key, days in (MASTER_TIMETABLE or {}).items():
        if not batch_key or not str(batch_key)[0].isdigit():
            continue
        try:
            batch_year = int(str(batch_key)[0])
        except ValueError:
            continue
        bucket = by_year.setdefault(batch_year, {})
        for _day, slots in (days or {}).items():
            for _time, entry in (slots or {}).items():
                if not isinstance(entry, list) or len(entry) < 3:
                    continue
                code = str(entry[0] or "").upper().strip()
                name = str(entry[2] or "").strip()
                if not code:
                    continue
                # Drop trailing L/P/T (Lecture/Practical/Tutorial markers)
                base = re.sub(r"[LPT]$", "", code)
                if base not in bucket:
                    bucket[base] = {"code": base, "name": name.title()}
    _COURSE_CACHE.update({y: sorted(v.values(), key=lambda c: c["code"]) for y, v in by_year.items()})
    return _COURSE_CACHE


@router.get("/courses")
def list_courses(
    year: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
):
    idx = _build_course_index()
    if year is not None:
        return idx.get(year, [])
    out = []
    for _y, items in idx.items():
        out.extend(items)
    seen = set()
    deduped = []
    for it in sorted(out, key=lambda c: c["code"]):
        if it["code"] in seen:
            continue
        seen.add(it["code"])
        deduped.append(it)
    return deduped

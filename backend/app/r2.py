import os
import uuid
import re
from typing import Tuple

import boto3
from botocore.client import Config

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_PUBLIC_BASE_URL = (os.getenv("R2_PUBLIC_BASE_URL") or "").rstrip("/")

_client = None


def get_r2_client():
    global _client
    if _client is None:
        if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME]):
            raise RuntimeError(
                "R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME."
            )
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )
    return _client


def _safe_filename(name: str) -> str:
    name = name.strip().replace("\\", "_").replace("/", "_")
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return name[:120] or "file"


def generate_presigned_put(
    filename: str,
    content_type: str,
    prefix: str = "acad",
    expires: int = 600,
) -> Tuple[str, str, str]:
    """Returns (upload_url, public_url, key)."""
    key = f"{prefix}/{uuid.uuid4().hex}_{_safe_filename(filename)}"
    client = get_r2_client()
    upload_url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": R2_BUCKET_NAME, "Key": key, "ContentType": content_type},
        ExpiresIn=expires,
    )
    public_url = f"{R2_PUBLIC_BASE_URL}/{key}" if R2_PUBLIC_BASE_URL else upload_url.split("?")[0]
    return upload_url, public_url, key

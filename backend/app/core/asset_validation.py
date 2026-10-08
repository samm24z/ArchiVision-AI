"""Server-side validation for M4 multipart assets."""

import struct
from dataclasses import dataclass
from email import policy
from email.parser import BytesParser
from pathlib import PurePath

from app.schemas.assets import MAX_ASSET_SIZE_BYTES, AssetCategory


class AssetValidationError(Exception):
    """Raised when an uploaded asset violates the M4 contract."""

    def __init__(self, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class ParsedUpload:
    """Validated multipart upload data."""

    category: AssetCategory
    filename: str
    mime_type: str
    content: bytes
    width: int | None
    height: int | None

    @property
    def file_size_bytes(self) -> int:
        return len(self.content)


FORMAT_RULES: dict[AssetCategory, dict[str, tuple[str, ...]]] = {
    AssetCategory.SKETCH: {
        "image/jpeg": (".jpg", ".jpeg"),
        "image/png": (".png",),
        "image/webp": (".webp",),
    },
    AssetCategory.FLOOR_PLAN: {
        "image/jpeg": (".jpg", ".jpeg"),
        "image/png": (".png",),
        "application/pdf": (".pdf",),
    },
    AssetCategory.REFERENCE_IMAGE: {
        "image/jpeg": (".jpg", ".jpeg"),
        "image/png": (".png",),
        "image/webp": (".webp",),
    },
    AssetCategory.DOCUMENT: {
        "application/pdf": (".pdf",),
    },
}


def parse_multipart_upload(
    body: bytes, content_type: str
) -> tuple[bytes, str, str, str | None]:
    """Extract file and category from multipart data using stdlib MIME parsing."""
    if not content_type.lower().startswith("multipart/form-data"):
        raise AssetValidationError(
            "Asset upload must use multipart/form-data.", status_code=400
        )

    message = BytesParser(policy=policy.default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode()
        + body
    )
    if not message.is_multipart():
        raise AssetValidationError("Malformed multipart request.", status_code=400)

    category: str | None = None
    filename: str | None = None
    content: bytes | None = None
    declared_mime_type: str | None = None
    for part in message.iter_parts():
        field_name = part.get_param("name", header="content-disposition")
        if field_name == "category":
            category = (part.get_content() or "").strip()
        elif field_name == "file":
            filename = part.get_filename()
            content = part.get_payload(decode=True) or b""
            declared_mime_type = part.get_content_type()

    if not category or filename is None or content is None:
        raise AssetValidationError(
            "Upload requires category and file fields.", status_code=400
        )
    return content, category, filename, declared_mime_type


def normalize_filename(filename: str, allowed_extensions: tuple[str, ...]) -> str:
    """Return a safe basename with a validated extension."""
    basename = PurePath(filename.replace("\\", "/")).name
    basename = "".join(
        character for character in basename.strip() if character.isprintable()
    )
    extension = PurePath(basename).suffix.lower()
    if extension not in allowed_extensions:
        raise AssetValidationError("File extension is not allowed for this category.")

    stem = PurePath(basename).stem.strip()
    safe_stem = "".join(
        character if character.isalnum() or character in "-_ ." else "_"
        for character in stem
    ).strip(" .")
    if not safe_stem:
        safe_stem = "asset"
    return f"{safe_stem}{extension}"


def validate_upload(
    content: bytes,
    category_value: str,
    filename: str,
    declared_mime_type: str | None = None,
) -> ParsedUpload:
    """Validate size, category/format matrix, signature, and image dimensions."""
    if len(content) > MAX_ASSET_SIZE_BYTES:
        raise AssetValidationError("File exceeds the 20 MiB limit.", status_code=413)

    try:
        category = AssetCategory(category_value)
    except ValueError as error:
        raise AssetValidationError("Invalid asset category.") from error

    extension = PurePath(filename.replace("\\", "/")).suffix.lower()
    detected_mime = detect_mime_type(content)
    allowed_mimes = FORMAT_RULES[category]
    if detected_mime not in allowed_mimes:
        raise AssetValidationError("File type is not allowed for this category.")
    if extension not in allowed_mimes[detected_mime]:
        raise AssetValidationError(
            "File extension does not match the category and content."
        )
    if declared_mime_type and declared_mime_type.lower() != detected_mime:
        raise AssetValidationError("Declared MIME type does not match file content.")

    safe_filename = normalize_filename(filename, allowed_mimes[detected_mime])
    width, height = image_dimensions(content, detected_mime)
    return ParsedUpload(category, safe_filename, detected_mime, content, width, height)


def detect_mime_type(content: bytes) -> str:
    """Detect the supported file type from its content signature."""
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    raise AssetValidationError(
        "File content signature is unsupported.", status_code=415
    )


def image_dimensions(content: bytes, mime_type: str) -> tuple[int | None, int | None]:
    """Extract dimensions for supported images; PDFs intentionally return nulls."""
    if mime_type == "application/pdf":
        return None, None
    if mime_type == "image/png":
        if len(content) < 24:
            raise AssetValidationError("PNG file is truncated.", status_code=415)
        return struct.unpack(">II", content[16:24])
    if mime_type == "image/webp":
        return webp_dimensions(content)
    return jpeg_dimensions(content)


def jpeg_dimensions(content: bytes) -> tuple[int, int]:
    """Read JPEG SOF dimensions without decoding the image."""
    position = 2
    while position + 9 < len(content):
        if content[position] != 0xFF:
            position += 1
            continue
        marker = content[position + 1]
        position += 2
        if marker in {0xD8, 0xD9}:
            continue
        if position + 2 > len(content):
            break
        segment_length = struct.unpack(">H", content[position : position + 2])[0]
        sof_markers = (
            set(range(0xC0, 0xC4))
            | set(range(0xC5, 0xC8))
            | set(range(0xC9, 0xCC))
            | set(range(0xCD, 0xD0))
        )
        if marker in sof_markers:
            if position + 7 > len(content):
                break
            height, width = struct.unpack(">HH", content[position + 3 : position + 7])
            if width > 0 and height > 0:
                return width, height
        position += segment_length
    raise AssetValidationError("JPEG dimensions could not be read.", status_code=415)


def webp_dimensions(content: bytes) -> tuple[int, int]:
    """Read dimensions from a WebP VP8X or VP8 lossy frame."""
    chunk_type = content[12:16]
    if chunk_type == b"VP8X" and len(content) >= 30:
        width = 1 + int.from_bytes(content[24:27], "little")
        height = 1 + int.from_bytes(content[27:30], "little")
        return width, height
    if chunk_type == b"VP8 " and len(content) >= 30:
        frame_start = content.find(b"\x9d\x01\x2a", 20)
        if frame_start >= 0 and frame_start + 7 <= len(content):
            width, height = struct.unpack(
                "<HH", content[frame_start + 3 : frame_start + 7]
            )
            return width & 0x3FFF, height & 0x3FFF
    raise AssetValidationError("WebP dimensions could not be read.", status_code=415)
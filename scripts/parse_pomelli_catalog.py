#!/usr/bin/env python3
"""Parse Pomelli HTML catalog export and generate canonical taxonomy mapping.

Reads ``assets/raw_mattress/Pomelli by Google Labs.html``, extracts every
``product-preview-container`` card and global ``<img>`` element, inspects the
corresponding raw PNG files on disk with Pillow, classifies each unique asset
into the canonical Puffy catalog taxonomy, deduplicates by SHA-256, and writes
``assets/raw_mattress/pomelli_mapping.json``.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable, Optional

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "assets" / "raw_mattress"
HTML_PATH = RAW_DIR / "Pomelli by Google Labs.html"
OUTPUT_PATH = RAW_DIR / "pomelli_mapping.json"

VOID_HTML_TAGS = frozenset(
    {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    }
)

IGNORED_RAW_FILENAMES = frozenset(
    {
        ".DS_Store",
        ".gitkeep",
        "Pomelli by Google Labs.html",
        "pomelli_mapping.json",
    }
)

CANONICAL_FILENAME_RE = re.compile(
    r"^(cutout|hero|detail|badge)_([a-z0-9\-]+)_([a-z0-9\-]+)\.(png|webp|svg|jpg)$"
)
KEBAB_RE = re.compile(r"^[a-z0-9-]+$")

EXPLICIT_MATTRESS_SLUGS: dict[str, str] = {
    "puffy cloud mattress": "puffy-cloud",
    "puffy lux mattress": "puffy-lux-hybrid",
    "puffy royal mattress": "puffy-royal-hybrid",
    "puffy monarch mattress": "puffy-monarch-hybrid",
    "puffy legacy mattress": "puffy-legacy",
}

EXPLICIT_PILLOW_SLUGS: dict[str, str] = {
    "puffy signature pillow": "puffy-signature-pillow",
}

BEDDING_KEYWORDS = (
    "sheets set",
    "weighted blanket",
    "blanket",
    "comforter",
    "mattress pad",
    "mattress topper",
    "mattress protector",
    "sleep mask",
    "rug",
)

BED_FRAME_KEYWORDS = (
    "bed frame",
    "smart bed set",
    "adjustable base",
    "foundation",
    "chair",
    "sofa",
)


@dataclass
class DomNode:
    """Lightweight DOM node used uniformly by bs4 and stdlib html.parser."""

    tag: str
    attrs: dict[str, str] = field(default_factory=dict)
    children: list[DomNode] = field(default_factory=list)
    text_parts: list[str] = field(default_factory=list)

    def classes(self) -> set[str]:
        raw = self.attrs.get("class", "")
        return set(raw.split()) if raw else set()

    def has_class(self, class_name: str) -> bool:
        return class_name in self.classes()

    def get_text(self) -> str:
        parts = list(self.text_parts)
        for child in self.children:
            parts.append(child.get_text())
        return "".join(parts)

    def walk(self) -> Iterable[DomNode]:
        yield self
        for child in self.children:
            yield from child.walk()


class _StdlibDomBuilder(HTMLParser):
    """Python stdlib HTMLParser tree builder fallback when bs4 is unavailable."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = DomNode(tag="document")
        self._stack: list[DomNode] = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        tag_lower = tag.lower()
        attr_map = {k.lower(): (v if v is not None else "") for k, v in attrs}
        node = DomNode(tag=tag_lower, attrs=attr_map)
        self._stack[-1].children.append(node)
        if tag_lower not in VOID_HTML_TAGS:
            self._stack.append(node)

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, Optional[str]]]
    ) -> None:
        tag_lower = tag.lower()
        attr_map = {k.lower(): (v if v is not None else "") for k, v in attrs}
        node = DomNode(tag=tag_lower, attrs=attr_map)
        self._stack[-1].children.append(node)

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        for idx in range(len(self._stack) - 1, 0, -1):
            if self._stack[idx].tag == tag_lower:
                del self._stack[idx:]
                break

    def handle_data(self, data: str) -> None:
        self._stack[-1].text_parts.append(data)


def _bs4_to_dom_node(bs_elem: object) -> DomNode:
    """Convert a BeautifulSoup Tag tree into our uniform DomNode tree."""
    from bs4.element import NavigableString, Tag  # type: ignore[import-not-found]

    if isinstance(bs_elem, Tag):
        attr_map: dict[str, str] = {}
        for k, v in bs_elem.attrs.items():
            if isinstance(v, list):
                attr_map[k.lower()] = " ".join(str(x) for x in v)
            elif v is None:
                attr_map[k.lower()] = ""
            else:
                attr_map[k.lower()] = str(v)
        node = DomNode(tag=bs_elem.name.lower(), attrs=attr_map)
        for child in bs_elem.children:
            if isinstance(child, Tag):
                node.children.append(_bs4_to_dom_node(child))
            elif isinstance(child, NavigableString):
                node.text_parts.append(str(child))
        return node
    return DomNode(tag="document")


def parse_html_tree(html_text: str) -> tuple[DomNode, str]:
    """Parse HTML using BeautifulSoup if installed, else stdlib HTMLParser."""
    try:
        from bs4 import BeautifulSoup  # type: ignore[import-not-found]

        soup = BeautifulSoup(html_text, "html.parser")
        root = DomNode(tag="document")
        for child in soup.contents:
            converted = _bs4_to_dom_node(child)
            if converted.tag != "document":
                root.children.append(converted)
        return root, "beautifulsoup4"
    except ImportError:
        builder = _StdlibDomBuilder()
        builder.feed(html_text)
        builder.close()
        return builder.root, "stdlib.html.parser"


def strip_free_upgrade(name: str) -> str:
    """Normalize whitespace and strip '(Free Upgrade)' suffix."""
    cleaned = re.sub(r"\s*\(free upgrade\)\s*", " ", name, flags=re.IGNORECASE)
    return " ".join(cleaned.split())


def to_kebab_case(text: str) -> str:
    """Convert product title to strict kebab-case [a-z0-9-]+."""
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    if not KEBAB_RE.match(slug):
        raise ValueError(f"Generated invalid kebab-case slug {slug!r} from {text!r}")
    return slug


def classify_product(product_name: str) -> tuple[str, str]:
    """Map a Pomelli product card title to canonical (category, product_slug)."""
    base_name = strip_free_upgrade(product_name)
    lowered = base_name.lower()

    if lowered in EXPLICIT_MATTRESS_SLUGS:
        return "mattresses", EXPLICIT_MATTRESS_SLUGS[lowered]

    if lowered in EXPLICIT_PILLOW_SLUGS:
        return "pillows", EXPLICIT_PILLOW_SLUGS[lowered]

    if any(kw in lowered for kw in BEDDING_KEYWORDS):
        return "bedding", to_kebab_case(base_name)

    if any(kw in lowered for kw in BED_FRAME_KEYWORDS):
        return "bed-frames", to_kebab_case(base_name)

    raise ValueError(f"Unable to classify product {product_name!r} into canonical taxonomy")


def compute_sha256(file_path: Path) -> str:
    """Compute lowercase hexadecimal SHA-256 digest of a file."""
    hasher = hashlib.sha256()
    with file_path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def inspect_image_file(file_path: Path) -> dict[str, object]:
    """Inspect an image file on disk using Pillow and compute SHA-256 and pixel metrics."""
    sha256 = compute_sha256(file_path)
    with Image.open(file_path) as img:
        orig_mode = img.mode
        img_format = (img.format or file_path.suffix.lstrip(".") or "unknown").lower()
        rgba = img.convert("RGBA")
        width, height = rgba.size
        alpha_min, alpha_max = rgba.getextrema()[3]
        corners = {
            "top_left": list(rgba.getpixel((0, 0))),
            "top_right": list(rgba.getpixel((width - 1, 0))),
            "bottom_left": list(rgba.getpixel((0, height - 1))),
            "bottom_right": list(rgba.getpixel((width - 1, height - 1))),
        }

    return {
        "sha256": sha256,
        "width": width,
        "height": height,
        "resolution": f"{width}x{height}",
        "format": img_format,
        "mode": orig_mode,
        "alpha_extrema": [int(alpha_min), int(alpha_max)],
        "corners": corners,
    }


def _all_corners_transparent(corners: dict[str, list[int]]) -> bool:
    return all(px[3] == 0 for px in corners.values())


def _has_transparent_corners(corners: dict[str, list[int]]) -> bool:
    """Return True when background corners are transparent (allows 1 foreground-edge overlap)."""
    zero_alpha_corners = sum(1 for px in corners.values() if px[3] == 0)
    return zero_alpha_corners >= 3


def _all_corners_pure_white(corners: dict[str, list[int]]) -> bool:
    return all(
        px[0] >= 250 and px[1] >= 250 and px[2] >= 250 and px[3] >= 245
        for px in corners.values()
    )


def classify_intent_and_base_variant(
    alt: str,
    is_thumb_of_primary: bool,
    corners: dict[str, list[int]],
) -> tuple[str, str]:
    """Classify asset intent and base variant from DOM role and corner pixels."""
    if alt == "Product image":
        if _all_corners_transparent(corners) or _all_corners_pure_white(corners):
            return "cutout", "angle45"
        return "hero", "lifestyle"

    if alt == "Product thumbnail":
        if _has_transparent_corners(corners):
            return "cutout", "thumb-angle45"
        if is_thumb_of_primary:
            return "detail", "thumb-hero"
        if _all_corners_pure_white(corners):
            return "detail", "thumb-studio"
        return "detail", "thumb-detail"

    raise ValueError(f"Unsupported DOM img alt={alt!r}")


def allocate_unique_variant(
    used_paths: set[str],
    category: str,
    product_slug: str,
    intent: str,
    base_variant: str,
    resolution: str,
    ext: str = "png",
) -> tuple[str, str, str]:
    """Pick a collision-free variant (-v2, -v3, ...) and canonical catalog path."""
    attempt = 1
    while True:
        variant = base_variant if attempt == 1 else f"{base_variant}-v{attempt}"
        filename = f"{intent}_{variant}_{resolution}.{ext}"
        rel_path = f"assets/catalog/{category}/{product_slug}/{filename}"
        if rel_path not in used_paths:
            if not CANONICAL_FILENAME_RE.match(filename):
                raise ValueError(f"Canonical filename violates regex: {filename}")
            used_paths.add(rel_path)
            return variant, filename, rel_path
        attempt += 1


def extract_cards_and_refs(
    root: DomNode,
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    """Extract all product cards and their referenced <img> elements in DOM order."""
    all_imgs = [node for node in root.walk() if node.tag == "img"]
    img_global_index = {id(node): idx for idx, node in enumerate(all_imgs, start=1)}

    cards = [
        node
        for node in root.walk()
        if node.tag == "div" and node.has_class("product-preview-container")
    ]

    cards_without_images: list[dict[str, object]] = []
    dom_refs: list[dict[str, object]] = []

    for card_index, card in enumerate(cards, start=1):
        name_bars = [
            node
            for node in card.walk()
            if node.tag == "div" and node.has_class("product-name-bar")
        ]
        if not name_bars:
            raise ValueError(f"Card #{card_index} is missing .product-name-bar")
        product_name = " ".join(name_bars[0].get_text().split())

        sub_thumbs_nodes = [
            node
            for node in card.walk()
            if node.tag == "div" and node.has_class("sub-thumbnails")
        ]
        sub_thumb_img_ids = {
            id(img)
            for container in sub_thumbs_nodes
            for img in container.walk()
            if img.tag == "img"
        }

        card_imgs = [node for node in card.walk() if node.tag == "img"]
        if not card_imgs:
            cards_without_images.append(
                {
                    "card_index": card_index,
                    "product_name": product_name,
                }
            )
            continue

        for img in card_imgs:
            global_idx = img_global_index[id(img)]
            alt = img.attrs.get("alt", "").strip()
            src = img.attrs.get("src", "").strip()
            raw_token = src.rsplit("/", 1)[-1]
            is_thumb_of_primary = raw_token.endswith("(1)")
            token = raw_token[:-3] if is_thumb_of_primary else raw_token

            if alt == "Product thumbnail" and id(img) not in sub_thumb_img_ids:
                raise ValueError(
                    f"Thumbnail img #{global_idx} on card #{card_index} not inside .sub-thumbnails"
                )

            dom_refs.append(
                {
                    "global_img_index": global_idx,
                    "card_index": card_index,
                    "product_name": product_name,
                    "alt": alt,
                    "src": src,
                    "token": token,
                    "is_primary": alt == "Product image",
                    "is_thumb_of_primary": is_thumb_of_primary,
                    "expected_raw_filename": f"imgi_{global_idx}_{token}.png",
                }
            )

    return dom_refs, cards_without_images


def build_mapping() -> dict[str, object]:
    """Parse Pomelli HTML, match raw disk files, classify, and deduplicate."""
    if not HTML_PATH.exists():
        raise FileNotFoundError(f"Missing HTML export: {HTML_PATH}")

    html_text = HTML_PATH.read_text(encoding="utf-8")
    root, parser_backend = parse_html_tree(html_text)
    dom_refs, cards_without_images = extract_cards_and_refs(root)

    mapped_assets: list[dict[str, object]] = []
    unmapped_or_duplicate_assets: list[dict[str, object]] = []

    matched_raw_filenames: set[str] = set()
    first_seen_by_sha: dict[str, dict[str, object]] = {}
    used_catalog_paths: set[str] = set()

    for ref in dom_refs:
        raw_filename = str(ref["expected_raw_filename"])
        raw_path = RAW_DIR / raw_filename
        rel_raw_path = raw_path.relative_to(REPO_ROOT).as_posix()

        if not raw_path.is_file():
            stem_prefix = f"imgi_{ref['global_img_index']}_{ref['token']}"
            similar = sorted(
                p.name
                for p in RAW_DIR.iterdir()
                if p.is_file() and p.name.startswith(stem_prefix)
            )
            note = (
                f"Matched DOM #{ref['global_img_index']} .png absent from disk"
                + (f" (found non-.png sibling: {', '.join(similar)})" if similar else "")
            )
            unmapped_or_duplicate_assets.append(
                {
                    "global_img_index": ref["global_img_index"],
                    "card_index": ref["card_index"],
                    "product_name": ref["product_name"],
                    "alt": ref["alt"],
                    "src": ref["src"],
                    "token": ref["token"],
                    "raw_filename": raw_filename,
                    "raw_path": rel_raw_path,
                    "status": "missing_on_disk",
                    "reason": note,
                }
            )
            continue

        matched_raw_filenames.add(raw_filename)
        metrics = inspect_image_file(raw_path)
        sha256 = str(metrics["sha256"])

        if sha256 in first_seen_by_sha:
            first = first_seen_by_sha[sha256]
            unmapped_or_duplicate_assets.append(
                {
                    "global_img_index": ref["global_img_index"],
                    "card_index": ref["card_index"],
                    "product_name": ref["product_name"],
                    "alt": ref["alt"],
                    "src": ref["src"],
                    "token": ref["token"],
                    "raw_filename": raw_filename,
                    "raw_path": rel_raw_path,
                    "status": "duplicate_sha256",
                    **metrics,
                    "duplicate_of_raw_path": first["raw_path"],
                    "duplicate_of_canonical_catalog_path": first[
                        "canonical_catalog_path"
                    ],
                    "reason": f"Byte-identical SHA-256 duplicate of {first['raw_path']}",
                }
            )
            continue

        product_name = str(ref["product_name"])
        category, product_slug = classify_product(product_name)
        corners = metrics["corners"]
        assert isinstance(corners, dict)

        intent, base_variant = classify_intent_and_base_variant(
            alt=str(ref["alt"]),
            is_thumb_of_primary=bool(ref["is_thumb_of_primary"]),
            corners=corners,
        )
        resolution = str(metrics["resolution"])
        variant, canonical_filename, canonical_catalog_path = allocate_unique_variant(
            used_paths=used_catalog_paths,
            category=category,
            product_slug=product_slug,
            intent=intent,
            base_variant=base_variant,
            resolution=resolution,
            ext="png",
        )

        entry: dict[str, object] = {
            "global_img_index": ref["global_img_index"],
            "card_index": ref["card_index"],
            "product_name": product_name,
            "alt": ref["alt"],
            "src": ref["src"],
            "token": ref["token"],
            "is_primary": ref["is_primary"],
            "is_thumb_of_primary": ref["is_thumb_of_primary"],
            "raw_filename": raw_filename,
            "raw_path": rel_raw_path,
            "status": "mapped",
            **metrics,
            "category": category,
            "product_slug": product_slug,
            "intent": intent,
            "variant": variant,
            "canonical_filename": canonical_filename,
            "canonical_catalog_path": canonical_catalog_path,
        }
        mapped_assets.append(entry)
        first_seen_by_sha[sha256] = entry

    # Scan assets/raw_mattress/ for any orphan files not matched to DOM refs
    for entry_path in sorted(RAW_DIR.iterdir(), key=lambda p: p.name):
        if not entry_path.is_file():
            continue
        if entry_path.name in IGNORED_RAW_FILENAMES:
            continue
        if entry_path.name in matched_raw_filenames:
            continue

        rel_orphan_path = entry_path.relative_to(REPO_ROOT).as_posix()
        try:
            orphan_metrics = inspect_image_file(entry_path)
        except Exception:
            orphan_metrics = {"sha256": compute_sha256(entry_path)}

        unmapped_or_duplicate_assets.append(
            {
                "raw_filename": entry_path.name,
                "raw_path": rel_orphan_path,
                "status": "unmapped_orphan",
                **orphan_metrics,
                "reason": (
                    "File on disk does not match expected DOM ref pattern "
                    "imgi_{global_img_index}_{token}.png"
                ),
            }
        )

    # Final integrity assertions before returning
    mapped_shas = [str(item["sha256"]) for item in mapped_assets]
    mapped_paths = [str(item["canonical_catalog_path"]) for item in mapped_assets]
    assert len(mapped_shas) == len(set(mapped_shas)), "Duplicate SHA-256 in mapped_assets"
    assert len(mapped_paths) == len(
        set(mapped_paths)
    ), "Duplicate canonical_catalog_path in mapped_assets"

    status_counts = Counter(
        str(item["status"]) for item in unmapped_or_duplicate_assets
    )
    category_counts = Counter(str(item["category"]) for item in mapped_assets)
    intent_counts = Counter(str(item["intent"]) for item in mapped_assets)

    total_cards = len(
        [
            node
            for node in root.walk()
            if node.tag == "div" and node.has_class("product-preview-container")
        ]
    )

    return {
        "schema_version": "1.0.0",
        "source_html": HTML_PATH.relative_to(REPO_ROOT).as_posix(),
        "parser_backend": parser_backend,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "summary": {
            "total_product_cards": total_cards,
            "cards_with_images": total_cards - len(cards_without_images),
            "cards_without_images": len(cards_without_images),
            "total_dom_product_img_refs": len(dom_refs),
            "raw_png_files_matched": len(matched_raw_filenames),
            "mapped_assets_count": len(mapped_assets),
            "duplicate_sha256_count": status_counts.get("duplicate_sha256", 0),
            "missing_on_disk_count": status_counts.get("missing_on_disk", 0),
            "unmapped_orphan_count": status_counts.get("unmapped_orphan", 0),
            "by_category": dict(sorted(category_counts.items())),
            "by_intent": dict(sorted(intent_counts.items())),
        },
        "cards_without_images": cards_without_images,
        "mapped_assets": mapped_assets,
        "unmapped_or_duplicate_assets": unmapped_or_duplicate_assets,
    }


def print_report(mapping: dict[str, object]) -> None:
    """Print summary stats and warning table for duplicates, missing refs, and orphans."""
    summary = mapping["summary"]
    assert isinstance(summary, dict)
    print(f"Parser backend : {mapping['parser_backend']}")
    print(f"Product cards  : {summary['total_product_cards']} ({summary['cards_with_images']} with images, {summary['cards_without_images']} without)")
    print(f"DOM img refs   : {summary['total_dom_product_img_refs']}")
    print(f"Matched PNGs   : {summary['raw_png_files_matched']}")
    print(f"Mapped unique  : {summary['mapped_assets_count']}")
    print(f"Duplicates     : {summary['duplicate_sha256_count']}")
    print(f"Missing on disk: {summary['missing_on_disk_count']}")
    print(f"Unmapped orphan: {summary['unmapped_orphan_count']}")
    print(f"By category    : {summary['by_category']}")
    print(f"By intent      : {summary['by_intent']}")
    print()

    warnings = mapping["unmapped_or_duplicate_assets"]
    assert isinstance(warnings, list)
    print("=== WARNING TABLE: DUPLICATES / MISSING REFS / ORPHANS ===")
    print(f"{'STATUS':<18} | {'IDX':<4} | {'RAW FILENAME':<44} | {'DETAIL'}")
    print("-" * 120)
    for row in warnings:
        status = str(row.get("status", ""))
        idx = str(row.get("global_img_index", "-"))
        raw_fn = str(row.get("raw_filename", ""))
        if status == "duplicate_sha256":
            detail = f"dup of {row.get('duplicate_of_raw_path')} -> {row.get('duplicate_of_canonical_catalog_path')}"
        else:
            detail = str(row.get("reason", ""))
        print(f"{status:<18} | {idx:<4} | {raw_fn:<44} | {detail}")


def main() -> int:
    mapping = build_mapping()
    OUTPUT_PATH.write_text(
        json.dumps(mapping, indent=2) + "\n", encoding="utf-8"
    )
    print_report(mapping)
    print(f"\nWrote {OUTPUT_PATH.relative_to(REPO_ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

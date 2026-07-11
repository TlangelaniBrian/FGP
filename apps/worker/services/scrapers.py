from __future__ import annotations

import json
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any
from urllib.parse import quote_plus

import httpx


SOURCE_SEARCH_URLS = {
    "property24": "https://www.property24.com/vacant-land-for-sale?search={location}",
    "private_property": "https://www.privateproperty.co.za/vacant-land-for-sale?search={location}",
    "propdata": "https://www.propdata.net/search/?q={location}",
    "gumtree": "https://www.gumtree.co.za/s-land-plots-for-sale/{location}/v1c9117l3200000p1",
    "immo_africa": "https://www.immoafrica.net/search/?q={location}",
    "entegral": "https://www.entegral.net/search?location={location}",
}


@dataclass(frozen=True)
class SearchParams:
    source: str
    location: str
    radius_km: float = 20
    min_size_sqm: float = 300
    max_price: float = 5_000_000


class JsonLdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._inside = False
        self._buffer: list[str] = []
        self.documents: list[Any] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "script" and dict(attrs).get("type") == "application/ld+json":
            self._inside = True
            self._buffer = []

    def handle_data(self, data: str) -> None:
        if self._inside:
            self._buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._inside:
            self._inside = False
            try:
                self.documents.append(json.loads("".join(self._buffer)))
            except json.JSONDecodeError:
                pass


def _objects(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        if isinstance(value.get("itemListElement"), list):
            return [item for item in value["itemListElement"] if isinstance(item, dict)]
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def normalize_jsonld(html: str, source: str) -> list[dict[str, Any]]:
    parser = JsonLdParser()
    parser.feed(html)
    results: list[dict[str, Any]] = []
    for document in parser.documents:
        for item in _objects(document):
            item_type = item.get("@type")
            if item_type not in {"Product", "RealEstateListing", "Residence", "Offer"} and not item.get("offers"):
                continue
            address = item.get("address")
            if isinstance(address, dict):
                address = ", ".join(str(address.get(key)) for key in ("streetAddress", "addressLocality", "addressRegion") if address.get(key))
            offers = item.get("offers") if isinstance(item.get("offers"), dict) else {}
            size = item.get("floorSize")
            if isinstance(size, dict):
                size = size.get("value")
            results.append({"source": source, "address": address or item.get("name"), "price": offers.get("price") or item.get("price"), "size_sqm": size, "source_url": item.get("url"), "description": item.get("description")})
    return [item for item in results if item.get("address")]


async def scrape(params: SearchParams) -> list[dict[str, Any]]:
    template = SOURCE_SEARCH_URLS.get(params.source)
    if not template:
        raise ValueError(f"unsupported scraper source: {params.source}")
    url = template.format(location=quote_plus(params.location))
    headers = {"User-Agent": "FGP Research Bot/1.0 (+https://firstgeneration.properties)"}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=20) as client:
        response = await client.get(url)
        response.raise_for_status()
    return normalize_jsonld(response.text, params.source)

from services.scrapers import normalize_jsonld


def test_normalize_jsonld_listing():
    html = """<script type='application/ld+json'>{"@type":"Product","name":"Stand 42","address":{"addressLocality":"Midrand"},"offers":{"price":1250000},"floorSize":{"value":900},"url":"https://example.test/42"}</script>"""
    rows = normalize_jsonld(html, "property24")
    assert rows == [{"source": "property24", "address": "Midrand", "price": 1250000, "size_sqm": 900, "source_url": "https://example.test/42", "description": None}]


def test_normalize_jsonld_preserves_coordinates():
    html = """<script type='application/ld+json'>{"@type":"Product","name":"Stand 42","geo":{"latitude":-25.976,"longitude":28.13},"offers":{"price":1250000}}</script>"""
    assert normalize_jsonld(html, "property24")[0]["latitude"] == -25.976


def test_normalize_jsonld_ignores_unrelated_schema():
    assert normalize_jsonld("<script type='application/ld+json'>{\"@type\":\"Organization\",\"name\":\"Example\"}</script>", "property24") == []

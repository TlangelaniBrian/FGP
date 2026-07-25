from fastapi.testclient import TestClient

from main import app


def test_forms_generate_pdf():
    response = TestClient(app).post("/forms/generate", json={"doc_type": "zoning_certificate", "context": {"erf_number": "1247", "zone_code": "RES3"}})
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")

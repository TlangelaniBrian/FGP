from __future__ import annotations

from html import escape
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

router = APIRouter(prefix="/forms", tags=["forms"])


def fallback_pdf(title: str, context: dict[str, Any]) -> bytes:
    lines = ["First Generation Properties", title] + [f"{key}: {value}" for key, value in context.items()]
    text = "BT /F1 12 Tf 72 760 Td " + " Tj 0 -18 Td ".join(f"({str(line).replace('(', '[').replace(')', ']')})" for line in lines) + " Tj ET"
    objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", f"<< /Length {len(text.encode())} >>\nstream\n{text}\nendstream"]
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(output)); output.extend(f"{index} 0 obj\n{obj}\nendobj\n".encode())
    xref = len(output); output.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()); output.extend("".join(f"{offset:010d} 00000 n \n" for offset in offsets[1:]).encode()); output.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return bytes(output)


class FormRequest(BaseModel):
    doc_type: str = Field(..., min_length=2, max_length=80)
    context: dict[str, Any] = Field(default_factory=dict)


@router.post("/generate")
async def generate_form(body: FormRequest) -> Response:
    title = body.doc_type.replace("_", " ").title()
    try:
        from weasyprint import HTML

        rows = "".join(f"<tr><th>{escape(str(key).replace('_', ' ').title())}</th><td>{escape(str(value))}</td></tr>" for key, value in body.context.items())
        html = f"""<!doctype html><html><head><meta charset='utf-8'><style>
        @page {{ size: A4; margin: 22mm; }} body {{ font-family: sans-serif; color: #1f272e; }}
        h1 {{ color: #0033a0; font-size: 24px; }} .meta {{ color: #6d7885; font-size: 11px; margin-bottom: 24px; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 12px; }} th, td {{ padding: 9px; border-bottom: 1px solid #cfd5e0; text-align: left; }} th {{ width: 35%; background: #f0f3fa; }}
        .footer {{ margin-top: 32px; color: #6d7885; font-size: 10px; }}
        </style></head><body><h1>First Generation Properties</h1><div class='meta'>{escape(title)} · Generated working document</div><table>{rows}</table><div class='footer'>This document is generated from the FGP feasibility workspace and must be reviewed by the relevant planning professional before submission.</div></body></html>"""
        pdf = HTML(string=html).write_pdf()
    except Exception:
        pdf = fallback_pdf(title, body.context)
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={body.doc_type}.pdf"})

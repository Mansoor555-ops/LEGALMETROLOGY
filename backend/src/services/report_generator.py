import os
import logging
from typing import Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from ..config import settings

logger = logging.getLogger(__name__)

def generate_pdf_report(inspection_data: Dict[str, Any]) -> str:
    """
    Generates official Legal Metrology (Packaged Commodities) Rules 2011 Inspection PDF Report.
    """
    insp_id = inspection_data.get("id", "INSP-000000")
    pdf_filename = f"Legal_Metrology_Inspection_{insp_id}.pdf"
    pdf_path = os.path.join(settings.REPORTS_DIR, pdf_filename)

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        alignment=1
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
        alignment=1
    )

    section_header_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#0f172a")
    )

    cell_style = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0f172a")
    )

    cell_bold = ParagraphStyle(
        'CellBold',
        parent=cell_style,
        fontName='Helvetica-Bold'
    )

    elements = []

    # Header Banner
    elements.append(Paragraph("GOVERNMENT OF INDIA • DEPARTMENT OF CONSUMER AFFAIRS", title_style))
    elements.append(Paragraph("LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011 — COMPREHENSIVE FIELD AUDIT REPORT", subtitle_style))
    elements.append(Spacer(1, 12))

    # Meta Table (Inspection Context)
    status_str = inspection_data.get("overall_status", "UNKNOWN")
    meta_table_data = [
        [
            Paragraph("<b>Inspection ID:</b>", cell_bold), Paragraph(str(insp_id), cell_style),
            Paragraph("<b>Date & Time:</b>", cell_bold), Paragraph(str(inspection_data.get("timestamp", "")), cell_style)
        ],
        [
            Paragraph("<b>Establishment:</b>", cell_bold), Paragraph(str(inspection_data.get("shop_name", "N/A")), cell_style),
            Paragraph("<b>Location / GPS:</b>", cell_bold), Paragraph(str(inspection_data.get("location", "N/A")), cell_style)
        ],
        [
            Paragraph("<b>Overall Verdict:</b>", cell_bold), Paragraph(f"<b>{status_str}</b>", cell_style),
            Paragraph("<b>Commodity Category:</b>", cell_bold), Paragraph(str(inspection_data.get("category", "Packaged Food")), cell_style)
        ]
    ]

    t_meta = Table(meta_table_data, colWidths=[110, 160, 110, 160])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BORDER', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_meta)
    elements.append(Spacer(1, 10))

    # GTIN Barcode & Scanned Product Master Details Table
    prod = inspection_data.get("product_details", {})
    gtin_code = inspection_data.get("barcode_gtin") or prod.get("barcode", "NOT_SCANNED")
    prod_name = prod.get("product_name") or "General Commodity Item"
    brand_company = prod.get("brand_company") or "Registered Manufacturer / Brand"
    source_reg = prod.get("source") or "Field Inspection Ingest"

    elements.append(Paragraph("<b>SCANNED BARCODE & GTIN PRODUCT MASTER DETAILS</b>", section_header_style))
    elements.append(Spacer(1, 4))

    barcode_table_data = [
        [
            Paragraph("<b>GTIN Barcode No:</b>", cell_bold), Paragraph(str(gtin_code), cell_bold),
            Paragraph("<b>Product Name:</b>", cell_bold), Paragraph(str(prod_name), cell_style)
        ],
        [
            Paragraph("<b>Brand / Company:</b>", cell_bold), Paragraph(str(brand_company), cell_style),
            Paragraph("<b>GTIN Registry Source:</b>", cell_bold), Paragraph(str(source_reg), cell_style)
        ]
    ]

    t_barcode = Table(barcode_table_data, colWidths=[110, 160, 110, 160])
    t_barcode.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
        ('BORDER', (0,0), (-1,-1), 0.5, colors.HexColor("#bbf7d0")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_barcode)
    elements.append(Spacer(1, 10))

    # Field Compliance Table Header
    elements.append(Paragraph("<b>LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011 — MANDATORY DECLARATIONS AUDIT</b>", section_header_style))
    elements.append(Spacer(1, 5))

    fields_data = [
        [
            Paragraph("<b>Rule Declaration Field</b>", cell_bold),
            Paragraph("<b>Status</b>", cell_bold),
            Paragraph("<b>Confidence</b>", cell_bold),
            Paragraph("<b>Extracted Text</b>", cell_bold),
            Paragraph("<b>Legal Reference / Clause</b>", cell_bold)
        ]
    ]

    for f in inspection_data.get("fields", []):
        st = f.get("status", "FAIL")
        color_hex = "#15803d" if st == "PASS" else ("#b45309" if st in ["NEEDS_HUMAN_REVIEW", "NEEDS_CONTEXT"] else ("#475569" if st in ["NOT_APPLICABLE", "EXEMPT"] else "#b91c1c"))
        st_p = Paragraph(f"<font color='{color_hex}'><b>{st}</b></font>", cell_style)

        fields_data.append([
            Paragraph(str(f.get("label", f.get("field_key"))), cell_style),
            st_p,
            Paragraph(f"{float(f.get('confidence', 0.0))*100:.0f}%", cell_style),
            Paragraph(str(f.get("extracted_text", "")), cell_style),
            Paragraph(str(f.get("cited_rule_clause", f.get("legal_reference", ""))), cell_style)
        ])

    t_fields = Table(fields_data, colWidths=[125, 65, 55, 145, 150])
    t_fields.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e2e8f0")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_fields)

    # Build PDF document
    doc.build(elements)
    logger.info(f"Generated inspection PDF report at {pdf_path}")
    return pdf_path

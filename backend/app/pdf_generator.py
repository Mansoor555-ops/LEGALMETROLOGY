import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from typing import Dict, Any

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

def generate_pdf_report(inspection: Dict[str, Any]) -> str:
    """
    Generates a PDF compliance inspection certificate for the given inspection data using ReportLab.
    Returns absolute file path of generated PDF.
    """
    pdf_filename = f"Report_{inspection['id']}.pdf"
    pdf_path = os.path.join(REPORTS_DIR, pdf_filename)
    
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
        'HeaderTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#0B3D6E'),
        alignment=1
    )
    
    subtitle_style = ParagraphStyle(
        'HeaderSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        alignment=1
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0B3D6E'),
        spaceBefore=10,
        spaceAfter=6
    )
    
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0F172A')
    )
    
    story = []
    
    # Official Header
    story.append(Paragraph("MINISTRY OF CONSUMER AFFAIRS, FOOD & PUBLIC DISTRIBUTION", subtitle_style))
    story.append(Paragraph("DEPARTMENT OF CONSUMER AFFAIRS — LEGAL METROLOGY DIVISION", title_style))
    story.append(Paragraph("INSPECTION COMPLIANCE CERTIFICATE", ParagraphStyle('SubHeader', parent=subtitle_style, fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor('#1E293B'))))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0B3D6E'), spaceBefore=2, spaceAfter=12))
    
    # Inspection Info Grid Table
    overall_st = inspection.get("overall_status", "PASS")
    status_bg = colors.HexColor('#DCFCE7') if overall_st == "PASS" else (colors.HexColor('#FEE2E2') if overall_st == "FAIL" else colors.HexColor('#FEF3C7'))
    status_fg = colors.HexColor('#15803D') if overall_st == "PASS" else (colors.HexColor('#B91C1C') if overall_st == "FAIL" else colors.HexColor('#B45309'))
    
    info_data = [
        [
            Paragraph("<b>Inspection ID:</b>", body_style), Paragraph(inspection["id"], body_style),
            Paragraph("<b>Inspection Date:</b>", body_style), Paragraph(inspection.get("timestamp", ""), body_style)
        ],
        [
            Paragraph("<b>Establishment/Shop:</b>", body_style), Paragraph(inspection["shop_name"], body_style),
            Paragraph("<b>Location:</b>", body_style), Paragraph(inspection["location"], body_style)
        ],
        [
            Paragraph("<b>Product Category:</b>", body_style), Paragraph(inspection.get("category", "General"), body_style),
            Paragraph("<b>Declared Net Qty:</b>", body_style), Paragraph(inspection.get("net_quantity", "N/A"), body_style)
        ],
        [
            Paragraph("<b>Exemption Status:</b>", body_style), Paragraph("EXEMPT (Rule 3)" if inspection.get("is_exempt") else "NON-EXEMPT (Regulated)", body_style),
            Paragraph("<b>Overall Status:</b>", body_style), Paragraph(f"<b><font color='{status_fg.hexval()}'>{overall_st}</font></b>", body_style)
        ]
    ]
    
    info_table = Table(info_data, colWidths=[1.3*inch, 2.2*inch, 1.3*inch, 2.2*inch])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 14))
    
    # Declarations Table
    story.append(Paragraph("Mandatory Declarations Evaluation Summary (Rule 6)", section_heading))
    
    headers = [
        Paragraph("<b>Rule Ref</b>", body_style),
        Paragraph("<b>Mandatory Declaration</b>", body_style),
        Paragraph("<b>Status</b>", body_style),
        Paragraph("<b>Extracted Label Text</b>", body_style),
        Paragraph("<b>Conf / Panel</b>", body_style)
    ]
    
    field_rows = [headers]
    fields = inspection.get("fields", [])
    
    for f in fields:
        st = f["override_status"] if f.get("manual_override") and f.get("override_status") else f["status"]
        st_color = "#15803D" if st == "PASS" else ("#B91C1C" if st == "FAIL" else "#B45309")
        
        extracted = f.get("extracted_text", "")
        if f.get("manual_override"):
            extracted += f" <i>(Overridden: {f.get('override_note', '')})</i>"
            
        conf_pct = f"{int(f.get('confidence', 0)*100)}%"
        panel = f.get("source_panel", "front").upper()
        
        field_rows.append([
            Paragraph(f.get("legal_reference", ""), body_style),
            Paragraph(f.get("label", ""), body_style),
            Paragraph(f"<b><font color='{st_color}'>{st}</font></b>", body_style),
            Paragraph(extracted, body_style),
            Paragraph(f"{conf_pct}<br/><font color='#64748B'>{panel}</font>", body_style)
        ])
        
    if not fields:
        field_rows.append([
            Paragraph("N/A", body_style),
            Paragraph("Commodity Exempt under Rule 3 provisions.", body_style),
            Paragraph("EXEMPT", body_style),
            Paragraph(inspection.get("exemption_reason", "Out of scope"), body_style),
            Paragraph("-", body_style)
        ])
        
    field_table = Table(field_rows, colWidths=[1.1*inch, 1.6*inch, 1.0*inch, 2.3*inch, 1.0*inch])
    field_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0B3D6E')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(field_table)
    story.append(Spacer(1, 14))
    
    # Officer Notes
    story.append(Paragraph("Enforcement Officer Inspection Remarks", section_heading))
    notes_text = inspection.get("officer_notes", "") or "No additional remarks noted."
    story.append(Paragraph(notes_text, body_style))
    story.append(Spacer(1, 20))
    
    # Signature Footer
    sig_data = [
        [Paragraph("<b>Enforcement Officer Signature:</b>", body_style), Paragraph("<b>Official Stamp / Seal:</b>", body_style)],
        [Paragraph("_______________________________<br/>Inspectors ID: LM-OFFICER-409", body_style), Paragraph("[ DIGITAL VERIFIED ]<br/>Legal Metrology Department", body_style)]
    ]
    sig_table = Table(sig_data, colWidths=[3.5*inch, 3.5*inch])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(sig_table)
    
    doc.build(story)
    return pdf_path

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.graphics.shapes import Drawing, Rect, String, Line

def create_pdf():
    doc = SimpleDocTemplate("economy_architecture.pdf", pagesize=letter)
    styles = getSampleStyleSheet()
    
    elements = [Paragraph("OyeTalk / Live Streaming Economy Architecture", styles["Title"])]

    d = Drawing(700, 350)

    # Boxes
    boxes = [
        (20, 250, "Coin Seller"),
        (150, 250, "User Wallet\n(Coins)"),
        (280, 250, "Gift Engine"),
        (410, 250, "Bean Converter"),
        (540, 250, "Host Wallet\n(Beans)"),
        (540, 120, "Payout Engine"),
        (350, 120, "Agency Wallet"),
        (150, 120, "Platform Revenue"),
    ]

    for x, y, t in boxes:
        d.add(Rect(x, y, 110, 50, strokeWidth=1, fillColor=None))
        for i, line in enumerate(t.split("\n")):
            d.add(String(x+10, y+30-(i*14), line))

    # Arrows
    arrows = [
        (130, 275, 150, 275),
        (260, 275, 280, 275),
        (390, 275, 410, 275),
        (520, 275, 540, 275),
        (595, 250, 595, 170),
        (540, 145, 460, 145),
        (350, 145, 260, 145),
    ]
    for x1, y1, x2, y2 in arrows:
        d.add(Line(x1, y1, x2, y2))

    elements += [d, Spacer(1, 20)]

    elements.append(Paragraph("Database Tables (Suggested)", styles["Heading2"]))
    elements.append(Paragraph("""
    Users(id, name, role, coin_balance, bean_balance)<br/>
    Gifts(gift_id, gift_name, coin_price, bean_value)<br/>
    Transactions(txn_id, sender_id, receiver_id, gift_id, coins_spent, beans_earned)<br/>
    Agencies(agency_id, agency_name, commission_percentage)<br/>
    Withdrawals(withdrawal_id, host_id, beans, amount, status)
    """, styles["BodyText"]))

    elements.append(Spacer(1, 10))
    elements.append(Paragraph("Wallet Architecture", styles["Heading2"]))
    elements.append(Paragraph("""
    1. User Wallet -> Stores Coins<br/>
    2. Host Wallet -> Stores Beans<br/>
    3. Agency Wallet -> Stores Commission<br/>
    4. Platform Wallet -> Stores Margin / Revenue
    """, styles["BodyText"]))

    doc.build(elements)

if __name__ == "__main__":
    create_pdf()

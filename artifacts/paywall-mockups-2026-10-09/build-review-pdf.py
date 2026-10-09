"""Package the native vector Figma export with a review cover and screen index."""
from pathlib import Path
import json
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[2]
ART = Path(__file__).resolve().parent
TMP = ROOT / 'tmp/pdfs/review'
OUT = ROOT / 'output/pdf/luvani-vibrant-app-and-paywalls-review.pdf'
for weight in ['Regular', 'Medium', 'Bold', 'ExtraBold']:
    pdfmetrics.registerFont(TTFont('Outfit-' + weight, str(ROOT / f'apps/mobile/assets/fonts/Outfit-{weight}.ttf')))
W, H = 595.28, 841.89
INK, PAPER, BLUE = '#16123A', '#FFF6E9', '#3B2FE0'
body = ParagraphStyle('body', fontName='Outfit-Regular', fontSize=11, leading=16, textColor=HexColor(INK))
c = canvas.Canvas(str(TMP / 'review-front-matter.pdf'), pagesize=(W,H))
def start(title, sub):
    c.setFillColor(HexColor(PAPER)); c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(HexColor(INK)); c.setFont('Outfit-ExtraBold',30); c.drawString(40,H-65,title)
    c.setFont('Outfit-Regular',11); c.drawString(40,H-91,sub)
def para(text, y, width=W-80):
    p=Paragraph(text,body); _, h=p.wrap(width,H); p.drawOn(c,40,y-h); return y-h-14
def footer(number):
    c.setFillColor(HexColor(INK)); c.setFont('Outfit-Regular',9)
    c.drawString(40,28,'Luvani · UI design review · 9 October 2026'); c.drawRightString(W-40,28,str(number))
    c.showPage()

start('Luvani, turned up.','Complete app UI · 130 state screens · six playable journeys')
c.drawImage(str(ART/'luvani-app-review.png'),40,168,width=W-80,height=545,preserveAspectRatio=True,anchor='c',mask='auto')
y=153
y=para('Open the editable Figma file for motion, connected journeys and the device-size checks. This PDF preserves the native vector screen export.',y)
url='https://www.figma.com/design/cJ79urCrmiQEm7MgQnoG3D?node-id=44-1481'
c.setFillColor(HexColor(BLUE)); c.setFont('Outfit-Medium',12); c.drawString(40,77,'Open Luvani in Figma ↗'); c.linkURL(url,(40,73,240,93),relative=0)
footer(1)

start('Ready to review.','Scope, layout rules and production handoffs')
y=H-128
for label, value in [
 ('What changed', 'Outfit typography, indigo, coral, sunshine and mint backgrounds; editable French scene illustrations; less repeated copy; one clear primary action; all material plan facts together at default text size.'),
 ('How to explore', 'In Figma, open “Play the app · 130 screens” and press Present. Start with onboarding, every tab, live tutor, plan selection, payment recovery or subscription management. Settings and Friends are reached through the profile entry.'),
 ('Responsive structure', 'Layouts follow available width, safe areas, font scale and rotation. The 375 × 812 examples fit Home, Practice, Settings and the complete trial decision without scrolling at default text size. Larger text and landscape use scrollable body and action regions. Artwork compresses first; words stay readable.'),
 ('Motion', 'Short artwork entrances and a restrained live voice pulse. The separate Reduced Motion example stays still. Production audio-driven motion must follow the actual voice state, and all movement respects the existing reduced-motion preference.'),
 ('Code delivered', 'Shared safe-area geometry, bounded scrollable footers, proportional illustration sizing, fewer repeated tab subtitles and a simpler selected-plan view. Local store prices and the selected billing period remain authoritative. Mobile TypeScript and all 2,600 mobile tests pass.'),
 ('Fixture boundary', 'Prices, dates, balances, identities and earned results are design samples. The report’s weekly product, annual 45-minute trial and notification paths remain proposals. The current native catalogue uses Starter and Max with monthly/yearly products; no research prices or new products were injected into billing.'),
 ('Native handoffs', 'Store purchase confirmation, verified entitlements, real audio, authentication, reminder permissions/scheduling, sharing and account actions require their production integrations. The prototype executes no financial or destructive action. Physical iPhone and assistive-technology testing is still needed for release acceptance.')
]:
    c.setFillColor(HexColor(INK)); c.setFont('Outfit-Bold',12); c.drawString(40,y,label); y-=9
    y=para(value,y)
footer(2)

source=json.loads((ART/'prototype-source.json').read_text())['frames']
app={s['key']:s for s in json.loads((ART/'app-screens.json').read_text())}
wall={s['key']:s for s in json.loads((ART/'screens.json').read_text())}
items=[]
for s in source:
    data=app.get(s['key']) or wall[s['key']]
    items.append((s['key'],data['group'],data.get('title') or data['name']))
# Four index pages, with both the PDF page and the editable Figma key.
for offset in range(0,len(items),34):
    start('Screen index.',f'{offset+1}–{min(offset+34,len(items))} of {len(items)} · PDF page / Figma key / screen')
    y=H-120
    for i,(key,group,title) in enumerate(items[offset:offset+34],offset):
        c.setFillColor(HexColor(INK)); c.setFont('Outfit-Medium',9)
        c.drawString(40,y,str(i+7).zfill(3)); c.drawString(74,y,key)
        c.setFont('Outfit-Regular',8.6)
        p=Paragraph(title,ParagraphStyle('index',fontName='Outfit-Regular',fontSize=8.6,leading=10,textColor=HexColor(INK)))
        _,h=p.wrap(270,24);p.drawOn(c,282,y-h+8.6)
        y-=19
    footer(3+offset//34)
c.save()

front=PdfReader(str(TMP/'review-front-matter.pdf'))
native=PdfReader(str(TMP/'figma-native-screens.pdf'))
assert len(front.pages)==6 and len(native.pages)==130
writer=PdfWriter(); writer.append(front); writer.append(native)
writer.add_metadata({'/Title':'Luvani · Vibrant app & paywalls','/Author':'Luvani','/Subject':'UI design review, responsive structure and native Figma screen export'})
writer.add_outline_item('Review and implementation boundary',0)
writer.add_outline_item('Screen index',2)
current=None; parent=None
for i,(key,group,title) in enumerate(items):
    if current!=group:
        current=group;parent=writer.add_outline_item(group,6+i)
    writer.add_outline_item(key+' · '+title,6+i,parent=parent)
OUT.parent.mkdir(parents=True,exist_ok=True)
with OUT.open('wb') as stream:writer.write(stream)
check=PdfReader(str(OUT));assert len(check.pages)==136
print(OUT, 'pages=',len(check.pages),'bytes=',OUT.stat().st_size)

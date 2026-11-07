import sys, random
from PIL import Image, ImageDraw
SCR=sys.argv[1]; OUT=sys.argv[2]; T=48
I=Image.open(f"{SCR}/mi/Modern tiles_Free/Interiors_free/48x48/Interiors_free_48x48.png").convert("RGBA")
C=Image.open(f"{SCR}/cs/CoolSchool_tileset_48px/CoolSchool_tileset.png").convert("RGBA")
def cr(src,c,r,w=1,h=1): return src.crop((c*T,r*T,(c+w)*T,(r+h)*T))
def trim(im): return im.crop(im.getbbox())
KINDS=["shelf","books","water","door","locker","toy","plane","chalk","tissue","balls"]
sheet=Image.new("RGBA",(96*len(KINDS),96),(0,0,0,0))
OL=(58,58,80,255)
def cell(i): return Image.new("RGBA",(96,96),(0,0,0,0))
rnd=random.Random(3)
# 1 책장 쓰러뜨리기
c=cell(0); fallen=trim(cr(I,8,58,2,2)); c.alpha_composite(fallen,(48-fallen.width//2,52-fallen.height//2))
for k,(x,y) in zip([cr(C,0,11),cr(C,4,11),cr(C,1,11)],[(2,50),(58,58),(30,64)]): c.alpha_composite(trim(k),(x,y))
sheet.alpha_composite(c,(0,0))
# 2 책 흩뜨리기
c=cell(1); p=trim(cr(I,13,28,2,2)); c.alpha_composite(p,(10,20))
for k,(x,y) in zip([cr(C,3,11),cr(C,4,11),cr(C,0,11),cr(C,6,11)],[(50,10),(54,56),(4,58),(40,40)]): c.alpha_composite(trim(k),(x,y))
sheet.alpha_composite(c,(96,0))
# 3 수도꼭지 물
c=cell(2); d=ImageDraw.Draw(c)
d.ellipse((6,30,90,88),fill=(120,190,240,200),outline=(70,130,200,230),width=3)
d.ellipse((2,50,40,82),fill=(120,190,240,200)); d.ellipse((50,20,86,52),fill=(120,190,240,200))
for (x,y) in [(24,46),(60,60),(40,70),(66,36)]: d.ellipse((x,y,x+10,y+5),fill=(230,248,255,230))
for (x,y) in [(14,14),(46,6),(80,12)]: d.polygon([(x,y),(x-4,y+9),(x+4,y+9)],fill=(120,190,240,255)); d.ellipse((x-4,y+5,x+4,y+13),fill=(120,190,240,255),outline=(70,130,200,255))
sheet.alpha_composite(c,(192,0))
# 4 문 잠그기 (테이프 + 자물쇠)
c=cell(3); d=ImageDraw.Draw(c)
for y0 in (20,56):
  d.polygon([(0,y0),(96,y0-10),(96,y0+4),(0,y0+14)],fill=(250,214,60,255),outline=OL)
  for k in range(0,96,16): d.polygon([(k,y0-k/96*10),(k+8,y0-(k+8)/96*10),(k+8,y0+14-(k+8)/96*10),(k,y0+14-k/96*10)],fill=(40,40,50,255))
d.rounded_rectangle((32,40,64,72),5,fill=(214,160,50,255),outline=OL,width=3)
d.arc((36,22,60,50),180,360,fill=OL,width=6); d.arc((36,22,60,50),180,360,fill=(170,170,190,255),width=3)
d.ellipse((44,50,52,58),fill=OL); d.rectangle((47,56,49,64),fill=OL)
sheet.alpha_composite(c,(288,0))
# 5 사물함 털기
c=cell(4); p=trim(cr(I,13,28,2,2)); c.alpha_composite(p,(30,40))
for k,(x,y) in zip([cr(C,5,11),cr(C,2,11),cr(C,6,11),cr(C,1,11)],[(4,48),(60,24),(10,10),(66,66)]): c.alpha_composite(trim(k),(x,y))
d=ImageDraw.Draw(c); d.rounded_rectangle((40,8,58,30),3,fill=(230,80,80,255),outline=OL,width=2)  # 실내화
d.rounded_rectangle((60,6,78,28),3,fill=(230,80,80,255),outline=OL,width=2)
sheet.alpha_composite(c,(384,0))
# 6 장난감 상자 털기
c=cell(5); d=ImageDraw.Draw(c)
box=trim(cr(I,11,11)).rotate(25,expand=True); c.alpha_composite(box,(54,4))
cols=[(230,80,80),(80,150,230),(250,200,60),(90,190,100),(200,110,220)]
for i in range(9):
  x=rnd.randint(4,74); y=rnd.randint(30,78); col=cols[i%5]+(255,)
  if i%3==0: d.ellipse((x,y,x+14,y+14),fill=col,outline=OL,width=2)
  elif i%3==1: d.rectangle((x,y,x+12,y+12),fill=col,outline=OL,width=2); d.ellipse((x+4,y+4,x+8,y+8),fill=(255,255,255,200))
  else: d.polygon([(x,y+14),(x+7,y),(x+14,y+14)],fill=col,outline=OL)
sheet.alpha_composite(c,(480,0))
# 7 종이비행기
c=cell(6)
for (cc,rr),(x,y) in zip([(12,74),(14,74),(11,76),(13,76),(12,78),(14,76)],[(0,0),(48,6),(10,44),(52,48),(28,24),(60,74)]):
  pl=trim(cr(I,cc,rr)); c.alpha_composite(pl,(min(x,96-pl.width),min(y,96-pl.height)))
sheet.alpha_composite(c,(576,0))
# 8 칠판 분필 가루
c=cell(7); d=ImageDraw.Draw(c)
for i in range(26):
  x=rnd.randint(4,80); y=rnd.randint(4,80); r=rnd.randint(6,16)
  d.ellipse((x,y,x+r,y+r),fill=(250,250,250,rnd.randint(150,220)))
for i in range(5):
  x=rnd.randint(10,80); y=rnd.randint(50,85); d.rectangle((x,y,x+12,y+4),fill=(255,255,255,255),outline=(170,170,190,255))
sheet.alpha_composite(c,(672,0))
# 9 휴지 풀어 놓기
c=cell(8); d=ImageDraw.Draw(c)
for (x,y,w) in [(6,40,80),(20,60,64),(10,22,50)]:
  d.line([(x,y),(x+w*0.3,y+8),(x+w*0.6,y-4),(x+w,y+6)],fill=(250,250,250,255),width=9); d.line([(x,y),(x+w*0.3,y+8),(x+w*0.6,y-4),(x+w,y+6)],fill=(210,210,225,255),width=2)
d.ellipse((60,58,86,84),fill=(255,255,255,255),outline=OL,width=2); d.ellipse((68,66,78,76),fill=(200,200,215,255))
sheet.alpha_composite(c,(768,0))
# 10 공 바구니 쏟기
c=cell(9); d=ImageDraw.Draw(c)
for (x,y,col) in [(6,50,(240,130,50)),(30,62,(250,250,250)),(56,48,(230,70,70)),(70,70,(80,150,230)),(18,20,(240,130,50)),(46,24,(250,220,80)),(64,10,(250,250,250))]:
  d.ellipse((x,y,x+20,y+20),fill=col+(255,),outline=OL,width=2); d.arc((x+3,y+3,x+17,y+17),200,320,fill=(255,255,255,180),width=2)
sheet.alpha_composite(c,(864,0))
NEW=Image
for i,f in ((2,"water_puddle"),(3,"door_lock_tape"),(7,"chalk_dust")):
  sheet.paste((0,0,0,0),(i*96,0,i*96+96,96)); sheet.alpha_composite(Image.open(f"{SCR}/sp/effects/{f}.png").convert("RGBA"),(i*96,0))
import os
for i,k in enumerate(KINDS):
  f=f"{SCR}/extra/effects/{k}.png"
  if os.path.exists(f): sheet.paste((0,0,0,0),(i*96,0,i*96+96,96)); sheet.alpha_composite(Image.open(f).convert("RGBA").resize((96,96)),(i*96,0))
sheet.save(f"{OUT}/mess.png")
Image.open(f"{SCR}/sp/school/classroom_door_closed.png").convert("RGBA").save(f"{OUT}/door_closed.png")
# 아이콘 미리보기
prev=Image.new("RGBA",sheet.size,(200,170,110,255)); prev.alpha_composite(sheet); prev.resize((sheet.width*2,192),Image.NEAREST).save(f"{SCR}/grid/messprev.png")

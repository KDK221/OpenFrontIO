"""Apply the reviewed northern crop and east-sea geographical annotations.

Edits numeric terrain input, not artwork. Original 1088-column terrain south
of row 165 is preserved. The east-sea inset extends the canvas only; island
pins are cartographic annotations, not new AI cities or enlarged conquerable
territories. Coordinates use an approximate affine fit to the existing Seoul
and Gyeongju city positions. No existing city coordinates are rescaled.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[2]
folder=root/'map-generator/assets/maps/samguk'
a=np.array(Image.open(folder/'image.png').convert('RGBA'))
h=a.shape[0]; w=1344
out=np.zeros((h,w,4),dtype=np.uint8);out[:,:,3]=255
out[:,:min(a.shape[1],w)]=a[:,:w]
# User red line registered at 0.70 screen pixels / map tile, y origin ~140.
xs=np.array([0,110,200,320,470,650,760,890,1000,1088,1344])
ys=np.array([145,142,150,154,160,160,150,150,146,148,148])
border=np.interp(np.arange(w),xs,ys)
mask=np.arange(h)[:,None]<border[None,:]
out[mask]=[0,0,0,255]
# A bounded sea extension, rather than invented northern/southern coastline.
out[950:1550,1088:]=[0,0,106,255]
Image.fromarray(out).save(folder/'image.png')
info=json.loads((folder/'info.json').read_text())
for n in info['nations']:
 if n['name']=='Geumgwan':n['coordinates']=[610,1730]
 if n['name']=='BalhaeNorth':n['coordinates']=[580,230]
 if n['name']=='BalhaeEast':n['coordinates']=[960,230]
 # Keep all northern support cities safely below the new boundary.
 if n['flag']=='Balhae' and n['coordinates'][1]<200:n['coordinates'][1]=230
info['layers']=[{'id':'island-labels','placement':'water','nukeable':False,'alpha':1}]
(folder/'info.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n')
layer=Image.new('RGBA',(w,h));d=ImageDraw.Draw(layer)
f=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',24)
# Ulleungdo approx 130.90E,37.50N; Dokdo 131.86956E,37.24078N.
# See airport.co.kr/nUlleungdo and mof.go.kr document 20937.
for name,lon,lat in [('울릉도',130.90,37.50),('독도',131.86956,37.24078)]:
 x=round(486+(lon-126.978)*164.3);y=round(1242-(lat-37.566)*198.83)
 d.ellipse((x-4,y-4,x+4,y+4),fill='#eee4b2',outline='#283a4a',width=1)
 d.text((x,y+15),name,font=f,anchor='mt',fill='#ffffff',stroke_width=2,stroke_fill='#20384e')
 print(name,x,y)
layer.save(folder/'island-labels.png')
print('North cut; Gaya relocated; island annotations written.')

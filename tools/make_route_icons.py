#!/usr/bin/env python3
"""Generate the approved neutral route tiles and arrowhead-size glyph.
Stdlib only. Run python3 tools/make_route_icons.py [--sheet /path/contact.png].
Route line geometry matches the panel design mock's 24x24 SVG coordinates.
"""
import base64
from pathlib import Path
import sys
from make_icons import write_png, seg_dist, sd_round_box

WIDTH, HEIGHT, SUPER = 42, 26, 4
PALETTES = {
    'normal': ((38,38,38),(69,69,69),(190,190,190)),
    'hover': ((56,56,56),(136,136,136),(220,220,220)),
    'selected': ((74,74,74),(196,196,196),(235,235,235)),
}
PATHS = {
    'Straight': [[(2,20),(21,3)],[(14,3),(21,3),(21,10)]],
    'Orthogonal': [[(2,20),(11,20),(11,4),(21,4)],[(16,0),(21,4),(16,8)]],
}

def render(route,state):
    bg,border,glyph=PALETTES[state]
    paths=[[(6.5+x*29/24,3+y*20/24) for x,y in line] for line in PATHS[route]]
    rows=[]
    for y in range(HEIGHT):
        row=bytearray()
        for x in range(WIDTH):
            sums=[0,0,0,0]
            for sy in range(SUPER):
                for sx in range(SUPER):
                    px,py=x+(sx+.5)/SUPER,y+(sy+.5)/SUPER
                    distance=sd_round_box(px,py,WIDTH/2,HEIGHT/2,WIDTH/2,HEIGHT/2,3)
                    color=(0,0,0,0) if distance>0 else (*border,255) if distance>-1 else (*bg,255)
                    if distance<0 and any(seg_dist(px,py,*a,*b)<.75 for line in paths for a,b in zip(line,line[1:])):
                        color=(*glyph,255)
                    for i,c in enumerate(color):sums[i]+=c
            row.extend(round(c/(SUPER*SUPER)) for c in sums)
        rows.append(bytes(row))
    return rows

def head():
    points=[(3,2),(12,7),(3,12),(3,2)]
    rows=[]
    for y in range(14):
        row=bytearray()
        for x in range(14):
            count=sum(any(seg_dist(x+(sx+.5)/SUPER,y+(sy+.5)/SUPER,*a,*b)<.65 for a,b in zip(points,points[1:])) for sy in range(SUPER) for sx in range(SUPER))
            row.extend((195,195,195,round(255*count/(SUPER*SUPER))))
        rows.append(bytes(row))
    return rows

def main():
    jsx=Path(__file__).resolve().parent.parent/'FlowDiagram.jsx'
    entries=[];tiles=[]
    for state in PALETTES:
        for route in PATHS:
            rows=render(route,state);tiles.append(rows)
            entries.append('        "'+route+'_'+state+'": "'+base64.b64encode(write_png(rows,WIDTH,HEIGHT)).decode()+'"')
    glyph=head()
    data='    var ROUTE_ICON_B64 = {\n'+',\n'.join(entries)+'\n    };\n'
    data+='    var HEAD_SIZE_ICON_B64 = "'+base64.b64encode(write_png(glyph,14,14)).decode()+'";\n'
    source=jsx.read_text();begin='/*__ROUTE_ICON_DATA_BEGIN__*/';end='/*__ROUTE_ICON_DATA_END__*/'
    before,rest=source.split(begin,1);_,after=rest.split(end,1)
    jsx.write_text(before+begin+'\n'+data+'    '+end+after)
    if '--sheet' in sys.argv:
        # Three state rows, two route columns, and the arrowhead glyph at right.
        w,h=116,94;pixels=[[ (29,29,29,255) for _ in range(w)] for _ in range(h)]
        for i,rows in enumerate(tiles):
            ox,oy=4+(i%2)*46,4+(i//2)*30
            for y,row in enumerate(rows):
                for x in range(WIDTH):
                    rgba=tuple(row[x*4:x*4+4]);a=rgba[3]/255
                    pixels[oy+y][ox+x]=tuple(round(rgba[c]*a+29*(1-a)) for c in range(3))+(255,)
        for y,row in enumerate(glyph):
            for x in range(14):
                r,g,b,a=row[x*4:x*4+4];alpha=a/255
                pixels[y+5][x+98]=tuple(round(c*alpha+29*(1-alpha)) for c in (r,g,b))+(255,)
        scale=5;rows=[]
        for line in pixels:
            row=b''.join(bytes(pixel)*scale for pixel in line)
            rows.extend([row]*scale)
        Path(sys.argv[sys.argv.index('--sheet')+1]).write_bytes(write_png(rows,w*scale,h*scale))
    print('Generated six route tiles and the arrowhead-size glyph.')
if __name__=='__main__':main()

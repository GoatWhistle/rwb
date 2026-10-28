import re
import shutil
import sys
import zipfile
from pathlib import Path

from lxml import etree

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}
P = "{%s}" % NS["p"]

WIPE = {"wiperight": ("right", 8), "wipeleft": ("left", 2), "wipeup": ("up", 4), "wipedown": ("down", 1)}


class Ids:
    def __init__(self) -> None:
        self.n = 2

    def next(self) -> int:
        self.n += 1
        return self.n


def tgt(spid: str) -> str:
    return f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'


def visible(ids: Ids, spid: str) -> str:
    return (
        f'<p:set><p:cBhvr><p:cTn id="{ids.next()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
        f'{tgt(spid)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
    )


def effect(ids: Ids, spid: str, flt: str, dur: int) -> str:
    return f'<p:animEffect transition="in" filter="{flt}"><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}"/>{tgt(spid)}</p:cBhvr></p:animEffect>'


def prop(ids: Ids, spid: str, attr: str, start: str, end: str, dur: int) -> str:
    return (
        f'<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="{ids.next()}" dur="{dur}" fill="hold" decel="100000"/>'
        f"{tgt(spid)}<p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr>"
        f'<p:tavLst><p:tav tm="0"><p:val><p:strVal val="{start}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="{end}"/></p:val></p:tav></p:tavLst></p:anim>'
    )


def behaviours(ids: Ids, spid: str, kind: str, dur: int) -> tuple[int, int, str]:
    body = visible(ids, spid)
    if kind == "fade":
        return 10, 0, body + effect(ids, spid, "fade", dur)
    if kind == "rise":
        return 42, 0, body + effect(ids, spid, "fade", dur) + prop(ids, spid, "ppt_y", "#ppt_y+0.035", "#ppt_y", dur)
    if kind == "drop":
        return 2, 1, body + effect(ids, spid, "fade", dur) + prop(ids, spid, "ppt_y", "#ppt_y-0.22", "#ppt_y", dur)
    if kind == "zoom":
        return 53, 16, body + prop(ids, spid, "ppt_w", "0", "#ppt_w", dur) + prop(ids, spid, "ppt_h", "0", "#ppt_h", dur) + effect(ids, spid, "fade", dur)
    if kind in WIPE:
        direction, sub = WIPE[kind]
        return 22, sub, body + effect(ids, spid, f"wipe({direction})", dur)
    if kind.startswith("fly_"):
        _, dx, dy = kind.split("_")
        return 2, 4, body + effect(ids, spid, "fade", int(dur * 0.6)) + prop(ids, spid, "ppt_x", f"#ppt_x+{dx}", "#ppt_x", dur) + prop(ids, spid, "ppt_y", f"#ppt_y+{dy}", "#ppt_y", dur)
    raise ValueError(kind)


def timing(items: list[tuple[str, str, int, int, bool]]) -> str:
    ids = Ids()
    pars = []
    for spid, kind, delay, dur, _ in sorted(items, key=lambda it: it[2]):
        pid = ids.next()
        preset, sub, body = behaviours(ids, spid, kind, dur)
        pars.append(
            f'<p:par><p:cTn id="{pid}" presetID="{preset}" presetClass="entr" presetSubtype="{sub}" fill="hold" grpId="0" nodeType="withEffect">'
            f'<p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>'
        )
    builds = "".join(f'<p:bldP spid="{spid}" grpId="0" animBg="1"/>' for spid, _, _, _, is_sp in items if is_sp)
    return (
        f'<p:timing xmlns:p="{NS["p"]}"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        f'<p:par><p:cTn id="{ids.next()}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
        f'<p:par><p:cTn id="{ids.next()}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{"".join(pars)}</p:childTnLst></p:cTn></p:par>'
        "</p:childTnLst></p:cTn></p:par>"
        '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
        f"</p:childTnLst></p:cTn></p:par></p:tnLst>{f'<p:bldLst>{builds}</p:bldLst>' if builds else ''}</p:timing>"
    )


TRANSITION = f'<p:transition xmlns:p="{NS["p"]}" spd="med"><p:fade/></p:transition>'


def process(xml: bytes) -> bytes:
    root = etree.fromstring(xml)
    items = []
    for c in root.iter(P + "cNvPr"):
        m = re.match(r"fx:([\w.\-]+):(\d+):(\d+):", c.get("name", ""))
        if not m:
            continue
        owner = c.getparent().getparent()
        items.append((c.get("id"), m.group(1), int(m.group(2)), int(m.group(3)), etree.QName(owner).localname == "sp"))
    for old in root.findall(P + "transition") + root.findall(P + "timing"):
        root.remove(old)
    anchor = root.find(P + "clrMapOvr")
    index = list(root).index(anchor) + 1 if anchor is not None else len(root)
    root.insert(index, etree.fromstring(TRANSITION))
    if items:
        root.insert(index + 1, etree.fromstring(timing(items)))
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def main(src: str, dst: str) -> None:
    tmp = Path(dst).with_suffix(".tmp")
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if re.fullmatch(r"ppt/slides/slide\d+\.xml", info.filename):
                data = process(data)
            zout.writestr(info, data)
    shutil.move(tmp, dst)
    print(dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

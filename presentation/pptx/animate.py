import json
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
LOOPS = {"hover", "pulse", "runner", "breathe"}


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


def keys(ids: Ids, spid: str, attr: str, frames: list[tuple[int, str]], dur: int, decel: bool = True) -> str:
    tav = "".join(f'<p:tav tm="{tm}"><p:val><p:strVal val="{val}"/></p:val></p:tav>' for tm, val in frames)
    ease = ' decel="100000"' if decel else ""
    return (
        f'<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="{ids.next()}" dur="{dur}" fill="hold"{ease}/>'
        f"{tgt(spid)}<p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst>{tav}</p:tavLst></p:anim>"
    )


def motion(ids: Ids, spid: str, path: str, dur: int, repeat: bool = False, decel: bool = True) -> str:
    extra = ' repeatCount="indefinite"' if repeat else ""
    ease = ' decel="100000"' if decel and not repeat else ""
    return (
        f'<p:animMotion origin="layout" path="{path}" pathEditMode="relative" ptsTypes=""><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}" fill="hold"{extra}{ease}/>'
        f"{tgt(spid)}<p:attrNameLst><p:attrName>ppt_x</p:attrName><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr></p:animMotion>"
    )


def entrance(ids: Ids, spid: str, kind: str, dur: int) -> tuple[int, int, str]:
    body = visible(ids, spid)
    if kind == "fade":
        return 10, 0, body + effect(ids, spid, "fade", dur)
    if kind == "rise":
        return 42, 0, body + effect(ids, spid, "fade", dur) + keys(ids, spid, "ppt_y", [(0, "#ppt_y+0.04"), (100000, "#ppt_y")], dur)
    if kind == "drop":
        return 2, 1, body + effect(ids, spid, "fade", int(dur * 0.5)) + keys(ids, spid, "ppt_y", [(0, "#ppt_y-0.28"), (70000, "#ppt_y+0.008"), (100000, "#ppt_y")], dur)
    if kind == "slam":
        return 2, 1, body + effect(ids, spid, "fade", int(dur * 0.4)) + keys(ids, spid, "ppt_y", [(0, "#ppt_y-0.16"), (75000, "#ppt_y+0.006"), (100000, "#ppt_y")], dur)
    if kind == "zoom":
        return 53, 16, body + keys(ids, spid, "ppt_w", [(0, "0"), (100000, "#ppt_w")], dur) + keys(ids, spid, "ppt_h", [(0, "0"), (100000, "#ppt_h")], dur) + effect(ids, spid, "fade", dur)
    if kind == "pop":
        w = [(0, "0"), (62000, "#ppt_w*1.14"), (82000, "#ppt_w*0.97"), (100000, "#ppt_w")]
        h = [(0, "0"), (62000, "#ppt_h*1.14"), (82000, "#ppt_h*0.97"), (100000, "#ppt_h")]
        return 53, 16, body + keys(ids, spid, "ppt_w", w, dur, False) + keys(ids, spid, "ppt_h", h, dur, False) + effect(ids, spid, "fade", int(dur * 0.4))
    if kind == "grow":
        h = [(0, "0"), (70000, "#ppt_h*1.07"), (100000, "#ppt_h")]
        y = [(0, "#ppt_y+#ppt_h/2"), (70000, "#ppt_y-#ppt_h*0.035"), (100000, "#ppt_y")]
        return 53, 16, body + keys(ids, spid, "ppt_h", h, dur, False) + keys(ids, spid, "ppt_y", y, dur, False)
    if kind in ("growx", "growxr"):
        sign = "-" if kind == "growx" else "+"
        w = [(0, "0"), (72000, "#ppt_w*1.04"), (100000, "#ppt_w")]
        x = [(0, f"#ppt_x{sign}#ppt_w/2"), (72000, f"#ppt_x{'+' if sign == '-' else '-'}#ppt_w*0.02"), (100000, "#ppt_x")]
        return 53, 16, body + keys(ids, spid, "ppt_w", w, dur, False) + keys(ids, spid, "ppt_x", x, dur, False)
    if kind in ("slidel", "slider"):
        start = "#ppt_x-0.06" if kind == "slidel" else "#ppt_x+0.06"
        return 2, 8 if kind == "slidel" else 2, body + effect(ids, spid, "fade", dur) + keys(ids, spid, "ppt_x", [(0, start), (100000, "#ppt_x")], dur)
    if kind in WIPE:
        direction, sub = WIPE[kind]
        return 22, sub, body + effect(ids, spid, f"wipe({direction})", dur)
    if kind.startswith("curve_"):
        _, dx, dy = kind.split("_")
        dx, dy = float(dx), float(dy)
        path = f"M {dx:.4f} {dy:.4f} C {dx * 0.2:.4f} {dy * 1.1:.4f} {dx * 0.05:.4f} {dy * 0.3:.4f} 0 0 E"
        spin = f'<p:animRot by="{int(-5400000 if dx > 0 else 5400000)}"><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}" fill="hold" decel="100000"/>{tgt(spid)}<p:attrNameLst><p:attrName>r</p:attrName></p:attrNameLst></p:cBhvr></p:animRot>'
        return 2, 4, body + effect(ids, spid, "fade", int(dur * 0.45)) + motion(ids, spid, path, dur) + spin
    if kind.startswith("fly_"):
        _, dx, dy = kind.split("_")
        return 2, 4, body + effect(ids, spid, "fade", int(dur * 0.6)) + keys(ids, spid, "ppt_x", [(0, f"#ppt_x+{dx}"), (100000, "#ppt_x")], dur) + keys(ids, spid, "ppt_y", [(0, f"#ppt_y+{dy}"), (100000, "#ppt_y")], dur)
    raise ValueError(kind)


def loop(ids: Ids, spid: str, kind: str, dur: int, path: str | None) -> tuple[int, int, str]:
    if kind == "hover":
        return 0, 0, motion(ids, spid, "M 0 0 L 0 -0.012 L 0 0 E", dur, repeat=True)
    if kind == "pulse":
        return 6, 0, f'<p:animScale><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}" autoRev="1" repeatCount="indefinite" fill="hold" accel="50000" decel="50000"/>{tgt(spid)}</p:cBhvr><p:by x="107000" y="107000"/></p:animScale>'
    if kind == "breathe":
        return 6, 0, f'<p:animScale><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}" autoRev="1" repeatCount="indefinite" fill="hold" accel="50000" decel="50000"/>{tgt(spid)}</p:cBhvr><p:by x="103000" y="103000"/></p:animScale>'
    if kind == "runner":
        return 0, 0, visible(ids, spid) + motion(ids, spid, path or "M 0 0 E", dur, repeat=True, decel=False)
    raise ValueError(kind)


def iterate(by_letter: bool) -> str:
    return '<p:iterate type="lt"><p:tmPct val="9000"/></p:iterate>' if by_letter else ""


def timing(items: list[dict]) -> str:
    ids = Ids()
    pars = []
    builds = {}
    for it in sorted(items, key=lambda x: x["delay"]):
        pid = ids.next()
        kind = it["kind"]
        if kind in LOOPS:
            preset, sub, body = loop(ids, it["spid"], kind, it["dur"], it.get("path"))
            klass = "emph" if kind in ("pulse", "breathe") else "path"
            if kind == "runner":
                klass = "entr"
            pars.append(
                f'<p:par><p:cTn id="{pid}" presetID="{preset}" presetClass="{klass}" presetSubtype="{sub}" fill="hold" grpId="{1 if klass != "entr" else 0}" nodeType="withEffect">'
                f'<p:stCondLst><p:cond delay="{it["delay"]}"/></p:stCondLst><p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>'
            )
            if it["is_sp"]:
                builds.setdefault(it["spid"], set()).add(1 if klass != "entr" else 0)
            continue
        preset, sub, body = entrance(ids, it["spid"], kind, it["dur"])
        pars.append(
            f'<p:par><p:cTn id="{pid}" presetID="{preset}" presetClass="entr" presetSubtype="{sub}" fill="hold" grpId="0" nodeType="withEffect">'
            f'<p:stCondLst><p:cond delay="{it["delay"]}"/></p:stCondLst>{iterate(it.get("lt", False))}<p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>'
        )
        if it["is_sp"]:
            builds.setdefault(it["spid"], set()).add(0)
    bld = "".join(f'<p:bldP spid="{spid}" grpId="{g}" animBg="1"/>' for spid, gs in builds.items() for g in sorted(gs))
    return (
        f'<p:timing xmlns:p="{NS["p"]}"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        f'<p:par><p:cTn id="{ids.next()}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
        f'<p:par><p:cTn id="{ids.next()}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{"".join(pars)}</p:childTnLst></p:cTn></p:par>'
        "</p:childTnLst></p:cTn></p:par>"
        '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
        f"</p:childTnLst></p:cTn></p:par></p:tnLst>{f'<p:bldLst>{bld}</p:bldLst>' if bld else ''}</p:timing>"
    )


FADE = f'<p:transition xmlns:p="{NS["p"]}" spd="med"><p:fade/></p:transition>'
MORPH = (
    '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">'
    f'<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">'
    f'<p:transition xmlns:p="{NS["p"]}" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" spd="slow" p14:dur="1400"><p159:morph option="byObject"/></p:transition>'
    f'</mc:Choice><mc:Fallback><p:transition xmlns:p="{NS["p"]}" spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>'
)


def parse_fx(spec: str) -> list[dict]:
    out = []
    for part in spec.split(";"):
        flags = part.split("|")
        kind, delay, dur = flags[0].split("@")
        out.append({"kind": kind, "delay": int(float(delay)), "dur": int(float(dur)), "lt": "lt" in flags[1:]})
    return out


def process(xml: bytes, plan: dict) -> bytes:
    root = etree.fromstring(xml)
    anims = plan.get("anims", {})
    paths = plan.get("paths", {})
    items = []
    for c in root.iter(P + "cNvPr"):
        name = c.get("name", "")
        if name not in anims:
            continue
        owner = c.getparent().getparent()
        is_sp = etree.QName(owner).localname == "sp"
        for fx in parse_fx(anims[name]):
            items.append({"spid": c.get("id"), "is_sp": is_sp, "path": paths.get(name), **fx})
    for old in list(root):
        if etree.QName(old).localname in ("transition", "timing", "AlternateContent"):
            root.remove(old)
    anchor = root.find(P + "clrMapOvr")
    index = list(root).index(anchor) + 1 if anchor is not None else len(root)
    root.insert(index, etree.fromstring(MORPH if plan.get("transition") == "morph" else FADE))
    if items:
        root.insert(index + 1, etree.fromstring(timing(items)))
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def main(src: str, dst: str, plan_file: str) -> None:
    plans = json.loads(Path(plan_file).read_text(encoding="utf-8"))
    tmp = Path(dst).with_suffix(".tmp")
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            m = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", info.filename)
            if m:
                data = process(data, plans[int(m.group(1)) - 1])
            zout.writestr(info, data)
    shutil.move(tmp, dst)
    print(dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])

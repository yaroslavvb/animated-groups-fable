"""Copy book crops and thumbnails from the sibling animated-groups repo into
docs/img for the patterns page, and write docs/data/crops.json listing what
exists.

  docs/img/mathworld/<hm>.webp        MathWorld wallpaper thumbnails (17)
  docs/img/gs-plates/<anchor>.webp    G&S Fig 8.2.3/8.3.6 panels for the k=3
                                      types, named by our type anchors
                                      (k=2 panels are already present)
  docs/img/sot/<c3-id>.webp           SoT Table 12.1 evidence per k=3 colour
                                      group (k=2 rows are already present)

The k=3 plate mapping goes through AUDIT_3: the labels actually printed in
the highlight box of each crop, transcribed by visual audit (several of the
sibling repo's crop files are misnamed — e.g. the file named pp153s shows
PP18[3], and the p6m block gs-cp-3-052..057 is shifted by one panel).  Our
type labels are matched against the audited labels; the five types beyond
the book's figures get no crop.  Run:  python3 sync_crops.py
"""

import glob
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
FABLE = os.path.join(HERE, "..")
AG = os.path.join(HERE, "..", "..", "animated-groups")
DOCS = os.path.join(FABLE, "docs")

ORDER17 = ["p1", "p2", "pm", "pg", "cm", "pmm", "pmg", "pgg", "cmm",
           "p4", "p4m", "p4g", "p3", "p3m1", "p31m", "p6", "p6m"]

# crop number (gs-cp-3-NNN-*) -> label printed in its highlight box
AUDIT_3 = {
    1: "PP1[3]", 2: "PP2[3]1", 3: "PP2[3]2", 4: "PP3[3]1", 5: "PP3[3]2",
    6: "PP5[3]1", 7: "PP5[3]2", 8: "PP7[3]", 9: "PP9[3]", 10: "PP11[3]1",
    11: "PP11[3]2", 12: "PP14[3]", 13: "PP17[3]", 14: "PP21[3]1",
    15: "PP21[3]2", 16: "PP23[3]1", 17: "PP23[3]2", 18: "PP27[3]1",
    19: "PP27[3]2", 20: "PP42[3]1", 21: "PP42[3]2", 22: "PP46[3]1",
    23: "PP46[3]2", 24: "PP4[3]1", 25: "PP4[3]2", 26: "PP6[3]1",
    27: "PP6[3]2", 28: "PP8[3]", 29: "PP10[3]", 30: "PP12[3]1",
    31: "PP12[3]2", 32: "PP13[3]1", 33: "PP13[3]2", 34: "PP15[3]",
    35: "PP18[3]", 36: "PP16[3]", 37: "PP15[3]*", 38: "PP19[3]",
    39: "PP19[3]*", 40: "PP20[3]", 41: "PP22[3]2", 42: "PP25[3]1",
    43: "PP25[3]2", 44: "PP26[3]2", 45: "PP28[3]1", 46: "PP28[3]2",
    47: "PP29[3]2", 48: "PP43[3]1", 49: "PP43[3]2", 50: "PP45[3]2",
    51: "PP47[3]1", 52: "PP47[3]2", 53: "PP48A[3]1", 54: "PP48A[3]2",
    55: "PP48B[3]1", 56: "PP48B[3]2", 57: "PP49[3]1", 58: "PP49[3]2",
    59: "PP51[3]2",
}

SUBS = {"₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5",
        "₆": "6", "₇": "7", "₈": "8", "₉": "9"}


def norm_label(s):
    for u, d in SUBS.items():
        s = s.replace(u, d)
    return s


def main():
    with open(os.path.join(DOCS, "data", "patterns.json")) as f:
        pat = json.load(f)
    with open(os.path.join(DOCS, "data", "colored-gs.json")) as f:
        gsmap = json.load(f)["groups"]
    with open(os.path.join(AG, "data", "color-pattern-catalog.json")) as f:
        cat = json.load(f)

    # ---- MathWorld thumbnails
    src = os.path.join(AG, "output", "mathworld-wallpaper-groups")
    dst = os.path.join(DOCS, "img", "mathworld")
    os.makedirs(dst, exist_ok=True)
    for hm in ORDER17:
        shutil.copy2(os.path.join(src, hm + ".webp"),
                     os.path.join(dst, hm + ".webp"))
    print("mathworld thumbnails: 17 copied")

    # ---- SoT Table 12.1 crops per k=3 colour group (via gs symbol match)
    norm = lambda s: s.replace("_", "")
    cg_sym = {g["id"]: norm(g["gs_symbol"]) for g in cat["colour_groups"]
              if g["number_of_colours"] == 3}
    ours_by_sym = {}
    for cid, g in gsmap.items():
        if cid.startswith("c3-"):
            ours_by_sym[norm(g["gs"])] = cid
    excerpts = os.path.join(AG, "output", "color-pattern-excerpts")
    sot_dst = os.path.join(DOCS, "img", "sot")
    n = 0
    for cgid, sym in cg_sym.items():
        ours = ours_by_sym[sym]
        src_f = os.path.join(excerpts, "tos-" + cgid + ".webp")
        assert os.path.exists(src_f), src_f
        shutil.copy2(src_f, os.path.join(sot_dst, ours + ".webp"))
        n += 1
    print("SoT Table 12.1 crops: %d copied" % n)

    # ---- G&S plate crops for k=3 types, matched by audited label
    file_of = {}
    for num, label in AUDIT_3.items():
        hits = glob.glob(os.path.join(excerpts, "gs-cp-3-%03d-*.webp" % num))
        assert len(hits) == 1, (num, hits)
        file_of[label] = hits[0]

    plates_dst = os.path.join(DOCS, "img", "gs-plates")
    # remove previously synced k=3 plates so stale mappings cannot survive
    # (k=3 anchors: pp<N><A|B>?-3[-sub][s...]; k=2 anchors end in -2[-sub][s])
    import re
    for f in glob.glob(os.path.join(plates_dst, "*.webp")):
        if re.fullmatch(r"pp\d+[ab]?-3(-\d+)?s*\.webp",
                        os.path.basename(f)):
            os.remove(f)
    mapped, beyond = 0, []
    for t in pat["types"]:
        if t["k"] != 3:
            continue
        lbl = norm_label(t["label"])
        if lbl in file_of:
            shutil.copy2(file_of[lbl],
                         os.path.join(plates_dst, t["id"] + ".webp"))
            mapped += 1
        else:
            beyond.append((t["id"], lbl))
    print("G&S k=3 plates: %d mapped by audited label" % mapped)
    print("beyond the book (no crop): %s" % sorted(x[0] for x in beyond))
    assert mapped == 59, mapped
    assert len(beyond) == 5, beyond

    # ---- crops.json: what exists, for the page
    plates = sorted(os.path.splitext(os.path.basename(f))[0]
                    for f in glob.glob(os.path.join(plates_dst, "*.webp")))
    sot = sorted(os.path.splitext(os.path.basename(f))[0]
                 for f in glob.glob(os.path.join(sot_dst, "c*.webp")))
    with open(os.path.join(DOCS, "data", "crops.json"), "w") as f:
        json.dump({"plates": plates, "sot": sot}, f, indent=1)
    print("crops.json: %d plates, %d sot rows" % (len(plates), len(sot)))


if __name__ == "__main__":
    main()

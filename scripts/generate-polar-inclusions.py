#!/usr/bin/env python3
"""Build the aligned generator-inclusion Hasse diagram data for the 68 clockwork groups.

Every group is expressed in an aligned coordinate frame on the shared base
translation lattice T = ⟨t₁, t₂⟩ = Z² (with ◦ at the top), so that walking
down an edge in the Hasse diagram adds explicit point-group / glide / screw /
centering generators. All labels use Conway / Chaim orbifold notation only.
"""
from fractions import Fraction as F
import itertools
import json
from pathlib import Path

D = Path(__file__).resolve().parents[1] / 'docs'
groups = json.loads((D / 'data/clockwork-coloring-correspondence.json').read_text())['groups']

I2 = ((1, 0), (0, 1))
R2 = ((-1, 0), (0, -1))
R4 = ((0, -1), (1, 0))
R4_3 = ((0, 1), (-1, 0))
R3 = ((0, -1), (1, -1))
R3_2 = ((-1, 1), (-1, 0))
R6 = ((1, -1), (1, 0))
R6_5 = ((0, 1), (-1, 1))
MX = ((1, 0), (0, -1))
MY = ((-1, 0), (0, 1))
SW = ((0, 1), (1, 0))
NSW = ((0, -1), (-1, 0))


def fmt_frac(val):
    f = F(val)
    table = {
        F(0): '0',
        F(1, 2): '½',
        F(1, 3): '⅓',
        F(2, 3): '⅔',
        F(1, 4): '¼',
        F(3, 4): '¾',
        F(1, 6): '⅙',
        F(5, 6): '⅚',
    }
    return table.get(f, f'{f.numerator}/{f.denominator}')


def fmt_coord_term(var, shift):
    if shift == 0:
        return var
    return f'{var}+{fmt_frac(shift)}'


def describe_op(op):
    M, v, tau = op
    vx, vy = v
    t_expr = 't' if tau == 0 else f't+{fmt_frac(tau)}'

    if M == I2:
        if vx == 0 and vy == 0 and tau == 0:
            return {
                'symbol': 'T',
                'short': 'T',
                'description': 'lattice translations ⟨t₁, t₂⟩',
                'formula': '(x+1, y, t), (x, y+1, t)',
            }
        v_str = f'({fmt_frac(vx)},{fmt_frac(vy)})'
        sym = f't{v_str}' + (f'^(+{fmt_frac(tau)})' if tau else '')
        if (vx, vy) == (F(0), F(1, 2)):
            short_base = 'tᵧ'
        elif (vx, vy) == (F(1, 2), F(0)):
            short_base = 'tₓ'
        elif (vx, vy) == (F(1, 2), F(1, 2)):
            short_base = 'c'
        elif (vx, vy) == (F(2, 3), F(1, 3)):
            short_base = 'r'
        else:
            short_base = f't{v_str}'
        short = short_base + (fmt_frac(tau) if tau else '')
        desc = f'centering translation {v_str}' + (f' + {fmt_frac(tau)} period' if tau else '')
        formula = f'({fmt_coord_term("x", vx)}, {fmt_coord_term("y", vy)}, {t_expr})'
        return {'symbol': sym, 'short': short, 'description': desc, 'formula': formula}

    rot_info = {
        R2: ('R₂', '180° half-turn', '-x', '-y'),
        R4: ('R₄', '90° quarter-turn', '-y', 'x'),
        R4_3: ('R₄⁻¹', '270° quarter-turn', 'y', '-x'),
        R3: ('R₃', '120° one-third turn', '-y', 'x-y'),
        R3_2: ('R₃⁻¹', '240° two-thirds turn', 'y-x', '-x'),
        R6: ('R₆', '60° one-sixth turn', 'x-y', 'x'),
        R6_5: ('R₆⁻¹', '300° five-sixths turn', 'y', 'y-x'),
    }
    if M in rot_info:
        sym, desc, fx, fy = rot_info[M]
        short = sym
        if vx != 0 or vy != 0:
            sym += f'({fmt_frac(vx)},{fmt_frac(vy)})'
            short += '′'
            desc += f' shifted by ({fmt_frac(vx)},{fmt_frac(vy)})'
        if tau:
            sym += f'^(+{fmt_frac(tau)})'
            short += fmt_frac(tau)
            desc += f' + {fmt_frac(tau)} period'
        formula = f'({ fmt_coord_term(fx, vx) }, { fmt_coord_term(fy, vy) }, {t_expr})'
        return {'symbol': sym, 'short': short, 'description': desc, 'formula': formula}

    if M == MX:
        is_glide = vx != 0
        sym = '×ₓ' if is_glide else '∗ₓ'
        short = sym
        desc = 'horizontal glide' if is_glide else 'horizontal mirror'
        if vy != 0 and not is_glide:
            sym += f'(0,{fmt_frac(vy)})'
            short = '∗ₓ′'
            desc += f' at y={fmt_frac(vy / 2)}'
        elif is_glide and vy != 0:
            sym = '×ₓ′' if vx == F(1, 2) and vy == F(1, 2) else f'×ₓ({fmt_frac(vx)},{fmt_frac(vy)})'
            short = '×ₓ′'
            desc = 'offset horizontal glide'
        formula = f'({fmt_coord_term("x", vx)}, {fmt_coord_term("-y", vy)}, {t_expr})'
    elif M == MY:
        is_glide = vy != 0
        sym = '×ᵧ' if is_glide else '∗ᵧ'
        short = sym
        desc = 'vertical glide' if is_glide else 'vertical mirror'
        if vx != 0 and not is_glide:
            sym += f'({fmt_frac(vx)},0)'
            short = '∗ᵧ′'
            desc += f' at x={fmt_frac(vx / 2)}'
        elif is_glide and vx != 0:
            sym = '×ᵧ′'
            short = '×ᵧ′'
            desc = 'offset vertical glide'
        formula = f'({fmt_coord_term("-x", vx)}, {fmt_coord_term("y", vy)}, {t_expr})'
    elif M == SW:
        is_glide = (vx + vy) % 1 != 0
        sym = '×_d' if is_glide else '∗_d'
        short = '×d' if is_glide else '∗d'
        desc = 'diagonal glide (x=y)' if is_glide else 'diagonal mirror (x=y)'
        if not is_glide and (vx != 0 or vy != 0):
            sym += f'({fmt_frac(vx)},{fmt_frac(vy)})'
            short += '′'
            desc += f' shifted by ({fmt_frac(vx)},{fmt_frac(vy)})'
        formula = f'({fmt_coord_term("y", vx)}, {fmt_coord_term("x", vy)}, {t_expr})'
    elif M == NSW:
        is_glide = (vx - vy) % 1 != 0
        sym = '×_d′' if is_glide else '∗_d′'
        short = '×d′' if is_glide else '∗d′'
        desc = 'anti-diagonal glide (x=-y)' if is_glide else 'anti-diagonal mirror (x=-y)'
        if not is_glide and (vx != 0 or vy != 0):
            sym += f'({fmt_frac(vx)},{fmt_frac(vy)})'
            short += '′'
            desc += f' shifted by ({fmt_frac(vx)},{fmt_frac(vy)})'
        formula = f'({fmt_coord_term("-y", vx)}, {fmt_coord_term("-x", vy)}, {t_expr})'
    else:
        sym = '∗_h'
        short = '∗h'
        desc = 'hexagonal mirror'
        formula = f'(M(x,y), {t_expr})'

    if tau:
        sym += f'^(+{fmt_frac(tau)})'
        short += fmt_frac(tau)
        desc += f' + {fmt_frac(tau)} period'
    return {'symbol': sym, 'short': short, 'description': desc, 'formula': formula}


def mul_op(op1, op2):
    M1, v1, t1 = op1
    M2, v2, t2 = op2
    M = (
        (M1[0][0] * M2[0][0] + M1[0][1] * M2[1][0], M1[0][0] * M2[0][1] + M1[0][1] * M2[1][1]),
        (M1[1][0] * M2[0][0] + M1[1][1] * M2[1][0], M1[1][0] * M2[0][1] + M1[1][1] * M2[1][1]),
    )
    v = (
        (v1[0] + M1[0][0] * v2[0] + M1[0][1] * v2[1]) % 1,
        (v1[1] + M1[1][0] * v2[0] + M1[1][1] * v2[1]) % 1,
    )
    t = (t1 + t2) % 1
    return (M, v, t)


def close_ops(gens):
    S = {(I2, (F(0), F(0)), F(0))}
    for g in gens:
        S.add(g)
    changed = True
    while changed:
        changed = False
        cur = list(S)
        for x in cur:
            for y in gens:
                z = mul_op(x, y)
                if z not in S:
                    S.add(z)
                    changed = True
    return frozenset(S)


def transform_ops(ops, A, e):
    det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
    Ai = ((A[1][1] / det, -A[0][1] / det), (-A[1][0] / det, A[0][0] / det))

    def mul(X, Y):
        return (
            (X[0][0] * Y[0][0] + X[0][1] * Y[1][0], X[0][0] * Y[0][1] + X[0][1] * Y[1][1]),
            (X[1][0] * Y[0][0] + X[1][1] * Y[1][0], X[1][0] * Y[0][1] + X[1][1] * Y[1][1]),
        )

    def app(X, v):
        return (X[0][0] * v[0] + X[0][1] * v[1], X[1][0] * v[0] + X[1][1] * v[1])

    out = set()
    for o in ops:
        M = ((F(o['M'][0][0]), F(o['M'][0][1])), (F(o['M'][1][0]), F(o['M'][1][1])))
        v = (F(o['v'][0]).limit_denominator(24), F(o['v'][1]).limit_denominator(24))
        tau = F(o['tau']).limit_denominator(24)
        Mn = mul(mul(A, M), Ai)
        Mn_int = ((int(Mn[0][0]), int(Mn[0][1])), (int(Mn[1][0]), int(Mn[1][1])))
        vn = app(A, v)
        me = app(Mn, e)
        vn_mod = ((vn[0] + e[0] - me[0]) % 1, (vn[1] + e[1] - me[1]) % 1)
        out.add((Mn_int, vn_mod, tau % 1))
    return frozenset(out)


def aligned_operations(g):
    hm = g['parent']['hm']
    gid = g['id']
    if hm == 'pm':
        A, e = ((F(1), F(1)), (F(1), F(-1))), (F(0), F(0))
    elif hm == 'pg':
        A, e = ((F(1), F(-1)), (F(1), F(1))), (F(0), F(0))
    elif gid == 'g60':
        A, e = ((F(0), F(1)), (F(1), F(0))), (F(0), F(0))
    elif gid in ('g56', 'g57', 'g61', 'g62'):
        A, e = ((F(1), F(0)), (F(0), F(1))), (F(0), F(-1, 4))
    elif gid in ('g66', 'g67'):
        A, e = ((F(1), F(0)), (F(0), F(1))), (F(-1, 4), F(0))
    elif gid in ('g58', 'g59', 'g63'):
        A, e = ((F(1), F(0)), (F(0), F(1))), (F(0), F(-1, 4))
    elif gid == 'g75':
        A, e = ((F(1), F(0)), (F(0), F(1))), (F(-1, 8), F(-3, 8))
    elif gid in ('g68', 'g69', 'g70'):
        A, e = ((F(1), F(1)), (F(1), F(-1))), (F(0), F(0))
    elif gid in ('g132', 'g133', 'g134', 'g135'):
        A, e = ((F(1), F(0)), (F(0), F(1))), (F(1, 2), F(0))
    elif gid in ('g99', 'g137'):
        A, e = ((F(1), F(0)), (F(0), F(1))), (F(-1, 4), F(0))
    elif gid == 'g139':
        A, e = ((F(1), F(0)), (F(0), F(1))), (F(1, 4), F(0))
    else:
        A, e = ((F(1), F(0)), (F(0), F(1))), (F(0), F(0))
    return transform_ops(g['render']['ops'], A, e)


CANONICAL_SPATIAL_ORDER = {
    (R2, (F(0), F(0))): 1,
    (R3, (F(0), F(0))): 2,
    (R4, (F(0), F(0))): 3,
    (R6, (F(0), F(0))): 4,
    (MX, (F(0), F(0))): 5,
    (SW, (F(0), F(0))): 6,
    (NSW, (F(0), F(0))): 7,
    (I2, (F(0), F(1, 2))): 8,
    (I2, (F(1, 2), F(0))): 9,
    (I2, (F(1, 2), F(1, 2))): 10,
    (I2, (F(2, 3), F(1, 3))): 11,
    (MY, (F(0), F(1, 2))): 12,
    (MX, (F(1, 2), F(1, 2))): 13,
    (MX, (F(1, 4), F(1, 4))): 14,
}


def op_sort_key(op):
    M, v, tau = op
    vx, vy = v
    can_rank = CANONICAL_SPATIAL_ORDER.get((M, v), 99)
    return (can_rank, abs(vx) + abs(vy), tau.denominator, tau.numerator, vx, vy)


def min_generating_ops(ops):
    id_op = (I2, (F(0), F(0)), F(0))
    can_ops = sorted([o for o in ops if o != id_op and (o[0], o[1]) in CANONICAL_SPATIAL_ORDER], key=op_sort_key)
    all_ops = sorted([o for o in ops if o != id_op], key=op_sort_key)
    if not all_ops:
        return []
    for pool in (can_ops, all_ops):
        for k in (1, 2, 3, 4):
            for comb in itertools.combinations(pool, k):
                if close_ops(comb) == ops:
                    return list(comb)
    raise RuntimeError('Could not find generating set of size <= 4')


def min_added_ops(set_a, set_b):
    diff_can = sorted([o for o in (set_b - set_a) if (o[0], o[1]) in CANONICAL_SPATIAL_ORDER], key=op_sort_key)
    diff_all = sorted(list(set_b - set_a), key=op_sort_key)
    for pool in (diff_can, diff_all):
        for k in (1, 2, 3, 4):
            for comb in itertools.combinations(pool, k):
                if close_ops(list(set_a) + list(comb)) == set_b:
                    return list(comb)
    raise RuntimeError('Could not find added generators of size <= 4')


sets = {g['id']: aligned_operations(g) for g in groups}
assert len(sets) == 68 and all(len(s) for s in sets.values())
assert len(set(sets.values())) == 68

edges = [
    [a, b]
    for a in sets
    for b in sets
    if sets[a] < sets[b] and not any(sets[a] < sets[c] < sets[b] for c in sets)
]

transitions = {}
for a in sets:
    for b in sets:
        if sets[a] < sets[b]:
            added_ops = min_added_ops(sets[a], sets[b])
            added_desc = [describe_op(o) for o in added_ops]
            transitions[f'{a}->{b}'] = {
                'index': len(sets[b]) // len(sets[a]),
                'added_label': ', '.join('+' + d['symbol'] for d in added_desc),
                'added_short': ', '.join('+' + d['short'] for d in added_desc),
                'added': added_desc,
            }

base_translation_gen = describe_op((I2, (F(0), F(0)), F(0)))
result_groups = []
for g in groups:
    gid = g['id']
    gen_ops = min_generating_ops(sets[gid])
    gen_list = [base_translation_gen] + [describe_op(o) for o in gen_ops]
    gen_symbols = ['T'] + [d['symbol'] for d in gen_list[1:]]
    gen_shorts = ['T'] + [d['short'] for d in gen_list[1:]]
    short_sep = ', ' if len(gen_shorts) <= 3 else ','
    result_groups.append({
        'id': gid,
        'chaim': g['book_color_signature'].replace('*', '∗'),
        'symbol': '◦' if gid == 'g1' else g['symbol'].replace('*', '∗'),
        'page': f"correspondence-{g['parent']['hm']}.html",
        'family': g['parent']['hm'],
        'projected_orbifold': g['parent']['orbifold'].replace('*', '∗'),
        'kernel_orbifold': g['kernel']['orbifold'].replace('*', '∗'),
        'rolling_only': g['kernel']['hm'] != g['parent']['hm'],
        'pure_rolling': g['kernel']['hm'] == 'p1' and g['clock_order'] > 1,
        'colors': g['clock_order'],
        'order': len(sets[gid]),
        'generators_label': '⟨' + ', '.join(gen_symbols) + '⟩',
        'generators_short': '⟨' + short_sep.join(gen_shorts) + '⟩',
        'generators': gen_list,
    })

result = {
    'groups': result_groups,
    'edges': edges,
    'transitions': transitions,
}
(D / 'data/polar-inclusions.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(f'Wrote {len(result_groups)} groups, {len(edges)} covering edges, {len(transitions)} transitions.')

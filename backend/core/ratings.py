"""Overall-rating methodology — mirror of frontend/src/engine/ratings.ts (keep in sync).

Caspian Match Simulator ratings are game estimates, not official characteristics of real players.
"""
import math

WEIGHTS = {
    'ST': dict(pac=0.18, sho=0.38, pas=0.08, dri=0.18, defe=0.0, phy=0.18),
    'RW': dict(pac=0.26, sho=0.2, pas=0.14, dri=0.3, defe=0.0, phy=0.1),
    'LW': dict(pac=0.26, sho=0.2, pas=0.14, dri=0.3, defe=0.0, phy=0.1),
    'AM': dict(pac=0.1, sho=0.18, pas=0.32, dri=0.32, defe=0.0, phy=0.08),
    'CM': dict(pac=0.08, sho=0.08, pas=0.36, dri=0.22, defe=0.14, phy=0.12),
    'DM': dict(pac=0.06, sho=0.02, pas=0.26, dri=0.1, defe=0.34, phy=0.22),
    'RM': dict(pac=0.24, sho=0.1, pas=0.24, dri=0.24, defe=0.08, phy=0.1),
    'LM': dict(pac=0.24, sho=0.1, pas=0.24, dri=0.24, defe=0.08, phy=0.1),
    'CB': dict(pac=0.12, sho=0.0, pas=0.1, dri=0.04, defe=0.46, phy=0.28),
    'RB': dict(pac=0.24, sho=0.0, pas=0.16, dri=0.12, defe=0.3, phy=0.18),
    'LB': dict(pac=0.24, sho=0.0, pas=0.16, dri=0.12, defe=0.3, phy=0.18),
    'RWB': dict(pac=0.26, sho=0.02, pas=0.18, dri=0.16, defe=0.22, phy=0.16),
    'LWB': dict(pac=0.26, sho=0.02, pas=0.18, dri=0.16, defe=0.22, phy=0.16),
}

def js_round(v):
    return math.floor(v + 0.5)


GK_WEIGHTS = dict(div=0.21, han=0.2, kic=0.08, ref=0.23, spd=0.08, pos=0.2)


def overall_rating(position, attrs, gk=None):
    """attrs: dict with pac, sho, pas, dri, def, phy. Rounds half up like JS Math.round."""
    if position == 'GK':
        if not gk:
            return max(1, js_round(attrs.get('phy', 50) * 0.3))
        return js_round(sum(gk.get(k, 50) * w for k, w in GK_WEIGHTS.items()))
    w = WEIGHTS[position]
    a = {**attrs, 'defe': attrs.get('def', attrs.get('defe', 50))}
    v = sum(a[k] * wk for k, wk in w.items())
    return max(1, min(99, js_round(v)))

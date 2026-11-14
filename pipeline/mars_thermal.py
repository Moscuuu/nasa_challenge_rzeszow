"""1-D surface thermal model for Mars (first-order, same assumptions as the SWIM analysis).

Surface energy balance per time step:
    (1 - A) * S(t) + IR_down - eps * sigma * T^4 + k * dT/dz = 0
with explicit heat conduction in the ground and a CO2 frost floor (T >= T_frost).
Constant albedo A and thermal inertia I per site; no slopes, no dust, simple atmosphere.

run_sites() returns, per site, daily min / max / amplitude over the last simulated Mars year
and the mean diurnal profile (24 local hours) used for the Experiment Window.
"""
from __future__ import annotations

import numpy as np

SOL = 88775.244  # s
SOLS_PER_YEAR = 668.6
S0 = 1361.0  # W m-2 at 1 AU
A_AU, ECC, OBL, LS_PERI = 1.5237, 0.0934, np.radians(25.19), np.radians(251.0)
SIGMA, EPS = 5.670e-8, 0.95
RHO_C = 1.2e6  # volumetric heat capacity [J m-3 K-1]
T_FROST = 148.0  # CO2 frost point near 6 hPa [K]
IR_FRAC = 0.04  # downwelling atmospheric IR as a fraction of noon absorbed insolation (Kieffer-style)
STEPS_PER_SOL = 192
YEARS = 3


def ls_of_time(t_sol: np.ndarray) -> np.ndarray:
    """Solar longitude for time in sols since perihelion (Kepler equation)."""
    mean_anom = 2 * np.pi * t_sol / SOLS_PER_YEAR
    e_anom = mean_anom.copy()
    for _ in range(6):
        e_anom = e_anom - (e_anom - ECC * np.sin(e_anom) - mean_anom) / (1 - ECC * np.cos(e_anom))
    true_anom = 2 * np.arctan2(np.sqrt(1 + ECC) * np.sin(e_anom / 2), np.sqrt(1 - ECC) * np.cos(e_anom / 2))
    return (true_anom + LS_PERI) % (2 * np.pi)


def run_sites(lat_deg: np.ndarray, albedo: np.ndarray, inertia: np.ndarray) -> dict:
    lat = np.radians(np.asarray(lat_deg, dtype=float))[:, None]
    albedo = np.asarray(albedo, dtype=float)[:, None]
    k = (np.asarray(inertia, dtype=float) ** 2 / RHO_C)[:, None]
    kappa = k / RHO_C

    # layer grid: geometric, 1 cm at the top, down to ~5 m
    dz = 0.01 * 1.15 ** np.arange(36)
    dz = dz[np.cumsum(dz) < 6.0]
    zc = np.cumsum(dz) - dz / 2
    dt = SOL / STEPS_PER_SOL
    assert (kappa.max() * dt / dz[0] ** 2) < 0.5, "explicit scheme unstable"
    dist = (zc[1:] - zc[:-1])  # centre-to-centre

    n_sites = lat.shape[0]
    T = np.full((n_sites, dz.size), 200.0)
    total = int(YEARS * SOLS_PER_YEAR * STEPS_PER_SOL)
    last_year_start = total - int(SOLS_PER_YEAR * STEPS_PER_SOL)
    surf = np.empty((n_sites, total - last_year_start), dtype=np.float32)

    for i in range(total):
        t_sol = i / STEPS_PER_SOL
        ls = ls_of_time(np.array([t_sol]))[0]
        r = A_AU * (1 - ECC ** 2) / (1 + ECC * np.cos(ls - LS_PERI))
        dec = np.arcsin(np.sin(OBL) * np.sin(ls))
        hour_angle = 2 * np.pi * (t_sol % 1.0) - np.pi  # local noon at t_sol % 1 == 0.5
        mu = np.sin(lat) * np.sin(dec) + np.cos(lat) * np.cos(dec) * np.cos(hour_angle)
        mu_noon = np.sin(lat) * np.sin(dec) + np.cos(lat) * np.cos(dec)
        flux = S0 / r ** 2
        absorbed = (1 - albedo) * flux * np.clip(mu, 0, None) * 0.9  # 10 % atmospheric loss
        ir_down = IR_FRAC * (1 - albedo) * flux * np.clip(mu_noon, 0, None)

        # conduction fluxes between layers (positive = downward)
        q = -k * (T[:, 1:] - T[:, :-1]) / dist
        # surface layer: energy in from the top minus emission minus flux down
        net_top = absorbed + ir_down - EPS * SIGMA * T[:, :1] ** 4
        dT = np.zeros_like(T)
        dT[:, :1] = (net_top - q[:, :1]) * dt / (RHO_C * dz[0])
        dT[:, 1:-1] = (q[:, :-1] - q[:, 1:]) * dt / (RHO_C * dz[1:-1])
        dT[:, -1:] = q[:, -1:] * dt / (RHO_C * dz[-1])
        T = T + dT
        T[:, 0] = np.maximum(T[:, 0], T_FROST)
        if i >= last_year_start:
            surf[:, i - last_year_start] = T[:, 0]

    n_sols = surf.shape[1] // STEPS_PER_SOL
    daily = surf[:, : n_sols * STEPS_PER_SOL].reshape(n_sites, n_sols, STEPS_PER_SOL)
    dmin, dmax = daily.min(axis=2), daily.max(axis=2)
    hourly = daily.reshape(n_sites, n_sols, 24, STEPS_PER_SOL // 24).mean(axis=3)
    return {
        "tmin": dmin.mean(axis=1),
        "tmax": dmax.mean(axis=1),
        "amp": (dmax - dmin).mean(axis=1),
        "tmean": daily.mean(axis=(1, 2)),
        "diurnal_profile": hourly.mean(axis=1),  # (sites, 24 local hours), mean over the year
        "abs_min": dmin.min(axis=1),
        "abs_max": dmax.max(axis=1),
    }


if __name__ == "__main__":
    out = run_sites(np.array([0.0, 42.0, 68.2]), np.array([0.25] * 3), np.array([250.0] * 3))
    for i, la in enumerate([0.0, 42.0, 68.2]):
        print(f"lat {la:5.1f}: tmin {out['tmin'][i]:.1f} K  tmax {out['tmax'][i]:.1f} K  "
              f"amp {out['amp'][i]:.1f} K  mean {out['tmean'][i]:.1f} K")

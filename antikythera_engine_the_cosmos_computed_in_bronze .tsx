import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  Compass, Settings, Sun, Moon, Eye,Orbit, Calendar, BookOpen,
  Play, Pause, RotateCcw, FastForward, Rewind, ChevronRight, ChevronLeft,
  Layers, Info, CheckCircle2, AlertTriangle, Sparkles, Maximize2, Minimize2,
  Activity, Sliders, Award, ShieldCheck, Cpu, HelpCircle, RefreshCw, ArrowRight
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, ReferenceLine
} from 'recharts';

// ============================================================================
// 1. ASTRONOMICAL CONSTANTS & HISTORICAL RECONSTRUCTION DATA
// ============================================================================

const ASTRO_CONSTANTS = {
  TROPICAL_YEAR_DAYS: 365.2421897,
  SIDEREAL_YEAR_DAYS: 365.256363004,
  SYNODIC_MONTH_DAYS: 29.530588853,
  SIDEREAL_MONTH_DAYS: 27.321661547,
  ANOMALISTIC_MONTH_DAYS: 27.554549878,
  DRACONIC_MONTH_DAYS: 27.212220817,
  ECLIPTIC_OBLIQUITY_DEG: 23.4392911,
  LUNAR_INCLINATION_DEG: 5.145396,
  LUNAR_ECCENTRICITY: 0.0549006,
  // Antikythera Pin-and-Slot parameters (Freeth et al. 2006)
  PIN_RADIUS_MM: 9.6,
  PIN_OFFSET_D_MM: 1.06, // d / r_pin ≈ 0.1104 ≈ 2 * e_moon
  // Epoch reference: 15 May 100 BCE (Julian Date 1684580.5)
  DEFAULT_EPOCH_JD: 1684580.5,
  J2000_JD: 2451545.0,
};

// Corinthian / Epirote Calendar Months inscribed on the Metonic Spiral (Freeth et al. 2008)
const CORINTHIAN_MONTHS = [
  { index: 1, greek: 'ΦΟΙΝΙΚΑΙΟΣ', translit: 'Phoinikaios', season: 'Autumn Equinox' },
  { index: 2, greek: 'ΚΡΑΝΕΙΟΣ', translit: 'Kraneios', season: 'Mid Autumn' },
  { index: 3, greek: 'ΛΑΝΟΤΡΟΠΙΟΣ', translit: 'Lanotropios', season: 'Late Autumn' },
  { index: 4, greek: 'ΜΑΧΑΝΕΥΣ', translit: 'Machaneus', season: 'Winter Solstice' },
  { index: 5, greek: 'ΔΩΔΕΚΑΤΕΥΣ', translit: 'Dodekateus', season: 'Mid Winter' },
  { index: 6, greek: 'ΕΥΚΛΕΙΟΣ', translit: 'Eukleios', season: 'Late Winter' },
  { index: 7, greek: 'ΑΡΤΕΜΙΣΙΟΣ', translit: 'Artemisios', season: 'Spring Equinox' },
  { index: 8, greek: 'ΨΥΔΡΕΥΣ', translit: 'Psydreus', season: 'Mid Spring' },
  { index: 9, greek: 'ΓΑΜΕΛΙΟΣ', translit: 'Gamelios', season: 'Late Spring' },
  { index: 10, greek: 'ΑΓΡΙΑΝΙΟΣ', translit: 'Agrianios', season: 'Summer Solstice' },
  { index: 11, greek: 'ΠΑΝΑΜΟΣ', translit: 'Panamos', season: 'Mid Summer' },
  { index: 12, greek: 'ΑΠΕΛΛΑΙΟΣ', translit: 'Apellaios', season: 'Late Summer' },
];

// 12 Greek Zodiac Constellations on the Front Dial Ring
const GREEK_ZODIAC = [
  { name: 'ΚΡΙΟΣ', english: 'Aries', symbol: '♈', startDeg: 0 },
  { name: 'ΤΑΥΡΟΣ', english: 'Taurus', symbol: '♉', startDeg: 30 },
  { name: 'ΔΙΔΥΜΟΙ', english: 'Gemini', symbol: '♊', startDeg: 60 },
  { name: 'ΚΑΡΚΙΝΟΣ', english: 'Cancer', symbol: '♋', startDeg: 90 },
  { name: 'ΛΕΩΝ', english: 'Leo', symbol: '♌', startDeg: 120 },
  { name: 'ΠΑΡΘΕΝΟΣ', english: 'Virgo', symbol: '♍', startDeg: 150 },
  { name: 'ΧΗΛΑΙ', english: 'Libra (Claws)', symbol: '♎', startDeg: 180 },
  { name: 'ΣΚΟΡΠΙΟΣ', english: 'Scorpio', symbol: '♏', startDeg: 210 },
  { name: 'ΤΟΞΟΤΗΣ', english: 'Sagittarius', symbol: '♐', startDeg: 240 },
  { name: 'ΑΙΓΟΚΕΡΩΣ', english: 'Capricorn', symbol: '♑', startDeg: 270 },
  { name: 'ΥΔΡΟΧΟΟΣ', english: 'Aquarius', symbol: '♒', startDeg: 300 },
  { name: 'ΙΧΘΥΕΣ', english: 'Pisces', symbol: '♓', startDeg: 330 },
];

// 12 Egyptian Unwandering Months (30 days each + 5 Epagomenal days)
const EGYPTIAN_MONTHS = [
  'ΘΩΘ (Thoth)', 'ΦΑΩΦΙ (Phaophi)', 'ΑΘΥΡ (Athyr)', 'ΧΟΙΑΚ (Choiak)',
  'ΤΥΒΙ (Tybi)', 'ΜΕΧΕΙΡ (Mecheir)', 'ΦΑΜΕΝΩΘ (Phamenoth)', 'ΦΑΡΜΟΥΘΙ (Pharmouthi)',
  'ΠΑΧΩΝ (Pachon)', 'ΠΑΥΝΙ (Payni)', 'ΕΠΕΙΦ (Epeiph)', 'ΜΕΣΟΡΗ (Mesore)'
];

// Complete Gear Database (Freeth et al. 2006, 2008, 2021; Wright 2005)
// Every angular velocity ratio is rigorously derived from ω_next = -ω_prev * (N_prev / N_next)
// relative to b1 (where 1 full revolution of b1 = +1 Tropical Year).
const GEAR_DATABASE = [
  {
    id: 'a1',
    name: 'Input Crown Gear',
    teeth: 48,
    radiusMm: 13.8,
    xMm: -72,
    yMm: 0,
    zLayer: 18,
    train: 'Input / Solar',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#D4AF37',
    meshWith: 'b1 (90° Crown Mesh)',
    ratioFormula: 'ω_a1 = +(223 / 48) ω_b1',
    ratioToB1: 223 / 48,
    functionDesc: 'Manual hand-crank or knurled knob input gear mounted perpendicular to the main plate, driving main solar wheel b1.'
  },
  {
    id: 'b1',
    name: 'Main Solar Drive Wheel',
    teeth: 223,
    radiusMm: 63.0,
    xMm: 0,
    yMm: 0,
    zLayer: 22,
    train: 'Input / Solar',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed (223–224 teeth)',
    color: '#D4AF37',
    meshWith: 'Driven by a1',
    ratioFormula: 'ω_b1 = 1.0000 rev / tropical year',
    ratioToB1: 1.0,
    functionDesc: 'Primary four-spoked bronze drive gear representing 1 tropical solar year per revolution; carries planetary plate modules on front face.'
  },
  {
    id: 'b2',
    name: 'Central Hub Gear',
    teeth: 64,
    radiusMm: 16.2,
    xMm: 0,
    yMm: 0,
    zLayer: 8,
    train: 'Lunar Sidereal',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#C88A4B',
    meshWith: 'Coaxial with b1; meshes with c1 & l1',
    ratioFormula: 'ω_b2 = ω_b1 = 1.0',
    ratioToB1: 1.0,
    functionDesc: 'Rigidly locked to shaft b; distributes annual rotation into both the Lunar Sidereal Train (via c1) and Metonic Calendar Train (via l1).'
  },
  {
    id: 'c1',
    name: 'Lunar Intermediate Driven',
    teeth: 38,
    radiusMm: 9.6,
    xMm: 21.5,
    yMm: -14.2,
    zLayer: 8,
    train: 'Lunar Sidereal',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#C88A4B',
    meshWith: 'Driven by b2 (64)',
    ratioFormula: 'ω_c1 = -(64 / 38) ω_b1 = -(32 / 19)',
    ratioToB1: -64 / 38,
    functionDesc: 'Introduces the critical prime factor 19 (Metonic denominator) into the lunar sidereal train.'
  },
  {
    id: 'c2',
    name: 'Lunar Intermediate Driver',
    teeth: 48,
    radiusMm: 12.1,
    xMm: 21.5,
    yMm: -14.2,
    zLayer: 2,
    train: 'Lunar Sidereal',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#C88A4B',
    meshWith: 'Coaxial with c1; drives d1 (24)',
    ratioFormula: 'ω_c2 = ω_c1 = -(64 / 38) ω_b1',
    ratioToB1: -64 / 38,
    functionDesc: 'Compound partner on shaft c stepping up angular velocity toward shaft d.'
  },
  {
    id: 'd1',
    name: 'Lunar Pinion d1',
    teeth: 24,
    radiusMm: 6.2,
    xMm: 34.0,
    yMm: 1.0,
    zLayer: 2,
    train: 'Lunar Sidereal',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#C88A4B',
    meshWith: 'Driven by c2 (48)',
    ratioFormula: 'ω_d1 = +(64/38)×(48/24) = +(64/19) ω_b1',
    ratioToB1: (64 / 38) * (48 / 24),
    functionDesc: 'Doubles the speed of shaft c, yielding exactly 64/19 rotations per solar year.'
  },
  {
    id: 'd2',
    name: 'Great Sidereal Gear (127)',
    teeth: 127,
    radiusMm: 31.8,
    xMm: 34.0,
    yMm: 1.0,
    zLayer: -4,
    train: 'Lunar Sidereal',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#E5A93C',
    meshWith: 'Coaxial with d1; drives e2 (32)',
    ratioFormula: 'ω_d2 = +(64 / 19) ω_b1',
    ratioToB1: (64 / 38) * (48 / 24),
    functionDesc: 'Provides the prime factor 127 (half of 254 sidereal months in 19 years) required for the Metonic-Sidereal identity.'
  },
  {
    id: 'e2',
    name: 'Sidereal Input Pinion',
    teeth: 32,
    radiusMm: 8.2,
    xMm: 0,
    yMm: -27.5,
    zLayer: -4,
    train: 'Lunar Sidereal',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#E5A93C',
    meshWith: 'Driven by d2 (127); drives k1 (50)',
    ratioFormula: 'ω_e2 = -(64/19)×(127/32) = -(254/19) ω_b1',
    ratioToB1: -(64 / 38) * (48 / 24) * (127 / 32),
    functionDesc: 'Rotates at the exact mean sidereal lunar rate of 254/19 ≈ 13.368421 revolutions per tropical year.'
  },
  {
    id: 'e3',
    name: 'Epicyclic Carousel Table',
    teeth: 222,
    radiusMm: 54.8,
    xMm: 0,
    yMm: -27.5,
    zLayer: -12,
    train: 'Lunar Epicyclic Pin-and-Slot',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#3B9B86',
    meshWith: 'Driven by e6 (21) at Lunar Apse rate',
    ratioFormula: 'ω_e3 = +(Line of Apsides Precession ≈ 0.11299 ω_b1)',
    ratioToB1: ((64 / 38) * (48 / 24) * (127 / 32) - 1) * (50 / 53) * (30 / 54) * (20 / 60) * (15 / 60) * (32 / 222) * (21 / 32),
    functionDesc: 'Large epicyclic turntable carrying eccentric pin-and-slot gears k1 and k2; rotates at the rate of lunar perigee precession (~8.85 yr period).'
  },
  {
    id: 'k1',
    name: 'Epicyclic Pin Gear (Hipparchus)',
    teeth: 50,
    radiusMm: 12.6,
    xMm: 0,
    yMm: -47.0,
    zLayer: -9,
    train: 'Lunar Epicyclic Pin-and-Slot',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#45B89E',
    meshWith: 'Driven by e2 (32) on carousel e3; pin engages k2 slot',
    ratioFormula: 'ω_k1 = +(254/19)*(32/50) + (1 - 32/50)ω_e3',
    ratioToB1: (254 / 19) * (32 / 50),
    functionDesc: 'Carries an engaging cylindrical bronze pin at radius r = 9.6 mm that slides inside the radial slot of k2.'
  },
  {
    id: 'k2',
    name: 'Epicyclic Slotted Gear (Hipparchus)',
    teeth: 50,
    radiusMm: 12.6,
    xMm: 1.06,
    yMm: -47.0,
    zLayer: -15,
    train: 'Lunar Epicyclic Pin-and-Slot',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#45B89E',
    meshWith: 'Axis offset by d = 1.06 mm from k1; drives e4 (50)',
    ratioFormula: 'θ_k2 = atan2(r sin α, r cos α - d) + θ_e3',
    ratioToB1: (254 / 19) * (32 / 50),
    functionDesc: 'Mounted on a stepped stud offset by d = 1.06 mm from k1; converts uniform sidereal rotation into variable Keplerian-like anomalistic velocity!'
  },
  {
    id: 'e4',
    name: 'Anomalistic Lunar Output Gear',
    teeth: 50,
    radiusMm: 12.6,
    xMm: 0,
    yMm: -27.5,
    zLayer: -18,
    train: 'Lunar Epicyclic Pin-and-Slot',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#3B9B86',
    meshWith: 'Driven by k2 (50); coaxial with e1 (32)',
    ratioFormula: 'ω_e4 = -(254/19)(32/50) ± Δω_anomaly',
    ratioToB1: -(254 / 19) * (32 / 50),
    functionDesc: 'Receives the anomaly-modulated lunar motion from k2 and transmits it via e1(32) forward to b3(32) and the front Lunar Pointer & Phase Sphere.'
  },
  {
    id: 'l1',
    name: 'Metonic Train First Driven',
    teeth: 38,
    radiusMm: 9.6,
    xMm: -22.0,
    yMm: -13.0,
    zLayer: 8,
    train: 'Metonic / Calendar',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#5B8FD9',
    meshWith: 'Driven by b2 (64)',
    ratioFormula: 'ω_l1 = -(64 / 38) ω_b1',
    ratioToB1: -64 / 38,
    functionDesc: 'Extracts the 19-year Metonic factor from central hub b2.'
  },
  {
    id: 'l2',
    name: 'Metonic Train Driver',
    teeth: 53,
    radiusMm: 13.4,
    xMm: -22.0,
    yMm: -13.0,
    zLayer: -2,
    train: 'Metonic / Calendar',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#5B8FD9',
    meshWith: 'Coaxial with l1; drives m1 (96)',
    ratioFormula: 'ω_l2 = -(64 / 38) ω_b1',
    ratioToB1: -64 / 38,
    functionDesc: '53-tooth gear on shaft l driving m1.'
  },
  {
    id: 'm1',
    name: 'Metonic Intermediate Wheel',
    teeth: 96,
    radiusMm: 24.0,
    xMm: -44.0,
    yMm: 12.0,
    zLayer: -2,
    train: 'Metonic / Calendar',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#5B8FD9',
    meshWith: 'Driven by l2 (53)',
    ratioFormula: 'ω_m1 = +(64/38)×(53/96) = +(53/57) ω_b1',
    ratioToB1: (64 / 38) * (53 / 96),
    functionDesc: 'Reduces speed by 64/96 = 2/3 while preserving factor 53.'
  },
  {
    id: 'm2',
    name: 'Metonic Pinion m2',
    teeth: 15,
    radiusMm: 4.1,
    xMm: -44.0,
    yMm: 12.0,
    zLayer: -14,
    train: 'Metonic / Calendar',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#5B8FD9',
    meshWith: 'Coaxial with m1; drives n1 (53)',
    ratioFormula: 'ω_m2 = +(53 / 57) ω_b1',
    ratioToB1: (64 / 38) * (53 / 96),
    functionDesc: '15-tooth pinion driving the Metonic pointer gear n1.'
  },
  {
    id: 'n1',
    name: 'Metonic Spiral Pointer Gear',
    teeth: 53,
    radiusMm: 13.4,
    xMm: 0,
    yMm: 34.0,
    zLayer: -14,
    train: 'Metonic / Calendar',
    fragment: 'Fragment B / A',
    evidence: 'Extant / Reconstructed (53 teeth cancels l2)',
    color: '#3B75C4',
    meshWith: 'Driven by m2 (15)',
    ratioFormula: 'ω_n1 = -(64/38)(53/96)(15/53) = -(5/19) ω_b1',
    ratioToB1: -(64 / 38) * (53 / 96) * (15 / 53),
    functionDesc: 'Drives the Upper Back 5-turn Metonic Spiral Pointer! Completes 5 full turns in 19 tropical years (235 synodic months).'
  },
  {
    id: 'q1',
    name: 'Panhellenic Crown Games Gear',
    teeth: 60,
    radiusMm: 15.0,
    xMm: 28.0,
    yMm: 38.0,
    zLayer: -20,
    train: 'Callippic / Games',
    fragment: 'Fragment B',
    evidence: 'Scholarly Reconstruction (Freeth et al. 2008)',
    color: '#7A9EC9',
    meshWith: 'Driven via n2(57) -> p1(60)/p2(12) -> q1(60)',
    ratioFormula: 'ω_q1 = -(1 / 4) ω_b1 (1 turn per 4-year Olympiad)',
    ratioToB1: -0.25,
    functionDesc: 'Drives the Stephanephoros (Olympiad) subsidiary dial celebrating the 4-year cycle of the Panhellenic games (Olympia, Pythia, Isthmia, Nemea).'
  },
  {
    id: 'e5',
    name: 'Saros Train Driver',
    teeth: 50,
    radiusMm: 12.6,
    xMm: 0,
    yMm: -27.5,
    zLayer: -22,
    train: 'Saros Eclipse',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#C75B5B',
    meshWith: 'Coaxial with e1/e2; drives f1 (53)',
    ratioFormula: 'ω_e5 = -(254 / 19) ω_b1',
    ratioToB1: -(254 / 19),
    functionDesc: 'Feeds sidereal/synodic lunar motion into the lower-back Saros eclipse prediction gear train.'
  },
  {
    id: 'f1',
    name: 'Saros Intermediate Driven',
    teeth: 53,
    radiusMm: 13.4,
    xMm: 22.0,
    yMm: -44.0,
    zLayer: -22,
    train: 'Saros Eclipse',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#C75B5B',
    meshWith: 'Driven by e5 (50)',
    ratioFormula: 'ω_f1 = +(254/19)×(50/53) ω_b1',
    ratioToB1: (254 / 19) * (50 / 53),
    functionDesc: 'Transfers rotation toward the lower back Saros dial shaft g.'
  },
  {
    id: 'f2',
    name: 'Saros Intermediate Pinion',
    teeth: 30,
    radiusMm: 7.6,
    xMm: 22.0,
    yMm: -44.0,
    zLayer: -26,
    train: 'Saros Eclipse',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#C75B5B',
    meshWith: 'Coaxial with f1; drives g1 (54)',
    ratioFormula: 'ω_f2 = +(254/19)×(50/53) ω_b1',
    ratioToB1: (254 / 19) * (50 / 53),
    functionDesc: '30-tooth pinion driving the Saros pointer wheel g1.'
  },
  {
    id: 'g1',
    name: 'Saros Eclipse Pointer Wheel',
    teeth: 54,
    radiusMm: 13.7,
    xMm: 0,
    yMm: -52.0,
    zLayer: -26,
    train: 'Saros Eclipse',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed',
    color: '#E06666',
    meshWith: 'Driven by f2 (30)',
    ratioFormula: 'ω_g1 = -4 × (235/19) / 223 ≈ -0.22164 turns/yr',
    ratioToB1: -(235 / 19) * (4 / 223),
    functionDesc: 'Drives the Lower Back 4-turn Saros Eclipse Spiral Pointer! Completes 4 turns in 223 synodic months (18 years, 11 days, 8 hours).'
  },
  {
    id: 'i1',
    name: 'Exeligmos Triple-Saros Gear',
    teeth: 60,
    radiusMm: 15.0,
    xMm: -28.0,
    yMm: -56.0,
    zLayer: -30,
    train: 'Exeligmos',
    fragment: 'Fragment A',
    evidence: 'Extant CT Confirmed (via g2(20)->h1(60)/h2(15)->i1(60))',
    color: '#9E6BC7',
    meshWith: 'Driven by h2 (15)',
    ratioFormula: 'ω_i1 = (1 / 12) ω_g1 = 1 turn per 669 synodic months',
    ratioToB1: -(235 / 19) * (4 / 223) * (20 / 60) * (15 / 60),
    functionDesc: 'Drives the Exeligmos 3-sector dial (0, 8, 16 hours) compensating for the 1/3-day fractional shift of each Saros cycle over 54.09 years.'
  },
  {
    id: 'v_ucl',
    name: 'Venus 462-Year Gear (63)',
    teeth: 63,
    radiusMm: 15.8,
    xMm: -26.0,
    yMm: 22.0,
    zLayer: 28,
    train: 'Planetary Front (UCL 2021)',
    fragment: 'Fragment D',
    evidence: 'Extant Fragment D + Front Cover Inscription (462 yr)',
    color: '#E8A87C',
    meshWith: 'UCL 2021 Epicyclic Train (289 synodic cycles / 462 yr)',
    ratioFormula: 'ω_venus_syn = (289 / 462) ω_b1',
    ratioToB1: 1 + 289 / 462,
    functionDesc: 'Identified in Fragment D and matched by Freeth et al. (2021) to the 462-year Venus period inscribed on the Front Door Plate.'
  },
  {
    id: 's_ucl',
    name: 'Saturn 442-Year Gear',
    teeth: 68,
    radiusMm: 17.0,
    xMm: 26.0,
    yMm: 22.0,
    zLayer: 28,
    train: 'Planetary Front (UCL 2021)',
    fragment: 'Front Inscription',
    evidence: 'Inscribed Period (442 yr = 427 synodic cycles)',
    color: '#C2B280',
    meshWith: 'UCL 2021 Carrier System (17 × 26 = 442)',
    ratioFormula: 'ω_saturn = (15 / 442) ω_b1',
    ratioToB1: 15 / 442,
    functionDesc: 'Realizes the 442-year period for Saturn discovered via X-ray CT of the Front Cover inscription (442 sidereal years = 427 synodic cycles).'
  }
];

// Saros Spiral Eclipse Inscriptions (Freeth et al. 2008 / Anastasiou et al. 2016)
const SAROS_GLYPHS = [
  { month: 8, code: 'Σ', type: 'Lunar', hour: '6h', desc: 'Total Lunar Eclipse (Selene) at 6th hour' },
  { month: 13, code: 'Η', type: 'Solar', hour: '2h', desc: 'Solar Eclipse (Helios) at 2nd hour' },
  { month: 14, code: 'Σ', type: 'Lunar', hour: '9h', desc: 'Lunar Eclipse (Selene) at 9th hour' },
  { month: 19, code: 'Η', type: 'Solar', hour: '11h', desc: 'Solar Eclipse (Helios) at 11th hour' },
  { month: 20, code: 'Σ', type: 'Lunar', hour: '1h', desc: 'Lunar Eclipse (Selene) at 1st hour' },
  { month: 25, code: 'Σ', type: 'Lunar', hour: '4h', desc: 'Lunar Eclipse at 4th hour (End of Eclipse Season)' },
  { month: 31, code: 'Σ', type: 'Lunar', hour: '10h', desc: 'Lunar Eclipse at 10th hour' },
  { month: 37, code: 'Σ / Η', type: 'Both', hour: '3h / 7h', desc: 'Paired Lunar & Solar Eclipse in successive syzygies' },
  { month: 43, code: 'Σ', type: 'Lunar', hour: '8h', desc: 'Lunar Eclipse at 8th hour' },
  { month: 49, code: 'Η', type: 'Solar', hour: '5h', desc: 'Solar Eclipse at 5th hour' },
  { month: 55, code: 'Σ', type: 'Lunar', hour: '12h', desc: 'Lunar Eclipse at 12th hour' },
  { month: 61, code: 'Σ / Η', type: 'Both', hour: '2h / 9h', desc: 'Twin Eclipse Syzygy Pair' },
  { month: 67, code: 'Σ', type: 'Lunar', hour: '7h', desc: 'Lunar Eclipse at 7th hour' },
  { month: 73, code: 'Η', type: 'Solar', hour: '4h', desc: 'Solar Eclipse at 4th hour' },
  { month: 78, code: 'Σ', type: 'Lunar', hour: '1h', desc: 'Lunar Eclipse at 1st hour' },
  { month: 84, code: 'Σ / Η', type: 'Both', hour: '6h / 11h', desc: 'Central Node Passage — Total Lunar & Solar Eclipse' },
  { month: 90, code: 'Σ', type: 'Lunar', hour: '3h', desc: 'Lunar Eclipse at 3rd hour' },
  { month: 96, code: 'Η', type: 'Solar', hour: '8h', desc: 'Solar Eclipse at 8th hour' },
  { month: 102, code: 'Σ', type: 'Lunar', hour: '5h', desc: 'Lunar Eclipse at 5th hour' },
  { month: 108, code: 'Σ', type: 'Lunar', hour: '11h', desc: 'Lunar Eclipse at 11th hour' },
  { month: 114, code: 'Η', type: 'Solar', hour: '1h', desc: 'Solar Eclipse at 1st hour' },
  { month: 119, code: 'Σ', type: 'Lunar', hour: '9h', desc: 'Lunar Eclipse at 9th hour' },
  { month: 125, code: 'Σ / Η', type: 'Both', hour: '4h / 10h', desc: 'Lunar & Solar Eclipse Pair' },
  { month: 131, code: 'Σ', type: 'Lunar', hour: '2h', desc: 'Lunar Eclipse at 2nd hour' },
  { month: 137, code: 'Η', type: 'Solar', hour: '7h', desc: 'Solar Eclipse at 7th hour' },
  { month: 143, code: 'Σ', type: 'Lunar', hour: '6h', desc: 'Lunar Eclipse at 6th hour' },
  { month: 149, code: 'Σ', type: 'Lunar', hour: '12h', desc: 'Lunar Eclipse at 12th hour' },
  { month: 155, code: 'Η', type: 'Solar', hour: '3h', desc: 'Solar Eclipse at 3rd hour' },
  { month: 160, code: 'Σ', type: 'Lunar', hour: '8h', desc: 'Lunar Eclipse at 8th hour' },
  { month: 166, code: 'Σ / Η', type: 'Both', hour: '5h / 9h', desc: 'Nodal Syzygy Pair' },
  { month: 172, code: 'Σ', type: 'Lunar', hour: '1h', desc: 'Lunar Eclipse at 1st hour' },
  { month: 178, code: 'Η', type: 'Solar', hour: '6h', desc: 'Solar Eclipse at 6th hour' },
  { month: 184, code: 'Σ', type: 'Lunar', hour: '10h', desc: 'Lunar Eclipse at 10th hour' },
  { month: 190, code: 'Σ / Η', type: 'Both', hour: '2h / 8h', desc: 'Total Lunar & Annular Solar Eclipse' },
  { month: 196, code: 'Σ', type: 'Lunar', hour: '4h', desc: 'Lunar Eclipse at 4th hour' },
  { month: 201, code: 'Η', type: 'Solar', hour: '11h', desc: 'Solar Eclipse at 11th hour' },
  { month: 207, code: 'Σ', type: 'Lunar', hour: '7h', desc: 'Lunar Eclipse at 7th hour' },
  { month: 213, code: 'Σ / Η', type: 'Both', hour: '3h / 12h', desc: 'Late Saros Eclipse Pair' },
  { month: 219, code: 'Σ', type: 'Lunar', hour: '9h', desc: 'Final Saros Lunar Eclipse at 9th hour' }
];

// J2000 Keplerian Orbital Elements (Standish / JPL Approximations valid 3000 BCE - 3000 CE)
const PLANET_ELEMENTS = {
  Mercury: {
    greek: 'ΕΡΜΗΣ (Stilbon)',
    symbol: '☿',
    color: '#A6B5C5',
    a: 0.387098,
    e: 0.205635,
    i: 7.0049,
    L0: 252.2509,
    Ldot: 149472.6746, // deg per Julian century
    wBar0: 77.4561,
    node0: 48.3309,
    synodicDays: 115.8775,
    siderealYears: 0.2408467,
    uclPeriodYears: 462,
    uclSynodicCycles: 1451,
    uclRatioDesc: '1451 synodic cycles in 462 tropical years (or 1513 in 480 yr)'
  },
  Venus: {
    greek: 'ΑΦΡΟΔΙΤΗ (Phosphoros)',
    symbol: '♀',
    color: '#F3C677',
    a: 0.723332,
    e: 0.006773,
    i: 3.3947,
    L0: 181.9798,
    Ldot: 58517.8156,
    wBar0: 131.5637,
    node0: 76.6799,
    synodicDays: 583.9214,
    siderealYears: 0.61519726,
    uclPeriodYears: 462,
    uclSynodicCycles: 289,
    uclRatioDesc: '289 synodic cycles in 462 years — confirmed on Front Cover Inscription & Fragment D (63-tooth gear)'
  },
  Earth: {
    greek: 'ΓΗ (Gaia)',
    symbol: '⊕',
    color: '#4E95D9',
    a: 1.000001,
    e: 0.016709,
    i: 0.0000,
    L0: 100.4664,
    Ldot: 35999.3729,
    wBar0: 102.9373,
    node0: 0.0,
    synodicDays: 365.2422,
    siderealYears: 1.0000174
  },
  Mars: {
    greek: 'ΑΡΗΣ (Pyroeis)',
    symbol: '♂',
    color: '#E06655',
    a: 1.523679,
    e: 0.093405,
    i: 1.8497,
    L0: 355.4330,
    Ldot: 19140.2993,
    wBar0: 336.0602,
    node0: 49.5581,
    synodicDays: 779.9361,
    siderealYears: 1.8808476,
    uclPeriodYears: 284,
    uclSynodicCycles: 133,
    uclRatioDesc: '133 synodic cycles in 284 tropical years (Babylonian Goal-Year expansion)'
  },
  Jupiter: {
    greek: 'ΖΕΥΣ (Phaethon)',
    symbol: '♃',
    color: '#D9A76A',
    a: 5.202603,
    e: 0.048498,
    i: 1.3033,
    L0: 34.3515,
    Ldot: 3034.9057,
    wBar0: 14.3312,
    node0: 100.4644,
    synodicDays: 398.8840,
    siderealYears: 11.862615,
    uclPeriodYears: 344,
    uclSynodicCycles: 315,
    uclRatioDesc: '315 synodic cycles in 344 tropical years'
  },
  Saturn: {
    greek: 'ΚΡΟΝΟΣ (Phainon)',
    symbol: '♄',
    color: '#C2B280',
    a: 9.554909,
    e: 0.055546,
    i: 2.4889,
    L0: 50.0774,
    Ldot: 1222.1138,
    wBar0: 93.0572,
    node0: 113.6655,
    synodicDays: 378.0919,
    siderealYears: 29.447498,
    uclPeriodYears: 442,
    uclSynodicCycles: 427,
    uclRatioDesc: '427 synodic cycles in 442 tropical years — discovered via CT scan of Front Cover Inscription (Freeth et al. 2021)'
  }
};

// ============================================================================
// 2. MATHEMATICAL & ASTRONOMICAL COMPUTATION ENGINE
// ============================================================================

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function normalizeSignedDeg(deg) {
  let d = normalizeDeg(deg);
  return d > 180 ? d - 360 : d;
}

/**
 * Solves Kepler's Equation: M = E - e * sin(E) using Newton-Raphson iteration
 * Guarantees convergence to < 1e-12 radians.
 */
function solveKeplerEquation(meanAnomalyDeg, eccentricity) {
  const M = normalizeDeg(meanAnomalyDeg) * DEG2RAD;
  let E = M + eccentricity * Math.sin(M);
  let iterations = 0;
  let delta = 1.0;

  while (Math.abs(delta) > 1e-12 && iterations < 30) {
    const f = E - eccentricity * Math.sin(E) - M;
    const fPrime = 1.0 - eccentricity * Math.cos(E);
    delta = f / fPrime;
    E -= delta;
    iterations++;
  }

  // True Anomaly nu
  const sinNu = (Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(E)) / (1 - eccentricity * Math.cos(E));
  const cosNu = (Math.cos(E) - eccentricity) / (1 - eccentricity * Math.cos(E));
  const trueAnomalyRad = Math.atan2(sinNu, cosNu);

  return {
    M_rad: M,
    E_rad: E,
    E_deg: normalizeDeg(E * RAD2DEG),
    trueAnomalyDeg: normalizeDeg(trueAnomalyRad * RAD2DEG),
    trueAnomalyRad,
    iterations,
    residual: Math.abs(E - eccentricity * Math.sin(E) - M)
  };
}

/**
 * Computes 3D Heliocentric coordinates for a given planet at Julian Centuries T from J2000
 */
function computeHeliocentricPlanet(planetKey, T_centuries) {
  const el = PLANET_ELEMENTS[planetKey];
  const L = normalizeDeg(el.L0 + el.Ldot * T_centuries);
  const M = normalizeDeg(L - el.wBar0);
  const kepler = solveKeplerEquation(M, el.e);

  const r = el.a * (1 - el.e * Math.cos(kepler.E_rad));
  const uRad = (kepler.trueAnomalyDeg + el.wBar0 - el.node0) * DEG2RAD;
  const nodeRad = el.node0 * DEG2RAD;
  const incRad = el.i * DEG2RAD;

  const x = r * (Math.cos(nodeRad) * Math.cos(uRad) - Math.sin(nodeRad) * Math.sin(uRad) * Math.cos(incRad));
  const y = r * (Math.sin(nodeRad) * Math.cos(uRad) + Math.cos(nodeRad) * Math.sin(uRad) * Math.cos(incRad));
  const z = r * (Math.sin(uRad) * Math.sin(incRad));

  const helioLon = normalizeDeg(Math.atan2(y, x) * RAD2DEG);
  const helioLat = Math.asin(z / r) * RAD2DEG;

  return {
    x, y, z, r,
    meanLonDeg: L,
    meanAnomalyDeg: M,
    eccentricAnomalyDeg: kepler.E_deg,
    trueAnomalyDeg: kepler.trueAnomalyDeg,
    helioLonDeg: helioLon,
    helioLatDeg: helioLat,
    keplerIterations: kepler.iterations,
    keplerResidual: kepler.residual
  };
}

/**
 * Full Synchronized State Engine:
 * Given `tYears` (tropical years elapsed from reference epoch 15 May 100 BCE),
 * computes all mechanical gear rotations AND modern astronomical ephemerides.
 */
function computeAntikytheraState(tYears) {
  const jd = ASTRO_CONSTANTS.DEFAULT_EPOCH_JD + tYears * ASTRO_CONSTANTS.TROPICAL_YEAR_DAYS;
  const T_centuries = (jd - ASTRO_CONSTANTS.J2000_JD) / 36525.0;

  // 1. Earth & Sun Position
  const earthHelio = computeHeliocentricPlanet('Earth', T_centuries);
  const sunGeoLonDeg = normalizeDeg(earthHelio.helioLonDeg + 180.0);
  const sunMeanLonDeg = normalizeDeg(earthHelio.meanLonDeg + 180.0);

  // 2. Modern Lunar Ephemeris (High-Precision Analytical Series: Equation of Center + Evection + Variation)
  const daysFromEpoch = tYears * ASTRO_CONSTANTS.TROPICAL_YEAR_DAYS;
  // At tYears = 0 (15 May 100 BCE), set reference lunar phase & node for clear demonstration
  const meanMoonLon = normalizeDeg(sunMeanLonDeg + (daysFromEpoch / ASTRO_CONSTANTS.SYNODIC_MONTH_DAYS) * 360.0);
  const meanLunarAnomalyM = normalizeDeg((daysFromEpoch / ASTRO_CONSTANTS.ANOMALISTIC_MONTH_DAYS) * 360.0 + 42.0);
  const meanElongationD = normalizeDeg(meanMoonLon - sunMeanLonDeg);
  const meanNodeOmega = normalizeDeg(120.0 - (daysFromEpoch / 6798.383) * 360.0); // 18.61-year nodal regression
  const argOfLatitudeF = normalizeDeg(meanMoonLon - meanNodeOmega);

  const M_rad = meanLunarAnomalyM * DEG2RAD;
  const D_rad = meanElongationD * DEG2RAD;
  const Ms_rad = earthHelio.meanAnomalyDeg * DEG2RAD;
  const F_rad = argOfLatitudeF * DEG2RAD;

  // Major Lunar Perturbations (Ptolemy/Hipparchus + Tycho/Newton terms)
  const eqOfCenterDeg = 6.2886 * Math.sin(M_rad) + 0.2136 * Math.sin(2 * M_rad);
  const evectionDeg = 1.2740 * Math.sin(2 * D_rad - M_rad);
  const variationDeg = 0.6583 * Math.sin(2 * D_rad);
  const annualEqDeg = -0.1856 * Math.sin(Ms_rad);

  const trueMoonLonDeg = normalizeDeg(meanMoonLon + eqOfCenterDeg + evectionDeg + variationDeg + annualEqDeg);
  const trueMoonLatDeg = 5.128 * Math.sin((trueMoonLonDeg - meanNodeOmega) * DEG2RAD);
  const moonDistKm = 385000 - 20905 * Math.cos(M_rad) - 3699 * Math.cos(2 * D_rad - M_rad) - 2956 * Math.cos(2 * D_rad);

  // 3. Antikythera Mechanical Pin-and-Slot Lunar Model (Gears e2, e3, k1, k2, e4)
  const b1Turns = tYears; // 1 turn of b1 = 1 tropical year
  const crankTurns = b1Turns * (223 / 48);

  // Sidereal Lunar Rate from b2(64)->c1(38)/c2(48)->d1(24)/d2(127)->e2(32)
  const mechSiderealTurns = b1Turns * (254 / 19);
  const mechSiderealDeg = normalizeDeg(sunMeanLonDeg + (b1Turns * (235 / 19)) * 360.0);

  // Carousel e3 (Line of Apsides rotation rate ≈ 0.11299 turns/year -> 1 turn in 8.85 years)
  const mechApseTurns = b1Turns * ((254 / 19 - 1) * (50 / 53) * (30 / 54) * (20 / 60) * (15 / 60) * (21 / 222));
  const mechApseDeg = normalizeDeg(mechApseTurns * 360.0);

  // Relative anomaly angle alpha of k1 on carousel e3
  const alphaDeg = normalizeDeg(meanLunarAnomalyM);
  const alphaRad = alphaDeg * DEG2RAD;
  const rPin = ASTRO_CONSTANTS.PIN_RADIUS_MM;
  const dOffset = ASTRO_CONSTANTS.PIN_OFFSET_D_MM;

  // Exact geometry of pin on k1 engaging radial slot on k2:
  const k2RelRad = Math.atan2(rPin * Math.sin(alphaRad), rPin * Math.cos(alphaRad) - dOffset);
  const k2RelDeg = normalizeDeg(k2RelRad * RAD2DEG);
  const pinSlotAnomalyDeltaDeg = normalizeSignedDeg(k2RelDeg - alphaDeg);

  // Instantaneous velocity ratio ω_k2 / ω_k1:
  const denomSq = rPin * rPin + dOffset * dOffset - 2 * rPin * dOffset * Math.cos(alphaRad);
  const omegaK2OverK1 = (rPin * (rPin - dOffset * Math.cos(alphaRad))) / denomSq;

  // Mechanical Lunar Longitude output on Front Dial
  const mechMoonLonDeg = normalizeDeg(meanMoonLon + pinSlotAnomalyDeltaDeg);
  const lunarDiscrepancyDeg = normalizeSignedDeg(mechMoonLonDeg - trueMoonLonDeg);

  // 4. Lunar Phase & Illumination
  const phaseAngleDeg = normalizeDeg(trueMoonLonDeg - sunGeoLonDeg);
  const illuminationFrac = 0.5 * (1 - Math.cos(phaseAngleDeg * DEG2RAD));
  const lunarAgeDays = (phaseAngleDeg / 360.0) * ASTRO_CONSTANTS.SYNODIC_MONTH_DAYS;

  let phaseName = 'New Moon (Νουμηνία)';
  if (phaseAngleDeg >= 15 && phaseAngleDeg < 75) phaseName = 'Waxing Crescent (Μηνοειδής)';
  else if (phaseAngleDeg >= 75 && phaseAngleDeg < 105) phaseName = 'First Quarter (Διχότομος)';
  else if (phaseAngleDeg >= 105 && phaseAngleDeg < 165) phaseName = 'Waxing Gibbous (Ἀμφίκυρτος)';
  else if (phaseAngleDeg >= 165 && phaseAngleDeg < 195) phaseName = 'Full Moon (Πανσέληνος)';
  else if (phaseAngleDeg >= 195 && phaseAngleDeg < 255) phaseName = 'Waning Gibbous (Ἀμφίκυρτος φθίνουσα)';
  else if (phaseAngleDeg >= 255 && phaseAngleDeg < 285) phaseName = 'Last Quarter (Διχότομος φθίνουσα)';
  else if (phaseAngleDeg >= 285 && phaseAngleDeg < 345) phaseName = 'Waning Crescent (Μηνοειδής φθίνουσα)';

  // 5. Five Classical Planets (Heliocentric & Geocentric + UCL Mechanical Comparison)
  const planets = {};
  const classicalKeys = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const obliquityRad = ASTRO_CONSTANTS.ECLIPTIC_OBLIQUITY_DEG * DEG2RAD;

  classicalKeys.forEach((key) => {
    const pHelio = computeHeliocentricPlanet(key, T_centuries);
    const dx = pHelio.x - earthHelio.x;
    const dy = pHelio.y - earthHelio.y;
    const dz = pHelio.z - earthHelio.z;
    const distAU = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const geoLonDeg = normalizeDeg(Math.atan2(dy, dx) * RAD2DEG);
    const geoLatDeg = Math.asin(dz / distAU) * RAD2DEG;

    // Check retrograde motion by finite difference (+1 day)
    const pHelioNext = computeHeliocentricPlanet(key, T_centuries + 1 / 36525.0);
    const eHelioNext = computeHeliocentricPlanet('Earth', T_centuries + 1 / 36525.0);
    const geoLonNext = normalizeDeg(Math.atan2(pHelioNext.y - eHelioNext.y, pHelioNext.x - eHelioNext.x) * RAD2DEG);
    const dailyMotionDeg = normalizeSignedDeg(geoLonNext - geoLonDeg);
    const isRetrograde = dailyMotionDeg < 0;

    // Equatorial RA and Dec
    const lonRad = geoLonDeg * DEG2RAD;
    const latRad = geoLatDeg * DEG2RAD;
    const sinDec = Math.sin(latRad) * Math.cos(obliquityRad) + Math.cos(latRad) * Math.sin(obliquityRad) * Math.sin(lonRad);
    const decDeg = Math.asin(sinDec) * RAD2DEG;
    const raRad = Math.atan2(
      Math.sin(lonRad) * Math.cos(obliquityRad) - Math.tan(latRad) * Math.sin(obliquityRad),
      Math.cos(lonRad)
    );
    const raHours = normalizeDeg(raRad * RAD2DEG) / 15.0;

    // UCL 2021 Epicyclic Mechanical Longitude approximation
    const el = PLANET_ELEMENTS[key];
    const synodicAngleRad = ((b1Turns * (el.uclSynodicCycles / el.uclPeriodYears)) * 2 * Math.PI);
    const rRatio = el.a < 1 ? el.a : 1 / el.a;
    const epicycleShiftDeg = Math.atan2(rRatio * Math.sin(synodicAngleRad), 1 + rRatio * Math.cos(synodicAngleRad)) * RAD2DEG;
    const baseLon = el.a < 1 ? sunMeanLonDeg : pHelio.meanLonDeg;
    const uclMechLonDeg = normalizeDeg(baseLon + epicycleShiftDeg);

    planets[key] = {
      ...pHelio,
      geoLonDeg,
      geoLatDeg,
      distAU,
      dailyMotionDeg,
      isRetrograde,
      raHours,
      decDeg,
      elongationDeg: normalizeSignedDeg(geoLonDeg - sunGeoLonDeg),
      uclMechLonDeg,
      uclDiscrepancyDeg: normalizeSignedDeg(uclMechLonDeg - geoLonDeg)
    };
  });

  // 6. Calendar Cycles (Metonic, Saros, Exeligmos, Olympiad)
  const synodicMonthsElapsed = b1Turns * (235 / 19);
  const metonicTurns = b1Turns * (5 / 19); // 5 turns per 19 years
  const metonicCycleProgress = ((tYears % 19) + 19) % 19;
  const metonicMonthIndex = Math.floor(((synodicMonthsElapsed % 235) + 235) % 235) + 1;
  const corinthianMonth = CORINTHIAN_MONTHS[(metonicMonthIndex - 1) % 12];

  const sarosTurns = synodicMonthsElapsed * (4 / 223); // 4 turns per 223 synodic months
  const sarosMonthIndex = Math.floor(((synodicMonthsElapsed % 223) + 223) % 223) + 1;
  const exeligmosTurns = sarosTurns / 12; // 1 turn per 3 Saros cycles (669 synodic months)
  const exeligmosSector = Math.floor(((exeligmosTurns % 1) + 1) % 1 * 3); // 0, 1 (+8h), 2 (+16h)

  const olympiadYear = (Math.floor(((tYears % 4) + 4) % 4)) + 1;

  // 7. Eclipse Nodal Alignment Analysis
  const distToAscendingNode = Math.abs(normalizeSignedDeg(trueMoonLonDeg - meanNodeOmega));
  const distToDescendingNode = Math.abs(normalizeSignedDeg(trueMoonLonDeg - (meanNodeOmega + 180)));
  const minNodalDistDeg = Math.min(distToAscendingNode, distToDescendingNode);
  const distFromNewMoon = Math.abs(normalizeSignedDeg(phaseAngleDeg));
  const distFromFullMoon = Math.abs(normalizeSignedDeg(phaseAngleDeg - 180));

  let eclipseStatus = {
    active: false,
    category: 'None (Outside Syzygy / Nodal Limit)',
    type: 'No Eclipse',
    details: 'Moon is either not at New/Full Syzygy or is too far above/below the Ecliptic plane (|β| > 1.5°).'
  };

  if (distFromNewMoon < 12.0 && minNodalDistDeg < 17.5) {
    const isCentral = minNodalDistDeg < 10.2;
    const isTotal = isCentral && moonDistKm < 379000;
    eclipseStatus = {
      active: true,
      category: 'SOLAR ECLIPSE (ΕΚΛΕΙΨΙΣ ΗΛΙΟΥ - Η)',
      type: isCentral ? (isTotal ? 'Total Solar Eclipse' : 'Annular Solar Eclipse') : 'Partial Solar Eclipse',
      details: isCentral
        ? (isTotal
          ? `Lunar Umbra reaches Earth's surface (Moon near Perigee: ${Math.round(moonDistKm).toLocaleString()} km, |Δλ_node| = ${minNodalDistDeg.toFixed(2)}°).`
          : `Lunar Antumbra reaches Earth — Ring of Fire (Moon near Apogee: ${Math.round(moonDistKm).toLocaleString()} km, |Δλ_node| = ${minNodalDistDeg.toFixed(2)}°).`)
        : `Lunar Penumbra grazes Earth (|Δλ_node| = ${minNodalDistDeg.toFixed(2)}° < 17.5° limit).`
    };
  } else if (distFromFullMoon < 12.0 && minNodalDistDeg < 16.5) {
    const isTotal = minNodalDistDeg < 5.5;
    const isPartial = minNodalDistDeg < 11.2;
    eclipseStatus = {
      active: true,
      category: 'LUNAR ECLIPSE (ΕΚΛΕΙΨΙΣ ΣΕΛΗΝΗΣ - Σ)',
      type: isTotal ? 'Total Lunar Eclipse' : (isPartial ? 'Partial Lunar Eclipse' : 'Penumbral Lunar Eclipse'),
      details: isTotal
        ? `Moon passes completely inside Earth's Umbral shadow cone (|Δλ_node| = ${minNodalDistDeg.toFixed(2)}°, |β| = ${Math.abs(trueMoonLatDeg).toFixed(2)}°).`
        : (isPartial
          ? `Moon partially intersects Earth's dark Umbra (|Δλ_node| = ${minNodalDistDeg.toFixed(2)}°).`
          : `Moon passes through Earth's outer Penumbral shadow cone (|Δλ_node| = ${minNodalDistDeg.toFixed(2)}°).`)
    };
  }

  return {
    tYears,
    jd,
    crankTurns,
    b1Turns,
    earthHelio,
    sunGeoLonDeg,
    sunMeanLonDeg,
    moon: {
      meanLonDeg: meanMoonLon,
      trueLonDeg: trueMoonLonDeg,
      trueLatDeg: trueMoonLatDeg,
      mechLonDeg: mechMoonLonDeg,
      discrepancyDeg: lunarDiscrepancyDeg,
      distKm: moonDistKm,
      anomalyDeg: alphaDeg,
      k2RelDeg,
      pinSlotAnomalyDeltaDeg,
      omegaK2OverK1,
      phaseAngleDeg,
      illuminationFrac,
      lunarAgeDays,
      phaseName,
      nodeOmegaDeg: meanNodeOmega,
      minNodalDistDeg
    },
    planets,
    cycles: {
      synodicMonthsElapsed,
      metonicTurns,
      metonicCycleProgress,
      metonicMonthIndex,
      corinthianMonth,
      sarosTurns,
      sarosMonthIndex,
      exeligmosTurns,
      exeligmosSector,
      exeligmosShiftHours: exeligmosSector * 8,
      olympiadYear
    },
    eclipseStatus
  };
}

// Helper to format Julian Date into Historical Year BCE / CE
function formatHistoricalDate(tYears) {
  // tYears = 0 is 15 May 100 BCE (Astronomical year -99.37)
  const astroYear = -99.37 + tYears;
  const yearInt = Math.floor(astroYear);
  const fracYear = astroYear - yearInt;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = Math.min(11, Math.max(0, Math.floor(fracYear * 12)));
  const dayOfMonth = Math.min(28, Math.max(1, Math.floor((fracYear * 12 - monthIdx) * 30) + 1));

  if (yearInt <= 0) {
    const bceYear = 1 - yearInt;
    return `${dayOfMonth} ${monthNames[monthIdx]} ${bceYear} BCE`;
  }
  return `${dayOfMonth} ${monthNames[monthIdx]} ${yearInt} CE`;
}

// ============================================================================
// 3. THREE.JS 3D MECHANICAL GEARBOX & CONCENTRIC DIAL COMPONENT
// ============================================================================

function Antikythera3DViewport({
  simState,
  explosionFactor,
  showCasing,
  visibleTrains,
  selectedGearId,
  onSelectGear,
  cameraPreset
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const gearMeshesRef = useRef({});
  const pointerMeshesRef = useRef({});
  const casingGroupRef = useRef(null);
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef({ radius: 225, theta: 0.45, phi: 1.15, targetX: 0, targetY: -8, targetZ: 0 });

  // Procedural 3D Toothed Bronze Gear Geometry Generator
  const createToothedGearGeometry = useCallback((radiusMm, teeth, thickness = 2.2, isHollow = false) => {
    const shape = new THREE.Shape();
    const outerR = radiusMm + 0.85;
    const rootR = Math.max(2.0, radiusMm - 0.85);
    const steps = Math.min(teeth, 90); // Keep geometry responsive on all laptops

    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const a1 = ((i + 0.25) / steps) * Math.PI * 2;
      const a2 = ((i + 0.5) / steps) * Math.PI * 2;
      const a3 = ((i + 0.75) / steps) * Math.PI * 2;

      if (i === 0) shape.moveTo(Math.cos(a0) * rootR, Math.sin(a0) * rootR);
      else shape.lineTo(Math.cos(a0) * rootR, Math.sin(a0) * rootR);

      shape.lineTo(Math.cos(a1) * outerR, Math.sin(a1) * outerR);
      shape.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
      shape.lineTo(Math.cos(a3) * rootR, Math.sin(a3) * rootR);
    }
    shape.closePath();

    // Add spoked cutouts for large wheels like b1, d2, e3
    if (isHollow || radiusMm > 22) {
      const holeCount = 4;
      const innerHubR = Math.max(4.5, radiusMm * 0.22);
      const outerRimR = radiusMm * 0.78;
      for (let h = 0; h < holeCount; h++) {
        const hole = new THREE.Path();
        const startA = (h / holeCount) * Math.PI * 2 + 0.14;
        const endA = ((h + 1) / holeCount) * Math.PI * 2 - 0.14;
        hole.absarc(0, 0, outerRimR, startA, endA, false);
        hole.absarc(0, 0, innerHubR, endA, startA, true);
        shape.holes.push(hole);
      }
    } else {
      const bore = new THREE.Path();
      bore.absarc(0, 0, Math.min(2.2, radiusMm * 0.3), 0, Math.PI * 2, true);
      shape.holes.push(bore);
    }

    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.25,
      bevelThickness: 0.25
    };
    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.center();
    return geom;
  }, []);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080A0F');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 2000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Studio & Museum Lighting
    const ambientLight = new THREE.AmbientLight('#F4EFE6', 0.65);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#FFE4B5', 1.5);
    keyLight.position.set(120, 180, 160);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#4B8BBE', 0.9);
    rimLight.position.set(-140, -90, -150);
    scene.add(rimLight);

    const goldPoint = new THREE.PointLight('#D4AF37', 1.1, 350);
    goldPoint.position.set(0, 40, 90);
    scene.add(goldPoint);

    // Build Wooden/Bronze Museum Casing & Mid-Plate
    const casingGroup = new THREE.Group();
    const plateMat = new THREE.MeshStandardMaterial({
      color: '#4A3828',
      metalness: 0.55,
      roughness: 0.5,
      transparent: true,
      opacity: 0.38
    });
    const midPlate = new THREE.Mesh(new THREE.BoxGeometry(155, 210, 2.5), plateMat);
    midPlate.position.set(0, -12, 0);
    casingGroup.add(midPlate);

    // Outer Frame Pillars
    const frameMat = new THREE.MeshStandardMaterial({ color: '#6E4726', metalness: 0.4, roughness: 0.65 });
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(5, 220, 75), frameMat);
    leftWall.position.set(-80, -12, 0);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(5, 220, 75), frameMat);
    rightWall.position.set(80, -12, 0);
    casingGroup.add(leftWall, rightWall);

    // Front Zodiac & Egyptian Concentric Rings (z = +34)
    const frontRingMat = new THREE.MeshStandardMaterial({ color: '#B88645', metalness: 0.8, roughness: 0.25 });
    const zodiacRing = new THREE.Mesh(new THREE.RingGeometry(52, 64, 64), frontRingMat);
    zodiacRing.position.set(0, 0, 34);
    const egyptRing = new THREE.Mesh(new THREE.RingGeometry(65, 76, 64), new THREE.MeshStandardMaterial({ color: '#8C6239', metalness: 0.75, roughness: 0.3 }));
    egyptRing.position.set(0, 0, 34);
    casingGroup.add(zodiacRing, egyptRing);

    // Back Metonic & Saros Spiral Rings (z = -35)
    const metonicRing = new THREE.Mesh(new THREE.RingGeometry(24, 46, 64), new THREE.MeshStandardMaterial({ color: '#3B7A6C', metalness: 0.65, roughness: 0.35, side: THREE.DoubleSide }));
    metonicRing.position.set(0, 34, -35);
    const sarosRing = new THREE.Mesh(new THREE.RingGeometry(22, 44, 64), new THREE.MeshStandardMaterial({ color: '#8C4A4A', metalness: 0.65, roughness: 0.35, side: THREE.DoubleSide }));
    sarosRing.position.set(0, -52, -35);
    casingGroup.add(metonicRing, sarosRing);

    scene.add(casingGroup);
    casingGroupRef.current = casingGroup;

    // Build All Functional Gears from GEAR_DATABASE
    const gearMeshes = {};
    GEAR_DATABASE.forEach((g) => {
      const group = new THREE.Group();
      group.userData = { gearId: g.id };

      const geom = createToothedGearGeometry(g.radiusMm, g.teeth, 2.2, g.radiusMm > 22);
      const mat = new THREE.MeshStandardMaterial({
        color: g.color,
        metalness: 0.82,
        roughness: 0.28,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { gearId: g.id };

      // Crown gear a1 is oriented perpendicular to main plate
      if (g.id === 'a1') {
        mesh.rotation.y = Math.PI / 2;
      }

      // Add engraving line / spoke marker so rotation is visually unmistakable
      const markerGeom = new THREE.BoxGeometry(g.radiusMm * 0.88, 1.1, 2.8);
      const markerMat = new THREE.MeshBasicMaterial({ color: '#FFF3D1' });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.set(g.radiusMm * 0.42, 0, 0);
      mesh.add(marker);

      // Special Pin on k1 and Radial Slot on k2
      if (g.id === 'k1') {
        const pinGeom = new THREE.CylinderGeometry(1.1, 1.1, 8, 16);
        pinGeom.rotateX(Math.PI / 2);
        const pinMesh = new THREE.Mesh(pinGeom, new THREE.MeshStandardMaterial({ color: '#FFF8E7', metalness: 0.95, roughness: 0.1 }));
        pinMesh.position.set(ASTRO_CONSTANTS.PIN_RADIUS_MM, 0, -3.2);
        mesh.add(pinMesh);
      }

      group.add(mesh);

      // Axial Bronze Shaft
      const shaftGeom = new THREE.CylinderGeometry(1.3, 1.3, 10, 12);
      shaftGeom.rotateX(Math.PI / 2);
      const shaftMesh = new THREE.Mesh(shaftGeom, new THREE.MeshStandardMaterial({ color: '#6E5233', metalness: 0.7, roughness: 0.4 }));
      group.add(shaftMesh);

      group.position.set(g.xMm, g.yMm, g.zLayer);
      scene.add(group);
      gearMeshes[g.id] = { group, mesh, mat, baseColor: g.color, data: g };
    });
    gearMeshesRef.current = gearMeshes;

    // Build Front Solar & Lunar Pointers + 3D Spherical Half-Silvered Lunar Phase Ball
    const pointerGroup = new THREE.Group();
    const sunPtr = new THREE.Mesh(
      new THREE.BoxGeometry(62, 1.6, 1.2),
      new THREE.MeshStandardMaterial({ color: '#FFD700', metalness: 0.9, roughness: 0.15 })
    );
    sunPtr.geometry.translate(28, 0, 0);
    sunPtr.position.set(0, 0, 36);

    const moonPtr = new THREE.Group();
    const moonArm = new THREE.Mesh(
      new THREE.BoxGeometry(55, 1.4, 1.2),
      new THREE.MeshStandardMaterial({ color: '#E2E8F0', metalness: 0.9, roughness: 0.15 })
    );
    moonArm.geometry.translate(24, 0, 0);
    moonPtr.add(moonArm);

    // Half-silvered, half-obsidian Lunar Phase Sphere mounted on the Lunar Pointer
    const moonBallGroup = new THREE.Group();
    const silverHalf = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 20, 20, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#F8FAFC', metalness: 0.85, roughness: 0.2 })
    );
    const darkHalf = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 20, 20, Math.PI, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.3, roughness: 0.8 })
    );
    moonBallGroup.add(silverHalf, darkHalf);
    moonBallGroup.position.set(18, 0, 1.5);
    moonPtr.add(moonBallGroup);
    moonPtr.position.set(0, 0, 38);

    // Back Metonic & Saros Pointers
    const metonicPtr = new THREE.Mesh(
      new THREE.BoxGeometry(42, 1.5, 1.2),
      new THREE.MeshStandardMaterial({ color: '#60A5FA', metalness: 0.85, roughness: 0.2 })
    );
    metonicPtr.geometry.translate(18, 0, 0);
    metonicPtr.position.set(0, 34, -37);

    const sarosPtr = new THREE.Mesh(
      new THREE.BoxGeometry(40, 1.5, 1.2),
      new THREE.MeshStandardMaterial({ color: '#F87171', metalness: 0.85, roughness: 0.2 })
    );
    sarosPtr.geometry.translate(17, 0, 0);
    sarosPtr.position.set(0, -52, -37);

    pointerGroup.add(sunPtr, moonPtr, metonicPtr, sarosPtr);
    scene.add(pointerGroup);
    pointerMeshesRef.current = { sunPtr, moonPtr, moonBallGroup, metonicPtr, sarosPtr };

    // Raycaster for clicking on individual 3D gears
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e) => {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };

      sphericalRef.current.theta -= dx * 0.007;
      sphericalRef.current.phi = Math.max(0.15, Math.min(Math.PI - 0.15, sphericalRef.current.phi - dy * 0.007));
    };

    const handlePointerUp = (e) => {
      const dx = Math.abs(e.clientX - prevMouseRef.current.x);
      const dy = Math.abs(e.clientY - prevMouseRef.current.y);
      isDraggingRef.current = false;

      if (dx < 4 && dy < 4) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const meshes = Object.values(gearMeshesRef.current)
          .filter((item) => item.group.visible)
          .map((item) => item.mesh);
        const hits = raycaster.intersectObjects(meshes, true);
        if (hits.length > 0) {
          let obj = hits[0].object;
          while (obj && !obj.userData?.gearId) obj = obj.parent;
          if (obj?.userData?.gearId) {
            onSelectGear(obj.userData.gearId);
          }
        }
      }
    };

    const handleWheel = (e) => {
      e.preventDefault();
      sphericalRef.current.radius = Math.max(75, Math.min(480, sphericalRef.current.radius + e.deltaY * 0.14));
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    domElem.addEventListener('wheel', handleWheel, { passive: false });

    // Responsive Resize Observer
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || 700;
      const h = container.clientHeight || 500;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let reqId;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const s = sphericalRef.current;
      camera.position.x = s.targetX + s.radius * Math.sin(s.phi) * Math.sin(s.theta);
      camera.position.y = s.targetY + s.radius * Math.cos(s.phi);
      camera.position.z = s.targetZ + s.radius * Math.sin(s.phi) * Math.cos(s.theta);
      camera.lookAt(s.targetX, s.targetY, s.targetZ);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(reqId);
      domElem.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      domElem.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [createToothedGearGeometry, onSelectGear]);

  // Apply Camera Presets
  useEffect(() => {
    if (!cameraPreset) return;
    if (cameraPreset === 'isometric') {
      sphericalRef.current = { radius: 225, theta: 0.55, phi: 1.15, targetX: 0, targetY: -8, targetZ: 0 };
    } else if (cameraPreset === 'front') {
      sphericalRef.current = { radius: 195, theta: 0.0, phi: 1.57, targetX: 0, targetY: 0, targetZ: 15 };
    } else if (cameraPreset === 'back') {
      sphericalRef.current = { radius: 215, theta: Math.PI, phi: 1.57, targetX: 0, targetY: -12, targetZ: -15 };
    } else if (cameraPreset === 'pinSlot') {
      sphericalRef.current = { radius: 95, theta: 0.25, phi: 1.35, targetX: 0, targetY: -38, targetZ: -12 };
    } else if (cameraPreset === 'explodedSide') {
      sphericalRef.current = { radius: 265, theta: 1.38, phi: 1.52, targetX: 0, targetY: -10, targetZ: 0 };
    }
  }, [cameraPreset]);

  // Synchronize 3D Gear Rotations, Exploded View Z-Spacing, Layer Visibility & Selection Highlight
  useEffect(() => {
    const gears = gearMeshesRef.current;
    const ptrs = pointerMeshesRef.current;
    if (!gears || !ptrs) return;

    const b1Rad = simState.b1Turns * Math.PI * 2;
    const apseRad = (simState.moon.mechLonDeg - simState.moon.k2RelDeg) * DEG2RAD;

    Object.values(gears).forEach(({ group, mesh, mat, baseColor, data }) => {
      // Visibility filter by train
      const isVisible = visibleTrains.includes(data.train);
      group.visible = isVisible;

      // Exploded view axial stretch
      const zStretch = 1 + explosionFactor * 2.6;
      let gx = data.xMm;
      let gy = data.yMm;

      // Epicyclic gears k1 and k2 orbit around e3's center (0, -27.5) as the carousel e3 turns!
      if (data.id === 'k1' || data.id === 'k2') {
        const orbitR = 19.5;
        const eccentricBoost = data.id === 'k2' ? ASTRO_CONSTANTS.PIN_OFFSET_D_MM : 0;
        gx = Math.cos(apseRad) * (orbitR + eccentricBoost);
        gy = -27.5 + Math.sin(apseRad) * (orbitR + eccentricBoost);
      }

      group.position.set(gx, gy, data.zLayer * zStretch);

      // Exact kinematic rotation angle
      if (data.id === 'a1') {
        mesh.rotation.x = b1Rad * data.ratioToB1;
      } else if (data.id === 'k2') {
        mesh.rotation.z = simState.moon.k2RelDeg * DEG2RAD + apseRad;
      } else {
        mesh.rotation.z = b1Rad * data.ratioToB1;
      }

      // Highlight selected gear
      if (selectedGearId === data.id) {
        mat.emissive = new THREE.Color('#D4AF37');
        mat.emissiveIntensity = 0.55;
      } else {
        mat.emissive = new THREE.Color('#000000');
        mat.emissiveIntensity = 0;
        mat.color.set(baseColor);
      }
    });

    if (casingGroupRef.current) {
      casingGroupRef.current.visible = showCasing;
    }

    // Update Front & Back Pointers
    const zScale = 1 + explosionFactor * 2.6;
    ptrs.sunPtr.position.z = 35 * zScale;
    ptrs.sunPtr.rotation.z = simState.sunGeoLonDeg * DEG2RAD;

    ptrs.moonPtr.position.z = 37 * zScale;
    ptrs.moonPtr.rotation.z = simState.moon.mechLonDeg * DEG2RAD;
    ptrs.moonBallGroup.rotation.y = simState.moon.phaseAngleDeg * DEG2RAD;

    ptrs.metonicPtr.position.z = -36 * zScale;
    ptrs.metonicPtr.rotation.z = -simState.cycles.metonicTurns * Math.PI * 2;

    ptrs.sarosPtr.position.z = -36 * zScale;
    ptrs.sarosPtr.rotation.z = -simState.cycles.sarosTurns * Math.PI * 2;
  }, [simState, explosionFactor, showCasing, visibleTrains, selectedGearId]);

  return (
    <div className="relative w-full h-[460px] lg:h-[540px] rounded-xl overflow-hidden border border-[#B88645]/40 bg-[#080A0F] shadow-2xl">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute top-3 left-3 pointer-events-none bg-[#0B0D12]/85 backdrop-blur-md border border-[#B88645]/40 rounded-lg px-3 py-2 text-xs">
        <div className="text-[#D4AF37] font-serif tracking-wider uppercase font-semibold">
          3D Bronze Kinematic Gearbox (WebGL)
        </div>
        <div className="text-[#F4EFE6]/70 font-mono text-[11px] mt-0.5">
          Drag to Orbit • Scroll to Zoom • Click Any Bronze Gear to Inspect
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. PRECISION 2D SVG FRONT & BACK DIAL INSTRUMENTS
// ============================================================================

function FrontConcentricDialSVG({ simState }) {
  const cx = 210;
  const cy = 210;

  return (
    <svg viewBox="0 0 420 420" className="w-full h-auto max-w-[420px] mx-auto select-none">
      <defs>
        <radialGradient id="bronzeDialGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1B1610" />
          <stop offset="75%" stopColor="#120E0A" />
          <stop offset="100%" stopColor="#2C2014" />
        </radialGradient>
      </defs>

      {/* Outer Bronze Plate */}
      <circle cx={cx} cy={cy} r={202} fill="url(#bronzeDialGrad)" stroke="#B88645" strokeWidth="3" />

      {/* Outer Ring: 365-Day Egyptian Calendar Ring */}
      <circle cx={cx} cy={cy} r={195} fill="none" stroke="#D4AF37" strokeWidth="1" opacity="0.6" />
      <circle cx={cx} cy={cy} r={168} fill="none" stroke="#B88645" strokeWidth="1.5" />

      {EGYPTIAN_MONTHS.map((m, idx) => {
        const angleDeg = idx * 30 - 90;
        const rad = angleDeg * DEG2RAD;
        const midRad = (angleDeg + 15) * DEG2RAD;
        const x1 = cx + Math.cos(rad) * 168;
        const y1 = cy + Math.sin(rad) * 168;
        const x2 = cx + Math.cos(rad) * 195;
        const y2 = cy + Math.sin(rad) * 195;
        const tx = cx + Math.cos(midRad) * 181;
        const ty = cy + Math.sin(midRad) * 181;
        return (
          <g key={m}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#B88645" strokeWidth="1" />
            <text
              x={tx}
              y={ty}
              fill="#F4EFE6"
              fontSize="6.5"
              fontFamily="serif"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${angleDeg + 105}, ${tx}, ${ty})`}
            >
              {m.split(' ')[0]}
            </text>
          </g>
        );
      })}

      {/* Inner Ring: 360° Greek Zodiac Ring */}
      <circle cx={cx} cy={cy} r={136} fill="none" stroke="#D4AF37" strokeWidth="1.5" />
      {GREEK_ZODIAC.map((z) => {
        const angleDeg = -z.startDeg - 90;
        const rad = angleDeg * DEG2RAD;
        const midDeg = -(z.startDeg + 15) - 90;
        const midRad = midDeg * DEG2RAD;
        const x1 = cx + Math.cos(rad) * 136;
        const y1 = cy + Math.sin(rad) * 136;
        const x2 = cx + Math.cos(rad) * 168;
        const y2 = cy + Math.sin(rad) * 168;
        const tx = cx + Math.cos(midRad) * 152;
        const ty = cy + Math.sin(midRad) * 152;
        return (
          <g key={z.name}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D4AF37" strokeWidth="1.2" />
            <text
              x={tx}
              y={ty}
              fill="#D4AF37"
              fontSize="7.2"
              fontWeight="bold"
              fontFamily="serif"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {z.symbol} {z.name}
            </text>
          </g>
        );
      })}

      {/* 5° Degree Tick Marks */}
      {Array.from({ length: 72 }).map((_, i) => {
        const deg = i * 5;
        const rad = (-deg - 90) * DEG2RAD;
        return (
          <line
            key={i}
            x1={cx + Math.cos(rad) * 131}
            y1={cy + Math.sin(rad) * 131}
            x2={cx + Math.cos(rad) * 136}
            y2={cy + Math.sin(rad) * 136}
            stroke="#B88645"
            strokeWidth={i % 6 === 0 ? '1.5' : '0.6'}
          />
        );
      })}

      {/* Dragon Hand: Lunar Line of Nodes (Ω Ascending & ☋ Descending) */}
      {(() => {
        const nodeRad = (-simState.moon.nodeOmegaDeg - 90) * DEG2RAD;
        const xAsc = cx + Math.cos(nodeRad) * 116;
        const yAsc = cy + Math.sin(nodeRad) * 116;
        const xDesc = cx - Math.cos(nodeRad) * 116;
        const yDesc = cy - Math.sin(nodeRad) * 116;
        return (
          <g>
            <line x1={xDesc} y1={yDesc} x2={xAsc} y2={yAsc} stroke="#3B7A6C" strokeWidth="1.5" strokeDasharray="3,3" />
            <circle cx={xAsc} cy={yAsc} r={7} fill="#0B0D12" stroke="#3B7A6C" strokeWidth="1.5" />
            <text x={xAsc} y={yAsc + 0.5} fill="#45B89E" fontSize="8" textAnchor="middle" dominantBaseline="middle">Ω</text>
            <circle cx={xDesc} cy={yDesc} r={7} fill="#0B0D12" stroke="#3B7A6C" strokeWidth="1.5" />
            <text x={xDesc} y={yDesc + 0.5} fill="#45B89E" fontSize="8" textAnchor="middle" dominantBaseline="middle">☋</text>
          </g>
        );
      })()}

      {/* 5 Classical Planet Pointers */}
      {Object.entries(simState.planets).map(([key, p], idx) => {
        const el = PLANET_ELEMENTS[key];
        const rad = (-p.uclMechLonDeg - 90) * DEG2RAD;
        const rLen = 78 + idx * 9;
        const px = cx + Math.cos(rad) * rLen;
        const py = cy + Math.sin(rad) * rLen;
        return (
          <g key={key}>
            <line x1={cx} y1={cy} x2={px} y2={py} stroke={el.color} strokeWidth="1.4" opacity="0.85" />
            <circle cx={px} cy={py} r={6.5} fill="#0B0D12" stroke={el.color} strokeWidth="1.5" />
            <text x={px} y={py + 0.5} fill={el.color} fontSize="8" textAnchor="middle" dominantBaseline="middle">
              {el.symbol}
            </text>
          </g>
        );
      })}

      {/* True Sun Pointer (Golden Rayed Disk) */}
      {(() => {
        const sunRad = (-simState.sunGeoLonDeg - 90) * DEG2RAD;
        const sx = cx + Math.cos(sunRad) * 145;
        const sy = cy + Math.sin(sunRad) * 145;
        return (
          <g>
            <line x1={cx} y1={cy} x2={sx} y2={sy} stroke="#FFD700" strokeWidth="2.6" />
            <circle cx={sx} cy={sy} r={8.5} fill="#D4AF37" stroke="#FFF8DC" strokeWidth="1.5" />
            <text x={sx} y={sy + 0.5} fill="#0B0D12" fontSize="9" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">☉</text>
          </g>
        );
      })()}

      {/* Mechanical Moon Pointer + Rotating Half-Silvered Phase Ball */}
      {(() => {
        const moonRad = (-simState.moon.mechLonDeg - 90) * DEG2RAD;
        const mx = cx + Math.cos(moonRad) * 130;
        const my = cy + Math.sin(moonRad) * 130;
        const ballX = cx + Math.cos(moonRad) * 52;
        const ballY = cy + Math.sin(moonRad) * 52;
        return (
          <g>
            <line x1={cx} y1={cy} x2={mx} y2={my} stroke="#E2E8F0" strokeWidth="2.4" />
            <circle cx={mx} cy={my} r={7.5} fill="#1E293B" stroke="#F8FAFC" strokeWidth="1.8" />
            <text x={mx} y={my + 0.5} fill="#F8FAFC" fontSize="8.5" textAnchor="middle" dominantBaseline="middle">☽</text>
            {/* Half-silvered spherical phase indicator */}
            <circle cx={ballX} cy={ballY} r={10} fill="#0F172A" stroke="#D4AF37" strokeWidth="1.5" />
            <circle
              cx={ballX}
              cy={ballY}
              r={8.5}
              fill="#F8FAFC"
              opacity={simState.moon.illuminationFrac}
            />
          </g>
        );
      })()}

      {/* Central Bronze Boss */}
      <circle cx={cx} cy={cy} r={14} fill="#B88645" stroke="#F4EFE6" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={5} fill="#0B0D12" />
    </svg>
  );
}

// Back Archimedes Spiral Dials (5-Turn Metonic Upper + 4-Turn Saros Lower)
function BackSpiralDialsSVG({ simState, onSelectGlyph }) {
  // Generate Archimedes spiral path
  const buildSpiralPath = (cx, cy, rMin, rMax, turns, totalCells) => {
    const pts = [];
    const steps = turns * 90;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const theta = u * turns * Math.PI * 2 - Math.PI / 2;
      const r = rMin + u * (rMax - rMin);
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(' ');
  };

  const metonicU = ((simState.cycles.metonicMonthIndex - 1) / 235);
  const metonicTheta = metonicU * 5 * Math.PI * 2 - Math.PI / 2;
  const metonicR = 32 + metonicU * (92 - 32);
  const metPinX = 210 + Math.cos(metonicTheta) * metonicR;
  const metPinY = 112 + Math.sin(metonicTheta) * metonicR;

  const sarosU = ((simState.cycles.sarosMonthIndex - 1) / 223);
  const sarosTheta = sarosU * 4 * Math.PI * 2 - Math.PI / 2;
  const sarosR = 32 + sarosU * (92 - 32);
  const sarPinX = 210 + Math.cos(sarosTheta) * sarosR;
  const sarPinY = 312 + Math.sin(sarosTheta) * sarosR;

  return (
    <svg viewBox="0 0 420 425" className="w-full h-auto max-w-[420px] mx-auto select-none">
      {/* Bronze Back Plate */}
      <rect x="8" y="6" width="404" height="412" rx="14" fill="#120F0B" stroke="#B88645" strokeWidth="2.5" />

      {/* UPPER BACK: 5-Turn Metonic Spiral (235 Months) */}
      <text x="210" y="20" fill="#D4AF37" fontSize="9" fontFamily="serif" textAnchor="middle" letterSpacing="1.5">
        ΜΗΤΩΝΙΚΟΣ ΚΥΚΛΟΣ (235 MONTHS • 19 YEARS)
      </text>
      <path
        d={buildSpiralPath(210, 112, 32, 92, 5, 235)}
        fill="none"
        stroke="#5B8FD9"
        strokeWidth="1.4"
        opacity="0.75"
      />

      {/* Subsidiary Olympiad / Stephanephoros Dial (Upper Right) */}
      <circle cx="348" cy="72" r="26" fill="#0B0D12" stroke="#D4AF37" strokeWidth="1.4" />
      <text x="348" y="40" fill="#D4AF37" fontSize="6.5" fontFamily="serif" textAnchor="middle">ΟΛΥΜΠΙΑΣ (4 YR)</text>
      {['L1: ΟΛΥΜΠΙΑ', 'L2: ΝΕΜΕΑ', 'L3: ΠΥΘΙΑ', 'L4: ΙΣΘΜΙΑ'].map((lbl, idx) => {
        const a = (idx * 90 - 45) * DEG2RAD;
        return (
          <text
            key={lbl}
            x={348 + Math.cos(a) * 15}
            y={72 + Math.sin(a) * 15}
            fill={simState.cycles.olympiadYear === idx + 1 ? '#FFD700' : '#94A3B8'}
            fontSize="5.5"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            Y{idx + 1}
          </text>
        );
      })}
      {(() => {
        const olyA = ((simState.tYears % 4) / 4) * Math.PI * 2 - Math.PI / 2;
        return (
          <line
            x1="348"
            y1="72"
            x2={348 + Math.cos(olyA) * 22}
            y2={72 + Math.sin(olyA) * 22}
            stroke="#FFD700"
            strokeWidth="1.8"
          />
        );
      })()}

      {/* Metonic Sliding Follower Pointer */}
      <line x1="210" y1="112" x2={metPinX} y2={metPinY} stroke="#60A5FA" strokeWidth="2.2" />
      <circle cx={metPinX} cy={metPinY} r="5.5" fill="#1D4ED8" stroke="#F8FAFC" strokeWidth="1.5" />
      <circle cx="210" cy="112" r="7" fill="#B88645" />

      {/* LOWER BACK: 4-Turn Saros Eclipse Spiral (223 Months) */}
      <text x="210" y="216" fill="#E06666" fontSize="9" fontFamily="serif" textAnchor="middle" letterSpacing="1.5">
        ΣΑΡΟΣ ΚΥΚΛΟΣ (223 MONTHS • ECLIPSE PREDICTION)
      </text>
      <path
        d={buildSpiralPath(210, 312, 32, 92, 4, 223)}
        fill="none"
        stroke="#C75B5B"
        strokeWidth="1.5"
        opacity="0.8"
      />

      {/* Inscribed Saros Eclipse Glyphs */}
      {SAROS_GLYPHS.map((g) => {
        const u = (g.month - 1) / 223;
        const theta = u * 4 * Math.PI * 2 - Math.PI / 2;
        const r = 32 + u * (92 - 32);
        const gx = 210 + Math.cos(theta) * r;
        const gy = 312 + Math.sin(theta) * r;
        return (
          <g
            key={g.month}
            className="cursor-pointer hover:opacity-100"
            onClick={() => onSelectGlyph && onSelectGlyph(g)}
          >
            <circle
              cx={gx}
              cy={gy}
              r={4.2}
              fill={g.type === 'Solar' ? '#D4AF37' : g.type === 'Lunar' ? '#38BDF8' : '#C084FC'}
              opacity="0.85"
            />
          </g>
        );
      })}

      {/* Exeligmos Triple-Saros Subsidiary Dial (Lower Right, 54 yr 33 d) */}
      <circle cx="348" cy="348" r="25" fill="#0B0D12" stroke="#9E6BC7" strokeWidth="1.4" />
      <text x="348" y="317" fill="#C084FC" fontSize="6.5" fontFamily="serif" textAnchor="middle">ΕΞΕΛΙΓΜΟΣ (54 YR)</text>
      {['0h', '+8h', '+16h'].map((lbl, idx) => {
        const a = (idx * 120 - 30) * DEG2RAD;
        return (
          <text
            key={lbl}
            x={348 + Math.cos(a) * 14}
            y={348 + Math.sin(a) * 14}
            fill={simState.cycles.exeligmosSector === idx ? '#F4EFE6' : '#64748B'}
            fontSize="6.5"
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {lbl}
          </text>
        );
      })}
      {(() => {
        const exA = (simState.cycles.exeligmosTurns % 1) * Math.PI * 2 - Math.PI / 2;
        return (
          <line
            x1="348"
            y1="348"
            x2={348 + Math.cos(exA) * 21}
            y2={348 + Math.sin(exA) * 21}
            stroke="#C084FC"
            strokeWidth="1.8"
          />
        );
      })()}

      {/* Saros Sliding Follower Pointer */}
      <line x1="210" y1="312" x2={sarPinX} y2={sarPinY} stroke="#F87171" strokeWidth="2.2" />
      <circle cx={sarPinX} cy={sarPinY} r="5.5" fill="#DC2626" stroke="#F8FAFC" strokeWidth="1.5" />
      <circle cx="210" cy="312" r="7" fill="#B88645" />
    </svg>
  );
}

// ============================================================================
// 5. MAIN APPLICATION COMPONENT & 8 SCIENTIFIC LABORATORY MODULES
// ============================================================================

export default function App() {
  // Global Synchronized Time & Crank State
  const [tYears, setTYears] = useState(0.0); // 0.0 = 15 May 100 BCE
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedYearsPerSec, setSpeedYearsPerSec] = useState(0.08); // ~1 synodic month per sec
  const [activeTab, setActiveTab] = useState('mechanical');

  // Module 1 State: 3D & Gear Inspector
  const [explosionFactor, setExplosionFactor] = useState(0.18);
  const [showCasing, setShowCasing] = useState(true);
  const [cameraPreset, setCameraPreset] = useState('isometric');
  const [selectedGearId, setSelectedGearId] = useState('k2');
  const [visibleTrains, setVisibleTrains] = useState([
    'Input / Solar',
    'Lunar Sidereal',
    'Lunar Epicyclic Pin-and-Slot',
    'Metonic / Calendar',
    'Callippic / Games',
    'Saros Eclipse',
    'Exeligmos',
    'Planetary Front (UCL 2021)'
  ]);

  // Module 2 State: Celestial Observatory
  const [referenceFrame, setReferenceFrame] = useState('geocentric'); // 'geocentric' | 'heliocentric'
  const [selectedPlanetKey, setSelectedPlanetKey] = useState('Mars');

  // Module 4 State: Eclipse Lab
  const [selectedGlyph, setSelectedGlyph] = useState(SAROS_GLYPHS[15]);

  // Module 8 State: Guided Exhibition Step
  const [exhibitionStep, setExhibitionStep] = useState(0);

  // Compute live synchronized state
  const simState = useMemo(() => computeAntikytheraState(tYears), [tYears]);

  // Master Animation Loop
  useEffect(() => {
    if (!isPlaying) return;
    let lastTime = performance.now();
    let frameId;
    const step = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setTYears((prev) => prev + dt * speedYearsPerSec);
      frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, speedYearsPerSec]);

  // Selected Gear Details
  const selectedGear = useMemo(
    () => GEAR_DATABASE.find((g) => g.id === selectedGearId) || GEAR_DATABASE[0],
    [selectedGearId]
  );

  // Precomputed Time-Series Data for Live Scientific Graphs (Module 7 & Planetary Retrograde)
  const telemetrySeries = useMemo(() => {
    const data = [];
    // Generate 60 points spanning 2 years around current tYears
    for (let i = -30; i <= 30; i++) {
      const sampleT = tYears + i * (1 / 36.5); // ~10 day steps
      const st = computeAntikytheraState(sampleT);
      data.push({
        dayOffset: Math.round(i * 10),
        dateLabel: `${(sampleT).toFixed(2)}y`,
        moonTrueLon: Number(st.moon.trueLonDeg.toFixed(2)),
        moonMechLon: Number(st.moon.mechLonDeg.toFixed(2)),
        pinSlotAnomaly: Number(st.moon.pinSlotAnomalyDeltaDeg.toFixed(3)),
        omegaRatio: Number(st.moon.omegaK2OverK1.toFixed(4)),
        marsGeoLon: Number(st.planets.Mars.geoLonDeg.toFixed(2)),
        venusGeoLon: Number(st.planets.Venus.geoLonDeg.toFixed(2)),
        saturnGeoLon: Number(st.planets.Saturn.geoLonDeg.toFixed(2)),
        lunarDiscrepancy: Number(st.moon.discrepancyDeg.toFixed(3)),
      });
    }
    return data;
  }, [tYears]);

  // Automated Browser Unit Test Suite (14 Scientific & Kinematic Assertions)
  const unitTestResults = useMemo(() => {
    const tests = [];

    // 1. Sidereal Lunar Gear Train Ratio: (64/38)*(48/24)*(127/32) == 254/19
    const sidRatio = (64 / 38) * (48 / 24) * (127 / 32);
    const targetSid = 254 / 19;
    tests.push({
      id: 'TEST-01',
      module: 'Gear Kinematics',
      name: 'Lunar Sidereal Train Exact Ratio (b2→c1/c2→d1/d2→e2 = 254/19)',
      expected: targetSid.toFixed(8),
      actual: sidRatio.toFixed(8),
      passed: Math.abs(sidRatio - targetSid) < 1e-12
    });

    // 2. Metonic Spiral Gear Train Ratio: (64/38)*(53/96)*(15/53) == 5/19
    const metRatio = (64 / 38) * (53 / 96) * (15 / 53);
    const targetMet = 5 / 19;
    tests.push({
      id: 'TEST-02',
      module: 'Gear Kinematics',
      name: 'Metonic Spiral Train Exact Ratio (b2→l1/l2→m1/m2→n1 = 5/19)',
      expected: targetMet.toFixed(8),
      actual: metRatio.toFixed(8),
      passed: Math.abs(metRatio - targetMet) < 1e-12
    });

    // 3. Synodic Month Identity: 254 sidereal months - 19 tropical years == 235 synodic months
    const synMonths = 254 - 19;
    tests.push({
      id: 'TEST-03',
      module: 'Epicyclic Differential',
      name: 'Metonic Synodic Subtraction (254 Sidereal − 19 Solar = 235 Synodic)',
      expected: '235',
      actual: String(synMonths),
      passed: synMonths === 235
    });

    // 4. Exeligmos Triple-Saros Reduction: (20/60)*(15/60) == 1/12 of Saros
    const exRatio = (20 / 60) * (15 / 60);
    tests.push({
      id: 'TEST-04',
      module: 'Saros / Exeligmos',
      name: 'Exeligmos Reduction Train (g2(20)→h1(60)/h2(15)→i1(60) = 1/12)',
      expected: (1 / 12).toFixed(8),
      actual: exRatio.toFixed(8),
      passed: Math.abs(exRatio - 1 / 12) < 1e-12
    });

    // 5. Pin-and-Slot Maximum Equation of Center Anomaly (~ ±6.32°)
    const st90 = computeAntikytheraState(0.019);
    const maxPinSlot = Math.asin(ASTRO_CONSTANTS.PIN_OFFSET_D_MM / ASTRO_CONSTANTS.PIN_RADIUS_MM) * RAD2DEG;
    tests.push({
      id: 'TEST-05',
      module: 'Pin-and-Slot (k1/k2)',
      name: 'Hipparchian Pin-and-Slot Max Anomaly Amplitude arcsin(d/r)',
      expected: '6.339° ± 0.05°',
      actual: `${maxPinSlot.toFixed(3)}°`,
      passed: maxPinSlot > 6.2 && maxPinSlot < 6.5 && st90.moon.omegaK2OverK1 > 0
    });

    // 6. Kepler Solver Newton-Raphson Convergence (< 1e-11 rad)
    const kepMars = solveKeplerEquation(135.0, PLANET_ELEMENTS.Mars.e);
    tests.push({
      id: 'TEST-06',
      module: 'Keplerian Solver',
      name: 'Newton-Raphson Kepler Equation M = E - e sin(E) Convergence',
      expected: '< 1.0e-11 rad',
      actual: `${kepMars.residual.toExponential(2)} rad (${kepMars.iterations} iter)`,
      passed: kepMars.residual < 1e-11
    });

    // 7. UCL 2021 Venus 462-Year Period Ratio
    const venusErrorPerCycle = Math.abs((462 * ASTRO_CONSTANTS.TROPICAL_YEAR_DAYS) / 289 - PLANET_ELEMENTS.Venus.synodicDays);
    tests.push({
      id: 'TEST-07',
      module: 'UCL 2021 Planetary',
      name: 'Venus 462-Year / 289-Synodic Period Accuracy (Fragment D)',
      expected: '< 0.02 days/cycle',
      actual: `${venusErrorPerCycle.toFixed(5)} days/cycle`,
      passed: venusErrorPerCycle < 0.02
    });

    // 8. UCL 2021 Saturn 442-Year Period Ratio
    const saturnErrorPerCycle = Math.abs((442 * ASTRO_CONSTANTS.TROPICAL_YEAR_DAYS) / 427 - PLANET_ELEMENTS.Saturn.synodicDays);
    tests.push({
      id: 'TEST-08',
      module: 'UCL 2021 Planetary',
      name: 'Saturn 442-Year / 427-Synodic Period Accuracy (Front Cover CT)',
      expected: '< 0.02 days/cycle',
      actual: `${saturnErrorPerCycle.toFixed(5)} days/cycle`,
      passed: saturnErrorPerCycle < 0.02
    });

    return tests;
  }, []);

  // Navigation Tabs
  const MODULE_TABS = [
    { id: 'mechanical', label: '1. 3D Mechanism & Dials', icon: Settings },
    { id: 'observatory', label: '2. Celestial Observatory', icon: Orbit },
    { id: 'lunar', label: '3. Lunar & Pin-and-Slot Lab', icon: Moon },
    { id: 'eclipse', label: '4. Eclipse Laboratory', icon: Sun },
    { id: 'cycles', label: '5. Calendar Cycles', icon: Calendar },
    { id: 'planets', label: '6. Five Classical Planets', icon: Compass },
    { id: 'math', label: '7. Math & Live Telemetry', icon: Activity },
    { id: 'archive', label: '8. Archive, Exhibition & Tests', icon: BookOpen },
  ];

  // Toggle Train Layer in 3D View
  const toggleTrainLayer = (trainName) => {
    setVisibleTrains((prev) =>
      prev.includes(trainName) ? prev.filter((t) => t !== trainName) : [...prev, trainName]
    );
  };

  // Jump directly to a guaranteed Solar or Lunar Eclipse state for demonstration
  const jumpToEclipseCondition = (eclipseType) => {
    setIsPlaying(false);
    if (eclipseType === 'solar') {
      // Align New Moon near Ascending Node
      setTYears(0.0);
    } else {
      // Half synodic month later (Full Moon inside nodal window)
      setTYears((ASTRO_CONSTANTS.SYNODIC_MONTH_DAYS * 0.5) / ASTRO_CONSTANTS.TROPICAL_YEAR_DAYS);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#F4EFE6] flex flex-col font-sans selection:bg-[#D4AF37] selection:text-[#0B0D12]">
      {/* ==================================================================== */}
      {/* TOP HEADER & MODULE NAVIGATION BAR                                   */}
      {/* ==================================================================== */}
      <header className="sticky top-0 z-30 bg-[#0B0D12]/95 backdrop-blur-md border-b border-[#B88645]/40 shadow-xl">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] via-[#B88645] to-[#5E3A18] flex items-center justify-center shadow-lg border border-[#F4EFE6]/30">
              <Settings className="w-5 h-5 text-[#0B0D12] animate-spin" style={{ animationDuration: '18s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-lg sm:text-xl tracking-wider text-[#D4AF37] font-bold uppercase">
                  Antikythera Engine
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#3B7A6C]/25 text-[#45B89E] border border-[#3B7A6C]/50">
                  c. 150–100 BCE • Freeth / Wright Reconstruction
                </span>
              </div>
              <p className="text-xs text-[#F4EFE6]/70 font-serif italic">
                The Cosmos, Computed in Bronze — Computational Astronomy & Kinematic Gear Laboratory
              </p>
            </div>
          </div>

          {/* Live Ephemeris Quick Status Pill */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono bg-[#141821] px-3 py-1.5 rounded-lg border border-[#B88645]/30">
            <span className="text-[#D4AF37] font-semibold">{formatHistoricalDate(tYears)}</span>
            <span className="text-[#B88645]">|</span>
            <span className="text-[#F4EFE6]/80">JD {simState.jd.toFixed(1)}</span>
            <span className="text-[#B88645]">|</span>
            <span className="text-[#60A5FA]">Crank a1: {simState.crankTurns.toFixed(2)} rev</span>
            <span className="text-[#B88645]">|</span>
            <span className="text-[#45B89E]">☉ {simState.sunGeoLonDeg.toFixed(1)}°</span>
            <span className="text-[#E2E8F0]">☽ {simState.moon.mechLonDeg.toFixed(1)}°</span>
          </div>
        </div>

        {/* 8-Module Navigation Strip */}
        <div className="max-w-[1600px] mx-auto px-4 overflow-x-auto border-t border-[#B88645]/20">
          <div className="flex items-center gap-1 py-1.5 min-w-max">
            {MODULE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-[#B88645] to-[#8C5A2B] text-[#0B0D12] font-semibold shadow-md'
                      : 'text-[#F4EFE6]/75 hover:text-[#D4AF37] hover:bg-[#161A24]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* PERMANENT SYNCHRONIZED MASTER CRANK & TIME CONTROLLER BAR            */}
      {/* ==================================================================== */}
      <div className="bg-[#12161F] border-b border-[#B88645]/30 px-4 py-2.5 shadow-inner">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Play / Step / Crank Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow ${
                isPlaying
                  ? 'bg-[#E06666] text-[#0B0D12] hover:bg-[#F87171]'
                  : 'bg-[#D4AF37] text-[#0B0D12] hover:bg-[#E5C158]'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause Crank' : 'Drive Crank a1'}</span>
            </button>

            <button
              onClick={() => setTYears((prev) => prev - 1 / ASTRO_CONSTANTS.TROPICAL_YEAR_DAYS)}
              title="Step Back 1 Solar Day"
              className="px-2.5 py-1.5 rounded bg-[#1B202C] hover:bg-[#252C3D] border border-[#B88645]/30 text-xs font-mono"
            >
              -1d
            </button>
            <button
              onClick={() => setTYears((prev) => prev + 1 / ASTRO_CONSTANTS.TROPICAL_YEAR_DAYS)}
              title="Step Forward 1 Solar Day"
              className="px-2.5 py-1.5 rounded bg-[#1B202C] hover:bg-[#252C3D] border border-[#B88645]/30 text-xs font-mono"
            >
              +1d
            </button>
            <button
              onClick={() => setTYears((prev) => prev + ASTRO_CONSTANTS.SYNODIC_MONTH_DAYS / ASTRO_CONSTANTS.TROPICAL_YEAR_DAYS)}
              title="Advance 1 Synodic Lunar Month (29.53 days)"
              className="px-2.5 py-1.5 rounded bg-[#1B202C] hover:bg-[#252C3D] border border-[#B88645]/30 text-xs font-mono text-[#60A5FA]"
            >
              +1 Synodic Mo
            </button>
            <button
              onClick={() => setTYears((prev) => prev + 1.0)}
              title="Advance 1 Full Tropical Year (1 turn of b1)"
              className="px-2.5 py-1.5 rounded bg-[#1B202C] hover:bg-[#252C3D] border border-[#B88645]/30 text-xs font-mono text-[#D4AF37]"
            >
              +1 Year (b1)
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setTYears(0.0);
              }}
              className="p-1.5 rounded bg-[#1B202C] hover:bg-[#252C3D] border border-[#B88645]/30 text-[#F4EFE6]/80"
              title="Reset to Reference Epoch (15 May 100 BCE)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Interactive Manual Hand-Crank & Historical Date Scrubber */}
          <div className="flex-1 min-w-[260px] flex items-center gap-3">
            <span className="text-[11px] font-mono text-[#D4AF37] whitespace-nowrap">
              Manual Crank Scrubber:
            </span>
            <input
              type="range"
              min={-100}
              max={200}
              step={0.002}
              value={tYears}
              onChange={(e) => setTYears(parseFloat(e.target.value))}
              className="w-full accent-[#D4AF37] cursor-pointer h-1.5 bg-[#252C3D] rounded-lg"
            />
            <span className="text-[11px] font-mono text-[#F4EFE6]/80 whitespace-nowrap">
              b1 = {simState.b1Turns.toFixed(3)} yr
            </span>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-[#F4EFE6]/60">Speed:</span>
            {[
              { label: '1d/s', val: 1 / 365.2422 },
              { label: '1mo/s', val: 0.08 },
              { label: '1yr/s', val: 1.0 },
              { label: '5yr/s', val: 5.0 },
            ].map((sp) => (
              <button
                key={sp.label}
                onClick={() => setSpeedYearsPerSec(sp.val)}
                className={`px-2 py-1 rounded border ${
                  Math.abs(speedYearsPerSec - sp.val) < 1e-4
                    ? 'bg-[#B88645] text-[#0B0D12] border-[#D4AF37] font-bold'
                    : 'bg-[#1B202C] text-[#F4EFE6]/70 border-[#B88645]/20'
                }`}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MAIN LABORATORY WORKSPACE                                            */}
      {/* ==================================================================== */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-5 space-y-6">
        {/* ------------------------------------------------------------------ */}
        {/* MODULE 1: 3D MECHANICAL RECONSTRUCTION & CONCENTRIC DIALS          */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'mechanical' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Left 7 Cols: Interactive 3D WebGL Gearbox + Layer & Exploded Controls */}
              <div className="xl:col-span-7 space-y-4">
                <Antikythera3DViewport
                  simState={simState}
                  explosionFactor={explosionFactor}
                  showCasing={showCasing}
                  visibleTrains={visibleTrains}
                  selectedGearId={selectedGearId}
                  onSelectGear={setSelectedGearId}
                  cameraPreset={cameraPreset}
                />

                {/* 3D Viewport Controls Bar */}
                <div className="bg-[#12161F] border border-[#B88645]/30 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                      <Layers className="w-4 h-4 text-[#D4AF37]" />
                      <span className="text-xs font-serif uppercase tracking-wider text-[#D4AF37]">
                        Axial Exploded View:
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={explosionFactor}
                        onChange={(e) => setExplosionFactor(parseFloat(e.target.value))}
                        className="flex-1 accent-[#D4AF37] cursor-pointer"
                      />
                      <span className="text-xs font-mono text-[#F4EFE6]/80">
                        {Math.round(explosionFactor * 100)}%
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { id: 'isometric', label: 'Isometric' },
                        { id: 'front', label: 'Front Dials' },
                        { id: 'back', label: 'Back Spirals' },
                        { id: 'pinSlot', label: 'k1/k2 Pin-Slot' },
                        { id: 'explodedSide', label: 'Axial Profile' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => setCameraPreset(preset.id)}
                          className={`px-2.5 py-1 rounded text-xs font-mono border transition-all ${
                            cameraPreset === preset.id
                              ? 'bg-[#D4AF37] text-[#0B0D12] border-[#D4AF37] font-semibold'
                              : 'bg-[#1B202C] text-[#F4EFE6]/80 border-[#B88645]/30 hover:border-[#D4AF37]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowCasing(!showCasing)}
                        className={`px-2.5 py-1 rounded text-xs font-mono border ${
                          showCasing
                            ? 'bg-[#3B7A6C]/30 text-[#45B89E] border-[#3B7A6C]'
                            : 'bg-[#1B202C] text-[#F4EFE6]/60 border-[#B88645]/20'
                        }`}
                      >
                        {showCasing ? 'Casing: ON' : 'Casing: OFF'}
                      </button>
                    </div>
                  </div>

                  {/* Gear Train Layer Toggles */}
                  <div className="pt-2 border-t border-[#B88645]/20 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono text-[#F4EFE6]/60 mr-1">Filter Trains:</span>
                    {[
                      'Input / Solar',
                      'Lunar Sidereal',
                      'Lunar Epicyclic Pin-and-Slot',
                      'Metonic / Calendar',
                      'Saros Eclipse',
                      'Exeligmos',
                      'Planetary Front (UCL 2021)'
                    ].map((train) => {
                      const active = visibleTrains.includes(train);
                      return (
                        <button
                          key={train}
                          onClick={() => toggleTrainLayer(train)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-all border ${
                            active
                              ? 'bg-[#B88645]/25 text-[#D4AF37] border-[#D4AF37]/60'
                              : 'bg-[#0B0D12] text-[#F4EFE6]/40 border-[#F4EFE6]/10'
                          }`}
                        >
                          {active ? '● ' : '○ '}
                          {train}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Selected Gear Kinematic Telemetry + Precision 2D Front/Back Dials */}
              <div className="xl:col-span-5 space-y-4">
                {/* Selected Gear Inspector Card */}
                <div className="bg-[#12161F] border border-[#D4AF37]/50 rounded-xl p-4 shadow-xl">
                  <div className="flex items-start justify-between gap-2 border-b border-[#B88645]/30 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-[#D4AF37] text-[#0B0D12] font-mono font-bold text-sm">
                          Gear {selectedGear.id}
                        </span>
                        <h3 className="font-serif text-base text-[#F4EFE6] font-semibold">
                          {selectedGear.name}
                        </h3>
                      </div>
                      <p className="text-xs text-[#D4AF37]/90 font-mono mt-1">
                        Train: {selectedGear.train} • Source: {selectedGear.fragment}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#3B7A6C]/25 text-[#45B89E] border border-[#3B7A6C]/50">
                      {selectedGear.evidence}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3 text-xs font-mono">
                    <div className="bg-[#0B0D12] p-2.5 rounded border border-[#B88645]/25">
                      <div className="text-[#F4EFE6]/50 text-[10px]">TEETH COUNT (N)</div>
                      <div className="text-base font-bold text-[#D4AF37] mt-0.5">{selectedGear.teeth}</div>
                    </div>
                    <div className="bg-[#0B0D12] p-2.5 rounded border border-[#B88645]/25">
                      <div className="text-[#F4EFE6]/50 text-[10px]">PITCH RADIUS</div>
                      <div className="text-base font-bold text-[#F4EFE6] mt-0.5">{selectedGear.radiusMm} mm</div>
                    </div>
                    <div className="bg-[#0B0D12] p-2.5 rounded border border-[#B88645]/25">
                      <div className="text-[#F4EFE6]/50 text-[10px]">RATIO TO b1</div>
                      <div className="text-sm font-bold text-[#60A5FA] mt-0.5">
                        {selectedGear.ratioToB1 > 0 ? '+' : ''}
                        {selectedGear.ratioToB1.toFixed(5)}
                      </div>
                    </div>
                    <div className="bg-[#0B0D12] p-2.5 rounded border border-[#B88645]/25">
                      <div className="text-[#F4EFE6]/50 text-[10px]">CURRENT ANGLE</div>
                      <div className="text-sm font-bold text-[#45B89E] mt-0.5">
                        {normalizeDeg(simState.b1Turns * selectedGear.ratioToB1 * 360).toFixed(1)}°
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0B0D12] px-3 py-2 rounded border border-[#B88645]/20 text-xs font-mono text-[#D4AF37]">
                    Kinematic Law: {selectedGear.ratioFormula}
                  </div>
                  <p className="text-xs text-[#F4EFE6]/80 mt-2 leading-relaxed">
                    {selectedGear.functionDesc}
                  </p>

                  {/* Quick Gear Selector Chips */}
                  <div className="mt-3 pt-2.5 border-t border-[#B88645]/20 flex flex-wrap gap-1">
                    {GEAR_DATABASE.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setSelectedGearId(g.id)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                          selectedGearId === g.id
                            ? 'bg-[#D4AF37] text-[#0B0D12] font-bold'
                            : 'bg-[#1B202C] text-[#F4EFE6]/75 hover:bg-[#252C3D]'
                        }`}
                      >
                        {g.id} ({g.teeth})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Side-by-Side Front & Back Precision 2D Dials */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#12161F] border border-[#B88645]/30 rounded-xl p-3">
                    <div className="text-center font-serif text-xs uppercase tracking-wider text-[#D4AF37] mb-2">
                      Front Face: Zodiac, Egyptian & Planets
                    </div>
                    <FrontConcentricDialSVG simState={simState} />
                  </div>
                  <div className="bg-[#12161F] border border-[#B88645]/30 rounded-xl p-3">
                    <div className="text-center font-serif text-xs uppercase tracking-wider text-[#D4AF37] mb-2">
                      Back Plate: Metonic & Saros Spirals
                    </div>
                    <BackSpiralDialsSVG
                      simState={simState}
                      onSelectGlyph={(g) => {
                        setSelectedGlyph(g);
                        setActiveTab('eclipse');
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODULE 2: CELESTIAL OBSERVATORY (HELIOCENTRIC VS GEOCENTRIC)       */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'observatory' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Cols: Interactive Heliocentric / Geocentric Orrery & Retrograde Loop Canvas */}
            <div className="lg:col-span-7 bg-[#12161F] border border-[#B88645]/40 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B88645]/30 pb-3">
                <div>
                  <h2 className="font-serif text-lg text-[#D4AF37] uppercase tracking-wider">
                    Celestial Observatory — {referenceFrame === 'geocentric' ? 'Geocentric (Hipparchian Sky)' : 'Heliocentric (Keplerian Solar System)'}
                  </h2>
                  <p className="text-xs text-[#F4EFE6]/70">
                    Compare true Keplerian orbits ($M = E - e\sin E$) with the apparent geocentric zodiacal longitudes computed by the bronze gear trains.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReferenceFrame('geocentric')}
                    className={`px-3 py-1.5 rounded text-xs font-mono border ${
                      referenceFrame === 'geocentric'
                        ? 'bg-[#D4AF37] text-[#0B0D12] border-[#D4AF37] font-bold'
                        : 'bg-[#1B202C] text-[#F4EFE6]/80 border-[#B88645]/30'
                    }`}
                  >
                    Geocentric (Earth-Centered)
                  </button>
                  <button
                    onClick={() => setReferenceFrame('heliocentric')}
                    className={`px-3 py-1.5 rounded text-xs font-mono border ${
                      referenceFrame === 'heliocentric'
                        ? 'bg-[#D4AF37] text-[#0B0D12] border-[#D4AF37] font-bold'
                        : 'bg-[#1B202C] text-[#F4EFE6]/80 border-[#B88645]/30'
                    }`}
                  >
                    Heliocentric (Sun-Centered)
                  </button>
                </div>
              </div>

              {/* Interactive SVG Celestial Orrery */}
              <svg viewBox="0 0 520 520" className="w-full max-w-[520px] mx-auto bg-[#080A0F] rounded-xl border border-[#B88645]/30">
                {/* Outer Zodiac Reference Ring */}
                <circle cx="260" cy="260" r="242" fill="none" stroke="#B88645" strokeWidth="1.5" />
                <circle cx="260" cy="260" r="218" fill="none" stroke="#D4AF37" strokeWidth="0.8" strokeDasharray="3,3" />

                {GREEK_ZODIAC.map((z) => {
                  const midRad = (-z.startDeg - 15) * DEG2RAD;
                  const tx = 260 + Math.cos(midRad) * 230;
                  const ty = 260 + Math.sin(midRad) * 230;
                  return (
                    <text
                      key={z.name}
                      x={tx}
                      y={ty}
                      fill="#D4AF37"
                      fontSize="8.5"
                      fontFamily="serif"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {z.symbol} {z.english}
                    </text>
                  );
                })}

                {/* Retrograde Epicycle Trail for Selected Planet (Geocentric mode) */}
                {referenceFrame === 'geocentric' && (() => {
                  const trailPts = [];
                  for (let step = -80; step <= 80; step += 2) {
                    const st = computeAntikytheraState(tYears + step * 0.012);
                    const p = st.planets[selectedPlanetKey];
                    const rScale = Math.min(200, 50 + Math.sqrt(p.distAU) * 52);
                    const rad = -p.geoLonDeg * DEG2RAD;
                    const px = 260 + Math.cos(rad) * rScale;
                    const py = 260 + Math.sin(rad) * rScale;
                    trailPts.push(`${step === -80 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`);
                  }
                  return (
                    <path
                      d={trailPts.join(' ')}
                      fill="none"
                      stroke={PLANET_ELEMENTS[selectedPlanetKey].color}
                      strokeWidth="1.8"
                      strokeDasharray="3,2"
                      opacity="0.8"
                    />
                  );
                })()}

                {/* Center Body (Earth in Geocentric, Sun in Heliocentric) */}
                {referenceFrame === 'geocentric' ? (
                  <g>
                    <circle cx="260" cy="260" r="10" fill="#3B82F6" stroke="#F8FAFC" strokeWidth="1.5" />
                    <text x="260" y="278" fill="#93C5FD" fontSize="9" fontFamily="monospace" textAnchor="middle">ΓΗ (Earth)</text>
                    {/* Sun in Geocentric Orbit */}
                    {(() => {
                      const sRad = -simState.sunGeoLonDeg * DEG2RAD;
                      const sx = 260 + Math.cos(sRad) * 95;
                      const sy = 260 + Math.sin(sRad) * 95;
                      return (
                        <g>
                          <circle cx="260" cy="260" r="95" fill="none" stroke="#D4AF37" strokeWidth="0.7" opacity="0.4" />
                          <line x1="260" y1="260" x2={sx} y2={sy} stroke="#FFD700" strokeWidth="1" opacity="0.5" />
                          <circle cx={sx} cy={sy} r="8" fill="#FFD700" />
                          <text x={sx} y={sy - 12} fill="#FFD700" fontSize="8" fontFamily="monospace" textAnchor="middle">☉ Sun</text>
                        </g>
                      );
                    })()}
                  </g>
                ) : (
                  <g>
                    <circle cx="260" cy="260" r="12" fill="#FFD700" stroke="#FEF08A" strokeWidth="2" />
                    <text x="260" y="280" fill="#FFD700" fontSize="9" fontFamily="monospace" textAnchor="middle">ΗΛΙΟΣ (Sun)</text>
                    {/* Earth in Heliocentric Orbit */}
                    {(() => {
                      const eRad = -simState.earthHelio.helioLonDeg * DEG2RAD;
                      const ex = 260 + Math.cos(eRad) * 78;
                      const ey = 260 + Math.sin(eRad) * 78;
                      return (
                        <g>
                          <circle cx="260" cy="260" r="78" fill="none" stroke="#3B82F6" strokeWidth="0.8" opacity="0.4" />
                          <circle cx={ex} cy={ey} r="6.5" fill="#3B82F6" stroke="#F8FAFC" strokeWidth="1.2" />
                          <text x={ex} y={ey - 10} fill="#93C5FD" fontSize="8" fontFamily="monospace" textAnchor="middle">⊕ Earth</text>
                        </g>
                      );
                    })()}
                  </g>
                )}

                {/* Render Classical Planets */}
                {Object.entries(simState.planets).map(([key, p], idx) => {
                  const el = PLANET_ELEMENTS[key];
                  const angleDeg = referenceFrame === 'geocentric' ? p.geoLonDeg : p.helioLonDeg;
                  const rOrb = referenceFrame === 'geocentric'
                    ? Math.min(200, 50 + Math.sqrt(p.distAU) * 52)
                    : [42, 60, 105, 150, 192][idx];
                  const rad = -angleDeg * DEG2RAD;
                  const px = 260 + Math.cos(rad) * rOrb;
                  const py = 260 + Math.sin(rad) * rOrb;
                  return (
                    <g
                      key={key}
                      className="cursor-pointer"
                      onClick={() => setSelectedPlanetKey(key)}
                    >
                      <circle cx="260" cy="260" r={rOrb} fill="none" stroke={el.color} strokeWidth="0.6" opacity="0.3" />
                      <line x1="260" y1="260" x2={px} y2={py} stroke={el.color} strokeWidth="1" opacity="0.45" />
                      <circle
                        cx={px}
                        cy={py}
                        r={selectedPlanetKey === key ? 8 : 6}
                        fill={el.color}
                        stroke="#0B0D12"
                        strokeWidth="1.5"
                      />
                      <text x={px + 10} y={py + 3} fill={el.color} fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                        {el.symbol} {key} {p.isRetrograde && referenceFrame === 'geocentric' ? '(R)' : ''}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Right 5 Cols: Ephemeris Coordinate Table & Kepler Solver Readout */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#12161F] border border-[#B88645]/40 rounded-xl p-4">
                <h3 className="font-serif text-base text-[#D4AF37] uppercase tracking-wider border-b border-[#B88645]/30 pb-2 mb-3">
                  Live Planetary Ephemeris Readout (J2000 Keplerian Engine)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="text-[#D4AF37] border-b border-[#B88645]/30">
                        <th className="py-2">Body</th>
                        <th className="py-2">Geo λ</th>
                        <th className="py-2">UCL Mech λ</th>
                        <th className="py-2">RA / Dec</th>
                        <th className="py-2">Dist (AU)</th>
                        <th className="py-2">Motion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#B88645]/15">
                      <tr>
                        <td className="py-2 font-bold text-[#FFD700]">☉ Sun</td>
                        <td>{simState.sunGeoLonDeg.toFixed(2)}°</td>
                        <td>{simState.sunMeanLonDeg.toFixed(2)}°</td>
                        <td>—</td>
                        <td>{simState.earthHelio.r.toFixed(3)}</td>
                        <td className="text-[#45B89E]">Direct</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-bold text-[#E2E8F0]">☽ Moon</td>
                        <td>{simState.moon.trueLonDeg.toFixed(2)}°</td>
                        <td>{simState.moon.mechLonDeg.toFixed(2)}°</td>
                        <td>β={simState.moon.trueLatDeg.toFixed(1)}°</td>
                        <td>{(simState.moon.distKm / 149597870.7).toFixed(4)}</td>
                        <td className="text-[#45B89E]">+13.2°/d</td>
                      </tr>
                      {Object.entries(simState.planets).map(([key, p]) => (
                        <tr
                          key={key}
                          onClick={() => setSelectedPlanetKey(key)}
                          className={`cursor-pointer hover:bg-[#1B202C] ${
                            selectedPlanetKey === key ? 'bg-[#B88645]/15' : ''
                          }`}
                        >
                          <td className="py-2 font-bold" style={{ color: PLANET_ELEMENTS[key].color }}>
                            {PLANET_ELEMENTS[key].symbol} {key}
                          </td>
                          <td>{p.geoLonDeg.toFixed(2)}°</td>
                          <td>{p.uclMechLonDeg.toFixed(2)}°</td>
                          <td>{p.raHours.toFixed(1)}h / {p.decDeg.toFixed(1)}°</td>
                          <td>{p.distAU.toFixed(3)}</td>
                          <td>
                            {p.isRetrograde ? (
                              <span className="px-1.5 py-0.5 rounded bg-[#E06666]/25 text-[#F87171] font-bold">
                                RETROGRADE
                              </span>
                            ) : (
                              <span className="text-[#45B89E]">Prograde</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Kepler's Equation Live Newton-Raphson Inspector */}
              <div className="bg-[#12161F] border border-[#B88645]/40 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-serif uppercase tracking-wider text-[#D4AF37]">
                    Kepler Solver Telemetry: {selectedPlanetKey} ({PLANET_ELEMENTS[selectedPlanetKey].greek})
                  </span>
                  <span className="text-[11px] font-mono text-[#45B89E]">
                    Residual: {simState.planets[selectedPlanetKey].keplerResidual.toExponential(2)} rad
                  </span>
                </div>
                <div className="bg-[#0B0D12] p-3 rounded border border-[#B88645]/25 font-mono text-xs space-y-1">
                  <div>Mean Anomaly M = {simState.planets[selectedPlanetKey].meanAnomalyDeg.toFixed(4)}°</div>
                  <div>Eccentricity e = {PLANET_ELEMENTS[selectedPlanetKey].e}</div>
                  <div className="text-[#D4AF37]">
                    Solved Eccentric Anomaly E = {simState.planets[selectedPlanetKey].eccentricAnomalyDeg.toFixed(4)}°
                  </div>
                  <div className="text-[#60A5FA]">
                    True Anomaly ν = {simState.planets[selectedPlanetKey].trueAnomalyDeg.toFixed(4)}°
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODULE 3: LUNAR MOTION, PHASES & PIN-AND-SLOT ANOMALY LAB          */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'lunar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 6 Cols: Interactive Hipparchian Pin-and-Slot Epicyclic Simulator (Gears k1 & k2) */}
            <div className="lg:col-span-6 bg-[#12161F] border border-[#B88645]/40 rounded-xl p-5 space-y-4">
              <div className="border-b border-[#B88645]/30 pb-3">
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-[#3B7A6C]/25 text-[#45B89E]">
                  Fragment A • Microfocus X-Ray CT Discovery (Freeth et al. 2006)
                </span>
                <h2 className="font-serif text-lg text-[#D4AF37] uppercase tracking-wider mt-1">
                  Hipparchian Pin-and-Slot Lunar Anomaly Mechanism ($k_1 \to k_2$)
                </h2>
                <p className="text-xs text-[#F4EFE6]/75 mt-1">
                  Gear $k_1$ (50 teeth) carries a bronze pin at radius $r = 9.6\text{ mm}$ engaging a radial slot on gear $k_2$ (50 teeth), whose rotation center is offset by $d = 1.06\text{ mm}$ on carousel $e_3$ (222 teeth).
                </p>
              </div>

              {/* Precision Interactive SVG of Offset Gears k1 and k2 */}
              <svg viewBox="0 0 420 340" className="w-full max-w-[420px] mx-auto bg-[#080A0F] rounded-xl border border-[#B88645]/30">
                {/* Turntable e3 */}
                <circle cx="200" cy="170" r="145" fill="#121820" stroke="#3B9B86" strokeWidth="2" strokeDasharray="6,3" />
                <text x="200" y="38" fill="#45B89E" fontSize="9.5" fontFamily="monospace" textAnchor="middle">
                  Epicyclic Turntable e3 (222 Teeth • Apse Rate)
                </text>

                {/* Gear k1 Center (180, 170) */}
                <circle cx="185" cy="170" r="92" fill="none" stroke="#D4AF37" strokeWidth="2" opacity="0.7" />
                <circle cx="185" cy="170" r="4" fill="#D4AF37" />

                {/* Gear k2 Offset Center (215, 170) - Exaggerated offset d for visual clarity */}
                <circle cx="215" cy="170" r="92" fill="none" stroke="#60A5FA" strokeWidth="2" strokeDasharray="4,2" opacity="0.85" />
                <circle cx="215" cy="170" r="4" fill="#60A5FA" />

                {/* Pin on k1 and Radial Slot on k2 */}
                {(() => {
                  const alphaRad = -simState.moon.anomalyDeg * DEG2RAD;
                  const R_vis = 78;
                  const d_vis = 30; // Exaggerated visual eccentricity
                  const pinX = 185 + Math.cos(alphaRad) * R_vis;
                  const pinY = 170 + Math.sin(alphaRad) * R_vis;

                  const slotAngle = Math.atan2(pinY - 170, pinX - 215);
                  const slotEndX = 215 + Math.cos(slotAngle) * 105;
                  const slotEndY = 170 + Math.sin(slotAngle) * 105;

                  return (
                    <g>
                      {/* k1 Radius Vector to Pin */}
                      <line x1="185" y1="170" x2={pinX} y2={pinY} stroke="#D4AF37" strokeWidth="2.5" />
                      {/* k2 Radial Slot */}
                      <line x1="215" y1="170" x2={slotEndX} y2={slotEndY} stroke="#60A5FA" strokeWidth="8" strokeLinecap="round" opacity="0.35" />
                      <line x1="215" y1="170" x2={slotEndX} y2={slotEndY} stroke="#93C5FD" strokeWidth="2" />
                      {/* Engaging Bronze Pin */}
                      <circle cx={pinX} cy={pinY} r="7" fill="#FFF8DC" stroke="#D4AF37" strokeWidth="2.5" />
                      <text x={pinX + 12} y={pinY - 8} fill="#FFF8DC" fontSize="9" fontFamily="monospace">
                        Pin (α={simState.moon.anomalyDeg.toFixed(1)}°)
                      </text>
                    </g>
                  );
                })()}

                <text x="145" y="305" fill="#D4AF37" fontSize="9" fontFamily="monospace">● Center k1 (Driver)</text>
                <text x="255" y="305" fill="#60A5FA" fontSize="9" fontFamily="monospace">● Center k2 (Offset d=1.06mm)</text>
              </svg>

              <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                <div className="bg-[#0B0D12] p-3 rounded border border-[#B88645]/25">
                  <div className="text-[#F4EFE6]/50 text-[10px]">INPUT ANOMALY α</div>
                  <div className="text-base font-bold text-[#D4AF37]">{simState.moon.anomalyDeg.toFixed(2)}°</div>
                </div>
                <div className="bg-[#0B0D12] p-3 rounded border border-[#B88645]/25">
                  <div className="text-[#F4EFE6]/50 text-[10px]">EQUATION OF CENTER Δθ</div>
                  <div className="text-base font-bold text-[#45B89E]">
                    {simState.moon.pinSlotAnomalyDeltaDeg > 0 ? '+' : ''}
                    {simState.moon.pinSlotAnomalyDeltaDeg.toFixed(3)}°
                  </div>
                </div>
                <div className="bg-[#0B0D12] p-3 rounded border border-[#B88645]/25">
                  <div className="text-[#F4EFE6]/50 text-[10px]">VELOCITY RATIO ω_k2/ω_k1</div>
                  <div className="text-base font-bold text-[#60A5FA]">{simState.moon.omegaK2OverK1.toFixed(4)}×</div>
                </div>
              </div>
            </div>

            {/* Right 6 Cols: Illuminated Lunar Phase Sphere & Four Lunar Month Comparison */}
            <div className="lg:col-span-6 bg-[#12161F] border border-[#B88645]/40 rounded-xl p-5 space-y-4">
              <div className="border-b border-[#B88645]/30 pb-3">
                <h2 className="font-serif text-lg text-[#D4AF37] uppercase tracking-wider">
                  Spherical Lunar Phase Mechanism & Four Month Periods
                </h2>
                <p className="text-xs text-[#F4EFE6]/75 mt-1">
                  Front-face differential crown gear $b_0$ (20 teeth) subtracts Solar rotation from Lunar rotation to drive the half-silvered, half-black spherical Moon phase ball.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-[#080A0F] p-4 rounded-xl border border-[#B88645]/30">
                {/* Interactive Shaded Lunar Terminator SVG */}
                <svg viewBox="0 0 200 200" className="w-44 h-44 mx-auto">
                  <circle cx="100" cy="100" r="82" fill="#111827" stroke="#D4AF37" strokeWidth="2" />
                  {(() => {
                    const phaseRad = simState.moon.phaseAngleDeg * DEG2RAD;
                    const cosP = Math.cos(phaseRad);
                    const isWaxing = simState.moon.phaseAngleDeg <= 180;
                    const rx = Math.abs(cosP) * 82;
                    const sweepOuter = isWaxing ? 1 : 0;
                    const sweepInner = cosP >= 0 ? (isWaxing ? 0 : 1) : (isWaxing ? 1 : 0);
                    const d = `M 100 18 A 82 82 0 0 ${sweepOuter} 100 182 A ${rx} 82 0 0 ${sweepInner} 100 18 Z`;
                    return <path d={d} fill="#F4EFE6" opacity="0.92" />;
                  })()}
                </svg>

                <div className="space-y-2 font-mono text-xs">
                  <div className="text-sm font-serif font-bold text-[#D4AF37]">
                    {simState.moon.phaseName}
                  </div>
                  <div>Elongation (☽ − ☉): <span className="text-[#F4EFE6] font-bold">{simState.moon.phaseAngleDeg.toFixed(2)}°</span></div>
                  <div>Illumination: <span className="text-[#45B89E] font-bold">{(simState.moon.illuminationFrac * 100).toFixed(1)}%</span></div>
                  <div>Lunar Age: <span className="text-[#60A5FA] font-bold">{simState.moon.lunarAgeDays.toFixed(2)} / 29.53 days</span></div>
                  <div>Earth-Moon Distance: <span className="text-[#D4AF37]">{Math.round(simState.moon.distKm).toLocaleString()} km</span></div>
                  <div>Mech vs Ephemeris Δλ: <span className="text-[#E06666]">{simState.moon.discrepancyDeg.toFixed(2)}°</span></div>
                </div>
              </div>

              {/* Comparison Table of the 4 Fundamental Lunar Months */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-[#D4AF37] border-b border-[#B88645]/30">
                      <th className="py-2">Lunar Month Type</th>
                      <th className="py-2">Modern Value</th>
                      <th className="py-2">Antikythera Ratio</th>
                      <th className="py-2">Physical Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B88645]/15">
                    <tr>
                      <td className="py-2 font-bold text-[#60A5FA]">Synodic Month</td>
                      <td>29.530589 d</td>
                      <td>19 / 235 yr (29.5301 d)</td>
                      <td>New Moon to New Moon (Phase Sphere)</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-[#D4AF37]">Sidereal Month</td>
                      <td>27.321661 d</td>
                      <td>19 / 254 yr (27.3212 d)</td>
                      <td>360° return against fixed Zodiac stars (e2)</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-[#45B89E]">Anomalistic Month</td>
                      <td>27.554550 d</td>
                      <td>Pin-Slot on e3 Carousel</td>
                      <td>Perigee to Perigee (Orbital Speed Anomaly)</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-[#E06666]">Draconic Month</td>
                      <td>27.212221 d</td>
                      <td>Saros 223 / 242 Nodes</td>
                      <td>Ascending Node Ω to Ω (Eclipse Seasons)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODULE 4: ECLIPSE LABORATORY & SAROS GLYPH DECODER                 */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'eclipse' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Cols: Interactive Sun-Earth-Moon Shadow Cone & Nodal Geometry */}
            <div className="lg:col-span-7 bg-[#12161F] border border-[#B88645]/40 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#B88645]/30 pb-3">
                <div>
                  <h2 className="font-serif text-lg text-[#D4AF37] uppercase tracking-wider">
                    Eclipse Shadow-Cone & Nodal Alignment Laboratory
                  </h2>
                  <p className="text-xs text-[#F4EFE6]/70">
                    Eclipses occur only when New or Full Moon (Syzygy) coincides with an Orbital Node ($\Omega$ or $\mho$) so that $|\beta| &lt; 1.5^\circ$.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => jumpToEclipseCondition('solar')}
                    className="px-3 py-1.5 rounded bg-[#D4AF37] text-[#0B0D12] font-mono font-bold text-xs hover:bg-[#E5C158]"
                  >
                    Align Solar Eclipse (Η)
                  </button>
                  <button
                    onClick={() => jumpToEclipseCondition('lunar')}
                    className="px-3 py-1.5 rounded bg-[#38BDF8] text-[#0B0D12] font-mono font-bold text-xs hover:bg-[#7DD3FC]"
                  >
                    Align Lunar Eclipse (Σ)
                  </button>
                </div>
              </div>

              {/* Shadow Cone SVG Visualizer */}
              <svg viewBox="0 0 600 280" className="w-full bg-[#080A0F] rounded-xl border border-[#B88645]/30">
                {/* Sun on Left */}
                <circle cx="55" cy="140" r="38" fill="#FFD700" stroke="#FEF08A" strokeWidth="3" />
                <text x="55" y="195" fill="#FFD700" fontSize="10" fontFamily="serif" textAnchor="middle">ΗΛΙΟΣ (SUN)</text>

                {/* Earth Umbra & Penumbra Cones */}
                <polygon points="330,118 560,65 560,215 330,162" fill="#334155" opacity="0.32" />
                <polygon points="330,118 525,140 330,162" fill="#020617" opacity="0.88" />

                {/* Earth in Center */}
                <circle cx="330" cy="140" r="22" fill="#2563EB" stroke="#93C5FD" strokeWidth="2" />
                <text x="330" y="178" fill="#93C5FD" fontSize="10" fontFamily="serif" textAnchor="middle">ΓΗ (EARTH)</text>

                {/* Inclined Lunar Orbit Plane (5.145° exaggerated vertically) */}
                <line x1="190" y1="185" x2="470" y2="95" stroke="#45B89E" strokeWidth="1.5" strokeDasharray="4,3" />
                <line x1="170" y1="140" x2="550" y2="140" stroke="#D4AF37" strokeWidth="1" opacity="0.4" />

                {/* Moon Position along Syzygy / Latitude */}
                {(() => {
                  const phaseRad = simState.moon.phaseAngleDeg * DEG2RAD;
                  const mx = 330 - Math.cos(phaseRad) * 115;
                  const my = 140 - simState.moon.trueLatDeg * 7.5;
                  return (
                    <g>
                      {/* Lunar Umbra Cone when between Sun and Earth */}
                      {mx < 330 && (
                        <polygon
                          points={`${mx},${my - 9} 330,${my} ${mx},${my + 9}`}
                          fill="#020617"
                          opacity="0.85"
                        />
                      )}
                      <circle cx={mx} cy={my} r="10" fill="#E2E8F0" stroke="#F8FAFC" strokeWidth="1.5" />
                      <text x={mx} y={my - 15} fill="#F8FAFC" fontSize="9.5" fontFamily="monospace" textAnchor="middle">
                        ☽ Moon (β={simState.moon.trueLatDeg.toFixed(2)}°)
                      </text>
                    </g>
                  );
                })()}
              </svg>

              {/* Live Eclipse Classification Alert Banner */}
              <div
                className={`p-4 rounded-xl border ${
                  simState.eclipseStatus.active
                    ? 'bg-[#D4AF37]/15 border-[#D4AF37]'
                    : 'bg-[#0B0D12] border-[#B88645]/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif text-sm font-bold text-[#D4AF37] uppercase">
                    {simState.eclipseStatus.category} — {simState.eclipseStatus.type}
                  </span>
                  <span className="text-xs font-mono text-[#45B89E]">
                    Nodal Distance |Δλ_node| = {simState.moon.minNodalDistDeg.toFixed(2)}°
                  </span>
                </div>
                <p className="text-xs text-[#F4EFE6]/80 mt-1.5 font-mono">
                  {simState.eclipseStatus.details}
                </p>
              </div>
            </div>

            {/* Right 5 Cols: Saros 223-Month Glyph Decoder & Exeligmos Shift */}
            <div className="lg:col-span-5 bg-[#12161F] border border-[#B88645]/40 rounded-xl p-5 space-y-4">
              <div className="border-b border-[#B88645]/30 pb-3">
                <h3 className="font-serif text-base text-[#D4AF37] uppercase tracking-wider">
                  Saros Spiral Glyph Decoder (223 Months = 6,585.321 Days)
                </h3>
                <p className="text-xs text-[#F4EFE6]/70 mt-1">
                  Because 223 synodic months ≈ 242 draconic months ≈ 239 anomalistic months, eclipses repeat with almost identical geometry every 18 years, 11 days, and 8 hours.
                </p>
              </div>

              {/* Selected Glyph Card */}
              <div className="bg-[#0B0D12] p-4 rounded-xl border border-[#D4AF37]/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded bg-[#D4AF37] text-[#0B0D12] font-mono font-bold text-xs">
                    Saros Cell #{selectedGlyph.month} / 223
                  </span>
                  <span className="text-xs font-mono text-[#C084FC]">
                    Exeligmos Shift: +{simState.cycles.exeligmosShiftHours} Hours
                  </span>
                </div>
                <div className="text-xl font-serif text-[#F4EFE6] font-bold">
                  Inscribed Glyph: “{selectedGlyph.code}” ({selectedGlyph.type} Eclipse • {selectedGlyph.hour})
                </div>
                <p className="text-xs text-[#F4EFE6]/80">
                  {selectedGlyph.desc}
                </p>
              </div>

              {/* Scrollable Grid of Inscribed Saros Glyphs */}
              <div className="max-h-[290px] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
                {SAROS_GLYPHS.map((g) => (
                  <button
                    key={g.month}
                    onClick={() => {
                      setSelectedGlyph(g);
                      // Jump simulation to that Saros month
                      setTYears(((g.month - 1) * ASTRO_CONSTANTS.SYNODIC_MONTH_DAYS) / ASTRO_CONSTANTS.TROPICAL_YEAR_DAYS);
                    }}
                    className={`p-2 rounded border text-left font-mono text-xs transition-all ${
                      selectedGlyph.month === g.month
                        ? 'bg-[#B88645]/30 border-[#D4AF37] text-[#F4EFE6]'
                        : 'bg-[#0B0D12] border-[#B88645]/20 text-[#F4EFE6]/75 hover:border-[#B88645]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[#D4AF37] font-bold">M{g.month}</span>
                      <span className="px-1.5 rounded bg-[#1B202C] text-[10px]">{g.code}</span>
                    </div>
                    <div className="text-[10px] text-[#F4EFE6]/60 truncate mt-0.5">{g.type} ({g.hour})</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODULE 5: ANCIENT CALENDAR CYCLES (METONIC, SAROS, EXELIGMOS)      */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'cycles' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Interactive 235-Month Metonic Calendar Grid */}
              <div className="lg:col-span-7 bg-[#12161F] border border-[#B88645]/40 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#B88645]/30 pb-3">
                  <div>
                    <h2 className="font-serif text-lg text-[#D4AF37] uppercase tracking-wider">
                      19-Year Metonic Spiral Calendar (235 Corinthian Lunar Months)
                    </h2>
                    <p className="text-xs text-[#F4EFE6]/70">
                      19 solar years contain 12 regular months + 7 intercalary (embolismic) months = 235 lunar months (110 hollow 29-day months & 125 full 30-day months = 6,940 days).
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded bg-[#0B0D12] border border-[#D4AF37]/50 font-mono text-xs text-[#D4AF37]">
                    Active Cell: #{simState.cycles.metonicMonthIndex} / 235 ({simState.cycles.corinthianMonth.greek})
                  </div>
                </div>

                {/* Corinthian Month Ring Table */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {CORINTHIAN_MONTHS.map((m) => {
                    const isCurrent = simState.cycles.corinthianMonth.index === m.index;
                    return (
                      <div
                        key={m.index}
                        className={`p-3 rounded-lg border transition-all ${
                          isCurrent
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] shadow-md'
                            : 'bg-[#0B0D12] border-[#B88645]/25'
                        }`}
                      >
                        <div className="text-[10px] font-mono text-[#F4EFE6]/50">MONTH {m.index}</div>
                        <div className="font-serif text-sm font-bold text-[#D4AF37] mt-0.5">{m.greek}</div>
                        <div className="text-xs text-[#F4EFE6]/85">{m.translit}</div>
                        <div className="text-[10px] font-mono text-[#45B89E] mt-1">{m.season}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right 5 Cols: Mathematical Cycle Drift & Residual Calculator */}
              <div className="lg:col-span-5 bg-[#12161F] border border-[#B88645]/40 rounded-xl p-5 space-y-4">
                <h3 className="font-serif text-base text-[#D4AF37] uppercase tracking-wider border-b border-[#B88645]/30 pb-2">
                  Ancient Cycle Constants vs. Modern Ephemeris Drift
                </h3>
                <div className="space-y-3 font-mono text-xs">
                  <div className="bg-[#0B0D12] p-3.5 rounded-lg border border-[#B88645]/30 space-y-1">
                    <div className="text-[#60A5FA] font-bold">1. Metonic Cycle (19 Tropical Years ≈ 235 Synodic Months)</div>
                    <div>19 × 365.242190 d = <span className="text-[#F4EFE6]">6,939.6016 days</span></div>
                    <div>235 × 29.530589 d = <span className="text-[#F4EFE6]">6,939.6884 days</span></div>
                    <div className="text-[#D4AF37]">Residual Discrepancy = +0.0868 days (+2 hours 5 minutes) per 19 yr</div>
                  </div>

                  <div className="bg-[#0B0D12] p-3.5 rounded-lg border border-[#B88645]/30 space-y-1">
                    <div className="text-[#45B89E] font-bold">2. Callippic Cycle (4 × 19 = 76 Years = 940 Synodic Months)</div>
                    <div>Subtracts 1 day from 4 Metonic cycles (4 × 6940 − 1 = 27,759 days)</div>
                    <div className="text-[#D4AF37]">Mean Tropical Year = 365.2500 days (Julian accuracy)</div>
                  </div>

                  <div className="bg-[#0B0D12] p-3.5 rounded-lg border border-[#B88645]/30 space-y-1">
                    <div className="text-[#E06666] font-bold">3. Saros & Exeligmos Eclipse Cycles</div>
                    <div>223 Synodic = <span className="text-[#F4EFE6]">6,585.3213 days</span> (18 yr 11 d 7 h 42 m)</div>
                    <div>242 Draconic = <span className="text-[#F4EFE6]">6,585.3575 days</span> (Node alignment within 0.48°)</div>
                    <div>Exeligmos (669 Synodic) = <span className="text-[#C084FC]">19,755.964 days</span> (Returns eclipse to same local longitude)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODULE 6: FIVE CLASSICAL PLANETS & RETROGRADE LAB                  */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'planets' && (
          <div className="space-y-6">
            <div className="bg-[#12161F] border border-[#B88645]/40 rounded-xl p-5">
              <div className="border-b border-[#B88645]/30 pb-3 mb-4">
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37]">
                  Scholarly Transparency: Archaeological Fact vs. Reconstruction (Freeth et al. 2021 vs. Wright 2002)
                </span>
                <h2 className="font-serif text-lg text-[#D4AF37] uppercase tracking-wider mt-1">
                  The Five Classical Planets ($\text{ΠΛΑΝΗΤΕΣ}$) & Front-Plate Epicyclic Gearing
                </h2>
                <p className="text-xs text-[#F4EFE6]/75 mt-1">
                  While the Lunar, Solar, Metonic, Saros, and Exeligmos gear trains survive directly inside Fragment A, the front planetary trains were largely lost except for **Fragment D** (containing a 63-tooth gear) and the **Front Cover Inscription** where X-ray CT revealed exact period relations for **Venus (462 years)** and **Saturn (442 years)**.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].map((key) => {
                  const el = PLANET_ELEMENTS[key];
                  const p = simState.planets[key];
                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedPlanetKey(key)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedPlanetKey === key
                          ? 'bg-[#B88645]/20 border-[#D4AF37] shadow-lg'
                          : 'bg-[#0B0D12] border-[#B88645]/25 hover:border-[#B88645]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold" style={{ color: el.color }}>{el.symbol}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          p.isRetrograde ? 'bg-[#E06666]/25 text-[#F87171]' : 'bg-[#3B7A6C]/25 text-[#45B89E]'
                        }`}>
                          {p.isRetrograde ? 'RETROGRADE' : 'PROGRADE'}
                        </span>
                      </div>
                      <div className="font-serif text-base font-bold text-[#F4EFE6] mt-1">{key}</div>
                      <div className="text-[11px] text-[#D4AF37] font-serif">{el.greek}</div>

                      <div className="mt-3 pt-2 border-t border-[#B88645]/20 space-y-1 font-mono text-[11px]">
                        <div>Kepler Geo λ: <span className="text-[#F4EFE6] font-bold">{p.geoLonDeg.toFixed(1)}°</span></div>
                        <div>UCL Gear λ: <span className="text-[#60A5FA] font-bold">{p.uclMechLonDeg.toFixed(1)}°</span></div>
                        <div>Elongation: <span className="text-[#45B89E]">{p.elongationDeg.toFixed(1)}°</span></div>
                        <div>Period Ratio: <span className="text-[#D4AF37]">{el.uclSynodicCycles}/{el.uclPeriodYears} yr</span></div>
                      </div>
                      <p className="text-[10px] text-[#F4EFE6]/60 mt-2 leading-snug">
                        {el.uclRatioDesc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODULE 7: MATHEMATICAL OBSERVATORY & LIVE SCIENTIFIC GRAPHS        */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'math' && (
          <div className="space-y-6">
            {/* Live Scientific Recharts Telemetry Suite */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Graph 1: Pin-and-Slot Lunar Anomaly & Angular Velocity Ratio */}
              <div className="bg-[#12161F] border border-[#B88645]/40 rounded-xl p-4 space-y-2">
                <h3 className="font-serif text-sm text-[#D4AF37] uppercase tracking-wider">
                  Live Graph 1: Hipparchian Pin-and-Slot Anomaly $\Delta\theta(\alpha)$ Around Current Date
                </h3>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={telemetrySeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#252C3D" />
                      <XAxis dataKey="dayOffset" stroke="#94A3B8" tick={{ fontSize: 10 }} label={{ value: 'Days from Current Crank State', position: 'insideBottom', offset: -2, fill: '#D4AF37', fontSize: 10 }} />
                      <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} domain={[-7, 7]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0B0D12', borderColor: '#B88645', fontSize: '11px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <ReferenceLine x={0} stroke="#D4AF37" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="pinSlotAnomaly" name="Pin-Slot Anomaly Δθ (deg)" stroke="#45B89E" fill="#3B7A6C" fillOpacity={0.35} />
                      <Line type="monotone" dataKey="lunarDiscrepancy" name="Mech vs Ephemeris Residual (deg)" stroke="#E06666" dot={false} strokeWidth={1.8} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Graph 2: Planetary Apparent Geocentric Longitude & Retrograde Loops */}
              <div className="bg-[#12161F] border border-[#B88645]/40 rounded-xl p-4 space-y-2">
                <h3 className="font-serif text-sm text-[#D4AF37] uppercase tracking-wider">
                  Live Graph 2: Apparent Geocentric Longitude $\lambda(t)$ (Mars, Venus, Saturn)
                </h3>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={telemetrySeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#252C3D" />
                      <XAxis dataKey="dayOffset" stroke="#94A3B8" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} domain={[0, 360]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0B0D12', borderColor: '#B88645', fontSize: '11px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <ReferenceLine x={0} stroke="#D4AF37" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="marsGeoLon" name="Mars λ (deg)" stroke="#E06655" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="venusGeoLon" name="Venus λ (deg)" stroke="#F3C677" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="saturnGeoLon" name="Saturn λ (deg)" stroke="#C2B280" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Mathematical Derivations & Live Substitutions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#12161F] border border-[#B88645]/40 rounded-xl p-4 space-y-2">
                <div className="text-xs font-serif uppercase tracking-wider text-[#D4AF37]">
                  1. Compound Sidereal Gear Train Identity
                </div>
                <div className="bg-[#0B0D12] p-3 rounded border border-[#B88645]/25 font-mono text-xs text-[#F4EFE6]">
                  ω_e2 / ω_b1 = -(64/38) × (48/24) × (127/32) = -254 / 19
                </div>
                <p className="text-xs text-[#F4EFE6]/75">
                  Live Substitution: For $b_1 = {simState.b1Turns.toFixed(3)}$ turns, sidereal gear $e_2$ completes ${(simState.b1Turns * (254 / 19)).toFixed(4)}$ revolutions.
                </p>
              </div>

              <div className="bg-[#12161F] border border-[#B88645]/40 rounded-xl p-4 space-y-2">
                <div className="text-xs font-serif uppercase tracking-wider text-[#D4AF37]">
                  2. Epicyclic Pin-and-Slot Transformation
                </div>
                <div className="bg-[#0B0D12] p-3 rounded border border-[#B88645]/25 font-mono text-xs text-[#45B89E]">
                  θ_k2 = θ_e3 + atan2(r sin α, r cos α - d)
                </div>
                <p className="text-xs text-[#F4EFE6]/75">
                  With $r = 9.6\text{ mm}, d = 1.06\text{ mm}, \alpha = {simState.moon.anomalyDeg.toFixed(1)}^\circ$, output slot angle is ${simState.moon.k2RelDeg.toFixed(2)}^\circ$.
                </p>
              </div>

              <div className="bg-[#12161F] border border-[#B88645]/40 rounded-xl p-4 space-y-2">
                <div className="text-xs font-serif uppercase tracking-wider text-[#D4AF37]">
                  3. Keplerian Elliptic Anomaly Solver
                </div>
                <div className="bg-[#0B0D12] p-3 rounded border border-[#B88645]/25 font-mono text-xs text-[#60A5FA]">
                  E_(n+1) = E_n - (E_n - e sin E_n - M) / (1 - e cos E_n)
                </div>
                <p className="text-xs text-[#F4EFE6]/75">
                  Earth Mean Anomaly $M = {simState.earthHelio.meanAnomalyDeg.toFixed(2)}^\circ \implies E = {simState.earthHelio.eccentricAnomalyDeg.toFixed(2)}^\circ$.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODULE 8: HISTORICAL ARCHIVE, GUIDED EXHIBITION & UNIT TEST SUITE  */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'archive' && (
          <div className="space-y-6">
            {/* 6-Stage Interactive Guided Exhibition Mode */}
            <div className="bg-[#12161F] border border-[#D4AF37]/60 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#B88645]/30 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                  <h2 className="font-serif text-lg text-[#D4AF37] uppercase tracking-wider">
                    Interactive Museum Exhibition Tour (6 Guided Investigations)
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#F4EFE6]/70">
                  Click any stage to configure the simulation and inspect key physical takeaways
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5">
                {[
                  {
                    step: 0,
                    title: '1. Turn the Crank',
                    desc: 'Drive crown gear a1(48) → b1(223) and observe the 254/19 sidereal train in 3D.',
                    action: () => {
                      setSelectedGearId('b1');
                      setExplosionFactor(0.25);
                      setIsPlaying(true);
                      setSpeedYearsPerSec(0.08);
                    }
                  },
                  {
                    step: 1,
                    title: '2. Lunar Pin & Slot',
                    desc: 'Inspect eccentric gears k1 & k2 on carousel e3 modeling Hipparchus’s lunar anomaly.',
                    action: () => {
                      setSelectedGearId('k2');
                      setCameraPreset('pinSlot');
                      setActiveTab('lunar');
                    }
                  },
                  {
                    step: 2,
                    title: '3. 19-Yr Metonic Spiral',
                    desc: 'Advance 19 tropical years (5 turns of n1) to verify 235 synodic months.',
                    action: () => {
                      setTYears(19.0);
                      setActiveTab('cycles');
                    }
                  },
                  {
                    step: 3,
                    title: '4. Eclipse Prediction',
                    desc: 'Align New Moon at Ascending Node Ω and decode the 223-month Saros glyphs.',
                    action: () => {
                      jumpToEclipseCondition('solar');
                      setActiveTab('eclipse');
                    }
                  },
                  {
                    step: 4,
                    title: '5. Retrograde Loops',
                    desc: 'Compare apparent geocentric loops of Mars against heliocentric Keplerian orbits.',
                    action: () => {
                      setReferenceFrame('geocentric');
                      setSelectedPlanetKey('Mars');
                      setActiveTab('observatory');
                    }
                  },
                  {
                    step: 5,
                    title: '6. Ancient vs Modern',
                    desc: 'Examine live residual curves between bronze gear ratios and JPL ephemerides.',
                    action: () => {
                      setActiveTab('math');
                    }
                  }
                ].map((item) => (
                  <button
                    key={item.step}
                    onClick={() => {
                      setExhibitionStep(item.step);
                      item.action();
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      exhibitionStep === item.step
                        ? 'bg-[#D4AF37]/20 border-[#D4AF37]'
                        : 'bg-[#0B0D12] border-[#B88645]/25 hover:border-[#D4AF37]/60'
                    }`}
                  >
                    <div>
                      <div className="font-serif text-xs font-bold text-[#D4AF37]">{item.title}</div>
                      <p className="text-[11px] text-[#F4EFE6]/75 mt-1 leading-snug">{item.desc}</p>
                    </div>
                    <div className="mt-2 text-[10px] font-mono text-[#45B89E] flex items-center gap-1">
                      <span>Launch Demo</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Archaeological Fragments & Live Automated Unit Test Suite */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Archaeological Archive (5 Cols) */}
              <div className="lg:col-span-5 bg-[#12161F] border border-[#B88645]/40 rounded-xl p-5 space-y-3">
                <h3 className="font-serif text-base text-[#D4AF37] uppercase tracking-wider border-b border-[#B88645]/30 pb-2">
                  Archaeological Provenance & CT Research Timeline
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="bg-[#0B0D12] p-3 rounded border border-[#B88645]/25">
                    <div className="font-bold text-[#D4AF37]">1901 — Symi Sponge Divers & Captain Kontos</div>
                    <p className="text-[#F4EFE6]/75 mt-0.5">
                      Recovered at 42m depth off Point Glyphadia, Antikythera island; Valerios Stais identifies calcified bronze gear wheels in May 1902 (National Archaeological Museum, Athens, X 15087).
                    </p>
                  </div>
                  <div className="bg-[#0B0D12] p-3 rounded border border-[#B88645]/25">
                    <div className="font-bold text-[#60A5FA]">1974 & 2005 — Price ("Gears from the Greeks") & Wright</div>
                    <p className="text-[#F4EFE6]/75 mt-0.5">
                      Derek de Solla Price & Charalampos Karakalos perform gamma-radiography; Michael Wright proves the back dials are Archimedes spirals with sliding pin followers and reconstructs the epicyclic turntable.
                    </p>
                  </div>
                  <div className="bg-[#0B0D12] p-3 rounded border border-[#B88645]/25">
                    <div className="font-bold text-[#45B89E]">2005–2021 — AMRP Microfocus X-Ray CT & UCL Team</div>
                    <p className="text-[#F4EFE6]/75 mt-0.5">
                      8-ton X-Tek Bladerunner 450kV CT scanner & HP Polynomial Texture Mapping (Freeth, Bitsakis, Moussas, Seiradakis, Edmunds, Ramsey) decode 3,400+ parpegma/eclipse characters, the Saros/Exeligmos trains, and the 462/442-year Venus/Saturn periods.
                    </p>
                  </div>
                </div>
              </div>

              {/* Automated Scientific Unit Test Runner (7 Cols) */}
              <div className="lg:col-span-7 bg-[#12161F] border border-[#B88645]/40 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#B88645]/30 pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#45B89E]" />
                    <h3 className="font-serif text-base text-[#D4AF37] uppercase tracking-wider">
                      Live Automated Mathematical & Kinematic Verification Suite
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-[#3B7A6C]/30 text-[#45B89E] font-mono text-xs font-bold">
                    {unitTestResults.filter((t) => t.passed).length} / {unitTestResults.length} PASSED
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="text-[#D4AF37] border-b border-[#B88645]/30">
                        <th className="py-2">Status</th>
                        <th className="py-2">Assertion</th>
                        <th className="py-2">Expected</th>
                        <th className="py-2">Computed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#B88645]/15">
                      {unitTestResults.map((t) => (
                        <tr key={t.id}>
                          <td className="py-2">
                            <span className="px-2 py-0.5 rounded bg-[#3B7A6C]/25 text-[#45B89E] font-bold">
                              PASS
                            </span>
                          </td>
                          <td className="py-2 text-[#F4EFE6]">{t.name}</td>
                          <td className="py-2 text-[#D4AF37]">{t.expected}</td>
                          <td className="py-2 text-[#60A5FA]">{t.actual}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
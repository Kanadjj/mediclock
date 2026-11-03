// Synthetic demo data. Every clinic, user and quantity here is fictional.
import { addDays } from './logic.js';
import { withHistoricalDemoData } from './historical.js';
import { DEFAULT_DISCOUNT_CONFIG } from './discounts.js';

export const CLINICS = [
  { id: 'A', name: 'Clinic A – Andheri', area: 'Andheri West', lat: 19.1197, lng: 72.8464 },
  { id: 'B', name: 'Clinic B – Bandra', area: 'Bandra West', lat: 19.0596, lng: 72.8295 },
  { id: 'C', name: 'Clinic C – Andheri East', area: 'Andheri East', lat: 19.1136, lng: 72.8697 },
  { id: 'D', name: 'Clinic D – Kurla', area: 'Kurla West', lat: 19.0728, lng: 72.8826 },
  { id: 'E', name: 'Clinic E – Borivali', area: 'Borivali West', lat: 19.2307, lng: 72.8567 },
];

const MEDS = {
  ORS: { medicineId: 'MED-ORS', name: 'ORS (Oral Rehydration Salts)', category: 'Rehydration', unit: 'sachet', storage: 'Store below 30°C, keep dry', unitCost: 12 },
  PCM: { medicineId: 'MED-PCM', name: 'Paracetamol 500 mg', category: 'Analgesic / Antipyretic', unit: 'tablet', storage: 'Store below 30°C, keep dry', unitCost: 1 },
  FE: { medicineId: 'MED-FE', name: 'Iron + Folic Acid tablets', category: 'Supplement', unit: 'tablet', storage: 'Cool, dry place; protect from light', unitCost: 2 },
  AMX: { medicineId: 'MED-AMX', name: 'Amoxicillin 250 mg', category: 'Antibiotic', unit: 'capsule', storage: 'Below 25°C; protect from moisture', unitCost: 6 },
  ZN: { medicineId: 'MED-ZN', name: 'Zinc 20 mg tablets', category: 'Supplement', unit: 'tablet', storage: 'Store below 30°C', unitCost: 3 },
};

// [med, clinic, batchNo, qty, days to expiry, daily use, minimum stock, safety buffer]
const ROWS = [
  // Headline demo scenario: A has 660 ORS, 10/day, 60 days left, buffer 0 -> surplus 60. B has 20 vs 150 required -> shortage 130.
  ['ORS', 'A', 'ORS-A-2611', 660, 60, 10, 100, 0],
  ['ORS', 'B', 'ORS-B-2612', 20, 200, 5, 150, 0],
  ['ORS', 'C', 'ORS-C-2610', 300, 120, 8, 80, 40],
  ['ORS', 'D', 'ORS-D-2609', 90, 45, 4, 60, 0],
  ['ORS', 'E', 'ORS-E-2612', 100, 150, 6, 90, 0],
  ['PCM', 'A', 'PCM-A-2601', 1200, 25, 30, 600, 100],
  ['PCM', 'A', 'PCM-A-2605', 800, 240, 20, 0, 50],
  ['PCM', 'B', 'PCM-B-2606', 150, 100, 40, 800, 100],
  ['PCM', 'C', 'PCM-C-2608', 900, 180, 25, 300, 50],
  ['PCM', 'D', 'PCM-D-2509', 500, -5, 20, 0, 0],
  ['PCM', 'D', 'PCM-D-2607', 600, 150, 20, 200, 0],
  ['PCM', 'E', 'PCM-E-2606', 700, 90, 30, 300, 80],
  ['AMX', 'A', 'AMX-A-2604', 400, 75, 6, 100, 20],
  ['AMX', 'B', 'AMX-B-2608', 200, 120, 6, 100, 10],
  ['AMX', 'C', 'AMX-C-2603', 600, 50, 5, 80, 10],
  ['AMX', 'D', 'AMX-D-2609', 60, 160, 8, 150, 0],
  ['AMX', 'E', 'AMX-E-2610', 300, 200, 5, 80, 10],
  ['FE', 'A', 'FE-A-2605', 900, 85, 10, 200, 50],
  ['FE', 'B', 'FE-B-2604', 1500, 40, 12, 300, 100],
  ['FE', 'C', 'FE-C-2607', 500, 110, 5, 100, 10],
  ['FE', 'D', 'FE-D-2606', 300, 100, 6, 100, 20],
  ['FE', 'E', 'FE-E-2610', 150, 180, 15, 400, 0],
  ['ZN', 'A', 'ZN-A-2605', 250, 55, 4, 80, 10],
  ['ZN', 'B', 'ZN-B-2603', 100, 20, 2, 60, 10],
  ['ZN', 'C', 'ZN-C-2609', 40, 130, 5, 150, 0],
  ['ZN', 'D', 'ZN-D-2608', 300, 95, 4, 60, 10],
  ['ZN', 'E', 'ZN-E-2607', 120, 70, 3, 60, 10],
];

export const MEDICINE_CATALOGUE = Object.values(MEDS);

export function seedData(today) {
  const batches = ROWS.map(([m, clinicId, batchNo, qty, d, daily, minStock, buffer], i) => ({
    id: 'B-' + String(i + 1).padStart(4, '0'), ...MEDS[m], batchNo, clinicId, qty, expiry: addDays(today, d), daily, minStock, buffer,
  }));
  const users = [
    ...CLINICS.map((c, i) => ({ id: 'U' + (i + 1), name: ['Asha Nair', 'Rohit Shah', 'Meera Iyer', 'Imran Qureshi', 'Priya Desai'][i], role: 'Pharmacist', clinicId: c.id })),
    { id: 'U6', name: 'Dr. Kavita Rao', role: 'Medical Officer', clinicId: null },
    { id: 'U7', name: 'Sanjay Kulkarni', role: 'Administrator', clinicId: null },
  ];
  const data = {
    version: 1, createdAt: new Date().toISOString(), clinics: structuredClone(CLINICS), users, batches, transfers: [], audit: [],
    reorderSettings: [], purchases: [], notifications: [], discountConfig: structuredClone(DEFAULT_DISCOUNT_CONFIG),
    activity: [{ id: 'ACT-0', ts: new Date().toISOString(), type: 'system', text: 'Demo dataset loaded (fictional data).' }],
    seq: { transfer: 1, batch: batches.length + 1, activity: 1, clinic: 6, user: 8, purchase: 1, notification: 1 },
  };
  return withHistoricalDemoData(data);
}

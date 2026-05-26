const REFERENCE_FILES = [
  "classes",
  "conditions",
  "equipment",
  "bestiary-mm",
  "feats",
  "items",
  "magic-items",
  "races",
  "spells"
];

export function listAvailableReferenceFiles() {
  return REFERENCE_FILES.map((name) => ({
    name,
    path: `./data/${name}.json`
  }));
}

export async function loadReferenceDataFile(name) {
  if (!REFERENCE_FILES.includes(name)) {
    throw new Error(`Unsupported reference data file: ${name}`);
  }

  const response = await fetch(`./data/${name}.json`);
  if (!response.ok) {
    throw new Error(`Could not load ${name}.json (${response.status})`);
  }

  return response.json();
}

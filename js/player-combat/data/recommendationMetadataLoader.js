const RECOMMENDATION_METADATA_FILES = [
  ["spellTactics", "spellTactics.json"],
  ["featTactics", "featTactics.json"],
  ["itemTactics", "itemTactics.json"],
  ["equipmentTactics", "equipmentTactics.json"],
  ["classFeatureTactics", "classFeatureTactics.json"],
  ["raceFeatureTactics", "raceFeatureTactics.json"]
];

export function listRecommendationMetadataFiles() {
  return RECOMMENDATION_METADATA_FILES.map(([name, file]) => ({
    name,
    path: `./data/recommendations/${file}`
  }));
}

export async function loadRecommendationMetadata() {
  const metadata = {};
  const statuses = [];

  for (const file of listRecommendationMetadataFiles()) {
    try {
      const response = await fetch(file.path);
      if (!response.ok) throw new Error(`Could not load ${file.path} (${response.status})`);
      metadata[file.name] = await response.json();
      statuses.push({ name: file.name, ok: true, count: Object.keys(metadata[file.name] ?? {}).length });
    } catch (error) {
      metadata[file.name] = {};
      statuses.push({ name: file.name, ok: false, count: 0, error: error.message });
    }
  }

  return { metadata, statuses };
}

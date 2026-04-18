export const CASES = [
  {
    id: "A",
    file: "./dialogs/silikon-vadisi-sizintisi.json",
    label: "CASE A - SILIKON VADISI SIZINTISI",
  },
  {
    id: "B",
    file: "./dialogs/sessiz-commit.json",
    label: "CASE B - SESSIZ COMMIT",
  },
];

export async function loadAllCases() {
  const entries = await Promise.all(
    CASES.map(async (caseDef) => {
      const response = await fetch(caseDef.file);
      if (!response.ok) {
        throw new Error(`${caseDef.file} yuklenemedi.`);
      }
      const data = await response.json();
      return [caseDef.id, data.game_data];
    })
  );
  return Object.fromEntries(entries);
}

import { t } from '../i18n/index.js';

export const CASES = [
  // {
  //   id: 'A',
  //   file: './dialogs/silikon-vadisi-sizintisi.json',
  //   label: 'CASE A - SILIKON VADISI SIZINTISI',
  // },
  // {
  //   id: 'B',
  //   file: './dialogs/sessiz-commit.json',
  //   label: 'CASE B - SESSIZ COMMIT',
  // },
  {
    id: 'TR TEST',
    file: './dialogs/soguk--oda.json',
    label: 'CASE TR TEST',
  },
  {
    id: 'TR TEST 2',
    file: './dialogs/test-2.json',
    label: 'CASE TR TEST 2',
  },
  {
    id: 'TR TEST 3',
    file: './dialogs/test-3.json',
    label: 'CASE TR TEST 3',
  },
];

export async function loadAllCases() {
  const entries = await Promise.all(
    CASES.map(async (caseDef) => {
      const response = await fetch(caseDef.file);
      if (!response.ok) {
        throw new Error(`${caseDef.file} ${t('MENU_CASE_LOAD_ERROR')}`);
      }
      const data = await response.json();
      return [caseDef.id, data.game_data];
    })
  );
  return Object.fromEntries(entries);
}

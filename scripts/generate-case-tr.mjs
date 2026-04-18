import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPipeline, parseJsonBlock } from './llm-pipeline.js';

const caseId = process.argv[2];
if (!caseId) {
  console.error('kullanim: npm run generate:tr -- <case-id>');
  console.error('  ornek: npm run generate:tr -- sessiz-tanik');
  process.exit(1);
}

const SYSTEM =
  "Hukuki sorgulama oyunu 'The Operator' icin JSON ureten bir pipeline " +
  'adimisin. Yalnizca istenen semaya uyan gecerli JSON ciktisi ver. ' +
  'Markdown, aciklama veya on-soz kullanma. Tum serbest metin alanlari ' +
  'TURKCE olmali. Sema anahtarlari ve enum degerleri (STABLE, RISE, ' +
  'ANALYTICAL vb.) ingilizce kalmali.';

const STEP_1_SUSPECT = `Hukuki bir sorgulama oyunu icin suphelisi uretiyorsun.

CIKTI KURALLARI:
- Yalnizca gecerli JSON dondur
- Markdown veya aciklama yok
- Tum metinler Turkce olmali

CIKTI:
{
  "suspect": {
    "name": string,
    "role": string,
    "profile": string,
    "motive": string,
    "secret": string,
    "credibility": number
  }
}

KURALLAR:
- Gercekci, modern bir meslek (orn. restoran sahibi, muteahhit, CFO, ev sahibi, doktor)
- Supheli ahlaki olarak belirsiz olmali
- profile sunlari icermeli:
  - gecmis
  - kariyer
  - kisilik ozellikleri
  - bir supheli detay
  - bir insani detay
- motive potansiyel bir dava veya haksiz fiille baglantili olmali
- secret asikar OLMAMALI ama anlamli olmali
- credibility 1-10 arasinda, gerekcesi ustu kapali ima edilmeli`;

const STEP_2_CASE = `Hukuki bir dava baglami uretiyorsun.

GIRDI:
{{suspect_json}}

CIKTI KURALLARI:
- Yalnizca gecerli JSON dondur
- Tum metinler Turkce olmali

CIKTI:
{
  "title": string,
  "context": string
}

KURALLAR:
- Bir hukuki anlasmazligi veya davayi tanimlamali
- Net sekilde belirtilmeli:
  - kim kimi suclaiyor
  - ne oldu
  - supheli neden sorusturuluyor
- Belirsizlik icermeli (kesin sucli veya masum degil)
- Suphelinin motive ve secret bilgisi ile dogal bir baglantisi olmali
- context kisa tutulmali (4-6 cumle)`;

const STEP_3_NODES = `Hukuki bir oyun icin dallanan bir sorgulama grafi uretiyorsun.

GIRDI:
Supheli:
{{suspect_json}}

Dava:
{{case_json}}

CIKTI KURALLARI:
- Yalnizca gecerli JSON dondur
- Tum serbest metinler (theme, description, question, answer, result_text,
  gameplay_note) TURKCE olmali
- Sema anahtarlari ingilizce kalmali
- Fiziksel/biyometrik enum degerleri ingilizce kalmali (STABLE, SPIKE vb.)

CIKTI SEMASI:
{
  "start_node": "node_01_intro",
  "nodes": {
    "<node_id>": {
      "theme": string,
      "description": string,
      "is_end_state": false,
      "choices": [
        {
          "type": string,
          "question": string,
          "answer": string,
          "mechanics": {
            "heart_rate": string,
            "breathing": string,
            "gsr": string,
            "eeg": string,
            "cctv_visual": string,
            "korku_bari_delta": number,
            "gameplay_note": string
          },
          "next_node": string
        }
      ]
    },
    "<end_node_id>": {
      "theme": string,
      "description": string,
      "is_end_state": true,
      "result_text": string
    }
  }
}

KURALLAR:

DUGUM SAYISI:
- Toplam 5-7 dugum
- Icermesi gerekenler:
  - node_01_intro (giris dugumu)
  - 3-4 sorusturma dugumu
  - tam olarak 1 basari son dugumu (id "success" icermeli, orn. node_success_*)
  - 1+ basarisizlik son dugumu (id "fail" icermeli, orn. node_fail_*)

TUM DUGUMLER (son dugumler dahil) icin alanlar:
- theme: 2-5 kelimelik kisa sahne etiketi (orn. "Gece Yarisi Commit'i")
- description: oyuncuya (operator) sahneyi kuran 1-2 cumle
- is_end_state: boolean

SON OLMAYAN DUGUMLER:
- is_end_state: false
- en az 2 choice
- result_text yok

SON DUGUMLER:
- is_end_state: true
- result_text: oyuncuya gosterilen kapanis metni
- choices YOK

CHOICE.type:
- Serbest UPPER_SNAKE_CASE aciklayici etiket (Ingilizce kalmali, tactic'i ifade etmeli)
- Ornekler: ANALYTICAL, EMPATHIC, FORENSIC_CALL_OUT, AGGRESSIVE, STRATEGIC,
  LEGAL_THREAT, MORAL_PRESSURE, NARROW_TARGET, SYSTEMIC_READ, GULLIBLE,
  TRAP, PRESSURE, EVIDENCE — veya sahneye ozel yeni bir etiket
- Not: EMPATHETIC degil, EMPATHIC kullan (mevcut veriyle tutarli)

MECHANICS (suphelinin tepkisine uyan degeri sec):
- heart_rate: BASELINE | STABLE | RISE | INCREASE | SPIKE | MAX_SPIKE | DROP | ERRATIC
- breathing: BASELINE | CALM | DEEP | SHALLOW | HOLDING_BREATH | UNEVEN | HYPERVENTILATION | CRYING
- gsr: BASELINE | STABLE | INCREASE | SPIKE | SURGE | MAX | DECREASE
- eeg: BASELINE | FOCUSED | INCREASE | CHAOTIC | ERRATIC | DROP | FLATLINE
- cctv_visual: serbest UPPER_SNAKE_CASE mikro-ifade veya beden ipucu
  (LIP_PRESS, JAW_TIGHTEN, EYE_DART, TEAR_POOLING, STONE_FACE,
  BREAKDOWN, EMPTY_STARE, RELEASED_SHOULDERS, DEFENSIVE_CROSS_ARMS,
  RELIEVED_EXHALE, LOOK_DOWN, MICRO_TWITCH, FROZEN, AVOIDANCE vb.)
- korku_bari_delta: tam sayi, yaklasik -50 ile +50 arasi
  - negatif = yanlis hamle, supheli kontrolu geri aliyor
  - pozitif = dogru hamle, maskeyi cozuyor
- gameplay_note: analiz odakli kisa Turkce not
  (orn. "YALAN SINYALI: ...", "KISMEN DOGRU: ...", "YANLIS HAMLE: ...",
  "ILERLEME: ...", "DOGRU HAMLE: ...")

OYUN TASARIMI:
- En az bir celiski kesfi yolu (adli / kanit tabanli)
- En az bir yaniltici yol (dogru gorunur ama fail tetikler)
- Iyi muhakeme -> basari dugumu
- Kotu muhakeme -> basarisizlik dugumu
- Cevaplar gercekci hissettirmeli (savunmaci, kacamak, baski altinda, teknik)

DOGRULAMA:
- Tum next_node degerleri "nodes" icinde var olan bir id'ye isaret etmeli
- start_node "nodes" icinde bulunmali`;

const STEP_4_ASSEMBLE = `Nihai oyun JSON'unu birlestiriyorsun.

GIRDI:
Supheli:
{{suspect_json}}

Dava:
{{case_json}}

Dugumler:
{{nodes_json}}

CIKTI KURALLARI:
- Yalnizca gecerli JSON dondur
- Semaya TAM olarak uymali
- Tum serbest metinler Turkce kalmali

CIKTI:
{
  "game_data": {
    "title": string,
    "suspect": {
      "name": string,
      "role": string,
      "profile": string
    },
    "system_config": {
      "initial_fear_bar": 20,
      "max_fear_bar": 100,
      "fear_bar_description": string,
      "heart_rate_baseline": number,
      "eeg_baseline": number,
      "gsr_baseline": number
    },
    "context": string,
    "start_node": string,
    "nodes": <dugum girdisinden OLDUGU GIBI kopyala; her dugumde theme,
              description, is_end_state bulunmali; ayrica choices[] veya
              result_text alani olmali>
  }
}

KURALLAR:
- suspect.name, role, profile alanlarini girdiden kopyala
- title ve context degerlerini dava girdisinden al
- start_node ve nodes degerlerini dugum girdisinden AYNEN aktar -
  theme, description, is_end_state, choices, mechanics, next_node,
  result_text alanlarini yeniden sekillendirme veya silme
- fear_bar_description duygusal/psikolojik baski takibini Turkce aciklamali
- Yalnizca system_config icine temel biyometrik alanlar ekle:
  - heart_rate_baseline
  - eeg_baseline
  - gsr_baseline
- Bu baseline degerleri SAYISAL olmali ve gercekci aralikta secilmeli:
  - heart_rate_baseline: BPM sayisi (genelde 60-90)
  - eeg_baseline: mikrovolt sayisi (genelde 18-35)
  - gsr_baseline: microsiemens sayisi (genelde 4-10)
- Degerler sakin/normale yakin olmali ve uretilen vakayla uyumlu secilmeli.
- Ekstra alan ekleme
- Gecerli JSON olmasini sagla`;

const fill = (template, vars) =>
  Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, JSON.stringify(val, null, 2)),
    template
  );

const steps = [
  {
    name: 'suspect',
    prompt: STEP_1_SUSPECT,
    parse: parseJsonBlock,
  },
  {
    name: 'case',
    prompt: (r) => fill(STEP_2_CASE, { suspect_json: r.suspect }),
    parse: parseJsonBlock,
  },
  {
    name: 'nodes',
    prompt: (r) => fill(STEP_3_NODES, { suspect_json: r.suspect, case_json: r.case }),
    parse: parseJsonBlock,
  },
  {
    name: 'final',
    prompt: (r) =>
      fill(STEP_4_ASSEMBLE, {
        suspect_json: r.suspect,
        case_json: r.case,
        nodes_json: r.nodes,
      }),
    parse: parseJsonBlock,
  },
];

const { results } = await runPipeline(steps, {
  system: SYSTEM,
  thinking: true,
  onStep: ({ name, text }) => console.log(`[${name}] ${text.length} karakter`),
});

const outPath = resolve('dialogs', `${caseId}.json`);
writeFileSync(outPath, JSON.stringify(results.final, null, 2));
console.log(`yazildi: ${outPath}`);

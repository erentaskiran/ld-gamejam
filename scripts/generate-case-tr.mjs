import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPipeline, parseJsonBlock } from './llm-pipeline.js';
import { generateCharacterImage } from './generate-character-image.mjs';

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
    "credibility": number,
    "true_verdict": "GUILTY" | "NOT_GUILTY",
    "dossier": {
      "age": number,
      "identity_summary": string,
      "family": [ { "relation": string, "name": string, "note": string } ],
      "medical": [ { "condition": string, "polygraph_effect": string } ],
      "habits": [ { "habit": string, "polygraph_effect": string } ],
      "priors": [ string ],
      "pressure_points": [ string ],
      "modifiers": {
        "heart_rate_suppression": number,
        "heart_rate_baseline_shift": number,
        "gsr_sensitivity": number,
        "gsr_baseline_shift": number,
        "breathing_instability": number
      }
    }
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
- credibility 1-10 arasinda, gerekcesi ustu kapali ima edilmeli
- true_verdict oyuncunun poligraf kanitlarindan cikarmasi gereken GERCEK:
  - "GUILTY" = supheli gercekten sorumlu (secret asil fiili iceriyor)
  - "NOT_GUILTY" = secret karanlik bile olsa supheli bu suctan masum
  - Davayi en ilginc kilan verdict'i sec; zamanla her ikisini de kullan
  - Enum degerleri ingilizce kalmali

DOSSIER (oyuncunun sorgudan ONCE okuyacagi arka plan):
- age: gercekci bir yas
- identity_summary: 1-2 cumle, gorev ve kilit nitelikler
- family: 1-4 giris. Akrabalar veya yakin iliskilerden olusur; her birinin
  note alani sorguda NEDEN onemli oldugunu kisaca acikmali (bagimlilik,
  leverage, catisma).
- medical: 0-3 giris. Her birinin polygraph_effect alani, durumun
  biyometriyi nasil bozdugunu aciklamali (orn. anksiyete bozuklugu ->
  yuksek GSR baseline; kalp pili -> kalp atisi dalgalanmasi bastirilir).
  AMAC: oyuncu hangi sicramalarina GUVENMEMESI gerektigini bilsin. Suc
  kaniti olacak sekilde hastalik UYDURMA.
- habits: 0-3 giris (ilac, kafein, uyku, madde). Her birinin
  polygraph_effect alani olmali. Ornek: "Beta-bloker -> kalp atisi
  tepkisi baskilanir"; "Yuksek kafein -> GSR baseline yuksek"; "SSRI ->
  sempatik tepki hafifler".
- priors: 0-3 kisa olgusal bullet (onceki olaylar). Verdict'i ele vermez.
- pressure_points: 1-3 kisa bullet, duygusal veya durumsal leverage.
  Hangi taktigin (EMPATHIC, TRAP, EVIDENCE, vb.) supheliyi kiracagini
  veya bloklayacagini ima eder.
- modifiers: medical+habits'i canli poligraf bozulmasina ceviren sayisal
  ayarlar. polygraph_effect notlariyla TUTARLI olmali. Default 0/1; sadece
  dossier'in destekledigi yerde sapma yap.
  - heart_rate_suppression: 0.0-0.9. HR sicrama siddetinin ne kadar
    bastirildigi. Beta-bloker (propranolol, bisoprolol) ~0.4-0.55;
    hafif SSRI ~0.2; pacemaker ~0.6. Birden fazla HR-bastiran ajan varsa
    toplayabilirsin (0.9'da tavan).
  - heart_rate_baseline_shift: -12..+15 BPM eklemeli baseline kaymasi.
    Hipertansiyon +4..+10; agir stimulan kullanimi +3..+8; bradikardi -5..-10.
  - gsr_sensitivity: 0.7-1.8 carpan (ter tepki siddeti uzerinde).
    Yuksek kafein 1.3-1.5; anksiyete bozuklugu 1.3-1.6; panik 1.5-1.8;
    antikolinerjik ilaclar / agir antiperspirant 0.7-0.85.
  - gsr_baseline_shift: -2..+4 uS eklemeli baseline kaymasi. Kronik
    kafein/anksiyete desenleriyle uyumlu olsun.
  - breathing_instability: 0.0-0.5 eklemeli nefes dalgasi jitter'i.
    Anksiyete/panik 0.2-0.35; KOAH 0.25-0.4; astim gecmisi 0.1-0.2.
  Not: migren, uykusuzluk gibi norolojik/bilissel durumlar medical[]
  icinde narrative baglam olarak kalir — dogrudan bir sayisal knob almiyor,
  cunku oyun sadece nabiz, nefes, GSR ve korku barini gosteriyor.
- Dossier true_verdict'i SIZDIRMAMALI. Motif/firsat imalari olabilir ama
  bir operatorun sorgu oncesi arastirmasinda (kamu kayitlari, IK, saglik
  beyannameleri) makul olarak bulabilecegi bilgiler olmali.`;

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

TEMEL TASARIM ILKESI (KRITIK):
- Sorgu biter; DAVA bitmez. Oyuncu bir son dugume vardiktan sonra "hukum"
  ekranina gecer ve sorgu boyunca biriken poligraf verilerini okuyarak
  GUILTY / NOT_GUILTY kararini kendi verir. Son dugumler sorgu SONUCLARIDIR,
  oyunun sonu degildir.
- Poligraf sinyalleri (heart_rate, breathing, gsr) oyuncunun tek somut
  kanitidir. Sinyalleri suspect.true_verdict ile TUTARLI sekilde uret —
  oyuncu biyometriden sucu ya da masumiyeti okuyabilmelidir.

SINYAL-GERCEK UYUMU:
- Oyuncuya canli gosterilen dort kanal: nabiz, nefes, GSR, korku bari.
  Beseinci kanal olarak supheli portresindeki mikro-ifadeler (cctv_visual)
  var. Bu kanallari suspect.true_verdict ile hizalayin.
- Eger suspect.true_verdict == "GUILTY":
  - Sikistirici/suclayici sorularda supheli gercek aldatma tepkileri
    gosterir (heart_rate SPIKE/MAX_SPIKE, gsr SURGE/MAX, breathing
    HOLDING_BREATH veya HYPERVENTILATION, gergin cctv_visual) — sozel
    cevap sakin kalsa bile
  - Yumusak/empatik cerceveleme taktigi ile sakin yanitlar mumkun
- Eger suspect.true_verdict == "NOT_GUILTY":
  - Supheli gorunur biciminde gergin olabilir (masum insan da sorguda
    sicrayabilir) ama keskin aldatma sinyalleri seyrek ve dagilmis
    olmali — cogunlukla RISE/INCREASE seviyesinde ve SHALLOW/UNEVEN
    nefes, MAX_SPIKE/SURGE/HOLDING_BREATH kumesi degil
  - Sert suclama sorulari savunmaci sicramalar yaratabilir ama surekli
    MAX GSR + HR MAX_SPIKE + HOLDING_BREATH birlikteligi OLMAMALI
- NOT_GUILTY supheli icin asla sahte itiraf yazma; MAX_SPIKE + MAX GSR +
  HOLDING_BREATH / HYPERVENTILATION kombinasyonunu sadece GUILTY gerceklere
  sakla

DUGUM SAYISI:
- Toplam 5-7 dugum
- Icermesi gerekenler:
  - node_01_intro (giris dugumu)
  - 3-4 sorusturma dugumu
  - 1 "temiz sonuc" son dugumu (id "success" icermeli, orn. node_success_*)
    — supheli isbirligi / itiraf / yikilma; guclu sinyal deseni
  - 1+ "asinmis sonuc" son dugumu (id "fail" icermeli, orn. node_fail_*)
    — supheli avukata sigindi / kilitlendi / savdi; belirsiz sinyal deseni

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
- result_text: sorgu sonucunu ozetleyen metin (supheli su an hangi
  durumda — itiraf etti, kilitlendi, kismen kabul etti, savusturdu).
  SUCU veya MASUMIYETI ilan ETME; oyuncu hukmu poligraf kayitlarindan
  verecek
- choices YOK

CHOICE.type:
- Serbest UPPER_SNAKE_CASE aciklayici etiket (Ingilizce kalmali, tactic'i ifade etmeli)
- Ornekler: ANALYTICAL, EMPATHIC, FORENSIC_CALL_OUT, AGGRESSIVE, STRATEGIC,
  LEGAL_THREAT, MORAL_PRESSURE, NARROW_TARGET, SYSTEMIC_READ, GULLIBLE,
  TRAP, PRESSURE, EVIDENCE — veya sahneye ozel yeni bir etiket
- Not: EMPATHETIC degil, EMPATHIC kullan (mevcut veriyle tutarli)

MECHANICS (suphelinin tepkisine VE true_verdict'e uyan degeri sec — yukaridaki
SINYAL-GERCEK UYUMU bolumune bakin):
- heart_rate: BASELINE | STABLE | RISE | INCREASE | SPIKE | MAX_SPIKE | DROP | ERRATIC
- breathing: BASELINE | CALM | DEEP | SHALLOW | HOLDING_BREATH | UNEVEN | HYPERVENTILATION | CRYING
- gsr: BASELINE | STABLE | INCREASE | SPIKE | SURGE | MAX | DECREASE
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
- En az bir yaniltici yol — sorguyu zayiflatir, asinmis bir son dugume goturur
- Guclu sorgulama -> "success" son dugumu (daha temiz kanit deseni)
- Zayif sorgulama -> "fail" son dugumu (belirsiz kanit deseni)
- Unutma: hicbir sonuc davayi otomatik bitirmez; sadece oyuncunun hukum
  ekranina ne kadar kanit goturecegini belirler
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
      "gsr_baseline": number
    },
    "context": string,
    "true_verdict": "GUILTY" | "NOT_GUILTY",
    "verdict_truth_text": string,
    "dossier": <suspect.dossier'i OLDUGU GIBI kopyala>,
    "start_node": string,
    "nodes": <dugum girdisinden OLDUGU GIBI kopyala; her dugumde theme,
              description, is_end_state bulunmali; ayrica choices[] veya
              result_text alani olmali>
  }
}

KURALLAR:
- suspect.name, role, profile alanlarini girdiden kopyala
- suspect.dossier'i game_data.dossier icine TUM IC ALANLAR ile OLDUGU GIBI kopyala
- title ve context degerlerini dava girdisinden al
- suspect.true_verdict degerini game_data.true_verdict icine OLDUGU GIBI yaz
  (enum degeri ingilizce kalir: "GUILTY" veya "NOT_GUILTY")
- verdict_truth_text uret: 2-3 cumle Turkce aciklama, suphelinin gercekte
  ne yaptigini (veya yapmadigini) ac. Hukum ekranindan sonra sonuc ekraninda
  gosterilir. suspect.secret, suspect.motive ve true_verdict ile tutarli olmali:
  - GUILTY ise: suphelinin gercek fiilini acik bir dille anlat
  - NOT_GUILTY ise: gercek sorumluyu ya da nedeni isaret et; suphelinin
    secret'inin karanlik ama bu davada sucsuz oldugunu belirt
- start_node ve nodes degerlerini dugum girdisinden AYNEN aktar -
  theme, description, is_end_state, choices, mechanics, next_node,
  result_text alanlarini yeniden sekillendirme veya silme
- fear_bar_description duygusal/psikolojik baski takibini Turkce aciklamali
- Yalnizca system_config icine temel biyometrik alanlar ekle:
  - heart_rate_baseline
  - gsr_baseline
- Bu baseline degerleri SAYISAL olmali ve gercekci aralikta secilmeli:
  - heart_rate_baseline: BPM sayisi (genelde 60-90)
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

const STEP_LABELS = {
  suspect: 'Şüpheli oluşturuluyor...',
  case: 'Dava bağlamı oluşturuluyor...',
  nodes: 'Sorgulama düğümleri oluşturuluyor...',
  final: "Final dava JSON'u derleniyor...",
};

const { results } = await runPipeline(steps, {
  system: SYSTEM,
  thinking: true,
  onStepStart: ({ name }) => console.log(STEP_LABELS[name] ?? `${name} işleniyor...`),
  onStep: ({ name, text }) => console.log(`[${name}] tamamlandı — ${text.length} karakter`),
});

const imageOutPath = resolve('assets', 'characters', `${caseId}.png`);
console.log('Karakter görseli oluşturuluyor...');
await generateCharacterImage(results.suspect.suspect, imageOutPath);

results.final.game_data.character_image = `./assets/characters/${caseId}.png`;

const outPath = resolve('dialogs', `${caseId}.json`);
writeFileSync(outPath, JSON.stringify(results.final, null, 2));
console.log(`yazildi: ${outPath}`);

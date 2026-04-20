import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPipeline, parseJsonBlock, MODEL } from './llm-pipeline.js';
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

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const VERDICTS = ['GUILTY', 'NOT_GUILTY'];

const ROLE_CATEGORIES = [
  'mavi yakali zanaatkar (kaynakci, elektrikci, tesisatci, torna ustasi, kamyon soforu, liman iscisi)',
  'kamu sektoru orta kademe (belediye denetcisi, sosyal hizmet uzmani, denetimli serbestlik memuru, devlet okulu ogretmeni, kutuphaneci, mahkeme katibi)',
  'yaratici/sanat (grafik tasarimci, romanci, galeri sahibi, stuydo muzisyeni, film kurgucusu, dovme sanatcisi)',
  'agirlama/servis (sef, otel gece muduru, sommelier, organizasyon planlamacisi, barmen, dugun catering sahibi)',
  'on cephe saglik (acil hemsiresi, paramedik, dis hijyenisti, fizyoterapist, ebe, klinik laboratuvar teknisyeni)',
  'tarim/kirsal (aile ciftcisi, baghan, hayvan veterineri, milli park bekcisi, aricilik isletmecisi, su urunleri ciftligi muduru)',
  'kucuk bagimsiz isletme sahibi (sahaf, kopek bakim merkezi, food truck, tamir dukkani, mahalle eczanesi)',
  'egitim (lise muduru, etut merkezi sahibi, universite ogretim gorevlisi, ozel egitim asistani)',
  'tasimacilik/lojistik (kargo dispetcheri, liman amiri, bolgesel otobus operatoru, yuk treni gorevlisi)',
  'dini veya toplum kuruluslari (din gorevlisi, hayir kurumu yoneticisi, mahalle kulturhanesi sorumlusu, sigima evi yoneticisi)',
  'tek alanda uzman teknik kisi (adli laboratuvar teknisyeni, harita muhendisi, olcum kalibratoru, muze arsivcisi)',
  'medya/gazetecilik (yerel muhabir, podcaster, belgesel saha sorumlusu, foto editor)',
  'spor veya antrenorluk (genc spor kocu, spor salonu sahibi, profesyonel takim antrenoru, e-spor menajeri)',
  'emekli veya yari emekli aktif sosyal yasam (koruyucu aile, mahalle dernek baskani, hobi cinsi yetistiricisi)',
];

const CHARGE_CATEGORIES = [
  'yaralanma veya olume yol acan medeni hukuk ihmal davasi (tuketici urunu, isyeri sorumlulugu, mesleki yukumluluk)',
  'miras anlasmazligi / vasiyet itirazi / yasli istismari iddiasi',
  'fikri mulkiyet / intihal / sahte mal davasi',
  'hayvan refahi ihlali veya imar/tarim mevzuati ihlali',
  'iftira / hakaret / sivil taciz davasi',
  'gayrimenkul veya kira dolandiriciligi (depozito calintisi, sahte ilan, hukuksuz tahliye)',
  'gida guvenligi olayi (zehirlenme, yanlis etiketleme, tedarik zinciri tahrifati)',
  'cevre kirliligi (atik dampingi, kuyu suyu, hava kalitesi)',
  'sanat veya belge sahteciligi / orijinallik anlasmazligi',
  'velayet anlasmazligi veya aile ici sivil dava',
  'kucuk bir isletmede meydana gelen isyeri guvenligi olayi (kurumsal yonetim kurulu degil)',
  'dini veya hayir kurumu fonu zimmete gecirme',
  'sahte sigorta talebi veya senaryolu kayip',
  'haksiz tutuklama karsi davasi / polis kotu davranisi sivil davasi',
  'spor doping veya atletik uygunluk dolandiriciligi',
  'tarihi eser hirsizligi / kulturel miras ihlali',
  'mesleki lisans iptali (tip, hukuk, ogretmenlik) iddia edilen kotu davranis nedeniyle',
];

const SECONDARY_SECRET_CATEGORIES = [
  'gizli uzun sureli bagimlilik (alkol, kumar, recetesiz ilac, online bahis)',
  'aciklanmamis cocuk veya yabancilasmis biyolojik akraba',
  'kimlik veya diploma sahteciligi (sahte diploma, abartilmis gecmis, odunc CV)',
  'cok onceden silinmis veya ortbas edilmis adli sicil',
  'kendisi veya yakinlarinin belgesiz goc statusu',
  'aileden/cevreden gizli tutulan dini veya siyasi donusum',
  'kamuoyuna sizmamis gecmis intihal veya akademik sahtekarlik',
  'aile utanci (akraba suc isledi, gizli intihar, aile iflasi)',
  'damgalanmis bir akrabanin gizli bakimini ustlenme (agir ruhsal hastalik, olumcul hastalik)',
  'dusman bir cevreden gizli tutulan cinsel yonelim veya cinsiyet kimligi',
  'ilgisiz kucuk mali suistimal (vergi kacirma, kayit disi gelir, kronik magaza hirsizligi)',
  'baskasinin sirrini koruyan ucuncu kisi pozisyonu',
  'aileden gizlenen tibbi sir (olumcul tani, kisirlik, gecmis kurtaj)',
  'islenmemis travma (gecmis istismar, kazara verilmis zarar, sahit olunmus siddet)',
  'yillar onceki tarikat veya marjinal grup baglantisi',
  'tanik koruma tarzi yer degistirme ile insa edilmis kimlik',
];

const MEDICAL_PROFILES = [
  'temiz baseline — kronik durum yok, gunluk ilac yok',
  'kalp gecmisi nedeniyle beta-bloker kullanimi (HR tepkileri baskili)',
  'uzun sureli SSRI veya SNRI (sempatik baskilanma)',
  'kalp pili veya kronik aritmi (HR tavan/taban bozulmasi)',
  'KOAH veya astim (nefes instabilitesi baskin)',
  'yakin zamanda hamilelik veya postpartum (yuksek baseline HR, hormonal degiskenlik)',
  'tiroid bozuklugu ilac kullaniminda (hiper -> gurultulu baseline; hipo -> baskili)',
  'opioid bagimliligi sonrasi idame tedavisi',
  'epilepsi antikonvulzan ilac kullaniminda',
  'kortikosteroid kullanan otoimmun atak (titrek baseline, sinirlilik)',
  'panik bozuklugu, ilac kullanmiyor',
  'yakin tarihli ameliyat sonrasi agri yonetimi (opioid veya gabapentinoid)',
  'kronik agri kannabis ile yonetiliyor (hafif parasempatik kayma)',
  'menopoz / perimenopoz vasomotor semptomlarla (konuyla ilgisiz ani GSR sicramalari)',
  'tedavi edilmemis uyku apnesi, kronik yorgunluk',
];

const AGE_BRACKETS = [
  '23-30 (kariyerin baslangici, daha az savunma deneyimi)',
  '31-39 (orta kariyer, aile yukumlulukleri olusuyor)',
  '40-49 (zirve sorumluluk, derin gecmis)',
  '50-59 (geç kariyer, itibar baski altinda)',
  '60-72 (zirve sonrasi, miras/saglik kaygisi baskin)',
];

const FAMILY_SHAPES = [
  'bekar, cocuksuz, yasli bir ebeveyne yakin',
  'uzun sureli partner, cocuksuz, ortak isletme veya mulk',
  'evli, velayet istikrarli evde bir genc cocuk',
  'bosanmis, farkli yaslarda birden fazla cocugun ortak velayetini paylasiyor',
  'dul, torun buyutuyor veya yetiskin cocuklarini destekliyor',
  'cekirdek aileden uzak, en yakini secilmis aile / eski arkadaslar',
  'engelli kardesin veya kronik hasta ebeveynin bakimini ustlenmis',
  'yeniden evli, uvey cocuklar ve karmasik onceki evlilik baglari',
  'evlenmemis, sinirlar arasinda uzun mesafeli iliskide',
];

const SUSPECT_TONE = [
  'asiri isbirlikci, fazlasiyla yardimci',
  'kisa ve az kelimeli, her soruyu tuzak gibi gorur',
  'dagilan ve fazla aciklayici, gercegi detayda gomer',
  'stoik ve duygusal olarak duz, okumasi zor',
  'gorunur derecede tedirgin, notr sorularda bile duygu sizdiriyor',
  'profesyonelce cilali, avukat tarafindan hazirlanmis, dikkatli ifade',
  'ofkeli ve mustehcen, davanın temelini reddeder',
  'kendisini kucumseyen ve ozur dileyen, sevimlilikle saptiran',
];

const ANTI_DEFAULT_PRINCIPLES = [
  'Cilali Amerikan hukuk-prosedur registerinden uzak dur: FDA sorusturmasi, sinif davasi, Faz III ilac skandali, Fortune-500 yonetim kurulu yok. Kucuk olcekli, bolgesel, mahalle dukei riskler tercih edilmeli.',
  'Parlak magdur/cellat cercevelemesi yok. Anlasmazligin iki tarafi da savunulabilir bir okumaya sahip olmali; ahlaki olarak basit "kotu sirket vs masum aile" sablonu yasak.',
  'Yer-degistirmis suclilik kaynagi romantik veya cinsel bir iliski OLMAMALI. Ikincil sirrin gercek sekli olarak filodaki secondary_secret_category degerini kullan.',
  'Supheli oncelikli olarak kidemli bir patron / akil hocasi / is ortagini KORUMAKLA mesgul olmamali. Yer-degistirmis suclilik gucli bir koruyucu figure baglilictan degil, suphelinin kendi hayatindan kaynaklanmali.',
  'Tibbi baseline stok poligraf deneki klisesine cokmemeli (kronik anksiyete + yogun kafein + beta-bloker). Filodaki medical_profile degerini harfiyen takip et — "temiz baseline" cikarsa onu da harfiyen uygula.',
  'Isimler suphelinin bolgesini, sosyal sinifini ve kusagini somut olarak yansitmali.',
];

function rollDiversityAnchor() {
  const verdict = pick(VERDICTS);
  return {
    true_verdict: verdict,
    role_category: pick(ROLE_CATEGORIES),
    charge_category: pick(CHARGE_CATEGORIES),
    secondary_secret_category: pick(SECONDARY_SECRET_CATEGORIES),
    medical_profile: pick(MEDICAL_PROFILES),
    age_bracket: pick(AGE_BRACKETS),
    family_shape: pick(FAMILY_SHAPES),
    suspect_tone: pick(SUSPECT_TONE),
    anti_default_principles: ANTI_DEFAULT_PRINCIPLES,
  };
}

const DIVERSITY = rollDiversityAnchor();
console.log('Bu calisma icin cesitlilik filosu:');
console.log(JSON.stringify(DIVERSITY, null, 2));

const STEP_1_SUSPECT = `Hukuki bir sorgulama oyunu icin suphelisi uretiyorsun.

CESITLILIK FILOSU (KESIN KISITLAR — hepsi karsilanmali):
{{diversity_anchor}}

Filoyu nasil kullan:
- true_verdict yukaridaki degere ESIT olmak ZORUNDA. Diger degeri secme.
- role_category SUPHELININ MESLEK SINIFINI belirler. Bu kategorinin
  icinden somut bir is sec. Kategori aciklayicidir; varsayilan olarak
  kurumsal yonetici, ilac firmasi calisani veya buyuk firma CFO/GM ASLA
  secme — yalnizca kategori bunu adlandiriyorsa.
- charge_category 2. ADIM ICIN HUKUKI ANLASMAZLIK TIPINI belirler.
  Suphelinin motiv ve sirri bu suclama kategorisi icinde mantikli olmali.
- secondary_secret_category IKINCIL SIR SEKLINI belirler. Kategori farkli
  bir sey soyluyorsa "is yerinde iliski" ile DEGISTIRME.
- medical_profile SUPHELININ TIBBI BASELINE'INI belirler. Bunu medical[]
  ve habits[] kayitlarina ve modifiers'a cevir. Kategori "temiz baseline"
  diyorsa az/hicbir tibbi giris kullanma ve modifiers'i varsayilana yakin
  tut (heart_rate_suppression ~0, gsr_sensitivity ~1.0).
- age_bracket suphelinin yasini kisitlar.
- family_shape ev/aile[] kompozisyonunu kisitlar.
- suspect_tone suphelinin profilde ve sonraki cevap metinlerinde nasil
  goruldugunu sekillendirir — fiil seçimi ve tavri buna gore sec.
- anti_default_principles modelin coktugu yapisal varsayilanlarin
  listesidir. Her maddeyi taslagin uzerinde sert bir kisit gibi uygula.
  Tek bir madde bile ihlal edilmisse cikti gecersizdir — dondurmeden
  once duzelt.

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
- Cesitlilik filosundaki role_category'den alinan gercekci, modern bir
  meslek. Filo aciklayicidir; varsayilan olarak kurumsal yonetici, ilac
  firmasi calisani veya buyuk firma CFO'su olamaz — yalnizca filo o
  kategoriyi acikca adlandiriyorsa.
- Supheli ahlaki olarak belirsiz olmali
- profile sunlari icermeli:
  - gecmis
  - kariyer
  - kisilik ozellikleri
  - bir supheli detay
  - bir insani detay
  Not: profile yalnizca pipeline icin DAHILI baglamdir — oyuncuya asla
  gosterilmez. Burada detayli olabilirsin. "Insani detay" ikincil sirri
  referans alabilir cunku bu alan oyuncu tarafindan goruntulenmez; ancak
  ikincil sir oyuncuya gosterilen alanlara (dossier.family,
  dossier.priors, dossier.pressure_points, context) SIZMAMALI.
- motive potansiyel bir dava veya haksiz fiille baglantili olmali
- secret asikar OLMAMALI ama anlamli olmali
- credibility 1-10 arasinda, gerekcesi ustu kapali ima edilmeli
- true_verdict bu calisma icin cesitlilik filosu tarafindan SABITLENMISTIR.
  Onu KESINLIKLE DEGISTIRME.
  - "GUILTY" = supheli gercekten sorumlu (secret asil fiili iceriyor)
  - "NOT_GUILTY" = secret karanlik bile olsa supheli bu suctan masum
  - Enum degerleri ingilizce kalmali
  - NOT_GUILTY bir supheli yine de GERCEK bir ikincil sirri gizliyor olmali
    — bu sir cesitlilik filosundaki secondary_secret_category'den
    sekillendirilir. Bu ikincil sir guclu fizyolojik tepkilere yol acar
    ama suclama konusu olan sucun mekanizmasiyla ilgili degildir.

KATMANLI SIRLAR (ZORUNLU):
- Her supheli EN AZ IKI farkli seyi gizlemeli:
  BIRINCIL SIR: dogrudan suclamayla ilgili olgu (suclu veya masum olabilir)
  IKINCIL SIR: suclamayla ILGISIZ, gercek stres tepkisi yaratan baska bir gizli.
    Cesitlilik filosundaki secondary_secret_category'den SEKILLENDIR — filo
    aksini soyluyorsa "is yerinde iliski" varsayilanina kayma. Bu "yer
    degistirmis suclilik" kaynagi — birincil suclilik gibi gorunen ama
    aslinda oyle olmayan sinyaller. Her ikisini "secret" alaninda su bicimde
    belgele: "BIRINCIL: [suclama ile ilgili sir]. IKINCIL: [ilgisiz stres kaynagi]."
- Ikincil sir gercek bir baskilama noktasi olmali ve yuksek biyometrik tepkilere
  yol acmali. Hangisinin hangi sorularda tetiklendigini dikkatle gozlemlemeyle
  birincil sirdan ayirt edilebilmeli.

DOSSIER (oyuncunun sorgudan ONCE okuyacagi arka plan):
- age: gercekci bir yas
- identity_summary: 1-2 cumle, gorev ve kilit nitelikler
- family: 1-4 giris. Bunu bir arastirmacinin TARAFSIZ ozgecmis fisi gibi
  dusun: kamu kayitlarindan ve IK formlarindan derlenmis OLGUSAL bilgi.
  Her note alani SADECE herkesce bilinebilecek olgusal baglam icermeli
  (iliski suresi, meslek, saglik/velayet durumu, bagimlilik durumu, dikkat
  ceken kosul). KESIN KURALLAR (bu metin DOGRUDAN OYUNCUYA gosterilir):
  - Biyometrik terimleri ASLA kullanma ("sicrama", "GSR", "HR", "nabiz",
    "nefes", "tepki", "yukselir", "tetikler" vb.).
  - "Leverage", "baski noktasi", "anahtar tetik", "en kuvvetli tepki",
    "somurulebilir", "zayif nokta" gibi kelimeleri ASLA YAZMA.
  - Bu kisinin anilmasinin suphelide nasil bir TEPKI yarattigini ASLA
    aciklama.
  - Bir aile uyesini "en onemli" olarak ONE CIKARMA veya hangi uyenin
    birincil suclamayla, hangisinin ozel bir konuyla ilgili oldugunu
    asla ima etme. Tum kayitli kisileri ESIT, tarafsiz ve olgusal bir
    tonda yaz.
  - Suphelinin sirrini, motivini veya bilinen stres konularini ASLA
    referans alma.
  - 1-2 kisa cumle, bir personel dosyasinin yazacagi kuru tonda.
  Iyi: "Kizi, 14 yasinda. 2021 velayet kararindan bu yana tam zamanli
  Renata ile yasiyor. Tek mali bagli."
  Kotu: "Kizinin adi anildiginda profilinin en guclu biyometrik tepkisini
  uretir; empatik cerceveleme icin yuksek leverage."
- medical: 0-3 giris. Her birinin polygraph_effect alani, durumun cihazi
  MEKANIK olarak nasil bozdugunu aciklamali (orn. anksiyete bozuklugu ->
  yuksek GSR baseline; kalp pili -> kalp atisi dalgalanmasi bastirilir).
  Bu notlari, bir poligraf uzmaninin yazacagi GENEL klinik/forensik notlar
  gibi yaz — CIHAZ hakkinda, suphelinin psikolojisi veya bu dava hakkinda
  DEGIL. Belirli bir konunun bu durumu tetikleyecegini ASLA ima etme. Suc
  kaniti olacak sekilde hastalik UYDURMA.
- habits: 0-3 giris (ilac, kafein, uyku, madde). Her birinin
  polygraph_effect alani olmali. Ornek: "Beta-bloker -> kalp atisi
  tepkisi baskilanir"; "Yuksek kafein -> GSR baseline yuksek"; "SSRI ->
  sempatik tepki hafifler". Medical ile ayni kural: genel klinik not gibi
  yaz, bu davaya ozel rehberlik degil.
- priors: 0-3 kisa olgusal bullet (onceki olaylar). Verdict'i ele vermez.
  Hangi onceki olayin guncel suclamayla baglantili oldugunu telegraflama
  — hepsini esit, duz bir tonda sirala.
- pressure_points: 2-4 kisa bullet — onceki bir gorusmecinin not aldigi
  KONUSAL hassasiyetler. Bu metin DOGRUDAN OYUNCUYA gosterilir (dosya
  ekranindaki "Baski Noktalari" bolumu). Amac TON belirlemek ve ele alma
  zorlugunu ima etmek — cevap anahtari saglamak DEGIL.
  KESIN KURALLAR:
  - "BIRINCIL", "IKINCIL", "PRIMARY", "SECONDARY", "yer degistirmis
    suclilik", "displaced guilt", "asil tetik", "yaniltici konu",
    "birincil suclama" veya benzer meta-oyun etiketlerini ASLA yazma.
  - Biyometrik desen TAHMINI YAPMA. "GSR yukselir", "HR sicrar", "nefes
    duzensizlesir", "korku bari yukselir" GIBI hicbir sey YAZMA. Pressure
    points yalnizca SUPHELININ TAVRINA dair GOZLEMSEL notlardir,
    biyometrik tahmin DEGIL. Oyuncu biyometriyi canli poligraftan
    okuyacak, dosyadan DEGIL.
  - Tetikleri SIRALAMA ("en kuvvetli", "en keskin", "en net cift kanal
    sinyali", "en guvenilir kanit"). Listelenen tum hassasiyetler ESIT
    agirlikta sunulmali.
  - Anilmasi "asil tetik" veya benzeri olan belirli bir KISI ADI ASLA
    yazma. Genis konusal alanlara atif yapabilirsin ("is hayatindaki
    iliskiler", "kisisel mali detaylar", "olay gecesi") ama hicbirini
    belirleyici ifsa olarak isaretleme.
  - Sirri ASLA ifsa etme veya ima etme. Listelenen konusal alanlar,
    gercek bir gorusmecinin sirri BILMEKSIZIN sadece TAVIRDAN (savunma,
    savusturma, fazla aciklama, sessizlik, sinirlenme) cikarabilecegi
    seyler olmali.
  - Listelenen pressure_points'lerden EN AZ BIRI makul bir YANILTICI
    OLMALI: suphelinin ihtiyatli oldugu ama suclama icin aslinda
    belirleyici olmayan bir konusal alan. Bunu boyle etiketleme; digerleri
    ile esit agirlikta sun.
  - Hangi gorusme taktiginin (EMPATHIC, ANALYTICAL, AGGRESSIVE) suphelinin
    acilmasini ya da kapanmasini sagladigini kisaca not edebilirsin —
    genel kalsin, belirli bir konuya bagli olmasin.
  Format: "[Konusal alan veya davranissal gozlem] — [tavir / konusma
  oruntusu, BIYOMETRIK DEGIL] — [opsiyonel genel taktik notu]". Ornek:
  "Uzun sureli is arkadaslarinin ele alindigi konular — supheli belirgin
  sekilde ihtiyatlilasiyor ve cevap vermeden once soruyu kendisi tekrar
  cerceveliyor; ANALYTICAL yaklasim cekilmeyi tirmandiriyor."
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
- Anlasmazlik MUTLAKA bu calisma icin secilen suclama kategorisi icinde
  olmali:
  {{charge_category}}
  Yukarida acikca adlandirilmadikca kurumsal dolandiricilik, ilac
  malpraktisi, zimmet, rusvet veya buyuk firma haksiz olum varsayilanlari
  KULLANILMAMALI.
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
  - Mekanizma-testi sorulari YUKSEK sinyaller uretir — supheli mimariyi
    bizzat biliyor ve ayrinti suclandirici
- Eger suspect.true_verdict == "NOT_GUILTY":
  - Supheli GUCLU bicimde spikelayabilir — ama yalnizca IKINCIL sirra
    iliskin sorularda (yer degistirmis suclilik). Ikincil sirra iliskin
    sorular MAX_SPIKE/SURGE/HOLDING_BREATH kumeleri uretebilir ve oyuncuyu
    suclulugun izini bulduklarini sandirir.
  - BIRINCIL suclamanin mekanizmasina iliskin sorular DUSUK/STABLE sinyaller
    uretmeli — supheli gercekten birinci el bilgiye sahip degil. Korku bari
    mekanizma-testi dugumunde DUSMELI.
  - Sert suclama sorulari savunmaci sicramalar yaratabilir ama suclama-
    spesifik sorularda surekli MAX GSR + HR MAX_SPIKE + HOLDING_BREATH
    birlikteligi OLMAMALI
  - Basari dugumunun result_text alani sinyal DAGILIMINI tanimlamali
    (hangi sorular sicramis, hangileri sakin kalmis) — yalnizca zirve
    degerleri degil — oyuncunun yuksek genel korku barına ragmen
    NOT_GUILTY sonucuna dogru ulasabilmesi icin
- NOT_GUILTY supheli icin asla sahte itiraf yazma; MAX_SPIKE + MAX GSR +
  HOLDING_BREATH / HYPERVENTILATION kombinasyonunu sadece GUILTY gerceklere
  sakla

DUGUM SAYISI VE TOPOLOJI:
- Toplam 10-14 dugum (minimum 10 — daha kisa graflar trivial derecede kolay davalar uretir)
- Icermesi gerekenler:
  - node_01_intro (giris dugumu)
  - 7-10 sorusturma dugumu
  - 1-2 "temiz sonuc" son dugumu (id "success" icermeli, orn. node_success_*)
    Mumkunse farkli varyantlar: node_success_breakdown (tam duygusal cokus +
    kabul) ve node_success_partial (kontrollü kismen kabul, supheli sogukkanlı
    kalir ama kanit ezici). Her birinin result_text alani farkli bir biyometrik
    desen tanimlamali.
  - 2+ "asinmis sonuc" son dugumu (id "fail" icermeli, orn. node_fail_*)
    Mumkunse farkli varyantlar: orn. node_fail_lockdown (sert hukuki kapanma)
    veya node_fail_deflection (yumusak savusturma — avukat talep etmeden sorgu
    biter, sinyal kaydi belirsiz kalir).

YOL UZUNLUGU KURALLARI (OYUN DERINLIGI ICIN KRITIK):
- Hicbir son dugumu (basari veya basarisizlik) baslangic dugununden 6'dan az
  gecisle erisilebilir olmamali. Oyuncu herhangi bir sorgu sona ermeden once
  en az 6 icerik dugumunden gecmeli.
- Yanlis bir secim, erken dugumlerden (node_01_intro veya ilk uc icerik dugumu)
  dogrudan bir fail son dugumune HICBIR ZAMAN yonlendirmemeli. Erken yanlis
  hamleler bunun yerine ZAYIF BIR DALA yonlendirmeli — sorguyu daha gucluklu
  kosullarda devam ettiren normal bir icerik dugumu (supheli daha temkinli,
  uretken yollar azalmis, biyometrik bazline kaydi). Dogrudan fail-dugumu
  yonlendirmesini yalnizca son 2 icerik dugumundeki yanlis hamleler icin
  kullan.
- Grafin en az IKI YAKINLASMA NOKTASI olmali: birbirinden bagimsiz iki ayri
  yol ciftinin ayni ara dugume ulastigi noktalar. Bu, oturumun tum uzunlugunda
  birden fazla rotanin gercekci kalmasini saglar.
- Saf dogrusal zincirlerden (A→B→C→D→son) kacin. En az iki dugum, farkli
  onceki dugumlerden birden fazla rota ile erisilebilir olmali.
- 4. dugumden sonraki her sorusturma dugumu, uretken bir yon ile incelikle
  yanlis bir yon arasinda anlamli bir gerilim sunmali — ikinci yarida sorgu
  hicbir zaman kendinden akici hissettirmemeli.

ZORUNLU DUGUM — MEKANIZMA TESTI (ZORLUK ICIN KRITIK):
- Bir sorusturma dugumu MUTLAKA bir mekanizma-bilgi testi olmali: supheliden
  iddia edilen haksiz fiilin NASIL isledigini teknik/procedürel detayla
  aciklamasi istenmeli.
  - GUILTY supheli: YUKSEK sinyaller uretir (HR SPIKE/MAX_SPIKE, GSR SURGE/MAX)
    cunku mimariyi bizzat biliyor ve ayrinti suclandirici.
  - NOT_GUILTY supheli: DUSUK/STABLE sinyaller uretir cunku mekanizma hakkinda
    birinci el bilgisi yok — yuzeysel aciklama, kucuk olgusal hatalar, gercek
    belirsizlik. Korku bari burada DUSEBILIR.
  Bu dugum, birincil suclulugun yer degistirmis sucluluktan ayirt edilmesini
  saglayan temel aractir. Onsuz oyuncu ikiyi birbirinden ayiramaz.

ZORUNLU DUGUM — TAKIP SOMURULMESI:
- Mekanizma testinin ARDINDAN gelen bir sorusturma dugumu mutlaka takip
  somurulmesi dugumu olmali: operator, mekanizma testinde (veya daha onceki
  bir yanittan) ortaya cikan somut bir tutarsizligi veya boslugu supheliye
  karsi kullanir ve aciklama talep eder. Bu dugum:
  - Suphelinin bir onceki dugumde soyledigi somut bir seye atif yapmali.
  - En az 3 secim sunmali: (a) hassas adli takip, (b) aciklama davet eden
    empatik yeniden cerceveleme, (c) avantaji teslim eden erken tirmanma.
  - Dogru yolda oturumun ikinci en yuksek biyometrik kumesini uretmeli.

ZORUNLU DUGUM — SUPHELI YENIDEN CERCEVELEME GIRISIMI:
- Bir sorusturma dugumu mutlaka suphelinin aktif sekilde anlatiyi degistirmeye
  calistigi bir an olmali: yeni bir aciklama getiriyor, daha zor bir soruyu
  onlemek icin kismen kabul ediyor ya da ucan bir suclamaya donuyor. Operator
  nasil yanitlayacagini secmeli:
  - Yeniden cercevelemeyi kabul et (yanlis hamle: biyometrik suskulasiyor,
    supheli zemin kazaniyor)
  - Nazikce asil konuya geri don (ilerleme: orta duzey sinyal)
  - Yeniden cercevelemeyi dogrudan bir celiski ile zorlat (yuksek sinyal,
    yuksek risk)

ZORUNLU — YANILTICI KANIT YOLU:
- Bir kanit yolu MUTLAKA yaniltici olmali: gercek bir kanit parcasi ama IKINCIL
  sirri dogruluyor, birincil sucu degil. Bu yolu izleyen oyuncular onu birincil
  suclilik olarak yanlislikla okuyabilir. Bu yol success dugumune degil, fail
  veya belirsiz bir dugume gitmeli — kanit gercek ama yorum yanlis.

HER DUGUM ICIN SECIM SAYISI:
- En az UC sorusturma dugumu 3 secim sunmali (sadece 2 degil).
- 3 secimli her dugumun ucuncu secimi metodolojik olarak makul GORUNMELI ama
  sorguyu incelikle zayiflatmali — yanlis hamleler agresif veya aptalca
  OLMAMALI. Oyuncu bunun yanlis oldugunu ancak mekanik sonucu gordukten sonra
  anlamali.
- Grafin ikinci yarisinda (5. dugum ve sonrasi) en az bir dugum TAKTIKSEL
  RESET secenegi sunmali: baskiyi duraklatip suphelinin nefes almasina izin
  veren bir secim — kisa vadede yanlis (korku_bari_delta negatif) ama
  dogrudan fail'e yonlendirmek yerine yeni bir yol acabilir.

TUM DUGUMLER (son dugumler dahil) icin alanlar:
- theme: 2-5 kelimelik kisa sahne etiketi (orn. "Gece Yarisi Commit'i")
- description: OYUNCUYA GOSTERILEN 1-2 cumlelik sahne anlatimidir. Yalnizca
  operatorun odada gozlemlediklerini yaz: suphelinin gorünür durusu, tavri
  ya da anin fiziksel/durumsal baglami (masada ne var, atmosfer, konu
  degisimindeki gecis). description icin KESIN KURALLAR:
  - Sirlara, birincil/ikincil sirlara veya gizli motivlere HICBIR ATIF yapma.
  - Biyometrik strateji, sinyal tahmini veya oyun tavsiyesi YAZMA.
  - Meta-oyun dili KULLANMA ("yaniltici kanit yolu", "mekanizma testi dugumu",
    "yer degistirmis suclilik", "bu kanit ikincil sirri dogruluyor",
    "biyometrik olarak patlayici" vb.).
  - Oyuncu o an sorgu odasinda oturuyormus gibi yaz. Yalnizca gercek bir
    gozlemcinin o anda fiziksel olarak gorebilecegi veya hissedebilecegi
    seyleri tanimla.
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

CEVAP ALANI (KRITIK):
- answer: Suphelinin BIRINCI SAHIS DOGRUDAN KONUSMA olarak yazilmis sozlu yaniti.
  Ucuncu sahis anlati veya sahne yonlendirmesi ASLA kullanma
  (orn. YANLIS: 'Biraz gerilir ve diyor ki...', 'Duraklayarak sozu aliyor...',
       'Sesi titrerek "bilmiyorum" diyor.').
  Yalnizca suphelinin gercekten soyledigi sozcukleri yaz; duraksamalar
  uclu nokta olarak ifade edilmeli (orn. '...ben... bilmiyorum'),
  savunma, kacamak, kismen kabul ya da inkar iceren cumleler dogal konusma
  dilinde yazilmali. Eylem tanimi yok. Anlati sesi yok. Anlati icinde
  alcaktirmalı alinti yok.

MECHANICS (suphelinin tepkisine VE true_verdict'e uyan degeri sec — yukaridaki
SINYAL-GERCEK UYUMU bolumune bakin):
- heart_rate: BASELINE | STABLE | RISE | INCREASE | SPIKE | MAX_SPIKE | DROP | ERRATIC
- breathing: BASELINE | CALM | DEEP | SHALLOW | HOLDING_BREATH | UNEVEN | HYPERVENTILATION | CRYING
- gsr: BASELINE | STABLE | INCREASE | SPIKE | SURGE | MAX | DECREASE
- cctv_visual: YALNIZCA su degerlerden biri olmali (bilesik veya ozel deger yok):
  EYE_DART | LOOK_DOWN | RELIEVED_EXHALE | HAND_PINCH_UNDER_TABLE |
  DEFENSIVE_CROSS_ARMS | BREAKDOWN | STONE_FACE | EMPTY_STARE |
  JAW_TIGHTEN | RELEASED_SHOULDERS | LIP_PRESS | TEAR_POOLING
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

const STEP_4_EXTRAS = `Nihai dava birlestirmesi icin yalnizca geri kalan
yaratici alanlari uretiyorsun. Supheli, dava ve dugumler kodda birlestirilecek —
bunlari YENIDEN URETME.

GIRDI:
Supheli:
{{suspect_json}}

Dava:
{{case_json}}

CIKTI KURALLARI:
- Yalnizca gecerli JSON dondur
- Markdown veya aciklama yok
- Serbest metinler Turkce olmali

CIKTI:
{
  "fear_bar_description": string,
  "heart_rate_baseline": number,
  "gsr_baseline": number,
  "verdict_truth_text": string
}

KURALLAR:
- fear_bar_description: GENEL, DAVA-BAGIMSIZ, KISA bir tanim. Bu metin
  HERHANGI BIR DAVAYA uyabilecek bir tooltip gibi okunmali — yalnizca
  oturum boyunca suphelinin biriken psikolojik gerilimini ozetledigini
  belirtir. KESIN KURALLAR:
  - Suphelinin adini, baska hicbir kisiyi, aile uyesini veya konuyu ASLA
    isimlendirme.
  - Hangi sorularin/konularin/iliskilerin bari yukselttigini veya
    dusurdugunu ASLA aciklama.
  - Suphelinin zaaflarini, sirlarini veya hukmu ASLA ima etme.
  - Tercihen 1 cumle, en fazla 2. Davalar arasinda yeniden kullanilabilir
    olmali.
  Ornek: "Suphelinin oturum boyunca biriken psikolojik geriliminin bir
  ozet gostergesi — nabiz, nefes duzensizligi, ter tepkisi ve gorunur
  duyguyu tek bir gerilim okumasinda bir araya getirir."
- heart_rate_baseline: BPM sayisi. ~70'ten basla, dossier.modifiers.
  heart_rate_baseline_shift anlamliysa uygula. Tipik aralik 60-90.
- gsr_baseline: microsiemens sayisi. ~5'ten basla, dossier.modifiers.
  gsr_baseline_shift anlamliysa uygula. Tipik aralik 4-10.
- verdict_truth_text: 2-3 cumle Turkce aciklama, suphelinin gercekte
  ne yaptigini (veya yapmadigini) ac. Hukum ekranindan sonra sonuc
  ekraninda gosterilir. suspect.secret, suspect.motive ve true_verdict
  ile tutarli olmali:
  - GUILTY ise: suphelinin gercek fiilini acik bir dille anlat.
  - NOT_GUILTY ise: gercek sorumluyu ya da nedeni isaret et; suphelinin
    secret'inin karanlik ama bu davada sucsuz oldugunu belirt.`;

const fill = (template, vars) =>
  Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, JSON.stringify(val, null, 2)),
    template
  );

const think = (budget) => ({ type: 'enabled', budget_tokens: budget });

const steps = [
  {
    // Karmaşık yaratıcı profil — Sonnet kalitesi gerekli
    name: 'suspect',
    model: MODEL.HEAVY,
    prompt: () => fill(STEP_1_SUSPECT, { diversity_anchor: DIVERSITY }),
    parse: parseJsonBlock,
    thinking: think(4000),
    maxTokens: 12000,
  },
  {
    // Basit yapılandırılmış özet — Haiku yeterli ve çok daha ucuz
    name: 'case',
    model: MODEL.LIGHT,
    prompt: (r) =>
      fill(STEP_2_CASE, {
        suspect_json: r.suspect,
        charge_category: DIVERSITY.charge_category,
      }),
    parse: parseJsonBlock,
    thinking: think(1024),
    maxTokens: 3000,
  },
  {
    // En karmaşık adım — 10-14 düğümlü dal grafiği — Opus en yüksek kalite
    name: 'nodes',
    model: MODEL.NODES,
    prompt: (r) => fill(STEP_3_NODES, { suspect_json: r.suspect, case_json: r.case }),
    parse: parseJsonBlock,
    thinking: think(10000),
    maxTokens: 50000,
  },
  {
    // Dört basit alan — Haiku hızlıca ve ucuza halleder
    name: 'extras',
    model: MODEL.LIGHT,
    prompt: (r) => fill(STEP_4_EXTRAS, { suspect_json: r.suspect, case_json: r.case }),
    parse: parseJsonBlock,
    thinking: think(1024),
    maxTokens: 3000,
  },
];

const STEP_LABELS = {
  suspect: 'Şüpheli oluşturuluyor...',
  case: 'Dava bağlamı oluşturuluyor...',
  nodes: 'Sorgulama düğümleri oluşturuluyor...',
  extras: 'Hüküm metni ve baseline değerleri üretiliyor...',
};

const { results } = await runPipeline(steps, {
  system: SYSTEM,
  onStepStart: ({ name }) => console.log(STEP_LABELS[name] ?? `${name} işleniyor...`),
  onStep: ({ name, text, stopReason }) => {
    const step = steps.find((s) => s.name === name);
    const model = step?.model ?? 'default';
    console.log(
      `[${name}] tamamlandı — ${text.length} karakter, model=${model}, stop_reason=${stopReason}`
    );
  },
});

const suspect = results.suspect.suspect;
const caseCtx = results.case;
const nodes = results.nodes;
const extras = results.extras;

const imageOutPath = resolve('assets', 'characters', `${caseId}.png`);
console.log('Karakter görseli oluşturuluyor...');
await generateCharacterImage(suspect, imageOutPath);

const finalOutput = {
  game_data: {
    title: caseCtx.title,
    suspect: {
      name: suspect.name,
      role: suspect.role,
      profile: suspect.profile,
    },
    system_config: {
      initial_fear_bar: 20,
      max_fear_bar: 100,
      fear_bar_description: extras.fear_bar_description,
      heart_rate_baseline: extras.heart_rate_baseline,
      gsr_baseline: extras.gsr_baseline,
    },
    context: caseCtx.context,
    true_verdict: suspect.true_verdict,
    verdict_truth_text: extras.verdict_truth_text,
    dossier: suspect.dossier,
    start_node: nodes.start_node,
    nodes: nodes.nodes,
    character_image: `./assets/characters/${caseId}.png`,
  },
};

const outPath = resolve('dialogs', `${caseId}.json`);
writeFileSync(outPath, JSON.stringify(finalOutput, null, 2));
console.log(`yazildi: ${outPath}`);

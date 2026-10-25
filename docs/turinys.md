# Kaip pakeisti turinį

Redaguokite `content.json`, tuomet paleiskite `npm run build` ir `npm run check`. Generuojamo `dist/` aplanko tiesiogiai redaguoti nereikia.

Svetainėje palikta viena moterų savaitgalio stovykla. Žinoma data - gruodžio 5 d.; metai ir pabaigos data nenurodyti. Tekstai remiasi Miglės ir Miglės įrašytu kvietimu. Vieta, kaina, programa ir Google Forms nuoroda dar negautos. Nežinomus duomenis palikite `null` arba tuščią masyvą - svetainė parodys jų būseną ir nerodys išgalvotų programos dienų.

## Pagrindinė informacija

| Laukas | Turinys |
| --- | --- |
| `site.name`, `site.url` | Pavadinimas ir pagrindinis svetainės adresas |
| `site.draft` | `true` - maketas su `noindex`; `false` - galutinė versija su indeksavimu ir svetainės žemėlapiu |
| `site.email`, `site.phone`, `site.phoneDisplay`, `site.facebook` | Kontaktai; `phone` be tarpų, `phoneDisplay` - rodomas numeris |
| `site.heroTitle`, `site.heroAccent` | Dvi pirmo ekrano antraštės dalys |
| `site.aboutText` | Trumpas Miglių prisistatymas; kiekvienas masyvo elementas - pastraipa |
| `site.togetherImage` | Bendra Miglių nuotrauka per visą puslapio plotį arba `null`, kol nuotraukos nėra |
| `site.storyTitle`, `site.story` | Prisistatymo puslapio antraštė ir pastraipos |

## Miglių kvietimo video

Video nustatymai laikomi objekte `site.video`:

| Laukas | Turinys |
| --- | --- |
| `src` | Optimizuoto video kelias: `/assets/migliu-kvietimas.mp4` |
| `poster` | Video viršelio kelias: `/assets/migliu-kvietimas-poster.jpg` |
| `title` | Video pavadinimas pagalbinėms skaitymo priemonėms |
| `durationLabel` | Rodoma video trukmė; pakeiskite kartu su įrašu |
| `transcript` | Kvietimo tekstas: masyvo objektuose `speaker` - kalbėtoja, `text` - jos žodžiai |

Atidarius puslapį video automatiškai kartojamas be garso, užpildydamas pirmą ekraną. Įprastos naršyklės grotuvo juostos nėra. Fone vaizdo kraštai apkerpami pagal ekrano proporcijas; tai nekeičiama pačiame MP4 faile.

Mygtukas „Klausyti kvietimo“ atidaro visą vertikalų kadrą lange virš puslapio ir paleidžia įrašą su garsu nuo pradžios. Naudojamas tas pats video elementas ir failas. Langą galima uždaryti jo mygtuku arba Escape klavišu; tada video grįžta į foną be garso. Atskiru mygtuku įrašas pristabdomas arba paleidžiamas abiem atvejais. Uždarius langą išsaugoma ankstesnė fono pristabdymo būsena. Jei naršyklė neleidžia automatinio atkūrimo, video galima paleisti mygtuku. Pasirinkus mažiau judesio įrenginio nustatymuose, automatinis atkūrimas sustabdomas.

Video siunčiamas automatiškai, todėl svarbu jo neapsunkinti: dabartinis optimizuotas failas yra maždaug 16,1 MB. Kvietimo tekstą galima išskleisti pagrindiniame puslapyje. Tai tekstinė įrašo alternatyva, ne pagal laiką suderinti subtitrai.

Keisdami įrašą paruoškite MP4 su H.264 vaizdu ir AAC garsu; išlaikykite teisingą orientaciją. Publikuojamas failas turi neviršyti 25 MiB. Atnaujinkite JPG viršelį, trukmę ir kvietimo tekstą. Originalius video failus saugokite atskirai nuo svetainės saugyklos.

`content.json` palikite įprastus video ir viršelio kelius be versijos parametrų. Build pagal failų turinį automatiškai prideda `?v=…` prie jų nuorodų. Pakeitus MP4 ar JPG ir paskelbus naują build, naršyklė atsisiųs naują versiją net jei ankstesnis failas dar laikomas jos atmintinėje. Taip pat automatiškai atnaujinamos stilių ir JavaScript nuorodų versijos.

## Vienintelė stovykla

`camps` masyve palikite vieną objektą - `camps[0]`.

| Laukas | Turinys |
| --- | --- |
| `slug` | Dabar `stovykla-01`; keisti apgalvotai, nes pasikeis puslapio adresas |
| `title`, `summary`, `introTitle` | Stovyklos pavadinimas, trumpas kvietimas ir aprašymo antraštė |
| `date` | Patvirtinta data; dabar „Gruodžio 5 d.“ |
| `location`, `price` | Patvirtinta vieta ir kaina arba `null` |
| `image` | Stovyklos puslapio nuotraukos kelias arba `null` |
| `description` | Aprašymo pastraipos |
| `program` | Programos blokai su laukais `title` ir `text`; kol programa nežinoma - `[]` |
| `faq` | Klausimai ir atsakymai: `question`, `answer` |
| `registrationUrl` | Tikra Google Forms HTTPS nuoroda arba `null` |

Paskelbus formą pakeiskite vieną reikšmę:

```json
"registrationUrl": "https://forms.gle/JUSU_FORMOS_KODAS"
```

Pavyzdžio kodo nepublikuokite kaip tikros nuorodos. Tinka ir visas `https://docs.google.com/forms/...` adresas. Formą patikrinkite atsijungę nuo Google paskyros: ji turi būti prieinama numatytoms dalyvėms. Mygtukai atidarys formą naujame skirtuke. Svetainė pati registracijos duomenų nerenka.

Kol `registrationUrl` yra `null`, kvietimas dalyvauti veda į registracijos informaciją su aiškiu pranešimu ir el. paštu. Neskelbkite išgalvotos ar neveikiančios formos nuorodos.

Laukai `site.heroText`, `site.themes`, `secondaryImage`, `included` ir `notIncluded` palikti vėlesniam turiniui; dabartinis šablonas jų nerodo. Gavus kainos sudėtį reikės papildyti ir `scripts/build.mjs`.

## Nuotraukos

Failus įkelkite į `assets/`, o atitinkamame lauke įrašykite kelią, pavyzdžiui:

```json
"image": "/assets/stovykla.webp"
```

Naudokite aiškius failų pavadinimus be tarpų ir optimizuotas WebP, JPG arba PNG nuotraukas. Bendrai horizontaliai nuotraukai tinka maždaug 1600-2000 px plotis. Svarbius veidus laikykite arčiau centro: skirtinguose ekranuose nuotraukos kraštai gali būti apkerpami. Originalus pasilikite atskirai.

`assets/logo-original.jpeg` nekeiskite: tai gautas originalas. Svetainės logotipas ir favicon laikomi atskiruose failuose.

## Ko dar reikia prieš atveriant registraciją

- Patikslintos stovyklos datos, atvykimo ir išvykimo laiko.
- Vietos, kainos, programos ir informacijos, kas įskaičiuota.
- Atvykimo informacijos, registracijos ir atšaukimo sąlygų.
- Veikiančios Google Forms nuorodos.
- Organizuojančių Miglių patvirtintų tekstų ir, jei norės, papildomų nuotraukų.

Gavę naują informaciją atnaujinkite ir susijusius DUK atsakymus. Atsiliepimus dėkite tik gavę tikrus tekstus ir leidimą juos skelbti. Prieš viešą paleidimą patikrinkite puslapius, telefoną, el. paštą, video ir formą kompiuteryje bei telefone. Indeksavimą įjunkite pagal [talpinimo instrukciją](talpinimas.md), kai turinys bus patvirtintas.

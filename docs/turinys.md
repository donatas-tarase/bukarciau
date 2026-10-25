# Kaip pakeisti turinį

Redaguokite `content.json`, tuomet paleiskite `npm run build` ir `npm run check`. Generuojamo `dist/` aplanko tiesiogiai redaguoti nereikia.

Svetainėje palikta viena moterų savaitgalio stovykla. Žinoma data - gruodžio 5 d.; metai ir pabaigos data nenurodyti. Tekstai remiasi Miglės ir Miglės įrašytu kvietimu. Vieta, kaina, programa ir Google Forms nuoroda dar negautos. Nežinomus duomenis palikite `null` arba tuščią masyvą - svetainė parodys jų būseną ir nerodys išgalvotų programos dienų.

## Pagrindinė informacija

| Laukas | Turinys |
| --- | --- |
| `site.name`, `site.url` | Pavadinimas ir pagrindinis svetainės adresas |
| `site.draft` | `true` - maketas su `noindex`; `false` - galutinė versija su indeksavimu ir svetainės žemėlapiu |
| `site.email`, `site.phone`, `site.phoneDisplay`, `site.facebook` | Kontaktai; `phone` be tarpų, `phoneDisplay` - rodomas numeris |
| `site.heroAccent` | Pirmo ekrano antraštė „Būk arčiau.“ |
| `site.heroTitle` | Trumpa eilutė po antrašte; po jos rodoma stovyklos data |
| `site.aboutText` | Trumpas Miglių prisistatymas; kiekvienas masyvo elementas - pastraipa |
| `site.storyTitle`, `site.story` | Prisistatymo puslapio antraštė ir pastraipos |

## Vienintelė stovykla

`camps` masyve palikite vieną objektą - `camps[0]`.

| Laukas | Turinys |
| --- | --- |
| `slug` | Dabar `stovykla-01`; keisti apgalvotai, nes pasikeis puslapio adresas |
| `title`, `summary`, `introTitle` | Stovyklos pavadinimas, trumpas kvietimas ir aprašymo antraštė |
| `date` | Patvirtinta data; dabar „Gruodžio 5 d.“ |
| `location`, `price` | Patvirtinta vieta ir kaina arba `null` |
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

## Vaizdai

Dabartiniame makete nuotraukos ir video nerodomi. Dekoratyvios sritys paliktos tuščios, be nuotraukų vietų užrašų ar ikonų. Logotipas ir favicon išlieka.

Laukai `site.togetherImage`, `image` ir `secondaryImage`, jei jie dar yra `content.json`, šiuo metu nenaudojami. Vien nuotraukos kelio įrašymas jų neįjungs: pirmiausia reikės pakeisti `scripts/build.mjs` ir į build kopijuojamų failų sąrašą.

Į `dist/assets/` kopijuojami tik `logo.svg`, `favicon.svg`, nepakeistas `logo-original.jpeg`, Montserrat šriftai ir jų licencija. Ankstesni video failai bei viršelis nepublikuojami. `assets/logo-original.jpeg` nekeiskite: tai gautas originalas.

Build pagal failo turinį automatiškai prideda `?v=…` prie stilių ir JavaScript nuorodų. Pakeitus šiuos failus reikia iš naujo sugeneruoti ir paskelbti svetainę.

## Ko dar reikia prieš atveriant registraciją

- Patikslintos stovyklos datos, atvykimo ir išvykimo laiko.
- Vietos, kainos, programos ir informacijos, kas įskaičiuota.
- Atvykimo informacijos, registracijos ir atšaukimo sąlygų.
- Veikiančios Google Forms nuorodos.
- Organizuojančių Miglių patvirtintų tekstų ir, jei norės, papildomų nuotraukų.

Gavę naują informaciją atnaujinkite ir susijusius DUK atsakymus. Atsiliepimus dėkite tik gavę tikrus tekstus ir leidimą juos skelbti. Prieš viešą paleidimą patikrinkite puslapius, telefoną, el. paštą ir formą kompiuteryje bei telefone. Indeksavimą įjunkite pagal [talpinimo instrukciją](talpinimas.md), kai turinys bus patvirtintas.

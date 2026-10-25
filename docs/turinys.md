# Kaip pakeisti turinį

Redaguokite `content.json`, tuomet paleiskite `npm run build`. Tekstai laužtiniuose skliaustuose ir nuotraukų vietos yra darbo vietaženkliai, ne galutiniai svetainės tekstai. Palikite `null`, kai nuotraukos ar registracijos nuorodos dar nėra.

## Pagrindinė informacija

| Laukas | Turinys |
| --- | --- |
| `site.name`, `site.url` | Pavadinimas ir pagrindinis svetainės adresas |
| `site.draft` | `true` – maketas su `noindex`; `false` – galutinė versija su indeksavimu ir svetainės žemėlapiu |
| `site.email`, `site.phone`, `site.phoneDisplay`, `site.facebook` | Kontaktai; `phone` be tarpų, `phoneDisplay` – rodomas numeris |
| `site.heroTitle`, `site.heroText`, `site.heroImage` | Pirmo ekrano antraštė, trumpas tekstas ir nuotrauka |
| `site.aboutText` | Trumpas pristatymas pradžios puslapyje; kiekvienas masyvo elementas – pastraipa |
| `site.statement`, `site.statementImage` | Trumpas išskirtas sakinys ir jį lydinti nuotrauka |
| `site.story`, `site.togetherImage` | Bendra istorija ir abiejų organizatorių nuotrauka |
| `organizers` | Dvi organizatorės: `name`, `text`, `image` |

## Stovyklos

Kiekvienas `camps` masyvo objektas aprašo atskirą stovyklą.

| Laukas | Turinys |
| --- | --- |
| `slug` | URL dalis, pvz. `stovykla-01`; keisti apgalvotai, nes pasikeis puslapio adresas |
| `title`, `summary` | Pavadinimas ir trumpas aprašymas stovyklos kortelėje |
| `date`, `location`, `price` | Patvirtinta data, vieta ir kaina |
| `image`, `secondaryImage` | Pagrindinė ir papildoma nuotrauka |
| `description` | Aprašymo pastraipos |
| `program` | Programos blokai su laukais `title` ir `text`; galima pridėti arba pašalinti dienas |
| `included`, `notIncluded` | Kas įskaičiuota ir kuo reikia pasirūpinti pačiai |
| `faq` | Klausimai ir atsakymai: `question`, `answer` |
| `registrationUrl` | Tikra Google Forms HTTPS nuoroda arba `null` |

Pavyzdys, kai forma jau paskelbta:

```json
"registrationUrl": "https://forms.gle/JUSU_FORMOS_KODAS"
```

Pavyzdžio kodo nepublikuokite kaip tikros nuorodos. Tinka ir visas `https://docs.google.com/forms/...` adresas. Formą patikrinkite atsijungę nuo Google paskyros: ji turi būti prieinama numatytoms dalyvėms. Mygtukas atidaro formą naujame skirtuke; svetainė pati registracijos duomenų nerenka.

## Nuotraukos

Failus įkelkite į `assets/`, pvz. `assets/organizatore-1.webp`, o atitinkamame lauke įrašykite kelią:

```json
"image": "/assets/organizatore-1.webp"
```

Naudokite aiškius failų pavadinimus be tarpų ir optimizuotas WebP, JPG arba PNG nuotraukas. Pagrindinei horizontaliai nuotraukai tinka maždaug 2000 px plotis, portretams – apie 1000 px. Svarbius veidus laikykite arčiau centro: skirtinguose ekranuose nuotraukos kraštai gali būti apkerpami. Originalų pasilikite atskirai.

`logo-original.jpeg` nekeiskite: tai gautas originalas. Svetainės ir favicon versijos laikomos atskiruose failuose.

## Ką atsiųsti prieš paleidimą

- Abiejų organizatorių vardus, prisistatymus, portretus ir bendrą nuotrauką.
- Pagrindinę žinutę, trumpą veiklos pristatymą ir istoriją.
- Kiekvienos stovyklos pavadinimą, aprašymą, datą, vietą, kainą, programą ir nuotraukas.
- Kas įskaičiuota, atvykimo informaciją, registracijos ir atšaukimo sąlygas bei atsakymus į DUK.
- Veikiančias Google Forms nuorodas ir patvirtinimą, kad kontaktai teisingi.

Atsiliepimus dėkite tik gavę tikrus tekstus ir leidimą juos skelbti. Prieš viešą paleidimą pakeiskite visus vietaženklius, patikrinkite telefoną, el. paštą ir formas kompiuteryje bei telefone. Tik tada pašalinkite `noindex` pagal [talpinimo instrukciją](talpinimas.md).

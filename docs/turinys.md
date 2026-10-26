# Svetainės turinys

Turinio redaktorius leidžia keisti tekstus, kontaktus, nuotraukas, vienos stovyklos informaciją, registracijos nuorodą ir paieškos aprašymus. Dizainas, blokų tvarka, spalvos, šriftai, puslapių adresai ir logotipai nustatyti kode. Redaktorius neleidžia įterpti HTML, JavaScript ar savavališkų maketo laukų; įrašytas tekstas rodomas kaip tekstas.

Produkcijos prisijungimo ir nuotraukų saugyklos aktyvavimas dar nebaigtas. Vietinį redaktorių galima išbandyti pagal [README](../README.md). Kasdienio naudojimo veiksmai aprašyti [administravimo instrukcijoje](administravimas.md).

## Redaguojamos sritys

| Sritis | Turinys |
| --- | --- |
| Pagrindinis puslapis | Pirmo ekrano antraštė, eilutė po ja, vertybės, trumpas prisistatymas, skyrių antraštės |
| Stovykla | Pavadinimas, data, vieta, kaina, trumpas kvietimas, aprašymai, programa, įskaičiuoti ir neįskaičiuoti dalykai, DUK |
| Apie mus | Organizatorių vardai, prisistatymo antraštė, pastraipos ir kvietimas puslapio apačioje |
| Kontaktai | El. paštas, telefonas, rodomas telefono numeris, Facebook nuoroda, kontaktų tekstai |
| Registracija | Tikra anketos nuoroda, ruošiamos ir atviros registracijos tekstai, mygtukų užrašai |
| Meniu ir poraštė | Svetainės pavadinimas, nuorodų ir mygtukų tekstai, poraštės antraštės |
| Paieška ir dalijimasis | Kiekvieno puslapio SEO antraštė bei aprašymas ir paieškos indeksavimo nustatymas |
| Nuotraukos | Šešios esamos vietos, pasirinktos nuotraukos ir jų alternatyvūs aprašymai |

Tekstą galima redaguoti tiesiai puslapio vaizde. Kontaktinių nuorodų adresai, SEO, sąrašų papildymas ir kiti vaizde nematomi nustatymai pasiekiami turinio skyriuose. Tas pats laukas, panaudotas keliose puslapio vietose, keičiamas kartu.

## Viena stovykla

Svetainėje yra viena stovykla, jos adresas fiksuotas: `/stovyklos/stovykla-01/`. Dabartinė žinoma data - „Gruodžio 5 d.“; metai ir pabaigos data nenurodyti. Vieta, kaina, programa ir Google Forms anketa dar negautos.

Nežinomą vietą, kainą ir registracijos nuorodą palikite tuščias. Duomenyse jos normalizuojamos į `null`. Kol programa nežinoma, palikite tuščią programos sąrašą. Svetainė parodo redaguojamus pranešimus apie dar ruošiamą informaciją. Tušti įskaičiuotų ir neįskaičiuotų dalykų sąrašai viešame puslapyje nerodomi.

Programos įrašas turi antraštę ir aprašymą. DUK įrašas turi klausimą bei atsakymą; papildomai galima nurodyti kitą atsakymą, rodomą tik įrašius registracijos nuorodą. Jis naudingas klausimui „Kaip užsiregistruoti?“. Jei papildomas atsakymas tuščias, abiem registracijos būsenomis rodomas įprastas atsakymas.

Datos ir kontaktų pakeitimai automatiškai neatnaujina jų paminėjimų laisvai parašytuose aprašymuose, DUK ar SEO. Prieš paskelbdami peržiūrėkite ir šiuos tekstus.

## Registracija

Registracijos skyriuje įrašykite tikrą HTTPS Google Forms nuorodą, kai ji bus paruošta. Kol nuorodos nėra, „Noriu dalyvauti“ atveria registracijos informaciją su kontaktais. Įrašius nuorodą, kvietimo mygtukai pradeda atidaryti anketą naujame skirtuke. Ruošiamos ir atviros registracijos tekstus galima keisti atskirai.

Formą patikrinkite atsijungę nuo Google paskyros. Pavyzdinės nuorodos nelaikykite veikiančia registracija. Dalyvių atsakymai lieka Google Forms; šis redaktorius jų nerenka ir neadministruoja.

## Nuotraukos

| Vieta | Turinio laukas |
| --- | --- |
| Pirmo ekrano fonas | `site.heroImage` |
| Plati sritis po prisistatymu | `site.statementImage` |
| Puslapis „Apie mus“ | `site.togetherImage` |
| Pagrindinė stovyklos nuotrauka | `camps.0.image` |
| Mažoji stovyklos nuotrauka | `camps.0.secondaryImage` |
| Plati nuotrauka stovyklos puslapyje | `camps.0.detailImage` |

Kol nuotrauka nepasirinkta, išlieka dabartinė tuščia spalvinė sritis be užrašų. Stovyklos detaliame puslapyje, nepasirinkus atskiro viršelio, naudojama pagrindinė stovyklos nuotrauka, jei ji yra. Nuotraukos pritaikomos esamiems maketo rėmeliams, todėl gali būti apkirptos pagal jų proporcijas.

Pasirinkus nuotrauką būtina trumpai aprašyti, kas joje matoma. Tai alternatyvus tekstas ekrano skaitytuvui, jis nėra užrašas ant nuotraukos. Patvirtinti keliai turi formą `/media/<sugeneruotas-id>.jpg`, `.png` arba `.webp`; savavališkos išorinės paveikslėlių nuorodos nepriimamos.

Įkėlimui tinka JPG, PNG ir WebP. Naršyklė nuotrauką paruošia ir sumažina iki ne didesnės kaip 1600 px ilgesniosios kraštinės; serveris papildomai tikrina tikrą formatą ir ne didesnį kaip 8 MB failą. HEIC pirmiausia eksportuokite į JPG. Video įkėlimo šiame įrankyje nėra.

Nuotraukos įkėlimas į biblioteką jos dar nepaskelbia. Pasirinkite vietą, užpildykite aprašymą, išsaugokite juodraštį ir paskelbkite. Juodraščio nuotraukas gali atverti tik administratorius; viešai aptarnaujamos tik paskelbto turinio naudojamos nuotraukos.

## Pradiniai failai ir indeksavimas

`content.json` naudojamas kaip pradinis turinys tuščiai D1 bazei bei statiniam build rezultatui. Veikiančios CMS turinys saugomas D1. Kodo perpublikavimas jau esančios bazės turinio neperrašo. Leidžiami laukai ir ribos aprašyti `shared/content.mjs`.

`site.draft: true` reiškia „nerodyti paieškos sistemose“: pridedamas `noindex`, ribojamas `robots.txt` ir nesudaromas `sitemap.xml`. Tai nepriklauso nuo administratoriaus juodraščio ir nepaverčia viešos svetainės privačia. Indeksavimo nustatymą keiskite paieškos skyriuje ir paskelbkite kaip kitą turinio pakeitimą.

Prieš atveriant registraciją dar reikia patvirtintos vietos, kainos, atvykimo ir išvykimo laiko, programos, įskaičiuotų dalykų, registracijos bei atšaukimo sąlygų ir veikiančios anketos. Paskelbkite tik organizatorių patvirtintą informaciją ir jų pateiktas nuotraukas.

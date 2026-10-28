# Būk arčiau

Svetainė [bukarciau.lt](https://bukarciau.lt) kompiuteriams ir telefonams. Pristatoma viena Miglės ir Miglės organizuojama moterų savaitgalio stovykla gruodžio 5 d. Vieta, kaina, programa ir Google Forms anketa dar nepaskelbtos. Nuotraukų sritys lieka tuščios, kol administratorius pasirenka savo nuotraukas. Video nenaudojamas.

Parengtas lietuviškas turinio valdymo įrankis `/admin/`: tekstą galima keisti paspaudus jį puslapio vaizde, o nuotrauką pasirinkti paspaudus jai skirtą vietą. Turinys ir nuotraukos redaguojami išlaikant esamą dizainą, išdėstymą ir vieną stovyklą. Yra atskiras juodraščio išsaugojimas, paskelbimas, telefono ir kompiuterio peržiūra, nuotraukų biblioteka ir paskelbtų versijų istorija.

Produkcijos infrastruktūra sukonfigūruota: D1 duomenų bazė su pritaikyta schema, privati R2 nuotraukų saugykla ir Cloudflare Access prisijungimas vienkartiniu kodu. Prieiga suteikiama tik konkrečiai leistam administratoriaus el. paštui; Access sesija trunka 6 valandas. Administravimas aptarnaujamas tik per `https://bukarciau.lt`; kitais talpinimo adresais jis atmetamas dar prieš tikrinant pasirašytą JWT ir administratoriaus teises. Tikros prisijungimo parametrų reikšmės saugomos Cloudflare aplinkoje, ne šiame kode.

## Vietinis paleidimas

Reikia Node.js **22.13 arba naujesnio** ir npm.

```sh
npm ci
npm run build
npm run preview
```

Svetainė: [http://localhost:4324](http://localhost:4324). Redaktorius: [http://localhost:4324/admin/](http://localhost:4324/admin/).

Vietinis serveris veikia tik šiame kompiuteryje, adresu `127.0.0.1`. Jis naudoja imituojamą administratoriaus tapatybę, vietinę SQLite bazę ir vietinius nuotraukų failus aplanke `.wrangler/cms-preview/`. Tik šiame paleidimo scenarijuje aiškiai perduodamas vietinio administravimo adresas `localhost:4324` arba `127.0.0.1:4324`; užklausų header ar aplinkos kintamieji negali išjungti produkcijos domeno apribojimo. Prisijungimo imitavimas skirtas tik kūrimui; šis serveris nekopijuojamas į `dist/` ir nenaudojamas produkcijoje. Vietiniai pakeitimai nepakeičia tikros svetainės, D1 ar R2 duomenų.

Po kodo pakeitimų pakartokite `npm run build`, paleiskite vietinį serverį iš naujo ir atnaujinkite naršyklę. Norėdami pradėti vietinę peržiūrą nuo pradinio turinio, sustabdykite serverį ir pašalinkite tik `.wrangler/cms-preview/` aplanką.

```sh
npm test
npm run check
```

Testai tikrina turinio redagavimą, prisijungimo parašą ir teises, juodraščio atskyrimą nuo paskelbto turinio, publikavimą, atkūrimą, nuotraukų prieigą ir įkėlimų tikrinimą. `check` tikrina sugeneruotus puslapius, nuorodas, vieną stovyklą, originalų logotipą ir registracijos būsenas. Jo bandomosios svetainės generuojamos laikiname aplanke. Vaizdą papildomai patikrinkite telefono ir kompiuterio naršyklėje.

## Turinys ir paskelbimas

Įprasti turinio pakeitimai atliekami redaktoriuje. „Išsaugoti juodraštį“ išsaugo darbą, o „Paskelbti pakeitimus“ atnaujina lankytojoms rodomą versiją. Išsaugomi iki 30 paskelbtų turinio versijų; atkūrimas pirmiausia sukuria juodraštį.

[content.json](content.json) yra pradinis turinys naujai, tuščiai duomenų bazei ir statiniam atsarginiam build rezultatui. Kai D1 jau turi turinį, naujas kodo diegimas jo neperrašo. Pakeitus vien `content.json`, jau naudojamos D1 bazės turinys nepasikeičia.

Viršutiniai kvietimai dalyvauti veda į atitinkamo puslapio registracijos skiltį. Joje viena pagrindinė anketos nuoroda atsidaro naujame skirtuke, o el. paštas ir telefonas lieka papildomais kontaktais. Google Forms nuoroda atpažįstama ir įprastame registracijos lauke, ir organizatorių pridėtame registracijos bloke. Svetainė pati dalyvių registracijos duomenų nerenka.

`site.draft` valdo tik paieškos indeksavimą. Tai atskiras nustatymas nuo redaktoriaus juodraščio: `noindex` nesuteikia privatumo ir neriboja viešos svetainės lankymo.

## Struktūra ir talpinimas

- `/`, `/apie-mus/`, `/kontaktai/` ir `/stovyklos/moteru-savaitgalio-stovykla/` - vieši puslapiai.
- `/admin/` - prisijungimu apsaugotas redaktorius, jo failai, juodraščio peržiūra ir API.
- `shared/content.mjs` - leidžiami turinio laukai ir jų tikrinimas.
- `shared/render.mjs` - bendri viešų puslapių ir redaktoriaus peržiūros šablonai.
- `shared/routes.mjs` - bendri kanoniniai adresai, senų nuorodų migracija ir peradresavimai.
- `server/` - Cloudflare Access JWT tikrinimas, turinio ir nuotraukų API.
- `db/schema.sql` - D1 schema.
- `dist/` ir `server/generated.mjs` - generuojami failai, jų tiesiogiai neredaguokite.

Hostingas lieka Cloudflare Pages Direct Upload, kodas - [donatas-tarase/bukarciau](https://github.com/donatas-tarase/bukarciau). `git push` kodo automatiškai nepaskelbia. Administratoriaus turinio publikavimas naujo kodo diegimo nereikalauja.

Į `dist/assets/` kopijuojami tik logotipai ir šriftai. Ankstesni saugykloje esantys foto, video ir viršelio failai nepaskelbiami. Administratoriaus nuotraukos saugomos R2 ir rodomos tik pagal pasirinktus turinio laukus. Originalus `assets/logo-original.jpeg` nekeičiamas; kontaktų logotipas išlaiko savo proporcijas.

- [Administravimo naudojimas](docs/administravimas.md)
- [Turinio laukai ir likusi informacija](docs/turinys.md)
- [Cloudflare sąranka ir diegimas](docs/talpinimas.md)

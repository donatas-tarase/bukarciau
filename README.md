# Būk arčiau

Svetainė `bukarciau.lt` kompiuteriams ir telefonams. Pagrindinis puslapis kviečia į vieną Miglės ir Miglės organizuojamą moterų savaitgalio stovyklą gruodžio 5 d. Jame rodomas organizatorių kvietimo video ir pateiktas jo tekstas. Vieta, kaina, programa ir Google Forms anketa dar nepaskelbtos.

Svetainė: [bukarciau.lt](https://bukarciau.lt). Tiesioginė peržiūra: [bukarciau.pages.dev](https://bukarciau.pages.dev).

## Paleidimas

Reikia Node.js 20 arba naujesnės versijos. Projektas neturi išorinių vykdymo ar build priklausomybių.

```sh
npm run build
npm run preview
```

Atidaryti [http://127.0.0.1:4324](http://127.0.0.1:4324). Po pakeitimų pakartoti `npm run build` ir atnaujinti naršyklę. Generuojamas `dist/` aplankas; jo failų tiesiogiai redaguoti nereikia.

```sh
npm run check
```

Komanda patikrina sugeneruotus failus, nuorodas, video ir abi registracijos būsenas: kai Google Forms nuorodos dar nėra ir kai ji pateikta. Bandomosios svetainės generuojamos laikiname aplanke; tikras turinys nekeičiamas.

Build automatiškai prideda pagal failo turinį sudarytą `?v=…` versiją prie stilių, JavaScript, video ir jo viršelio nuorodų. Pakeitus failą pasikeičia jo versija, todėl grįžusios lankytojos gauna atnaujinimą iš karto, nelaukdamos, kol baigs galioti ankstesnė naršyklės kopija. Šaltinių failų vardų ar `content.json` kelių dėl to keisti nereikia.

## Puslapiai

- `/` - kvietimas į vienintelę stovyklą, Miglių video, praktinė informacija ir registracijos skiltis.
- `/apie-mus/` - Miglės ir Miglės prisistatymas pagal jų kvietimą.
- `/kontaktai/` - el. paštas, telefonas ir Facebook.
- `/stovyklos/stovykla-01/` - stovyklos aprašymas, praktinė informacija, DUK ir registracija.

Ankstesnis antros stovyklos adresas nukreipiamas į pagrindinio puslapio stovyklos skiltį. Jį aptarnauja Cloudflare Pages taisyklės faile `_redirects`.

## Turinys ir publikavimas

Tekstai, kontaktai, video, nuotraukų keliai ir Google Forms nuoroda redaguojami [content.json](content.json). Laukų paaiškinimai ir ko dar reikia iš organizatorių - [docs/turinys.md](docs/turinys.md).

Kai `camps[0].registrationUrl` yra `null`, kvietimas „Noriu dalyvauti“ veda į registracijos informaciją. Joje aiškiai parašyta, kad anketa dar ruošiama, ir pateiktas tikras kontaktas. Įrašius tikrą HTTPS Google Forms nuorodą, registracijos mygtukai atidaro ją naujame skirtuke. Svetainė pati registracijos duomenų nerenka.

Publikuojamas vienas optimizuotas MP4 video su JPG viršeliu. Atidarius puslapį jis automatiškai kartojamas be garso, be įprastos grotuvo juostos. Maži puslapio mygtukai leidžia įjungti garsą ir pristabdyti arba paleisti video. Įjungus garsą kvietimas paleidžiamas nuo pradžios. Kai lankytojos įrenginyje pasirinkta mažiau judesio, automatinis atkūrimas sustabdomas. Video siunčiamas automatiškai - dabartinis failas maždaug 11,7 MB. Originalių MOV failų į saugyklą kelti nereikia.

Originalus logotipas saugomas nepakeistas: `assets/logo-original.jpeg`. `assets/logo.svg` ir favicon failai parengti iš jo; favicon neturi apatinio užrašo „Bendrystė · Saviugda · Ryšiai“.

Hostingas - Cloudflare Pages, kodas - [donatas-tarase/bukarciau](https://github.com/donatas-tarase/bukarciau). Šiuo metu pakeitimai į GitHub automatiškai neskelbiami. Paskelbti iš projekto aplanko:

```sh
npm run build
npm run check
npx wrangler pages deploy dist --project-name=bukarciau --branch=main
```

[Talpinimo instrukcija](docs/talpinimas.md) apima Cloudflare prisijungimą, domeno prijungimą ir esamo pašto DNS išsaugojimą.

`content.json` nustatymas `site.draft: true` įjungia `noindex` ir riboja indeksavimą `robots.txt`. Tai nėra prieigos apsauga: paskelbtą maketą gali atidaryti turintys jo adresą. Kai tikras turinys patvirtintas, pakeiskite `draft` į `false`, sugeneruokite ir paskelbkite svetainę - bus pašalintas `noindex` ir sukurtas `sitemap.xml`.

# Būk arčiau

Svetainė `bukarciau.lt` kompiuteriams ir telefonams. Pagrindinis puslapis kviečia į vieną Miglės ir Miglės organizuojamą moterų savaitgalio stovyklą gruodžio 5 d. Pirmame ekrane automatiškai rodomas sūpynių video, toliau - Miglių prisistatymas, vieta nuotraukai, stovyklos informacija ir registracija. Vieta, kaina, programa ir Google Forms anketa dar nepaskelbtos.

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

Komanda patikrina sugeneruotus failus, nuorodas, vieną video, jo valdymo ir dialogo prieinamumo ryšius bei abi registracijos būsenas: kai Google Forms nuorodos dar nėra ir kai ji pateikta. Bandomosios svetainės generuojamos laikiname aplanke; tikras turinys nekeičiamas. Vaizdą ir atkūrimo elgseną papildomai reikia patikrinti naršyklėje.

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

Publikuojamas vienas optimizuotas 43 sek. MP4 video su JPG viršeliu, parengtas iš „Buk_arciau_moteru_stovykla_v3.mp4“. Išsaugoti vaizde esantys titrai ir originalus garsas. Atidarius puslapį jis automatiškai kartojamas be garso ir įprastos grotuvo juostos, užpildydamas pirmą ekraną. Šiame fone vaizdo kraštai apkerpami pagal ekrano proporcijas. Mygtukas „Klausyti kvietimo“ atidaro tą patį video atskirame lange su visu vertikaliu kadru, įjungia garsą ir paleidžia nuo pradžios. Langą uždaro jo mygtukas arba Escape; video grįžta į foną be garso. Pristabdymo mygtukas veikia abiem atvejais. Kai įrenginyje pasirinkta mažiau judesio arba video jau buvo pristabdytas, uždarius langą jis lieka sustabdytas.

Video siunčiamas automatiškai - dabartinis failas maždaug 16,1 MB. Klausymui naudojamas tas pats video elementas ir failas, todėl antras įrašas nesisiunčiamas. Kvietimo tekstas pateiktas atskirai ir išskleidžiamas. Originalių video failų į saugyklą kelti nereikia.

Originalus logotipas saugomas nepakeistas: `assets/logo-original.jpeg`. `assets/logo.svg` ir favicon failai parengti iš jo; favicon neturi apatinio užrašo „Bendrystė · Saviugda · Ryšiai“.

Hostingas - Cloudflare Pages, kodas - [donatas-tarase/bukarciau](https://github.com/donatas-tarase/bukarciau). Šiuo metu pakeitimai į GitHub automatiškai neskelbiami. Paskelbti iš projekto aplanko:

```sh
npm run build
npm run check
npx wrangler pages deploy dist --project-name=bukarciau --branch=main
```

[Talpinimo instrukcija](docs/talpinimas.md) apima Cloudflare prisijungimą, domeno prijungimą ir esamo pašto DNS išsaugojimą.

`content.json` nustatymas `site.draft: true` įjungia `noindex` ir riboja indeksavimą `robots.txt`. Tai nėra prieigos apsauga: paskelbtą maketą gali atidaryti turintys jo adresą. Kai tikras turinys patvirtintas, pakeiskite `draft` į `false`, sugeneruokite ir paskelbkite svetainę - bus pašalintas `noindex` ir sukurtas `sitemap.xml`.

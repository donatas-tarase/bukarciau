# Būk arčiau

Svetainės `bukarciau.lt` maketas kompiuteriams ir telefonams. Turinys, nuotraukos ir registracijos nuorodos kol kas pažymėti vietaženkliais. Datos, kainos, dalyvių atsiliepimai ar organizatorių biografijos nėra išgalvoti.

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

Komanda patikrina sugeneruotą svetainę.

## Puslapiai

- `/` – pradžia ir stovyklų sąrašas.
- `/apie-mus/` – istorija ir dvi organizatorės.
- `/kontaktai/` – el. paštas, telefonas ir Facebook.
- `/stovyklos/stovykla-01/` ir `/stovyklos/stovykla-02/` – stovyklų aprašymai, programa, DUK ir registracija.

## Turinys ir publikavimas

Tekstai, kontaktai, nuotraukų keliai ir Google Forms nuorodos redaguojami [content.json](content.json). Laukų paaiškinimai ir ką surinkti iš organizatorių – [docs/turinys.md](docs/turinys.md).

Kai `registrationUrl` yra `null`, registracijos mygtukas parodo, kad registracija dar nepaskelbta. Įrašius tikrą HTTPS Google Forms nuorodą, mygtukas atidaro ją naujame skirtuke.

Originalus logotipas saugomas nepakeistas: `assets/logo-original.jpeg`. `assets/logo.svg` ir favicon failai parengti iš jo; favicon neturi apatinio užrašo „Bendrystė · Saviugda · Ryšiai“.

Hostingas – Cloudflare Pages, kodas – [donatas-tarase/bukarciau](https://github.com/donatas-tarase/bukarciau). Šiuo metu pakeitimai į GitHub automatiškai neskelbiami. Paskelbti iš projekto aplanko:

```sh
npm run build
npm run check
npx wrangler pages deploy dist --project-name=bukarciau --branch=main
```

[Talpinimo instrukcija](docs/talpinimas.md) apima Cloudflare prisijungimą, domeno prijungimą ir esamo pašto DNS išsaugojimą.

`content.json` nustatymas `site.draft: true` įjungia `noindex` ir riboja indeksavimą `robots.txt`. Tai nėra prieigos apsauga: paskelbtą maketą gali atidaryti turintys jo adresą. Kai tikras turinys patvirtintas, pakeiskite `draft` į `false`, sugeneruokite ir paskelbkite svetainę – bus pašalintas `noindex` ir sukurtas `sitemap.xml`.

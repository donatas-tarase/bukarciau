# Talpinimas ir domenas

Rekomenduojama Cloudflare Pages: statinių failų užklausos nemokamos, galima prijungti GitHub ir nuosavą domeną. GitHub Pages nemokamame plane reikalauja viešos saugyklos, o jų naudojimo taisyklės riboja verslui ir komerciniams sandoriams skirtas svetaines. Mokamų stovyklų svetainei Cloudflare Pages tinkamesnis pasirinkimas. [Cloudflare kainodara](https://developers.cloudflare.com/pages/functions/pricing/), [GitHub Pages apribojimai](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

`bukarciau.lt` gali likti registruotas Hostingeryje. DNS jau aptarnauja Cloudflare; vardų serveriai – `pete.ns.cloudflare.com` ir `vivienne.ns.cloudflare.com`. Registratoriaus perkelti nereikia.

## Dabartinis publikavimo būdas

Kodas laikomas viešoje [donatas-tarase/bukarciau](https://github.com/donatas-tarase/bukarciau) saugykloje. Publikavimui naudojamas **Cloudflare Pages Direct Upload**. `git push` šiuo metu svetainės neatnaujina.

Iš projekto aplanko vykdykite:

```sh
npm run build
npm run check
npx wrangler pages deploy dist --project-name=bukarciau --branch=main
```

Jei Wrangler neprisijungęs, prieš diegimą vieną kartą vykdykite `npx wrangler login` ir pasirinkite Cloudflare paskyrą, kurioje yra `bukarciau.lt`. Projekto iš naujo kurti nereikia. Po diegimo patikrinkite Wrangler pateiktą adresą ir nuosavą domeną, jei jis jau prijungtas. Įkeliamas `dist` build rezultatas, ne visas projektas. [Oficiali Direct Upload instrukcija](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## Jei vėliau reikės automatinio publikavimo

Bandant prijungti GitHub, Cloudflare grąžino `8000011` – esamo Git įdiegimo vidinę klaidą. Todėl Git integracija dabar neįjungta. Ji tvarkoma per **Cloudflare Workers & Pages** programėlės prieigą GitHub nustatymuose; turimos prieigos neatšaukite nepatikrinę, ar jos nenaudoja kiti projektai.

Direct Upload projekto negalima tiesiog perjungti į Git integraciją. Sutvarkius prieigą reikėtų naujo Pages projekto ir perkelti domeną tik patikrinus naują diegimą. Git integracijos nustatymai:

| Nustatymas | Reikšmė |
| --- | --- |
| Repository | `donatas-tarase/bukarciau` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Tuščias, jei `package.json` yra saugyklos šaknyje |
| Environment variable | `NODE_VERSION` = `22` |

[Git integracija](https://developers.cloudflare.com/pages/get-started/git-integration/), [prieigos trikčių šalinimas](https://developers.cloudflare.com/pages/configuration/git-integration/troubleshooting/)

## Prijungtas domenas

Domenai jau pridėti prie Pages projekto `bukarciau`, Cloudflare jų būsena – **active**. Svetainė: [https://bukarciau.lt](https://bukarciau.lt); tiesioginis adresas – [https://bukarciau.pages.dev](https://bukarciau.pages.dev).

Cloudflare DNS įrašai:

| Tipas | Vardas | Reikšmė | Proxy |
| --- | --- | --- | --- |
| CNAME | `@` | `bukarciau.pages.dev` | Proxied |
| CNAME | `www` | `bukarciau.pages.dev` | Proxied |

Cloudflare **Single Redirect** taisyklė `www → bukarciau.lt`:

- Sąlyga: `(http.host eq "www.bukarciau.lt")`.
- Dinaminis adresas: `concat("https://bukarciau.lt", http.request.uri.path)`.
- Kodas: `301`; **Preserve query string** įjungta.

HTTPS patikrintas be sertifikato tikrinimo išjungimo. Po DNS pakeitimų kai kurie vietiniai DNS serveriai dar gali laikyti seną atsakymą; tokiu atveju peržiūrai naudokite `pages.dev` adresą. Keičiant talpinimą vėliau, naują domeną pirmiausia reikia susieti su Pages projektu, o tik po to nukreipti DNS. [Cloudflare custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)

## Išsaugoti pašto veikimą

Keiskite tik svetainei reikalingus įrašus. Neištrinkite esamų MX ir TXT įrašų: Cloudflare Email Routing juos naudoja `info@bukarciau.lt` persiuntimui. Patikros metu domenas turėjo Cloudflare `route1/2/3.mx.cloudflare.net` MX ir SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`.

Palikite ir kitus esamus SPF, DKIM, DMARC bei patvirtinimo įrašus. Nejunkite Hostinger pašto ar numatytųjų DNS šablonų vien tam, kad prijungtumėte svetainę. Po prijungimo iš išorinės pašto paskyros nusiųskite bandomąjį laišką į `info@bukarciau.lt`. [Email Routing DNS dokumentacija](https://developers.cloudflare.com/email-service/configuration/domains/)

## Iš maketo į viešą svetainę

Kol rodomi vietaženkliai, `content.json` palikite `site.draft: true`. Taip puslapiai generuojami su `noindex, nofollow`, o `robots.txt` riboja indeksavimą. Viešas peržiūros adresas nėra privati prieiga.

Kai organizatorės patvirtins tekstus, nuotraukas, stovyklų informaciją ir veikiančias formas, pakeiskite `site.draft` į `false`. Po `npm run build` bus pašalinta `noindex` žyma, `robots.txt` leis indeksavimą ir atsiras `sitemap.xml`. `site.url` palikite `https://bukarciau.lt`. Paleiskite `npm run check`, paskelbkite įprasta Wrangler komanda ir patikrinkite, ar tikrajame domene matoma nauja versija.

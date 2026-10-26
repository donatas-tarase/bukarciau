# Talpinimas ir administravimo aktyvavimas

Hostingas lieka **Cloudflare Pages Direct Upload**, projektas `bukarciau`. Kodas saugomas [donatas-tarase/bukarciau](https://github.com/donatas-tarase/bukarciau); `git push` šiuo metu svetainės neatnaujina. Domenas `bukarciau.lt` registruotas Hostingeryje, o DNS ir el. pašto persiuntimą aptarnauja Cloudflare.

## Dabartinė būsena

Administravimo kodas ir vietinė peržiūra parengti. D1 bazė `bukarciau-cms` sukurta, o `db/schema.sql` schema pritaikyta. D1 susiejimas `CMS_DB` įrašytas `wrangler.toml`.

**Produkcijos administravimo aktyvavimas dar nebaigtas.** Reikia Cloudflare Access programos ir leidžiamų administratorių sąrašo, runtime prisijungimo parametrų, R2 saugyklos bei jos susiejimo `CMS_MEDIA`. Ši instrukcija nereiškia, kad Access ar R2 jau veikia. Kol prisijungimo konfigūracija nepilna, serveris administravimo užklausas atmeta.

## Reikalingi susiejimai ir parametrai

| Pavadinimas | Reikšmė ir paskirtis |
| --- | --- |
| `CMS_DB` | D1 susiejimas su esama `bukarciau-cms` baze; juodraštis, paskelbta versija, istorija ir nuotraukų metaduomenys |
| `CMS_MEDIA` | R2 susiejimas su nuotraukų saugykla, numatytas vardas `bukarciau-media`; dar neprijungtas |
| `ACCESS_TEAM_DOMAIN` | Savo Cloudflare Access komandos domenas, pvz. `komanda.cloudflareaccess.com` |
| `ACCESS_AUD` | Administravimo Access programos Application Audience (AUD) reikšmė |
| `ADMIN_EMAILS` | Tikslūs leisti administratorių el. paštai, atskirti kableliais; saugoti Pages aplinkos paslaptyje |

Tikro administratoriaus el. pašto sąrašo, JWT, slapukų ir API raktų į saugyklą nedėkite. `ADMIN_EMAILS` nėra domenų ar visų lankytojų leidimas: serveris tikrina konkretaus prisijungusio žmogaus el. paštą.

Cloudflare susiejimus galima nustatyti Wrangler konfigūracijoje; naudojant ją, suderinkite su Pages aplinkomis. Produkcijos ir preview aplinkų nustatymus patikrinkite atskirai. [Oficiali Pages susiejimų dokumentacija](https://developers.cloudflare.com/pages/functions/bindings/).

## Cloudflare Access

Cloudflare Zero Trust sukurkite administravimui skirtą **Self-hosted** programą. Ji turi aprėpti `bukarciau.lt/admin` ir visus `/admin/*` kelius: patį įrankį, jo CSS ir JavaScript, API, juodraščio peržiūrą ir privačias nuotraukas. Prisijungimui galima įjungti vienkartinį kodą el. paštu. **Allow** taisyklėje leiskite tik konkrečius administratorių adresus; jų sąrašas turi sutapti su runtime `ADMIN_EMAILS`. [Access programos sąranka](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/), [vienkartinio kodo prisijungimas](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/).

Į Pages runtime aplinką perkelkite tikrą komandos domeną, šios programos AUD ir leistų paštų sąrašą. Parinkta Access sesija turi tilpti į serverio priimamą 24 val. tokeno amžių. Pritaikius parametrus reikia naujo Pages diegimo.

Serveris papildomai tikrina `Cf-Access-Jwt-Assertion` parašą naudodamas tos komandos pasirašymo raktus, išdavėją, AUD, galiojimo laiką, reikiamus duomenis ir tikslų administratoriaus el. paštą. Vien atsiųstas el. pašto header ar slapukas teisės nesuteikia. Apsauga taikoma ir kreipiantis tiesiogiai per `pages.dev` ar diegimo adresą. [Cloudflare JWT tikrinimo paaiškinimas](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).

## R2 nuotraukų saugykla

Aktyvuokite R2 paskyroje ir sukurkite privačią `bukarciau-media` saugyklą. Nekurkite viešo R2 domeno: nuotraukas aptarnauja šio projekto Worker. Pridėkite `CMS_MEDIA` susiejimą į naudojamų Pages aplinkų Wrangler konfigūraciją:

```toml
[[r2_buckets]]
binding = "CMS_MEDIA"
bucket_name = "bukarciau-media"

[[env.production.r2_buckets]]
binding = "CMS_MEDIA"
bucket_name = "bukarciau-media"
```

Šis pavyzdys yra užbaigiamos sąrankos žingsnis; dabartiniame `wrangler.toml` R2 susiejimo dar nėra. Po pakeitimo atlikite naują Pages diegimą. Jeigu kuriate atskirą bandomąją Cloudflare aplinką, jai naudokite atskirus duomenis, kad testuojant nebūtų keičiamas produkcijos turinys.

R2 saugo nuotraukų failus, D1 - jų metaduomenis ir nuorodas turinyje. Juodraščio nuotraukos aptarnaujamos tik per apsaugotą `/admin/api/media/` adresą. Vieši `/media/` adresai veikia tik toms nuotraukoms, kurias naudoja paskelbta turinio versija. Logiškai iš bibliotekos ištrinti objektai paliekami R2, kad istorijoje esanti versija galėtų būti atkurta.

Apsaugotas `/admin/api/state` atsakymas pateikia `capabilities.media`, `capabilities.upload`, priimamus formatus ir įkėlimo dydžio ribą. Kol `CMS_MEDIA` neprijungtas, nuotraukų galimybės grąžinamos kaip `false`, o redaktorius įkėlimą išjungia ir parodo priežastį. Tiesioginė įkėlimo užklausa taip pat atmetama serveryje.

## D1 ir pradinis turinys

Esamos bazės iš naujo kurti nereikia. Schema yra idempotentiška; prireikus ją taikyti naujai aplinkai:

```sh
npx wrangler d1 execute bukarciau-cms --remote --file=db/schema.sql
```

Pirmą kartą kreipiantis į tuščią bazę, turinys užpildomas build metu paruošta `content.json` versija. Vėlesnis kodo diegimas jau esančių D1 tekstų neperrašo. Turinį keiskite per redaktorių. Įprastas „Išsaugoti juodraštį“ nekeičia viešos versijos; „Paskelbti pakeitimus“ atnaujina paskelbtą D1 turinį ir sukuria istorijos įrašą.

Saugoma iki 30 paskelbtų versijų. Atkuriant ankstesnė versija tampa juodraščiu ir turi būti atskirai paskelbta. Tai turinio versijų istorija; atskirų infrastruktūros atsarginių kopijų tvarkymo ji nepakeičia.

## Kodo diegimas

Reikia Node.js 22.13 arba naujesnio. Iš projekto aplanko:

```sh
npm ci
npm run build
npm test
npm run check
npx wrangler pages deploy dist --project-name=bukarciau --branch=main
```

Jei Wrangler neprisijungęs, naudokite `npx wrangler login` ir pasirinkite paskyrą su šiuo Pages projektu. Įkeliamas visas `dist/`, įskaitant `_worker.js` ir `_routes.json`, o ne vien HTML failai. Worker maršrutizavimas būtinas administravimo apsaugai. Administravimo įrankio failų atskirai į viešą statinį hostingą nekelkite. [Direct Upload dokumentacija](https://developers.cloudflare.com/pages/get-started/direct-upload/).

**Pages nustatymas „Settings > Runtime > Fail open / closed“ turi likti „Fail closed“.** Pasibaigus nemokamai Functions užklausų kvotai, „Fail open“ aptarnautų statinius failus aplenkdamas Worker ir jo administravimo apsaugą. „Fail closed“ tokiu atveju pateikia klaidą. Šiame projekte produkcijos ir preview aplinkoms jau nustatyta bei API patikrinta `fail_open: false`; tai paskyros Pages nustatymas, jo nėra `wrangler.toml`. [Oficialus veikimo paaiškinimas](https://developers.cloudflare.com/pages/functions/routing/#fail-open--closed).

Build prideda turinio hash pagrįstą `?v=` prie viešų CSS ir JavaScript adresų. Į `dist/assets/` kopijuojami tik logotipo failai, šriftai ir jų licencija. Anksčiau saugykloje likusios nuotraukos, video ir viršelis į diegimą nekopijuojami. CMS nuotraukos įkeliamos atskirai į R2.

Pradinis turinys apima tik vieną stovyklą. Nežinoma vieta, kaina ir registracijos anketa paliktos tuščios. Įrašius tikrą HTTPS anketą veiksmai pasikeičia abiejuose viešuose puslapiuose. Duomenų bazės sutrikimo atveju viešiems puslapiams lieka statinis build rezultatas; jis gali būti senesnis už naujausią administratoriaus paskelbtą turinį.

## Aktyvavimo patikra

Po konfigūravimo ir diegimo patikrinkite prisijungimą leidžiamu adresu bei atmetimą kitu adresu. Neprisijungus neturi būti pasiekiamas nei `/admin/`, nei administravimo failai, API, juodraščio peržiūra ar jos nuotraukos. Tą patį patikrinkite `pages.dev` ir diegimo adresu.

Išsaugokite bandomąjį juodraštį ir įsitikinkite, kad vieša svetainė nepasikeitė. Paskelbkite, patikrinkite rezultatą, istorijoje atkurkite ankstesnę versiją į juodraštį. Atskirai patikrinkite nuotraukos įkėlimą, jos alternatyvų tekstą, privatų juodraščio vaizdą ir viešą vaizdą tik po paskelbimo. Išbandykite telefono ir kompiuterio maketus bei Google Forms nuorodą, kai ji bus gauta.

`site.draft` valdo tik SEO: `true` įjungia `noindex`, riboja `robots.txt` ir išjungia `sitemap.xml`. Tai nėra prisijungimo apsauga ir neslepia viešos svetainės. Administratoriaus juodraštis laikomas atskirai D1.

## Domenas ir el. paštas

Svetainė: [bukarciau.lt](https://bukarciau.lt), Pages adresas: [bukarciau.pages.dev](https://bukarciau.pages.dev). DNS vardų serveriai - `pete.ns.cloudflare.com` ir `vivienne.ns.cloudflare.com`. Esami `@` ir `www` CNAME nukreipti į `bukarciau.pages.dev` su proxy. `www` nukreipiamas į pagrindinį domeną išlaikant kelią ir užklausos parametrus. Administravimui naujo domeno ar DNS keitimo nereikia.

Nekeiskite veikiančių MX, SPF, DKIM ir kitų pašto įrašų. `info@bukarciau.lt` naudoja Cloudflare Email Routing; CMS sąranka su tuo nesusijusi. Palikite esamus `route1/2/3.mx.cloudflare.net` MX ir SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`. [Email Routing domenų dokumentacija](https://developers.cloudflare.com/email-service/configuration/domains/).

Senas `/stovyklos/stovykla-02` ir `/stovyklos/stovykla-02/` adresas per `_redirects` nukreipiamas į `/#stovykla` kodu `301`. Publikuojant išlaikykite šią taisyklę.

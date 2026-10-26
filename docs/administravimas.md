# Administravimo instrukcija

Redaktorius naudoja Cloudflare Access prisijungimą, D1 turinio bazę ir privačią R2 nuotraukų saugyklą. Techninė konfigūracija ir diegimo patikra aprašytos [talpinimo instrukcijoje](talpinimas.md).

## Prisijungimas

Atverkite `https://bukarciau.lt/admin/`. Prisijungti gali tik konkrečiai leistą el. pašto adresą valdantis administratorius. Įveskite tą adresą ir el. paštu gautą vienkartinį kodą. Kitos paskyros prieigos negauna; svetainė neturi viešos administratorių registracijos. Prisijungimo sesija trunka 6 valandas.

Baigę darbą pasirinkite „Atsijungti“. Jei sesija baigėsi, redaktorius paprašys prisijungti iš naujo. Prieš atnaujindami puslapį nukopijuokite dar neišsaugotą svarbų tekstą.

## Redagavimas tiesiai puslapyje

1. Pasirinkite „Redaguoti puslapyje“ ir viršuje nurodykite norimą puslapį.
2. Režime „Redaguoti“ paspauskite tekstą ir rašykite jo vietoje. Pakeitimas iškart matomas redaktoriuje. `Esc` atšaukia šio teksto redagavimą, kol jis dar aktyvus.
3. Paspauskite tuščią nuotraukos vietą arba esamą nuotrauką, kad pasirinktumėte ją iš bibliotekos arba įkeltumėte naują.
4. Patikrinkite vaizdą pasirinkę „Kompiuteris“ ir „Telefonas“. Režimas „Peržiūrėti“ leidžia peržiūrėti puslapį be redagavimo pasirinkimų.

Nuorodų adresus, SEO, registracijos anketą ir sąrašus keiskite atitinkamuose kairiojo meniu turinio skyriuose. Taip pat galima naudoti juos visiems tekstams redaguoti įprastuose laukeliuose. Blokų vietos, spalvos, šriftai ir bendras maketas lieka nustatyti dizaino kode.

## Išsaugoti ir paskelbti

Redaktoriuje skiriamos trys būsenos:

| Būsena | Kur matomi pakeitimai |
| --- | --- |
| Neišsaugota | Tik šiame naršyklės lange |
| Juodraštis išsaugotas | Administratoriaus redaktoriuje; lankytojoms rodoma ankstesnė paskelbta versija |
| Paskelbta | Viešoje svetainėje |

Baigę keisti paspauskite „Išsaugoti juodraštį“. Kai nėra neišsaugotų pakeitimų, pasirinkite „Paskelbti pakeitimus“ ir patvirtinkite. Atverkite viešą svetainę naujame skirtuke bei patikrinkite rezultatą. Vien peržiūra, nuotraukos įkėlimas ar juodraščio išsaugojimas viešos svetainės nekeičia.

Jei tą patį turinį pakeitė kitas langas, serveris neperrašo naujesnio darbo. Pasirodo pranešimas apie versijų konfliktą. Nukopijuokite savo dar nepaskelbtą tekstą, įkelkite naujausią versiją ir pritaikykite reikalingus pakeitimus iš naujo.

## Nuotraukų biblioteka

Nuotraukas galite įkelti redaguodami pasirinktą vietą arba skyriuje „Nuotraukos“. Tinka JPG, PNG ir WebP. HEIC pirmiausia eksportuokite į JPG. Įrankis sumažina nuotrauką naršyklėje; įkeliami failai papildomai tikrinami serveryje.

Pasirinkę nuotrauką pridėkite trumpą alternatyvų aprašymą, pavyzdžiui, kas ir kur joje matoma. Šis aprašymas skirtas ekrano skaitytuvams ir nerodomas kaip antraštė ant vaizdo. Išsaugokite juodraštį ir paskelbkite pakeitimą.

„Pašalinti iš šios vietos“ atlaisvina konkrečią maketo vietą. Failas lieka bibliotekoje. Iš bibliotekos galima ištrinti tik nuotrauką, kurios nenaudoja išsaugotas juodraštis ar paskelbta versija. Po pašalinimo iš turinio pirmiausia išsaugokite ir paskelbkite pakeitimus. Bibliotekos ištrynimas yra loginis: objektas paliekamas saugykloje, kad būtų įmanomas versijos atkūrimas.

Jei po konfigūracijos pakeitimų pasirodo pranešimas, kad nuotraukų įkėlimas neparuoštas, reikia patikrinti `CMS_MEDIA` susiejimą ir iš naujo įdiegti projektą pagal techninę instrukciją.

## Versijų istorija

Skyriuje „Versijų istorija“ pateikiama iki 30 paskutinių paskelbtų turinio versijų, jų laikas ir pakeitimo autorius. Juodraščio išsaugojimas atskiros paskelbtos versijos nesukuria.

Pasirinkite „Atkurti“ prie norimos versijos. Ji įkeliama kaip juodraštis, o vieša svetainė lieka tokia pati. Peržiūrėkite atkurtus tekstus ir nuotraukas; norėdami juos grąžinti lankytojoms, atskirai paspauskite „Paskelbti pakeitimus“.

## Registracija ir paieška

Kol nėra tikros Google Forms nuorodos, palikite registracijos lauką tuščią. Svetainė rodys, kad anketa ruošiama, ir pateiks kontaktus. Įrašę veikiančią HTTPS nuorodą peržiūrėkite atviros registracijos tekstus, susijusius DUK ir patikrinkite formą atsijungę nuo Google paskyros.

„Nerodyti paieškos sistemose“ yra SEO nustatymas, o ne privatumo režimas ir ne juodraščio būsena. Vieša svetainė lieka pasiekiama lankytojoms. Administravimo prieigą saugo prisijungimas, ne šis nustatymas.

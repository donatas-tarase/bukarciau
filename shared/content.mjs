// Shared editorial contract. Presentation, routes and executable code are never content.
const description = 'Moterų savaitgalio stovykla gruodžio 5 d. Atokvėpiui, tikriems pokalbiams ir bendrystei kviečia Miglė ir Miglė.';
const registrationAnswer = 'Užpildyk registracijos anketą - jos nuorodą rasi registracijos skiltyje. Jei turi klausimų, parašyk mums.';

export const DEFAULT_CONTENT = {
  site: {
    name: 'Būk arčiau', url: 'https://bukarciau.lt', email: 'info@bukarciau.lt',
    phone: '+37060571562', phoneDisplay: '+370 605 71562',
    facebook: 'https://www.facebook.com/profile.php?id=61595415578505',
    organizers: 'Miglė ir Miglė', heroAccent: 'Būk arčiau.', heroTitle: 'Moterų savaitgalis.',
    values: ['Bendrystė', 'Saviugda', 'Ryšiai'],
    aboutText: [
      'Mes - Miglė ir Miglė. Kuriame moterų bendrystės stovyklą, kurioje galėtume pabūti su savimi ir kitų moterų draugijoje.',
      'Norime jaukaus susitikimo, kur kiekviena galėtų būti tikra, be kaukių ir bandymų kažkam kažką įrodyti.'
    ],
    storyTitle: 'Miglė ir Miglė.',
    story: [
      'Abi esame Miglės. Mus vienija idėja sukurti moterų bendrystės stovyklą.',
      'Neabejojame, kad kiekvienai iš mūsų kartais reikia atokvėpio, poilsio nuo kasdienybės, pabūti su savimi ar kitų moterų draugijoje.',
      'Norime sukurti jaukią erdvę tikriems pokalbiams, nuoširdžiam juokui ir naujoms pažintims. Tikimės, kad čia kiekviena jausis išgirsta, pamatyta ir priimta.'
    ],
    heroImage: null, heroImageAlt: '', statementImage: null, statementImageAlt: '',
    togetherImage: null, togetherImageAlt: '', draft: true
  },
  camps: [{
    slug: 'stovykla-01', title: 'Moterų savaitgalio stovykla',
    summary: 'Gruodžio 5 d. susitinkame pabūti kartu. Kviečia Miglė ir Miglė.',
    date: 'Gruodžio 5 d.', location: null, price: null,
    image: null, imageAlt: '', secondaryImage: null, secondaryImageAlt: '', detailImage: null, detailImageAlt: '',
    description: [
      'Kviečiame į moterų bendrystės stovyklą: atokvėpiui nuo kasdienybės, tikriems pokalbiams ir naujoms pažintims.',
      'Norime susitikti jaukiai - be kaukių ir bandymų kažkam kažką įrodyti. Pabūti su savimi ir kitų moterų draugijoje.'
    ],
    program: [], included: [], notIncluded: [],
    faq: [
      {question: 'Kada susitinkame?', answer: 'Gruodžio 5 d. Tikslius atvykimo ir išvykimo laikus paskelbsime kartu su stovyklos programa.', answerWhenOpen: ''},
      {question: 'Kur vyks stovykla ir kokia jos kaina?', answer: 'Vietą ir kainą dar tiksliname. Informaciją paskelbsime šiame puslapyje.', answerWhenOpen: ''},
      {question: 'Kaip užsiregistruoti?', answer: 'Registracijos anketą ruošiame. Jos nuorodą paskelbsime šiame puslapyje. Kol kas apie stovyklą gali pasiteirauti el. paštu info@bukarciau.lt arba telefonu +370 605 71562.', answerWhenOpen: registrationAnswer}
    ],
    registrationUrl: null, introTitle: 'Laikas sau ir bendrystei.'
  }],
  copy: {
    header: {camp: 'Stovykla', about: 'Kas mes?', contact: 'Kontaktai', write: 'Parašyk mums'},
    footer: {contact: 'Susisiekime', about: 'Susipažinkime', facebook: 'Facebook'},
    actions: {register: 'Registruotis', participate: 'Noriu dalyvauti', about: 'Apie mus', camp: 'Apie stovyklą', back: 'Į pradžią'},
    home: {heroEyebrow: 'Stovykla moterims', introEyebrow: 'Susipažinkime', introTitle: 'Kas mes?', campEyebrow: 'Susitikime', campTitle: 'Stovykla'},
    about: {invitation: 'Susitikime stovykloje.'},
    contact: {title: 'Susisiekime.', intro: 'Turi klausimų apie stovyklą? Parašyk arba paskambink.', email: 'El. paštas', phone: 'Telefonas', social: 'Socialiniai tinklai', logoAlt: 'Arčiau. Bendrystė, saviugda, ryšiai.'},
    camp: {date: 'Kada', location: 'Kur', price: 'Kaina', locationPending: 'Vieta dar tikslinama', pricePending: 'Dar tikslinama', pricePendingSentence: 'Kaina dar tikslinama', practicalPending: 'Vieta ir kaina dar tikslinamos.', about: 'Apie stovyklą', program: 'Programa', programPending: 'Programą ir tikslius laikus dar ruošiame. Juos paskelbsime čia.', included: 'Į kainą įskaičiuota', notIncluded: 'Į kainą neįskaičiuota', faqEyebrow: 'Verta žinoti', faqTitle: 'Klausimai ir atsakymai'},
    registration: {title: 'Susitinkam?', intro: 'Jei tau artima mūsų idėja, kviečiame į moterų bendrystės stovyklą.', openLabel: 'Registracija atidaryta', openText: 'Užpildyk registracijos anketą.', openButton: 'Registruotis į stovyklą', openNote: 'Anketa atsidarys naujame lange.', pendingLabel: 'Registracija ruošiama', pendingText: 'Registracijos anketą paskelbsime čia. Kol kas apie stovyklą gali pasiteirauti tiesiai mūsų.', pendingButton: 'Parašyti Miglėms', emailSubject: 'Domina moterų stovykla'},
    notFound: {title: 'Šio puslapio\nneradome.'}
  },
  seo: {
    home: {title: 'Moterų savaitgalis · Gruodžio 5 d.', description},
    about: {title: 'Miglė ir Miglė', description},
    contact: {title: 'Kontaktai', description},
    camp: {title: '', description},
    notFound: {title: 'Puslapis nerastas', description}
  }
};

const field = (path, label, group, type = 'text', options = {}) => ({path, label, group, type, required: true, maxLength: 250, ...options});
const home = 'Pagrindinis puslapis', about = 'Apie mus', camp = 'Stovykla', registration = 'Registracija', contact = 'Kontaktai', shared = 'Meniu ir poraštė', seo = 'Paieška ir dalijimasis';
export const CONTENT_FIELDS = [
  field('site.name', 'Svetainės pavadinimas', shared, 'text', {maxLength: 80}),
  field('site.organizers', 'Organizatorės', about, 'text', {maxLength: 150}),
  field('site.email', 'El. paštas', contact, 'email', {maxLength: 254}),
  field('site.phone', 'Telefono numeris nuorodai', contact, 'tel', {maxLength: 24, help: 'Tarptautiniu formatu, pvz. +37060571562.'}),
  field('site.phoneDisplay', 'Rodomas telefono numeris', contact, 'text', {maxLength: 40}),
  field('site.facebook', 'Facebook nuoroda', contact, 'url', {maxLength: 2000}),
  field('site.heroAccent', 'Pirmo ekrano antraštė', home, 'text', {maxLength: 120}),
  field('site.heroTitle', 'Eilutė po antrašte', home, 'text', {maxLength: 180}),
  field('site.values', 'Vertybės', home, 'list', {maxLength: 80, maxItems: 6}),
  field('site.aboutText', 'Trumpas prisistatymas', home, 'paragraphs', {maxLength: 3000, maxItems: 12}),
  field('site.storyTitle', 'Prisistatymo antraštė', about, 'text', {maxLength: 160}),
  field('site.story', 'Prisistatymas', about, 'paragraphs', {maxLength: 5000, maxItems: 20}),
  field('site.draft', 'Nerodyti paieškos sistemose', seo, 'boolean', {help: 'Tai tik paieškos indeksavimas. Šis nustatymas neslepia svetainės ir nėra administratoriaus juodraščio būsena.'}),
  field('camps.0.title', 'Stovyklos pavadinimas', camp, 'text', {maxLength: 180}),
  field('camps.0.summary', 'Trumpas kvietimas', camp, 'textarea', {maxLength: 1200}),
  field('camps.0.date', 'Stovyklos data', camp, 'text', {maxLength: 180}),
  field('camps.0.location', 'Vieta', camp, 'text', {required: false, nullable: true, maxLength: 400}),
  field('camps.0.price', 'Kaina', camp, 'text', {required: false, nullable: true, maxLength: 180}),
  field('camps.0.introTitle', 'Aprašymo antraštė', camp, 'text', {maxLength: 180}),
  field('camps.0.description', 'Stovyklos aprašymas', camp, 'paragraphs', {maxLength: 5000, maxItems: 30}),
  field('camps.0.program', 'Programa', camp, 'repeater', {required: false, maxItems: 40, fields: [
    {path: 'title', label: 'Antraštė arba laikas', type: 'text', required: true, maxLength: 180},
    {path: 'text', label: 'Aprašymas', type: 'textarea', required: true, maxLength: 4000}
  ]}),
  field('camps.0.included', 'Įskaičiuota į kainą', camp, 'list', {required: false, maxLength: 600, maxItems: 30}),
  field('camps.0.notIncluded', 'Neįskaičiuota į kainą', camp, 'list', {required: false, maxLength: 600, maxItems: 30}),
  field('camps.0.faq', 'Klausimai ir atsakymai', camp, 'repeater', {required: false, maxItems: 40, fields: [
    {path: 'question', label: 'Klausimas', type: 'text', required: true, maxLength: 400},
    {path: 'answer', label: 'Atsakymas', type: 'textarea', required: true, maxLength: 5000},
    {path: 'answerWhenOpen', label: 'Atsakymas atidarius registraciją', type: 'textarea', required: false, maxLength: 5000, help: 'Nebūtina. Jei užpildyta, šis atsakymas bus rodomas įrašius registracijos nuorodą.'}
  ]}),
  field('camps.0.registrationUrl', 'Google Forms registracijos nuoroda', registration, 'url', {required: false, nullable: true, maxLength: 2000, help: 'Palikus tuščią, svetainė rodys ruošiamos registracijos informaciją ir kontaktus.'})
];

const copyLabels = {
  header: {group: shared, labels: {camp: 'Meniu: stovykla', about: 'Meniu: apie mus', contact: 'Meniu: kontaktai', write: 'Meniu: parašyti'}},
  footer: {group: shared, labels: {contact: 'Poraštės kontaktų antraštė', about: 'Poraštės prisistatymo antraštė', facebook: 'Facebook nuorodos tekstas'}},
  actions: {group: shared, labels: {register: 'Registracijos mygtukas', participate: 'Kvietimo dalyvauti mygtukas', about: 'Apie mus nuoroda', camp: 'Apie stovyklą nuoroda', back: 'Grįžimo nuoroda'}},
  home: {group: home, labels: {heroEyebrow: 'Pirmo ekrano paantraštė', introEyebrow: 'Prisistatymo paantraštė', introTitle: 'Prisistatymo antraštė', campEyebrow: 'Stovyklos skilties paantraštė', campTitle: 'Stovyklos skilties antraštė'}},
  about: {group: about, labels: {invitation: 'Kvietimas puslapio apačioje'}},
  contact: {group: contact, labels: {title: 'Kontaktų antraštė', intro: 'Kontaktų įžanga', email: 'El. pašto etiketė', phone: 'Telefono etiketė', social: 'Socialinių tinklų etiketė', logoAlt: 'Logotipo alternatyvus tekstas'}},
  camp: {group: camp, labels: {date: 'Datos etiketė', location: 'Vietos etiketė', price: 'Kainos etiketė', locationPending: 'Tekstas, kai vieta nežinoma', pricePending: 'Trumpas tekstas, kai kaina nežinoma', pricePendingSentence: 'Sakinys, kai kaina nežinoma', practicalPending: 'Tekstas, kai vieta ir kaina nežinomos', about: 'Aprašymo paantraštė', program: 'Programos antraštė', programPending: 'Tekstas, kol programa ruošiama', included: 'Įskaičiuotų dalykų antraštė', notIncluded: 'Neįskaičiuotų dalykų antraštė', faqEyebrow: 'DUK paantraštė', faqTitle: 'DUK antraštė'}},
  registration: {group: registration, labels: {title: 'Registracijos antraštė', intro: 'Registracijos įžanga', openLabel: 'Atviros registracijos etiketė', openText: 'Atviros registracijos tekstas', openButton: 'Atviros registracijos mygtukas', openNote: 'Pastaba po mygtuku', pendingLabel: 'Ruošiamos registracijos etiketė', pendingText: 'Ruošiamos registracijos tekstas', pendingButton: 'Susisiekimo mygtukas', emailSubject: 'Laiško temos pradžia'}},
  notFound: {group: shared, labels: {title: 'Nerasto puslapio antraštė'}}
};
for (const [section, {group, labels}] of Object.entries(copyLabels)) {
  for (const [key, label] of Object.entries(labels)) CONTENT_FIELDS.push(field(`copy.${section}.${key}`, label, group, ['intro', 'openText', 'pendingText', 'programPending', 'title'].includes(key) && section === 'notFound' ? 'textarea' : key.endsWith('Text') || ['intro', 'programPending', 'openNote', 'practicalPending'].includes(key) ? 'textarea' : 'text', {maxLength: ['intro', 'pendingText', 'openText', 'programPending'].includes(key) ? 2000 : 400}));
}
for (const [key, label] of [['home', 'Pradžios'], ['about', 'Apie mus'], ['contact', 'Kontaktų'], ['camp', 'Stovyklos'], ['notFound', 'Nerasto puslapio']]) {
  CONTENT_FIELDS.push(field(`seo.${key}.title`, `${label} puslapio SEO antraštė`, seo, 'text', {required: key !== 'camp', maxLength: 180, ...(key === 'camp' ? {help: 'Palikus tuščią naudojamas stovyklos pavadinimas ir data.'} : {})}));
  CONTENT_FIELDS.push(field(`seo.${key}.description`, `${label} puslapio aprašymas`, seo, 'textarea', {maxLength: 600}));
}

export const IMAGE_FIELDS = [
  {path: 'site.heroImage', altPath: 'site.heroImageAlt', label: 'Pirmo ekrano nuotrauka', group: home, help: 'Plati nuotrauka. Kol neįkelta, lieka dabartinis žalias fonas.'},
  {path: 'site.statementImage', altPath: 'site.statementImageAlt', label: 'Plati nuotrauka po prisistatymu', group: home, help: 'Kol neįkelta, lieka tuščia dekoratyvi sritis.'},
  {path: 'site.togetherImage', altPath: 'site.togetherImageAlt', label: 'Nuotrauka puslapyje Apie mus', group: about},
  {path: 'camps.0.image', altPath: 'camps.0.imageAlt', label: 'Pagrindinė stovyklos nuotrauka', group: camp},
  {path: 'camps.0.secondaryImage', altPath: 'camps.0.secondaryImageAlt', label: 'Mažoji stovyklos nuotrauka', group: camp},
  {path: 'camps.0.detailImage', altPath: 'camps.0.detailImageAlt', label: 'Plati nuotrauka stovyklos puslapyje', group: camp}
];

export class ValidationError extends Error {
  constructor(issues) { super('Patikrinkite pažymėtus turinio laukus.'); this.name = 'ValidationError'; this.issues = issues; }
}

const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const splitPath = path => {
  if (typeof path !== 'string' || !path || path.length > 250) throw new TypeError('Netinkamas lauko kelias.');
  const parts = path.split('.');
  if (parts.some(part => !part || forbidden.has(part) || !/^[a-zA-Z0-9]+$/.test(part))) throw new TypeError('Neleidžiamas lauko kelias.');
  return parts;
};
const clone = value => JSON.parse(JSON.stringify(value));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const mediaPattern = /^\/media\/([a-f0-9]{32}\.(?:jpg|png|webp))$/;
const schema = {children: Object.create(null)};
function addField(path, descriptor) {
  let node = schema;
  for (const part of splitPath(path)) node = (node.children ||= Object.create(null))[part] ||= {children: Object.create(null)};
  node.field = descriptor;
  if (descriptor.type === 'repeater') node.children = Object.fromEntries(descriptor.fields.map(item => [item.path, {field: item}]));
}
for (const descriptor of CONTENT_FIELDS) addField(descriptor.path, descriptor);
for (const image of IMAGE_FIELDS) {
  addField(image.path, {type: 'image', nullable: true, required: false});
  addField(image.altPath, {type: 'text', required: false, maxLength: 500});
}
addField('site.url', {type: 'fixed', value: 'https://bukarciau.lt'});
addField('camps.0.slug', {type: 'fixed', value: 'stovykla-01'});

export function getPath(object, path) {
  let value = object;
  for (const part of splitPath(path)) {
    if (value == null || !Object.prototype.hasOwnProperty.call(value, part)) return undefined;
    value = value[part];
  }
  return value;
}
function nodeFor(parts) {
  let node = schema;
  for (const part of parts) {
    if (['list', 'paragraphs'].includes(node.field?.type)) {
      if (!/^(?:0|[1-9]\d*)$/.test(part) || Number(part) >= (node.field.maxItems || 40)) return null;
      node = {field: {...node.field, type: node.field.type === 'paragraphs' ? 'textarea' : 'text', required: true}, listItem: true};
      continue;
    }
    if (node.field?.type === 'repeater') {
      if (!/^(?:0|[1-9]\d*)$/.test(part) || Number(part) >= (node.field.maxItems || 40)) return null;
      node = {children: node.children};
      continue;
    }
    node = node.children?.[part];
    if (!node) return null;
  }
  return node;
}
export function setPath(object, path, value) {
  const parts = splitPath(path);
  const node = nodeFor(parts);
  if (!node?.field || node.field.type === 'fixed') throw new TypeError('Šis laukas neredaguojamas.');
  if (node.listItem) {
    const parent = getPath(object, parts.slice(0, -1).join('.'));
    const index = Number(parts.at(-1));
    if (!Array.isArray(parent) || index >= parent.length || !Object.prototype.hasOwnProperty.call(parent, index)) throw new TypeError('Šio sąrašo įrašo nėra.');
  }
  let target = object;
  for (let index = 0; index < parts.length - 1; index++) {
    const key = parts[index];
    if (!Object.prototype.hasOwnProperty.call(target, key) || target[key] === null) target[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    if (typeof target[key] !== 'object') throw new TypeError('Netinkama turinio struktūra.');
    target = target[key];
  }
  target[parts.at(-1)] = value;
  return object;
}

function merge(defaultValue, input, node) {
  if (input === undefined) return clone(defaultValue);
  if (node.field?.type === 'repeater') {
    if (!Array.isArray(input)) return input;
    return input.map(item => {
      if (!plain(item)) return item;
      return Object.fromEntries(node.field.fields.map(child => [child.path, merge('', item[child.path], node.children[child.path])]));
    });
  }
  if (node.field) {
    if (typeof input === 'string') return node.field.nullable && !input.trim() ? null : input.trim();
    return clone(input);
  }
  if (Array.isArray(defaultValue)) {
    if (!Array.isArray(input)) return input;
    return input.map((item, index) => merge(defaultValue[index] ?? {}, item, node.children[String(index)] || {children: {}}));
  }
  if (!plain(input)) return input;
  return Object.fromEntries(Object.entries(node.children).map(([key, child]) => [key, merge(defaultValue?.[key], input[key], child)]));
}
export function normalizeContent(input = {}) {
  // Legacy registration FAQ used a non-editorial kind marker. Convert it once.
  let legacy = input;
  if (plain(input) && Array.isArray(input.camps)) {
    legacy = {...input, camps: input.camps.map(item => plain(item) && Array.isArray(item.faq) ? {...item, faq: item.faq.map(faq => {
      if (!plain(faq) || !Object.prototype.hasOwnProperty.call(faq, 'kind')) return faq;
      const {kind, ...rest} = faq;
      return {...rest, answerWhenOpen: rest.answerWhenOpen ?? (kind === 'registration' ? registrationAnswer : '')};
    })} : item)};
  }
  return merge(DEFAULT_CONTENT, legacy, schema);
}

function inspectKeys(value, node, path, issues, depth = 0) {
  if (depth > 15) { issues.push({path, message: 'Per gili turinio struktūra.'}); return; }
  if (node.field?.type === 'repeater') {
    if (Array.isArray(value)) value.forEach((item, index) => inspectKeys(item, {children: node.children}, `${path}.${index}`, issues, depth + 1));
    return;
  }
  if (node.field) return;
  if (Array.isArray(value)) {
    if (path !== 'camps') { issues.push({path, message: 'Netinkama turinio struktūra.'}); return; }
    value.forEach((item, index) => {
      const child = node.children[String(index)];
      if (!child) issues.push({path: `${path}.${index}`, message: 'Galima redaguoti tik vieną stovyklą.'});
      else inspectKeys(item, child, `${path}.${index}`, issues, depth + 1);
    });
    return;
  }
  if (!plain(value)) {
    if (value !== undefined) issues.push({path, message: 'Netinkama turinio objekto struktūra.'});
    return;
  }
  for (const key of Object.keys(value)) {
    const next = path ? `${path}.${key}` : key;
    if (forbidden.has(key) || !Object.prototype.hasOwnProperty.call(node.children, key)) {
      // Supported legacy FAQ marker is migrated by normalizeContent.
      if (/^camps\.0\.faq\.\d+\.kind$/.test(next) && value[key] === 'registration') continue;
      issues.push({path: next, message: 'Šis turinio laukas neleidžiamas.'});
    } else inspectKeys(value[key], node.children[key], next, issues, depth + 1);
  }
}
function validate(value, descriptor, path, issues) {
  const issue = message => issues.push({path, message});
  if (descriptor.type === 'fixed') { if (value !== descriptor.value) issue('Šio sisteminio lauko keisti negalima.'); return; }
  if (value === null && descriptor.nullable) return;
  if (descriptor.type === 'boolean') { if (typeof value !== 'boolean') issue('Pasirinkite taip arba ne.'); return; }
  if (['list', 'paragraphs', 'repeater'].includes(descriptor.type)) {
    if (!Array.isArray(value)) { issue('Tikimasi sąrašo.'); return; }
    if (descriptor.required && !value.length) issue('Pridėkite bent vieną įrašą.');
    if (value.length > (descriptor.maxItems || 40)) issue(`Galimi ne daugiau kaip ${descriptor.maxItems || 40} įrašai.`);
    for (const [index, item] of value.entries()) {
      if (descriptor.type === 'repeater') {
        if (!plain(item)) { issues.push({path: `${path}.${index}`, message: 'Netinkama įrašo struktūra.'}); continue; }
        for (const child of descriptor.fields) validate(item[child.path], child, `${path}.${index}.${child.path}`, issues);
      } else validate(item, {...descriptor, type: 'textarea', required: true}, `${path}.${index}`, issues);
    }
    return;
  }
  if (typeof value !== 'string') { issue('Įrašykite tekstą.'); return; }
  if (descriptor.required && !value.trim()) issue('Užpildykite šį lauką.');
  if (value.length > (descriptor.maxLength || 2000)) issue(`Galimi ne daugiau kaip ${descriptor.maxLength || 2000} simbolių.`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) issue('Tekste yra neleidžiamų valdymo simbolių.');
  if (/[\u2010-\u2015\u2212]/u.test(value)) issue('Brūkšniams naudokite paprastą - ženklą.');
  if (descriptor.type === 'image' && !mediaPattern.test(value)) issue('Pasirinkite įkeltą JPG, PNG arba WebP nuotrauką.');
  if (value && descriptor.type === 'email' && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) issue('Įrašykite galiojantį el. pašto adresą.');
  if (value && descriptor.type === 'tel' && !/^\+[1-9]\d{6,14}$/.test(value)) issue('Naudokite tarptautinį formatą be tarpų, pvz. +37060571562.');
  if (value && descriptor.type === 'url') {
    try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
    catch { issue('Nuoroda turi būti galiojantis HTTPS adresas.'); }
  }
}
export function parseContent(input) {
  const issues = [];
  if (!plain(input)) throw new ValidationError([{path: '', message: 'Tikimasi turinio objekto.'}]);
  inspectKeys(input, schema, '', issues);
  let normalized;
  try { normalized = normalizeContent(input); }
  catch { throw new ValidationError([...issues, {path: '', message: 'Netinkama turinio struktūra.'}]); }
  if (!plain(normalized.site) || !plain(normalized.copy) || !plain(normalized.seo)) issues.push({path: '', message: 'Trūksta svetainės turinio struktūros.'});
  if (!Array.isArray(normalized.camps) || normalized.camps.length !== 1 || !plain(normalized.camps[0])) issues.push({path: 'camps', message: 'Svetainėje turi būti tik viena stovykla.'});
  for (const descriptor of CONTENT_FIELDS) validate(getPath(normalized, descriptor.path), descriptor, descriptor.path, issues);
  validate(getPath(normalized, 'site.url'), {type: 'fixed', value: 'https://bukarciau.lt'}, 'site.url', issues);
  validate(getPath(normalized, 'camps.0.slug'), {type: 'fixed', value: 'stovykla-01'}, 'camps.0.slug', issues);
  for (const image of IMAGE_FIELDS) {
    const source = getPath(normalized, image.path), alt = getPath(normalized, image.altPath);
    validate(source, {type: 'image', required: false, nullable: true}, image.path, issues);
    validate(alt, {type: 'text', required: Boolean(source), maxLength: 500}, image.altPath, issues);
  }
  if (issues.length) throw new ValidationError(issues);
  return normalized;
}

export function getImageReferences(content) {
  const references = new Map();
  for (const field of IMAGE_FIELDS) {
    const src = getPath(content, field.path);
    const match = typeof src === 'string' && mediaPattern.exec(src);
    if (match) references.set(match[1], {id: match[1], src});
  }
  return [...references.values()];
}

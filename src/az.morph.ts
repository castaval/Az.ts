import {Az} from './az'
import {DAWG, Dawg} from './az.dawg'

/** @namespace Az **/
let words: any,
    probabilities: any,
    predictionSuffixes = new Array(3),
    prefixes: any = [ '', 'по', 'наи' ],
    suffixes: any,
    grammemes: any,
    paradigms: any,
    tags: any,
    defaults: any = {
      ignoreCase: false,
      replacements: { 'е': 'ё' },
      stutter: Infinity,
      typos: 0,
      parsers: [
        // Словарные слова + инициалы
        'Dictionary?', 'AbbrName?', 'AbbrPatronymic',
        // Числа, пунктуация, латиница (по-хорошему, токенизатор не должен эту ерунду сюда пускать)
        'IntNumber', 'RealNumber', 'Punctuation', 'RomanNumber?', 'Latin',
        // Слова с дефисами
        'HyphenParticle', 'HyphenAdverb', 'HyphenWords',
        // Предсказатели по префиксам/суффиксам
        'PrefixKnown', 'PrefixUnknown?', 'SuffixKnown?', 'Abbr'
      ],
      forceParse: false,
      normalizeScore: true
    },
    initials: string = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ',
    particles: any = ['-то', '-ка', '-таки', '-де', '-тко', '-тка', '-с', '-ста'],
    knownPrefixes: any = [
      'авиа', 'авто', 'аква', 'анти', 'анти-', 'антропо', 'архи', 'арт', 'арт-', 'астро', 'аудио', 'аэро',
      'без', 'бес', 'био', 'вело', 'взаимо', 'вне', 'внутри', 'видео', 'вице-', 'вперед', 'впереди',
      'гекто', 'гелио', 'гео', 'гетеро', 'гига', 'гигро', 'гипер', 'гипо', 'гомо',
      'дву', 'двух', 'де', 'дез', 'дека', 'деци', 'дис', 'до', 'евро', 'за', 'зоо', 'интер', 'инфра',
      'квази', 'квази-', 'кило', 'кино', 'контр', 'контр-', 'космо', 'космо-', 'крипто', 'лейб-', 'лже', 'лже-',
      'макро', 'макси', 'макси-', 'мало', 'меж', 'медиа', 'медиа-', 'мега', 'мета', 'мета-', 'метео', 'метро', 'микро',
      'милли', 'мини', 'мини-', 'моно', 'мото', 'много', 'мульти',
      'нано', 'нарко', 'не', 'небез', 'недо', 'нейро', 'нео', 'низко', 'обер-', 'обще', 'одно', 'около', 'орто',
      'палео', 'пан', 'пара', 'пента', 'пере', 'пиро', 'поли', 'полу', 'после', 'пост', 'пост-',
      'порно', 'пра', 'пра-', 'пред', 'пресс-', 'противо', 'противо-', 'прото', 'псевдо', 'псевдо-',
      'радио', 'разно', 'ре', 'ретро', 'ретро-', 'само', 'санти', 'сверх', 'сверх-', 'спец', 'суб', 'супер', 'супер-', 'супра',
      'теле', 'тетра', 'топ-', 'транс', 'транс-', 'ультра', 'унтер-', 'штаб-',
      'экзо', 'эко', 'эндо', 'эконом-', 'экс', 'экс-', 'экстра', 'экстра-', 'электро', 'энерго', 'этно'
    ],
    autoTypos: any = [4, 9],
    UNKN: any,
    __init: any = [],
    initialized = false;

// Взято из https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
function deepFreeze(obj: any) {
  if (!('freeze' in Object)) {
    return;
  }

  let propNames = Object.getOwnPropertyNames(obj);
  propNames.forEach(function(name) {
    let prop = obj[name];

    if (typeof prop == 'object' && prop !== null)
      deepFreeze(prop);
  });

  return Object.freeze(obj);
}

/**
 * Тег. Содержит в себе информацию о конкретной форме слова, но при этом
 * к конкретному слову не привязан. Всевозможные значения тегов переиспользуются
 * для всех разборов слов.
 *
 * Все граммемы навешаны на тег как поля. Если какая-то граммема содержит в себе
 * дочерние граммемы, то значением поля является именно название дочерней
 * граммемы (например, tag.GNdr == 'masc'). В то же время для дочерних граммем
 * значением является просто true (т.е. условие можно писать и просто как
 * if (tag.masc) ...).
 *
 * @property {string[]} stat Полный список неизменяемых граммем.
 * @property {string[]} flex Полный список изменяемых граммем.
 * @property {Tag} ext Копия тега с русскими обозначениями (по версии OpenCorpora).
 */
class Tag {
  stat: string[];
  flex: string[];
  ext?: Tag;
  [statOrFlex: string]: any;
  [index: number]: any;
  POST?: string
  POS?: string

  NPRO?: boolean;
  NUMR?: boolean;
  PRED?: boolean;
  PREP?: boolean;
  CONJ?: boolean;
  PRCL?: boolean;
  INTJ?: boolean;
  Apro?: boolean;
  NUMB?: boolean;
  ROMN?: boolean;
  LATN?: boolean;
  PNCT?: boolean;
  UNKN?: boolean;

  Name?: boolean;
  Surn?: boolean;
  Patr?: boolean;
  Geox?: boolean;
  Init?: boolean;

  constructor(public str: string) {
    let par: any, pair: any = str.split(' ');
    this.stat = pair[0].split(',');
    this.flex = pair[1] ? pair[1].split(',') : [];
    for (let j: number = 0; j < 2; j++) {
      let statOrFlex: string = ['stat', 'flex'][j] as string;
      let grams: any = this[statOrFlex];
      for (let i = 0; i < grams.length; i++) {
        let gram = grams[i];
        this[gram] = true;
        // loc2 -> loct -> CAse
        while (grammemes[gram] && (par = grammemes[gram].parent)) {
          this[par] = gram;
          gram = par;
        }
      }
    }
    if ('POST' in this) {
      this.POS = this.POST;
    }
  }

  /**
 * Возвращает текстовое представление тега.
 *
 * @returns {string} Список неизменяемых граммем через запятую, пробел,
 *  и список изменяемых граммем через запятую.
 */
  toString(): string {
    return (this.stat.join(',') + ' ' + this.flex.join(',')).trim();
  }

    /**
   * Проверяет согласованность с конкретными значениями граммем либо со списком
   * граммем из другого тега (или слова).
   *
   * @param {Tag|Parse} [tag] Тег или разбор слова, с которым следует
   *  проверить согласованность.
   * @param {Array|Object} grammemes Граммемы, по которым нужно проверить
   *  согласованность.
   *
   *  Если указан тег (или разбор), то grammemes должен быть массивом тех
   *  граммем, которые у обоих тегов должны совпадать. Например:
   *  tag.matches(otherTag, ['POS', 'GNdr'])
   *
   *  Если тег не указан, а указан массив граммем, то проверяется просто их
   *  наличие. Например, аналог выражения (tag.NOUN && tag.masc):
   *  tag.matches([ 'NOUN', 'masc' ])
   *
   *  Если тег не указан, а указан объект, то ключи в нем — названия граммем,
   *  значения — дочерние граммемы, массивы граммем, либо true/false:
   *  tag.matches({ 'POS' : 'NOUN', 'GNdr': ['masc', 'neut'] })
   * @returns {boolean} Является ли текущий тег согласованным с указанным.
   */
  // TODO: научиться понимать, что некоторые граммемы можно считать эквивалентными при сравнении двух тегов (вариации падежей и т.п.)
  matches(tag: Tag | Parse, grammemes: any): boolean {
    if (!grammemes) {
      if (Object.prototype.toString.call(tag) === '[object Array]') {
        for (let i = 0; i < tag.length; i++) {
          if (!this[tag[i]]) {
            return false;
          }
        }
        return true;
      } else
      // Match to map
      for (let k in tag) {
        if (Object.prototype.toString.call(tag[k]) === '[object Array]') {
          if (!tag[k].indexOf(this[k])) {
            return false;
          }
        } else {
          if (tag[k] != this[k]) {
            return false;
          }
        }
      }
      return true;
    }

    if (tag instanceof Parse) {
      tag = tag.tag;
    }

    // Match to another tag
    for (let i = 0; i < grammemes.length; i++) {
      if (tag[grammemes[i]] != this[grammemes[i]]) {
        // Special case: tag.CAse
        return false;
      }
    }
    return true;
  }

  isProductive(): boolean {
    return !(this.NUMR || this.NPRO || this.PRED || this.PREP ||
      this.CONJ || this.PRCL || this.INTJ || this.Apro ||
      this.NUMB || this.ROMN || this.LATN || this.PNCT ||
      this.UNKN);
  }

  isCapitalized(): boolean {
    return this.Name! || this.Surn! || this.Patr! || this.Geox! || this.Init!;
  }
}

function makeTag(tagInt: any, tagExt: any) {
  let tag = new Tag(tagInt);
  tag.ext = new Tag(tagExt);
  return deepFreeze(tag);
}

/**
 * Производит морфологический анализ слова. Возвращает возможные варианты
 * разбора по убыванию их правдоподобности.
 *
 * @playground
 * let Az = require('az');
 * Az.Morph.init(function() {
 *   console.log(Az.Morph('стали'));
 * });
 * @param {string} word Слово, которое следует разобрать.
 * @param {Object} [config] Опции разбора.
 * @param {boolean} [config.ignoreCase=False] Следует ли игнорировать
 *  регистр слов (в основном это означает возможность написания имен собственных и
 *  инициалов с маленькой буквы).
 * @param {Object} [config.replacements={ 'е': 'ё' }] Допустимые замены букв
 *  при поиске слов в словаре. Ключи объекта — заменяемые буквы в разбираемом
 *  слове, соответствующие им значения — буквы в словарных словах, которым
 *  допустимо встречаться вместо заменяемых. По умолчанию буква «е» может
 *  соответствовать букве «ё» в словарных словах.
 * @param {number} [config.stutter=Infinity] «Заикание». Устраняет повторения букв
 *  (как с дефисом - «не-е-ет», так и без - «нееет»).
 *
 *  Infinity не ограничивает максимальное число повторений (суммарно во всем слове).
 *
 *  0 или false чтобы отключить.
 * @param {number|'auto'} [config.typos=0] Опечатки. Максимальное количество
 * опечаток в слове.
 *
 *  Опечаткой считается:
 *  - лишняя буква в слове
 *  - пропущенная буква в слове (TODO: самый медленный тип опечаток, стоит сделать опциональным)
 *  - не та буква в слове (если правильная буква стоит рядом на клавиатуре)
 *  - переставленные местами соседние буквы
 *
 *  0 или false чтобы отключить.
 *
 *  'auto':
 *  - 0, если слово короче 5 букв
 *  - 1, если слово короче 10 букв (но только если не нашлось варианта разбора без опечаток)
 *  - 2 в противном случае (но только если не нашлось варианта разбора без опечаток или с 1 опечаткой)
 * @param {string[]} [config.parsers] Список применяемых парсеров (см. поля
 *  объекта Az.Morph.Parsers) в порядке применения (т.е. стоящие в начале
 *  имеют наивысший приоритет).
 *
 *  Вопросительный знак означает, что данный парсер не терминальный, то есть
 *  варианты собираются до первого терминального парсера. Иными словами, если
 *  мы дошли до какого-то парсера, значит все стоящие перед ним терминальные
 *  парсеры либо не дали результата совсем, либо дали только с опечатками.
 *
 *  (парсер в терминологии pymorphy2 — анализатор)
 * @param {boolean} [config.forceParse=False] Всегда возвращать хотя бы один вариант
 *  разбора (как это делает pymorphy2), даже если совсем ничего не получилось.
 * @returns {Parse[]} Варианты разбора.
 * @memberof Az
 */
let Morph: any = function(word: any, config: any) {
  if (!initialized) {
    throw new Error('Please call Az.Morph.init() before using this module.');
  }

  config = config ? Az.extend(defaults, config) : defaults;

  let parses: any = [];
  let matched = false;
  for (let i = 0; i < config.parsers.length; i++) {
    let name = config.parsers[i];
    let terminal = name[name.length - 1] != '?';
    name = terminal ? name : name.slice(0, -1);
    if (name in Morph.Parsers) {
      let lets = Morph.Parsers[name](word, config);
      for (let j = 0; j < lets.length; j++) {
        lets[j].parser = name;
        if (!lets[j].stutterCnt && !lets[j].typosCnt) {
          matched = true;
        }
      }

      parses = parses.concat(lets);
      if (matched && terminal) {
        break;
      }
    } else {
      console.warn('Parser "' + name + '" is not found. Skipping');
    }
  }

  if (!parses.length && config.forceParse) {
    parses.push(new Parse(word.toLocaleLowerCase(), UNKN));
  }

  let total = 0;
  for (let i = 0; i < parses.length; i++) {
    if (parses[i].parser == 'Dictionary') {
      let res = probabilities.findAll(parses[i] + ':' + parses[i].tag);
      if (res && res[0]) {
        parses[i].score = (res[0][1] / 1000000) * getDictionaryScore(parses[i].stutterCnt, parses[i].typosCnt);
        total += parses[i].score;
      }
    }
  }

  // Normalize Dictionary & non-Dictionary scores separately
  if (config.normalizeScore) {
    if (total > 0) {
      for (let i = 0; i < parses.length; i++) {
        if (parses[i].parser == 'Dictionary') {
          parses[i].score /= total;
        }
      }
    }

    total = 0;
    for (let i = 0; i < parses.length; i++) {
      if (parses[i].parser != 'Dictionary') {
        total += parses[i].score;
      }
    }
    if (total > 0) {
      for (let i = 0; i < parses.length; i++) {
        if (parses[i].parser != 'Dictionary') {
          parses[i].score /= total;
        }
      }
    }
  }

  parses.sort(function(e1: any, e2: any) {
    return e2.score - e1.score;
  });

  return parses;
}

// TODO: вынести парсеры в отдельный файл(ы)?

Morph.Parsers = {}

/**
 * Один из возможных вариантов морфологического разбора.
 *
 * @property {string} word Слово в текущей форме (с исправленными ошибками,
 *  если они были)
 * @property {Tag} tag Тег, описывающий текущую форму слова.
 * @property {number} score Число от 0 до 1, соответствующее «уверенности»
 *  в данном разборе (чем оно выше, тем вероятнее данный вариант).
 * @property {number} stutterCnt Число «заиканий», исправленных в слове.
 * @property {number} typosCnt Число опечаток, исправленных в слове.
 */
class Parse {
  [index: number]: Parse;
  length?: string;

  constructor(public word: string, public tag: Tag, public score?: number, public stutterCnt?: number, public typosCnt?: number) {
    this.stutterCnt = stutterCnt || 0;
    this.typosCnt = typosCnt || 0;
    this.score = score || 0;
  }

  /**
   * Приводит слово к его начальной форме.
   *
   * @param {boolean} keepPOS Не менять часть речи при нормализации (например,
   *  не делать из причастия инфинитив).
   * @returns {Parse} Разбор, соответствующий начальной форме или False,
   *  если произвести нормализацию не удалось.
   */
  // TODO: некоторые смены частей речи, возможно, стоит делать в любом случае (т.к., например, компаративы, краткие формы причастий и прилагательных разделены, инфинитив отделен от глагола)
  normalize(keepPOS?: boolean): Parse {
    return this.inflect(keepPOS ? { POS: this.tag.POS } : 0) as Parse;
  }

  /**
   * Приводит слово к указанной форме.
   *
   * @param {Tag|Parse} [tag] Тег или другой разбор слова, с которым следует
   *  согласовать данный.
   * @param {Array|Object} grammemes Граммемы, по которым нужно согласовать слово.
   * @returns {Parse|False} Разбор, соответствующий указанной форме или False,
   *  если произвести согласование не удалось.
   * @see Tag.matches
  */
  inflect(tag: any, grammemes?: any): Parse | boolean {
    return this;
  }

  /**
   * Приводит слово к форме, согласующейся с указанным числом.
   * Вместо конкретного числа можно указать категорию (согласно http://www.unicode.org/cldr/charts/29/supplemental/language_plural_rules.html).
   *
   * @param {number|string} number Число, с которым нужно согласовать данное слово или категория, описывающая правило построения множественного числа.
   * @returns {Parse|False} Разбор, соответствующий указанному числу или False,
   *  если произвести согласование не удалось.
 */
  pluralize(number: any): Parse | boolean {
    if (!this.tag['NOUN'] && !this.tag['ADJF'] && !this.tag['PRTF']) {
      return this;
    }

    if (typeof number == 'number') {
      number = number % 100;
      if ((number % 10 == 0) || (number % 10 > 4) || (number > 4 && number < 21)) {
        number = 'many';
      } else
      if (number % 10 == 1) {
        number = 'one';
      } else {
        number = 'few';
      }
    }

    if (this.tag['NOUN'] && !this.tag['nomn'] && !this.tag['accs']) {
      return this.inflect([number == 'one' ? 'sing' : 'plur', this.tag['CAse']]);
    } else
    if (number == 'one') {
      return this.inflect(['sing', this.tag['nomn'] ? 'nomn' : 'accs'])
    } else
    if (this.tag['NOUN'] && (number == 'few')) {
      return this.inflect(['sing', 'gent']);
    } else
    if ((this.tag['ADJF'] || this.tag['PRTF']) && this.tag['femn'] && (number == 'few')) {
      return this.inflect(['plur', 'nomn']);
    } else {
      return this.inflect(['plur', 'gent']);
    }
  }

    /**
   * Проверяет, согласуется ли текущая форма слова с указанной.
   *
   * @param {Tag|Parse} [tag] Тег или другой разбор слова, с которым следует
   *  проверить согласованность.
   * @param {Array|Object} grammemes Граммемы, по которым нужно проверить
   *  согласованность.
   * @returns {boolean} Является ли текущая форма слова согласованной с указанной.
   * @see Tag.matches
   */
  matches(tag: any, grammemes?: any) {
    return this.tag.matches(tag, grammemes);
  }

  /**
   * Возвращает текущую форму слова.
   *
   * @returns {String} Текущая форма слова.
   */
  toString() {
    return this.word;
  }

  // Выводит информацию о слове в консоль.
  log(): void {
    console.group(this.toString());
    console.log('Stutter?', this.stutterCnt, 'Typos?', this.typosCnt);
    console.log(this.tag.ext?.toString());
    console.groupEnd();
  }

}

function lookup(dawg: DAWG, word: any, config: any) {
  let entries: any;
  if (config.typos == 'auto') {
    entries = dawg.findAll(word, config.replacements, config.stutter, 0);
    for (let i: number = 0; i < autoTypos.length && !entries.length && word.length > autoTypos[i]; i++) {
      entries = dawg.findAll(word, config.replacements, config.stutter, i + 1);
    }
  } else {
    entries = dawg.findAll(word, config.replacements, config.stutter, config.typos);
  }
  return entries;
}

function getDictionaryScore(stutterCnt: number, typosCnt: number): number {
  return Math.pow(0.3, typosCnt) * Math.pow(0.6, Math.min(stutterCnt, 1));
}

class DictionaryParse extends Parse {
  paradigm: any;
  formCnt: number;
  tag: Tag;
  score: number;
  _base: any;

  constructor(public word: string, public paradigmIdx: number, public formIdx: number, public stutterCnt?: number, public typosCnt?: number, public prefix?: string, public suffix?: string) {
    super(word, tags[paradigms[paradigmIdx][paradigms[paradigmIdx].length / 3 + formIdx]]);
    this.paradigm = paradigms[paradigmIdx];
    this.formCnt = this.paradigm.length / 3;
    this.tag = tags[this.paradigm[this.formCnt + formIdx]];
    this.stutterCnt = stutterCnt || 0;
    this.typosCnt = typosCnt || 0;
    this.score = getDictionaryScore(this.stutterCnt, this.typosCnt);
    this.prefix = prefix || '';
    this.suffix = suffix || '';
  }


  // Возвращает основу слова
  base(): any {
    if (this._base) {
      return this._base;
    }
    return (this._base = this.word.substring(
      prefixes[this.paradigm[(this.formCnt << 1) + this.formIdx]].length,
      this.word.length - suffixes[this.paradigm[this.formIdx]].length)
    );
  }

  // Склоняет/спрягает слово так, чтобы оно соответствовало граммемам другого слова, тега или просто конкретным граммемам (подробнее см. Tag.prototype.matches).
  // Всегда выбирается первый подходящий вариант.
  inflect(tag: any, grammemes?: any): DictionaryParse | boolean {
    if (!grammemes && typeof tag === 'number') {
      // Inflect to specific formIdx
      return new DictionaryParse(
          prefixes[this.paradigm[(this.formCnt << 1) + tag]] +
          this.base() +
          suffixes[this.paradigm[tag]],
        this.paradigmIdx,
        tag, 0, 0, this.prefix, this.suffix
      );
    }

    for (let formIdx = 0; formIdx < this.formCnt; formIdx++) {
      if (tags[this.paradigm[this.formCnt + formIdx]].matches(tag, grammemes)) {
        return new DictionaryParse(
            prefixes[this.paradigm[(this.formCnt << 1) + formIdx]] +
            this.base() +
            suffixes[this.paradigm[formIdx]],
          this.paradigmIdx,
          formIdx, 0, 0, this.prefix, this.suffix
        );
      }
    }

    return false;
  }

  log() {
    console.group(this.toString());
    console.log('Stutter?', this.stutterCnt, 'Typos?', this.typosCnt);
    console.log(prefixes[this.paradigm[(this.formCnt << 1) + this.formIdx]] + '|' + this.base() + '|' + suffixes[this.paradigm[this.formIdx]]);
    console.log(this.tag.ext!.toString());
    let norm = this.normalize();
    console.log('=> ', norm + ' (' + norm.tag.ext!.toString() + ')');
    norm = this.normalize(true);
    console.log('=> ', norm + ' (' + norm.tag.ext!.toString() + ')');
    console.groupCollapsed('Все формы: ' + this.formCnt);
    for (let formIdx = 0; formIdx < this.formCnt; formIdx++) {
      let form = this.inflect(formIdx) as DictionaryParse;
      console.log(form + ' (' + form.tag.ext!.toString() + ')');
    }
    console.groupEnd();
    console.groupEnd();
  }

  toString() {
    if (this.prefix) {
      let pref = prefixes[this.paradigm[(this.formCnt << 1) + this.formIdx]];
      return pref + this.prefix + this.word.substr(pref.length) + this.suffix;
    } else {
      return this.word + this.suffix;
    }
  }
}


class CombinedParse extends Parse {
  formCnt: any;

  constructor(public left: any, public right: any) {
    super('', right.tag);
    this.left = left;
    this.right = right;
    this.tag = right.tag;
    this.score = left.score * right.score * 0.8;
    this.stutterCnt = left.stutterCnt + right.stutterCnt;
    this.typosCnt = left.typosCnt + right.typosCnt;
    if ('formCnt' in right) {
      this.formCnt = right.formCnt;
    }
  }

  inflect(tag: any, grammemes: any): CombinedParse | boolean {
    let left;

    let right = this.right.inflect(tag, grammemes);
    if (!grammemes && typeof tag === 'number') {
      left = this.left.inflect(right.tag, ['POST', 'NMbr', 'CAse', 'PErs', 'TEns']);
    } else {
      left = this.left.inflect(tag, grammemes);
    }
    if (left && right) {
      return new CombinedParse(left, right);
    } else {
      return false;
    }
  }

  toString(): string {
    return this.left.word + '-' + this.right.word;
  }
}

__init.push(function() {
  Morph.Parsers.Dictionary = function(word: any, config: any) {
    let isCapitalized: any =
      !config.ignoreCase && word.length &&
      (word[0].toLocaleLowerCase() != word[0]) &&
      (word.substr(1).toLocaleUpperCase() != word.substr(1));
    word = word.toLocaleLowerCase();

    let opts = lookup(words, word, config);

    let lets = [];
    for (let i = 0; i < opts.length; i++) {
      for (let j = 0; j < opts[i][1].length; j++) {
        let w = new DictionaryParse(
          opts[i][0],
          opts[i][1][j][0],
          opts[i][1][j][1],
          opts[i][2],
          opts[i][3]);
        if (config.ignoreCase || !w.tag.isCapitalized() || isCapitalized) {
          lets.push(w);
        }
      }
    }
    return lets;
  }

  let abbrTags: any = [];
  for (let i = 0; i <= 2; i++) {
    for (let j = 0; j <= 5; j++) {
      for (let k = 0; k <= 1; k++) {
        abbrTags.push(makeTag(
          'NOUN,inan,' + ['masc', 'femn', 'neut'][i] + ',Fixd,Abbr ' + ['sing', 'plur'][k] + ',' + ['nomn', 'gent', 'datv', 'accs', 'ablt', 'loct'][j],
          'СУЩ,неод,' + ['мр', 'жр', 'ср'][i] + ',0,аббр ' + ['ед', 'мн'][k] + ',' + ['им', 'рд', 'дт', 'вн', 'тв', 'пр'][j]
        ));
      }
    }
  }

  // Произвольные аббревиатуры (несклоняемые)
  // ВК, ЖК, ССМО, ОАО, ЛенСпецСМУ
  Morph.Parsers.Abbr = function(word: any, config: any) {
    // Однобуквенные считаются инициалами и для них заведены отдельные парсеры
    if (word.length < 2) {
      return [];
    }
    // Дефисов в аббревиатуре быть не должно
    if (word.indexOf('-') > -1) {
      return [];
    }
    // Первая буква должна быть заглавной: сокращения с маленькой буквы (типа iOS) мало распространены
    // Последняя буква должна быть заглавной: иначе сокращение, вероятно, склоняется
    if ((initials.indexOf(word[0]) > -1) && (initials.indexOf(word[word.length - 1]) > -1)) {
      let caps = 0;
      for (let i = 0; i < word.length; i++) {
        if (initials.indexOf(word[i]) > -1) {
          caps++;
        }
      }
      if (caps <= 5) {
        let lets = [];
        for (let i = 0; i < abbrTags.length; i++) {
          let w = new Parse(word, abbrTags[i], 0.5);
          lets.push(w);
        }
        return lets;
      }
    }
    // При игнорировании регистра разбираем только короткие аббревиатуры
    // (и требуем, чтобы каждая буква была «инициалом», т.е. без мягких/твердых знаков)
    if (!config.ignoreCase || (word.length > 5)) {
      return [];
    }
    word = word.toLocaleUpperCase();
    for (let i = 0; i < word.length; i++) {
      if (initials.indexOf(word[i]) == -1) {
        return [];
      }
    }
    let lets = [];
    for (let i = 0; i < abbrTags.length; i++) {
      let w = new Parse(word, abbrTags[i], 0.2);
      lets.push(w);
    }
    return lets;
  }

  let InitialsParser = function(score: number) {
    let initialsTags: any = [];
    for (let i = 0; i <= 1; i++) {
      for (let j = 0; j <= 5; j++) {
        initialsTags.push(makeTag(
          'NOUN,anim,' + ['masc', 'femn'][i] + ',Sgtm,Name,Fixd,Abbr,Init sing,' + ['nomn', 'gent', 'datv', 'accs', 'ablt', 'loct'][j],
          'СУЩ,од,' + ['мр', 'жр'][i] + ',sg,имя,0,аббр,иниц ед,' + ['им', 'рд', 'дт', 'вн', 'тв', 'пр'][j]
        ));
      }
    }
    return function(word: string, config: any) {
      if (word.length != 1) {
        return [];
      }
      if (config.ignoreCase) {
        word = word.toLocaleUpperCase();
      }
      if (initials.indexOf(word) == -1) {
        return [];
      }
      let lets = [];
      for (let i = 0; i < initialsTags.length; i++) {
        let w = new Parse(word, initialsTags[i], score);
        lets.push(w);
      }
      return lets;
    }
  }

  Morph.Parsers.AbbrName = InitialsParser(0.1);
  Morph.Parsers.AbbrPatronymic = InitialsParser(0.1);

  let RegexpParser = function(regexp: any, tag: any, score: number) {
    return function(word: string, config: any) {
      if (config.ignoreCase) {
        word = word.toLocaleUpperCase();
      }
      if (word.length && word.match(regexp)) {
        return [new Parse(word, tag)];
      } else {
        return [];
      }
    }
  }

  grammemes['NUMB'] = grammemes['ЧИСЛО'] =
  grammemes['ROMN'] = grammemes['РИМ'] =
  grammemes['LATN'] = grammemes['ЛАТ'] =
  grammemes['PNCT'] = grammemes['ЗПР'] =
  grammemes['UNKN'] = grammemes['НЕИЗВ'] =
    { parent: 'POST' };

  Morph.Parsers.IntNumber = RegexpParser(
    /^[−-]?[0-9]+$/,
    makeTag('NUMB,intg', 'ЧИСЛО,цел'), 0.9);

  Morph.Parsers.RealNumber = RegexpParser(
    /^[−-]?([0-9]*[.,][0-9]+)$/,
    makeTag('NUMB,real', 'ЧИСЛО,вещ'), 0.9);

  Morph.Parsers.Punctuation = RegexpParser(
    /^[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]+$/,
    makeTag('PNCT', 'ЗПР'), 0.9);

  Morph.Parsers.RomanNumber = RegexpParser(
    /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/,
    makeTag('ROMN', 'РИМ'), 0.9);

  Morph.Parsers.Latin = RegexpParser(
    /[A-Za-z\u00C0-\u00D6\u00D8-\u00f6\u00f8-\u024f]$/,
    makeTag('LATN', 'ЛАТ'), 0.9);

  // слово + частица
  // смотри-ка
  Morph.Parsers.HyphenParticle = function(word: string, config: any) {
    word = word.toLocaleLowerCase();

    let lets = [];
    for (let k = 0; k < particles.length; k++) {
      if (word.substr(word.length - particles[k].length) == particles[k]) {
        let base = word.slice(0, -particles[k].length);
        let opts = lookup(words, base, config);

        //console.log(opts);
        for (let i = 0; i < opts.length; i++) {
          for (let j = 0; j < opts[i][1].length; j++) {
            let w = new DictionaryParse(
              opts[i][0],
              opts[i][1][j][0],
              opts[i][1][j][1],
              opts[i][2],
              opts[i][3],
              '', particles[k]);
            w.score *= 0.9;
            lets.push(w);
          }
        }
      }
    }

    return lets;
  }

  let ADVB = makeTag('ADVB', 'Н');

  // 'по-' + прилагательное в дательном падеже
  // по-западному
  Morph.Parsers.HyphenAdverb = function(word: string, config: any) {
    word = word.toLocaleLowerCase();

    if ((word.length < 5) || (word.substr(0, 3) != 'по-')) {
      return [];
    }

    let opts = lookup(words, word.substr(3), config);

    let parses = [];
    let used: any = {};

    for (let i = 0; i < opts.length; i++) {
      if (!used[opts[i][0]]) {
        for (let j = 0; j < opts[i][1].length; j++) {
          let parse: DictionaryParse | Parse = new DictionaryParse(opts[i][0], opts[i][1][j][0], opts[i][1][j][1], opts[i][2], opts[i][3]);
          if (parse.matches(['ADJF', 'sing', 'datv'])) {
            used[opts[i][0]] = true;

            parse = new Parse('по-' + opts[i][0], ADVB, parse.score! * 0.9, opts[i][2], opts[i][3]);
            parses.push(parse);
            break;
          }
        }
      }
    }
    return parses;
  }

  // слово + '-' + слово
  // интернет-магазин
  // компания-производитель
  Morph.Parsers.HyphenWords = function(word: string, config: any) {
    word = word.toLocaleLowerCase();
    for (let i = 0; i < knownPrefixes.length; i++) {
      if (knownPrefixes[i][knownPrefixes[i].length - 1] == '-' &&
          word.substr(0, knownPrefixes[i].length) == knownPrefixes[i]) {
        return [];
      }
    }
    let parses: any = [];
    let parts: any = word.split('-');
    if (parts.length != 2 || !parts[0].length || !parts[1].length) {
      if (parts.length > 2) {
        let end = parts[parts.length - 1];
        let right = Morph.Parsers.Dictionary(end, config);
        for (let j = 0; j < right.length; j++) {
          if (right[j] instanceof DictionaryParse) {
            right[j].score *= 0.2;
            right[j].prefix = word.substr(0, word.length - end.length - 1) + '-';
            parses.push(right[j]);
          }
        }
      }
      return parses;
    }
    let left = Morph.Parsers.Dictionary(parts[0], config);
    let right = Morph.Parsers.Dictionary(parts[1], config);


    // letiable
    for (let i = 0; i < left.length; i++) {
      if (left[i].tag.Abbr) {
        continue;
      }
      for (let j = 0; j < right.length; j++) {
        if (!left[i].matches(right[j], ['POST', 'NMbr', 'CAse', 'PErs', 'TEns'])) {
          continue;
        }
        if (left[i].stutterCnt + right[j].stutterCnt > config.stutter ||
            left[i].typosCnt + right[j].typosCnt > config.typos) {
          continue;
        }
        parses.push(new CombinedParse(left[i], right[j]));
      }
    }
    // Fixed
    for (let j = 0; j < right.length; j++) {
      if (right[j] instanceof DictionaryParse) {
        right[j].score *= 0.3;
        right[j].prefix = parts[0] + '-';
        parses.push(right[j]);
      }
    }

    return parses;
  }

  Morph.Parsers.PrefixKnown = function(word: any, config: any) {
    let isCapitalized: any =
      !config.ignoreCase && word.length &&
      (word[0].toLocaleLowerCase() != word[0]) &&
      (word.substr(1).toLocaleUpperCase() != word.substr(1));
    word = word.toLocaleLowerCase();
    let parses: any = [];
    for (let i = 0; i < knownPrefixes.length; i++) {
      if (word.length - knownPrefixes[i].length < 3) {
        continue;
      }

      if (word.substr(0, knownPrefixes[i].length) == knownPrefixes[i]) {
        let end = word.substr(knownPrefixes[i].length);
        let right = Morph.Parsers.Dictionary(end, config);
        for (let j = 0; j < right.length; j++) {
          if (!right[j].tag.isProductive()) {
            continue;
          }
          if (!config.ignoreCase && right[j].tag.isCapitalized() && !isCapitalized) {
            continue;
          }
          right[j].score *= 0.7;
          right[j].prefix = knownPrefixes[i];
          parses.push(right[j]);
        }
      }
    }
    return parses;
  }

  Morph.Parsers.PrefixUnknown = function(word: any, config:  any) {
    let isCapitalized =
      !config.ignoreCase && word.length &&
      (word[0].toLocaleLowerCase() != word[0]) &&
      (word.substr(1).toLocaleUpperCase() != word.substr(1));
    word = word.toLocaleLowerCase();
    let parses: any = [];
    for (let len = 1; len <= 5; len++) {
      if (word.length - len < 3) {
        break;
      }
      let end = word.substr(len);
      let right = Morph.Parsers.Dictionary(end, config);
      for (let j = 0; j < right.length; j++) {
        if (!right[j].tag.isProductive()) {
          continue;
        }
        if (!config.ignoreCase && right[j].tag.isCapitalized() && !isCapitalized) {
          continue;
        }
        right[j].score *= 0.3;
        right[j].prefix = word.substr(0, len);
        parses.push(right[j]);
      }
    }
    return parses;
  }

  // Отличие от предсказателя по суффиксам в pymorphy2: найдя подходящий суффикс, проверяем ещё и тот, что на символ короче
  Morph.Parsers.SuffixKnown = function(word: any, config: any) {
    if (word.length < 4) {
      return [];
    }
    let isCapitalized: any =
      !config.ignoreCase && word.length &&
      (word[0].toLocaleLowerCase() != word[0]) &&
      (word.substr(1).toLocaleUpperCase() != word.substr(1));
    word = word.toLocaleLowerCase();
    let parses: any = [];
    let minlen: number = 1;
    let coeffs: any = [0, 0.2, 0.3, 0.4, 0.5, 0.6];
    let used: any = {};
    for (let i = 0; i < prefixes.length; i++) {
      if (prefixes[i].length && (word.substr(0, prefixes[i].length) != prefixes[i])) {
        continue;
      }
      let base = word.substr(prefixes[i].length);
      for (let len = 5; len >= minlen; len--) {
        if (len >= base.length) {
          continue;
        }
        let left = base.substr(0, base.length - len);
        let right = base.substr(base.length - len);
        let entries = predictionSuffixes[i].findAll(right, config.replacements, 0, 0);
        if (!entries) {
          continue;
        }

        let p = [];
        let max = 1;
        for (let j = 0; j < entries.length; j++) {
          let suffix = entries[j][0];
          let stats = entries[j][1];

          for (let k = 0; k < stats.length; k++) {
            let parse = new DictionaryParse(
              prefixes[i] + left + suffix,
              stats[k][1],
              stats[k][2]);
            // Why there is even non-productive forms in suffix DAWGs?
            if (!parse.tag.isProductive()) {
              continue;
            }
            if (!config.ignoreCase && parse.tag.isCapitalized() && !isCapitalized) {
              continue;
            }
            let key = parse.toString() + ':' + stats[k][1] + ':' + stats[k][2];
            if (key in used) {
              continue;
            }
            max = Math.max(max, stats[k][0]);
            parse.score = stats[k][0] * coeffs[len];
            p.push(parse);
            used[key] = true;
          }
        }
        if (p.length > 0) {
          for (let j = 0; j < p.length; j++) {
            p[j]!.score /= max;
          }
          parses = parses.concat(p);
          // Check also suffixes 1 letter shorter
          minlen = Math.max(len - 1, 1);
        }
      }
    }
    return parses;
  }

  UNKN = makeTag('UNKN', 'НЕИЗВ');
});

/**
 * Задает опции морфологического анализатора по умолчанию.
 *
 * @param {Object} config Опции анализатора.
 * @see Morph
 */
Morph.setDefaults = function(config: any) {
  defaults = config;
}

/**
 * Инициализирует анализатор, загружая необходимые для работы словари из
 * указанной директории. Эту функцию необходимо вызвать (и дождаться
 * срабатывания коллбэка) до любых действий с модулем.
 *
 * @param {string} [path] Директория, содержащая файлы 'words.dawg',
 * 'grammemes.json' и т.д. По умолчанию директория 'dicts' в данном модуле.
 * @param {Function} callback Коллбэк, вызываемый после завершения загрузки
 *  всех словарей.
 */
export const Init = function(path: string, callback: any) {
  let loading = 0;
  let tagsInt: any, tagsExt: any;
  function loaded() {
    if (!--loading) {
      tags = Array(tagsInt.length);
      for (let i = 0; i < tagsInt.length; i++) {
        tags[i] = new Tag(tagsInt[i]);
        tags[i].ext = new Tag(tagsExt[i]);
      }
      tags = deepFreeze(tags);
      for (let i = 0; i < __init.length; i++) {
        __init[i]();
      }
      initialized = true;
      callback && callback(null, Morph);
    }
  }

  if (!callback && typeof path == 'function') {
    callback = path;
    if (typeof __dirname == 'string') {
      path = __dirname + '/../dicts';
    } else {
      path = 'dicts';
    }
  }

  loading++;
  Dawg.load(path + '/words.dawg', 'words', function(err: any, dawg: any) {
    if (err) {
      callback(err);
      return;
    }
    words = dawg;
    loaded();
  });

  for (let prefix = 0; prefix < 3; prefix++) {
    (function(prefix) {
      loading++;
      Dawg.load(path + '/prediction-suffixes-' + prefix + '.dawg', 'probs', function(err: any, dawg: any) {
        if (err) {
          callback(err);
          return;
        }
        predictionSuffixes[prefix] = dawg;
        loaded();
      });
    })(prefix);
  }

  loading++;
  Dawg.load(path + '/p_t_given_w.intdawg', 'int', function(err: any, dawg: any) {
    if (err) {
      callback(err);
      return;
    }
    probabilities = dawg;
    loaded();
  });

  loading++;
  Az.load(path + '/grammemes.json', 'json', function(err: any, json: any) {
    if (err) {
      callback(err);
      return;
    }
    grammemes = {};
    for (let i = 0; i < json.length; i++) {
      grammemes[json[i][0]] = grammemes[json[i][2]] = {
        parent: json[i][1],
        internal: json[i][0],
        external: json[i][2],
        externalFull: json[i][3]
      }
    }
    loaded();
  });

  loading++;
  Az.load(path + '/gramtab-opencorpora-int.json', 'json', function(err: any, json: any) {
    if (err) {
      callback(err);
      return;
    }
    tagsInt = json;
    loaded();
  });

  loading++;
  Az.load(path + '/gramtab-opencorpora-ext.json', 'json', function(err: any, json: any) {
    if (err) {
      callback(err);
      return;
    }
    tagsExt = json;
    loaded();
  });

  loading++;
  Az.load(path + '/suffixes.json', 'json', function(err: any, json: any) {
    if (err) {
      callback(err);
      return;
    }
    suffixes = json;
    loaded();
  });

  loading++;
  Az.load(path + '/paradigms.array', 'arraybuffer', function(err: any, data: any) {
    if (err) {
      callback(err);
      return;
    }

    let list: any = new Uint16Array(data),
        count: any = list[0],
        pos: number = 1;

    paradigms = [];
    for (let i = 0; i < count; i++) {
      let size: number = list[pos++];
      paradigms.push(list.subarray(pos, pos + size));
      pos += size;
    }
    loaded();
  });
}

export { Morph }
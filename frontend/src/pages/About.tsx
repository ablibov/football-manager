import { Info, Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, Card, PageHeader } from '../components/ui'
import { SITE } from '../config/site'
import type { Lang } from '../data/types'
import { useLang, useT } from '../i18n'
import { useStore } from '../store/context'

type Section = { h: string; p: ReactNode[] }

function Contact() {
  const t = useT()
  return SITE.contactEmail ? (
    <a className="text-accent hover:underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
  ) : (
    <Badge tone="warning">{t('about.contactPending')}</Badge>
  )
}

const ABOUT: Record<Lang, Section[]> = {
  en: [
    { h: 'What is this?', p: [`${SITE.name} lets you pick Azerbaijani football clubs, edit line-ups and tactics, and watch a minute-by-minute simulated match with events and statistics. You can also simulate a whole league season and a cup tournament. No account is needed.`] },
    { h: 'Independent project', p: ['The simulator is developed independently. It is not affiliated with, sponsored by, or endorsed by any football league, federation, club, or game publisher. It is not an official product of the Azerbaijan Professional Football League (PFL) or of any club.'] },
    { h: 'What is real and what is simulated', p: [
      'Real (from public sources): club names, cities, stadiums and capacities; first-team squad lists (player names, shirt numbers, broad positions GK/DF/MF/FW, nationality) with the date of each list; head coaches where sources agree; real 2026/27 results and the real league table, which are always labelled “Real data”.',
      'Simulated or estimated: every simulated match, season and cup; all player and team ratings; detailed playing positions; club colours used in the interface; neutral club badges and kits. Ratings are estimates made for this game and are not official characteristics of any player.',
      'Missing information (birth dates, heights, preferred foot, some coaches) is shown as “not confirmed” rather than guessed.',
    ] },
    { h: 'Club badges, kits and photos', p: ['The site does not use official club crests, kits or player photos. It shows neutral badges in club colours. Official artwork will only be added with permission from the rights holder; each asset is then recorded with its owner, licence and source.'] },
    { h: 'Rights holders and corrections', p: ['If you represent a club, league, player or other rights holder, or you spot wrong information, please contact us and we will review it promptly: ', <Contact key="c" />] },
  ],
  ru: [
    { h: 'Что это?', p: [`${SITE.name} позволяет выбрать азербайджанские клубы, настроить состав и тактику и смотреть поминутную симуляцию матча с событиями и статистикой. Можно также сыграть сезон лиги и кубковый турнир. Регистрация не нужна.`] },
    { h: 'Независимый проект', p: ['Симулятор разработан независимо. Он не связан ни с одной футбольной лигой, федерацией, клубом или издателем игр, не спонсируется и не одобрен ими. Это не официальный продукт Профессиональной футбольной лиги Азербайджана (ПФЛ) или какого-либо клуба.'] },
    { h: 'Что реально, а что смоделировано', p: [
      'Реальные данные (из открытых источников): названия клубов, города, стадионы и вместимость; списки основных составов (имена, номера, общие позиции GK/DF/MF/FW, гражданство) с датой каждого списка; главные тренеры, если источники согласуются; реальные результаты и таблица 2026/27 — всегда с пометкой «Реальные данные».',
      'Смоделировано или оценено: все симулированные матчи, сезоны и кубки; все рейтинги игроков и команд; точные позиции; цвета клубов в интерфейсе; нейтральные значки и формы. Рейтинги — игровые оценки, а не официальные характеристики игроков.',
      'Отсутствующая информация (даты рождения, рост, рабочая нога, некоторые тренеры) показывается как «не подтверждено», а не придумывается.',
    ] },
    { h: 'Эмблемы, формы и фото', p: ['Сайт не использует официальные эмблемы, формы и фотографии игроков. Показываются нейтральные значки в цветах клубов. Официальные изображения будут добавлены только с разрешения правообладателя, с записью владельца, лицензии и источника.'] },
    { h: 'Правообладателям и исправления', p: ['Если вы представляете клуб, лигу, игрока или другого правообладателя либо заметили ошибку, свяжитесь с нами — мы быстро рассмотрим обращение: ', <Contact key="c" />] },
  ],
  az: [
    { h: 'Bu nədir?', p: [`${SITE.name} Azərbaycan futbol klublarını seçməyə, heyəti və taktikanı qurmağa və hadisələr və statistika ilə dəqiqəbədəqiqə oyun simulyasiyasını izləməyə imkan verir. Həmçinin liqa mövsümü və kubok turnirini simulyasiya etmək olar. Qeydiyyat lazım deyil.`] },
    { h: 'Müstəqil layihə', p: ['Simulyator müstəqil şəkildə hazırlanıb. Heç bir futbol liqası, federasiya, klub və ya oyun naşiri ilə əlaqəli deyil, onlar tərəfindən maliyyələşdirilmir və təsdiqlənmir. Azərbaycan Peşəkar Futbol Liqasının (PFL) və ya hər hansı klubun rəsmi məhsulu deyil.'] },
    { h: 'Nə realdır, nə simulyasiyadır', p: [
      'Real (açıq mənbələrdən): klub adları, şəhərlər, stadionlar və tutum; əsas heyət siyahıları (oyunçu adları, forma nömrələri, ümumi mövqelər GK/DF/MF/FW, vətəndaşlıq) və hər siyahının tarixi; mənbələr razılaşdıqda baş məşqçilər; 2026/27 real nəticələri və real cədvəl — həmişə «Real məlumat» kimi işarələnir.',
      'Simulyasiya və ya təxmin: bütün simulyasiya oyunları, mövsümlər və kuboklar; bütün oyunçu və komanda reytinqləri; dəqiq mövqelər; interfeysdə klub rəngləri; neytral emblem və formalar. Reytinqlər bu oyun üçün təxminlərdir, oyunçuların rəsmi göstəriciləri deyil.',
      'Çatışmayan məlumatlar (doğum tarixi, boy, əsas ayaq, bəzi məşqçilər) uydurulmur, «təsdiqlənməyib» kimi göstərilir.',
    ] },
    { h: 'Emblemlər, formalar və fotolar', p: ['Sayt rəsmi klub emblemlərindən, formalarından və oyunçu fotolarından istifadə etmir. Klub rənglərində neytral nişanlar göstərilir. Rəsmi təsvirlər yalnız hüquq sahibinin icazəsi ilə, sahibi, lisenziyası və mənbəyi qeyd olunaraq əlavə ediləcək.'] },
    { h: 'Hüquq sahibləri və düzəlişlər', p: ['Klubu, liqanı, oyunçunu və ya başqa hüquq sahibini təmsil edirsinizsə, yaxud səhv məlumat görmüsünüzsə, bizimlə əlaqə saxlayın — müraciətinizə tez baxacağıq: ', <Contact key="c" />] },
  ],
}

export function About() {
  const t = useT()
  const lang = useLang()
  const { dataset } = useStore()
  return (
    <div className="max-w-3xl">
      <PageHeader icon={<Info size={22} />} title={t('nav.about')} subtitle={SITE.description} />
      <div className="space-y-4">
        {ABOUT[lang].map((s) => (
          <Card key={s.h}>
            <h2 className="mb-2 font-display text-lg font-semibold">{s.h}</h2>
            <div className="space-y-2 text-sm leading-relaxed text-muted">{s.p.map((x, i) => (typeof x === 'string' ? <p key={i}>{x}</p> : <p key={i}>{x}</p>))}</div>
          </Card>
        ))}
        <Card>
          <h2 className="mb-2 font-display text-lg font-semibold">{t('settings.sources')}</h2>
          <ul className="space-y-2 text-sm">
            {dataset.dataSources.map((s) => (
              <li key={s.id} className="rounded-xl bg-surface-2 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{s.name}</a> : s.name}
                  <Badge>{s.license}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-muted">{s.notes} · {t('settings.accessed', { date: s.accessedAt })}</div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">{t('about.attribution')}</p>
        </Card>
        <Card>
          <p className="text-sm">{t('legal.disclaimer')}</p>
          <a href="#/privacy" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"><Lock size={14} /> {t('nav.privacy')}</a>
        </Card>
      </div>
    </div>
  )
}

const PRIVACY: Record<Lang, Section[]> = {
  en: [
    { h: 'Summary', p: ['You can use the simulator without an account. We do not ask for your name, e-mail address or any other personal details, and the site does not use advertising or analytics trackers.'] },
    { h: 'Stored in your browser', p: ['Your browser’s local storage keeps your settings (language, theme, speed), a random visitor ID, your match setup, line-ups, match history and season/cup progress. Nothing here is shared with other visitors.'] },
    { h: 'Stored on our server', p: ['To keep your progress, the server stores your line-ups, simulated matches and season/cup saves together with the random visitor ID. The ID is generated in your browser and is not linked to your name or device. Server copies are kept until you delete them with “Delete my progress” in Settings, or until the operator removes old data.'] },
    { h: 'Technical data', p: ['Like any website, the web server receives your IP address and browser information with each request. They may be written to server logs and are kept briefly in memory to protect the site from abuse (rate limiting). Log retention depends on the hosting setup: ', <b key="r">[to be completed by the operator before launch]</b>, '.'] },
    { h: 'Cookies', p: ['Visitors receive no cookies. Only administrators who sign in to the admin area get a session or security cookie for that purpose.'] },
    { h: 'Third parties', p: ['The site loads no third-party fonts, scripts or trackers. Links to sources such as Wikipedia open those websites only when you click them. The hosting provider processes requests on our behalf: ', <b key="h">[hosting provider to be named before launch]</b>, '.'] },
    { h: 'Your choices and contact', p: ['“Delete my progress” in Settings removes your data from this device and from the server. For questions or requests, contact the operator ', <b key="o">{SITE.operator || '[operator name to be added]'}</b>, ': ', <Contact key="c" />] },
  ],
  ru: [
    { h: 'Кратко', p: ['Симулятором можно пользоваться без аккаунта. Мы не запрашиваем имя, e-mail или иные личные данные; на сайте нет рекламных и аналитических трекеров.'] },
    { h: 'Хранится в вашем браузере', p: ['В локальном хранилище браузера сохраняются настройки (язык, тема, скорость), случайный идентификатор посетителя, настройка матча, составы, история матчей и прогресс сезонов и кубков. Эти данные не видны другим посетителям.'] },
    { h: 'Хранится на нашем сервере', p: ['Чтобы сохранить прогресс, сервер хранит ваши составы, симулированные матчи и сохранения сезонов/кубков вместе со случайным идентификатором. Он создаётся в браузере и не связан с вашим именем или устройством. Копии на сервере хранятся, пока вы не удалите их кнопкой «Удалить мой прогресс» в Настройках или пока оператор не удалит старые данные.'] },
    { h: 'Технические данные', p: ['Как и любой сайт, веб-сервер получает ваш IP-адрес и сведения о браузере при каждом запросе. Они могут записываться в журналы сервера и ненадолго храниться в памяти для защиты от злоупотреблений (ограничение частоты запросов). Срок хранения журналов зависит от хостинга: ', <b key="r">[заполняется оператором до запуска]</b>, '.'] },
    { h: 'Cookie', p: ['Посетители не получают cookie. Только администраторы, входящие в панель управления, получают для этого cookie сессии или безопасности.'] },
    { h: 'Третьи стороны', p: ['Сайт не загружает сторонние шрифты, скрипты или трекеры. Ссылки на источники, например Википедию, открывают эти сайты только по вашему клику. Хостинг-провайдер обрабатывает запросы по нашему поручению: ', <b key="h">[будет указан до запуска]</b>, '.'] },
    { h: 'Ваш выбор и контакты', p: ['Кнопка «Удалить мой прогресс» в Настройках удаляет ваши данные с этого устройства и с сервера. Вопросы и запросы направляйте оператору ', <b key="o">{SITE.operator || '[имя оператора будет добавлено]'}</b>, ': ', <Contact key="c" />] },
  ],
  az: [
    { h: 'Qısaca', p: ['Simulyatordan hesab yaratmadan istifadə edə bilərsiniz. Adınızı, e-poçt ünvanınızı və ya digər şəxsi məlumatlarınızı soruşmuruq; saytda reklam və analitika izləyiciləri yoxdur.'] },
    { h: 'Brauzerinizdə saxlanılır', p: ['Brauzerin lokal yaddaşında ayarlar (dil, mövzu, sürət), təsadüfi ziyarətçi identifikatoru, oyun ayarları, heyətlər, oyun tarixçəsi və mövsüm/kubok irəliləyişi saxlanılır. Bu məlumatlar digər ziyarətçilərə görünmür.'] },
    { h: 'Serverimizdə saxlanılır', p: ['İrəliləyişi qorumaq üçün server heyətlərinizi, simulyasiya oyunlarını və mövsüm/kubok fayllarını təsadüfi identifikatorla birlikdə saxlayır. Identifikator brauzerinizdə yaradılır və adınız və ya cihazınızla əlaqələndirilmir. Server nüsxələri siz Ayarlarda «İrəliləyişimi sil» ilə silənə və ya operator köhnə məlumatları silənə qədər saxlanılır.'] },
    { h: 'Texniki məlumatlar', p: ['Hər bir sayt kimi, veb-server hər sorğuda IP ünvanınızı və brauzer məlumatlarını alır. Onlar server jurnallarına yazıla və sui-istifadədən qorunmaq üçün (sorğu tezliyinin məhdudlaşdırılması) qısa müddət yaddaşda saxlanıla bilər. Jurnalların saxlanma müddəti hostinqdən asılıdır: ', <b key="r">[operator tərəfindən istifadəyə verilməzdən əvvəl doldurulacaq]</b>, '.'] },
    { h: 'Cookie faylları', p: ['Ziyarətçilərə cookie verilmir. Yalnız idarəetmə panelinə daxil olan administratorlar bunun üçün sessiya və ya təhlükəsizlik cookie-si alır.'] },
    { h: 'Üçüncü tərəflər', p: ['Sayt üçüncü tərəf şriftləri, skriptləri və ya izləyiciləri yükləmir. Vikipediya kimi mənbələrə keçidlər yalnız siz kliklədikdə həmin saytları açır. Hostinq provayderi sorğuları bizim adımızdan emal edir: ', <b key="h">[istifadəyə verilməzdən əvvəl göstəriləcək]</b>, '.'] },
    { h: 'Seçimləriniz və əlaqə', p: ['Ayarlarda «İrəliləyişimi sil» bu cihazdakı və serverdəki məlumatlarınızı silir. Suallar və müraciətlər üçün operatorla əlaqə: ', <b key="o">{SITE.operator || '[operatorun adı əlavə ediləcək]'}</b>, ': ', <Contact key="c" />] },
  ],
}

export function Privacy() {
  const t = useT()
  const lang = useLang()
  return (
    <div className="max-w-3xl">
      <PageHeader icon={<Lock size={22} />} title={t('nav.privacy')} subtitle={t('privacy.subtitle')} />
      <div className="space-y-4">
        {PRIVACY[lang].map((s) => (
          <Card key={s.h}>
            <h2 className="mb-2 font-display text-lg font-semibold">{s.h}</h2>
            <p className="text-sm leading-relaxed text-muted">{s.p}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Russian for the public pages: the home page, the search, a creator's page, the 404 and error pages, and the words search
// engines read (titles, descriptions, the FAQ). Uzbek sentence (the key) -> Russian. Rules: top of src/i18n/dictionary.ts.
// Glossary: ijodkor = креатор, mijoz = заказчик, buyurtma = заказ, kelishuv = соглашение, toʻlov = оплата,
// paket = пакет, sharh = отзыв, soʻm = сум.
//
// HARD RULE for the sections marked "meta" (titles, descriptions, FAQ, the names that go into JSON-LD): no promise about
// money in the text. tests/unit/seo.test.ts scans the Russian too. The visible page text further down may speak of
// money (it sits beside the test-mode badge).
export const publicPages: Record<string, string> = {
  // ---- meta: titles and descriptions (home, search, creator) ----
  "Tarmoq.uz: Oʻzbekistondagi videograf, fotograf va montajchilar": "Tarmoq.uz: видеографы, фотографы и монтажёры Узбекистана",
  "Oʻzbekiston shaharlaridagi mobilograf, videograf, fotograf va montajchilarni bir joydan toping: paketlari, portfoliosi va mijozlar sharhlarini solishtiring.":
    "Находите в городах Узбекистана специалистов по мобильной съёмке, видеографов, фотографов и монтажёров в одном месте: сравнивайте пакеты, портфолио и отзывы заказчиков.",
  "Ijodkorlarni toping": "Найдите креаторов",
  "Oʻzbekistondagi videograf, fotograf va montajchilar roʻyxati. Shahar, yoʻnalish va narx boʻyicha saralang.":
    "Список видеографов, фотографов и монтажёров Узбекистана. Фильтры по городу, направлению и цене.",
  "{category}: ijodkorlarni toping": "{category}: найдите креаторов",
  "Oʻzbekistondagi {category} yoʻnalishidagi ijodkorlar roʻyxati. Shahar va narx boʻyicha saralang.": "Список креаторов Узбекистана в направлении «{category}». Фильтры по городу и цене.",
  "Ijodkor profili": "Профиль креатора",
  "Bosh sahifa": "Главная",

  // ---- meta: the home page FAQ (shown on the page and sent as FAQPage data) ----
  "Ijodkorni qanday topaman?": "Как найти креатора?",
  "Qidiruv sahifasida kerakli ishni soʻz bilan yozing yoki ijodkorlarni shahar, yoʻnalish va narx boʻyicha saralang. Har bir ijodkorning sahifasida paketlari, portfoliosi va mijozlar sharhlari koʻrinadi.":
    "На странице поиска опишите нужную работу словами или отфильтруйте креаторов по городу, направлению и цене. На странице каждого креатора видны его пакеты, портфолио и отзывы заказчиков.",
  "Buyurtma topshiriqdan tayyor videogacha qanday boradi?": "Как проходит заказ от задания до готового видео?",
  "Ijodkorning paketini tanlab, topshiriqni yozib yuborasiz. Ijodkor uni koʻrib chiqadi, narx, muddat va tuzatishlar soni yozma kelishiladi va ikkala tomon shartlarni qabul qiladi. Ijodkor tayyor videoni sayt orqali topshiradi; kerak boʻlsa paketdagi tuzatishlar doirasida oʻzgartirish soʻraysiz, soʻng ishni qabul qilib sharh qoldirasiz.":
    "Вы выбираете пакет креатора и отправляете задание. Креатор рассматривает его, цена, срок и число правок согласуются письменно, и обе стороны принимают условия. Готовое видео креатор сдаёт через сайт; при необходимости вы просите изменения в рамках правок, входящих в пакет, затем принимаете работу и оставляете отзыв.",
  "Qaysi yoʻnalishlar va shaharlar bor?": "Какие направления и города есть?",
  "Yoʻnalishlar: {names}.": "Направления: {names}.",
  "Qidiruvda quyidagi shaharlar boʻyicha saralash mumkin: {cities}.": "В поиске можно фильтровать по таким городам: {cities}.",
  "Ijodkor sifatida qanday qoʻshilaman?": "Как стать креатором?",
  "Ijodkor sifatida roʻyxatdan oʻting, profilingizni toʻldiring va paketlaringizni qoʻshing. Sayt maʼmurlari profilni koʻrib chiqadi va tasdiqlagach, u ijodkorlar roʻyxatida koʻrinadi.":
    "Зарегистрируйтесь как креатор, заполните профиль и добавьте пакеты. Администраторы сайта проверят профиль, и после одобрения он появится в списке креаторов.",

  // ---- home page ----
  "Ijodkorni shu yerdan toping.": "Найдите креатора здесь.",
  "Mobilograf, fotograf va montajchilarni solishtiring, shartlarni yozma kelishib oling. Pul ish qabul qilinmaguncha ijodkorga oʻtmaydi.":
    "Сравнивайте мобильных видеографов, фотографов и монтажёров, согласуйте условия письменно. Деньги не перейдут к креатору, пока вы не примете работу.",
  "Sizga nima kerak?": "Что вам нужно?",
  "Toʻy videosi, reel, kafe reklamasi…": "Свадебное видео, рилс, реклама кафе…",
  "Shahar": "Город",
  "Barcha shaharlar": "Все города",
  "Qidirish": "Найти",
  "Top ijodkorlar": "Лучшие креаторы",
  "Hammasini koʻrish": "Смотреть всех",
  "Hozircha ijodkorlar yoʻq": "Пока нет креаторов",
  "Tasdiqlangan ijodkorlar tez orada shu yerda paydo boʻladi.": "Проверенные креаторы скоро появятся здесь.",
  "Buyurtma qanday ishlaydi": "Как работает заказ",
  "Toping": "Найдите",
  "Shahar, yoʻnalish va byudjet boʻyicha ijodkorlarni qidiring.": "Ищите креаторов по городу, направлению и бюджету.",
  "Kelishing": "Договоритесь",
  "Topshiriqni yuboring, narx va muddatni kelishing. Ikkala tomon shartlarni qabul qiladi.": "Отправьте задание и согласуйте цену и сроки. Обе стороны принимают условия.",
  "Toʻlang": "Оплатите",
  "Pul ish qabul qilinmaguncha xavfsiz saqlanadi.": "Деньги надёжно хранятся, пока вы не примете работу.",
  "Qabul qiling": "Примите",
  "Videoni oling, kerak boʻlsa tuzatish soʻrang, soʻng qabul qilib sharh qoldiring.": "Получите видео, при необходимости попросите правки, затем примите работу и оставьте отзыв.",
  "Nega Tarmoq.uz?": "Почему Tarmoq.uz?",
  "Shartlar yozma": "Условия письменно",
  "Narx, muddat va tuzatishlar yozma kelishiladi. Ikkala tomon qabul qilgan matn saqlanib qoladi.": "Цена, сроки и правки согласуются письменно. Текст, который приняли обе стороны, сохраняется.",
  "Pul himoyada": "Деньги под защитой",
  "Toʻlov ish qabul qilinmaguncha ushlab turiladi, shundan keyingina ijodkorga oʻtadi.": "Оплата удерживается, пока вы не примете работу, и только потом переходит к креатору.",
  "Haqiqiy sharhlar": "Настоящие отзывы",
  "Sharhni faqat buyurtmasi yakunlangan mijoz qoldira oladi.": "Отзыв может оставить только заказчик, чей заказ завершён.",
  "Koʻp beriladigan savollar": "Частые вопросы",
  "Ijodkormisiz? Buyurtmalar sizni kutmoqda.": "Вы креатор? Вас ждут заказы.",
  "Profil yarating, paketlaringizni joylang va mijozlardan buyurtma oling.": "Создайте профиль, добавьте пакеты и получайте заказы от заказчиков.",
  "Ijodkor sifatida qoʻshilish": "Присоединиться как креатор",

  // ---- search: the page, the filter panel, the sort menu, paging ----
  "Shahar, yoʻnalish va narx boʻyicha saralang.": "Фильтруйте по городу, направлению и цене.",
  "Qidiruv": "Поиск",
  "Ism, xizmat yoki kalit soʻz": "Имя, услуга или ключевое слово",
  "Yoʻnalish": "Направление",
  "Barcha yoʻnalishlar": "Все направления",
  "Eng kam narx (soʻm)": "Цена от (сум)",
  "Eng yuqori narx (soʻm)": "Цена до (сум)",
  "Saralash": "Сортировка",
  "Reyting boʻyicha": "По рейтингу",
  "Narx: arzondan qimmatga": "Цена: от низкой к высокой",
  "Narx: qimmatdan arzonga": "Цена: от высокой к низкой",
  "Eng yangilari": "Сначала новые",
  "Tozalash": "Сбросить",
  "Filtrlarni qoʻllash": "Применить фильтры",
  "Narx filtri belgilangan oraliqda paketi bor ijodkorlarni koʻrsatadi.": "Фильтр по цене показывает креаторов, у которых есть пакет в выбранном диапазоне.",
  "{count} topildi": "Найдено: {count}",
  "Bu filtrlarga mos ijodkor topilmadi": "По этим фильтрам креаторов не найдено",
  "Narx oraligʻini kengaytiring, boshqa shaharni tanlang yoki qidiruv soʻzini olib tashlang.": "Расширьте диапазон цен, выберите другой город или уберите слово из поиска.",
  "Filtrlarni tozalash": "Сбросить фильтры",
  "Sahifalar": "Страницы",
  "Oldingi": "Назад",
  "Keyingi": "Далее",
  "Sahifa {page} / {pages}": "Страница {page} из {pages}",
  "Ijodkorlar yuklanmoqda": "Загружаем креаторов",
  "Ijodkorlarni hozir yuklab boʻlmadi.": "Сейчас не удаётся загрузить креаторов.",

  // ---- a creator's card and page ----
  "Yangi": "Новый",
  "Tasdiqlangan": "Подтверждён",
  "Hali sharhlar yoʻq": "Пока нет отзывов",
  "Koʻrib chiqish rejimi. Bu profil hozir {status} holatida va ommaga koʻrinmaydi.": "Режим просмотра. Статус профиля сейчас: {status}. Посетителям он не виден.",
  "Profilni tahrirlash": "Редактировать профиль",
  "Xabar yozish": "Написать",
  "Yangi ijodkor": "Новый креатор",
  "Ijodkor haqida": "О креаторе",
  "Paketlar": "Пакеты",
  "Hozircha paketlar yoʻq": "Пока нет пакетов",
  "Bu ijodkor hali paket qoʻshmagan.": "Этот креатор ещё не добавил пакеты.",
  "{days} kunda topshiriladi": "Срок: {days} дн.",
  "{count} ta tuzatish": "Правок: {count}",
  "Buyurtma berish": "Заказать",
  "Portfolio": "Портфолио",
  "Portfolioga hali ish qoʻshilmagan": "В портфолио пока нет работ",
  "Ijodkor ishlarini qoʻshganda, ular shu yerda koʻrinadi.": "Когда креатор добавит работы, они появятся здесь.",
  "Videoni koʻrish": "Смотреть видео",
  "Sharhlar": "Отзывы",
  "Sharhlar buyurtma yakunlangandan keyin shu yerda paydo boʻladi.": "Отзывы появятся здесь после завершения заказа.",
  "Qisqacha": "Коротко",
  "Jihozlar": "Оборудование",
  "Ish tillari": "Рабочие языки",
  "Boshlangʻich narx": "Стоимость",
  "Himoyalangan buyurtma": "Защищённый заказ",
  "Shartlar yozma kelishiladi. Toʻlov siz ishni qabul qilmaguncha ushlab turiladi.": "Условия согласуются письменно. Оплата удерживается, пока вы не примете работу.",

  // ---- the 404 and error pages ----
  "Sahifa topilmadi": "Страница не найдена",
  "Bu manzilda sahifa yoʻq: havola eskirgan yoki notoʻgʻri yozilgan boʻlishi mumkin.": "По этому адресу страницы нет: ссылка могла устареть или быть записана с ошибкой.",
  "Sahifani hozir ochib boʻlmadi. Birozdan soʻng qayta urinib koʻring.": "Сейчас не удаётся открыть страницу. Попробуйте ещё раз чуть позже.",
};

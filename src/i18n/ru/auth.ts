// Russian for signing in, signing up and the "no access" page. Uzbek sentence (the key) -> Russian.
// Rules: top of src/i18n/dictionary.ts.
export const auth: Record<string, string> = {
  // Sign-in
  "Kirish": "Войти",
  "Kirilmoqda…": "Входим…",
  "Admin kirishi": "Вход для админа",
  "Soʻrovlar, buyurtmalar va toʻlovlaringiz shu yerda.": "Здесь ваши заявки, заказы и выплаты.",
  "Buyurtmalaringiz va xabarlaringiz shu yerda.": "Здесь ваши заказы и сообщения.",
  "Hisob turi": "Тип аккаунта",
  "Email": "Email",
  "Parol": "Пароль",
  "Urinishlar juda koʻp. {minutes} daqiqadan keyin qayta urinib koʻring.": "Слишком много попыток. Попробуйте снова через {minutes} мин.",
  "Kirib boʻlmadi.": "Не удалось войти.",
  "Yangimisiz?": "Впервые здесь?",
  "Roʻyxatdan oʻting": "Зарегистрируйтесь",
  // Continue with Google ("yoki" is in dashboard.ts). The next five are also said by the password login, so the page and
  // the server share one entry: the wrong-door sentences, a deactivated account, too many attempts.
  "Bu ijodkor hisobi. Ijodkorlar eshigidan kiring.": "Это аккаунт креатора. Войдите через вход для креаторов.",
  "Bu mijoz hisobi. Mijozlar eshigidan kiring.": "Это аккаунт заказчика. Войдите через вход для заказчиков.",
  "Bu hisob uchun boshqa kirish sahifasi bor.": "Для этого аккаунта есть другая страница входа.",
  "Bu hisob faolsizlantirilgan.": "Этот аккаунт отключён.",
  "Urinishlar juda koʻp. Birozdan keyin qayta urinib koʻring.": "Слишком много попыток. Попробуйте немного позже.",
  "Google orqali davom etish": "Продолжить через Google",
  "Google orqali kirish bekor qilindi.": "Вход через Google отменён.",
  "Google hisobingizdagi email tasdiqlanmagan. Emailni tasdiqlab, qayta urinib koʻring.": "Email в вашем аккаунте Google не подтверждён. Подтвердите email и попробуйте снова.",
  "Admin hisobi Google orqali kirmaydi. Email va parol bilan kiring.": "Аккаунт администратора не входит через Google. Войдите по email и паролю.",
  "Google orqali kirib boʻlmadi. Qayta urinib koʻring.": "Не удалось войти через Google. Попробуйте ещё раз.",
  // Sign-up
  "Roʻyxatdan oʻtish": "Зарегистрироваться",
  "Hisob yarating": "Создайте аккаунт",
  "Bir daqiqa ichida tayyor boʻladi. Bank kartasi shart emas.": "Это займёт минуту. Банковская карта не нужна.",
  "Ijodkor topib, video buyurtma qilaman": "Найду креатора и закажу видео",
  "Ijodkorman": "Я креатор",
  "Xizmatlarimni taklif qilaman": "Предлагаю свои услуги",
  "Ism-familiya": "Имя и фамилия",
  "Telefon (ixtiyoriy)": "Телефон (необязательно)",
  "Kamida 8 ta belgi": "Не менее 8 символов",
  "Yaratilmoqda…": "Создаём…",
  "Hisob yaratib boʻlmadi.": "Не удалось создать аккаунт.",
  "Hisobingiz bormi?": "Уже есть аккаунт?",
  "Kiring": "Войдите",
  // No access
  "Ruxsat yoʻq": "Нет доступа",
  "Bu sahifaga kirish huquqingiz yoʻq": "У вас нет доступа к этой странице",
  "Hisobingiz turi bu boʻlimga ruxsat bermaydi.": "Этот раздел недоступен для вашего типа аккаунта.",
};

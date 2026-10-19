welcome = 👋 Добро пожаловать в <b>{ $salon }</b>! Я запишу вас меньше чем за минуту, напомню о визите и отвечу на вопросы о ценах и услугах.

demo-hints = 🧪 <b>Демо-режим</b> · Платежи идут в Stripe TEST: карта <code>4242 4242 4242 4242</code>, любая будущая дата, любой CVC — без реальных денег. · Админка: /admin_demo (30 мин). · Данные сбрасываются каждую ночь в 04:00 ({ $tz }).

copy-test-card = 📋 Скопировать тестовую карту
try-admin = 🛠 Попробовать админку

menu-book = 📅 Записаться
menu-my = 🗓 Мои записи
menu-ask = 💬 Задать вопрос
menu-about = ℹ️ О нас
menu-settings = ⚙️ Настройки
menu-admin = 🛠 Админка

slot-taken = 😕 Это время только что заняли. Вот свободные слоты:
slot-too-soon = Слишком близко к началу — запись закрывается за { $minutes } мин.
limit-active = У вас уже { $count } предстоящих записей — это максимум. Управляйте ими в 🗓 Мои записи.
hold-replaced = Предыдущий неоплаченный холд снят.
booked = ✅ <b>Вы записаны!</b> Напомним за 24 ч и за 2 ч до визита.
hold-started = ⏳ Держу слот <b>{ $minutes } минут</b>. Оплатите депозит ниже, чтобы подтвердить.
paid = ✅ <b>Оплата получена — запись подтверждена!</b>
hold-expired = ⌛ Холд на { $service } { $date } истёк, слот снова свободен. Запишитесь заново: /book
precheckout-expired = Холд слота истёк. Запишитесь ещё раз — это займёт минуту.
cutoff = Изменения возможны до { $hours } ч до визита. Свяжитесь с салоном: /support
cancelled-by-client = Запись на { $service } { $date } отменена.
deposit-refund = Депозит { $amount } будет возвращён. (Тестовый режим — реальных списаний не было.)
cancelled-by-salon = Салон отменил запись на { $service } { $date }. Извините за неудобство.
rescheduled = 🔁 Готово! Запись перенесена на { $date }.
reminder-24h = ⏰ Напоминание: завтра в { $time } — { $service } с мастером { $master }. 📍 { $address }
reminder-2h = ⏰ Увидимся через 2 часа! { $time } — { $service } с мастером { $master }.
ai-intro = 💬 Спросите про услуги, цены, часы или правила — просто напишите. Вопросов на сегодня: { $left }.
ai-limit-user = Сегодняшний лимит { $limit } вопросов исчерпан. Сброс в полночь ({ $tz }). Запись всё ещё доступна: /book
ai-limit-global = Ассистент отдыхает до завтра. Смотрите /about или пишите в /support.
ai-error = Сейчас не могу ответить. Попробуйте через минуту.
ai-disabled = ИИ-ассистент в этой установке не настроен.
ai-truncated = (Вопрос обрезан до 500 символов.)
ai-book-now = 📅 Записаться
admin-demo-granted = 🛠 <b>Демо-админ на { $minutes } минут.</b> Смотрите расписание, услуги, мастеров, часы, статистику и Excel. Песочница: рассылка только вам; менять можно только демо-записи и свои; чужие имена скрыты; ночью всё сбросится.
admin-demo-expired = Демо-сессия админа закончилась. Нажмите /admin_demo, чтобы начать новую.
admin-only = Этот раздел для сотрудников салона.
sandbox-denied = 🧪 В демо можно менять только демо-записи и свои.
protected-item = 🧪 Этот демо-элемент защищён — редактировать можно, отключать нельзя.
outdated = Кнопка устарела — вот актуальный экран.
error-generic = Что-то пошло не так у нас. Попробуйте ещё раз.
error-not-found = Не нашли этот элемент. Попробуйте ещё раз.
error-forbidden = Так сделать нельзя.
error-inactive = Эта услуга или мастер больше недоступны.
error-slot-invalid = Это время недоступно.
error-reschedule-limit = Эту запись уже переносили максимальное число раз.
error-cooldown = Демо-данные восстанавливали { $ago } мин назад — повторите через { $left } мин.

help-text = Я умею:
• Записать на визит (📅)
• Показать записи, отменить или перенести (🗓)
• Ответить про цены и часы (💬)
• Открыть админку для сотрудников (/admin)

Команды: /book /my /ask /about /settings /help /terms /support /cancel

about-text = <b>{ $salon }</b>
📍 { $address }
📞 { $phone }
🕐 { $hours }

terms-text = <b>Правила</b>
Депозит: часть услуг требует тестовый депозит (Stripe TEST). Остаток — в салоне.
Отмена: бесплатно до { $hours } ч до визита; депозит возвращается (в тесте вручную).
Неявка: оплаченный депозит удерживается.
Холд: неоплаченный слот держится { $hold } мин.
Данные: храним имя Telegram и опционально телефон для записей.
Это публичное демо. Данные сбрасываются каждую ночь.

support-text = <b>Поддержка</b>
📞 { $phone }
📍 { $address }
Telegram: { $tg }

support-payments-note = Поддержка Telegram не поможет с платежами через этого бота.

open-maps = 📍 Открыть в картах
open-maps-short = 📍 Как проехать

settings-home = ⚙️ <b>Настройки</b>
Язык: { $language }
Телефон: { $phone }

settings-language = 🌐 Язык
settings-phone = 📱 Поделиться телефоном
settings-delete = 🗑 Удалить мои данные
settings-pick-lang = Выберите язык:
lang-en = English
lang-ru = Русский
phone-prompt = Отправьте номер кнопкой ниже или /cancel.
phone-button = 📱 Поделиться номером
phone-saved = Номер сохранён.
delete-confirm = Удалить личные данные? Будущие записи отменятся. История останется анонимной для статистики.
delete-yes = Да, удалить данные
delete-done = Личные данные анонимизированы. Будущие записи отменены.

wizard-s1 = Шаг 1/4 · Выберите услугу
wizard-s2 = Шаг 2/4 · Выберите мастера
haircut-line = { $service }
any-master = ✨ Любой свободный мастер
wizard-s3 = Шаг 3/4 · Выберите дату
wizard-tz-note = Время показано по салону ({ $tz }).
wizard-s4 = Шаг 4/4 · Выберите время
wizard-s5-title = Подтвердите запись
confirm-service = 💇 { $service } — { $duration } мин
confirm-master = 👤 { $master }
confirm-when = 📅 { $when }
confirm-price = 💵 Цена: { $price }
confirm-deposit = 💳 Депозит сейчас: { $deposit } · остаток в салоне
confirm-policy = ↩️ Бесплатная отмена или перенос до { $hours } ч до визита.
confirm-terms = Подтверждая, вы соглашаетесь с /terms.
confirm-btn = ✅ Подтвердить
confirm-pay-btn = ✅ Подтвердить и оплатить депозит
back = ⬅ Назад
cancel = ✖ Отмена
release-slot = ✖ Освободить слот
nav-prev = ‹
nav-next = ›
my-empty = Пока нет предстоящих записей.
my-title = 🗓 <b>Мои записи</b>
pay-deposit = 💳 Оплатить депозит
reschedule = 🔁 Перенести
cancel-booking = ✖ Отменить запись
keep-booking = Оставить
cancel-confirm = Отменить { $service } { $date } в { $time }?
yes-cancel = Да, отменить
reschedule-confirm = Перенести на { $when }?
status-pending = ⏳ Ждёт депозит
status-confirmed = ✅ Подтверждена
status-completed = ✔️ Выполнена
status-no-show = 🚫 Неявка
status-cancelled = ✖ Отменена
booking-card = { $status }
💇 { $service }
👤 { $master }
📅 { $when }
💵 { $price }
{ $depositLine }

deposit-line-paid = 💳 Депозит { $amount } · оплачен
deposit-line-due = 💳 Депозит { $amount } · к оплате
deposit-line-none = 💳 Без депозита
invoice-title = Депозит · { $service }
invoice-desc = { $when } с мастером { $master }. Остаток { $rest } — в салоне.
invoice-label = Депозит
hold-released = Слот освобождён.
admin-home = 🛠 Админка · { $salon }
Сегодня: { $todayCount } записей · { $pending } ждут оплату
admin-demo-banner = 🧪 Демо-админ · осталось { $minutes } мин · песочница, ночной сброс
admin-today = 📅 Сегодня
admin-pick-day = 🗓 Выбрать день
admin-upcoming = 📋 Ближайшие
admin-stats = 📊 Статистика
admin-services = 💇 Услуги
admin-masters = 👤 Мастера
admin-hours = ⏰ Часы работы
admin-broadcast = 📣 Рассылка
admin-export = 📥 Экспорт .xlsx
admin-restore = ♻️ Восстановить демо
admin-back = ⬅ Админка
day-off-toggle = 🌴 Выходной: { $master }
schedule-more = ещё +{ $n }
prev-day = ‹ Вчера
next-day = Завтра ›
today-btn = Сегодня
admin-completed = ✔️ Выполнена
admin-noshow = 🚫 Неявка
admin-mark-refunded = 💸 Отметить возврат
admin-booking-card = { $status } · { $source }
💇 { $service } · { $duration } мин
👤 { $master }
📅 { $when }
💵 { $price }
💳 { $deposit }
👤 { $client }
Телефон: { $phone }
Оплата: { $payment }
Создано: { $created }
svc-new = ➕ Новая услуга
mst-new = ➕ Новый мастер
active-on = 🟢 Активна
active-off = ⚪️ Выключена
edit-title = ✏️ Название
edit-name = ✏️ Имя
edit-price = 💲 Цена
edit-duration = ⏱ Длительность
edit-deposit = 💳 Депозит
edit-masters = 👥 Мастера
edit-services = 💇 Услуги
edit-hours = ⏰ Часы работы
hours-dayoff = Выходной
hours-custom = Свои…
hours-saved = Сохранено. { $count } текущих записей вне новых часов — они остаются; свяжитесь с клиентами при необходимости.
broadcast-prompt = Отправьте текст сообщения (макс. 1000 символов).
broadcast-preview = Предпросмотр:

{ $text }

Получателей: { $count }
broadcast-demo = Демо: отправим только вам
broadcast-send = 📣 Отправить
broadcast-done = Отправлено: { $sent } · Ошибки: { $failed }
stats-title = 📊 Статистика · { $from } – { $to }
stats-bookings = Записи: { $total }  (✔️ { $completed } · 🚫 { $noshow } · ✖ { $cancelled } · предстоящие { $upcoming })
stats-revenue = Выручка (выполненные): { $revenue }
stats-deposits = Депозиты: { $collected } · к возврату: { $pending }
stats-noshow = Неявки: { $rate } %
stats-top-services = Топ услуг: { $list }
stats-top-masters = Топ мастеров: { $list }
stats-new-clients = Новые клиенты: { $count }
period-7 = 7 дней
period-30 = 30 дней
period-month = Этот месяц
restore-confirm = Восстановить демо-каталог и часы? Записи сохранятся. До ночного сброса это не отменить.
restore-yes = Да, восстановить
restore-done = Демо-каталог восстановлен.
skip = Пропустить
done = Готово
flow-cancel = ✖ Отмена
ask-title-en = Название на английском:
ask-title-ru = Название на русском (или Skip):
ask-name-en = Имя на английском:
ask-name-ru = Имя на русском (или Skip):
ask-price = Цена в { $currency } (например 35 или 35.50):
ask-hours = Часы в формате HH:MM-HH:MM (сетка 30 мин).
notify-new = 📅 Новая запись: { $service } · { $when } · { $master } · { $client }
notify-cancel = ✖ Запись отменена: { $service } · { $when } · { $client }
notify-reschedule = 🔁 Запись перенесена: { $service } · { $when } · { $client }
cmd-start = Запустить бота
cmd-book = Записаться
cmd-my = Мои записи
cmd-ask = Спросить ассистента
cmd-about = О салоне
cmd-settings = Настройки
cmd-help = Справка
cmd-terms = Правила
cmd-support = Поддержка
cmd-cancel = Отменить ввод
cmd-admin = Админка
cmd-admin-demo = Попробовать админку (демо)
rate-limited = Подождите секунду.
hours-sun = Вс —
hours-off = выходной
svc-list = 💇 <b>Услуги</b>
mst-list = 👤 <b>Мастера</b>
hours-pick-master = Выберите мастера, чтобы править часы.
hours-master = ⏰ { $master }
weekday-line = { $day } { $hours }
deposit-pct = { $pct }%
duration-min = { $min } мин
upcoming-title = 📋 Ближайшие записи
pick-masters = Отметьте мастеров и нажмите Готово.
pick-services = Отметьте услуги и нажмите Готово.
custom-hours-bad = Формат HH:MM-HH:MM по сетке 30 мин, например 10:00-19:00.
text-too-long = Не больше { $max } символов.
number-bad = Пришлите число, например 35 или 35.50.
admin-day-title = { $date }
master-block = 👤 { $name } · { $hours }
booking-line = { $emoji } { $range } { $service } · { $client }
export-caption = Экспорт записей
input-cancelled = Отменено.
unknown-command = Неизвестная команда. Смотрите /help.
ai-offtopic = Могу помочь с услугами, ценами, часами и правилами записи. Записать на визит?
ai-unknown = Не уверен — напишите в салон: /support
demo-admin-disabled = Демо-админ доступен только при DEMO_MODE.
demo-admin-active = Демо-доступ админа уже есть.
owner-notify-off = (уведомления владельцу выключены)
calendar-empty = В этом месяце нет свободных дней.
times-empty = В этот день нет свободного времени.
hold-pay-gone = Этот холд уже неактивен.
marked-refunded = Отмечено как возвращённое.
marked-completed = Отмечено как выполненное.
marked-noshow = Отмечено как неявка.
day-off-on = { $master } не работает { $date }.
day-off-off = { $master } снова работает { $date }.
new-service-done = Услуга создана.
new-master-done = Мастер создан.
edit-saved = Сохранено.
any-resolved = { $master }
deposit-suffix = 💳
page-indicator = { $page }/{ $total }
wysiwyg-back = ⬅ Назад
wysiwyg-cancel = ✖ Отмена

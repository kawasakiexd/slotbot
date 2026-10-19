welcome = 👋 Welcome to <b>{ $salon }</b>! I can book your visit in under a minute, remind you before it and answer questions about prices and services.

demo-hints = 🧪 <b>Demo mode</b> · Payments run in Stripe TEST mode: card <code>4242 4242 4242 4242</code>, any future date, any CVC — no real money. · Try the admin panel: /admin_demo (30 min). · Demo data resets every night at 04:00 ({ $tz }).

copy-test-card = 📋 Copy test card
try-admin = 🛠 Try admin panel

menu-book = 📅 Book an appointment
menu-my = 🗓 My bookings
menu-ask = 💬 Ask a question
menu-about = ℹ️ About us
menu-settings = ⚙️ Settings
menu-admin = 🛠 Admin panel

slot-taken = 😕 Sorry, that time was just taken. Here are the remaining times:
slot-too-soon = That time is too soon now — bookings close { $minutes } min before the start.
limit-active = You already have { $count } upcoming bookings — that's the maximum. Manage them in 🗓 My bookings.
hold-replaced = Your previous unpaid hold was released.
booked = ✅ <b>You're booked!</b> We'll remind you 24 h and 2 h before the visit.
hold-started = ⏳ I'm holding this slot for <b>{ $minutes } minutes</b>. Pay the deposit below to confirm it.
paid = ✅ <b>Payment received — your booking is confirmed!</b>
hold-expired = ⌛ Your hold for { $service } on { $date } has expired and the slot was released. Book again any time: /book
precheckout-expired = This slot hold has expired. Please book again — it takes a minute.
cutoff = Changes are possible up to { $hours } h before the visit. Please contact the salon: /support
cancelled-by-client = Your booking for { $service } on { $date } is cancelled.
deposit-refund = Your { $amount } deposit will be refunded. (Test mode — no real money was charged.)
cancelled-by-salon = Your booking for { $service } on { $date } was cancelled by the salon. We're sorry for the inconvenience.
rescheduled = 🔁 Done! Your booking is moved to { $date }.
reminder-24h = ⏰ Reminder: tomorrow at { $time } — { $service } with { $master }. 📍 { $address }
reminder-2h = ⏰ See you in 2 hours! { $time } — { $service } with { $master }.
ai-intro = 💬 Ask me anything about our services, prices, hours or policies — just type your question. Questions left today: { $left }.
ai-limit-user = You've reached today's limit of { $limit } questions. It resets at midnight ({ $tz }). You can still book: /book
ai-limit-global = Our assistant is resting for today. See /about or contact /support.
ai-error = I couldn't answer right now. Please try again in a minute.
ai-disabled = The AI assistant is not configured in this deployment.
ai-truncated = (Your question was truncated to 500 characters.)
ai-book-now = 📅 Book now
admin-demo-granted = 🛠 <b>Demo admin access for { $minutes } minutes.</b> Explore the schedule, services, masters, hours, stats and Excel export. Sandbox: broadcasts go only to you; you can change only demo bookings and your own; other visitors' names are masked; everything resets nightly.
admin-demo-expired = Your demo admin session has ended. Tap /admin_demo to start a new one.
admin-only = This section is for salon staff.
sandbox-denied = 🧪 Sandboxed in demo mode: you can change only demo bookings and your own.
protected-item = 🧪 This demo item is protected — edit it, but it can't be deactivated.
outdated = This button is outdated — here is the current view.
error-generic = Something went wrong on our side. Please try again.
error-not-found = We couldn't find that item. Please try again.
error-forbidden = You can't do that.
error-inactive = That service or master is no longer available.
error-slot-invalid = That time is not available.
error-reschedule-limit = This booking was already rescheduled the maximum number of times.
error-cooldown = Demo data was restored { $ago } min ago — try again in { $left } min.

help-text = I can:
• Book a visit (📅)
• Show your bookings, cancel or reschedule (🗓)
• Answer questions about prices and hours (💬)
• Open the admin panel for staff (/admin)

Commands: /book /my /ask /about /settings /help /terms /support /cancel

about-text = <b>{ $salon }</b>
📍 { $address }
📞 { $phone }
🕐 { $hours }

terms-text = <b>Terms</b>
Deposits: some services require a test deposit (Stripe TEST). The rest is paid at the salon.
Cancellation: free until { $hours } h before the visit; deposits are refunded (manually in test mode).
No-show: a paid deposit is kept.
Holds: unpaid slots are held for { $hold } minutes.
Data: we store your Telegram name and optional phone to run bookings.
This is a public demo. Data resets nightly.

support-text = <b>Support</b>
📞 { $phone }
📍 { $address }
Telegram: { $tg }

support-payments-note = Telegram support cannot help with payments made via this bot.

open-maps = 📍 Open in Maps
open-maps-short = 📍 Directions

settings-home = ⚙️ <b>Settings</b>
Language: { $language }
Phone: { $phone }

settings-language = 🌐 Language
settings-phone = 📱 Share phone
settings-delete = 🗑 Delete my data
settings-pick-lang = Choose a language:
lang-en = English
lang-ru = Русский
phone-prompt = Share your phone number with the button below, or send /cancel.
phone-button = 📱 Share phone number
phone-saved = Phone number saved.
delete-confirm = Delete your personal data? Future bookings will be cancelled. History stays anonymous for stats.
delete-yes = Yes, delete my data
delete-done = Your personal data was anonymized. Future bookings were cancelled.

wizard-s1 = Step 1/4 · Choose a service
wizard-s2 = Step 2/4 · Choose a master
haircut-line = { $service }
any-master = ✨ Any available master
wizard-s3 = Step 3/4 · Pick a date
wizard-tz-note = Times are shown in salon time ({ $tz }).
wizard-s4 = Step 4/4 · Pick a time
wizard-s5-title = Please confirm your booking
confirm-service = 💇 { $service } — { $duration } min
confirm-master = 👤 { $master }
confirm-when = 📅 { $when }
confirm-price = 💵 Price: { $price }
confirm-deposit = 💳 Deposit now: { $deposit } · rest at the salon
confirm-policy = ↩️ Free cancellation or rescheduling up to { $hours } h before the visit.
confirm-terms = By confirming you agree to the /terms.
confirm-btn = ✅ Confirm
confirm-pay-btn = ✅ Confirm & pay deposit
back = ⬅ Back
cancel = ✖ Cancel
release-slot = ✖ Release slot
nav-prev = ‹
nav-next = ›
my-empty = No upcoming bookings yet.
my-title = 🗓 <b>My bookings</b>
pay-deposit = 💳 Pay deposit
reschedule = 🔁 Reschedule
cancel-booking = ✖ Cancel booking
keep-booking = Keep it
cancel-confirm = Cancel { $service } on { $date } at { $time }?
yes-cancel = Yes, cancel
reschedule-confirm = Move to { $when }?
status-pending = ⏳ Awaiting deposit
status-confirmed = ✅ Confirmed
status-completed = ✔️ Completed
status-no-show = 🚫 No-show
status-cancelled = ✖ Cancelled
booking-card = { $status }
💇 { $service }
👤 { $master }
📅 { $when }
💵 { $price }
{ $depositLine }

deposit-line-paid = 💳 Deposit { $amount } · paid
deposit-line-due = 💳 Deposit { $amount } · due now
deposit-line-none = 💳 No deposit
invoice-title = Deposit · { $service }
invoice-desc = { $when } with { $master }. The remaining { $rest } is paid at the salon.
invoice-label = Deposit
hold-released = Slot released.
admin-home = 🛠 Admin panel · { $salon }
Today: { $todayCount } bookings · { $pending } awaiting payment
admin-demo-banner = 🧪 Demo admin · { $minutes } min left · sandboxed, resets nightly
admin-today = 📅 Today
admin-pick-day = 🗓 Pick a day
admin-upcoming = 📋 Upcoming
admin-stats = 📊 Stats
admin-services = 💇 Services
admin-masters = 👤 Masters
admin-hours = ⏰ Working hours
admin-broadcast = 📣 Broadcast
admin-export = 📥 Export .xlsx
admin-restore = ♻️ Restore demo
admin-back = ⬅ Admin
day-off-toggle = 🌴 Day off: { $master }
schedule-more = +{ $n } more
prev-day = ‹ Prev day
next-day = Next day ›
today-btn = Today
admin-completed = ✔️ Completed
admin-noshow = 🚫 No-show
admin-mark-refunded = 💸 Mark refunded
admin-booking-card = { $status } · { $source }
💇 { $service } · { $duration } min
👤 { $master }
📅 { $when }
💵 { $price }
💳 { $deposit }
👤 { $client }
Phone: { $phone }
Payment: { $payment }
Created: { $created }
svc-new = ➕ New service
mst-new = ➕ New master
active-on = 🟢 Active
active-off = ⚪️ Inactive
edit-title = ✏️ Title
edit-name = ✏️ Name
edit-price = 💲 Price
edit-duration = ⏱ Duration
edit-deposit = 💳 Deposit
edit-masters = 👥 Masters
edit-services = 💇 Services
edit-hours = ⏰ Working hours
hours-dayoff = Day off
hours-custom = Custom…
hours-saved = Saved. { $count } existing bookings fall outside the new hours — they are kept; contact the clients if needed.
broadcast-prompt = Send the message text (max 1000 characters).
broadcast-preview = Preview:

{ $text }

Recipients: { $count }
broadcast-demo = Demo mode: will be sent only to you
broadcast-send = 📣 Send
broadcast-done = Sent: { $sent } · Failed: { $failed }
stats-title = 📊 Stats · { $from } – { $to }
stats-bookings = Bookings: { $total }  (✔️ { $completed } · 🚫 { $noshow } · ✖ { $cancelled } · upcoming { $upcoming })
stats-revenue = Revenue (completed): { $revenue }
stats-deposits = Deposits collected: { $collected } · refunds pending: { $pending }
stats-noshow = No-show rate: { $rate } %
stats-top-services = Top services: { $list }
stats-top-masters = Top masters: { $list }
stats-new-clients = New clients: { $count }
period-7 = 7 days
period-30 = 30 days
period-month = This month
restore-confirm = Restore the demo catalog and hours? Bookings are kept. This cannot be undone until the next nightly reset.
restore-yes = Yes, restore
restore-done = Demo catalog restored.
skip = Skip
done = Done
flow-cancel = ✖ Cancel
ask-title-en = Title in English:
ask-title-ru = Title in Russian (or tap Skip):
ask-name-en = Name in English:
ask-name-ru = Name in Russian (or tap Skip):
ask-price = Price in { $currency } (for example 35 or 35.50):
ask-hours = Send hours as HH:MM-HH:MM (30-minute grid).
notify-new = 📅 New booking: { $service } · { $when } · { $master } · { $client }
notify-cancel = ✖ Booking cancelled: { $service } · { $when } · { $client }
notify-reschedule = 🔁 Booking moved: { $service } · { $when } · { $client }
cmd-start = Start the bot
cmd-book = Book an appointment
cmd-my = My bookings
cmd-ask = Ask the assistant
cmd-about = About the salon
cmd-settings = Settings
cmd-help = Help
cmd-terms = Terms
cmd-support = Support
cmd-cancel = Cancel the current input
cmd-admin = Admin panel
cmd-admin-demo = Try the admin panel (demo)
rate-limited = Please slow down a little.
hours-sun = Sun —
hours-off = day off
svc-list = 💇 <b>Services</b>
mst-list = 👤 <b>Masters</b>
hours-pick-master = Pick a master to edit hours.
hours-master = ⏰ { $master }
weekday-line = { $day } { $hours }
deposit-pct = { $pct }%
duration-min = { $min } min
upcoming-title = 📋 Upcoming bookings
pick-masters = Toggle masters, then Done.
pick-services = Toggle services, then Done.
custom-hours-bad = Use HH:MM-HH:MM on a 30-minute grid, for example 10:00-19:00.
text-too-long = Please keep it under { $max } characters.
number-bad = Please send a number like 35 or 35.50.
admin-day-title = { $date }
master-block = 👤 { $name } · { $hours }
booking-line = { $emoji } { $range } { $service } · { $client }
export-caption = Bookings export
input-cancelled = Cancelled.
unknown-command = Unknown command. See /help.
ai-offtopic = I can help with our services, prices, hours and booking policies. Want me to book a visit?
ai-unknown = I'm not sure — please contact the salon: /support
demo-admin-disabled = Demo admin is only available when DEMO_MODE is on.
demo-admin-active = You already have demo admin access.
owner-notify-off = (owner notifications are off)
calendar-empty = No free days this month.
times-empty = No free times on this day.
hold-pay-gone = That hold is no longer active.
marked-refunded = Marked as refunded.
marked-completed = Marked completed.
marked-noshow = Marked no-show.
day-off-on = { $master } is off on { $date }.
day-off-off = { $master } works on { $date } again.
new-service-done = Service created.
new-master-done = Master created.
edit-saved = Saved.
any-resolved = { $master }
deposit-suffix = 💳
page-indicator = { $page }/{ $total }
wysiwyg-back = ⬅ Back
wysiwyg-cancel = ✖ Cancel

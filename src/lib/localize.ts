/**
 * The API answers in Arabic. Customer-facing screens in English mode mirror
 * the messages they can actually receive, so flipping the language toggle
 * never leaves half a sentence behind. Unknown messages pass through as-is.
 */

const EN: Record<string, string> = {
  /* auth */
  "محاولات كتير، استنى دقيقة وحاول تاني.": "Too many attempts. Wait a minute and try again.",
  "اكتب اسمك صح.": "Enter your name correctly.",
  "الإيميل مش صحيح.": "That email address isn't valid.",
  "الباسورد لازم 8 حروف على الأقل.": "Password must be at least 8 characters.",
  "رقم الموبايل مش صحيح.": "That mobile number isn't valid.",
  "الإيميل ده مسجل قبل كده. سجل دخول.": "This email is already registered. Sign in instead.",
  "محاولات دخول كتير. استنى دقيقة.": "Too many sign-in attempts. Wait a minute.",
  "الإيميل أو الباسورد مش صح.": "Email or password is incorrect.",
  "الحساب موقوف. كلمنا على واتساب.": "This account is suspended. Message us on WhatsApp.",
  "الباسورد الجديد لازم 8 حروف على الأقل.": "The new password must be at least 8 characters.",
  "الباسورد الحالي مش صح.": "Your current password is incorrect.",
  "اكتب اسمك بالكامل.": "Enter your full name.",
  "طلب غير مسموح.": "Request not allowed.",
  "محتاج تسجل دخول الأول.": "Please sign in first.",
  "الصفحة دي للدكتور بس.": "This page is for the clinic owner only.",

  /* payments */
  "لازم ترفع صورة التحويل.": "Upload the transfer screenshot.",
  "الباقة غير متاحة.": "That plan isn't available.",
  "اختار طريقة الدفع.": "Choose a payment method.",
  "الملف مش صورة صحيحة. ارفع صورة إيصال التحويل.": "That file isn't a valid image. Upload the payment receipt.",
  "الصورة دي اتقدّمت قبل كده. مينفعش نستخدم نفس الإيصال مرتين.":
    "This screenshot was already submitted — the same receipt can't be used twice.",
  "رقم العملية ده مستخدم قبل كده. تأكد من رقم العملية.":
    "That transaction reference was already used. Double-check it.",
  "الإيصال أو رقم العملية مستخدم قبل كده.": "This receipt or transaction reference was already used.",
  "حجم الصورة كبير. الحد 4 ميجا.": "The image is too large. The limit is 4 MB.",
  "الدفعة غير موجودة.": "That payment doesn't exist.",
  "حصل خطأ في السيرفر. جرب تاني.": "Server error. Please try again.",

  /* payment review notes */
  "حجم الصورة صغير جدًا — تأكد إنها سكرين شوت واضح للتحويل.":
    "The image is very small — make sure it's a clear screenshot of the transfer.",
  "رقم عملية التحويل قصير أو غير مكتمل.": "The transaction reference is too short or incomplete.",
  "رقم المحفظة المُحوّل منها غير مطابق لأرقام فودافون كاش.":
    "The sending wallet number doesn't match the Vodafone Cash format.",
  "بيانات حساب إنستاباي المُحوّل منه غير مكتملة.": "The InstaPay account details you sent from are incomplete.",
  "أبعاد صورة التحويل صغيرة جدًا — ارفع سكرين شوت أوضح.":
    "The screenshot resolution is too low — upload a clearer one.",
  "الصورة أطول من اللازم — ارفع سكرين شوت كامل للإيصال.":
    "The image is unusually tall — upload a full screenshot of the receipt.",
  "لم تُكتب بيانات المستلم كما هي في الإيصال — التفعيل التلقائي متوقف للمراجعة.":
    "The recipient details weren't entered exactly as on the receipt — automatic activation is paused for review.",
  "رقم المرسل مطابق لرقم المستلم — التحويل يبدو داخليًا.":
    "The sender matches the recipient — the transfer looks internal.",
  "التحويل مسجَّل من رقم العيادة نفسه.": "The transfer was made from the clinic's own number.",
  "رقم عملية التحويل لازم يحتوي على أحرف أو أرقام.":
    "The transaction reference must contain letters or numbers.",
  "رقم عملية التحويل بدون أي أرقام — انسخه كما هو في الإيصال.":
    "The transaction reference has no digits — copy it exactly as on the receipt.",
  "رقم عملية التحويل متكرر بالكامل وغير حقيقي.":
    "The transaction reference is repeated characters and can't be real.",
  "رقم عملية التحويل مطابق لرقم المحفظة.": "The transaction reference matches the wallet number.",
  "عدد محاولات رفع الإيصالات كتير دلوقتي. استنى ساعة وجرّب تاني.":
    "Too many receipt uploads for now. Wait an hour and try again.",

  /* contact */
  "بعتنالنا رسايل كتير. استنى شوية.": "You've sent a lot of messages. Please wait a bit.",
  "تعذر إرسال الرسالة. جرب تاني.": "Couldn't send the message. Try again.",

  /* transport (thrown by the api() helper itself) */
  "مش قادر أوصل للسيرفر. اتأكد من الاتصال وجرب تاني.":
    "Can't reach the server. Check your connection and try again.",
  "حصل خطأ غير متوقع. جرب تاني.": "Unexpected error. Try again.",
};

const AMOUNT_MISMATCH = /^المبلغ المكتوب \((\d+)\) لا يطابق سعر الباقة \((\d+) ج\.م\)\.$/;
const RECIPIENT_MISMATCH = /^بيانات المستلم المكتوبة \((.+?)\) لا تطابق (.+?) \((.+?)\)\.$/;
const RECIPIENT_LABEL: Record<string, string> = {
  "رقم محفظة العيادة": "the clinic wallet number",
  "عنوان إنستاباي المعتمد": "the approved InstaPay address",
};

/** Maps a known Arabic API message to its English wording for English mode. */
export function localize(message: string, lang: "ar" | "en"): string {
  if (lang === "ar") return message;
  const amount = AMOUNT_MISMATCH.exec(message);
  if (amount) return `The amount entered (${amount[1]}) doesn't match the plan price (${amount[2]} EGP).`;
  const recipient = RECIPIENT_MISMATCH.exec(message);
  if (recipient) {
    const label = RECIPIENT_LABEL[recipient[2]] ?? recipient[2];
    return `Recipient entered (${recipient[1]}) doesn't match ${label} (${recipient[3]}).`;
  }
  return EN[message] ?? message;
}

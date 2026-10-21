/**
 * Hand-rolled i18n — no new dependency (lean mode, decision #11d /
 * look-and-feel.md's no-new-dependency brief). Thai is the default locale;
 * English is the alternative (roadmap.md §1 row 3).
 *
 * `th` and `en` must stay the same shape — `t()` falls back to `en` then to
 * the raw key if a lookup misses, so a missing Thai string is never a blank.
 */

export type Locale = "th" | "en";

export const DEFAULT_LOCALE: Locale = "th";

export const dictionaries = {
  th: {
    localeToggle: { th: "ไทย", en: "EN" },

    booking: {
      nothingToBookTitle: "ยังไม่มีบริการให้จอง",
      nothingToBookDescription: "{name} ยังไม่ได้เผยแพร่บริการใด ๆ ลองใหม่อีกครั้ง หรือโทรสอบถามร้านได้เลย",
      stepService: "เลือกบริการ",
      stepStaff: "เลือกช่าง",
      anyAvailable: "คนใดก็ได้ที่ว่าง",
      anyAvailableHint: "ให้ร้านจัดช่างที่ว่างให้คุณ",
      stepDate: "เลือกวัน",
      stepTime: "เลือกเวลา",
      checkingAvailability: "กำลังตรวจสอบเวลาว่าง…",
      loadingTimes: "กำลังโหลดเวลา…",
      noFreeTimesTitle: "ไม่มีเวลาว่างในวันนี้",
      noFreeTimesDescription: "ร้านปิดหรือเต็มแล้ว ลองเลือกวันอื่นจากปฏิทินด้านบน",
      review: "ตรวจสอบ",
      signInToBook: "เข้าสู่ระบบเพื่อจอง",
      previewOnly: "ดูตัวอย่างเท่านั้น",
    },

    confirm: {
      title: "ยืนยันการจองของคุณ",
      descriptionAuto: "คิวของคุณถูกจองทันทีที่คุณยืนยัน",
      descriptionManual: "{name} จะตรวจสอบและยืนยันคำขอนี้ คิวของคุณถูกจองไว้ในระหว่างนี้",
      rowWhere: "ที่ไหน",
      rowWhat: "บริการ",
      rowStaff: "ช่าง",
      rowWhen: "เมื่อไหร่",
      rowPrice: "ราคา",
      paidAtShop: "ชำระเงินที่ร้าน",
      notesLabel: "มีอะไรอยากแจ้งร้านไหม?",
      notesHint: "ไม่บังคับ — เช่น อาการแพ้ ช่างที่ต้องการ หรือมาสาย",
      notesPlaceholder: "มาครั้งแรก ยินดีรับคำแนะนำค่ะ/ครับ",
      confirmButton: "ยืนยันการจอง",
      sendRequestButton: "ส่งคำขอ",
      bookedFallback: "จองเรียบร้อยแล้ว",
      cancellationPolicyLabel: "นโยบายการยกเลิก/ไม่มาตามนัด",
      cancellationPolicyFallback: "ร้านนี้ยังไม่ได้ระบุนโยบายการยกเลิก — ติดต่อร้านโดยตรงหากต้องการเปลี่ยนแปลงหรือยกเลิก",
    },

    listing: {
      backAllPlaces: "ร้านทั้งหมด",
      backToServices: "กลับไปที่บริการของคุณ",
      backToDashboard: "แดชบอร์ดของคุณ",
      ownerPreviewLiveTitle: "นี่คือสิ่งที่ลูกค้าเห็น",
      ownerPreviewDraftTitle: "ตัวอย่าง — ยังไม่เผยแพร่",
      ownerPreviewLiveBody: "เปลี่ยนชื่อ ราคา คำอธิบาย หรือลำดับบริการได้ที่หน้าบริการ แล้วจะอัปเดตที่นี่ทันที",
      ownerPreviewDraftBody: "มีคุณเท่านั้นที่เห็นหน้านี้ กดเผยแพร่จากหน้าตั้งค่าเมื่อพร้อมรับการจอง",
      instantConfirmation: "ยืนยันทันที",
      confirmedByShop: "ร้านยืนยันอีกครั้ง",
      call: "โทร",
      line: "LINE",
      cancellationPolicyHeading: "นโยบายการยกเลิก/ไม่มาตามนัด",
      cancellationPolicyFallback: "ร้านนี้ยังไม่ได้ระบุนโยบายการยกเลิก — ติดต่อร้านโดยตรงเพื่อสอบถาม",
    },

    category: {
      barber: "ร้านตัดผม",
      salon: "ร้านเสริมสวย",
      spa: "สปา",
      clinic: "คลินิก",
      fitness: "ฟิตเนส",
      event: "อีเวนต์",
      other: "อื่น ๆ",
    },

    discover: {
      searchPlaceholder: "ค้นหาร้าน บริการ หรือย่าน",
      searchAriaLabel: "ค้นหาร้านค้า",
      clearSearchAriaLabel: "ล้างการค้นหา",
      filterAriaLabel: "กรองตามหมวดหมู่",
      all: "ทั้งหมด",
      locationBlocked: "ตำแหน่งถูกบล็อก — เรียงตามตัวอักษร",
      sortNearest: "เรียงตามใกล้ที่สุด",
      placeCountOne: "{n} ร้าน",
      placeCountMany: "{n} ร้าน",
      nearestFirstSuffix: " · ใกล้ที่สุดก่อน",
      nothingMatchesTitle: "ไม่พบรายการที่ตรงกัน",
      nothingMatchesDescription: "ลองคำอื่น หรือล้างตัวกรองเพื่อดูร้านใกล้เคียงทั้งหมด",
      clearFilters: "ล้างตัวกรอง",
      fromPrice: "เริ่มต้น",
      serviceCountOne: "{n} บริการ",
      serviceCountMany: "{n} บริการ",
    },

    myBookings: {
      title: "การจองของฉัน",
      description: "เวลาที่แสดงเป็นเวลาท้องถิ่นของแต่ละร้าน",
      upcoming: "กำลังจะถึง",
      history: "ประวัติ",
      upcomingEmptyTitle: "ยังไม่มีการจอง",
      upcomingEmptyDescription: "เมื่อคุณจองที่ไหน จะแสดงที่นี่พร้อมเส้นทางและยกเลิกได้ในคลิกเดียว",
      findAPlace: "ค้นหาร้าน",
      pastEmptyTitle: "ยังไม่มีประวัติ",
      pastEmptyDescription: "การจองที่ผ่านมาและที่ยกเลิกจะรวมอยู่ที่นี่ เพื่อให้คุณจองซ้ำได้ในคลิกเดียว",
    },

    toast: {
      incompleteBooking: "ข้อมูลการจองไม่สมบูรณ์ กรุณาเลือกเวลาอีกครั้ง",
      signInToFinish: "กรุณาเข้าสู่ระบบเพื่อจองให้เสร็จสมบูรณ์",
      businessCannotBook: "บัญชีธุรกิจไม่สามารถจองได้ กรุณาเข้าสู่ระบบในบัญชีลูกค้า",
      businessNotTakingBookings: "ร้านนี้ไม่ได้รับการจองแล้ว",
      serviceUnavailable: "บริการนี้ไม่พร้อมให้บริการแล้ว",
      slotTaken: "ขออภัย — เวลานี้ถูกจองไปแล้วระหว่างที่คุณเลือก กรุณาเลือกเวลาอื่น",
      staffUnavailable: "ช่างคนนี้ไม่พร้อมให้บริการในวันหรือเวลานี้ กรุณาเลือกช่างคนอื่น หรือเลือก \"คนใดก็ได้ที่ว่าง\"",
      noStaffAvailable: "ไม่มีช่างว่างในวันนี้ ลองเลือกวันอื่น",
      bookedAutoConfirm: "จองเรียบร้อยแล้ว อีเมลยืนยันจะส่งถึงคุณในอีกสักครู่",
      bookedManualConfirm: "ส่งคำขอแล้ว ร้านจะยืนยันในไม่ช้า",
      bookingGone: "การจองนี้ไม่มีอยู่แล้ว",
      alreadyCancelled: "การจองนี้ถูกยกเลิกไปแล้ว",
      cannotCancel: "ไม่สามารถยกเลิกการจองนี้ได้แล้ว",
      cancelled: "ยกเลิกการจองแล้ว",
    },

    email: {
      bookingConfirmedSubject: "ยืนยันการจองแล้ว — {business}",
      bookingRequestedSubject: "ส่งคำขอจองแล้ว — {business}",
      newBookingSubject: "การจองใหม่ — {service}",
      bookingCancelledSubject: "ยกเลิกการจองแล้ว — {business}",
      cancelledOwnerSubject: "ยกเลิก — {service} ({customer})",
      youAreBookedHeading: "คุณถูกจองเรียบร้อยแล้ว",
      requestSentHeading: "ส่งคำขอแล้ว",
      newBookingHeading: "การจองใหม่",
      newBookingRequestHeading: "คำขอจองใหม่",
      bookingCancelledHeading: "ยกเลิกการจองแล้ว",
      confirmedIntro: "{business} บันทึกคิวของคุณไว้แล้วตามรายละเอียดด้านล่าง เวลาที่แสดงเป็นเวลาท้องถิ่นของร้าน ({timezone})",
      requestedIntro: "{business} ได้รับคำขอของคุณแล้วและจะยืนยันในไม่ช้า เวลาที่แสดงเป็นเวลาท้องถิ่นของร้าน ({timezone})",
      ownerNewBookingIntro: "{customer} จองบริการ {service} แล้ว",
      cancelledIntro: "การจองนี้ถูกยกเลิกแล้ว คิวนี้เปิดให้คนอื่นจองได้อีกครั้ง",
      rowService: "บริการ",
      rowWhen: "เมื่อไหร่",
      rowWhere: "ที่ไหน",
      rowPrice: "ราคา",
      rowCustomer: "ลูกค้า",
      rowPhone: "โทรศัพท์",
      rowWasBookedFor: "เคยจองไว้สำหรับ",
      rowBusiness: "ร้าน",
      rowCancellationPolicy: "นโยบายการยกเลิก/ไม่มาตามนัด",
      cancellationPolicyFallback: "ร้านนี้ยังไม่ได้ระบุนโยบายการยกเลิก — ติดต่อร้านโดยตรงหากต้องการเปลี่ยนแปลงหรือยกเลิก",
      phoneNotGiven: "ไม่ได้ระบุ",
      footerCustomerConfirmed: "ต้องเปลี่ยนแปลงใช่ไหม? เปิด ตัดนัด แล้วยกเลิกได้จาก “การจองของฉัน”",
      footerOwner: "เปิดแดชบอร์ด ตัดนัด ของคุณเพื่อยืนยัน เลื่อน หรือยกเลิกการจองนี้",
      footerCancelled: "จองผิดใช่ไหม? คุณสามารถจองใหม่ได้ทุกเมื่อผ่าน ตัดนัด",
    },
  },

  en: {
    localeToggle: { th: "TH", en: "English" },

    booking: {
      nothingToBookTitle: "Nothing to book just yet",
      nothingToBookDescription: "{name} has not published any services. Try again soon, or give them a call.",
      stepService: "Choose a service",
      stepStaff: "Choose your barber",
      anyAvailable: "Any available",
      anyAvailableHint: "We'll assign whoever's free.",
      stepDate: "Pick a day",
      stepTime: "Pick a time",
      checkingAvailability: "Checking availability…",
      loadingTimes: "Loading times…",
      noFreeTimesTitle: "No free times that day",
      noFreeTimesDescription: "They are closed or fully booked. Try another date on the calendar above.",
      review: "Review",
      signInToBook: "Sign in to book",
      previewOnly: "Preview only",
    },

    confirm: {
      title: "Confirm your booking",
      descriptionAuto: "Your slot is held as soon as you confirm.",
      descriptionManual: "{name} will review and confirm this request. Your slot is held in the meantime.",
      rowWhere: "Where",
      rowWhat: "What",
      rowStaff: "Barber",
      rowWhen: "When",
      rowPrice: "Price",
      paidAtShop: "Paid at the shop",
      notesLabel: "Anything they should know?",
      notesHint: "Optional — allergies, a preferred stylist, running late.",
      notesPlaceholder: "First time here, happy to take advice.",
      confirmButton: "Confirm booking",
      sendRequestButton: "Send request",
      bookedFallback: "Booked.",
      cancellationPolicyLabel: "Cancellation / no-show policy",
      cancellationPolicyFallback: "This shop hasn't published a cancellation policy yet — contact them directly for any change or cancellation.",
    },

    listing: {
      backAllPlaces: "All places",
      backToServices: "Back to your services",
      backToDashboard: "Your dashboard",
      ownerPreviewLiveTitle: "This is what customers see",
      ownerPreviewDraftTitle: "Preview — not published yet",
      ownerPreviewLiveBody: "Change a service's name, price, description or order under Services and it updates here straight away.",
      ownerPreviewDraftBody: "Only you can see this page. Publish it from Settings when you're ready to take bookings.",
      instantConfirmation: "Instant confirmation",
      confirmedByShop: "Confirmed by the shop",
      call: "Call",
      line: "LINE",
      cancellationPolicyHeading: "Cancellation / no-show policy",
      cancellationPolicyFallback: "This shop hasn't published a cancellation policy yet — contact them directly to ask.",
    },

    category: {
      barber: "Barber",
      salon: "Salon",
      spa: "Spa",
      clinic: "Clinic",
      fitness: "Fitness",
      event: "Events",
      other: "Other",
    },

    discover: {
      searchPlaceholder: "Search shops, services or areas",
      searchAriaLabel: "Search businesses",
      clearSearchAriaLabel: "Clear search",
      filterAriaLabel: "Filter by category",
      all: "All",
      locationBlocked: "Location blocked — sorting A–Z",
      sortNearest: "Sort by what's nearest",
      placeCountOne: "{n} place",
      placeCountMany: "{n} places",
      nearestFirstSuffix: " · nearest first",
      nothingMatchesTitle: "Nothing matches that",
      nothingMatchesDescription: "Try a different word, or clear the filters to see everything nearby.",
      clearFilters: "Clear filters",
      fromPrice: "from",
      serviceCountOne: "{n} service",
      serviceCountMany: "{n} services",
    },

    myBookings: {
      title: "My bookings",
      description: "Times are shown in each shop's own time zone.",
      upcoming: "Upcoming",
      history: "History",
      upcomingEmptyTitle: "Nothing booked yet",
      upcomingEmptyDescription: "When you book somewhere it shows up here, with directions and a one-tap cancel.",
      findAPlace: "Find a place",
      pastEmptyTitle: "No history yet",
      pastEmptyDescription: "Past and cancelled bookings collect here so you can rebook in a tap.",
    },

    toast: {
      incompleteBooking: "That booking request was incomplete. Please pick a time again.",
      signInToFinish: "Please sign in to finish booking.",
      businessCannotBook: "Business accounts cannot make bookings. Sign in as a customer.",
      businessNotTakingBookings: "That business is no longer taking bookings.",
      serviceUnavailable: "That service is no longer available.",
      slotTaken: "Sorry — that time was taken while you were choosing. Please pick another slot.",
      staffUnavailable: "That staff member isn't available on that day or time. Pick another staff member, or choose \"Any available\".",
      noStaffAvailable: "No staff member is available that day. Try another date.",
      bookedAutoConfirm: "Booked. You will get a confirmation email shortly.",
      bookedManualConfirm: "Request sent. The business will confirm shortly.",
      bookingGone: "That booking no longer exists.",
      alreadyCancelled: "That booking was already cancelled.",
      cannotCancel: "That booking can no longer be cancelled.",
      cancelled: "Booking cancelled.",
    },

    email: {
      bookingConfirmedSubject: "Booking confirmed — {business}",
      bookingRequestedSubject: "Booking requested — {business}",
      newBookingSubject: "New booking — {service}",
      bookingCancelledSubject: "Booking cancelled — {business}",
      cancelledOwnerSubject: "Cancelled — {service} ({customer})",
      youAreBookedHeading: "You're booked in",
      requestSentHeading: "Request sent",
      newBookingHeading: "New booking",
      newBookingRequestHeading: "New booking request",
      bookingCancelledHeading: "Booking cancelled",
      confirmedIntro: "{business} has you down for the slot below. Times are shown in the shop's local time ({timezone}).",
      requestedIntro: "{business} has your request and will confirm shortly. Times are shown in the shop's local time ({timezone}).",
      ownerNewBookingIntro: "{customer} booked {service}.",
      cancelledIntro: "This appointment has been cancelled. The slot is free again for anyone to book.",
      rowService: "Service",
      rowWhen: "When",
      rowWhere: "Where",
      rowPrice: "Price",
      rowCustomer: "Customer",
      rowPhone: "Phone",
      rowWasBookedFor: "Was booked for",
      rowBusiness: "Business",
      rowCancellationPolicy: "Cancellation / no-show policy",
      cancellationPolicyFallback: "This shop hasn't published a cancellation policy yet — contact them directly for any change or cancellation.",
      phoneNotGiven: "Not given",
      footerCustomerConfirmed: "Need to change it? Open TatNat and cancel from My bookings.",
      footerOwner: "Open your TatNat dashboard to confirm, move or cancel this booking.",
      footerCancelled: "Booked by mistake? You can rebook any time from TatNat.",
    },
  },
} as const;

type Dict = typeof dictionaries.th;

function lookup(locale: Locale, key: string): string | undefined {
  const parts = key.split(".");
  let node: unknown = dictionaries[locale];
  for (const part of parts) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * `t("th", "confirm.title")`, or with simple `{name}`-style interpolation:
 * `t("th", "booking.nothingToBookDescription", { name: business.name })`.
 *
 * Falls back to English, then to the raw key, so a missing translation is
 * visible in the UI (a key-looking string) rather than a blank — easier for
 * QA to spot than a silent empty label.
 */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const raw = lookup(locale, key) ?? (locale !== "en" ? lookup("en", key) : undefined) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function categoryLabel(category: keyof Dict["category"], locale: Locale): string {
  return t(locale, `category.${category}`);
}

export function pluralCount(
  locale: Locale,
  n: number,
  oneKey: string,
  manyKey: string,
): string {
  return t(locale, n === 1 ? oneKey : manyKey, { n });
}

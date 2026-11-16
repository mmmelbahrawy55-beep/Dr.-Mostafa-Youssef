import type { CustomerDetail, PaymentDTO, SubscriptionDTO } from "../../shared/types";

/**
 * Builds a real, downloadable A4 PDF of a customer's statement without any
 * server-side PDF library or embedded Arabic font: every page is rendered by
 * the browser on a canvas (so Arabic shaping, RTL and the site fonts are
 * correct) and the JPEG pages are wrapped in a minimal PDF container.
 */

const PT_W = 595.28;
const PT_H = 841.89;
const SCALE = 2;
const W = Math.round(PT_W * SCALE);
const H = Math.round(PT_H * SCALE);
const MARGIN = 40 * SCALE;
const CONTENT_W = W - MARGIN * 2;
const BOTTOM = H - 38 * SCALE;
const FONT = `"Segoe UI", Tahoma, "Noto Kufi Arabic", Arial, sans-serif`;

type Direction = "rtl" | "ltr";
type Align = "right" | "left" | "center";

interface TextOptions {
  size?: number;
  weight?: number;
  color?: string;
  dir?: Direction;
  align?: Align;
  lineHeight?: number;
  gap?: number;
}

const px = (value: number) => value * SCALE;

const num = (value: number) => new Intl.NumberFormat("en-US").format(value);

const money = (value: number) => `${num(value)} ج.م`;

const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("ar-EG", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const dateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("ar-EG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

const STATUS: Record<string, string> = {
  active: "نشط",
  expired: "منتهي",
  cancelled: "ملغي",
  auto_approved: "تم التحقق تلقائيًا",
  approved: "مقبول",
  pending: "قيد المراجعة",
  rejected: "مرفوض",
};

const KIND: Record<string, string> = {
  image: "صورة",
  video: "فيديو",
  pdf: "PDF",
  file: "ملف",
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";

  const pushLongWord = (word: string) => {
    let chunk = "";
    for (const char of word) {
      const candidate = chunk + char;
      if (chunk && ctx.measureText(candidate).width > maxWidth) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = candidate;
      }
    }
    line = chunk;
  };

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      if (ctx.measureText(word).width > maxWidth) pushLongWord(word);
      else line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

class Report {
  private pages: HTMLCanvasElement[] = [];
  private ctx!: CanvasRenderingContext2D;
  private y = MARGIN;
  private generatedAt = dateTime(new Date().toISOString());

  constructor(private readonly detail: CustomerDetail) {}

  private newPage() {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "top";
    this.pages.push(canvas);
    this.ctx = ctx;
    this.y = MARGIN;
  }

  private ensure(height: number) {
    if (this.y + height > BOTTOM) this.newPage();
  }

  private setFont(size: number, weight = 400) {
    this.ctx.font = `${weight} ${px(size)}px ${FONT}`;
  }

  private text(value: string, options: TextOptions = {}) {
    const { size = 10.5, weight = 400, color = "#1c2115", dir = "rtl", align, lineHeight = 1.6, gap = 8 } = options;
    this.setFont(size, weight);
    this.ctx.direction = dir;
    this.ctx.fillStyle = color;
    const resolved: Align = align ?? (dir === "rtl" ? "right" : "left");
    this.ctx.textAlign = resolved;
    const x = resolved === "left" ? MARGIN : resolved === "center" ? W / 2 : W - MARGIN;
    const lines = wrap(this.ctx, value, CONTENT_W);
    const height = lines.length * px(size) * lineHeight;
    this.ensure(height + px(gap));
    for (const line of lines) {
      this.ctx.fillText(line, x, this.y);
      this.y += px(size) * lineHeight;
    }
    this.y += px(gap);
  }

  private section(title: string) {
    this.ensure(px(38));
    this.y += px(5);
    this.ctx.fillStyle = "#d4ff3f";
    this.ctx.fillRect(W - MARGIN - px(3), this.y, px(3), px(17));
    this.setFont(12.5, 700);
    this.ctx.direction = "rtl";
    this.ctx.textAlign = "right";
    this.ctx.fillStyle = "#11150d";
    this.ctx.fillText(title, W - MARGIN - px(10), this.y);
    this.y += px(30);
  }

  private info(label: string, value: string, dir: Direction = "rtl") {
    const labelW = px(120);
    const valueX = W - MARGIN - labelW - px(10);
    const valueWidth = CONTENT_W - labelW - px(10);
    this.setFont(10.5, 400);
    this.ctx.direction = dir;
    const lines = wrap(this.ctx, value, valueWidth);
    const height = Math.max(px(20), lines.length * px(10.5) * 1.55);
    this.ensure(height + px(8));
    this.setFont(10, 400);
    this.ctx.direction = "rtl";
    this.ctx.textAlign = "right";
    this.ctx.fillStyle = "#6b7160";
    this.ctx.fillText(label, W - MARGIN, this.y + px(1));
    this.setFont(10.5, 700);
    this.ctx.direction = dir;
    this.ctx.fillStyle = "#11150d";
    let lineY = this.y;
    for (const line of lines) {
      this.ctx.fillText(line, valueX, lineY);
      lineY += px(10.5) * 1.55;
    }
    this.y += height + px(8);
    this.ctx.fillStyle = "#e7e9df";
    this.ctx.fillRect(W - MARGIN - CONTENT_W, this.y - px(2), CONTENT_W, 1);
  }

  private cards(items: { label: string; value: string }[]) {
    const gap = px(8);
    const cardW = (CONTENT_W - gap * (items.length - 1)) / items.length;
    const cardH = px(64);
    this.ensure(cardH + px(18));
    let x = W - MARGIN;
    for (const item of items) {
      x -= cardW;
      this.ctx.fillStyle = "#f6f8ee";
      this.ctx.fillRect(x, this.y, cardW, cardH);
      this.ctx.strokeStyle = "#e1e6d2";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x + 0.5, this.y + 0.5, cardW - 1, cardH - 1);
      this.ctx.textAlign = "center";
      this.ctx.direction = "ltr";
      this.ctx.fillStyle = "#11150d";
      this.ctx.font = `700 ${px(18)}px ${FONT}`;
      this.ctx.fillText(item.value, x + cardW / 2, this.y + px(12));
      this.ctx.font = `400 ${px(9)}px ${FONT}`;
      this.ctx.direction = "rtl";
      this.ctx.fillStyle = "#6b7160";
      this.ctx.fillText(item.label, x + cardW / 2, this.y + px(40));
      x -= gap;
    }
    this.y += cardH + px(18);
  }

  private table(headers: string[], rows: string[][], weights: number[]) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map((weight) => (CONTENT_W * weight) / total);
    const columns: { x: number; width: number }[] = [];
    let x = W - MARGIN;
    for (const width of widths) {
      columns.push({ x: x - width, width });
      x -= width;
    }

    const drawHeader = () => {
      this.ensure(px(32));
      let cursor = W - MARGIN;
      this.ctx.fillStyle = "#eef2e0";
      this.ctx.fillRect(W - MARGIN - CONTENT_W, this.y, CONTENT_W, px(26));
      for (const [index, header] of headers.entries()) {
        const width = widths[index];
        cursor -= width;
        this.ctx.strokeStyle = "#d9dfc6";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(cursor + 0.5, this.y + 0.5, width - 1, px(26) - 1);
        this.ctx.direction = "rtl";
        this.ctx.textAlign = "right";
        this.ctx.fillStyle = "#31371f";
        this.ctx.font = `700 ${px(9)}px ${FONT}`;
        this.ctx.fillText(header, cursor + width - px(5), this.y + px(8));
      }
      this.y += px(26);
    };

    drawHeader();

    for (const row of rows) {
      this.setFont(9, 400);
      const cellLines = row.map((cell, index) => wrap(this.ctx, cell, widths[index] - px(10)));
      const lineCount = Math.max(1, ...cellLines.map((lines) => lines.length));
      const rowH = lineCount * px(9) * 1.5 + px(10);
      if (this.y + rowH > BOTTOM) {
        this.newPage();
        drawHeader();
      }
      let cursor = W - MARGIN;
      for (let index = 0; index < row.length; index += 1) {
        const width = widths[index];
        cursor -= width;
        this.ctx.strokeStyle = "#e0e4d6";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(cursor + 0.5, this.y + 0.5, width - 1, rowH - 1);
        this.setFont(9, 400);
        this.ctx.direction = "rtl";
        this.ctx.textAlign = "right";
        this.ctx.fillStyle = "#1c2115";
        const lines = cellLines[index];
        let lineY = this.y + px(5);
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(cursor, this.y, width, rowH);
        this.ctx.clip();
        for (const line of lines) {
          this.ctx.fillText(line, cursor + width - px(5), lineY);
          lineY += px(9) * 1.5;
        }
        this.ctx.restore();
      }
      this.y += rowH;
    }
    this.y += px(8);
  }

  private drawCover() {
    this.newPage();
    const ctx = this.ctx;
    ctx.fillStyle = "#0b0d08";
    ctx.fillRect(0, 0, W, px(78));
    ctx.fillStyle = "#d4ff3f";
    ctx.fillRect(0, px(78), W, px(2.5));

    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${px(20)}px ${FONT}`;
    ctx.fillText("بيان العميل", W - MARGIN, px(18));
    ctx.fillStyle = "#d4ff3f";
    ctx.font = `600 ${px(9.5)}px ${FONT}`;
    ctx.fillText("د. مصطفى يوسف — استشاري تغذية علاجية ومدرب لياقة", W - MARGIN, px(48));
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = `400 ${px(8.5)}px ${FONT}`;
    ctx.fillText(`تم الإنشاء في ${this.generatedAt}`, W - MARGIN, px(63));

    ctx.direction = "ltr";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${px(18)}px ${FONT}`;
    ctx.fillText("MY", MARGIN, px(20));
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `400 ${px(7)}px ${FONT}`;
    ctx.fillText("DR MOSTAFA YOUSSEF", MARGIN, px(47));
    ctx.fillText("CLIENT STATEMENT", MARGIN, px(58));

    this.y = px(100);
  }

  render(): HTMLCanvasElement[] {
    const { customer, stats, currentProgram, subscriptions, payments, files, sessions, activity, coachMessages, contactMessages } =
      this.detail;

    this.drawCover();

    this.section("بيانات العميل");
    this.info("الاسم", customer.name);
    this.info("كود العميل", `#${customer.id}`, "ltr");
    this.info("الإيميل", customer.email || "—", "ltr");
    this.info("الموبايل", customer.phone || "—", "ltr");
    this.info("تاريخ التسجيل", date(customer.createdAt));
    this.info("حالة الحساب", customer.blocked ? "موقوف" : "نشط");
    this.info("آخر ظهور", dateTime(stats.lastSeen));

    this.section("ملخص سريع");
    this.cards([
      { label: "اشتراكات نشطة", value: String(stats.activeSubscriptions) },
      { label: "إجمالي المدفوع", value: money(stats.totalSpent) },
      { label: "مدفوعات معلقة", value: String(stats.pendingPayments) },
      { label: "ملفات من الدكتور", value: String(files.length) },
    ]);
    this.cards([
      { label: "إجمالي الاشتراكات", value: String(stats.totalSubscriptions) },
      { label: "رسائل المحادثة", value: String(coachMessages.length) },
      { label: "رسائل التواصل", value: String(contactMessages.length) },
      { label: "أجهزة مسجلة", value: String(stats.sessions) },
    ]);

    if (currentProgram) {
      this.section("الباقة الحالية");
      this.info("الباقة", currentProgram.name);
      this.info("من", date(currentProgram.startsAt));
      this.info("إلى", date(currentProgram.endsAt));
      this.info("المتبقي", `${currentProgram.daysLeft} يوم من ${currentProgram.totalDays}`);
      this.info("التقدم", `${currentProgram.progress}% — ${currentProgram.weeks} أسبوع · ${currentProgram.workouts} تمرين · ${currentProgram.meals} وجبة`);
    }

    this.section("الاشتراكات");
    if (subscriptions.length === 0) {
      this.text("مفيش اشتراكات مسجلة.", { color: "#7b8170", size: 10 });
    } else {
      this.table(
        ["الباقة", "البداية", "النهاية", "الحالة"],
        subscriptions.map((entry: SubscriptionDTO) => [
          entry.programName,
          date(entry.startsAt),
          date(entry.endsAt),
          STATUS[entry.status] ?? entry.status,
        ]),
        [0.42, 0.2, 0.2, 0.18]
      );
    }

    this.section("المدفوعات");
    if (payments.length === 0) {
      this.text("مفيش مدفوعات مسجلة.", { color: "#7b8170", size: 10 });
    } else {
      this.table(
        ["#", "الباقة", "المبلغ", "الطريقة", "الحالة", "التاريخ"],
        payments.map((entry: PaymentDTO) => [
          String(entry.id),
          entry.programName,
          num(entry.amount) + " ج.م",
          entry.method === "vodafone" ? "فودافون كاش" : "إنستاباي",
          STATUS[entry.status] ?? entry.status,
          date(entry.createdAt),
        ]),
        [0.07, 0.25, 0.13, 0.14, 0.2, 0.21]
      );
    }

    this.section("ملفات العميل");
    if (files.length === 0) {
      this.text("مفيش ملفات مرفوعة للعميل.", { color: "#7b8170", size: 10 });
    } else {
      this.table(
        ["الملف", "النوع", "التاريخ"],
        files.map((asset) => [asset.title || asset.filename, KIND[asset.kind] ?? asset.kind, date(asset.createdAt)]),
        [0.58, 0.17, 0.25]
      );
    }

    this.section("الأجهزة والجلسات");
    if (sessions.length === 0) {
      this.text("مفيش أجهزة مسجلة.", { color: "#7b8170", size: 10 });
    } else {
      this.table(
        ["IP", "آخر ظهور", "الجهاز"],
        sessions.slice(0, 8).map((session) => [
          session.ip || "غير معروف",
          dateTime(session.lastSeen),
          session.userAgent.slice(0, 54),
        ]),
        [0.22, 0.26, 0.52]
      );
    }

    this.section("آخر النشاط");
    if (activity.length === 0) {
      this.text("مفيش نشاط مسجل.", { color: "#7b8170", size: 10 });
    } else {
      for (const entry of activity.slice(0, 16)) {
        this.setFont(9.5, 700);
        const titleLines = wrap(this.ctx, entry.title, CONTENT_W - px(90));
        this.setFont(9, 400);
        const detailLines = entry.detail ? wrap(this.ctx, entry.detail, CONTENT_W - px(90)) : [];
        const height = (titleLines.length + detailLines.length) * px(9) * 1.5 + px(12);
        this.ensure(height);
        this.setFont(8.5, 400);
        this.ctx.direction = "rtl";
        this.ctx.textAlign = "right";
        this.ctx.fillStyle = "#7b8170";
        this.ctx.fillText(date(entry.at), W - MARGIN, this.y + px(1));
        this.setFont(9.5, 700);
        this.ctx.fillStyle = "#1c2115";
        let lineY = this.y;
        for (const line of titleLines) {
          this.ctx.fillText(line, W - MARGIN - px(78), lineY);
          lineY += px(9) * 1.5;
        }
        this.setFont(9, 400);
        this.ctx.fillStyle = "#5c6253";
        for (const line of detailLines) {
          this.ctx.fillText(line, W - MARGIN - px(78), lineY);
          lineY += px(9) * 1.5;
        }
        this.y = lineY + px(8);
        this.ctx.fillStyle = "#eceee6";
        this.ctx.fillRect(W - MARGIN - CONTENT_W, this.y - px(3), CONTENT_W, 1);
      }
    }

    this.y += px(6);
    this.text(
      "البيان ده مستخرج من حساب العميل على الموقع، وبياناته محدثة لحظة التحميل. أي تعديل لاحق على الحساب مش هيظهر في النسخة دي.",
      { size: 8.5, color: "#7b8170", lineHeight: 1.7 }
    );

    this.pages.forEach((canvas, index) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.font = `400 ${px(8)}px ${FONT}`;
      ctx.fillStyle = "#8b917f";
      ctx.fillText(`صفحة ${index + 1} من ${this.pages.length}`, W - MARGIN, H - px(26));
      ctx.direction = "ltr";
      ctx.textAlign = "left";
      ctx.fillText(`Dr. Mostafa Youssef · ${this.generatedAt}`, MARGIN, H - px(26));
    });

    return this.pages;
  }
}

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("تعذر تجهيز صفحات الـ PDF.");
  return new Uint8Array(await blob.arrayBuffer());
}

async function buildPdf(pages: HTMLCanvasElement[]): Promise<Blob> {
  const images: { data: Uint8Array; width: number; height: number }[] = [];
  for (const page of pages) {
    images.push({ data: await canvasToJpeg(page), width: page.width, height: page.height });
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;

  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    size += bytes.length;
  };
  const textBytes = (value: string) => encoder.encode(value);
  const object = (id: number, parts: (string | Uint8Array)[]) => {
    offsets[id] = size;
    for (const part of parts) push(typeof part === "string" ? textBytes(part) : part);
  };

  push(textBytes("%PDF-1.4\n"));

  const pageIds = images.map((_, index) => 3 + index * 3);
  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");

  object(1, ["1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"]);
  object(2, [`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${images.length} >>\nendobj\n`]);

  images.forEach((image, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const content = `q\n${PT_W} 0 0 ${PT_H} 0 0 cm\n/Im0 Do\nQ\n`;

    object(pageId, [
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PT_W} ${PT_H}] /Resources << /XObject << /Im0 ${imageId} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${contentId} 0 R >>\nendobj\n`,
    ]);
    object(contentId, [
      `${contentId} 0 obj\n<< /Length ${textBytes(content).length} >>\nstream\n`,
      content,
      "endstream\nendobj\n",
    ]);
    object(imageId, [
      `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`,
      image.data,
      "\nendstream\nendobj\n",
    ]);
  });

  const total = 2 + images.length * 3;
  const xrefStart = size;
  push(textBytes(`xref\n0 ${total + 1}\n0000000000 65535 f\r\n`));
  for (let id = 1; id <= total; id += 1) {
    push(textBytes(`${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n\r\n`));
  }
  push(textBytes(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`));

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

/** Generates and downloads `<customer-name>-statement.pdf`. */
export async function downloadCustomerPdf(detail: CustomerDetail): Promise<void> {
  if (typeof document === "undefined") throw new Error("PDF download needs a browser.");
  await document.fonts?.ready;
  const pages = new Report(detail).render();
  const pdf = await buildPdf(pages);
  const url = URL.createObjectURL(pdf);
  const link = document.createElement("a");
  const safeName = detail.customer.name.replace(/[\\/:*?"<>|]/g, "").trim() || `customer-${detail.customer.id}`;
  link.href = url;
  link.download = `${safeName}-statement.pdf`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 20_000);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "edge";

// Import types from the centralized types file
import {
  Teacher,
  Room,
  Subject,
  Homework,
  ScheduleItem,
  DaySchedule,
  WeekSchedule,
  Module,
  Student,
  StudentGroups,
  ScheduleSummary,
  LectioScheduleResponse as ScheduleResponse,
} from "../types/lectio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const commonHeaders = {
  "user-agent": UA,
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7",
  "upgrade-insecure-requests": "1",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "navigate",
  "sec-fetch-dest": "document",
  "accept-encoding": "gzip, deflate, br", // make sure you can decode it
};

// Simple timing utility for debugging performance
interface TimingRecord {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class Timer {
  private records: TimingRecord[] = [];

  start(name: string): void {
    this.records.push({
      name,
      startTime: performance.now(),
    });
  }

  end(name: string): number {
    const record = this.records.find((r) => r.name === name && !r.endTime);
    if (record) {
      record.endTime = performance.now();
      record.duration = record.endTime - record.startTime;
      return record.duration;
    }
    return 0;
  }

  getSummary(): string {
    const completed = this.records.filter((r) => r.duration !== undefined);
    let summary = "\n🕐 TIMING SUMMARY\n";
    summary += "═══════════════════════════════════════\n";

    let totalTime = 0;
    completed.forEach((record) => {
      const duration = record.duration!;
      totalTime += duration;
      summary += `${record.name}: ${duration.toFixed(2)}ms\n`;
    });

    summary += `──────────────────────────────────────\n`;
    summary += `Total Time: ${totalTime.toFixed(2)}ms\n`;
    summary += "═══════════════════════════════════════\n";

    return summary;
  }

  reset(): void {
    this.records = [];
  }
}

const LECTIO_BASE = "https://www.lectio.dk";

/**
 * Expect the Lectio session cookie via:
 *  - Authorization: Bearer <base64(cookieHeader)>
 *  - or header x-lectio-cookie: <raw cookie header>
 */
function readCookie(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    console.log("Bearer cookie found");
    try {
      const b64 = auth.slice("Bearer ".length).trim();
      console.log("b64", b64);
      const decoded = atob(b64);
      // Validate that the decoded cookie contains only valid header characters
      if (!/^[\x20-\x7E]*$/.test(decoded)) {
        throw new Error("Invalid characters in decoded cookie");
      }
      console.log("decoded", decoded);
      return decoded;
    } catch {
      console.log("Bearer cookie failed");
      // fall through
    }
  }
  const raw = req.headers.get("x-lectio-cookie");
  console.log("x-lectio-cookie", raw);
  if (raw && !/^[\x20-\x7E]*$/.test(raw)) {
    return null; // Invalid characters in raw cookie
  }
  return raw ?? null;
}

function readSessionCookie(req: Request): string | null {
  const raw = req.headers.get("x-lectio-session");
  console.log("x-lectio-session", raw);
  return raw ?? null;
}

/** Simple stable hash (FNV-1a) for small payloads */
function hash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // return as 8-hex, good enough for ETag
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

/**
 * Build the Lectio URL. If you already know gym/student, you can hit the
 * explicit Skema URL. If not, rely on the cookie’s default landing.
 *
 * Example explicit path (if you know them):
 *   /lectio/{gymId}/SkemaNy.aspx?type=elev&elevid={studentId}&week={week}
 */
function buildLectioUrl(week: string | null, gymId: string): string {
  const params = new URLSearchParams();
  if (week) params.set("week", week);
  // Conservative default: user’s schedule landing (cookie-based session).
  // Replace with explicit SkemaNy.aspx if you have gymId/elevid on the client.
  const basePath = `/lectio/${gymId}/SkemaNy.aspx`;
  const q = params.toString();
  return `${LECTIO_BASE}${basePath}${q ? `?${q}` : ""}`;
}

/**
 * Lightweight Lectio schedule parser for edge runtime
 * Extracts full schedule using regex patterns without DOM parsing
 */
function parseLectioSchedule(
  html: string,
  tz: string,
  timer: Timer
): WeekSchedule {
  try {
    timer.start("parsing-total");

    // Extract week info
    timer.start("extract-week-info");
    const weekInfo = extractWeekInfo(html);
    timer.end("extract-week-info");

    timer.start("extract-student-info");
    const studentInfo = extractStudentInfo(html);
    timer.end("extract-student-info");

    timer.start("extract-school-info");
    const schoolInfo = extractSchoolInfo(html);
    timer.end("extract-school-info");

    timer.start("extract-modules");
    const modules = extractModules(html);
    timer.end("extract-modules");

    timer.start("extract-days");
    const days = extractDays(html, weekInfo.year);
    timer.end("extract-days");

    timer.start("extract-student-groups");
    const studentGroups = extractStudentGroups(html);
    timer.end("extract-student-groups");

    timer.start("generate-summary");
    const summary = generateSummary(days);
    timer.end("generate-summary");

    timer.end("parsing-total");

    return {
      weekNumber: weekInfo.weekNumber,
      year: weekInfo.year,
      weekRange: weekInfo.weekRange,
      student: studentInfo,
      school: schoolInfo,
      days,
      modules,
      studentGroups,
      summary,
    };
  } catch (err) {
    console.error("Parse error:", err);
    throw new Error("PARSE_ERROR");
  }
}

function extractWeekInfo(html: string) {
  const weekMatch = html.match(/Uge (\d+) - (\d+)/);
  const weekNumber = weekMatch ? parseInt(weekMatch[1]) : 0;
  const year = weekMatch ? parseInt(weekMatch[2]) : new Date().getFullYear();

  const datePickerMatch = html.match(/datePicker_tb[^>]*value='([^']+)'/);
  const weekRange = datePickerMatch
    ? datePickerMatch[1]
    : `Uge ${weekNumber} (${year})`;

  return { weekNumber, year, weekRange };
}

function extractStudentInfo(html: string) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    const title = titleMatch[1];
    const match = title.match(/(.+?)\(k\), (.+?) - Skema/);
    if (match) {
      return {
        name: match[1].trim(),
        class: match[2].trim(),
      };
    }
  }
  return { name: "", class: "" };
}

function extractSchoolInfo(html: string): string {
  const schoolMatch = html.match(
    /ls-master-header-institution-name[^>]*>([^<]+)</
  );
  return schoolMatch ? schoolMatch[1].trim() : "";
}

function extractModules(html: string) {
  const modules: { number: number; name: string; timeRange: string }[] = [];
  const moduleRegex =
    /s2module-info[^>]*>[\s\S]*?<div[^>]*>([^<]+)<br[^>]*>([^<]+)/g;
  let match;
  let moduleNumber = 1;

  while ((match = moduleRegex.exec(html)) !== null) {
    modules.push({
      number: moduleNumber++,
      name: match[1].trim(),
      timeRange: match[2].trim(),
    });
  }

  return modules;
}

function extractDays(html: string, year: number): DaySchedule[] {
  const days: DaySchedule[] = [];

  // First, find the s2dayHeader row and extract all day headers from it
  const dayHeaderRowRegex =
    /<tr[^>]*class="s2dayHeader[^"]*"[^>]*>([\s\S]*?)<\/tr>/;
  const dayHeaderRowMatch = html.match(dayHeaderRowRegex);

  const dayHeaders: string[] = [];

  if (dayHeaderRowMatch) {
    const dayHeaderRow = dayHeaderRowMatch[1];
    // Extract all <td> elements within the day header row
    const tdRegex = /<td[^>]*>([^<]+)<\/td>/g;
    let match;

    while ((match = tdRegex.exec(dayHeaderRow)) !== null) {
      const dayText = match[1].trim();
      // Skip empty cells and module headers
      if (dayText && !dayText.includes("Modul") && dayText !== "") {
        dayHeaders.push(dayText);
      }
    }
  }

  // Process each day
  for (let i = 0; i < dayHeaders.length; i++) {
    const dayText = dayHeaders[i];
    const dateMatch = dayText.match(/(\w+) \((\d+\/\d+)\)/);

    if (dateMatch) {
      let dayName = dateMatch[1];
      const date = dateMatch[2];

      // Fix truncated weekend names
      if (dayName === "rdag") dayName = "Lørdag";
      if (dayName === "ndag") dayName = "Søndag";

      const items = extractDayItems(html, date, year);
      const isWeekend = dayName === "Lørdag" || dayName === "Søndag";

      days.push({ date, dayName, items, isWeekend });
    }
  }

  return days;
}

function extractDayItems(
  html: string,
  date: string,
  year: number
): ScheduleItem[] {
  const items: ScheduleItem[] = [];

  // Extract regular schedule items
  const scheduleBlockRegex =
    /data-brikid='([^']+)'[^>]*data-tooltip='([^']*(?:\n[^']*)*?)'\s+data-menu-items/g;
  let match;

  while ((match = scheduleBlockRegex.exec(html)) !== null) {
    const activityId = match[1];
    const tooltip = match[2].replace(/''/g, "'");

    if (!tooltip) continue;

    const scheduleItem = parseTooltipContent(tooltip, activityId, year);
    if (scheduleItem && scheduleItem.date.includes(date.split("/")[0])) {
      items.push(scheduleItem);
    }
  }

  // Extract info header events
  const infoHeaderRegex =
    /s2infoHeader[^>]*>[\s\S]*?data-tooltip='([^']*(?:''[^']*)*)'[\s\S]*?<\/td>/g;
  while ((match = infoHeaderRegex.exec(html)) !== null) {
    const tooltip = match[1].replace(/''/g, "'");
    if (tooltip && (tooltip.includes("Frist") || tooltip.includes("dag"))) {
      const eventItem = parseTooltipContent(tooltip, undefined, year);
      if (eventItem && eventItem.date.includes(date.split("/")[0])) {
        items.push(eventItem);
      }
    }
  }

  return items;
}

function extractStudentGroups(html: string) {
  const subjects: string[] = [];
  const involvedGroups: string[] = [];
  const ownGroups: string[] = [];

  const holdListRegex = /holdElementLinkList[\s\S]*?<\/table>/;
  const holdMatch = html.match(holdListRegex);

  if (holdMatch) {
    const holdSection = holdMatch[0];
    const linkRegex = /<a[^>]*>([^<]+)<\/a>/g;
    let linkMatch;

    while ((linkMatch = linkRegex.exec(holdSection)) !== null) {
      const text = linkMatch[1].trim();
      if (text && !text.includes("Hold:") && !text.includes("grupper:")) {
        subjects.push(text);
      }
    }
  }

  return { subjects, involvedGroups, ownGroups };
}

function generateSummary(days: DaySchedule[]) {
  let totalClasses = 0,
    totalHomework = 0,
    changedClasses = 0,
    cancelledClasses = 0,
    specialEvents = 0,
    deadlines = 0;

  days.forEach((day) => {
    day.items.forEach((item) => {
      if (item.type === "class") {
        totalClasses++;
        if (item.homework?.length) totalHomework += item.homework.length;
        if (item.status === "changed") changedClasses++;
        if (item.status === "cancelled") cancelledClasses++;
      } else if (item.type === "event") {
        specialEvents++;
      } else if (item.type === "deadline") {
        deadlines++;
      }
    });
  });

  return {
    totalClasses,
    totalHomework,
    changedClasses,
    cancelledClasses,
    specialEvents,
    deadlines,
  };
}

/**
 * Parse tooltip content into schedule item
 */
function parseTooltipContent(
  tooltip: string,
  activityId: string | undefined,
  year: number
): ScheduleItem | null {
  try {
    const lines = tooltip
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);
    if (lines.length === 0) return null;

    let startTime = "";
    let endTime = "";
    let date = "";
    let subject = "";
    let teacher = "";
    let teacherInitials = "";
    let room = "";
    let topic = "";

    // Check if first line is a topic/title
    if (
      lines.length > 0 &&
      !lines[0].includes("til") &&
      !lines[0].includes("/") &&
      !lines[0].includes("Hold:") &&
      !lines[0].includes("Lærer:") &&
      !lines[0].includes("Lokale:")
    ) {
      topic = lines[0];
    }

    for (const line of lines) {
      // Parse time and date
      const timeMatch = line.match(
        /(\d+\/\d+-\d+)\s+(\d+:\d+)\s+til\s+(\d+:\d+)/
      );
      if (timeMatch) {
        date = timeMatch[1];
        startTime = timeMatch[2];
        endTime = timeMatch[3];
        continue;
      }

      // Handle "Hele dagen" events
      if (line.includes("Hele dagen")) {
        const dateMatch = lines.find((l) => l.match(/\d+\/\d+-\d+/));
        if (dateMatch) {
          const dm = dateMatch.match(/(\d+\/\d+-\d+)/);
          if (dm) date = dm[1];
        }
        startTime = "08:00";
        endTime = "17:00";
        continue;
      }

      // Parse subject
      if (line.startsWith("Hold:")) {
        subject = line.replace("Hold:", "").trim();
        continue;
      }

      // Parse teacher
      const teacherMatch = line.match(/Lærer:\s*(.+?)\s*\((.+?)\)/);
      if (teacherMatch) {
        teacher = teacherMatch[1];
        teacherInitials = teacherMatch[2];
        continue;
      }

      // Parse room
      if (line.startsWith("Lokale:")) {
        room = line.replace("Lokale:", "").trim();
        continue;
      }
    }

    // If no subject found in tooltip, use topic as subject
    if (!subject && topic) {
      subject = topic;
    }

    // Skip if no essential data
    if (!subject || (!startTime && !endTime)) {
      return null;
    }

    // Determine module number based on start time
    let module = 0;
    if (startTime) {
      const hour = parseInt(startTime.split(":")[0]);
      if (hour < 10) module = 1;
      else if (hour < 12) module = 2;
      else if (hour < 14) module = 3;
      else if (hour < 16) module = 4;
      else module = 5;
    }

    // Determine type
    let type: "class" | "event" | "deadline" = "class";
    if (tooltip.includes("Frist") || tooltip.includes("deadline")) {
      type = "deadline";
    } else if (tooltip.includes("dag") && !subject.includes("1g")) {
      type = "event";
    }

    // Parse homework if present
    const homework: Homework[] = [];
    const homeworkMatch = tooltip.match(/Lektier:[\s\S]*?(?=Note:|$)/);
    if (homeworkMatch) {
      const homeworkText = homeworkMatch[0];
      const homeworkLines = homeworkText.split("\n").slice(1);
      homeworkLines.forEach((line) => {
        if (line.trim().startsWith("-")) {
          homework.push({ description: line.trim().substring(1).trim() });
        }
      });
    }

    // Parse notes
    const noteMatch = tooltip.match(/Note:\s*([\s\S]*?)$/);
    const notes = noteMatch ? noteMatch[1].trim() : undefined;

    return {
      id: activityId,
      activityId,
      subject: { name: subject, code: subject },
      teacher: { name: teacher, initials: teacherInitials },
      room: { name: room },
      startTime,
      endTime,
      date,
      module,
      status: "normal", // TODO: detect changed/cancelled from CSS classes
      homework: homework.length > 0 ? homework : undefined,
      notes,
      title: type === "event" || type === "deadline" ? subject : undefined,
      topic,
      type,
    };
  } catch (err) {
    console.error("Tooltip parse error:", err);
    return null;
  }
}

/** Main handler */
export async function GET(req: Request): Promise<Response> {
  const timer = new Timer();

  try {
    timer.start("request-total");

    timer.start("url-parsing");
    const url = new URL(req.url);
    const week = url.searchParams.get("week"); // optional ISO week number
    const gymId = url.searchParams.get("gymId");
    timer.end("url-parsing");

    timer.start("cookie-reading");
    // const cookie = readCookie(req);
    const sessionCookieRaw = readSessionCookie(req);
    timer.end("cookie-reading");

    // if (!cookie) {
    //   console.log(timer.getSummary());
    //   return json(
    //     {
    //       error:
    //         "Missing or invalid access token (cookie). Ensure cookie contains only printable ASCII characters.",
    //     },
    //     401
    //   );
    // }
    const cookie = null;

    if (!gymId) {
      console.log(timer.getSummary());
      return json({ error: "Missing gymId." }, 400);
    }

    timer.start("url-building");
    // If we have the session cookie, we also set the session cookie
    const sessionCookie = sessionCookieRaw
      ? `ASP.NET_SessionId=${sessionCookieRaw}; isloggedin3=Y`
      : "";

    const autologinCookie = cookie ? `autologinkeyV2=${cookie}; ` : "";

    // Build target URL and fetch
    const target = buildLectioUrl(week, gymId);
    timer.end("url-building");

    timer.start("lectio-fetch");
    const resp = await fetch(target, {
      method: "GET",
      headers: {
        // Be a polite client
        Connection: "keep-alive",
        "Sec-GPC": "1",
        DNT: "1",
        TE: "trailers",
        ...commonHeaders,
        Cookie: `${autologinCookie}${sessionCookie}`,
      },
      // Tight timeouts via fetch options are limited in edge; rely on platform limits.
      redirect: "follow",
    });
    const fetchTime = timer.end("lectio-fetch");

    console.log(`🌐 LECTIO FETCH: ${fetchTime}ms - Status: ${resp.status}`);

    timer.start("response-validation");
    // Handle auth redirect or errors
    if (resp.status === 302 || resp.status === 301) {
      console.log(timer.getSummary());
      return json({ error: "Not authorized or session redirect." }, 401);
    }
    if (!resp.ok) {
      console.log(timer.getSummary());
      return json({ error: `Upstream error ${resp.status}` }, 502);
    }
    timer.end("response-validation");

    timer.start("html-reading");
    const html = await resp.text();
    timer.end("html-reading");

    console.log(`📄 HTML SIZE: ${html.length} characters`);

    timer.start("auth-checks");
    // Quick auth check: Lectio login marker (adjust to real marker you see)
    if (/unilogin|log\s*ind/i.test(html)) {
      console.log(timer.getSummary());
      return json({ error: "Session expired." }, 401);
    }

    // Check for robot detection
    if (/robot|captcha|anti-bot|bot-protection/i.test(html)) {
      console.log(timer.getSummary());
      console.log(html);
      return json({ error: "Robot detection." }, 403);
    }
    timer.end("auth-checks");

    const tz = "Europe/Copenhagen";
    const schedule = parseLectioSchedule(html, tz, timer);

    timer.start("response-building");
    // Build response + ETag
    const body: ScheduleResponse = {
      schedule,
      nextHash: hash(JSON.stringify(schedule.summary)), // stable hash based on summary
      updatedAt: Date.now(),
    };

    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.replace(/"/g, "") === body.nextHash) {
      timer.end("response-building");
      timer.end("request-total");
      console.log(timer.getSummary());
      return new Response(null, {
        status: 304,
        headers: {
          ETag: `"${body.nextHash}"`,
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const response = new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ETag: `"${body.nextHash}"`,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
    timer.end("response-building");
    timer.end("request-total");

    console.log(timer.getSummary());
    console.log(
      `📊 SCHEDULE STATS: ${schedule.summary.totalClasses} classes, ${schedule.days.length} days`
    );

    return response;
  } catch (err: any) {
    timer.end("request-total");
    console.log(timer.getSummary());

    // Don't leak internals, but provide helpful info for common issues
    const message = String(err?.message ?? "");
    console.error("error", err);
    if (
      message.includes("invalid header") ||
      message.includes("Headers.append")
    ) {
      return json(
        {
          error: "EDGE_FAILURE",
          detail:
            "Invalid header value. Check that your cookie contains only valid ASCII characters.",
        },
        500
      );
    }
    return json({ error: "EDGE_FAILURE", detail: message }, 500);
  }
}

/** Helper to send JSON */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// CORS
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-lectio-cookie, x-lectio-session",
      "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
    },
  });
}

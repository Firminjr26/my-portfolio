const SYSTEM_PROMPT = `You are Jesse Firmin Mallya's digital twin on his portfolio. Speak in first person as Jesse: warm, clear, professional, and concise. Answer questions about his career, skills, education, projects, and how to contact him. If a question is unrelated, politely say you can only talk about Jesse's work and steer back.

Facts you must stay consistent with:
- Full name: Jesse Firmin Mallya
- Location: Dar es Salaam, Tanzania
- Languages: English and Swahili
- Titles: Software Engineer Intern, Full-Stack Developer
- Email: jessemallya@gmail.com
- Phone: +255 653 294 241
- LinkedIn: https://www.linkedin.com/in/jesse-mallya-9a265536a/
- Portfolio: https://jesse-mallya-portfolio.vercel.app/
- CV is available on the portfolio
- Strengths: clear communicator, fast learner, problem solver, reliable under deadlines, works alone or in a team, takes ownership

Current roles:
- Software Engineer Intern at OpusFesta (May 2026–present, Dar es Salaam). Manages digital invitations from setup through guest-ready delivery. Builds invitation pages and supporting web features. Supports guest lists, RSVP tracking, and invitation quality checks. Improves invitation workflows, fixes production issues, and tests new templates.
- Web Developer and Entertainment Manager at King Empire (July 2024–present). Built and improved the company website including past and upcoming events. Created ticket-payment links so guests can book and pay online.

Previous roles:
- Computer Engineer at MUA Insurance Ltd (August 2025–October 2025, field work). Created and tested a company chatbot with the IT team. Restored servers, fixed printers, and kept office Ethernet working.
- Computer Engineer at BizyTech Ltd (August 2022–October 2023, field work). Designed the front end and implemented the back end for a web application. Performed computer repairs and system-software maintenance.

Do not mention Amani Warehouse unless asked; it is not on the current CV.

Projects:
- Dates to Come (https://dates-to-come.vercel.app/): Next.js, Node.js, TypeScript, Supabase, AI. Host creates a personal dating page and invites people with a private link. Registration, login, waitlist ranking, date requests, availability, places, preferences, host–guest messaging, realtime notifications, rank-up payments, admin dashboard, and an AI Digital Twin that answers waitlist, payment, and availability questions from live data.
- Online Task Management System: HTML, CSS, PHP, MySQL. Assign, track, and submit tasks, including leave reasons. Admin, teacher, and student dashboards.
- Student Complaints System: Oracle and MySQL. Complaints monitoring, submission, tracking, and response. Separate admin, student, and teacher dashboards. Migrated the database from MySQL to Oracle.
- King Empire Website: HTML/CSS/JavaScript. Previous and upcoming events, animation timing, picture overlays, ticket-payment links.
- Campus LAN Management at DIT: router and switch configuration, troubleshooting, performance and security monitoring.

Skills:
- Languages: TypeScript, JavaScript, PHP, HTML, CSS, SQL
- Stack: Next.js, Node.js, React, Supabase
- Data: Postgres, MySQL, Oracle, REST APIs
- AI: Embedded AI chat, live-data assistants
- Systems: LAN, servers, printers, surveillance

Education:
- B.Eng. Computer Engineering, Dar es Salaam Institute of Technology, 2024–present
- Ordinary Diploma in IT, DIT, 2021–2024, GPA 4.1, graduated with honors
- Certificate in Secondary Education, Centennial Christian Seminary, 2017–2020

Do not invent employers, dates, or skills. If you do not know something, say so and point people to email or LinkedIn. Keep answers short unless they ask for detail.`;

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 20000) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function normalizeMessages(body) {
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  return incoming
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .slice(-12)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 800),
    }));
}

async function openRouter(apiKey, messages, stream) {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://jesse-mallya-portfolio.vercel.app/",
      "X-Title": "Jesse Mallya Portfolio Twin",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      temperature: 0.5,
      max_tokens: 500,
      stream,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "Chat is not configured yet. Add OPENROUTER_API_KEY in the Vercel project settings.",
    });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    res.status(400).json({ error: "Could not read that message." });
    return;
  }

  const messages = normalizeMessages(body);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    res.status(400).json({ error: "Send a question about Jesse's career." });
    return;
  }

  const wantsStream = body.stream !== false;

  try {
    const response = await openRouter(apiKey, messages, wantsStream);

    if (!wantsStream) {
      const data = await response.json();
      if (!response.ok) {
        res.status(502).json({ error: data.error?.message || "OpenRouter request failed." });
        return;
      }
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        res.status(502).json({ error: "The twin did not return an answer. Try again." });
        return;
      }
      res.status(200).json({ reply });
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      res.status(502).json({ error: data.error?.message || "OpenRouter request failed." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        try {
          const json = JSON.parse(payload);
          const token = json.choices?.[0]?.delta?.content;
          if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
        } catch {
          // ignore keep-alives
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch {
    if (!res.headersSent) {
      res.status(502).json({ error: "Could not reach the twin right now." });
      return;
    }
    res.end();
  }
};

module.exports.config = {
  supportsResponseStreaming: true,
};
